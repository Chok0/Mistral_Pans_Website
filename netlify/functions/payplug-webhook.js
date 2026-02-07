// Netlify Function : Webhook Payplug
// Reçoit les notifications de paiement/remboursement
// Orchestre: création commande, mise à jour stock, emails

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

// ============================================================================
// SUPABASE HELPERS
// ============================================================================

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  return {
    url,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }
  };
}

// ============================================================================
// CRÉATION COMMANDE
// ============================================================================

/**
 * Crée (ou met à jour) une commande dans Supabase à partir du paiement
 */
async function createOrUpdateOrder(payment, metadata) {
  const sb = getSupabaseConfig();
  if (!sb) return;

  const paymentType = metadata.payment_type || 'full';
  const isFullPayment = paymentType === 'full' || paymentType === 'installments';
  const isStock = metadata.source === 'stock';

  const orderRecord = {
    reference: metadata.order_reference,
    source: metadata.source || 'custom',
    instrument_id: metadata.instrument_id || null,

    // Client
    customer_email: payment.billing?.email || null,
    customer_name: `${payment.billing?.first_name || ''} ${payment.billing?.last_name || ''}`.trim(),
    customer_phone: payment.billing?.mobile_phone_number || null,
    customer_address: payment.billing?.address1
      ? `${payment.billing.address1}, ${payment.billing.postcode || ''} ${payment.billing.city || ''}`.trim()
      : null,

    // Produit
    product_name: metadata.product_name || metadata.gamme || 'Handpan sur mesure',
    specifications: {
      gamme: metadata.gamme || null,
      taille: metadata.taille || null,
      housse_id: metadata.housse_id || null,
      housse_nom: metadata.housse_nom || null,
      housse_prix: metadata.housse_prix || null,
      livraison: metadata.livraison || false
    },

    // Montants (en EUR)
    montant_total: (metadata.total_price_cents || payment.amount) / 100,
    montant_paye: payment.amount / 100,

    // Paiement
    payment_type: paymentType,
    payplug_payment_id: payment.id,

    // Statuts
    statut: isStock && isFullPayment ? 'pret' : 'en_attente',
    statut_paiement: isFullPayment ? 'paye' : 'partiel',

    // Dates
    created_at: new Date().toISOString(),
    paid_at: payment.paid_at
      ? new Date(payment.paid_at * 1000).toISOString()
      : new Date().toISOString()
  };

  try {
    // Upsert sur reference pour idempotence
    const upsertHeaders = {
      ...sb.headers,
      'Prefer': 'return=minimal,resolution=merge-duplicates'
    };

    const response = await fetch(
      `${sb.url}/rest/v1/commandes?on_conflict=reference`,
      {
        method: 'POST',
        headers: upsertHeaders,
        body: JSON.stringify(orderRecord)
      }
    );

    if (!response.ok) {
      console.warn('Erreur création commande Supabase:', await response.text());
    } else {
      console.log('Commande créée/mise à jour:', metadata.order_reference);
    }
  } catch (error) {
    console.error('Erreur création commande:', error);
  }
}

// ============================================================================
// ENREGISTREMENT PAIEMENT
// ============================================================================

/**
 * Enregistre le paiement dans la table paiements
 */
async function recordPayment(payment, metadata) {
  const sb = getSupabaseConfig();
  if (!sb) return;

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

  try {
    const upsertHeaders = {
      ...sb.headers,
      'Prefer': 'return=minimal,resolution=merge-duplicates'
    };

    const response = await fetch(
      `${sb.url}/rest/v1/paiements?on_conflict=payplug_id`,
      {
        method: 'POST',
        headers: upsertHeaders,
        body: JSON.stringify(paymentRecord)
      }
    );

    if (!response.ok) {
      console.warn('Erreur enregistrement paiement Supabase:', await response.text());
    }
  } catch (error) {
    console.error('Erreur enregistrement paiement:', error);
  }
}

