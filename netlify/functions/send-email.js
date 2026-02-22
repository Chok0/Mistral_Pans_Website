// Netlify Function : Envoi d'email via Brevo
// Supporte plusieurs types d'emails : contact, facture, confirmation, rapport

const { checkRateLimit, getClientIp } = require('./utils/rate-limit');
const { EmailHelpers } = require('./utils/email-template-system');
const templates = require('./email-templates');

const { isValidEmail } = EmailHelpers;

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

// Rate limiting : voir utils/rate-limit.js (persistant via Supabase)

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
      body: JSON.stringify({ error: 'Methode non autorisee' })
    };
  }

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Recuperer la cle API depuis les variables d'environnement
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  if (!BREVO_API_KEY) {
    console.error('BREVO_API_KEY non configuree');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuration serveur manquante' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { emailType } = data;

    // Anti-spam : honeypot
    if (data.website) {
      console.log('Bot detecte (honeypot)');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // Rate limiting persistant (Supabase) — fail-closed pour les emails
    const clientIp = getClientIp(event);
    const { allowed: rateLimitOk } = await checkRateLimit(clientIp, 'send-email', 5, 60000, true);
    if (!rateLimitOk) {
      console.warn(`Rate limit depasse pour ${clientIp}`);
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: 'Trop de requetes. Reessayez dans une minute.' })
      };
    }

    let emailData;

    // Router vers le bon template selon le type d'email
    switch (emailType) {
      case 'invoice':
        if (!data.client?.email || !data.facture?.numero) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Donnees facture manquantes' }) };
        }
        if (!isValidEmail(data.client.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email client invalide' }) };
        }
        emailData = templates.buildInvoiceEmail(data);
        break;

      case 'order_confirmation':
        if (!data.client?.email || !data.order) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Donnees commande manquantes' }) };
        }
        if (!isValidEmail(data.client.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email client invalide' }) };
        }
        emailData = templates.buildOrderConfirmationEmail(data);
        break;

      case 'rental_confirmation':
        if (!data.client?.email || !data.rental) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Donnees location manquantes' }) };
        }
        if (!isValidEmail(data.client.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email client invalide' }) };
        }
        emailData = templates.buildRentalConfirmationEmail(data);
        break;

      case 'rental_reservation':
        if (!data.client?.email || !data.instrument) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Donnees reservation location manquantes' }) };
        }
        if (!isValidEmail(data.client.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email client invalide' }) };
        }
        emailData = templates.buildRentalReservationEmail(data);
        break;

      case 'rental_availability':
        if (!data.email || !isValidEmail(data.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email invalide' }) };
        }
        emailData = templates.buildRentalAvailabilityEmail(data);
        break;

      case 'payment_confirmation':
        if (!data.client?.email || !data.payment) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Donnees paiement manquantes' }) };
        }
        if (!isValidEmail(data.client.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email client invalide' }) };
        }
        emailData = templates.buildPaymentConfirmationEmail(data);
        break;

      case 'new_order_notification':
        if (!data.order?.reference || !data.payment) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Donnees notification commande manquantes' }) };
        }
        emailData = templates.buildNewOrderNotificationEmail(data);
        break;

      case 'balance_request':
        if (!data.client?.email || !data.order?.reference) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Donnees demande de solde manquantes' }) };
        }
        if (!isValidEmail(data.client.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email client invalide' }) };
        }
        emailData = templates.buildBalanceRequestEmail(data);
        break;

      case 'shipping_notification':
        if (!data.client?.email || !data.order?.reference) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Donnees notification expedition manquantes' }) };
        }
        if (!isValidEmail(data.client.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email client invalide' }) };
        }
        emailData = templates.buildShippingNotificationEmail(data);
        break;

      case 'monthly_report':
        if (!data.emailDest || !isValidEmail(data.emailDest)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email destinataire invalide' }) };
        }
        if (!data.moisLabel) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Libelle du mois manquant' }) };
        }
        emailData = templates.buildMonthlyReportEmail(data);
        break;

      case 'delivery':
        if (!data.client?.email || !data.order?.reference) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Donnees livraison manquantes' }) };
        }
        if (!isValidEmail(data.client.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email client invalide' }) };
        }
        emailData = templates.buildDeliveryEmail(data);
        break;

      case 'initiation_confirmation':
        if (!data.email || !data.nom) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email et nom requis pour la confirmation d\'initiation' }) };
        }
        emailData = templates.buildInitiationConfirmationEmail(data);
        break;

      case 'contact':
      default:
        // Validation pour contact
        if (!data.firstname || !data.lastname || !data.email || !data.message) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Champs obligatoires manquants' }) };
        }
        if (!isValidEmail(data.email)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Format d\'email invalide' }) };
        }
        emailData = templates.buildContactEmail(data);
        break;
    }

    // Construire le payload Brevo
    const brevoPayload = {
      sender: {
        name: 'Mistral Pans',
        email: 'contact@mistralpans.fr'
      },
      to: emailData.to,
      subject: emailData.subject,
      htmlContent: emailData.htmlContent
    };

    // Ajouter les champs optionnels
    if (emailData.replyTo) brevoPayload.replyTo = emailData.replyTo;
    if (emailData.bcc) brevoPayload.bcc = emailData.bcc;
    if (emailData.attachment) brevoPayload.attachment = emailData.attachment;

    // Appel a l'API Brevo
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(brevoPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erreur Brevo:', result);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Erreur lors de l\'envoi' })
      };
    }

    console.log(`Email [${emailType || 'contact'}] envoye avec succes:`, result.messageId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email envoye avec succes',
        messageId: result.messageId
      })
    };

  } catch (error) {
    console.error('Erreur:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur, veuillez reessayer' })
    };
  }
};
