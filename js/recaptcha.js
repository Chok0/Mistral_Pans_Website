/* ==========================================================================
   MISTRAL PANS - Module reCAPTCHA v3
   Protection anti-spam des formulaires
   ========================================================================== */

(function(window) {
  'use strict';

  // Configuration
  let SITE_KEY = null;
  let isLoaded = false;
  let loadPromise = null;

  /**
   * Module MistralRecaptcha
   * Gère l'intégration reCAPTCHA v3
   */
  const MistralRecaptcha = {
    /**
     * Initialise reCAPTCHA avec la clé du site
     * @param {string} siteKey - Clé publique reCAPTCHA
     */
    init(siteKey) {
      if (!siteKey || siteKey === 'YOUR_RECAPTCHA_SITE_KEY') {
        console.warn('[MistralRecaptcha] Clé reCAPTCHA non configurée');
        return;
      }

      SITE_KEY = siteKey;
      this._loadScript();
    },

    /**
     * Charge le script reCAPTCHA de manière asynchrone
     * @private
     */
    _loadScript() {
      if (loadPromise) return loadPromise;

      loadPromise = new Promise((resolve, reject) => {
        // Vérifier si déjà chargé
        if (window.grecaptcha && window.grecaptcha.ready) {
          isLoaded = true;
          resolve();
          return;
        }

        // Créer le script
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          window.grecaptcha.ready(() => {
            isLoaded = true;
            console.log('[MistralRecaptcha] Chargé avec succès');
            resolve();
          });
        };

        script.onerror = () => {
          console.error('[MistralRecaptcha] Erreur de chargement');
          reject(new Error('Erreur chargement reCAPTCHA'));
        };

        document.head.appendChild(script);
      });

      return loadPromise;
    },

    /**
     * Vérifie si reCAPTCHA est prêt
     * @returns {boolean}
     */
    isReady() {
      return isLoaded && SITE_KEY && window.grecaptcha;
    },

    /**
     * Obtient un token reCAPTCHA pour une action
     * @param {string} action - Nom de l'action (ex: 'contact', 'order', 'rental')
     * @returns {Promise<string|null>} - Token reCAPTCHA ou null si non disponible
     */
    async getToken(action = 'submit') {
      if (!this.isReady()) {
        console.warn('[MistralRecaptcha] Non initialisé, skip verification');
        return null;
      }

      try {
        const token = await window.grecaptcha.execute(SITE_KEY, { action });
        return token;
      } catch (error) {
        console.error('[MistralRecaptcha] Erreur obtention token:', error);
        return null;
      }
    },

    /**
     * Protège un formulaire avec reCAPTCHA
     * @param {HTMLFormElement} form - Le formulaire à protéger
     * @param {string} action - Nom de l'action
     * @param {Function} onSubmit - Callback appelé avec (formData, recaptchaToken)
     */
    protectForm(form, action, onSubmit) {
      if (!form) return;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Obtenir le token reCAPTCHA
        const token = await this.getToken(action);

        // Collecter les données du formulaire
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Ajouter le token
        data.recaptchaToken = token;

        // Appeler le callback
        await onSubmit(data, token);
      });
    },

    /**
     * Vérifie un token côté serveur
     * @param {string} token - Token reCAPTCHA
     * @param {string} action - Action attendue
     * @returns {Promise<Object>} - { success, score, action }
     */
    async verifyToken(token, action) {
      if (!token) {
        return { success: false, error: 'Token manquant' };
      }

      try {
        const response = await fetch('/.netlify/functions/verify-recaptcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, expectedAction: action })
        });

        const result = await response.json();
        return result;

      } catch (error) {
        console.error('[MistralRecaptcha] Erreur vérification:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * Masque le badge reCAPTCHA (avec mention légale obligatoire)
     * Note: Google requiert une mention dans les CGU si le badge est masqué
     */
    hideBadge() {
      const style = document.createElement('style');
      style.textContent = '.grecaptcha-badge { visibility: hidden; }';
      document.head.appendChild(style);
    }
  };

  // Auto-initialisation si la clé est dans une variable globale
  document.addEventListener('DOMContentLoaded', () => {
    const siteKey = window.RECAPTCHA_SITE_KEY ||
                    document.querySelector('meta[name="recaptcha-site-key"]')?.content;

    if (siteKey) {
      MistralRecaptcha.init(siteKey);
    }
  });

  // Exposer le module
  window.MistralRecaptcha = MistralRecaptcha;

})(window);
