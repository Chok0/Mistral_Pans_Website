// Netlify Function : Créer un paiement Payplug
// Gère les acomptes, soldes, paiements complets et paiements en plusieurs fois (Oney)

const { checkRateLimit, getClientIp } = require('./utils/rate-limit');

/**
 * Valide le format d'une adresse email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email && emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitize une chaîne pour Payplug
 */
function sanitize(str, maxLength = 100) {
  if (!str) return null;
  return String(str)
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, maxLength);
}

/**
 * Génère une référence de commande unique (crypto-secure)
 */
function generateOrderReference() {
  const crypto = require('crypto');
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `MP${year}${month}-${random}`;
}

/**
 * Supprime les clés undefined/null d'un objet (un seul niveau)
 */
function cleanObject(obj) {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Nettoie un objet metadata pour l'API PayPlug.
 * PayPlug exige que toutes les valeurs metadata soient des strings.
 * Supprime les clés null/undefined et convertit les valeurs en strings.
 */
function cleanMetadata(obj) {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    cleaned[key] = String(value);
  }
  return cleaned;
}

/**
 * Récupère la configuration de tarification depuis Supabase (namespace=configurateur ou gestion).
 * Retourne les paramètres de pricing ou les defaults.
 */
async function getPricingConfig() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const defaults = {
    prixParNote: 115,
    bonusOctave2: 50,
    bonusBottoms: 25,
    malusDifficulteWarning: 5,
    malusDifficulteDifficile: 10
  };

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return defaults;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/configuration?namespace=eq.gestion&key=eq.mistral_gestion_config&select=value`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const rows = await response.json();
      if (rows.length > 0 && rows[0].value) {
        let config = rows[0].value;
        if (typeof config === 'string') {
          try { config = JSON.parse(config); } catch { /* keep as-is */ }
        }
        return {
          prixParNote: config.prixParNote ?? defaults.prixParNote,
          bonusOctave2: config.bonusOctave2 ?? defaults.bonusOctave2,
          bonusBottoms: config.bonusBottoms ?? defaults.bonusBottoms,
          malusDifficulteWarning: config.malusDifficulteWarning ?? defaults.malusDifficulteWarning,
          malusDifficulteDifficile: config.malusDifficulteDifficile ?? defaults.malusDifficulteDifficile
        };
      }
    }
  } catch (error) {
    console.warn('getPricingConfig: fallback to defaults', error.message);
  }

  return defaults;
}

/**
 * Récupère le malus prix d'une taille depuis Supabase.
 * @returns {number} Malus en EUR (0 si non trouvé)
 */
async function getSizeMalusFromDb(sizeCode) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !sizeCode) return 0;

  // Defaults hardcoded (fallback)
  const defaultMalus = { '45': 100, '50': 100, '53': 0 };

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/tailles?code=eq.${encodeURIComponent(sizeCode)}&select=prix_malus`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const rows = await response.json();
      if (rows.length > 0) return rows[0].prix_malus || 0;
    }
  } catch (error) {
    console.warn('getSizeMalusFromDb: fallback', error.message);
  }

  return defaultMalus[sizeCode] || 0;
}

/**
 * Recalcule le prix minimum d'une configuration custom côté serveur.
 * Utilise la même formule que le client (boutique.js calculatePrice).
 * Ne vérifie pas la faisabilité (on utilise 0% malus par défaut = prix plancher).
 *
 * @param {Object} item - Item du panier (type='custom')
 * @param {number} item.prix - Prix déclaré par le client
 * @param {Object} item.details - { notes (nombre), taille }
 * @param {Array} item.options - [{ type, prix }]
 * @returns {{ valid: boolean, reason?: string, expectedMin?: number }}
 */
