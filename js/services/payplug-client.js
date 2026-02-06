/* ==========================================================================
   MISTRAL PANS - Module Payplug Client
   Interface côté client pour les paiements Payplug
   Supporte le mode hébergé (redirection) et le mode intégré (Integrated Payment)
   ========================================================================== */

(function(window) {
  'use strict';

  const PAYPLUG_API_URL = '/.netlify/functions/payplug-create-payment';

  // Montants par défaut (en centimes)
  const DEFAULT_DEPOSIT = 30000; // 300€ acompte

  /**
   * Module MistralPayplug
   * Gère les paiements côté client (hosted + integrated)
   */
  const MistralPayplug = {

    // Instance IntegratedPayment en cours
    _integratedPayment: null,

    /**
     * Créer un paiement d'acompte (300€)
     * @param {Object} customer - Informations client
     * @param {Object} order - Informations commande
     * @param {Object} [options] - Options supplémentaires
     * @param {boolean} [options.integrated] - Utiliser le mode intégré
     * @returns {Promise<Object>} - Résultat du paiement
     */
    async createDeposit(customer, order, options = {}) {
      return this._createPayment({
        amount: DEFAULT_DEPOSIT,
        customer,
        paymentType: 'acompte',
        orderReference: order.reference,
        description: `Acompte commande ${order.reference || 'handpan sur mesure'}`,
        integrated: options.integrated || false,
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
     * @param {Object} [options] - Options supplémentaires
     * @returns {Promise<Object>}
     */
    async createBalance(customer, order, amount, options = {}) {
      return this._createPayment({
        amount,
        customer,
        paymentType: 'solde',
        orderReference: order.reference,
        description: `Solde commande ${order.reference}`,
        integrated: options.integrated || false,
        metadata: {
          customerId: order.customerId,
          instrumentId: order.instrumentId,
          orderId: order.orderId
        }
      });
    },

    /**
     * Créer un paiement complet
     * @param {Object} customer - Informations client
     * @param {Object} order - Informations commande
     * @param {number} amount - Montant total en centimes
     * @param {Object} [options] - Options supplémentaires
     * @returns {Promise<Object>}
     */
    async createFullPayment(customer, order, amount, options = {}) {
      return this._createPayment({
        amount,
        customer,
        paymentType: 'full',
        orderReference: order.reference,
        description: `Paiement commande ${order.reference}`,
        integrated: options.integrated || false,
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
     * Créer un paiement en 3x ou 4x (Oney - hosted uniquement)
     * @param {Object} customer - Informations client
     * @param {Object} order - Informations commande
     * @param {number} amount - Montant total en centimes
     * @param {number} installments - Nombre d'échéances (3 ou 4)
     * @returns {Promise<Object>}
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
        integrated: false, // Oney ne supporte pas l'intégré
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
        installments,
        integrated
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
            installments,
            integrated: integrated || false
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
          amountFormatted: result.amountFormatted,
          integrated: integrated || false
        };

      } catch (error) {
        console.error('[MistralPayplug] Erreur:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    // ========================================================================
    // INTEGRATED PAYMENT - Formulaire de carte embarqué
    // ========================================================================

    /**
     * Vérifie si le SDK Integrated Payment est chargé
     * @returns {boolean}
     */
    isIntegratedAvailable() {
      return typeof Payplug !== 'undefined' && typeof Payplug.IntegratedPayment !== 'undefined';
    },

    /**
     * Initialise le formulaire Integrated Payment
     * @param {Object} containers - Les éléments HTML conteneurs
     * @param {HTMLElement} containers.cardHolder - Conteneur nom du titulaire
     * @param {HTMLElement} containers.cardNumber - Conteneur numéro de carte
     * @param {HTMLElement} containers.expiration - Conteneur date d'expiration
     * @param {HTMLElement} containers.cvv - Conteneur CVV
     * @param {Object} [options] - Options
     * @param {boolean} [options.testMode] - Mode test (défaut: false)
     * @returns {Object} Instance IntegratedPayment
     */
    initIntegratedForm(containers, options = {}) {
      if (!this.isIntegratedAvailable()) {
        throw new Error('SDK PayPlug Integrated Payment non chargé');
      }

      const testMode = options.testMode || false;
      const intPayment = new Payplug.IntegratedPayment(testMode);

      // Style personnalisé Mistral Pans
      const inputStyle = {
        default: {
          color: '#2C2825',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '16px',
          '::placeholder': {
            color: '#9CA3AF'
          },
          ':focus': {
            color: '#2C2825'
          }
        },
        invalid: {
          color: '#EF4444'
        }
      };

      // Créer les champs
      if (containers.cardHolder) {
        intPayment.cardHolder(containers.cardHolder, {
          ...inputStyle,
          placeholder: 'Nom du titulaire de la carte'
        });
      }
      if (containers.cardNumber) {
        intPayment.cardNumber(containers.cardNumber, {
          ...inputStyle,
          placeholder: 'Numéro de carte'
        });
      }
      if (containers.expiration) {
        intPayment.expiration(containers.expiration, {
          ...inputStyle,
          placeholder: 'MM / AAAA'
        });
      }
      if (containers.cvv) {
        intPayment.cvv(containers.cvv, {
          ...inputStyle,
          placeholder: 'CVV'
        });
      }

      // 3DS en lightbox (le client reste sur la page)
      intPayment.setDisplayMode3ds(Payplug.DisplayMode3ds.LIGHTBOX);

      this._integratedPayment = intPayment;
      return intPayment;
    },

    /**
     * Déclenche un paiement intégré
     * @param {string} paymentId - ID du paiement créé via l'API
     * @returns {Promise<Object>} - Résultat du paiement
     */
    payIntegrated(paymentId) {
      return new Promise((resolve, reject) => {
        if (!this._integratedPayment) {
          reject(new Error('Formulaire intégré non initialisé'));
          return;
        }

        const intPayment = this._integratedPayment;

        // Écouter la validation du formulaire
        intPayment.onValidateForm(({ isFormValid }) => {
          if (!isFormValid) {
            reject(new Error('Veuillez vérifier les informations de votre carte'));
            return;
          }

          // Le formulaire est valide, lancer le paiement
          try {
            const triggered = intPayment.pay(
              paymentId,
              Payplug.Scheme.AUTO,
              { save_card: false }
            );

            if (!triggered) {
              reject(new Error('Impossible de lancer le paiement. Vérifiez les informations saisies.'));
            }
          } catch (error) {
            reject(error);
          }
        });

        // Écouter le résultat du paiement
        intPayment.onCompleted((event) => {
          if (event.error) {
            const errorMessages = {
              'FORBIDDEN': 'Fonctionnalité non disponible',
              'NOT_FOUND': 'Paiement introuvable',
              'SERVER_ERROR': 'Erreur serveur PayPlug, veuillez réessayer',
              'INVALID_FORM': 'Informations de carte invalides',
              'ELEMENT_NOT_FOUND': 'Formulaire de paiement incomplet'
            };

            reject(new Error(
              errorMessages[event.error.name] || event.error.message || 'Erreur de paiement'
            ));
            return;
          }

          resolve({
            success: true,
            paymentId: event.token
          });
        });

        // Déclencher la validation (qui lance le paiement si valide)
        intPayment.validateForm();
      });
    },

    /**
     * Récupère les schémas de carte supportés
     * @returns {Array|null}
     */
    getSupportedSchemes() {
      if (!this._integratedPayment) return null;
      return this._integratedPayment.getSupportedSchemes();
    },

    // ========================================================================
    // MODE HÉBERGÉ (redirection)
    // ========================================================================

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

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

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
