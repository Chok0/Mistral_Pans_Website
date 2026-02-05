/* ==========================================================================
   MISTRAL PANS - Cookie Consent (RGPD)
   Gestion du consentement pour les services tiers
   ========================================================================== */

(function(window) {
  'use strict';

  const CONSENT_KEY = 'mistral_cookie_consent';
  const CONSENT_VERSION = '1.0'; // Incrémenter si les services changent

  // Services tiers nécessitant un consentement
  const SERVICES = {
    essential: {
      name: 'Essentiels',
      description: 'Cookies nécessaires au fonctionnement du site',
      required: true
    },
    analytics: {
      name: 'Statistiques',
      description: 'Statistiques anonymes de visite (aucune donnée personnelle)',
      default: true
    },
    maps: {
      name: 'Cartes',
      description: 'Cartes interactives (OpenStreetMap via CARTO)',
      default: false
    },
    fonts: {
      name: 'Polices',
      description: 'Google Fonts (transfert IP vers Google)',
      default: false
    }
  };

  /**
   * Récupère le consentement stocké
   */
  function getConsent() {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) return null;

      const consent = JSON.parse(stored);
      // Vérifier la version
      if (consent.version !== CONSENT_VERSION) return null;

      return consent;
    } catch (e) {
      return null;
    }
  }

  /**
   * Sauvegarde le consentement
   */
  function saveConsent(choices) {
    const consent = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      choices: choices
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  }

  /**
   * Vérifie si un service spécifique est autorisé
   */
  function isServiceAllowed(serviceName) {
    const consent = getConsent();
    if (!consent) return false;

    // Les services essentiels sont toujours autorisés
    if (SERVICES[serviceName]?.required) return true;

    return consent.choices[serviceName] === true;
  }

  /**
   * Charge Google Fonts si autorisé
   */
  function loadGoogleFonts() {
    if (!isServiceAllowed('fonts')) return;

    // Vérifier si déjà chargé
    if (document.querySelector('link[href*="fonts.googleapis.com"]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter:wght@300..700&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }

  /**
   * Crée et affiche la bannière de consentement
   */
  function showConsentBanner() {
    // Ne pas afficher si consentement déjà donné
    if (getConsent()) {
      applyConsent();
      return;
    }

    // Éviter la création de bannières multiples (si script chargé 2 fois)
    if (document.getElementById('cookie-consent-banner')) {
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'cookie-title');
    banner.innerHTML = `
      <div class="cookie-banner__content">
        <div class="cookie-banner__text">
          <h3 id="cookie-title">Respect de votre vie privée</h3>
          <p>
            Ce site utilise des cookies et services tiers pour améliorer votre expérience.
            Vous pouvez choisir les services que vous autorisez.
          </p>
        </div>

        <div class="cookie-banner__options" id="cookie-options" style="display: none;">
          <label class="cookie-option">
            <input type="checkbox" checked disabled>
            <span><strong>Essentiels</strong> - Fonctionnement du site (obligatoire)</span>
          </label>
          <label class="cookie-option">
            <input type="checkbox" id="consent-analytics" checked>
            <span><strong>Statistiques</strong> - Statistiques anonymes de visite</span>
          </label>
          <label class="cookie-option">
            <input type="checkbox" id="consent-maps">
            <span><strong>Cartes</strong> - Cartes interactives (OpenStreetMap)</span>
          </label>
          <label class="cookie-option">
            <input type="checkbox" id="consent-fonts">
            <span><strong>Polices</strong> - Google Fonts (transfert IP vers Google)</span>
          </label>
        </div>

        <div class="cookie-banner__actions">
          <button type="button" class="cookie-btn cookie-btn--secondary" id="cookie-customize">
            Personnaliser
          </button>
          <button type="button" class="cookie-btn cookie-btn--secondary" id="cookie-reject">
            Refuser tout
          </button>
          <button type="button" class="cookie-btn cookie-btn--primary" id="cookie-accept">
            Accepter tout
          </button>
        </div>

        <p class="cookie-banner__legal">
          <a href="mentions-legales.html">Mentions légales</a> -
          <a href="cgv.html">Politique de confidentialité</a>
        </p>
      </div>
    `;

    document.body.appendChild(banner);

    // Event listeners
    const customizeBtn = document.getElementById('cookie-customize');
    const rejectBtn = document.getElementById('cookie-reject');
    const acceptBtn = document.getElementById('cookie-accept');
    const optionsDiv = document.getElementById('cookie-options');

    customizeBtn.addEventListener('click', () => {
      optionsDiv.style.display = optionsDiv.style.display === 'none' ? 'block' : 'none';
      customizeBtn.textContent = optionsDiv.style.display === 'none' ? 'Personnaliser' : 'Valider mes choix';

      if (optionsDiv.style.display === 'block') {
        // Mode personnalisation
        acceptBtn.style.display = 'none';
        rejectBtn.style.display = 'none';
      } else {
        // Valider les choix personnalisés
        const choices = {
          essential: true,
          analytics: document.getElementById('consent-analytics').checked,
          maps: document.getElementById('consent-maps').checked,
          fonts: document.getElementById('consent-fonts').checked
        };
        saveConsent(choices);
        applyConsent();
        closeBanner();
      }
    });

    rejectBtn.addEventListener('click', () => {
      const choices = {
        essential: true,
        analytics: false,
        maps: false,
        fonts: false
      };
      saveConsent(choices);
      applyConsent();
      closeBanner();
    });

    acceptBtn.addEventListener('click', () => {
      const choices = {
        essential: true,
        analytics: true,
        maps: true,
        fonts: true
      };
      saveConsent(choices);
      applyConsent();
      closeBanner();
    });

    // Animation d'entrée
    requestAnimationFrame(() => {
      banner.classList.add('cookie-banner--visible');
    });
  }

  /**
   * Ferme la bannière
   */
  function closeBanner() {
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) {
      banner.classList.remove('cookie-banner--visible');
      setTimeout(() => banner.remove(), 300);
    }
  }

  /**
   * Applique le consentement (charge les services autorisés)
   */
  function applyConsent() {
    const consent = getConsent();
    if (!consent) return;

    // Charger Google Fonts si autorisé
    if (consent.choices.fonts) {
      loadGoogleFonts();
    }

    // Émettre un événement pour les autres scripts
    window.dispatchEvent(new CustomEvent('cookieConsentUpdated', {
      detail: consent.choices
    }));
  }

  /**
   * Permet de rouvrir les paramètres de cookies
   */
  function openSettings() {
    // Supprimer le consentement existant pour reafficher la bannière
    localStorage.removeItem(CONSENT_KEY);
    showConsentBanner();
  }

  // Initialisation
  function init() {
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showConsentBanner);
    } else {
      showConsentBanner();
    }

    // Écouter les clics sur les liens de paramètres cookies
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-cookie-settings]')) {
        e.preventDefault();
        openSettings();
      }
    });
  }

  // Export
  window.MistralCookies = {
    isServiceAllowed,
    getConsent,
    openSettings,
    SERVICES
  };

  // Auto-init
  init();

})(window);
