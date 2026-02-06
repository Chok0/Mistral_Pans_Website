/* ==========================================================================
   MISTRAL PANS - Module Payplug Client
   Interface côté client pour les paiements Payplug
   ========================================================================== */

(function(window) {
  'use strict';

  const PAYPLUG_API_URL = '/.netlify/functions/payplug-create-payment';

  // Montants par défaut (en centimes)
  const DEFAULT_DEPOSIT = 30000; // 300€ acompte

  /**
   * Module MistralPayplug
   * Gère les paiements côté client
   */
  const MistralPayplug = {
    /**
     * Créer un paiement d'acompte (300€)
     * @param {Object} customer - Informations client
     * @param {Object} order - Informations commande
     * @returns {Promise<Object>} - URL de paiement
     */
    async createDeposit(customer, order) {
      return this._createPayment({
        amount: DEFAULT_DEPOSIT,
        customer,
        paymentType: 'acompte',
        orderReference: order.reference,
        description: `Acompte commande ${order.reference || 'handpan sur mesure'}`,
        metadata: {
          customerId: order.customerId,
          instrumentId: order.instrumentId,
          orderId: order.orderId,
          gamme: order.gamme,
          taille: order.taille
        }
      });
    },

    /**
     * Créer un paiement de solde
     * @param {Object} customer - Informations client
     * @param {Object} order - Informations commande
     * @param {number} amount - Montant en centimes
     * @returns {Promise<Object>} - URL de paiement
     */
    async createBalance(customer, order, amount) {
      return this._createPayment({
        amount,
        customer,
        paymentType: 'solde',
        orderReference: order.reference,
        description: `Solde commande ${order.reference}`,
        metadata: {
          customerId: order.customerId,
          instrumentId: order.instrumentId,
          orderId: order.orderId
        }
      });
    },

    /**
     * Créer un paiement complet (acompte + solde)
     * @param {Object} customer - Informations client
     * @param {Object} order - Informations commande
     * @param {number} amount - Montant total en centimes
     * @returns {Promise<Object>} - URL de paiement
     */
    async createFullPayment(customer, order, amount) {
      return this._createPayment({
        amount,
        customer,
        paymentType: 'full',
        orderReference: order.reference,
        description: `Paiement commande ${order.reference}`,
        metadata: {
          customerId: order.customerId,
          instrumentId: order.instrumentId,
          orderId: order.orderId,
          gamme: order.gamme,
          taille: order.taille
        }
      });
    },

    /**
     * Créer un paiement en 3x ou 4x (Oney)
     * @param {Object} customer - Informations client
     * @param {Object} order - Informations commande
     * @param {number} amount - Montant total en centimes
     * @param {number} installments - Nombre d'échéances (3 ou 4)
     * @returns {Promise<Object>} - URL de paiement
     */
    async createInstallmentPayment(customer, order, amount, installments = 3) {
      if (![3, 4].includes(installments)) {
        throw new Error('Le paiement en plusieurs fois ne supporte que 3 ou 4 échéances');
      }

      return this._createPayment({
        amount,
        customer,
        paymentType: 'installments',
        orderReference: order.reference,
        description: `Paiement ${installments}x commande ${order.reference}`,
        installments,
        metadata: {
          customerId: order.customerId,
          instrumentId: order.instrumentId,
          orderId: order.orderId,
          gamme: order.gamme,
          taille: order.taille,
          installments
        }
      });
    },

    /**
     * Méthode interne de création de paiement
     * @private
     */
    async _createPayment(options) {
      const {
        amount,
        customer,
        paymentType,
        orderReference,
        description,
        metadata,
        installments
      } = options;

      // Validation client
      if (!customer?.email) {
        throw new Error('Email client requis');
      }
      if (!customer?.firstName || !customer?.lastName) {
        throw new Error('Nom et prénom requis');
      }

      // Validation montant (API PayPlug: min 99 cents, max 2 000 000 cents)
      if (!amount || amount < 99) {
        throw new Error('Montant invalide (minimum 0,99 €)');
      }
      if (amount > 2000000) {
        throw new Error('Montant invalide (maximum 20 000 €)');
      }

      // Construire les URLs de retour
      const baseUrl = window.location.origin;
      const returnUrl = `${baseUrl}/commander.html?status=success&ref=${orderReference || 'new'}`;
      const cancelUrl = `${baseUrl}/commander.html?status=cancelled&ref=${orderReference || 'new'}`;

      try {
        const response = await fetch(PAYPLUG_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount,
            customer: {
              email: customer.email.trim().toLowerCase(),
              firstName: customer.firstName.trim(),
              lastName: customer.lastName.trim(),
              phone: customer.phone || null,
              address: customer.address
                ? {
                    line1: customer.address.line1 || customer.address || null,
                    postalCode: customer.address.postalCode || null,
                    city: customer.address.city || null,
                    country: customer.address.country || 'FR'
                  }
                : null
            },
            paymentType,
            orderReference,
            description,
            metadata,
            returnUrl,
            cancelUrl,
            installments
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || result.details || 'Erreur création paiement');
        }

        return {
          success: true,
          paymentId: result.paymentId,
          paymentUrl: result.paymentUrl,
          reference: result.reference,
          amount: result.amount,
          amountFormatted: result.amountFormatted
        };

      } catch (error) {
        console.error('[MistralPayplug] Erreur:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Rediriger vers la page de paiement Payplug
     * @param {string} paymentUrl - URL de paiement
     */
    redirectToPayment(paymentUrl) {
      if (paymentUrl) {
        window.location.href = paymentUrl;
      }
    },

    /**
     * Ouvrir la page de paiement dans une nouvelle fenêtre
     * @param {string} paymentUrl - URL de paiement
     * @returns {Window} - Référence à la fenêtre ouverte
     */
    openPaymentWindow(paymentUrl) {
      if (paymentUrl) {
        return window.open(paymentUrl, '_blank', 'width=600,height=800');
      }
      return null;
    },

    /**
     * Vérifier le statut du paiement depuis l'URL
     * @returns {Object|null} - { status, reference } ou null
     */
    checkPaymentStatus() {
      const urlParams = new URLSearchParams(window.location.search);
      const status = urlParams.get('status');
      const reference = urlParams.get('ref');

      if (status) {
        return {
          status, // 'success', 'cancelled', 'error'
          reference
        };
      }

      return null;
    },

    /**
     * Nettoyer les paramètres de paiement de l'URL
     */
    clearPaymentParams() {
      const url = new URL(window.location.href);
      url.searchParams.delete('status');
      url.searchParams.delete('ref');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    },

    /**
     * Formater un montant en euros
     * @param {number} amountCents - Montant en centimes
     * @returns {string} - Montant formaté
     */
    formatAmount(amountCents) {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(amountCents / 100);
    },

    /**
     * Convertir euros en centimes
     * @param {number} euros - Montant en euros
     * @returns {number} - Montant en centimes
     */
    eurosToCents(euros) {
      return Math.round(euros * 100);
    }
  };

  // Exposer le module
  window.MistralPayplug = MistralPayplug;

})(window);
