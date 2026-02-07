/* ==========================================================================
   MISTRAL PANS - Module Swikly Client
   Interface côté client pour la gestion des cautions de location
   ========================================================================== */

(function(window) {
  'use strict';

  const SWIKLY_API_URL = '/.netlify/functions/swikly-create-deposit';

  // Configuration par défaut
  const DEFAULT_RENTAL_DURATION = 3; // mois minimum
  const DEFAULT_MONTHLY_RENT = 60;   // €/mois

  /**
   * Module MistralSwikly
   * Gère les cautions de location côté client
   */
  const MistralSwikly = {
    /**
     * Créer une demande de caution pour une location
     * @param {Object} customer - { email, firstName, lastName, phone }
     * @param {Object} rental - { instrumentValue, instrumentName, duration }
     * @returns {Promise<Object>} - URL de la page de caution
     */
    async createDeposit(customer, rental) {
      // La caution = valeur de l'instrument
      const depositAmount = rental.instrumentValue || 150000; // 1500€ par défaut

      return this._createDeposit({
        amount: depositAmount,
        customer,
        instrumentName: rental.instrumentName || 'Handpan',
        rentalDuration: rental.duration || DEFAULT_RENTAL_DURATION,
        metadata: {
          instrumentId: rental.instrumentId,
          monthlyRent: DEFAULT_MONTHLY_RENT
        }
      });
    },

    /**
     * Méthode interne de création de caution
     * @private
     */
    async _createDeposit(options) {
      // Prevent concurrent deposit requests
      if (this._depositInProgress) {
        throw new Error('Une demande de caution est déjà en cours');
      }
      this._depositInProgress = true;

      const {
        amount,
        customer,
        instrumentName,
        rentalDuration,
        metadata
      } = options;

      // Validation client
      if (!customer?.email) {
        throw new Error('Email client requis');
      }
      if (!customer?.firstName || !customer?.lastName) {
        throw new Error('Nom et prénom requis');
      }

      // Validation montant
      if (!amount || amount < 10000) { // Minimum 100€
        throw new Error('Montant de caution invalide (minimum 100€)');
      }

      try {
        const response = await fetch(SWIKLY_API_URL, {
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
              phone: customer.phone || null
            },
            instrumentName,
            rentalDuration,
            metadata
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || result.details || 'Erreur création caution');
        }

        return {
          success: true,
          depositId: result.depositId,
          depositUrl: result.depositUrl,
          reference: result.reference,
          amount: result.amount,
          amountFormatted: result.amountFormatted
        };

      } catch (error) {
        console.error('[MistralSwikly] Erreur:', error);
        return {
          success: false,
          error: error.message
        };
      } finally {
        this._depositInProgress = false;
      }
    },

    /**
     * Rediriger vers la page de caution Swikly
     * @param {string} depositUrl - URL de la page de caution
     */
    redirectToDeposit(depositUrl) {
      if (depositUrl) {
        window.location.href = depositUrl;
      }
    },

    /**
     * Ouvrir la page de caution dans une nouvelle fenêtre
     * @param {string} depositUrl - URL de la page de caution
     * @returns {Window} - Référence à la fenêtre ouverte
     */
    openDepositWindow(depositUrl) {
      if (depositUrl) {
        return window.open(depositUrl, '_blank', 'width=600,height=800');
      }
      return null;
    },

    /**
     * Vérifier le statut de la caution depuis l'URL
     * @returns {Object|null} - { status, reference } ou null
     */
    checkDepositStatus() {
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
     * Nettoyer les paramètres de caution de l'URL
     */
    clearDepositParams() {
      const url = new URL(window.location.href);
      url.searchParams.delete('status');
      url.searchParams.delete('ref');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    },

    /**
     * Calculer le loyer mensuel
     * @returns {number} - Loyer en euros
     */
    getMonthlyRent() {
      return DEFAULT_MONTHLY_RENT;
    },

    /**
     * Calculer le crédit location (50% du loyer déductible à l'achat)
     * @param {number} monthsRented - Nombre de mois de location
     * @returns {number} - Crédit en euros
     */
    calculateRentalCredit(monthsRented) {
      return Math.floor(monthsRented * DEFAULT_MONTHLY_RENT * 0.5);
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
  window.MistralSwikly = MistralSwikly;

})(window);
