/* ==========================================================================
   MISTRAL PANS - Cookie Consent (RGPD)
   Gestion du consentement pour les services tiers
   ========================================================================== */

(function(window) {
  'use strict';

  const CONSENT_KEY = 'mistral_cookie_consent';
  const CONSENT_VERSION = '1.0';

  // Services tiers necessitant un consentement
  const SERVICES = {
    essential: {
      name: 'Essentiels',
      description: 'Cookies necessaires au fonctionnement du site',
      required: true
    },
    analytics: {
      name: 'Statistiques',
      description: 'Statistiques anonymes de visite (aucune donnee personnelle)',
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
   * Recupere le consentement stocke
   */
  function getConsent() {
    try {
      var stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) return null;

      var consent = JSON.parse(stored);
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
    var consent = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      choices: choices
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  }

  /**
   * Verifie si un service specifique est autorise
   */
  function isServiceAllowed(serviceName) {
    var consent = getConsent();
    if (!consent) return false;

    if (SERVICES[serviceName] && SERVICES[serviceName].required) return true;

    return consent.choices[serviceName] === true;
  }

  /**
   * Charge Google Fonts si autorise
   */
  function loadGoogleFonts() {
    if (!isServiceAllowed('fonts')) return;

    if (document.querySelector('link[href*="fonts.googleapis.com"]')) return;

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter:wght@300..700&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }

  /**
   * Cree et affiche la banniere de consentement
   */
  function showConsentBanner() {
    // Ne pas afficher si consentement deja donne
    if (getConsent()) {
      applyConsent();
      return;
    }

    // Eviter la creation de bannieres multiples (si script charge 2 fois)
    if (document.getElementById('cookie-consent-banner')) {
      return;
    }

    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'cookie-title');
    banner.innerHTML = [
      '<div class="cookie-banner__content">',
      '  <div class="cookie-banner__text">',
      '    <h3 id="cookie-title">Respect de votre vie privee</h3>',
      '    <p>',
      '      Ce site utilise des cookies et services tiers pour ameliorer votre experience.',
      '      Vous pouvez choisir les services que vous autorisez.',
      '    </p>',
      '  </div>',
      '',
      '  <div class="cookie-banner__options" id="cookie-options" style="display: none;">',
      '    <label class="cookie-option">',
      '      <input type="checkbox" checked disabled>',
      '      <span><strong>Essentiels</strong> - Fonctionnement du site (obligatoire)</span>',
      '    </label>',
      '    <label class="cookie-option">',
      '      <input type="checkbox" id="consent-analytics" checked>',
      '      <span><strong>Statistiques</strong> - Statistiques anonymes de visite</span>',
      '    </label>',
      '    <label class="cookie-option">',
      '      <input type="checkbox" id="consent-maps">',
      '      <span><strong>Cartes</strong> - Cartes interactives (OpenStreetMap)</span>',
      '    </label>',
      '    <label class="cookie-option">',
      '      <input type="checkbox" id="consent-fonts">',
      '      <span><strong>Polices</strong> - Google Fonts (transfert IP vers Google)</span>',
      '    </label>',
      '  </div>',
      '',
      '  <div class="cookie-banner__actions">',
      '    <button type="button" class="cookie-btn cookie-btn--secondary" id="cookie-customize">',
      '      Personnaliser',
      '    </button>',
      '    <button type="button" class="cookie-btn cookie-btn--secondary" id="cookie-reject">',
      '      Refuser tout',
      '    </button>',
      '    <button type="button" class="cookie-btn cookie-btn--primary" id="cookie-accept">',
      '      Accepter tout',
      '    </button>',
      '  </div>',
      '',
      '  <p class="cookie-banner__legal">',
      '    <a href="mentions-legales.html">Mentions legales</a> -',
      '    <a href="cgv.html">Politique de confidentialite</a>',
      '  </p>',
      '</div>'
    ].join('\n');

    document.body.appendChild(banner);

    // Event listeners
    var customizeBtn = document.getElementById('cookie-customize');
    var rejectBtn = document.getElementById('cookie-reject');
    var acceptBtn = document.getElementById('cookie-accept');
    var optionsDiv = document.getElementById('cookie-options');

    customizeBtn.addEventListener('click', function() {
      if (optionsDiv.style.display === 'none') {
        optionsDiv.style.display = 'block';
        customizeBtn.textContent = 'Valider mes choix';
        acceptBtn.style.display = 'none';
        rejectBtn.style.display = 'none';
      } else {
        var choices = {
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

    rejectBtn.addEventListener('click', function() {
      var choices = {
        essential: true,
        analytics: false,
        maps: false,
        fonts: false
      };
      saveConsent(choices);
      applyConsent();
      closeBanner();
    });

    acceptBtn.addEventListener('click', function() {
      var choices = {
        essential: true,
        analytics: true,
        maps: true,
        fonts: true
      };
      saveConsent(choices);
      applyConsent();
      closeBanner();
    });

    // Animation d'entree
    requestAnimationFrame(function() {
      banner.classList.add('cookie-banner--visible');
    });
  }

  /**
   * Ferme la banniere
   */
  function closeBanner() {
    var banner = document.getElementById('cookie-consent-banner');
    if (banner) {
      banner.classList.remove('cookie-banner--visible');
      setTimeout(function() {
        banner.remove();
      }, 300);
    }
  }

  /**
   * Applique le consentement (charge les services autorises)
   */
  function applyConsent() {
    var consent = getConsent();
    if (!consent) return;

    if (consent.choices.fonts) {
      loadGoogleFonts();
    }

    window.dispatchEvent(new CustomEvent('cookieConsentUpdated', {
      detail: consent.choices
    }));
  }

  /**
   * Permet de rouvrir les parametres de cookies
   */
  function openSettings() {
    localStorage.removeItem(CONSENT_KEY);
    showConsentBanner();
  }

  /**
   * Initialisation
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showConsentBanner);
    } else {
      showConsentBanner();
    }

    document.addEventListener('click', function(e) {
      if (e.target.matches('[data-cookie-settings]')) {
        e.preventDefault();
        openSettings();
      }
    });
  }

  // Export API
  window.MistralCookies = {
    isServiceAllowed: isServiceAllowed,
    getConsent: getConsent,
    openSettings: openSettings,
    SERVICES: SERVICES
  };

  // Auto-init
  init();

})(window);