// ============================================================================
// MISE À JOUR STOCK
// ============================================================================

/**
 * Si instrument en stock → marquer comme vendu/réservé
 */
async function updateInstrumentStock(metadata, paymentType) {
  const sb = getSupabaseConfig();
  if (!sb) return;

  const instrumentId = metadata.instrument_id;
  if (!instrumentId || metadata.source !== 'stock') return;

  const isFullPayment = paymentType === 'full' || paymentType === 'installments';
  const newStatus = isFullPayment ? 'vendu' : 'en_fabrication'; // 'en_fabrication' = réservé

  try {
    const response = await fetch(
      `${sb.url}/rest/v1/instruments?id=eq.${instrumentId}`,
      {
        method: 'PATCH',
        headers: sb.headers,
        body: JSON.stringify({
          statut: newStatus,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      console.warn('Erreur mise à jour instrument:', await response.text());
    } else {
      console.log(`Instrument ${instrumentId} → ${newStatus}`);
    }
  } catch (error) {
    console.error('Erreur mise à jour stock:', error);
  }
}

// ============================================================================
// EMAILS
// ============================================================================

/**
 * Envoie un email de confirmation de paiement au client
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
    console.error('Erreur envoi email confirmation:', error);
  }
}

/**
 * Notifie l'artisan d'une nouvelle commande
 */
async function sendArtisanNotification(payment, metadata) {
  try {
    const baseUrl = process.env.URL || 'https://mistralpans.fr';
    const response = await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailType: 'new_order_notification',
        order: {
          reference: metadata.order_reference,
          source: metadata.source || 'custom',
          productName: metadata.product_name || metadata.gamme || 'Handpan',
          gamme: metadata.gamme,
          taille: metadata.taille,
          instrumentId: metadata.instrument_id
        },
        client: {
          email: payment.billing?.email,
          prenom: payment.billing?.first_name,
          nom: payment.billing?.last_name,
          telephone: payment.billing?.mobile_phone_number
        },
        payment: {
          amount: payment.amount / 100,
          totalAmount: (metadata.total_price_cents || payment.amount) / 100,
          type: metadata.payment_type,
          isFullPayment: metadata.payment_type === 'full' || metadata.payment_type === 'installments'
        }
      })
    });

    if (!response.ok) {
      console.warn('Erreur envoi notification artisan:', await response.text());
    }
  } catch (error) {
    console.error('Erreur envoi notification artisan:', error);
  }
}

// ============================================================================
// REMBOURSEMENT
// ============================================================================

