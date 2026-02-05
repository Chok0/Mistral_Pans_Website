// Netlify Function : Webhook Swikly
// Reçoit les notifications de caution (création, prélèvement, libération)

/**
 * Envoie un email de confirmation de caution
 */
async function sendDepositConfirmationEmail(deposit, metadata) {
  try {
    const response = await fetch(`${process.env.URL}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailType: 'rental_confirmation',
        client: {
          email: deposit.customer.email,
          prenom: deposit.customer.first_name,
          nom: deposit.customer.last_name
        },
        rental: {
          loyer: 60, // Loyer mensuel fixe
          caution: deposit.amount / 100,
          date_debut: new Date().toISOString().split('T')[0]
        },
        instrument: {
          gamme: metadata.instrument_name || 'Handpan'
        }
      })
    });

    if (!response.ok) {
      console.warn('Erreur envoi email confirmation caution:', await response.text());
    }
  } catch (error) {
    console.error('Erreur envoi email:', error);
  }
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
    // Vérifier la signature du webhook (si Swikly en fournit une)
    const signature = event.headers['x-swikly-signature'] || event.headers['X-Swikly-Signature'];
    // TODO: Implémenter la vérification de signature selon la documentation Swikly

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

        // TODO: Notifier l'admin et le client du prélèvement

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

        // TODO: Envoyer email de confirmation de libération au client

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
