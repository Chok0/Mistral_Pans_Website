// Netlify Function : Webhook Payplug
// Reçoit les notifications de paiement/remboursement et met à jour la base de données

/**
 * Récupère les détails d'un paiement via l'API Payplug
 * Sert aussi de vérification d'authenticité (cf. doc PayPlug Security notice)
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
 * Récupère les détails d'un remboursement via l'API Payplug
 */
async function getRefundDetails(paymentId, refundId, secretKey) {
  const response = await fetch(
    `https://api.payplug.com/v1/payments/${paymentId}/refunds/${refundId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        'PayPlug-Version': '2019-08-06'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Erreur API Payplug refund: ${response.status}`);
  }

  return response.json();
}

/**
 * Envoie un email de confirmation de paiement
 */
async function sendPaymentConfirmationEmail(payment, metadata) {
  try {
    const baseUrl = process.env.URL || 'https://mistralpans.fr';
    const response = await fetch(`${baseUrl}/.netlify/functions/send-email`, {
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

/**
 * Met à jour Supabase avec les données de paiement
 */
async function updateSupabasePayment(payment, metadata) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;

  const supabaseHeaders = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };

  try {
    // Enregistrer le paiement dans la table paiements
    const paymentRecord = {
      payplug_id: payment.id,
      reference: metadata.order_reference,
      amount: payment.amount,
      currency: payment.currency,
      payment_type: metadata.payment_type,
      customer_email: payment.billing?.email,
      customer_name: `${payment.billing?.first_name || ''} ${payment.billing?.last_name || ''}`.trim(),
      status: 'paid',
      paid_at: payment.paid_at
        ? new Date(payment.paid_at * 1000).toISOString()
        : new Date().toISOString(),
      metadata: metadata,
      raw_response: payment
    };

    // Upsert sur payplug_id pour garantir l'idempotence (notifications dupliquées)
    const upsertHeaders = {
      ...supabaseHeaders,
      'Prefer': 'return=minimal,resolution=merge-duplicates'
    };

    const insertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/paiements?on_conflict=payplug_id`,
      {
        method: 'POST',
        headers: upsertHeaders,
        body: JSON.stringify(paymentRecord)
      }
    );

    if (!insertResponse.ok) {
      console.warn('Erreur enregistrement paiement Supabase:', await insertResponse.text());
    }

    // Mettre à jour la commande si order_id présent
    if (metadata.order_id) {
      const paymentType = metadata.payment_type;
      const updateData = paymentType === 'acompte'
        ? { statut: 'acompte_paye', acompte_paye: true, date_acompte: new Date().toISOString() }
        : { statut: 'paye', solde_paye: true, date_paiement: new Date().toISOString() };

      await fetch(`${SUPABASE_URL}/rest/v1/commandes?id=eq.${metadata.order_id}`, {
        method: 'PATCH',
        headers: supabaseHeaders,
        body: JSON.stringify(updateData)
      });
    }
  } catch (dbError) {
    console.error('Erreur mise à jour base de données:', dbError);
  }
}

/**
 * Met à jour Supabase pour un remboursement
 */
async function updateSupabaseRefund(refund, payment) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;

  try {
    // Mettre à jour le paiement dans la table paiements
    await fetch(
      `${SUPABASE_URL}/rest/v1/paiements?payplug_id=eq.${refund.payment_id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: payment.is_refunded ? 'refunded' : 'partially_refunded',
          amount_refunded: payment.amount_refunded,
          refunded_at: new Date().toISOString()
        })
      }
    );
  } catch (dbError) {
    console.error('Erreur mise à jour remboursement Supabase:', dbError);
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

  const headers = { 'Content-Type': 'application/json' };

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
    // La notification PayPlug contient: { id, object, is_live }
    const notification = JSON.parse(event.body);
    const { id, object: objectType, is_live } = notification;

    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ID manquant dans la notification' })
      };
    }

    console.log('Webhook reçu:', { id, objectType, is_live });

    // Traitement selon le type d'objet
    if (objectType === 'refund') {
      return await handleRefundNotification(id, notification, PAYPLUG_SECRET_KEY, headers);
    }

    // Par défaut: traitement comme un paiement
    return await handlePaymentNotification(id, PAYPLUG_SECRET_KEY, headers);

  } catch (error) {
    console.error('Erreur webhook:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur' })
    };
  }
};

/**
 * Traite une notification de paiement
 */
async function handlePaymentNotification(paymentId, secretKey, headers) {
  // Vérifier le paiement via l'API Payplug (sécurité: s'assurer que la notif vient bien de PayPlug)
  const payment = await getPaymentDetails(paymentId, secretKey);

  if (!payment) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Paiement non trouvé' })
    };
  }

  const metadata = payment.metadata || {};
  const orderReference = metadata.order_reference;

  console.log('Paiement vérifié:', {
    id: payment.id,
    reference: orderReference,
    amount: payment.amount / 100,
    is_paid: payment.is_paid,
    is_refunded: payment.is_refunded,
    type: metadata.payment_type
  });

  if (payment.is_paid) {
    console.log(`Paiement ${paymentId} confirmé pour ${payment.amount / 100} €`);

    await updateSupabasePayment(payment, metadata);
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
    console.log(`Paiement ${paymentId} entièrement remboursé`);

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
    console.log(`Paiement ${paymentId} échoué:`, payment.failure.code, payment.failure.message);

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
    // Paiement en attente (ex: Oney pending)
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
}

/**
 * Traite une notification de remboursement
 */
async function handleRefundNotification(refundId, notification, secretKey, headers) {
  // La notif de refund contient aussi payment_id
  const paymentId = notification.payment_id;

  if (!paymentId) {
    // Essayer de récupérer via l'ID du refund en listant les paiements
    console.warn('payment_id absent de la notification de remboursement');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Notification remboursement reçue (sans payment_id)' })
    };
  }

  // Récupérer les détails du remboursement et du paiement
  const [refund, payment] = await Promise.all([
    getRefundDetails(paymentId, refundId, secretKey),
    getPaymentDetails(paymentId, secretKey)
  ]);

  console.log('Remboursement vérifié:', {
    refund_id: refund.id,
    payment_id: paymentId,
    amount: refund.amount / 100,
    is_fully_refunded: payment.is_refunded
  });

  await updateSupabaseRefund(refund, payment);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Remboursement traité',
      refund_id: refund.id,
      payment_id: paymentId
    })
  };
}