async function validateCustomPrice(item) {
  const noteCount = item.details?.notes || item.details?.nombre_notes;
  const sizeCode = item.details?.taille;

  // Si pas de nombre de notes, on ne peut pas recalculer → accepter avec warning
  if (!noteCount || noteCount < 9 || noteCount > 17) {
    console.warn('validateCustomPrice: nombre de notes invalide ou absent', noteCount);
    // Borne minimale absolue : 9 notes × 115€ = 1035€ arrondi à 1030€
    const absoluteMin = Math.floor((9 * 115) / 5) * 5;
    if (item.prix < absoluteMin) {
      return {
        valid: false,
        reason: `Prix custom ${item.prix}€ inférieur au minimum absolu (${absoluteMin}€ pour 9 notes)`,
        expectedMin: absoluteMin
      };
    }
    return { valid: true };
  }

  const pricing = await getPricingConfig();
  const sizeMalus = await getSizeMalusFromDb(sizeCode);

  // Prix plancher : nombre de notes × prix par note + malus taille
  // On n'ajoute PAS les bonus octave2/bottoms/difficulté (prix plancher = le minimum possible)
  const minPrice = Math.floor((noteCount * pricing.prixParNote + sizeMalus) / 5) * 5;

  // Tolérance de 10€ pour les arrondis
  if (item.prix < minPrice - 10) {
    return {
      valid: false,
      reason: `Prix custom ${item.prix}€ inférieur au plancher calculé (${minPrice}€ pour ${noteCount} notes, taille ${sizeCode || '?'})`,
      expectedMin: minPrice
    };
  }

  return { valid: true };
}

/**
 * Valide le prix d'un accessoire contre la base de données.
 * Empêche la manipulation de prix des housses et autres accessoires.
 *
 * @param {string} accessoireId - ID Supabase de l'accessoire
 * @param {number} claimedPrice - Prix déclaré par le client
 * @returns {{ valid: boolean, reason?: string }}
 */
