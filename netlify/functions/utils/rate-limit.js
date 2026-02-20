/* ==========================================================================
   MISTRAL PANS - Rate Limiting Persistant (Supabase)

   Module partage par toutes les Netlify Functions pour limiter le nombre
   de requetes par IP et par fonction dans une fenetre de temps.

   Utilise une fonction RPC Supabase (check_rate_limit) qui effectue un
   upsert atomique : increment du compteur si meme fenetre, reset si
   nouvelle fenetre. Une seule requete reseau, pas de race condition.

   Politique par defaut : fail-open (si Supabase indisponible, la requete passe).
   Option fail-closed via 5e parametre (bloque si Supabase indisponible).

   Table Supabase : rate_limits (ip_address, function_name, window_start, request_count)
   RLS : aucun acces public (SERVICE_KEY only)

   Dependances : SUPABASE_URL + SUPABASE_SERVICE_KEY (env vars Netlify)
   ========================================================================== */

/**
 * Verifie et incremente le rate limit pour une IP + fonction.
 *
 * Appelle la RPC Supabase `check_rate_limit` qui fait un upsert atomique :
 *   - Si l'IP n'existe pas pour cette fonction → insere avec count=1
 *   - Si l'IP existe dans la meme fenetre     → incremente le compteur
 *   - Si l'IP existe dans une ancienne fenetre → reset a 1 (nouvelle fenetre)
 *
 * @param {string} ip - Adresse IP du client (x-forwarded-for)
 * @param {string} functionName - Identifiant de la fonction (ex: 'send-email', 'payplug')
 * @param {number} maxRequests - Nombre max de requetes autorisees par fenetre
 * @param {number} [windowMs=60000] - Duree de la fenetre en millisecondes (defaut: 1 minute)
 * @param {boolean} [failClosed=false] - Si true, bloque les requetes quand Supabase est indisponible
 * @returns {Promise<{allowed: boolean, remaining: number}>} allowed=false si limite depassee
 */
async function checkRateLimit(ip, functionName, maxRequests, windowMs, failClosed) {
  windowMs = windowMs || 60000;
  failClosed = failClosed || false;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  // Reponse par defaut en cas d'erreur (fail-open ou fail-closed selon config)
  const fallback = failClosed
    ? { allowed: false, remaining: 0 }
    : { allowed: true, remaining: maxRequests };

  if (!supabaseUrl || !serviceKey) {
    console.warn('[RateLimit] Supabase non configure' + (failClosed ? ' (fail-closed: BLOQUE)' : ''));
    return fallback;
  }

  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_ip: ip,
        p_function: functionName,
        p_max_requests: maxRequests,
        p_window_ms: windowMs
      })
    });

    if (!resp.ok) {
      console.warn('[RateLimit] Supabase error:', resp.status, failClosed ? '(fail-closed)' : '(fail-open)');
      return fallback;
    }

    const result = await resp.json();
    // La RPC retourne un tableau ou un objet selon la config Supabase
    const row = Array.isArray(result) ? result[0] : result;

    if (!row) {
      return fallback;
    }

    return {
      allowed: row.allowed,
      remaining: Math.max(0, maxRequests - row.current_count)
    };
  } catch (err) {
    console.warn('[RateLimit] Error:', err.message, failClosed ? '(fail-closed)' : '(fail-open)');
    return fallback;
  }
}

/**
 * Extrait l'adresse IP du client depuis les headers de la requete Netlify.
 *
 * Priorite :
 *   1. x-forwarded-for (premier IP de la chaine, ajoute par Netlify/CDN)
 *   2. client-ip (fallback Netlify)
 *   3. 'unknown' (dernier recours — toutes les requetes partagent le meme bucket)
 *
 * @param {Object} event - Objet event Netlify Functions
 * @returns {string} Adresse IP du client
 */
function getClientIp(event) {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers['client-ip']
    || 'unknown';
}

module.exports = { checkRateLimit, getClientIp };
