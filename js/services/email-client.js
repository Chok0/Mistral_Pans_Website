/* ==========================================================================
   MISTRAL PANS - Module Email Client
   Interface côté client pour l'envoi d'emails via Netlify Function
   ========================================================================== */

(function(window) {
  'use strict';

  const EMAIL_API_URL = '/.netlify/functions/send-email';

  /**
   * Module MistralEmail
   * Gère l'envoi d'emails transactionnels
   */
  const MistralEmail = {
    /**
     * Envoyer un email de contact
     * @param {Object} data - { firstname, lastname, email, phone, message, type }
     * @returns {Promise<Object>} - Résultat de l'envoi
     */
    async sendContact(data) {
      return this._send({
        emailType: 'contact',
        ...data
      });
    },

    /**
     * Envoyer une facture par email
     * @param {Object} client - { email, prenom, nom }
     * @param {Object} facture - { numero, montant_ttc, date_emission, date_echeance }
     * @param {string} [pdfBase64] - PDF en base64 (optionnel)
     * @returns {Promise<Object>} - Résultat de l'envoi
     */
    async sendInvoice(client, facture, pdfBase64 = null) {
      return this._send({
        emailType: 'invoice',
        client,
        facture,
        pdfBase64
      });
    },

    /**
     * Envoyer une confirmation de commande
     * @param {Object} client - { email, prenom, nom }
     * @param {Object} order - { reference, montant, acompte, specifications }
     * @param {Object} [instrument] - { gamme, taille }
     * @returns {Promise<Object>} - Résultat de l'envoi
     */
    async sendOrderConfirmation(client, order, instrument = null) {
      return this._send({
        emailType: 'order_confirmation',
        client,
        order,
        instrument
      });
    },

    /**
     * Envoyer une confirmation de location
     * @param {Object} client - { email, prenom, nom }
     * @param {Object} rental - { loyer, caution, date_debut }
     * @param {Object} [instrument] - { gamme }
     * @returns {Promise<Object>} - Résultat de l'envoi
     */
    async sendRentalConfirmation(client, rental, instrument = null) {
      return this._send({
        emailType: 'rental_confirmation',
        client,
        rental,
        instrument
      });
    },

    /**
     * Envoyer une confirmation de paiement
     * @param {Object} client - { email, prenom, nom }
     * @param {Object} payment - { amount, reference, type }
     * @param {Object} [order] - { reference }
     * @returns {Promise<Object>} - Résultat de l'envoi
     */
    async sendPaymentConfirmation(client, payment, order = null) {
      return this._send({
        emailType: 'payment_confirmation',
        client,
        payment,
        order
      });
    },

    /**
     * Envoyer un rapport comptable mensuel
     * @param {Object} reportData - Donnees du rapport
     * @param {string} reportData.emailDest - Email de destination
     * @param {string} reportData.moisLabel - Label du mois (ex: "Fevrier 2026")
     * @param {string} reportData.mois - Mois format YYYY-MM
     * @param {number} reportData.totalBIC - Total BIC
     * @param {number} reportData.totalBNC - Total BNC
     * @param {number} reportData.totalAvoir - Total avoirs
     * @param {number} reportData.totalCA - Total CA
     * @param {number} reportData.nbFactures - Nombre de factures
     * @param {Array} reportData.factures - Detail des factures
     * @param {Object} reportData.config - Config entreprise (nom, siret)
     * @param {string} [reportData.pdfBase64] - PDF en base64 (optionnel)
     * @returns {Promise<Object>} - Resultat de l'envoi
     */
    async sendMonthlyReport(reportData) {
      return this._send({
        emailType: 'monthly_report',
        ...reportData
      });
    },

    /**
     * Méthode interne d'envoi
     * @private
     */
    async _send(data) {
      try {
        const response = await fetch(EMAIL_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `Erreur HTTP ${response.status}`);
        }

        return {
          success: true,
          messageId: result.messageId,
          message: result.message
        };

      } catch (error) {
        console.error('[MistralEmail] Erreur:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Générer un PDF de facture en base64
     * Utilise MistralPDF si disponible
     * @param {Object} facture - Données de la facture
     * @returns {string|null} - Base64 du PDF ou null
     */
    generateInvoicePdfBase64(facture) {
      if (typeof MistralPDF === 'undefined' || !MistralPDF.generateFacture) {
        return null;
      }

      try {
        const doc = MistralPDF.generateFacture(facture, { download: false });
        if (doc) {
          const dataUri = doc.output('datauristring');
          return dataUri.split(',')[1];
        }
      } catch (error) {
        console.error('[MistralEmail] Erreur génération PDF:', error);
      }

      return null;
    }
  };

  // Exposer le module
  window.MistralEmail = MistralEmail;

})(window);