async function updateSupabaseRefund(refund, payment) {
  const sb = getSupabaseConfig();
  if (!sb) return;

  try {
    await fetch(
      `${sb.url}/rest/v1/paiements?payplug_id=eq.${refund.payment_id}`,
      {
        method: 'PATCH',
        headers: sb.headers,
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

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

exports.handler = async (event, context) => {
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

    if (objectType === 'refund') {
      return await handleRefundNotification(id, notification, PAYPLUG_SECRET_KEY, headers);
    }

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

// ============================================================================
// VALIDATION PRIX
// ============================================================================

/**
 * Pour les instruments en stock, vérifie que le montant payé correspond
 * au prix enregistré en base de données. Empêche la manipulation de prix
 * côté client (paramètres URL).
 * @returns {{ valid: boolean, reason?: string }}
 */
async function validatePaymentAmount(payment, metadata) {
  const sb = getSupabaseConfig();

  // Pas de Supabase = pas de validation possible, on laisse passer
  if (!sb) return { valid: true };

  const source = metadata.source;
  const instrumentId = metadata.instrument_id;
  const paymentType = metadata.payment_type;

  // Seuls les achats stock avec un ID instrument peuvent être vérifiés
  if (source !== 'stock' || !instrumentId) return { valid: true };

  try {
    const response = await fetch(
      `${sb.url}/rest/v1/instruments?id=eq.${instrumentId}&select=prix_vente`,
      {
        method: 'GET',
        headers: {
          'apikey': sb.headers['apikey'],
          'Authorization': sb.headers['Authorization'],
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.warn('Impossible de vérifier le prix instrument:', await response.text());
      return { valid: true }; // Fail open si DB indisponible
    }

    const instruments = await response.json();
    if (!instruments || instruments.length === 0) {
      console.warn(`Instrument ${instrumentId} non trouvé en base`);
      return { valid: true };
    }

    const dbPrice = instruments[0].prix_vente; // En euros
    if (!dbPrice) return { valid: true };

    const expectedCents = dbPrice * 100;
    const totalFromMetadata = metadata.total_price_cents || payment.amount;

    // Tolérance : le total peut inclure des accessoires (housse, livraison)
    // On vérifie juste que le montant n'est pas inférieur au prix instrument
    if (totalFromMetadata < expectedCents) {
      const diff = (expectedCents - totalFromMetadata) / 100;
      console.error(
        `ALERTE PRIX: Instrument ${instrumentId} prix DB=${dbPrice}€, ` +
        `metadata total=${totalFromMetadata / 100}€ (écart: -${diff}€)`
      );
      return {
        valid: false,
        reason: `Montant inférieur au prix catalogue (${dbPrice}€ vs ${totalFromMetadata / 100}€)`
      };
    }

    // Pour paiement intégral, vérifier que le montant payé couvre le total
    if (paymentType === 'full' && payment.amount < expectedCents) {
      console.error(
        `ALERTE PRIX: Paiement intégral ${payment.amount / 100}€ < prix instrument ${dbPrice}€`
      );
      return {
        valid: false,
        reason: `Paiement intégral insuffisant (${payment.amount / 100}€ vs ${dbPrice}€ minimum)`
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Erreur validation prix:', error);
    return { valid: true }; // Fail open
  }
}

// ============================================================================
// TRAITEMENT PAIEMENT
// ============================================================================

async function handlePaymentNotification(paymentId, secretKey, headers) {
  // Vérifier le paiement via l'API Payplug (sécurité)
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
    type: metadata.payment_type,
    source: metadata.source
  });

  if (payment.is_paid) {
    console.log(`Paiement ${paymentId} confirmé pour ${payment.amount / 100} €`);

    // Valider le montant contre la base de données (protection anti-manipulation)
    const priceCheck = await validatePaymentAmount(payment, metadata);
    if (!priceCheck.valid) {
      console.error(`PAIEMENT BLOQUÉ: ${priceCheck.reason} (ref: ${orderReference})`);
      // On enregistre quand même le paiement mais on le flag comme suspect
      await recordPayment(payment, { ...metadata, flagged: true, flag_reason: priceCheck.reason });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Paiement enregistré - vérification manuelle requise',
          reference: orderReference,
          flagged: true
        })
      };
    }

    // Orchestrer toutes les actions post-paiement en parallèle
    await Promise.all([
      // 1. Enregistrer le paiement
      recordPayment(payment, metadata),

      // 2. Créer/mettre à jour la commande
      createOrUpdateOrder(payment, metadata),

      // 3. Mettre à jour le stock (instrument en stock → vendu/réservé)
      updateInstrumentStock(metadata, metadata.payment_type),

      // 4. Email confirmation client
      sendPaymentConfirmationEmail(payment, metadata),

      // 5. Notification artisan
      sendArtisanNotification(payment, metadata)
    ]);

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

// ============================================================================
// TRAITEMENT REMBOURSEMENT
// ============================================================================

async function handleRefundNotification(refundId, notification, secretKey, headers) {
  const paymentId = notification.payment_id;

  if (!paymentId) {
    console.warn('payment_id absent de la notification de remboursement');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Notification remboursement reçue (sans payment_id)' })
    };
  }

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
