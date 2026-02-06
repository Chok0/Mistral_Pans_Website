/* ==========================================================================
   MISTRAL PANS - Page Commander
   Gestion des formulaires de commande et intégration Payplug
   Supporte : acompte 30%, Oney 3x/4x, mode intégré + fallback hosted
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
    price: 1400,
    notes: '',
    gamme: '',
    taille: '53 cm'
  };

  // État du paiement intégré
  let integratedFormReady = false;
  let pendingPaymentId = null;

  // État Oney
  let selectedInstallments = 3;

  // ============================================================================
  // CALCULS
  // ============================================================================

  /**
   * Calcule le montant de l'acompte (30% du prix, arrondi à l'euro)
   */
  function getDepositAmount() {
    return Math.round(orderData.price * DEPOSIT_RATE);
  }

  /**
   * Calcule le montant de l'acompte en centimes
   */
  function getDepositAmountCents() {
    return getDepositAmount() * 100;
  }

  /**
   * Vérifie si le prix est éligible Oney
   */
  function isOneyEligible() {
    return orderData.price >= ONEY_MIN && orderData.price <= ONEY_MAX;
  }

  /**
   * Calcule les échéances Oney
   * @param {number} total - Montant total en euros
   * @param {number} n - Nombre d'échéances (3 ou 4)
   * @returns {number[]} Montants de chaque échéance
   */
  function computeInstallments(total, n) {
    const base = Math.floor(total / n);
    const remainder = total - base * n;
    // La première échéance absorbe le reste
    const installments = [base + remainder];
    for (let i = 1; i < n; i++) {
      installments.push(base);
    }
    return installments;
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  document.addEventListener('DOMContentLoaded', function() {
    // Récupérer les paramètres de l'URL
    parseUrlParams();

    // Initialiser les formulaires
    initForms();

    // Initialiser le sélecteur Oney
    initOneySelector();

    // Initialiser le formulaire de carte intégré si le SDK est disponible
    initIntegratedPaymentForm();

    // Vérifier le statut de paiement (retour de Payplug)
    checkPaymentReturn();
  });

  /**
   * Parse les paramètres URL
   */
  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);

    orderData.productName = params.get('product') || orderData.productName;
    orderData.price = parseInt(params.get('price')) || orderData.price;
    orderData.notes = params.get('notes') || '';
    orderData.gamme = params.get('gamme') || '';
    orderData.taille = params.get('taille') || orderData.taille;

    updateOrderDisplay();
  }

  /**
   * Met à jour l'affichage de la commande (deposit + oney)
   */
  function updateOrderDisplay() {
    const deposit = getDepositAmount();
    const remaining = orderData.price - deposit;

    // Champs cachés
    const formProduct = document.getElementById('form-product');
    const formProductRdv = document.getElementById('form-product-rdv');
    const formProductOney = document.getElementById('form-product-oney');
    const formDepositAmount = document.getElementById('form-deposit-amount');
    if (formProduct) formProduct.value = orderData.productName;
    if (formProductRdv) formProductRdv.value = orderData.productName;
    if (formProductOney) formProductOney.value = orderData.productName;
    if (formDepositAmount) formDepositAmount.value = deposit;

    // Affichage produit
    const productName = document.getElementById('product-name');
    const productNotes = document.getElementById('product-notes');
    const productPrice = document.getElementById('product-price');
    if (productName) productName.textContent = orderData.productName;
    if (productNotes && orderData.notes) productNotes.textContent = orderData.notes;
    if (productPrice) productPrice.textContent = formatPrice(orderData.price);

    // Option card deposit amount
    const optionDeposit = document.getElementById('option-deposit-amount');
    if (optionDeposit) optionDeposit.textContent = `30 % (${formatPrice(deposit)})`;

    // Résumé commande deposit
    const summaryProduct = document.getElementById('summary-product');
    const summaryTotal = document.getElementById('summary-total');
    const summaryDeposit = document.getElementById('summary-deposit');
    const summaryRemaining = document.getElementById('summary-remaining');
    if (summaryProduct) summaryProduct.textContent = orderData.productName;
    if (summaryTotal) summaryTotal.textContent = formatPrice(orderData.price);
    if (summaryDeposit) summaryDeposit.textContent = formatPrice(deposit);
    if (summaryRemaining) summaryRemaining.textContent = formatPrice(remaining);

    // Bouton submit deposit
    const depositBtnAmount = document.getElementById('deposit-btn-amount');
    if (depositBtnAmount) depositBtnAmount.textContent = formatPrice(deposit);

    // Oney
    updateOneyDisplay();
  }

  /**
   * Met à jour l'affichage Oney
   */
  function updateOneyDisplay() {
    const eligible = isOneyEligible();

    const eligibleEl = document.getElementById('oney-eligible');
    const ineligibleEl = document.getElementById('oney-ineligible');
    if (eligibleEl) eligibleEl.style.display = eligible ? '' : 'none';
    if (ineligibleEl) ineligibleEl.style.display = eligible ? 'none' : '';

    if (!eligible) return;

    const total = orderData.price;

    // Produit
    const oneyProduct = document.getElementById('oney-product');
    const oneyTotal = document.getElementById('oney-total');
    if (oneyProduct) oneyProduct.textContent = orderData.productName;
    if (oneyTotal) oneyTotal.textContent = formatPrice(total);

    // Détails 3x
    const inst3 = computeInstallments(total, 3);
    const detail3 = document.getElementById('oney-3x-detail');
    if (detail3) detail3.textContent = `3 × ${formatPrice(inst3[1])}`;

    // Détails 4x
    const inst4 = computeInstallments(total, 4);
    const detail4 = document.getElementById('oney-4x-detail');
    if (detail4) detail4.textContent = `4 × ${formatPrice(inst4[1])}`;

    // Mettre à jour la grille d'échéances
    updateOneySchedule(selectedInstallments);
  }

  /**
   * Met à jour le détail des échéances Oney
   */
  function updateOneySchedule(n) {
    const installments = computeInstallments(orderData.price, n);

    for (let i = 0; i < 4; i++) {
      const row = document.getElementById(`oney-schedule-${i + 1}`);
      const amount = document.getElementById(`oney-amount-${i + 1}`);
      if (row) row.style.display = (i < n) ? '' : 'none';
      if (amount && i < n) amount.textContent = formatPrice(installments[i]);
    }

    // Bouton
    const btnInstallments = document.getElementById('oney-btn-installments');
    const btnTotal = document.getElementById('oney-btn-total');
    if (btnInstallments) btnInstallments.textContent = n;
    if (btnTotal) btnTotal.textContent = formatPrice(orderData.price);

    // Champ caché
    const formInstallments = document.getElementById('form-installments');
    if (formInstallments) formInstallments.value = n;
  }

  /**
   * Formate un prix en euros
   */
  function formatPrice(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // ============================================================================
  // ONEY SELECTOR
  // ============================================================================

  /**
   * Initialise le sélecteur 3x/4x Oney
   */
  function initOneySelector() {
    const selector = document.getElementById('oney-selector');
    if (!selector) return;

    selector.addEventListener('click', function(e) {
      const option = e.target.closest('.oney-selector__option');
      if (!option) return;

      const radio = option.querySelector('input[type="radio"]');
      if (!radio) return;

      // Mettre à jour la sélection visuelle
      selector.querySelectorAll('.oney-selector__option').forEach(el => {
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

  /**
   * Initialise le formulaire de carte intégré PayPlug
   */
  function initIntegratedPaymentForm() {
    if (typeof MistralPayplug === 'undefined' || !MistralPayplug.isIntegratedAvailable()) {
      console.log('[Commander] SDK Integrated Payment non disponible, mode hosted actif');
      return;
    }

    const cardForm = document.getElementById('card-form');
    const containers = {
      cardHolder: document.getElementById('cardholder-container'),
      cardNumber: document.getElementById('cardnumber-container'),
      expiration: document.getElementById('expiration-container'),
      cvv: document.getElementById('cvv-container')
    };

    // Vérifier que tous les conteneurs existent
    if (!cardForm || !containers.cardHolder || !containers.cardNumber || !containers.expiration || !containers.cvv) {
      console.warn('[Commander] Conteneurs de carte manquants');
      return;
    }

    try {
      const intPayment = MistralPayplug.initIntegratedForm(containers, {
        testMode: false // Passer à true pour les tests
      });

      // Afficher les schémas de carte supportés
      const schemesContainer = document.getElementById('card-schemes');
      if (schemesContainer) {
        const schemes = MistralPayplug.getSupportedSchemes();
        if (schemes) {
          schemes.forEach(scheme => {
            if (scheme.name !== 'DEFAULT' && scheme.iconUrl) {
              const img = document.createElement('img');
              img.src = scheme.iconUrl;
              img.alt = scheme.title;
              img.title = scheme.title;
              schemesContainer.appendChild(img);
            }
          });
        }
      }

      // Afficher le formulaire de carte
      cardForm.style.display = '';
      integratedFormReady = true;

      console.log('[Commander] Formulaire de carte intégré initialisé');

    } catch (error) {
      console.warn('[Commander] Erreur init Integrated Payment:', error.message);
    }
  }

  // ============================================================================
  // GESTION DES FORMULAIRES
  // ============================================================================

  /**
   * Initialise les gestionnaires de formulaires
   */
  function initForms() {
    // Formulaire commande avec acompte
    const orderForm = document.querySelector('form[data-form="order"]');
    if (orderForm) {
      orderForm.addEventListener('submit', handleOrderSubmit);
    }

    // Formulaire Oney
    const oneyForm = document.querySelector('form[data-form="oney"]');
    if (oneyForm) {
      oneyForm.addEventListener('submit', handleOneySubmit);
    }

    // Formulaire rendez-vous
    const appointmentForm = document.querySelector('form[data-form="appointment"]');
    if (appointmentForm) {
      appointmentForm.addEventListener('submit', handleAppointmentSubmit);
    }
  }

  // ============================================================================
  // ACOMPTE (30%)
  // ============================================================================

  /**
   * Gère la soumission du formulaire de commande (acompte 30%)
   */
  async function handleOrderSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = document.getElementById('deposit-submit-btn') || form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    // Récupérer les données du formulaire
    const formData = new FormData(form);
    const customer = {
      firstName: formData.get('firstname')?.trim(),
      lastName: formData.get('lastname')?.trim(),
      email: formData.get('email')?.trim(),
      phone: formData.get('phone')?.trim(),
      address: {
        line1: formData.get('address')?.trim()
      }
    };

    // Vérification honeypot anti-spam
    const honeypotField = form.querySelector('[name="website"]');
    if (honeypotField && honeypotField.value) {
      console.warn('Honeypot déclenché');
      return;
    }

    // Validation basique
    if (!customer.firstName || !customer.lastName || !customer.email || !customer.phone) {
      showMessage('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    // Valider l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      showMessage('Veuillez entrer une adresse email valide', 'error');
      return;
    }

    // Vérifier l'acceptation des CGV
    const cgvCheckbox = form.querySelector('input[type="checkbox"][required]');
    if (cgvCheckbox && !cgvCheckbox.checked) {
      showMessage('Veuillez accepter les conditions générales de vente', 'error');
      return;
    }

    // Désactiver le bouton
    submitBtn.disabled = true;
    submitBtn.textContent = 'Préparation du paiement...';

    try {
      if (typeof MistralPayplug === 'undefined') {
        await sendOrderByEmail(customer, formData, 'acompte');
        return;
      }

      // Utiliser le mode intégré si disponible
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

  /**
   * Gère le paiement en mode intégré (carte sur la page)
   */
  async function handleIntegratedPayment(customer, submitBtn, originalText) {
    const depositCents = getDepositAmountCents();

    // Étape 1 : Créer le paiement côté serveur (si pas déjà créé)
    if (!pendingPaymentId) {
      submitBtn.textContent = 'Création du paiement...';

      const result = await MistralPayplug.createDeposit(customer, {
        gamme: orderData.gamme || orderData.productName,
        taille: orderData.taille,
        prixTotal: orderData.price
      }, { integrated: true, amount: depositCents });

      if (!result.success || !result.paymentId) {
        throw new Error(result.error || 'Impossible de créer le paiement');
      }

      pendingPaymentId = result.paymentId;

      // Sauvegarder en localStorage
      localStorage.setItem('mistral_pending_order', JSON.stringify({
        reference: result.reference,
        customer,
        product: orderData,
        paymentType: 'acompte',
        depositAmount: getDepositAmount(),
        createdAt: new Date().toISOString()
      }));
    }

    // Étape 2 : Lancer le paiement via le formulaire intégré
    submitBtn.textContent = 'Paiement en cours...';
    submitBtn.disabled = true;

    // Afficher le spinner
    const loading = document.getElementById('card-form-loading');
    if (loading) loading.classList.add('active');

    try {
      const payResult = await MistralPayplug.payIntegrated(pendingPaymentId);

      if (payResult.success) {
        const pendingOrder = JSON.parse(localStorage.getItem('mistral_pending_order') || 'null');
        const reference = pendingOrder?.reference || '';

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

  /**
   * Gère le paiement en mode hébergé (redirection vers PayPlug)
   */
  async function handleHostedPayment(customer) {
    const depositCents = getDepositAmountCents();

    const result = await MistralPayplug.createDeposit(customer, {
      gamme: orderData.gamme || orderData.productName,
      taille: orderData.taille,
      prixTotal: orderData.price
    }, { amount: depositCents });

    if (result.success && result.paymentUrl) {
      localStorage.setItem('mistral_pending_order', JSON.stringify({
        reference: result.reference,
        customer,
        product: orderData,
        paymentType: 'acompte',
        depositAmount: getDepositAmount(),
        createdAt: new Date().toISOString()
      }));

      showMessage('Redirection vers la page de paiement...', 'info');
      setTimeout(() => {
        MistralPayplug.redirectToPayment(result.paymentUrl);
      }, 1000);
    } else {
      throw new Error(result.error || 'Impossible de créer le paiement');
    }
  }

  // ============================================================================
  // ONEY 3x/4x
  // ============================================================================

  /**
   * Gère la soumission du formulaire Oney
   */
  async function handleOneySubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = document.getElementById('oney-submit-btn') || form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    const formData = new FormData(form);

    // Vérification honeypot
    const honeypotField = form.querySelector('[name="website"]');
    if (honeypotField && honeypotField.value) {
      console.warn('Honeypot déclenché');
      return;
    }

    const customer = {
      firstName: formData.get('firstname')?.trim(),
      lastName: formData.get('lastname')?.trim(),
      email: formData.get('email')?.trim(),
      phone: formData.get('phone')?.trim(),
      address: {
        line1: formData.get('address')?.trim(),
        postalCode: formData.get('postcode')?.trim(),
        city: formData.get('city')?.trim(),
        country: 'FR'
      }
    };

    // Validation
    if (!customer.firstName || !customer.lastName || !customer.email || !customer.phone) {
      showMessage('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      showMessage('Veuillez entrer une adresse email valide', 'error');
      return;
    }

    if (!customer.address.line1 || !customer.address.postalCode || !customer.address.city) {
      showMessage('Adresse complète requise pour le paiement Oney', 'error');
      return;
    }

    if (!customer.phone) {
      showMessage('Numéro de téléphone mobile requis pour Oney', 'error');
      return;
    }

    const cgvCheckbox = form.querySelector('input[type="checkbox"][required]');
    if (cgvCheckbox && !cgvCheckbox.checked) {
      showMessage('Veuillez accepter les conditions générales de vente', 'error');
      return;
    }

    if (!isOneyEligible()) {
      showMessage('Le paiement Oney est disponible pour les montants entre 100 € et 3 000 €', 'error');
      return;
    }

    // Désactiver le bouton
    submitBtn.disabled = true;
    submitBtn.textContent = 'Préparation du paiement...';

    try {
      if (typeof MistralPayplug === 'undefined') {
        await sendOrderByEmail(customer, formData, 'oney');
        return;
      }

      const totalCents = orderData.price * 100;

      const result = await MistralPayplug.createInstallmentPayment(
        customer,
        {
          reference: null,
          gamme: orderData.gamme || orderData.productName,
          taille: orderData.taille,
          prixTotal: orderData.price
        },
        totalCents,
        selectedInstallments
      );

      if (result.success && result.paymentUrl) {
        localStorage.setItem('mistral_pending_order', JSON.stringify({
          reference: result.reference,
          customer,
          product: orderData,
          paymentType: `oney_${selectedInstallments}x`,
          createdAt: new Date().toISOString()
        }));

        showMessage('Redirection vers Oney...', 'info');
        setTimeout(() => {
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
  // FALLBACK EMAIL
  // ============================================================================

  /**
   * Envoie la commande par email (fallback)
   */
  async function sendOrderByEmail(customer, formData, paymentType) {
    const deposit = getDepositAmount();
    const isOney = paymentType === 'oney';
    const typeLabel = isOney ? `Commande Oney ${selectedInstallments}x` : 'Commande avec acompte';

    const message = [
      `${typeLabel} - ${orderData.productName}`,
      '',
      `Prix total: ${formatPrice(orderData.price)}`,
      isOney
        ? `Paiement en ${selectedInstallments}x`
        : `Acompte (30%): ${formatPrice(deposit)}\nReste à payer: ${formatPrice(orderData.price - deposit)}`,
      '',
      `Adresse: ${formData.get('address') || 'Non renseignée'}`,
      formData.get('postcode') ? `Code postal: ${formData.get('postcode')}` : '',
      formData.get('city') ? `Ville: ${formData.get('city')}` : '',
      `Message: ${formData.get('message') || 'Aucun'}`
    ].filter(Boolean).join('\n').trim();

    try {
      if (typeof MistralEmail !== 'undefined') {
        const result = await MistralEmail.sendContact({
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
        const subject = encodeURIComponent('[Mistral Pans] ' + typeLabel + ' - ' + customer.firstName + ' ' + customer.lastName);
        const body = encodeURIComponent(
          'Nom: ' + customer.firstName + ' ' + customer.lastName + '\n' +
          'Email: ' + customer.email + '\n' +
          'Téléphone: ' + customer.phone + '\n\n' +
          message
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

  /**
   * Gère la soumission du formulaire de rendez-vous
   */
  async function handleAppointmentSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    const formData = new FormData(form);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
      const message = [
        'Demande de rendez-vous',
        '',
        'Préférence de contact: ' + formData.get('contact_preference'),
        'Instrument d\'intérêt: ' + orderData.productName,
        '',
        formData.get('message')
      ].join('\n').trim();

      if (typeof MistralEmail !== 'undefined') {
        const result = await MistralEmail.sendContact({
          firstname: formData.get('firstname')?.trim(),
          lastname: formData.get('lastname')?.trim(),
          email: formData.get('email')?.trim(),
          phone: formData.get('phone')?.trim(),
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
        const subject = encodeURIComponent('[Mistral Pans] Demande RDV - ' + formData.get('firstname') + ' ' + formData.get('lastname'));
        const body = encodeURIComponent(
          'Nom: ' + formData.get('firstname') + ' ' + formData.get('lastname') + '\n' +
          'Email: ' + formData.get('email') + '\n' +
          'Téléphone: ' + formData.get('phone') + '\n\n' +
          message
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

  /**
   * Vérifie le retour de Payplug (mode hosted / Oney)
   */
  function checkPaymentReturn() {
    if (typeof MistralPayplug === 'undefined') return;

    const paymentStatus = MistralPayplug.checkPaymentStatus();

    if (!paymentStatus) return;

    const { status, reference } = paymentStatus;

    // Récupérer la commande en attente
    const pendingOrder = JSON.parse(localStorage.getItem('mistral_pending_order') || 'null');

    switch (status) {
      case 'success':
        showPaymentSuccess(reference, pendingOrder);
        localStorage.removeItem('mistral_pending_order');
        break;

      case 'cancelled':
        showPaymentCancelled(reference);
        break;

      case 'error':
        showPaymentError(reference);
        break;
    }

    // Nettoyer l'URL
    MistralPayplug.clearPaymentParams();
  }

  /**
   * Affiche le message de succès de paiement
   */
  function showPaymentSuccess(reference, pendingOrder) {
    const container = document.querySelector('.order-page .container') || document.querySelector('main');
    if (!container) return;

    // Échapper les données pour éviter XSS
    const safeRef = escapeHtml(reference || 'N/A');
    const safeProduct = escapeHtml(pendingOrder?.product?.productName || 'Handpan sur mesure');
    const paymentType = pendingOrder?.paymentType || 'acompte';
    const isOney = paymentType.startsWith('oney');

    let amountDetail = '';
    if (isOney) {
      amountDetail = '<p><strong>Mode :</strong> Paiement en ' + escapeHtml(paymentType.replace('oney_', '')) + '</p>';
    } else if (pendingOrder?.depositAmount) {
      amountDetail = '<p><strong>Acompte versé :</strong> ' + escapeHtml(formatPrice(pendingOrder.depositAmount)) + '</p>';
    }

    container.innerHTML =
      '<div class="payment-result payment-result--success">' +
        '<div class="payment-result__icon">✓</div>' +
        '<h2>Paiement confirmé !</h2>' +
        '<p>Merci pour votre commande.' + (isOney ? '' : ' Votre acompte a bien été enregistré.') + '</p>' +
        '<div class="payment-result__details">' +
          '<p><strong>Référence :</strong> ' + safeRef + '</p>' +
          '<p><strong>Instrument :</strong> ' + safeProduct + '</p>' +
          amountDetail +
        '</div>' +
        '<p>Un email de confirmation vous a été envoyé. Nous vous contacterons prochainement pour la suite.</p>' +
        '<div class="payment-result__actions">' +
          '<a href="index.html" class="btn btn--primary">Retour à l\'accueil</a>' +
        '</div>' +
      '</div>';

    addPaymentResultStyles();
  }

  /**
   * Échappe les caractères HTML
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Affiche le message d'annulation
   */
  function showPaymentCancelled(reference) {
    showMessage(
      'Paiement annulé. Votre commande n\'a pas été validée. Vous pouvez réessayer ci-dessous.',
      'warning'
    );
  }

  /**
   * Affiche le message d'erreur avec détail du code PayPlug si disponible
   */
  function showPaymentError(reference) {
    const urlParams = new URLSearchParams(window.location.search);
    const failureCode = urlParams.get('failure');

    const failureMessages = {
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

    const message = failureMessages[failureCode]
      || 'Une erreur est survenue lors du paiement. Contactez-nous si le problème persiste.';

    showMessage(message, 'error');
  }

  // ============================================================================
  // UTILITAIRES UI
  // ============================================================================

  /**
   * Affiche un message à l'utilisateur
   */
  function showMessage(text, type) {
    type = type || 'info';
    // Supprimer les messages existants
    const existing = document.querySelector('.order-message');
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

  /**
   * Ajoute les styles pour les résultats de paiement
   */
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
    // Mettre à jour les options visuellement
    document.querySelectorAll('.order-option').forEach(function(el) {
      el.classList.remove('selected');
      el.setAttribute('aria-selected', 'false');
    });

    var selectedOption = document.querySelector('[data-option="' + option + '"]');
    if (selectedOption) {
      selectedOption.classList.add('selected');
      selectedOption.setAttribute('aria-selected', 'true');
    }

    // Afficher le bon formulaire
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
