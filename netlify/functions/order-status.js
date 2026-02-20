// Netlify Function : Consulter le statut d'une commande
// Le client fournit sa référence + email (pas besoin de compte)

const { checkRateLimit, getClientIp } = require('./utils/rate-limit');

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email && emailRegex.test(email) && email.length <= 254;
}

function sanitize(str, maxLength = 100) {
  if (!str) return null;
  return String(str).replace(/[<>]/g, '').trim().substring(0, maxLength);
}

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

// Labels lisibles pour les statuts
const STATUS_LABELS = {
  en_attente: 'En attente',
  en_fabrication: 'En fabrication',
  accordage: 'Accordage',
  pret: 'Prêt',
  expedie: 'Expédié',
  livre: 'Livré',
  annule: 'Annulé'
};

const PAYMENT_STATUS_LABELS = {
  en_attente: 'En attente',
  partiel: 'Acompte versé',
  paye: 'Payé'
};

exports.handler = async (event, context) => {
  const allowedOrigin = getAllowedOrigin(event);

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

  // Rate limiting persistant (Supabase) — 10 lookups/min par IP
  const clientIp = getClientIp(event);
  const { allowed: rateLimitOk } = await checkRateLimit(clientIp, 'order-status', 10);
  if (!rateLimitOk) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: 'Trop de requêtes, veuillez réessayer dans une minute' })
    };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuration serveur manquante' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const reference = sanitize(data.reference, 20);
    const email = data.email?.trim().toLowerCase();

    if (!reference) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Référence de commande requise' })
      };
    }

    if (!email || !isValidEmail(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Adresse email invalide' })
      };
    }

    // Chercher la commande par référence + email (double vérification)
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/commandes?reference=eq.${encodeURIComponent(reference)}&customer_email=eq.${encodeURIComponent(email)}&select=reference,source,product_name,specifications,montant_total,montant_paye,payment_type,statut,statut_paiement,created_at,paid_at,tracking_number,estimated_delivery`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Erreur Supabase:', await response.text());
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Erreur serveur' })
      };
    }

    const orders = await response.json();

    if (!orders || orders.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Aucune commande trouvée avec cette référence et cet email' })
      };
    }

    const order = orders[0];

    // Construire la timeline
    const timeline = buildTimeline(order);

    // Retourner les données publiques (pas d'info interne)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        order: {
          reference: order.reference,
          productName: order.product_name,
          source: order.source,
          sourceLabel: order.source === 'stock' ? 'Instrument en stock' : 'Instrument sur mesure',
          montantTotal: order.montant_total,
          montantPaye: order.montant_paye,
          resteAPayer: Math.max(0, (order.montant_total || 0) - (order.montant_paye || 0)),
          statut: order.statut,
          statutLabel: STATUS_LABELS[order.statut] || order.statut,
          statutPaiement: order.statut_paiement,
          statutPaiementLabel: PAYMENT_STATUS_LABELS[order.statut_paiement] || order.statut_paiement,
          trackingNumber: order.tracking_number || null,
          estimatedDelivery: order.estimated_delivery || null,
          createdAt: order.created_at,
          paidAt: order.paid_at,
          timeline
        }
      })
    };

  } catch (error) {
    console.error('Erreur:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur' })
    };
  }
};

/**
 * Construit la timeline des étapes de la commande
 */
function buildTimeline(order) {
  const isStock = order.source === 'stock';

  const steps = isStock
    ? [
        { key: 'en_attente', label: 'Commande reçue', icon: '📦' },
        { key: 'pret', label: 'Prêt à expédier', icon: '✅' },
        { key: 'expedie', label: 'Expédié', icon: '🚚' },
        { key: 'livre', label: 'Livré', icon: '🎵' }
      ]
    : [
        { key: 'en_attente', label: 'Commande reçue', icon: '📦' },
        { key: 'en_fabrication', label: 'En fabrication', icon: '🔨' },
        { key: 'accordage', label: 'Accordage', icon: '🎶' },
        { key: 'pret', label: 'Prêt', icon: '✅' },
        { key: 'expedie', label: 'Expédié', icon: '🚚' },
        { key: 'livre', label: 'Livré', icon: '🎵' }
      ];

  const currentIndex = steps.findIndex(s => s.key === order.statut);

  return steps.map((step, index) => ({
    ...step,
    status: index < currentIndex ? 'done'
      : index === currentIndex ? 'current'
      : 'pending'
  }));
}
