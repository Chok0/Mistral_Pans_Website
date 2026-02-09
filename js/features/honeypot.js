/* ==========================================================================
   MISTRAL PANS - Module Honeypot Anti-Spam
   Protection des formulaires sans dépendance externe (RGPD friendly)
   ========================================================================== */

(function(window) {
  'use strict';

  /**
   * Module MistralHoneypot
   * Gère la protection anti-spam via champs honeypot invisibles
   */
  const MistralHoneypot = {
    /**
     * Vérifie si le honeypot a été rempli (= bot détecté)
     * @param {HTMLFormElement} form - Le formulaire à vérifier
     * @returns {boolean} - true si bot détecté, false sinon
     */
    isBot(form) {
      if (!form) return false;
      const honeypot = form.querySelector('[name="website"]');
      return honeypot && honeypot.value.length > 0;
    },

    /**
     * Alias pour isBot (compatibilité)
     */
    isFilled(form) {
      return this.isBot(form);
    },

    /**
     * Génère le HTML du champ honeypot à insérer dans un formulaire
     * @param {string} [id] - ID unique optionnel pour le champ
     * @returns {string} - HTML du champ honeypot
     */
    getFieldHTML(id) {
      const fieldId = id || 'hp-website-' + Math.random().toString(36).substr(2, 9);
      return `
        <div class="form-group" style="position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden;" aria-hidden="true" tabindex="-1">
          <label for="${fieldId}">Site web</label>
          <input type="text" name="website" id="${fieldId}" autocomplete="off" tabindex="-1">
        </div>
      `.trim();
    },

    /**
     * Injecte automatiquement un champ honeypot dans un formulaire
     * @param {HTMLFormElement} form - Le formulaire cible
     */
    inject(form) {
      if (!form) return;

      // Ne pas injecter si déjà présent
      if (form.querySelector('[name="website"]')) return;

      const honeypotDiv = document.createElement('div');
      honeypotDiv.innerHTML = this.getFieldHTML();
      form.insertBefore(honeypotDiv.firstChild, form.firstChild);
    },

    /**
     * Injecte le honeypot dans tous les formulaires de la page
     * @param {string} [selector] - Sélecteur CSS optionnel (défaut: 'form')
     */
    injectAll(selector = 'form') {
      document.querySelectorAll(selector).forEach(form => {
        this.inject(form);
      });
    },

    /**
     * Protège un formulaire avec vérification honeypot
     * @param {HTMLFormElement} form - Le formulaire à protéger
     * @param {Function} onValid - Callback si soumission valide (humain)
     * @param {Function} [onBot] - Callback optionnel si bot détecté
     */
    protect(form, onValid, onBot) {
      if (!form) return;

      // Injecter le honeypot si pas présent
      this.inject(form);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (this.isBot(form)) {

          if (onBot) {
            onBot(form);
          } else {
            // Comportement par défaut : faux message de succès pour tromper le bot
            this._showFakeSuccess(form);
          }
          return;
        }

        // Soumission légitime
        await onValid(form, new FormData(form));
      });
    },

    /**
     * Affiche un faux message de succès pour tromper les bots
     * @private
     */
    _showFakeSuccess(form) {
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        const originalText = submitBtn.textContent || submitBtn.value;
        submitBtn.disabled = true;

        if (submitBtn.tagName === 'BUTTON') {
          submitBtn.textContent = 'Envoyé !';
        } else {
          submitBtn.value = 'Envoyé !';
        }

        // Reset après 3 secondes
        setTimeout(() => {
          submitBtn.disabled = false;
          if (submitBtn.tagName === 'BUTTON') {
            submitBtn.textContent = originalText;
          } else {
            submitBtn.value = originalText;
          }
          form.reset();
        }, 3000);
      }
    }
  };

  // Auto-injection au chargement si attribut data-honeypot présent
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-honeypot]').forEach(form => {
      MistralHoneypot.inject(form);
    });
  });

  // Exposer le module
  window.MistralHoneypot = MistralHoneypot;

})(window);
