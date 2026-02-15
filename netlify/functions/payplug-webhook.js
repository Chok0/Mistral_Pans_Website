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
  const isCart = metadata.cart_mode === true || metadata.cart_mode === 'true';
  const isStock = metadata.source === 'stock';

  // Construire les specifications selon le mode
  let specifications;
  if (isCart && metadata.items) {
    // Mode panier : stocker les items dans specifications
    let items;
    try {
      items = typeof metadata.items === 'string' ? JSON.parse(metadata.items) : metadata.items;
    } catch (e) {
      items = [];
    }
    specifications = {
      cart_mode: true,
      items: items
    };
  } else {
    // Mode legacy single item
    specifications = {
      gamme: metadata.gamme || null,
      taille: metadata.taille || null,
      housse_id: metadata.housse_id || null,
      housse_nom: metadata.housse_nom || null,
      housse_prix: metadata.housse_prix || null,
      livraison: metadata.livraison || false
    };
  }

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
    specifications: specifications,

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

  const isFullPayment = paymentType === 'full' || paymentType === 'installments';
  const newStatus = isFullPayment ? 'vendu' : 'en_fabrication'; // 'en_fabrication' = réservé
  const isCart = metadata.cart_mode === true || metadata.cart_mode === 'true';

  // Collecter les IDs d'instruments à mettre à jour
  const instrumentIds = [];

  if (isCart && metadata.items) {
    let items;
    try {
      items = typeof metadata.items === 'string' ? JSON.parse(metadata.items) : metadata.items;
    } catch (e) {
      items = [];
    }
    items.forEach(item => {
      if (item.type === 'instrument' && item.sourceId) {
        instrumentIds.push(item.sourceId);
      }
    });
  } else if (metadata.instrument_id && metadata.source === 'stock') {
    instrumentIds.push(metadata.instrument_id);
  }

  if (instrumentIds.length === 0) return;

  // Mettre à jour chaque instrument
  for (const instrumentId of instrumentIds) {
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
        console.warn('Erreur mise à jour instrument:', instrumentId, await response.text());
      } else {
        console.log(`Instrument ${instrumentId} → ${newStatus}`);
      }
    } catch (error) {
      console.error('Erreur mise à jour stock:', instrumentId, error);
    }
  }
}

// ============================================================================
// AUTO-GÉNÉRATION FACTURE
// ============================================================================

/**
 * Cherche un client par email, ou en crée un nouveau
 * @returns {string|null} client_id (UUID)
 */
