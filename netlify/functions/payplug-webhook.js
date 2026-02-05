// Netlify Function : Webhook Payplug
// Reçoit les notifications de paiement et met à jour la base de données

const crypto = require('crypto');

/**
 * Vérifie la signature du webhook Payplug
 * @param {string} payload - Body de la requête
 * @param {string} signature - Header Payplug-Signature
 * @param {string} secretKey - Clé secrète Payplug
 * @returns {boolean}
 */
function verifySignature(payload, signature, secretKey) {
  if (!signature || !secretKey) return false;

  try {
    // Payplug utilise une signature RSA
    // La clé publique est fournie dans le dashboard Payplug
    // Pour simplifier, on vérifie que le paiement existe via l'API
    return true; // Vérification via API plus bas
  } catch (error) {
    console.error('Erreur vérification signature:', error);
    return false;
  }
}

/**
 * Récupère les détails d'un paiement via l'API Payplug
 */
async function getPaymentDetails(paymentId, secretKey) {
  const response = await fetch(`https://api.payplug.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      'PayPlug-Version': '2019-08-06'
    }
  });

  if (!response.ok) {
    throw new Error(`Erreur API Payplug: ${response.status}`);
  }

  return response.json();
}

/**
 * Envoie un email de confirmation de paiement
 */
async function sendPaymentConfirmationEmail(payment, metadata) {
  try {
    const response = await fetch(`${process.env.URL}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailType: 'payment_confirmation',
        client: {
          email: payment.billing.email,
          prenom: payment.billing.first_name,
          nom: payment.billing.last_name
        },
        payment: {
          amount: payment.amount / 100,
          reference: metadata.order_reference,
          type: metadata.payment_type
        }
      })
    });

    if (!response.ok) {
      console.warn('Erreur envoi email confirmation:', await response.text());
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

  const PAYPLUG_SECRET_KEY = process.env.PAYPLUG_SECRET_KEY;

  if (!PAYPLUG_SECRET_KEY) {
    console.error('PAYPLUG_SECRET_KEY non configurée');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configuration manquante' })
    };
  }

  try {
    const payload = JSON.parse(event.body);
    const { id: paymentId, is_paid, is_refunded, failure } = payload;

    if (!paymentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Payment ID manquant' })
      };
    }

    console.log('Webhook reçu:', {
      paymentId,
      is_paid,
      is_refunded,
      failure: failure?.code
    });

    // Vérifier le paiement via l'API Payplug (sécurité)
    const payment = await getPaymentDetails(paymentId, PAYPLUG_SECRET_KEY);

    if (!payment) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Paiement non trouvé' })
      };
    }

    const metadata = payment.metadata || {};
    const orderReference = metadata.order_reference;
    const paymentType = metadata.payment_type;

    console.log('Paiement vérifié:', {
      id: payment.id,
      reference: orderReference,
      amount: payment.amount / 100,
      is_paid: payment.is_paid,
      type: paymentType
    });

    // Traiter selon le statut du paiement
    if (payment.is_paid) {
      // Paiement réussi
      console.log(`Paiement ${paymentId} confirmé pour ${payment.amount / 100}€`);

      // Mettre à jour la base de données Supabase si configurée
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

      if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        try {
          // Enregistrer le paiement
          const paymentRecord = {
            payplug_id: payment.id,
            reference: orderReference,
            amount: payment.amount,
            currency: payment.currency,
            payment_type: paymentType,
            customer_email: payment.billing.email,
            customer_name: `${payment.billing.first_name} ${payment.billing.last_name}`,
            status: 'paid',
            paid_at: payment.hosted_payment.paid_at || new Date().toISOString(),
            metadata: metadata,
            raw_response: payment
          };

          const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/paiements`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(paymentRecord)
          });

          if (!insertResponse.ok) {
            console.warn('Erreur enregistrement paiement Supabase:', await insertResponse.text());
          }

          // Mettre à jour la commande si order_id présent
          if (metadata.order_id) {
            const updateData = paymentType === 'acompte'
              ? { statut: 'acompte_paye', acompte_paye: true, date_acompte: new Date().toISOString() }
              : { statut: 'paye', solde_paye: true, date_paiement: new Date().toISOString() };

            await fetch(`${SUPABASE_URL}/rest/v1/commandes?id=eq.${metadata.order_id}`, {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify(updateData)
            });
          }

        } catch (dbError) {
          console.error('Erreur mise à jour base de données:', dbError);
          // On continue quand même
        }
      }

      // Envoyer email de confirmation
      await sendPaymentConfirmationEmail(payment, metadata);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Paiement traité',
          reference: orderReference
        })
      };

    } else if (payment.is_refunded) {
      // Remboursement
      console.log(`Paiement ${paymentId} remboursé`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Remboursement traité',
          reference: orderReference
        })
      };

    } else if (payment.failure) {
      // Échec du paiement
      console.log(`Paiement ${paymentId} échoué:`, payment.failure);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Échec de paiement enregistré',
          reference: orderReference,
          failure: payment.failure.code
        })
      };

    } else {
      // Paiement en attente ou autre statut
      console.log(`Paiement ${paymentId} en attente`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Notification reçue',
          reference: orderReference
        })
      };
    }

  } catch (error) {
    console.error('Erreur webhook:', error);
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
