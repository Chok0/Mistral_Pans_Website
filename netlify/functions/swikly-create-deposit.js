// Netlify Function : Créer une caution Swikly
// Gère les dépôts de garantie pour les locations d'instruments

/**
 * Valide le format d'une adresse email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email && emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitize une chaîne
 */
function sanitize(str, maxLength = 100) {
  if (!str) return '';
  return String(str)
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, maxLength);
}

/**
 * Génère une référence de location unique
 */
function generateRentalReference() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LOC${year}${month}-${random}`;
}

exports.handler = async (event, context) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
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
    'Access-Control-Allow-Origin': '*'
  };

  // Récupérer les clés API Swikly
  const SWIKLY_API_KEY = process.env.SWIKLY_API_KEY;
  const SWIKLY_SECRET = process.env.SWIKLY_SECRET;

  if (!SWIKLY_API_KEY || !SWIKLY_SECRET) {
    console.error('Clés Swikly non configurées');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuration caution manquante' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const {
      amount,           // Montant de la caution en centimes
      customer,         // { email, firstName, lastName, phone }
      rentalReference,  // Référence de location (optionnel)
      instrumentName,   // Nom de l'instrument
      rentalDuration,   // Durée en mois
      metadata          // Données supplémentaires
    } = data;

    // Validation
    if (!amount || amount < 10000) { // Minimum 100€
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Montant de caution invalide (minimum 100€)' })
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
    const reference = rentalReference || generateRentalReference();

    // Date d'expiration de la caution (durée de location + 1 mois de marge)
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + (rentalDuration || 3) + 1);

    // Construire le payload Swikly
    // Note: L'API Swikly exacte peut varier, adapter selon documentation officielle
    const swiklyPayload = {
      amount: Math.round(amount), // En centimes
      currency: 'EUR',
      description: `Caution location ${instrumentName || 'Handpan'} - Ref: ${reference}`,
      customer: {
        email: customer.email.trim().toLowerCase(),
        first_name: sanitize(customer.firstName, 50),
        last_name: sanitize(customer.lastName, 50),
        phone: customer.phone ? sanitize(customer.phone, 20) : undefined,
        language: 'fr'
      },
      expiration_date: expirationDate.toISOString().split('T')[0],
      return_url: `${process.env.URL || 'https://mistralpans.fr'}/location.html?status=success&ref=${reference}`,
      cancel_url: `${process.env.URL || 'https://mistralpans.fr'}/location.html?status=cancelled&ref=${reference}`,
      webhook_url: `${process.env.URL || 'https://mistralpans.fr'}/.netlify/functions/swikly-webhook`,
      metadata: {
        rental_reference: reference,
        instrument_name: instrumentName,
        rental_duration_months: rentalDuration || 3,
        ...metadata
      }
    };

    // Appel à l'API Swikly
    // Note: Remplacer par l'URL exacte de l'API Swikly
    const response = await fetch('https://api.swikly.com/v1/deposits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SWIKLY_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Swikly-Secret': SWIKLY_SECRET
      },
      body: JSON.stringify(swiklyPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erreur Swikly:', result);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Erreur création caution',
          details: result.message || result.error || 'Erreur inconnue'
        })
      };
    }

    console.log('Caution créée:', {
      id: result.id,
      reference: reference,
      amount: amount / 100
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        depositId: result.id,
        depositUrl: result.payment_url || result.url,
        reference: reference,
        amount: amount,
        amountFormatted: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(amount / 100),
        expiresAt: expirationDate.toISOString()
      })
    };

  } catch (error) {
    console.error('Erreur:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Erreur serveur',
        details: error.message
      })
    };
  }
};