async function findOrCreateClient(payment, sb) {
  const email = payment.billing?.email;
  if (!email) return null;

  try {
    // Chercher par email
    const searchResp = await fetch(
      `${sb.url}/rest/v1/clients?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      { method: 'GET', headers: { ...sb.headers, 'Prefer': 'return=representation' } }
    );

    if (searchResp.ok) {
      const rows = await searchResp.json();
      if (rows.length > 0) return rows[0].id;
    }

    // Créer un nouveau client
    const now = new Date().toISOString();
    const createResp = await fetch(
      `${sb.url}/rest/v1/clients`,
      {
        method: 'POST',
        headers: { ...sb.headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          nom: (payment.billing?.last_name || '').trim(),
          prenom: (payment.billing?.first_name || '').trim(),
          email,
          telephone: payment.billing?.mobile_phone_number || '',
          adresse: payment.billing?.address1
            ? `${payment.billing.address1}, ${payment.billing.postcode || ''} ${payment.billing.city || ''}`.trim()
            : '',
          notes: 'Créé automatiquement via paiement en ligne',
          created_at: now,
          updated_at: now
        })
      }
    );

    if (createResp.ok) {
      const created = await createResp.json();
      return created[0]?.id || null;
    }
  } catch (error) {
    console.error('Erreur findOrCreateClient:', error);
  }

  return null;
}

/**
 * Génère le prochain numéro de facture
 * Lit et incrémente le compteur dans la table configuration (namespace=gestion)
 * Format: AAAA-MM-NNN
 */
async function generateNextInvoiceNumber(sb) {
  try {
    // Lire le compteur actuel
    const readResp = await fetch(
      `${sb.url}/rest/v1/configuration?namespace=eq.gestion&key=eq.dernier_numero_facture&select=value`,
      { method: 'GET', headers: { ...sb.headers, 'Prefer': 'return=representation' } }
    );

    let currentNumber = 0;
    if (readResp.ok) {
      const rows = await readResp.json();
      if (rows.length > 0) {
        // value est stocké en JSON stringifié (ex: "42" ou "\"42\"")
        let raw = rows[0].value;
        if (typeof raw === 'string') {
          try { raw = JSON.parse(raw); } catch { /* garder tel quel */ }
        }
        currentNumber = parseInt(raw) || 0;
      }
    }

    const newNumber = currentNumber + 1;

    // Mettre à jour le compteur
    await fetch(
      `${sb.url}/rest/v1/configuration?namespace=eq.gestion&key=eq.dernier_numero_facture`,
      {
        method: 'PATCH',
        headers: sb.headers,
        body: JSON.stringify({
          value: JSON.stringify(newNumber.toString()),
          updated_at: new Date().toISOString()
        })
      }
    );

    const now = new Date();
    const annee = now.getFullYear();
    const mois = String(now.getMonth() + 1).padStart(2, '0');
    return `${annee}-${mois}-${newNumber}`;
  } catch (error) {
    console.error('Erreur génération numéro facture:', error);
    return null;
  }
}

/**
 * Construit les lignes de facture à partir du paiement et metadata
 * Gère: mode panier, mode single, acompte, solde
 */
function buildInvoiceLines(payment, metadata) {
  const paymentType = metadata.payment_type || 'full';
  const productName = metadata.product_name || metadata.gamme || 'Handpan sur mesure';

  // Acompte → une seule ligne avec le montant du dépôt
  if (paymentType === 'acompte') {
    return [{
      description: `Acompte — ${productName}`,
      quantite: 1,
      prix_unitaire: payment.amount / 100,
      total: payment.amount / 100
    }];
  }

  // Mode panier
  const isCart = metadata.cart_mode === true || metadata.cart_mode === 'true';
  if (isCart && metadata.items) {
    let items;
    try {
      items = typeof metadata.items === 'string' ? JSON.parse(metadata.items) : metadata.items;
    } catch (e) {
      items = [];
    }

    if (items.length > 0) {
      return items.map(item => ({
        description: item.nom || 'Article',
        quantite: item.quantite || 1,
        prix_unitaire: item.prix || item.total || 0,
        total: item.total || (item.prix || 0) * (item.quantite || 1)
      }));
    }
  }

  // Mode single (legacy)
  return [{
    description: productName,
    quantite: 1,
    prix_unitaire: payment.amount / 100,
    total: payment.amount / 100
  }];
}

/**
 * Génère automatiquement une facture pour un paiement confirmé.
 * Idempotent: vérifie qu'aucune facture n'existe déjà pour cette commande.
 * Appelé APRÈS createOrUpdateOrder (la commande doit exister).
 */
async function generateInvoice(payment, metadata) {
  const sb = getSupabaseConfig();
  if (!sb) return;

  const paymentType = metadata.payment_type || 'full';
  const orderReference = metadata.order_reference;

  // Mapper type de paiement → type de facture
  const typeMap = { full: 'vente', installments: 'vente', acompte: 'acompte', solde: 'solde' };
  const factureType = typeMap[paymentType] || 'vente';

  try {
    // 1. Trouver la commande par référence
    const findResp = await fetch(
      `${sb.url}/rest/v1/commandes?reference=eq.${encodeURIComponent(orderReference)}&select=id`,
      { method: 'GET', headers: { ...sb.headers, 'Prefer': 'return=representation' } }
    );

    let commandeId = null;
    if (findResp.ok) {
      const commandes = await findResp.json();
      if (commandes.length > 0) commandeId = commandes[0].id;
    }

    // 2. Vérifier qu'aucune facture n'existe déjà pour cette commande (idempotence)
    if (commandeId) {
      const checkResp = await fetch(
        `${sb.url}/rest/v1/factures?commande_id=eq.${commandeId}&type=eq.${factureType}&select=id`,
        { method: 'GET', headers: { ...sb.headers, 'Prefer': 'return=representation' } }
      );
      if (checkResp.ok) {
        const existing = await checkResp.json();
        if (existing.length > 0) {
          console.log(`Facture ${factureType} déjà existante pour commande ${orderReference}`);
          return;
        }
      }
    }

    // 3. Trouver ou créer le client
    const clientId = await findOrCreateClient(payment, sb);
    if (!clientId) {
      console.warn('Impossible de trouver/créer le client — facture non générée');
      return;
    }

    // 4. Générer le numéro de facture
    const numero = await generateNextInvoiceNumber(sb);
    if (!numero) {
      console.warn('Impossible de générer le numéro de facture');
      return;
    }

    // 5. Construire les lignes
    const lignes = buildInvoiceLines(payment, metadata);
    const sousTotal = lignes.reduce((sum, l) => sum + (l.total || 0), 0);

    // Pour une facture de solde, déduire les acomptes déjà payés
    let acomptesDeduits = 0;
    if (paymentType === 'solde') {
      const totalCommande = (metadata.total_price_cents || 0) / 100;
      if (totalCommande > 0) {
        acomptesDeduits = totalCommande - (payment.amount / 100);
      }
    }

    const total = sousTotal - acomptesDeduits;

    // 6. Créer la facture
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const paidDate = payment.paid_at
      ? new Date(payment.paid_at * 1000).toISOString().split('T')[0]
      : today;

    const facture = {
      numero,
      date: paidDate,
      date_emission: paidDate,
      client_id: clientId,
      type: factureType,
      commande_id: commandeId,
      lignes,
      sous_total: sousTotal,
      montant_ht: sousTotal,
      acomptes_deduits: acomptesDeduits,
      total,
      montant_ttc: total,
      factures_acompte_ids: [],
      statut_paiement: 'paye',
      date_paiement: paidDate,
      mode_paiement: 'payplug',
      notes: `Auto-générée — Ref: ${orderReference}`,
      created_at: now,
      updated_at: now
    };

    const createResp = await fetch(
      `${sb.url}/rest/v1/factures`,
      {
        method: 'POST',
        headers: sb.headers,
        body: JSON.stringify(facture)
      }
    );

    if (createResp.ok) {
      console.log(`Facture ${numero} (${factureType}) auto-générée pour ${orderReference}`);
    } else {
      console.warn('Erreur création facture:', await createResp.text());
    }
  } catch (error) {
    console.error('Erreur auto-génération facture:', error);
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
    const isCart = metadata.cart_mode === true || metadata.cart_mode === 'true';

    // Construire le nom du produit (avec détails panier si applicable)
    let productName = metadata.product_name || metadata.gamme || 'Handpan';
    if (isCart && metadata.items) {
      let items;
      try {
        items = typeof metadata.items === 'string' ? JSON.parse(metadata.items) : metadata.items;
      } catch (e) { items = []; }
      if (items.length > 0) {
        productName = items.map(i => i.nom + (i.quantite > 1 ? ' x' + i.quantite : '')).join(', ');
      }
    }

    const response = await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailType: 'new_order_notification',
        order: {
          reference: metadata.order_reference,
          source: metadata.source || 'custom',
          productName: productName,
          gamme: metadata.gamme,
          taille: metadata.taille,
          instrumentId: metadata.instrument_id,
          cartMode: isCart || false
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
 * Récupère le prix d'un instrument depuis Supabase.
 * @returns {{ price: number|null, error?: string }}
 */
async function fetchInstrumentPrice(instrumentId, sb) {
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
      return { price: null, error: `DB indisponible (HTTP ${response.status})` };
    }

    const instruments = await response.json();
    if (!instruments || instruments.length === 0) {
      return { price: null, error: 'Instrument non trouvé en base' };
    }

    const dbPrice = instruments[0].prix_vente;
    if (!dbPrice && dbPrice !== 0) {
      return { price: null, error: 'Instrument sans prix en base' };
    }

    return { price: dbPrice };
  } catch (error) {
    return { price: null, error: `Erreur DB: ${error.message}` };
  }
}

/**
 * Pour les instruments en stock, vérifie que le montant payé correspond
 * au prix enregistré en base de données. Empêche la manipulation de prix
 * côté client.
 *
 * Stratégie fail-closed : si la validation est impossible (DB down, config
 * manquante, données corrompues), le paiement est rejeté et flaggé pour
 * vérification manuelle plutôt qu'accepté aveuglément.
 *
 * @returns {{ valid: boolean, reason?: string }}
 */
async function validatePaymentAmount(payment, metadata) {
  const sb = getSupabaseConfig();

  // Fail-closed: pas de config Supabase = validation impossible
  if (!sb) {
    console.error('VALIDATION PRIX: Config Supabase manquante');
    return { valid: false, reason: 'Configuration Supabase manquante — validation impossible' };
  }

  const source = metadata.source;
  const instrumentId = metadata.instrument_id;
  const paymentType = metadata.payment_type;
  const isCart = metadata.cart_mode === true || metadata.cart_mode === 'true';

  // ── Mode panier : validation individuelle de chaque instrument ──
  if (isCart && metadata.items) {
    let items;
    try {
      items = typeof metadata.items === 'string' ? JSON.parse(metadata.items) : metadata.items;
    } catch (e) {
      return { valid: false, reason: 'Données panier invalides (erreur JSON)' };
    }

    let cartTotalCents = 0;

    for (const item of items) {
      const itemTotalCents = Math.round((item.total || item.prix || 0) * 100);

      if (item.type === 'instrument' && item.sourceId) {
        // Vérifier le prix de chaque instrument contre la DB
        const { price: dbPrice, error } = await fetchInstrumentPrice(item.sourceId, sb);
        if (error) {
          console.warn(`Validation instrument ${item.sourceId}: ${error}`);
          return { valid: false, reason: `${error} (instrument ${item.sourceId})` };
        }

        const dbPriceCents = dbPrice * 100;
        if (itemTotalCents < dbPriceCents) {
          console.error(
            `ALERTE PRIX PANIER: Instrument ${item.sourceId} prix DB=${dbPrice}€, ` +
            `item total=${itemTotalCents / 100}€`
          );
          return {
            valid: false,
            reason: `Prix inférieur au catalogue pour instrument ${item.sourceId} (${dbPrice}€ vs ${itemTotalCents / 100}€)`
          };
        }
      }

      // Cumuler le total (instruments, accessoires, custom)
      cartTotalCents += itemTotalCents;
    }

    // Pour paiement intégral, vérifier que le montant payé couvre le total du panier
    if (paymentType === 'full' && payment.amount < cartTotalCents) {
      console.error(
        `ALERTE PRIX PANIER: Paiement ${payment.amount / 100}€ < total panier ${cartTotalCents / 100}€`
      );
      return {
        valid: false,
        reason: `Paiement panier insuffisant (${payment.amount / 100}€ vs ${cartTotalCents / 100}€)`
      };
    }

    return { valid: true };
  }

  // ── Mode single : seuls les achats stock avec un ID instrument ──
  if (source !== 'stock' || !instrumentId) return { valid: true };

  const { price: dbPrice, error } = await fetchInstrumentPrice(instrumentId, sb);
  if (error) {
    console.warn(`Validation instrument ${instrumentId}: ${error}`);
    return { valid: false, reason: `${error} (instrument ${instrumentId})` };
  }

  const expectedCents = dbPrice * 100;
  const totalFromMetadata = metadata.total_price_cents || payment.amount;

  // Le total (incluant accessoires) ne doit pas être inférieur au prix instrument
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

  // Pour paiement intégral, vérifier que le montant payé couvre le prix instrument
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

    // Vérifier si ce paiement a déjà été traité (protection contre les webhooks en double)
    const sb = getSupabaseConfig();
    let alreadyProcessed = false;
    if (sb) {
      try {
        const checkResp = await fetch(
          `${sb.url}/rest/v1/paiements?payplug_id=eq.${paymentId}&select=payplug_id`,
          { method: 'GET', headers: sb.headers }
        );
        if (checkResp.ok) {
          const existing = await checkResp.json();
          alreadyProcessed = existing.length > 0;
        }
      } catch (e) {
        // En cas d'erreur de vérification, on continue (fail-open pour les emails)
      }
    }

    if (alreadyProcessed) {
      console.log(`Paiement ${paymentId} déjà traité, upsert uniquement (pas de re-notification)`);
      // Upsert le paiement et la commande (idempotent), mais pas d'emails
      await Promise.all([
        recordPayment(payment, metadata),
        createOrUpdateOrder(payment, metadata)
      ]);
      // Tenter la génération de facture (idempotent — skip si elle existe déjà)
      await generateInvoice(payment, metadata);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Paiement déjà traité (doublon ignoré)',
          reference: orderReference
        })
      };
    }

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

    // 6. Auto-générer la facture (séquentiel — nécessite la commande créée ci-dessus)
    await generateInvoice(payment, metadata);

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
