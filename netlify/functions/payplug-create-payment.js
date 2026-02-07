// Netlify Function : Créer un paiement Payplug
// Gère les acomptes, soldes, paiements complets et paiements en plusieurs fois (Oney)

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
 * Valide le prix d'un instrument en stock contre la base de données.
 * Empêche la manipulation de prix via les paramètres URL.
 */
async function validateStockPrice(amountCents, instrumentId, paymentType) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { valid: true }; // Pas de DB = pas de validation
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/instruments?id=eq.${instrumentId}&select=prix_vente,statut`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) return { valid: true };

    const instruments = await response.json();
    if (!instruments || instruments.length === 0) {
      return { valid: false, reason: 'Instrument non trouvé' };
    }

    const instrument = instruments[0];

    // Vérifier que l'instrument est toujours disponible
    if (instrument.statut !== 'en_stock' && instrument.statut !== 'disponible') {
      return { valid: false, reason: 'Cet instrument n\'est plus disponible' };
    }

    const dbPriceCents = instrument.prix_vente * 100;

    // Pour un acompte (30%), le montant doit être >= 30% du prix DB
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
      // Le montant doit couvrir au minimum le prix instrument
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
    return { valid: true }; // Fail open
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

    // Validation prix côté serveur pour instruments en stock
    if (metadata?.source === 'stock' && metadata?.instrumentId) {
      const priceCheck = await validateStockPrice(amount, metadata.instrumentId, paymentType);
      if (!priceCheck.valid) {
        console.error('Prix invalide:', priceCheck.reason);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: priceCheck.reason })
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
      delivery_type: 'SHIP_TO_STORE' // Retrait en atelier
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
      metadata: {
        order_reference: reference,
        payment_type: paymentType || 'full',
        source: metadata?.source || 'custom',
        customer_id: metadata?.customerId || null,
        instrument_id: metadata?.instrumentId || null,
        order_id: metadata?.orderId || null,
        product_name: sanitize(metadata?.productName, 100) || null,
        gamme: sanitize(metadata?.gamme, 50) || null,
        taille: sanitize(metadata?.taille, 20) || null,
        total_price_cents: metadata?.totalPrice ? metadata.totalPrice * 100 : amount,
        housse_id: metadata?.housseId || null,
        housse_nom: sanitize(metadata?.housseNom, 50) || null,
        housse_prix: metadata?.houssePrix || null,
        livraison: metadata?.livraison || false
      }
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
      paymentPayload.payment_context = {
        cart: [{
          brand: 'Mistral Pans',
          expected_delivery_date: getExpectedDeliveryDate(),
          delivery_label: 'Retrait atelier Mistral Pans',
          delivery_type: 'storepickup',
          merchant_item_id: reference,
          name: metadata?.gamme || 'Handpan sur mesure',
          price: Math.round(amount),
          quantity: 1,
          total_amount: Math.round(amount)
        }]
      };
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
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Erreur création paiement',
          details: result.message || 'Erreur inconnue'
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
