/* ==========================================================================
   MISTRAL PANS - Page Commander
   Gestion des formulaires de commande et intégration Payplug
   Supporte : paiement intégral, acompte 30%, Oney 3x/4x
   Deux parcours : instrument sur mesure (custom) et instrument en stock
   ========================================================================== */

(function(window) {
  'use strict';

  // Taux d'acompte
  const DEPOSIT_RATE = 0.30;

  // Plage Oney (en euros)
  const ONEY_MIN = 100;
  const ONEY_MAX = 3000;

  // État de la page
  let orderData = {
    productName: 'D Kurd 9 notes',
    price: 1400,           // Prix total avec options
    instrumentPrice: 1400, // Prix instrument seul
    notes: '',
    gamme: '',
    taille: '53 cm',
    tonalite: '',
    materiau: '',
    accordage: '',
    source: 'custom',      // 'stock' ou 'custom'
    instrumentId: null,    // ID Supabase (stock uniquement)
    housse: null,          // { id, nom, prix } ou null
    livraison: false
  };

  // État du paiement intégré
  let integratedFormReady = false;
  let pendingPaymentId = null;

  // État Oney
  let selectedInstallments = 3;

  // ============================================================================
  // CALCULS
  // ============================================================================

  function getDepositAmount() {
    return Math.round(orderData.price * DEPOSIT_RATE);
  }

  function getDepositAmountCents() {
    return getDepositAmount() * 100;
  }

  function isOneyEligible() {
    return orderData.price >= ONEY_MIN && orderData.price <= ONEY_MAX;
  }

  function computeInstallments(total, n) {
    const base = Math.floor(total / n);
    const remainder = total - base * n;
    const installments = [base + remainder];
    for (let i = 1; i < n; i++) {
      installments.push(base);
    }
    return installments;
  }

  function isStock() {
    return orderData.source === 'stock';
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  document.addEventListener('DOMContentLoaded', function() {
    parseUrlParams();
    initForms();
    initOneySelector();
    initIntegratedPaymentForm();
    adaptUIForSource();
    checkPaymentReturn();
  });

  /**
   * Parse les paramètres URL (configurateur + stock modal)
   */
  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);

    // Source : stock ou custom
    orderData.source = params.get('type') === 'stock' ? 'stock' : 'custom';
    orderData.instrumentId = params.get('instrument_id') || null;

    // Nom produit (configurateur envoie 'name', anciennes URLs 'product')
    orderData.productName = params.get('name') || params.get('product') || orderData.productName;

    // Prix validé (1-20000€)
    const rawPrice = parseInt(params.get('price'));
    if (rawPrice && rawPrice >= 1 && rawPrice <= 20000) {
      orderData.price = rawPrice;
    }
    const rawInstrumentPrice = parseInt(params.get('instrument_price'));
    if (rawInstrumentPrice && rawInstrumentPrice >= 1 && rawInstrumentPrice <= 20000) {
      orderData.instrumentPrice = rawInstrumentPrice;
    } else {
      orderData.instrumentPrice = orderData.price;
    }

    // Config détaillée
    orderData.notes = params.get('notes') || '';
    orderData.gamme = params.get('gamme') || params.get('scale') || '';
    orderData.taille = params.get('taille') || params.get('size') || orderData.taille;
    orderData.tonalite = params.get('tonalite') || params.get('tonality') || '';
    orderData.materiau = params.get('materiau') || params.get('material') || '';
    orderData.accordage = params.get('accordage') || params.get('tuning') || '';

    // Housse
    if (params.get('housse_id')) {
      orderData.housse = {
        id: params.get('housse_id'),
        nom: params.get('housse_nom') || 'Housse',
        prix: parseInt(params.get('housse_prix')) || 0
      };
    }

    // Livraison
    orderData.livraison = params.get('livraison') === '1';

    updateOrderDisplay();
  }

  /**
   * Adapte l'UI selon stock vs sur-mesure
   */
  function adaptUIForSource() {
    const stock = isStock();
    const grid = document.getElementById('order-options-grid');

    // Afficher/masquer l'option paiement intégral (stock uniquement)
    const fullOption = document.querySelector('[data-option="full"]');
    if (fullOption) {
      fullOption.style.display = stock ? '' : 'none';
    }

    // Afficher/masquer l'option acompte (sur-mesure uniquement)
    const depositOption = document.querySelector('[data-option="deposit"]');
    if (depositOption) {
      depositOption.style.display = stock ? 'none' : '';
    }

    // Afficher/masquer l'option Oney (stock uniquement)
    const oneyOption = document.querySelector('[data-option="oney"]');
    if (oneyOption) {
      oneyOption.style.display = stock ? '' : 'none';
    }

    // Adapter les badges
    const badgeFull = document.getElementById('badge-full');
    const badgeDeposit = document.getElementById('badge-deposit');
    if (stock) {
      if (badgeFull) badgeFull.textContent = 'Recommandé';
      if (badgeDeposit) badgeDeposit.textContent = '';
    } else {
      if (badgeDeposit) badgeDeposit.textContent = 'Populaire';
    }

    // Adapter la grille selon le nombre d'options visibles
    if (grid) {
      if (stock) {
        // Stock: full + oney + rdv = 3 options
        grid.classList.remove('order-options--four');
        grid.classList.add('order-options--three');
      } else {
        // Sur-mesure: deposit + rdv = 2 options
        grid.classList.remove('order-options--four', 'order-options--three');
        grid.classList.add('order-options--two');
      }
    }

    // Adapter le texte de l'acompte pour stock
    const depositDesc = document.querySelector('[data-option="deposit"] .order-option__description');
    if (depositDesc && stock) {
      depositDesc.textContent = 'Versez 30 % maintenant, le solde avant expédition.';
    }

    // Adapter la description livraison
    const fullDetails = document.querySelector('[data-option="full"] .order-option__details');
    if (fullDetails && !stock) {
      // Pour custom, changer le texte livraison
      const liExpedition = fullDetails.querySelector('li:nth-child(2)');
      if (liExpedition) liExpedition.textContent = 'Délai : 8-12 semaines';
    }

    // Étape header
    const eyebrow = document.querySelector('.order-header .eyebrow');
    if (eyebrow) {
      eyebrow.textContent = stock ? 'Paiement' : 'Étape 1 sur 2';
    }

    // Auto-sélectionner la bonne option
    selectOption(stock ? 'full' : 'deposit');
  }

  // ============================================================================
  // AFFICHAGE
  // ============================================================================

  function updateOrderDisplay() {
    const deposit = getDepositAmount();
    const remaining = orderData.price - deposit;

    // --- Champs cachés ---
    setVal('form-product', orderData.productName);
    setVal('form-product-full', orderData.productName);
    setVal('form-product-rdv', orderData.productName);
    setVal('form-product-oney', orderData.productName);
    setVal('form-deposit-amount', deposit);
    setVal('form-full-amount', orderData.price);

    // --- Produit en haut ---
    setText('product-name', orderData.productName);
    if (orderData.notes) setText('product-notes', orderData.notes);
    setText('product-price', formatPrice(orderData.price));

    // --- Accessoires ---
    displayAccessories();

    // --- Option cards ---
    setText('option-deposit-amount', '30 % (' + formatPrice(deposit) + ')');
    setText('option-full-amount', formatPrice(orderData.price));

    // --- Résumé deposit ---
    setText('summary-product', orderData.productName);
    setText('summary-total', formatPrice(orderData.price));
    setText('summary-deposit', formatPrice(deposit));
    setText('summary-remaining', formatPrice(remaining));
    setText('deposit-btn-amount', formatPrice(deposit));

    // --- Résumé full ---
    setText('summary-full-product', orderData.productName);
    setText('summary-full-total', formatPrice(orderData.price));
    if (orderData.housse) {
      const housseRow = document.getElementById('summary-full-housse-row');
      if (housseRow) housseRow.style.display = '';
      setText('summary-full-housse', orderData.housse.nom + ' (' + formatPrice(orderData.housse.prix) + ')');
    }
    setText('full-btn-amount', formatPrice(orderData.price));

    // --- Oney ---
    updateOneyDisplay();
  }

  /**
   * Affiche les accessoires sélectionnés
   */
  function displayAccessories() {
    const container = document.getElementById('order-accessories');
    const list = document.getElementById('accessories-list');
    if (!container || !list) return;

    const items = [];

    if (orderData.housse) {
      items.push({ label: orderData.housse.nom, price: orderData.housse.prix });
    }
    if (orderData.livraison) {
      // Le prix de livraison est déjà inclus dans price
      items.push({ label: 'Livraison', price: null });
    }

    if (items.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = '';
    list.innerHTML = '';

    // Instrument line
    var instrItem = document.createElement('div');
    instrItem.className = 'order-accessories__item';
    instrItem.innerHTML = '<span>Instrument</span><span>' + escapeHtml(formatPrice(orderData.instrumentPrice)) + '</span>';
    list.appendChild(instrItem);

    items.forEach(function(item) {
      var el = document.createElement('div');
      el.className = 'order-accessories__item';
      el.innerHTML = '<span>' + escapeHtml(item.label) + '</span>'
        + (item.price != null ? '<span>+ ' + escapeHtml(formatPrice(item.price)) + '</span>' : '<span>incluse</span>');
      list.appendChild(el);
    });

    // Total line
    var totalItem = document.createElement('div');
    totalItem.className = 'order-accessories__item';
    totalItem.style.fontWeight = '600';
    totalItem.style.borderTop = '1px solid var(--color-border)';
    totalItem.style.paddingTop = 'var(--space-sm)';
    totalItem.style.marginTop = 'var(--space-xs)';
    totalItem.innerHTML = '<span>Total</span><span>' + escapeHtml(formatPrice(orderData.price)) + '</span>';
    list.appendChild(totalItem);
  }

  function updateOneyDisplay() {
    var eligible = isOneyEligible();

    var eligibleEl = document.getElementById('oney-eligible');
    var ineligibleEl = document.getElementById('oney-ineligible');
    if (eligibleEl) eligibleEl.style.display = eligible ? '' : 'none';
    if (ineligibleEl) ineligibleEl.style.display = eligible ? 'none' : '';

    if (!eligible) return;

    var total = orderData.price;

    setText('oney-product', orderData.productName);
    setText('oney-total', formatPrice(total));

    var inst3 = computeInstallments(total, 3);
    setText('oney-3x-detail', '3 × ' + formatPrice(inst3[1]));

    var inst4 = computeInstallments(total, 4);
    setText('oney-4x-detail', '4 × ' + formatPrice(inst4[1]));

    updateOneySchedule(selectedInstallments);
  }

  function updateOneySchedule(n) {
    var installments = computeInstallments(orderData.price, n);

    for (var i = 0; i < 4; i++) {
      var row = document.getElementById('oney-schedule-' + (i + 1));
      var amount = document.getElementById('oney-amount-' + (i + 1));
      if (row) row.style.display = (i < n) ? '' : 'none';
      if (amount && i < n) amount.textContent = formatPrice(installments[i]);
    }

    setText('oney-btn-installments', n);
    setText('oney-btn-total', formatPrice(orderData.price));

    setVal('form-installments', n);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  function formatPrice(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Construit l'objet metadata pour PayPlug
   */
  function buildOrderMetadata() {
    return {
      source: orderData.source,
      instrumentId: orderData.instrumentId,
      gamme: orderData.gamme,
      taille: orderData.taille,
      tonalite: orderData.tonalite,
      materiau: orderData.materiau,
      productName: orderData.productName,
      totalPrice: orderData.price,
      instrumentPrice: orderData.instrumentPrice,
      housseId: orderData.housse?.id || null,
      housseNom: orderData.housse?.nom || null,
      houssePrix: orderData.housse?.prix || null,
      livraison: orderData.livraison
    };
  }

  /**
   * Construit l'objet order pour payplug-client
   */
  function buildOrderObject() {
    return {
      reference: null,
      gamme: orderData.gamme || orderData.productName,
      taille: orderData.taille,
      prixTotal: orderData.price,
      instrumentId: orderData.instrumentId,
      source: orderData.source
    };
  }

  // ============================================================================
  // ONEY SELECTOR
  // ============================================================================

  function initOneySelector() {
    var selector = document.getElementById('oney-selector');
    if (!selector) return;

    selector.addEventListener('click', function(e) {
      var option = e.target.closest('.oney-selector__option');
      if (!option) return;

      var radio = option.querySelector('input[type="radio"]');
      if (!radio) return;

      selector.querySelectorAll('.oney-selector__option').forEach(function(el) {
        el.classList.remove('selected');
      });
      option.classList.add('selected');
      radio.checked = true;

      selectedInstallments = parseInt(radio.value);
      updateOneySchedule(selectedInstallments);
    });
  }

  // ============================================================================
  // INTEGRATED PAYMENT FORM
  // ============================================================================

  function initIntegratedPaymentForm() {
    if (typeof MistralPayplug === 'undefined' || !MistralPayplug.isIntegratedAvailable()) {
      return;
    }

    var cardForm = document.getElementById('card-form');
    var containers = {
      cardHolder: document.getElementById('cardholder-container'),
      cardNumber: document.getElementById('cardnumber-container'),
      expiration: document.getElementById('expiration-container'),
      cvv: document.getElementById('cvv-container')
    };

    if (!cardForm || !containers.cardHolder || !containers.cardNumber || !containers.expiration || !containers.cvv) {
      return;
    }

    try {
      MistralPayplug.initIntegratedForm(containers, { testMode: false });

      var schemesContainer = document.getElementById('card-schemes');
      if (schemesContainer) {
        var schemes = MistralPayplug.getSupportedSchemes();
        if (schemes) {
          schemes.forEach(function(scheme) {
            if (scheme.name !== 'DEFAULT' && scheme.iconUrl) {
              var img = document.createElement('img');
              img.src = scheme.iconUrl;
              img.alt = scheme.title;
              img.title = scheme.title;
              schemesContainer.appendChild(img);
            }
          });
        }
      }

      cardForm.style.display = '';
      integratedFormReady = true;
    } catch (error) {
      console.warn('[Commander] Erreur init Integrated Payment:', error.message);
    }
  }

  // ============================================================================
  // FORMULAIRES
  // ============================================================================

  function initForms() {
    bindForm('order', handleDepositSubmit);
    bindForm('full', handleFullSubmit);
    bindForm('oney', handleOneySubmit);
    bindForm('appointment', handleAppointmentSubmit);
  }

  function bindForm(name, handler) {
    var form = document.querySelector('form[data-form="' + name + '"]');
    if (form) form.addEventListener('submit', handler);
  }

  /**
   * Valide les champs client communs, retourne l'objet customer ou null
   */
  function validateCustomerForm(form) {
    var formData = new FormData(form);

    // Honeypot
    var honeypotField = form.querySelector('[name="website"]');
    if (honeypotField && honeypotField.value) {
      return null;
    }

    var customer = {
      firstName: (formData.get('firstname') || '').trim(),
      lastName: (formData.get('lastname') || '').trim(),
      email: (formData.get('email') || '').trim(),
      phone: (formData.get('phone') || '').trim(),
      address: {
        line1: (formData.get('address') || '').trim()
      }
    };

    if (!customer.firstName || !customer.lastName || !customer.email || !customer.phone) {
      showMessage('Veuillez remplir tous les champs obligatoires', 'error');
      return null;
    }

    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      showMessage('Veuillez entrer une adresse email valide', 'error');
      return null;
    }

    var cgvCheckbox = form.querySelector('input[type="checkbox"][required]');
    if (cgvCheckbox && !cgvCheckbox.checked) {
      showMessage('Veuillez accepter les conditions générales de vente', 'error');
      return null;
    }

    return customer;
  }

  // ============================================================================
  // PAIEMENT INTÉGRAL (stock)
  // ============================================================================

  async function handleFullSubmit(e) {
    e.preventDefault();

    var form = e.target;
    var submitBtn = document.getElementById('full-submit-btn') || form.querySelector('button[type="submit"]');
    var originalText = submitBtn.innerHTML;

    var customer = validateCustomerForm(form);
    if (!customer) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Préparation du paiement...';

    try {
      if (typeof MistralPayplug === 'undefined') {
        await sendOrderByEmail(customer, new FormData(form), 'full');
        return;
      }

      var totalCents = orderData.price * 100;
      var order = buildOrderObject();
      var metadata = buildOrderMetadata();

      var result = await MistralPayplug.createFullPayment(customer, order, totalCents, {
        metadata: metadata
      });

      if (result.success && result.paymentUrl) {
        savePendingOrder(result.reference, customer, 'full', orderData.price);

        showMessage('Redirection vers la page de paiement...', 'info');
        setTimeout(function() {
          MistralPayplug.redirectToPayment(result.paymentUrl);
        }, 1000);
      } else {
        throw new Error(result.error || 'Impossible de créer le paiement');
      }

    } catch (error) {
      console.error('Erreur paiement:', error);
      showMessage('Erreur: ' + error.message + '. Nous allons vous envoyer un email de confirmation.', 'warning');
      await sendOrderByEmail(customer, new FormData(form), 'full');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  // ============================================================================
  // ACOMPTE (30%)
  // ============================================================================

  async function handleDepositSubmit(e) {
    e.preventDefault();

    var form = e.target;
    var submitBtn = document.getElementById('deposit-submit-btn') || form.querySelector('button[type="submit"]');
    var originalText = submitBtn.innerHTML;

    var customer = validateCustomerForm(form);
    if (!customer) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Préparation du paiement...';

    try {
      if (typeof MistralPayplug === 'undefined') {
        await sendOrderByEmail(customer, new FormData(form), 'acompte');
        return;
      }

      if (integratedFormReady) {
        await handleIntegratedPayment(customer, submitBtn, originalText);
      } else {
        await handleHostedPayment(customer);
      }

    } catch (error) {
      console.error('Erreur commande:', error);
      showMessage('Erreur: ' + error.message + '. Nous allons vous envoyer un email de confirmation.', 'warning');
      await sendOrderByEmail(customer, new FormData(form), 'acompte');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  async function handleIntegratedPayment(customer, submitBtn, originalText) {
    var depositCents = getDepositAmountCents();
    var metadata = buildOrderMetadata();

    if (!pendingPaymentId) {
      submitBtn.textContent = 'Création du paiement...';

      var result = await MistralPayplug.createDeposit(customer, buildOrderObject(), {
        integrated: true,
        amount: depositCents,
        metadata: metadata
      });

      if (!result.success || !result.paymentId) {
        throw new Error(result.error || 'Impossible de créer le paiement');
      }

      pendingPaymentId = result.paymentId;
      savePendingOrder(result.reference, customer, 'acompte', getDepositAmount());
    }

    submitBtn.textContent = 'Paiement en cours...';
    submitBtn.disabled = true;

    var loading = document.getElementById('card-form-loading');
    if (loading) loading.classList.add('active');

    try {
      var payResult = await MistralPayplug.payIntegrated(pendingPaymentId);

      if (payResult.success) {
        var pendingOrder = JSON.parse(localStorage.getItem('mistral_pending_order') || 'null');
        var reference = pendingOrder?.reference || '';

        showPaymentSuccess(reference, pendingOrder);
        localStorage.removeItem('mistral_pending_order');
        pendingPaymentId = null;
      }
    } catch (payError) {
      showMessage(payError.message || 'Erreur de paiement. Veuillez réessayer.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    } finally {
      if (loading) loading.classList.remove('active');
    }
  }

  async function handleHostedPayment(customer) {
    var depositCents = getDepositAmountCents();
    var metadata = buildOrderMetadata();

    var result = await MistralPayplug.createDeposit(customer, buildOrderObject(), {
      amount: depositCents,
      metadata: metadata
    });

    if (result.success && result.paymentUrl) {
      savePendingOrder(result.reference, customer, 'acompte', getDepositAmount());

      showMessage('Redirection vers la page de paiement...', 'info');
      setTimeout(function() {
        MistralPayplug.redirectToPayment(result.paymentUrl);
      }, 1000);
    } else {
      throw new Error(result.error || 'Impossible de créer le paiement');
    }
  }

  // ============================================================================
  // ONEY 3x/4x
  // ============================================================================

  async function handleOneySubmit(e) {
    e.preventDefault();

    var form = e.target;
    var submitBtn = document.getElementById('oney-submit-btn') || form.querySelector('button[type="submit"]');
    var originalText = submitBtn.innerHTML;
    var formData = new FormData(form);

    // Honeypot
    var honeypotField = form.querySelector('[name="website"]');
    if (honeypotField && honeypotField.value) return;

    var customer = {
      firstName: (formData.get('firstname') || '').trim(),
      lastName: (formData.get('lastname') || '').trim(),
      email: (formData.get('email') || '').trim(),
      phone: (formData.get('phone') || '').trim(),
      address: {
        line1: (formData.get('address') || '').trim(),
        postalCode: (formData.get('postcode') || '').trim(),
        city: (formData.get('city') || '').trim(),
        country: 'FR'
      }
    };

    if (!customer.firstName || !customer.lastName || !customer.email || !customer.phone) {
      showMessage('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      showMessage('Veuillez entrer une adresse email valide', 'error');
      return;
    }

    if (!customer.address.line1 || !customer.address.postalCode || !customer.address.city) {
      showMessage('Adresse complète requise pour le paiement Oney', 'error');
      return;
    }

    var cgvCheckbox = form.querySelector('input[type="checkbox"][required]');
    if (cgvCheckbox && !cgvCheckbox.checked) {
      showMessage('Veuillez accepter les conditions générales de vente', 'error');
      return;
    }

    if (!isOneyEligible()) {
      showMessage('Le paiement Oney est disponible pour les montants entre 100 € et 3 000 €', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Préparation du paiement...';

    try {
      if (typeof MistralPayplug === 'undefined') {
        await sendOrderByEmail(customer, formData, 'oney');
        return;
      }

      var totalCents = orderData.price * 100;
      var order = buildOrderObject();
      order.metadata = buildOrderMetadata();

      var result = await MistralPayplug.createInstallmentPayment(
        customer, order, totalCents, selectedInstallments
      );

      if (result.success && result.paymentUrl) {
        savePendingOrder(result.reference, customer, 'oney_' + selectedInstallments + 'x', orderData.price);

        showMessage('Redirection vers Oney...', 'info');
        setTimeout(function() {
          MistralPayplug.redirectToPayment(result.paymentUrl);
        }, 1000);
      } else {
        throw new Error(result.error || 'Impossible de créer le paiement Oney');
      }

    } catch (error) {
      console.error('Erreur Oney:', error);
      showMessage('Erreur: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  // ============================================================================
  // PENDING ORDER (localStorage)
  // ============================================================================

  function savePendingOrder(reference, customer, paymentType, paidAmount) {
    localStorage.setItem('mistral_pending_order', JSON.stringify({
      reference: reference,
      customer: customer,
      product: orderData,
      paymentType: paymentType,
      paidAmount: paidAmount,
      createdAt: new Date().toISOString()
    }));
  }

  // ============================================================================
  // FALLBACK EMAIL
  // ============================================================================

  async function sendOrderByEmail(customer, formData, paymentType) {
    var deposit = getDepositAmount();
    var typeLabel;
    if (paymentType === 'full') {
      typeLabel = 'Commande paiement intégral';
    } else if (paymentType === 'oney') {
      typeLabel = 'Commande Oney ' + selectedInstallments + 'x';
    } else {
      typeLabel = 'Commande avec acompte';
    }

    var lines = [
      typeLabel + ' - ' + orderData.productName,
      '',
      'Prix total: ' + formatPrice(orderData.price),
    ];

    if (paymentType === 'full') {
      lines.push('Paiement intégral');
    } else if (paymentType === 'oney') {
      lines.push('Paiement en ' + selectedInstallments + 'x');
    } else {
      lines.push('Acompte (30%): ' + formatPrice(deposit));
      lines.push('Reste à payer: ' + formatPrice(orderData.price - deposit));
    }

    if (orderData.source === 'stock') {
      lines.push('', 'Type: Instrument en stock');
      if (orderData.instrumentId) lines.push('ID instrument: ' + orderData.instrumentId);
    }

    if (orderData.housse) {
      lines.push('Housse: ' + orderData.housse.nom + ' (' + formatPrice(orderData.housse.prix) + ')');
    }

    lines.push(
      '',
      'Adresse: ' + (formData.get('address') || 'Non renseignée'),
      formData.get('postcode') ? 'Code postal: ' + formData.get('postcode') : '',
      formData.get('city') ? 'Ville: ' + formData.get('city') : '',
      'Message: ' + (formData.get('message') || 'Aucun')
    );

    var message = lines.filter(Boolean).join('\n').trim();

    try {
      if (typeof MistralEmail !== 'undefined') {
        var result = await MistralEmail.sendContact({
          firstname: customer.firstName,
          lastname: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          message: message,
          type: typeLabel
        });

        if (result.success) {
          showMessage('Votre demande a été envoyée. Nous vous contacterons avec le lien de paiement.', 'success');
        } else {
          throw new Error(result.error);
        }
      } else {
        var subject = encodeURIComponent('[Mistral Pans] ' + typeLabel + ' - ' + customer.firstName + ' ' + customer.lastName);
        var body = encodeURIComponent(
          'Nom: ' + customer.firstName + ' ' + customer.lastName + '\n' +
          'Email: ' + customer.email + '\n' +
          'Téléphone: ' + customer.phone + '\n\n' + message
        );
        window.location.href = 'mailto:contact@mistralpans.fr?subject=' + subject + '&body=' + body;
        showMessage('Votre client email va s\'ouvrir.', 'info');
      }
    } catch (error) {
      console.error('Erreur envoi email:', error);
      showMessage('Une erreur est survenue. Contactez-nous directement: contact@mistralpans.fr', 'error');
    }
  }

  // ============================================================================
  // RENDEZ-VOUS
  // ============================================================================

  async function handleAppointmentSubmit(e) {
    e.preventDefault();

    var form = e.target;
    var submitBtn = form.querySelector('button[type="submit"]');
    var originalText = submitBtn.textContent;
    var formData = new FormData(form);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
      var message = [
        'Demande de rendez-vous',
        '',
        'Préférence de contact: ' + formData.get('contact_preference'),
        'Instrument d\'intérêt: ' + orderData.productName,
        isStock() ? '(Instrument en stock)' : '(Configuration sur mesure)',
        '',
        formData.get('message')
      ].join('\n').trim();

      if (typeof MistralEmail !== 'undefined') {
        var result = await MistralEmail.sendContact({
          firstname: (formData.get('firstname') || '').trim(),
          lastname: (formData.get('lastname') || '').trim(),
          email: (formData.get('email') || '').trim(),
          phone: (formData.get('phone') || '').trim(),
          message: message,
          type: 'Demande de RDV'
        });

        if (result.success) {
          showMessage('Votre demande a été envoyée ! Nous vous recontacterons sous 48h.', 'success');
          form.reset();
        } else {
          throw new Error(result.error);
        }
      } else {
        var subject = encodeURIComponent('[Mistral Pans] Demande RDV - ' + formData.get('firstname') + ' ' + formData.get('lastname'));
        var body = encodeURIComponent(
          'Nom: ' + formData.get('firstname') + ' ' + formData.get('lastname') + '\n' +
          'Email: ' + formData.get('email') + '\n' +
          'Téléphone: ' + formData.get('phone') + '\n\n' + message
        );
        window.location.href = 'mailto:contact@mistralpans.fr?subject=' + subject + '&body=' + body;
        showMessage('Votre client email va s\'ouvrir.', 'info');
      }

    } catch (error) {
      console.error('Erreur envoi RDV:', error);
      showMessage('Une erreur est survenue. Contactez-nous directement: contact@mistralpans.fr', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // ============================================================================
  // RETOUR DE PAIEMENT
  // ============================================================================

  function checkPaymentReturn() {
    if (typeof MistralPayplug === 'undefined') return;

    var paymentStatus = MistralPayplug.checkPaymentStatus();
    if (!paymentStatus) return;

    var status = paymentStatus.status;
    var reference = paymentStatus.reference;
    var pendingOrder = JSON.parse(localStorage.getItem('mistral_pending_order') || 'null');

    switch (status) {
      case 'success':
        showPaymentSuccess(reference, pendingOrder);
        localStorage.removeItem('mistral_pending_order');
        break;
      case 'cancelled':
        showPaymentCancelled();
        break;
      case 'error':
        showPaymentError();
        break;
    }

    MistralPayplug.clearPaymentParams();
  }

  function showPaymentSuccess(reference, pendingOrder) {
    var container = document.querySelector('.order-page .container') || document.querySelector('main');
    if (!container) return;

    var safeRef = escapeHtml(reference || 'N/A');
    var safeProduct = escapeHtml(pendingOrder?.product?.productName || 'Handpan sur mesure');
    var paymentType = pendingOrder?.paymentType || 'acompte';
    var isOney = paymentType.startsWith('oney');
    var isFull = paymentType === 'full';

    var amountDetail = '';
    if (isOney) {
      amountDetail = '<p><strong>Mode :</strong> Paiement en ' + escapeHtml(paymentType.replace('oney_', '')) + '</p>';
    } else if (isFull) {
      amountDetail = '<p><strong>Montant payé :</strong> ' + escapeHtml(formatPrice(pendingOrder?.paidAmount || 0)) + '</p>';
    } else if (pendingOrder?.paidAmount) {
      amountDetail = '<p><strong>Acompte versé :</strong> ' + escapeHtml(formatPrice(pendingOrder.paidAmount)) + '</p>';
    }

    var nextSteps = '';
    if (isFull) {
      nextSteps = '<p>Nous préparons votre instrument pour l\'expédition. Vous recevrez un email avec le suivi.</p>';
    } else if (isOney) {
      nextSteps = '<p>Votre paiement sera prélevé selon l\'échéancier Oney. Nous lançons la fabrication.</p>';
    } else {
      nextSteps = '<p>Votre acompte a bien été enregistré. Nous vous contacterons pour le solde quand votre instrument sera prêt.</p>';
    }

    container.innerHTML =
      '<div class="payment-result payment-result--success">' +
        '<div class="payment-result__icon">✓</div>' +
        '<h2>Paiement confirmé !</h2>' +
        '<p>Merci pour votre commande.</p>' +
        '<div class="payment-result__details">' +
          '<p><strong>Référence :</strong> ' + safeRef + '</p>' +
          '<p><strong>Instrument :</strong> ' + safeProduct + '</p>' +
          amountDetail +
        '</div>' +
        nextSteps +
        '<p>Un email de confirmation vous a été envoyé.</p>' +
        '<div class="payment-result__actions">' +
          '<a href="index.html" class="btn btn--primary">Retour à l\'accueil</a>' +
        '</div>' +
      '</div>';

    addPaymentResultStyles();
  }

  function showPaymentCancelled() {
    showMessage(
      'Paiement annulé. Votre commande n\'a pas été validée. Vous pouvez réessayer ci-dessous.',
      'warning'
    );
  }

  function showPaymentError() {
    var urlParams = new URLSearchParams(window.location.search);
    var failureCode = urlParams.get('failure');

    var failureMessages = {
      processing_error: 'Erreur de traitement de la carte. Veuillez réessayer.',
      card_declined: 'Carte refusée. Vérifiez vos informations ou essayez une autre carte.',
      insufficient_funds: 'Fonds insuffisants sur la carte.',
      '3ds_declined': 'Authentification 3D Secure refusée.',
      incorrect_number: 'Numéro de carte incorrect.',
      fraud_suspected: 'Paiement refusé (suspicion de fraude).',
      method_unsupported: 'Méthode de paiement non supportée.',
      timeout: 'Le délai de paiement a expiré. Veuillez réessayer.',
      aborted: 'Le paiement a été annulé.'
    };

    var message = failureMessages[failureCode]
      || 'Une erreur est survenue lors du paiement. Contactez-nous si le problème persiste.';

    showMessage(message, 'error');
  }

  // ============================================================================
  // UTILITAIRES UI
  // ============================================================================

  function showMessage(text, type) {
    type = type || 'info';
    var existing = document.querySelector('.order-message');
    if (existing) existing.remove();

    var colors = {
      success: '#4A7C59',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#0D7377'
    };

    var message = document.createElement('div');
    message.className = 'order-message';
    message.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'padding:16px 24px;background:' + (colors[type] || colors.info) + ';' +
      'color:white;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);' +
      'z-index:10000;max-width:90%;text-align:center;animation:slideDown 0.3s ease;';
    message.textContent = text;

    document.body.appendChild(message);

    setTimeout(function() {
      message.style.animation = 'slideUp 0.3s ease';
      setTimeout(function() { message.remove(); }, 300);
    }, 5000);
  }

  function addPaymentResultStyles() {
    if (document.getElementById('payment-result-styles')) return;

    var style = document.createElement('style');
    style.id = 'payment-result-styles';
    style.textContent =
      '.payment-result{text-align:center;padding:60px 20px;max-width:500px;margin:0 auto}' +
      '.payment-result--success .payment-result__icon{width:80px;height:80px;background:#4A7C59;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 24px}' +
      '.payment-result h2{color:#4A7C59;margin-bottom:16px}' +
      '.payment-result__details{background:#f5f5f5;padding:20px;border-radius:8px;margin:24px 0;text-align:left}' +
      '.payment-result__details p{margin:8px 0}' +
      '.payment-result__actions{margin-top:32px}' +
      '@keyframes slideDown{from{transform:translateX(-50%) translateY(-100%);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}' +
      '@keyframes slideUp{from{transform:translateX(-50%) translateY(0);opacity:1}to{transform:translateX(-50%) translateY(-100%);opacity:0}}';
    document.head.appendChild(style);
  }

  // ============================================================================
  // SÉLECTION D'OPTION (exposé globalement pour onclick)
  // ============================================================================

  window.selectOption = function(option) {
    document.querySelectorAll('.order-option').forEach(function(el) {
      el.classList.remove('selected');
      el.setAttribute('aria-selected', 'false');
    });

    var selectedEl = document.querySelector('[data-option="' + option + '"]');
    if (selectedEl) {
      selectedEl.classList.add('selected');
      selectedEl.setAttribute('aria-selected', 'true');
    }

    document.querySelectorAll('.order-form').forEach(function(el) {
      el.classList.remove('active');
    });

    var targetForm = document.getElementById('form-' + option);
    if (targetForm) {
      targetForm.classList.add('active');
      var firstInput = targetForm.querySelector('input:not([type="hidden"])');
      if (firstInput) {
        setTimeout(function() { firstInput.focus(); }, 100);
      }
    }
  };

})(window);
