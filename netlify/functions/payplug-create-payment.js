// Netlify Function : Créer un paiement Payplug
// Gère les acomptes, soldes et paiements en plusieurs fois

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
  if (!str) return '';
  return String(str)
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, maxLength);
}

/**
 * Génère une référence de commande unique
 */
function generateOrderReference() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MP${year}${month}-${random}`;
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
      paymentType,      // 'acompte', 'solde', 'full'
      orderReference,   // Référence de commande (optionnel)
      description,      // Description du paiement
      metadata,         // Données supplémentaires à stocker
      returnUrl,        // URL de retour après paiement
      cancelUrl,        // URL si annulation
      installments      // Nombre d'échéances pour paiement en plusieurs fois (2, 3, 4)
    } = data;

    // Validation
    if (!amount || amount < 100) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Montant invalide (minimum 1€)' })
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

    // Construire l'objet paiement Payplug
    const paymentPayload = {
      amount: Math.round(amount), // Montant en centimes
      currency: 'EUR',
      billing: {
        first_name: sanitize(customer.firstName, 100),
        last_name: sanitize(customer.lastName, 100),
        email: customer.email.trim().toLowerCase(),
        mobile_phone_number: customer.phone ? sanitize(customer.phone, 20) : undefined,
        address1: customer.address?.line1 ? sanitize(customer.address.line1, 255) : undefined,
        postcode: customer.address?.postalCode ? sanitize(customer.address.postalCode, 16) : undefined,
        city: customer.address?.city ? sanitize(customer.address.city, 100) : undefined,
        country: customer.address?.country || 'FR',
        language: 'fr'
      },
      shipping: {
        first_name: sanitize(customer.firstName, 100),
        last_name: sanitize(customer.lastName, 100),
        email: customer.email.trim().toLowerCase(),
        delivery_type: 'SHIP_TO_STORE' // Retrait en atelier
      },
      hosted_payment: {
        return_url: returnUrl || `${process.env.URL || 'https://mistralpans.fr'}/commander.html?status=success&ref=${reference}`,
        cancel_url: cancelUrl || `${process.env.URL || 'https://mistralpans.fr'}/commander.html?status=cancelled&ref=${reference}`
      },
      notification_url: `${process.env.URL || 'https://mistralpans.fr'}/.netlify/functions/payplug-webhook`,
      metadata: {
        order_reference: reference,
        payment_type: paymentType || 'full',
        customer_id: metadata?.customerId || null,
        instrument_id: metadata?.instrumentId || null,
        order_id: metadata?.orderId || null,
        ...metadata
      }
    };

    // Ajouter la description
    if (description) {
      paymentPayload.metadata.description = sanitize(description, 500);
    }

    // Configuration du paiement en plusieurs fois (Oney)
    if (installments && [3, 4].includes(installments)) {
      paymentPayload.payment_method = 'oney_x' + installments + '_with_fees';
      paymentPayload.authorized_amount = amount; // Montant autorisé total
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
      console.error('Erreur Payplug:', result);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Erreur création paiement',
          details: result.message || result.error_description || 'Erreur inconnue'
        })
      };
    }

    console.log('Paiement créé:', {
      id: result.id,
      reference: reference,
      amount: amount / 100,
      type: paymentType
    });

    // Retourner les informations nécessaires au frontend
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentId: result.id,
        paymentUrl: result.hosted_payment.payment_url,
        reference: reference,
        amount: amount,
        amountFormatted: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(amount / 100),
        expiresAt: result.hosted_payment.expires_at
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