async function validateAccessoirePrice(accessoireId, claimedPrice) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { valid: false, reason: 'Validation accessoire indisponible' };
  }

  if (!accessoireId) return { valid: true }; // Pas d'ID = pas de validation

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/accessoires?id=eq.${encodeURIComponent(accessoireId)}&select=prix,nom,statut`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) return { valid: false, reason: 'Impossible de vérifier le prix accessoire' };

    const rows = await response.json();
    if (!rows || rows.length === 0) {
      return { valid: false, reason: `Accessoire ${accessoireId} non trouvé` };
    }

    const dbAccessoire = rows[0];
    const dbPrice = dbAccessoire.prix || 0;

    // Tolérance de 1€ pour les arrondis
    if (claimedPrice < dbPrice - 1) {
      return {
        valid: false,
        reason: `Prix accessoire "${dbAccessoire.nom}" : ${claimedPrice}€ déclaré vs ${dbPrice}€ en base`
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('validateAccessoirePrice:', error);
    return { valid: false, reason: 'Erreur validation accessoire' };
  }
}

/**
 * Valide le prix d'un instrument en stock contre la base de données.
 * Empêche la manipulation de prix via les paramètres URL.
 */
async function validateStockPrice(amountCents, instrumentId, paymentType) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Variables Supabase manquantes pour la validation de prix');
    return { valid: false, reason: 'Validation de prix indisponible' };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/instruments?id=eq.${instrumentId}&select=prix_vente,statut,promo_percent`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) return { valid: false, reason: 'Impossible de vérifier le prix' };

    const instruments = await response.json();
    if (!instruments || instruments.length === 0) {
      return { valid: false, reason: 'Instrument non trouvé' };
    }

    const instrument = instruments[0];

    // Vérifier que l'instrument est toujours disponible
    if (instrument.statut !== 'en_stock' && instrument.statut !== 'disponible') {
      return { valid: false, reason: 'Cet instrument n\'est plus disponible' };
    }

    // Appliquer la promo si applicable (même formule que cart.js: arrondi à 5€ inf.)
    const promoPercent = instrument.promo_percent || 0;
    const effectivePrice = promoPercent > 0
      ? Math.floor(instrument.prix_vente * (1 - promoPercent / 100) / 5) * 5
      : instrument.prix_vente;
    const dbPriceCents = effectivePrice * 100;

    console.log('[validateStockPrice]', {
      instrumentId,
      paymentType,
      amountCents,
      dbPrixVente: instrument.prix_vente,
      promoPercent,
      effectivePrice,
      dbPriceCents,
      statut: instrument.statut
    });

    // Pour un acompte (30%), le montant doit être >= 30% du prix effectif
    if (paymentType === 'acompte') {
      const expectedDeposit = Math.round(dbPriceCents * 0.30);
      // Tolérance de 1€ pour les arrondis
      if (amountCents < expectedDeposit - 100) {
        return {
          valid: false,
          reason: `Acompte insuffisant (${amountCents / 100}€ vs ${expectedDeposit / 100}€ attendu)`
        };
      }
    } else if (paymentType === 'full' || paymentType === 'installments') {
      // Le montant doit couvrir au minimum le prix effectif (après promo)
      // (peut être plus élevé si housse/livraison inclus)
      if (amountCents < dbPriceCents - 100) {
        return {
          valid: false,
          reason: `Montant insuffisant (${amountCents / 100}€ vs ${dbPriceCents / 100}€ minimum)`
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('Erreur validation prix stock:', error);
    return { valid: false, reason: 'Erreur lors de la validation du prix' };
  }
}

/**
 * Retourne l'origine CORS autorisée
 */
function getAllowedOrigin(event) {
  const ALLOWED_ORIGINS = [
    'https://mistralpans.fr',
    'https://www.mistralpans.fr'
  ];
  // Autoriser localhost en développement (Netlify CONTEXT !== 'production')
  if (process.env.CONTEXT !== 'production') {
    ALLOWED_ORIGINS.push('http://localhost:8000', 'http://127.0.0.1:8000');
  }
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

exports.handler = async (event, context) => {
  const allowedOrigin = getAllowedOrigin(event);

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Autoriser seulement POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Méthode non autorisée' })
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin
  };

  // Rate limiting persistant (Supabase) — fail-closed pour les paiements
  const clientIp = getClientIp(event);
  const { allowed: rateLimitOk } = await checkRateLimit(clientIp, 'payplug', 5, 60000, true);
  if (!rateLimitOk) {
    console.warn(`Rate limit dépassé pour ${clientIp}`);
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: 'Trop de requêtes, veuillez réessayer dans une minute' })
    };
  }

  // Récupérer les clés API
  const PAYPLUG_SECRET_KEY = process.env.PAYPLUG_SECRET_KEY;

  if (!PAYPLUG_SECRET_KEY) {
    console.error('PAYPLUG_SECRET_KEY non configurée');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuration paiement manquante' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const {
      amount,           // Montant en centimes (ex: 30000 pour 300€)
      customer,         // { email, firstName, lastName, phone, address }
      paymentType,      // 'acompte', 'solde', 'full', 'installments'
      orderReference,   // Référence de commande (optionnel)
      description,      // Description du paiement (max 80 caractères)
      metadata,         // Données supplémentaires à stocker
      returnUrl,        // URL de retour après paiement
      cancelUrl,        // URL si annulation
      installments,     // Nombre d'échéances pour paiement en plusieurs fois (3 ou 4)
      integrated        // true pour utiliser IntegratedPayment (formulaire embarqué)
    } = data;

    const isOney = installments && [3, 4].includes(installments);

    // ── Validation prix côté serveur ──
    if (metadata?.cartMode && metadata?.items) {
      // Mode panier multi-items : valider chaque item
      console.log('[PayPlug] Validation panier:', {
        paymentType,
        totalAmount: amount,
        itemCount: metadata.items.length,
        items: metadata.items.map(i => ({
          type: i.type,
          nom: i.nom,
          sourceId: i.sourceId,
          prix: i.prix,
          total: i.total,
          quantite: i.quantite,
          options: i.options?.length || 0
        }))
      });
      for (const item of metadata.items) {
        // 1. Instruments en stock : vérifier prix DB
        if (item.type === 'instrument' && item.sourceId) {
          const itemPriceCents = (item.total || item.prix) * 100;
          const priceCheck = await validateStockPrice(itemPriceCents, item.sourceId, paymentType);
          if (!priceCheck.valid) {
            console.error('Prix invalide (cart instrument):', priceCheck.reason, item.sourceId);
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Montant invalide pour l\'instrument ' + (item.nom || item.sourceId) })
            };
          }
        }

        // 2. Configurations custom : recalculer prix plancher
        if (item.type === 'custom') {
          const customCheck = await validateCustomPrice(item);
          if (!customCheck.valid) {
            console.error('Prix invalide (cart custom):', customCheck.reason);
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Prix invalide pour la configuration sur mesure' })
            };
          }
        }

        // 3. Accessoires : vérifier prix DB
        if (item.type === 'accessoire' && item.sourceId) {
          const accCheck = await validateAccessoirePrice(item.sourceId, item.prix);
          if (!accCheck.valid) {
            console.error('Prix invalide (cart accessoire):', accCheck.reason);
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Prix invalide pour l\'accessoire ' + (item.nom || item.sourceId) })
            };
          }
        }

        // 4. Options (housse) sur un item : vérifier prix DB
        if (item.options && Array.isArray(item.options)) {
          for (const opt of item.options) {
            if (opt.type === 'housse' && opt.id) {
              const optCheck = await validateAccessoirePrice(opt.id, opt.prix);
              if (!optCheck.valid) {
                console.error('Prix invalide (option housse):', optCheck.reason);
                return {
                  statusCode: 400,
                  headers,
                  body: JSON.stringify({ error: 'Prix invalide pour l\'option ' + (opt.nom || opt.id) })
                };
              }
            }
          }
        }
      }
    } else if (metadata?.source === 'stock' && metadata?.instrumentId) {
      // Mode legacy single stock instrument
      const priceCheck = await validateStockPrice(amount, metadata.instrumentId, paymentType);
      if (!priceCheck.valid) {
        console.error('Prix invalide:', priceCheck.reason);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Montant invalide pour cet instrument' })
        };
      }
    } else if (metadata?.source === 'custom') {
      // Mode legacy single custom configuration
      // Pour un acompte, amount = 30% du total → utiliser totalPrice pour valider le prix instrument
      const totalEur = (paymentType === 'acompte' && metadata?.totalPrice)
        ? metadata.totalPrice
        : amount / 100;
      const customItem = {
        prix: totalEur - (metadata?.houssePrix || 0) - (metadata?.shippingCost || 0),
        details: {
          notes: metadata?.notes || null,
          taille: metadata?.taille || null
        }
      };
      const customCheck = await validateCustomPrice(customItem);
      if (!customCheck.valid) {
        console.error('Prix invalide (legacy custom):', customCheck.reason);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Prix invalide pour la configuration sur mesure' })
        };
      }
    }

    // Validation initiation : prix fixe depuis config
    if (metadata?.source === 'initiation') {
      let initiationPrix = 60; // default
      const sbUrl = process.env.SUPABASE_URL;
      const sbKey = process.env.SUPABASE_SERVICE_KEY;
      if (sbUrl && sbKey) {
        try {
          const configResp = await fetch(
            `${sbUrl}/rest/v1/configuration?namespace=eq.gestion&key=eq.initiations_prix&select=value`,
            { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` } }
          );
          if (configResp.ok) {
            const rows = await configResp.json();
            if (rows.length > 0) initiationPrix = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
          }
        } catch (e) { /* use default */ }
      }
      const expectedCents = initiationPrix * 100;
      if (amount !== expectedCents) {
        console.error('Prix initiation invalide:', amount, 'attendu:', expectedCents);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Montant invalide pour l\'initiation' })
        };
      }
    }

    // Valider les accessoires legacy (housse en mode single)
    if (metadata?.housseId && metadata?.houssePrix !== undefined) {
      const housseCheck = await validateAccessoirePrice(metadata.housseId, metadata.houssePrix);
      if (!housseCheck.valid) {
        console.error('Prix invalide (legacy housse):', housseCheck.reason);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Prix invalide pour la housse' })
        };
      }
    }

    // Validation montant (API PayPlug: min 99 cents, max 2 000 000 cents)
    if (!amount || amount < 99) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Montant invalide (minimum 0,99 €)' })
      };
    }
    if (amount > 2000000) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Montant invalide (maximum 20 000 €)' })
      };
    }

    // Oney: montant entre 100€ et 3000€
    if (isOney && (amount < 10000 || amount > 300000)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Paiement Oney : montant entre 100 € et 3 000 €' })
      };
    }

    if (!customer?.email || !isValidEmail(customer.email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email client invalide' })
      };
    }

    if (!customer?.firstName || !customer?.lastName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Nom et prénom requis' })
      };
    }

    // Générer la référence si non fournie
    const reference = orderReference || generateOrderReference();
    const baseUrl = process.env.URL || 'https://mistralpans.fr';

    // Construire l'objet billing (champs nettoyés)
    const billing = cleanObject({
      first_name: sanitize(customer.firstName, 100),
      last_name: sanitize(customer.lastName, 100),
      email: customer.email.trim().toLowerCase(),
      mobile_phone_number: sanitize(customer.phone, 20),
      address1: sanitize(customer.address?.line1, 255),
      postcode: sanitize(customer.address?.postalCode, 16),
      city: sanitize(customer.address?.city, 100),
      country: customer.address?.country || 'FR',
      language: 'fr'
    });

    // delivery_type PSD2 : SHIP_TO_STORE si retrait, CARRIER si expédition
    const shippingMethod = metadata?.shippingMethod || 'retrait';
    const deliveryType = shippingMethod === 'colissimo' ? 'CARRIER' : 'SHIP_TO_STORE';

    // Construire l'objet shipping
    const shipping = cleanObject({
      first_name: sanitize(customer.firstName, 100),
      last_name: sanitize(customer.lastName, 100),
      email: customer.email.trim().toLowerCase(),
      address1: sanitize(customer.address?.line1, 255),
      postcode: sanitize(customer.address?.postalCode, 16),
      city: sanitize(customer.address?.city, 100),
      country: customer.address?.country || 'FR',
      language: 'fr',
      delivery_type: deliveryType
    });

    // Construire le payload de base
    const paymentPayload = {
      currency: 'EUR',
      billing,
      shipping,
      hosted_payment: {
        return_url: returnUrl || `${baseUrl}/commander.html?status=success&ref=${reference}`,
        cancel_url: cancelUrl || `${baseUrl}/commander.html?status=cancelled&ref=${reference}`
      },
      notification_url: `${baseUrl}/.netlify/functions/payplug-webhook`,
      metadata: cleanMetadata(metadata?.cartMode ? {
        // Mode panier multi-items
        order_reference: reference,
        payment_type: paymentType || 'full',
        source: metadata?.source || 'mixed',
        cart_mode: 'true',
        items: JSON.stringify((metadata?.items || []).map(item => ({
          type: item.type,
          sourceId: item.sourceId,
          nom: sanitize(item.nom, 60),
          prix: item.prix,
          quantite: item.quantite || 1,
          total: item.total,
          gamme: item.details?.gamme || item.gamme || null,
          taille: item.details?.taille || item.taille || null,
          notes: item.details?.notes || null,
          options: item.options || []
        }))),
        product_name: sanitize(metadata?.productName, 100),
        total_price_cents: metadata?.totalPrice ? String(metadata.totalPrice * 100) : String(amount),
        instrument_id: metadata?.instrumentId
      } : {
        // Mode legacy single item
        order_reference: reference,
        payment_type: paymentType || 'full',
        source: metadata?.source || 'custom',
        customer_id: metadata?.customerId,
        instrument_id: metadata?.instrumentId,
        order_id: metadata?.orderId,
        product_name: sanitize(metadata?.product_name || metadata?.productName, 100),
        gamme: sanitize(metadata?.gamme, 50),
        taille: sanitize(metadata?.taille, 20),
        notes: metadata?.notes,
        total_price_cents: metadata?.totalPrice ? String(metadata.totalPrice * 100) : String(amount),
        housse_id: metadata?.housseId,
        housse_nom: sanitize(metadata?.housseNom, 50),
        housse_prix: metadata?.houssePrix,
        livraison: metadata?.livraison ? 'true' : undefined,
        // Initiation-specific fields
        initiation_id: metadata?.initiation_id,
        initiation_date: metadata?.initiation_date,
        customer_name: sanitize(metadata?.customer_name, 100),
        customer_email: metadata?.customer_email,
        customer_phone: sanitize(metadata?.customer_phone, 20)
      })
    };

    // Description à la racine du payload (max 80 caractères, visible par le client)
    if (description) {
      paymentPayload.description = sanitize(description, 80);
    }

    // Mode Integrated Payment (formulaire de carte embarqué)
    if (integrated && !isOney) {
      paymentPayload.integration = 'INTEGRATED_PAYMENT';
    }

    // Montant : authorized_amount pour Oney, amount pour le reste
    if (isOney) {
      paymentPayload.authorized_amount = Math.round(amount);
      paymentPayload.auto_capture = true;
      paymentPayload.payment_method = `oney_x${installments}_with_fees`;

      // Oney requiert des champs supplémentaires
      if (!billing.address1 || !billing.postcode || !billing.city) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Paiement Oney : adresse complète requise' })
        };
      }
      if (!billing.mobile_phone_number) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Paiement Oney : numéro de téléphone requis' })
        };
      }

      // Ajouter company_name au shipping (requis par Oney)
      paymentPayload.shipping.company_name = 'Mistral Pans';

      // payment_context requis pour Oney
      const oneyDeliveryType = shippingMethod === 'colissimo' ? 'carrier' : 'storepickup';
      const oneyDeliveryLabel = shippingMethod === 'colissimo'
        ? 'Livraison Colissimo'
        : 'Retrait atelier Mistral Pans';
      const oneyCartItems = [];
      if (metadata?.cartMode && metadata?.items) {
        metadata.items.forEach((item, idx) => {
          oneyCartItems.push({
            brand: 'Mistral Pans',
            expected_delivery_date: getExpectedDeliveryDate(),
            delivery_label: oneyDeliveryLabel,
            delivery_type: oneyDeliveryType,
            merchant_item_id: item.sourceId || (reference + '-' + idx),
            name: sanitize(item.nom, 50) || 'Article',
            price: Math.round((item.total || item.prix) * 100),
            quantity: item.quantite || 1,
            total_amount: Math.round((item.total || item.prix) * 100)
          });
        });
      } else {
        oneyCartItems.push({
          brand: 'Mistral Pans',
          expected_delivery_date: getExpectedDeliveryDate(),
          delivery_label: oneyDeliveryLabel,
          delivery_type: oneyDeliveryType,
          merchant_item_id: reference,
          name: metadata?.gamme || 'Handpan sur mesure',
          price: Math.round(amount),
          quantity: 1,
          total_amount: Math.round(amount)
        });
      }
      paymentPayload.payment_context = { cart: oneyCartItems };
    } else {
      paymentPayload.amount = Math.round(amount);
    }

    // Appel à l'API Payplug
    const response = await fetch('https://api.payplug.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYPLUG_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'PayPlug-Version': '2019-08-06'
      },
      body: JSON.stringify(paymentPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erreur Payplug:', JSON.stringify(result));
      // Extraire un message lisible depuis la réponse PayPlug
      const ppMessage = result?.message || result?.details?.message || '';
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Erreur création paiement' + (ppMessage ? ' : ' + ppMessage : '')
        })
      };
    }

    console.log('Paiement créé:', {
      id: result.id,
      reference,
      amount: amount / 100,
      type: paymentType,
      oney: isOney ? `${installments}x` : false
    });

    // Retourner les informations nécessaires au frontend
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentId: result.id,
        paymentUrl: result.hosted_payment?.payment_url,
        reference,
        amount,
        amountFormatted: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(amount / 100)
      })
    };

  } catch (error) {
    console.error('Erreur:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Erreur serveur, veuillez réessayer'
      })
    };
  }
};

/**
 * Calcule une date de livraison estimée (12 semaines)
 * Format YYYY-MM-DD requis par Oney
 */
function getExpectedDeliveryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 84); // 12 semaines
  return date.toISOString().split('T')[0];
}
