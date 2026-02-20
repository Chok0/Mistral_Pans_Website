/* ==========================================================================
   MISTRAL PANS - Teacher Signup Netlify Function

   Proxy securise pour les inscriptions de professeurs.
   Remplace l'insert direct client → Supabase par un passage serveur avec :
     - Rate limiting fail-closed (5 req/h par IP)
     - Verification honeypot cote serveur
     - Validation des champs obligatoires
     - Sanitisation des donnees
     - Insert Supabase via SERVICE_KEY (bypass RLS)

   Endpoint : POST /.netlify/functions/teacher-signup
   ========================================================================== */

const { checkRateLimit, getClientIp } = require('./utils/rate-limit');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retourne l'origine CORS autorisee
 */
function getAllowedOrigin(event) {
  const ALLOWED_ORIGINS = [
    'https://mistralpans.fr',
    'https://www.mistralpans.fr'
  ];
  if (process.env.CONTEXT !== 'production') {
    ALLOWED_ORIGINS.push('http://localhost:8000', 'http://127.0.0.1:8000');
  }
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

/**
 * Valide le format d'une adresse email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Nettoie une chaine : trim + limite de longueur
 */
function clean(str, maxLen = 500) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().substring(0, maxLen);
}

/**
 * Valide un code postal francais (5 chiffres)
 */
function isValidPostalCode(code) {
  return /^[0-9]{5}$/.test(code);
}

/**
 * Valide les coordonnees GPS
 */
function isValidCoords(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number'
    && lat >= -90 && lat <= 90
    && lng >= -180 && lng <= 180;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  const allowedOrigin = getAllowedOrigin(event);

  // CORS headers communs
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Seulement POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Methode non autorisee' })
    };
  }

  // Verifier la config Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[teacher-signup] SUPABASE_URL ou SUPABASE_SERVICE_KEY non configure');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuration serveur manquante' })
    };
  }

  try {
    const data = JSON.parse(event.body);

    // -----------------------------------------------------------------------
    // 1. Honeypot (champ "website" invisible — si rempli = bot)
    //    Note : le vrai champ "site web" du formulaire s'appelle "site_web"
    //    dans le payload envoye par le client. Le champ "website" est le honeypot.
    // -----------------------------------------------------------------------
    if (data.honeypot) {
      console.log('[teacher-signup] Bot detecte (honeypot)');
      // Faux succes pour tromper le bot
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // -----------------------------------------------------------------------
    // 2. Rate limiting — fail-closed, 5 req/heure par IP
    // -----------------------------------------------------------------------
    const clientIp = getClientIp(event);
    const { allowed: rateLimitOk } = await checkRateLimit(
      clientIp, 'teacher-signup', 5, 3600000, true  // failClosed = true
    );

    if (!rateLimitOk) {
      console.warn(`[teacher-signup] Rate limit depasse pour ${clientIp}`);
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: 'Trop de demandes. Reessayez dans une heure.' })
      };
    }

    // -----------------------------------------------------------------------
    // 3. Validation des champs obligatoires
    // -----------------------------------------------------------------------
    const firstname = clean(data.firstname, 100);
    const lastname = clean(data.lastname, 100);
    const email = clean(data.email, 254).toLowerCase();
    const postalcode = clean(data.postalcode, 5);
    const city = clean(data.city, 100);
    const bio = clean(data.bio, 2000);

    if (!firstname || !lastname) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Prenom et nom requis' })
      };
    }

    if (!isValidEmail(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email invalide' })
      };
    }

    if (!isValidPostalCode(postalcode)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Code postal invalide (5 chiffres)' })
      };
    }

    if (!city) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Ville requise' })
      };
    }

    // courseTypes et courseFormats — au moins un de chaque
    const validCourseTypes = ['domicile', 'studio', 'distance'];
    const validCourseFormats = ['solo', 'groupe'];

    const courseTypes = Array.isArray(data.courseTypes)
      ? data.courseTypes.filter(t => validCourseTypes.includes(t))
      : [];
    const courseFormats = Array.isArray(data.courseFormats)
      ? data.courseFormats.filter(f => validCourseFormats.includes(f))
      : [];

    if (courseTypes.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Selectionnez au moins un type de cours' })
      };
    }

    if (courseFormats.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Selectionnez au moins un format de cours' })
      };
    }

    // -----------------------------------------------------------------------
    // 4. Sanitisation des champs optionnels
    // -----------------------------------------------------------------------
    const phone = clean(data.phone, 20);
    const location = city + (postalcode ? ` (${postalcode})` : '');
    const name = `${firstname} ${lastname}`;

    // Coordonnees GPS (fournies par le client apres geocodage)
    let lat = 48.8566; // Defaut Paris
    let lng = 2.3522;
    if (data.lat != null && data.lng != null) {
      const parsedLat = parseFloat(data.lat);
      const parsedLng = parseFloat(data.lng);
      if (isValidCoords(parsedLat, parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }

    // Photo (base64 data URL — limiter a ~2MB encode)
    let photo = null;
    if (data.photo && typeof data.photo === 'string' && data.photo.startsWith('data:image/')) {
      // Limiter la taille (~2MB en base64 = ~2.7M caracteres)
      if (data.photo.length <= 3000000) {
        photo = data.photo;
      }
    }

    // Reseaux sociaux (optionnels)
    const website = clean(data.website, 500) || null;
    const instagram = clean(data.instagram, 100) || null;
    const facebook = clean(data.facebook, 500) || null;
    const youtube = clean(data.youtube, 500) || null;
    const tiktok = clean(data.tiktok, 100) || null;
    const instrumentAvailable = data.instrumentAvailable === true;

    // -----------------------------------------------------------------------
    // 5. Insert Supabase (SERVICE_KEY = bypass RLS)
    // -----------------------------------------------------------------------
    const row = {
      firstname,
      lastname,
      nom: name,
      email,
      phone: phone || null,
      postalcode,
      city,
      location,
      lat,
      lng,
      bio: bio || null,
      photo_url: photo,
      course_types: courseTypes,
      course_formats: courseFormats,
      instrument_available: instrumentAvailable,
      website,
      instagram,
      facebook,
      youtube,
      tiktok,
      statut: 'pending',
      submitted_at: new Date().toISOString()
    };

    const resp = await fetch(`${supabaseUrl}/rest/v1/professeurs`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(row)
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[teacher-signup] Supabase insert error:', resp.status, errBody);

      // Doublon email ? (unique constraint)
      if (resp.status === 409 || (errBody && errBody.includes('duplicate'))) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ error: 'Une demande avec cet email existe deja.' })
        };
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Erreur lors de l\'enregistrement' })
      };
    }

    const inserted = await resp.json();
    console.log('[teacher-signup] Nouveau professeur pending:', inserted[0]?.id || 'ok');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Demande envoyee avec succes'
      })
    };

  } catch (error) {
    console.error('[teacher-signup] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur, veuillez reessayer' })
    };
  }
};
