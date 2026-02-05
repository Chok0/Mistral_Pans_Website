/* ==========================================================================
   MISTRAL PANS - Page Commander
   Gestion des formulaires de commande et intégration Payplug
   ========================================================================== */

(function(window) {
  'use strict';

  // État de la page
  let orderData = {
    productName: 'D Kurd 9 notes',
    price: 1400,
    notes: '',
    gamme: '',
    taille: '53 cm'
  };

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  document.addEventListener('DOMContentLoaded', function() {
    // Récupérer les paramètres de l'URL
    parseUrlParams();

    // Initialiser les formulaires
    initForms();

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
   * Met à jour l'affichage de la commande
   */
  function updateOrderDisplay() {
    // Champs cachés
    const formProduct = document.getElementById('form-product');
    const formProductRdv = document.getElementById('form-product-rdv');
    if (formProduct) formProduct.value = orderData.productName;
    if (formProductRdv) formProductRdv.value = orderData.productName;

    // Affichage produit
    const productName = document.getElementById('product-name');
    const productNotes = document.getElementById('product-notes');
    const productPrice = document.getElementById('product-price');
    if (productName) productName.textContent = orderData.productName;
    if (productNotes && orderData.notes) productNotes.textContent = orderData.notes;
    if (productPrice) productPrice.textContent = formatPrice(orderData.price);

    // Résumé commande
    const summaryProduct = document.getElementById('summary-product');
    const summaryTotal = document.getElementById('summary-total');
    const summaryRemaining = document.getElementById('summary-remaining');
    if (summaryProduct) summaryProduct.textContent = orderData.productName;
    if (summaryTotal) summaryTotal.textContent = formatPrice(orderData.price);
    if (summaryRemaining) summaryRemaining.textContent = formatPrice(orderData.price - 300);
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

    // Formulaire rendez-vous
    const appointmentForm = document.querySelector('form[data-form="appointment"]');
    if (appointmentForm) {
      appointmentForm.addEventListener('submit', handleAppointmentSubmit);
    }
  }

  /**
   * Gère la soumission du formulaire de commande
   */
  async function handleOrderSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

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

    // Désactiver le bouton
    submitBtn.disabled = true;
    submitBtn.textContent = 'Préparation du paiement...';

    try {
      // Vérifier si Payplug est disponible
      if (typeof MistralPayplug !== 'undefined') {
        // Créer le paiement via Payplug
        const result = await MistralPayplug.createDeposit(customer, {
          gamme: orderData.gamme || orderData.productName,
          taille: orderData.taille,
          prixTotal: orderData.price
        });

        if (result.success && result.paymentUrl) {
          // Sauvegarder les infos de commande en localStorage
          localStorage.setItem('mistral_pending_order', JSON.stringify({
            reference: result.reference,
            customer,
            product: orderData,
            createdAt: new Date().toISOString()
          }));

          // Rediriger vers Payplug
          showMessage('Redirection vers la page de paiement...', 'info');
          setTimeout(() => {
            MistralPayplug.redirectToPayment(result.paymentUrl);
          }, 1000);
        } else {
          throw new Error(result.error || 'Impossible de créer le paiement');
        }

      } else {
        // Fallback : envoyer par email
        await sendOrderByEmail(customer, formData);
      }

    } catch (error) {
      console.error('Erreur commande:', error);
      showMessage(`Erreur: ${error.message}. Nous allons vous envoyer un email de confirmation.`, 'warning');

      // Fallback email
      await sendOrderByEmail(customer, formData);

    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Envoie la commande par email (fallback)
   */
  async function sendOrderByEmail(customer, formData) {
    const message = `
Commande avec acompte - ${orderData.productName}

Prix total: ${formatPrice(orderData.price)}
Acompte: 300 €
Reste à payer: ${formatPrice(orderData.price - 300)}

Adresse: ${formData.get('address')}
Message: ${formData.get('message') || 'Aucun'}
    `.trim();

    try {
      if (typeof MistralEmail !== 'undefined') {
        const result = await MistralEmail.sendContact({
          firstname: customer.firstName,
          lastname: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          message: message,
          type: 'Commande avec acompte'
        });

        if (result.success) {
          showMessage('Votre demande a été envoyée. Nous vous contacterons avec le lien de paiement.', 'success');
        } else {
          throw new Error(result.error);
        }
      } else {
        // Mailto fallback
        const subject = encodeURIComponent(`[Mistral Pans] Commande - ${customer.firstName} ${customer.lastName}`);
        const body = encodeURIComponent(
          `Nom: ${customer.firstName} ${customer.lastName}\n` +
          `Email: ${customer.email}\n` +
          `Téléphone: ${customer.phone}\n\n` +
          message
        );
        window.location.href = `mailto:contact@mistralpans.fr?subject=${subject}&body=${body}`;
        showMessage('Votre client email va s\'ouvrir.', 'info');
      }
    } catch (error) {
      console.error('Erreur envoi email:', error);
      showMessage('Une erreur est survenue. Contactez-nous directement: contact@mistralpans.fr', 'error');
    }
  }

  /**
   * Gère la soumission du formulaire de rendez-vous
   */
  async function handleAppointmentSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    const formData = new FormData(form);

    // Désactiver le bouton
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
      const message = `
Demande de rendez-vous

Préférence de contact: ${formData.get('contact_preference')}
Instrument d'intérêt: ${orderData.productName}

${formData.get('message')}
      `.trim();

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
        // Mailto fallback
        const subject = encodeURIComponent(`[Mistral Pans] Demande RDV - ${formData.get('firstname')} ${formData.get('lastname')}`);
        const body = encodeURIComponent(
          `Nom: ${formData.get('firstname')} ${formData.get('lastname')}\n` +
          `Email: ${formData.get('email')}\n` +
          `Téléphone: ${formData.get('phone')}\n\n` +
          message
        );
        window.location.href = `mailto:contact@mistralpans.fr?subject=${subject}&body=${body}`;
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
   * Vérifie le retour de Payplug
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
    const container = document.querySelector('.order-container') || document.querySelector('main');
    if (!container) return;

    container.innerHTML = `
      <div class="payment-result payment-result--success">
        <div class="payment-result__icon">✓</div>
        <h2>Paiement confirmé !</h2>
        <p>Merci pour votre commande. Votre acompte a bien été enregistré.</p>

        <div class="payment-result__details">
          <p><strong>Référence :</strong> ${reference || 'N/A'}</p>
          ${pendingOrder ? `
            <p><strong>Instrument :</strong> ${pendingOrder.product?.productName || 'Handpan sur mesure'}</p>
            <p><strong>Acompte versé :</strong> 300 €</p>
          ` : ''}
        </div>

        <p>Un email de confirmation vous a été envoyé. Nous vous contacterons prochainement pour la suite.</p>

        <div class="payment-result__actions">
          <a href="index.html" class="btn btn--primary">Retour à l'accueil</a>
        </div>
      </div>
    `;

    // Ajouter les styles si nécessaire
    addPaymentResultStyles();
  }

  /**
   * Affiche le message d'annulation
   */
  function showPaymentCancelled(reference) {
    showMessage(
      'Paiement annulé. Votre commande n\'a pas été validée. Vous pouvez réessayer.',
      'warning'
    );
  }

  /**
   * Affiche le message d'erreur
   */
  function showPaymentError(reference) {
    showMessage(
      'Une erreur est survenue lors du paiement. Contactez-nous si le problème persiste.',
      'error'
    );
  }

  // ============================================================================
  // UTILITAIRES UI
  // ============================================================================

  /**
   * Affiche un message à l'utilisateur
   */
  function showMessage(text, type = 'info') {
    // Supprimer les messages existants
    const existing = document.querySelector('.order-message');
    if (existing) existing.remove();

    const colors = {
      success: '#4A7C59',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#0D7377'
    };

    const message = document.createElement('div');
    message.className = 'order-message';
    message.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 16px 24px;
      background: ${colors[type] || colors.info};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 90%;
      text-align: center;
      animation: slideDown 0.3s ease;
    `;
    message.textContent = text;

    document.body.appendChild(message);

    // Auto-remove après 5 secondes
    setTimeout(() => {
      message.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => message.remove(), 300);
    }, 5000);
  }

  /**
   * Ajoute les styles pour les résultats de paiement
   */
  function addPaymentResultStyles() {
    if (document.getElementById('payment-result-styles')) return;

    const style = document.createElement('style');
    style.id = 'payment-result-styles';
    style.textContent = `
      .payment-result {
        text-align: center;
        padding: 60px 20px;
        max-width: 500px;
        margin: 0 auto;
      }
      .payment-result--success .payment-result__icon {
        width: 80px;
        height: 80px;
        background: #4A7C59;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 40px;
        margin: 0 auto 24px;
      }
      .payment-result h2 {
        color: #4A7C59;
        margin-bottom: 16px;
      }
      .payment-result__details {
        background: #f5f5f5;
        padding: 20px;
        border-radius: 8px;
        margin: 24px 0;
        text-align: left;
      }
      .payment-result__details p {
        margin: 8px 0;
      }
      .payment-result__actions {
        margin-top: 32px;
      }
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================================
  // SÉLECTION D'OPTION (exposé globalement pour onclick)
  // ============================================================================

  window.selectOption = function(option) {
    // Mettre à jour les options visuellement
    document.querySelectorAll('.order-option').forEach(el => {
      el.classList.remove('selected');
      el.setAttribute('aria-selected', 'false');
    });

    const selectedOption = document.querySelector(`[data-option="${option}"]`);
    if (selectedOption) {
      selectedOption.classList.add('selected');
      selectedOption.setAttribute('aria-selected', 'true');
    }

    // Afficher le bon formulaire
    document.querySelectorAll('.order-form').forEach(el => {
      el.classList.remove('active');
    });

    const targetForm = document.getElementById(`form-${option}`);
    if (targetForm) {
      targetForm.classList.add('active');
      // Focus sur le premier champ
      const firstInput = targetForm.querySelector('input:not([type="hidden"])');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
  };

})(window);
