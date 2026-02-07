// Netlify Function : Webhook Swikly
// Reçoit les notifications de caution (création, prélèvement, libération)

const crypto = require('crypto');

/**
 * Vérifie la signature HMAC du webhook Swikly
 * @param {string} body - Corps brut de la requête
 * @param {string} signature - Signature envoyée dans le header
 * @param {string} secret - Clé secrète Swikly
 * @returns {boolean}
 */
function verifySignature(body, signature, secret) {
  if (!signature || !secret) return false;

  const computed = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  // Comparaison en temps constant pour éviter les timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(computed, 'utf8')
    );
  } catch {
    return false;
  }
}

/**
 * Envoie un email via la fonction send-email
 */
async function sendEmail(payload) {
  try {
    const baseUrl = process.env.URL || 'https://mistralpans.fr';
    const response = await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn('Erreur envoi email:', await response.text());
    }
  } catch (error) {
    console.error('Erreur envoi email:', error);
  }
}

/**
 * Envoie un email de confirmation de caution au client
 */
async function sendDepositConfirmationEmail(deposit, metadata) {
  await sendEmail({
    emailType: 'rental_confirmation',
    client: {
      email: deposit.customer.email,
      prenom: deposit.customer.first_name,
      nom: deposit.customer.last_name
    },
    rental: {
      loyer: 60,
      caution: deposit.amount / 100,
      date_debut: new Date().toISOString().split('T')[0]
    },
    instrument: {
      gamme: metadata.instrument_name || 'Handpan'
    }
  });
}

/**
 * Notifie l'admin et le client d'un prelevement sur la caution
 */
async function sendDepositCapturedEmails(deposit, metadata) {
  const customerName = `${deposit.customer?.first_name || ''} ${deposit.customer?.last_name || ''}`.trim();
  const amount = (deposit.captured_amount || deposit.amount) / 100;
  const reference = metadata.rental_reference || 'N/A';

  // Notification admin
  await sendEmail({
    emailType: 'contact',
    nom: 'Swikly (auto)',
    email: 'noreply@mistralpans.fr',
    sujet: `Caution prelevee - ${customerName} (${reference})`,
    message: `Prelevement de ${amount} EUR sur la caution de ${customerName}.\nInstrument: ${metadata.instrument_name || 'Handpan'}\nReference: ${reference}`
  });

  // Notification client
  if (deposit.customer?.email) {
    await sendEmail({
      emailType: 'contact',
      destinataire: deposit.customer.email,
      nom: 'Mistral Pans',
      email: 'contact@mistralpans.fr',
      sujet: `Information sur votre caution - Mistral Pans`,
      message: `Bonjour ${deposit.customer.first_name || ''},\n\nUn prelevement de ${amount} EUR a ete effectue sur votre caution (ref: ${reference}).\n\nSi vous avez des questions, contactez-nous a contact@mistralpans.fr.\n\nMistral Pans`
    });
  }
}

/**
 * Notifie le client de la liberation de sa caution
 */
async function sendDepositReleasedEmail(deposit, metadata) {
  if (!deposit.customer?.email) return;

  const reference = metadata.rental_reference || 'N/A';

  await sendEmail({
    emailType: 'contact',
    destinataire: deposit.customer.email,
    nom: 'Mistral Pans',
    email: 'contact@mistralpans.fr',
    sujet: `Caution liberee - Mistral Pans`,
    message: `Bonjour ${deposit.customer.first_name || ''},\n\nVotre caution (ref: ${reference}) a ete liberee. Aucun montant ne sera preleve.\n\nMerci de votre confiance.\n\nMistral Pans`
  });
}

exports.handler = async (event, context) => {
  // Autoriser seulement POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  const SWIKLY_SECRET = process.env.SWIKLY_SECRET;

  if (!SWIKLY_SECRET) {
    console.error('SWIKLY_SECRET non configuré');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuration manquante' })
    };
  }

  try {
    // Vérifier la signature HMAC du webhook
    const signature = event.headers['x-swikly-signature'] || event.headers['X-Swikly-Signature'];

    if (!verifySignature(event.body, signature, SWIKLY_SECRET)) {
      console.warn('Signature webhook Swikly invalide');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Signature invalide' })
      };
    }

    const payload = JSON.parse(event.body);
    const { event: eventType, data } = payload;

    console.log('Webhook Swikly reçu:', {
      event: eventType,
      depositId: data?.id,
      reference: data?.metadata?.rental_reference
    });

    const metadata = data?.metadata || {};
    const reference = metadata.rental_reference;

    // Traiter selon le type d'événement
    switch (eventType) {
      case 'deposit.authorized':
      case 'deposit.created':
        // Caution autorisée/créée
        console.log(`Caution ${data.id} autorisée pour ${data.amount / 100}€`);

        // Mettre à jour la base de données si Supabase est configuré
        await updateDatabase('authorized', data, metadata);

        // Envoyer email de confirmation
        await sendDepositConfirmationEmail(data, metadata);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Caution autorisée',
            reference
          })
        };

      case 'deposit.captured':
        // Caution prélevée (en cas de dommages)
        console.log(`Caution ${data.id} prélevée: ${data.captured_amount / 100}€`);

        await updateDatabase('captured', data, metadata);

        await sendDepositCapturedEmails(data, metadata);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Prélèvement enregistré',
            reference,
            capturedAmount: data.captured_amount
          })
        };

      case 'deposit.released':
        // Caution libérée (fin de location)
        console.log(`Caution ${data.id} libérée`);

        await updateDatabase('released', data, metadata);

        await sendDepositReleasedEmail(data, metadata);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Caution libérée',
            reference
          })
        };

      case 'deposit.expired':
        // Caution expirée
        console.log(`Caution ${data.id} expirée`);

        await updateDatabase('expired', data, metadata);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Expiration enregistrée',
            reference
          })
        };

      case 'deposit.failed':
        // Échec de la caution
        console.log(`Caution ${data.id} échouée:`, data.failure_reason);

        await updateDatabase('failed', data, metadata);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Échec enregistré',
            reference
          })
        };

      default:
        console.log(`Événement non géré: ${eventType}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Événement reçu'
          })
        };
    }

  } catch (error) {
    console.error('Erreur webhook Swikly:', error);
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

/**
 * Met à jour la base de données Supabase
 */
async function updateDatabase(status, data, metadata) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('Supabase non configuré, skip mise à jour DB');
    return;
  }

  try {
    // Enregistrer/mettre à jour la caution
    const depositRecord = {
      swikly_id: data.id,
      reference: metadata.rental_reference,
      amount: data.amount,
      status: status,
      customer_email: data.customer?.email,
      customer_name: `${data.customer?.first_name || ''} ${data.customer?.last_name || ''}`.trim(),
      instrument_name: metadata.instrument_name,
      rental_duration: metadata.rental_duration_months,
      captured_amount: data.captured_amount || 0,
      updated_at: new Date().toISOString(),
      metadata: metadata,
      raw_response: data
    };

    // Upsert (insert ou update)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cautions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(depositRecord)
    });

    if (!response.ok) {
      console.warn('Erreur mise à jour caution Supabase:', await response.text());
    }

    // Si la caution est autorisée, mettre à jour la location
    if (status === 'authorized' && metadata.rental_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/locations?id=eq.${metadata.rental_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          caution_status: 'authorized',
          caution_swikly_id: data.id,
          statut: 'active'
        })
      });
    }

  } catch (error) {
    console.error('Erreur mise à jour base de données:', error);
  }
}
