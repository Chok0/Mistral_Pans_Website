/* ==========================================================================
   MISTRAL PANS - Cookie Consent (RGPD)
   Gestion du consentement utilisateur pour les services tiers

   Conforme RGPD : aucun service tiers n'est charge avant consentement
   explicite de l'utilisateur (opt-in). Les cookies essentiels sont
   toujours actifs (fonctionnement du site).

   Flux :
     1. Au chargement, verifie si un consentement existe dans localStorage
     2. Si oui  → applique les choix (charge les services autorises)
     3. Si non  → affiche la banniere modale avec 3 options :
        - "Accepter tout"  → active tous les services
        - "Refuser tout"   → bloque tous les services non essentiels
        - "Personnaliser"  → checkboxes par service, puis "Valider"
     4. Sauvegarde le choix dans localStorage (versionne)
     5. Dispatch l'evenement 'cookieConsentUpdated' pour les autres modules

   Stockage : localStorage cle 'mistral_cookie_consent'
   Format   : { version, timestamp, choices: { essential, analytics, maps, fonts, calendly } }

   Dependances : aucune (auto-initialise, charge avant main.js)
   Utilise par : location.js (maps, calendly), apprendre.html (maps),
                 mistral-stats.js (analytics), main.js (fonts)

   Export : window.MistralCookies
     - isServiceAllowed(name) : verifie si un service est autorise
     - getConsent()           : retourne l'objet consentement complet
     - openSettings()         : rouvre la banniere (reset + reaffichage)
     - SERVICES               : catalogue des services configures
   ========================================================================== */

(function(window) {
  'use strict';

  // ===========================================================================
  //  CONFIGURATION
  // ===========================================================================

  /** @type {string} Cle localStorage pour stocker le consentement */
  const CONSENT_KEY = 'mistral_cookie_consent';

  /**
   * Version du schema de consentement.
   * Si la version stockee ne correspond pas, le consentement est invalide
   * et la banniere est reaffichee (permet de forcer un re-consentement
   * apres ajout/suppression d'un service).
   * @type {string}
   */
  const CONSENT_VERSION = '1.1';

  /**
   * Catalogue des services tiers necessitant un consentement.
   * Chaque service possede :
   *   - name        : libelle affiche dans la banniere
   *   - description : texte explicatif
   *   - required    : (optionnel) si true, toujours actif (non decochable)
   *   - default     : (optionnel) etat par defaut de la checkbox
   *
   * @type {Object.<string, {name: string, description: string, required?: boolean, default?: boolean}>}
   */
  const SERVICES = {
    essential: {
      name: 'Essentiels',
      description: 'Cookies necessaires au fonctionnement du site',
      required: true
    },
    analytics: {
      name: 'Statistiques',
      description: 'Statistiques anonymes de visite (aucune donnee personnelle)',
      default: false
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
    },
    calendly: {
      name: 'Prise de rendez-vous',
      description: 'Calendly (reservation de creneaux)',
      default: false
    }
  };

  // ===========================================================================
  //  LECTURE / ECRITURE DU CONSENTEMENT
  // ===========================================================================

  /**
   * Recupere le consentement stocke dans localStorage.
   * Retourne null si :
   *   - aucun consentement n'est enregistre
   *   - la version ne correspond pas a CONSENT_VERSION (force re-consentement)
   *   - le JSON est corrompu
   *
   * @returns {?{version: string, timestamp: string, choices: Object.<string, boolean>}}
   */
  function getConsent() {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) return null;

      const consent = JSON.parse(stored);
      // Invalide si version differente (ajout/suppression de service)
      if (consent.version !== CONSENT_VERSION) return null;

      return consent;
    } catch (e) {
      return null;
    }
  }

  /**
   * Sauvegarde le consentement dans localStorage.
   * Ajoute automatiquement la version courante et un horodatage ISO 8601
   * (preuve de consentement exigee par le RGPD).
   *
   * @param {Object.<string, boolean>} choices - Choix par service (ex: { essential: true, maps: false })
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
   * Verifie si un service specifique est autorise par l'utilisateur.
   * - Retourne false si aucun consentement n'a ete donne
   * - Retourne toujours true pour les services marques 'required'
   * - Sinon, retourne le choix explicite de l'utilisateur
   *
   * @param {string} serviceName - Cle du service (ex: 'maps', 'fonts', 'calendly')
   * @returns {boolean} true si le service peut etre charge
   */
  function isServiceAllowed(serviceName) {
    const consent = getConsent();
    if (!consent) return false;

    // Les services essentiels sont toujours autorises
    if (SERVICES[serviceName] && SERVICES[serviceName].required) return true;

    return consent.choices[serviceName] === true;
  }

  // ===========================================================================
  //  CHARGEMENT CONDITIONNEL DES SERVICES
  // ===========================================================================

  /**
   * Injecte la feuille de style Google Fonts dans le <head> si :
   *   1. L'utilisateur a consenti au service 'fonts'
   *   2. La feuille n'est pas deja presente (evite les doublons)
   *
   * Polices chargees : Fraunces (display), Inter (body), JetBrains Mono (code)
   */
  function loadGoogleFonts() {
    if (!isServiceAllowed('fonts')) return;

    // Eviter le double-chargement si deja injecte
    if (document.querySelector('link[href*="fonts.googleapis.com"]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter:wght@300..700&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }

  // ===========================================================================
  //  BANNIERE DE CONSENTEMENT (UI)
  // ===========================================================================

  /**
   * Cree et affiche la banniere de consentement RGPD.
   *
   * Si un consentement valide existe deja, applique directement les choix
   * sans afficher la banniere (retour silencieux au chargement de page).
   *
   * La banniere propose 3 actions :
   *   - "Accepter tout"  → tous les services actives
   *   - "Refuser tout"   → seuls les essentiels
   *   - "Personnaliser"  → bascule vers les checkboxes individuelles,
   *                         puis le bouton devient "Valider mes choix"
   *
   * Structure HTML generee :
   *   #cookie-consent-banner.cookie-banner[role="dialog"]
   *     .cookie-banner__content
   *       .cookie-banner__text        (titre + description)
   *       .cookie-banner__options      (checkboxes, masque par defaut)
   *       .cookie-banner__actions      (boutons)
   *       .cookie-banner__legal        (liens mentions legales / CGV)
   *
   * Animation : la classe 'cookie-banner--visible' est ajoutee au prochain
   * frame (requestAnimationFrame) pour declencher la transition CSS.
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

    // --- Construction du DOM de la banniere ---
    const banner = document.createElement('div');
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
      '      <input type="checkbox" id="consent-analytics">',
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
      '    <label class="cookie-option">',
      '      <input type="checkbox" id="consent-calendly">',
      '      <span><strong>Rendez-vous</strong> - Calendly (reservation de creneaux)</span>',
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

    // --- Listeners des 3 boutons ---
    const customizeBtn = document.getElementById('cookie-customize');
    const rejectBtn = document.getElementById('cookie-reject');
    const acceptBtn = document.getElementById('cookie-accept');
    const optionsDiv = document.getElementById('cookie-options');

    /**
     * Bouton "Personnaliser" : double fonction
     *   - 1er clic : affiche les checkboxes, masque Accepter/Refuser,
     *                change le libelle en "Valider mes choix"
     *   - 2e clic  : lit les checkboxes, sauvegarde et ferme
     */
    customizeBtn.addEventListener('click', function() {
      if (optionsDiv.style.display === 'none') {
        // Premier clic : bascule vers le mode personnalisation
        optionsDiv.style.display = 'block';
        customizeBtn.textContent = 'Valider mes choix';
        acceptBtn.style.display = 'none';
        rejectBtn.style.display = 'none';
      } else {
        // Deuxieme clic : lecture des choix et sauvegarde
        const choices = {
          essential: true,
          analytics: document.getElementById('consent-analytics').checked,
          maps: document.getElementById('consent-maps').checked,
          fonts: document.getElementById('consent-fonts').checked,
          calendly: document.getElementById('consent-calendly').checked
        };
        saveConsent(choices);
        applyConsent();
        closeBanner();
      }
    });

    /** Bouton "Refuser tout" : bloque tous les services non essentiels */
    rejectBtn.addEventListener('click', function() {
      const choices = {
        essential: true,
        analytics: false,
        maps: false,
        fonts: false,
        calendly: false
      };
      saveConsent(choices);
      applyConsent();
      closeBanner();
    });

    /** Bouton "Accepter tout" : active tous les services */
    acceptBtn.addEventListener('click', function() {
      const choices = {
        essential: true,
        analytics: true,
        maps: true,
        fonts: true,
        calendly: true
      };
      saveConsent(choices);
      applyConsent();
      closeBanner();
    });

    // Animation d'entree : classe ajoutee au prochain frame pour
    // permettre au navigateur de calculer l'etat initial (transition CSS)
    requestAnimationFrame(function() {
      banner.classList.add('cookie-banner--visible');
    });
  }

  /**
   * Ferme la banniere avec animation de sortie.
   * Retire la classe 'cookie-banner--visible' (declenche la transition CSS),
   * puis supprime l'element du DOM apres 300ms (duree de la transition).
   */
  function closeBanner() {
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) {
      banner.classList.remove('cookie-banner--visible');
      setTimeout(function() {
        banner.remove();
      }, 300); // Synchronise avec la duree de transition CSS
    }
  }

  // ===========================================================================
  //  APPLICATION DU CONSENTEMENT
  // ===========================================================================

  /**
   * Applique le consentement en chargeant les services autorises.
   *
   * Actuellement, seul Google Fonts est charge directement ici.
   * Les autres services (maps, calendly, analytics) ecoutent l'evenement
   * 'cookieConsentUpdated' dispatche sur window et se chargent eux-memes.
   *
   * @fires window#cookieConsentUpdated - CustomEvent avec detail = choices
   */
  function applyConsent() {
    const consent = getConsent();
    if (!consent) return;

    // Chargement conditionnel de Google Fonts
    if (consent.choices.fonts) {
      loadGoogleFonts();
    }

    // Notification globale pour les autres modules
    // (location.js ecoute pour Calendly, apprendre.html pour Leaflet, etc.)
    window.dispatchEvent(new CustomEvent('cookieConsentUpdated', {
      detail: consent.choices
    }));
  }

  // ===========================================================================
  //  REOUVERTURE DES PARAMETRES
  // ===========================================================================

  /**
   * Permet a l'utilisateur de modifier ses choix de cookies.
   * Supprime le consentement existant et reaffiche la banniere.
   * Declenchable via un lien/bouton avec l'attribut [data-cookie-settings].
   */
  function openSettings() {
    localStorage.removeItem(CONSENT_KEY);
    showConsentBanner();
  }

  // ===========================================================================
  //  INITIALISATION
  // ===========================================================================

  /**
   * Point d'entree du module.
   *   - Affiche la banniere (ou applique le consentement existant)
   *   - Enregistre un listener delegue pour les boutons [data-cookie-settings]
   *     (footer, mentions legales, etc.) permettant de rouvrir les parametres
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showConsentBanner);
    } else {
      showConsentBanner();
    }

    // Delegation d'evenement : tout element avec data-cookie-settings
    // ouvre les parametres de cookies (ex: lien dans le footer)
    document.addEventListener('click', function(e) {
      const cookieLink = e.target.closest('[data-cookie-settings]');
      if (cookieLink) {
        e.preventDefault();
        openSettings();
      }
    });
  }

  // ===========================================================================
  //  EXPORT API PUBLIQUE
  // ===========================================================================

  /**
   * API publique exposee sur window.MistralCookies.
   * Permet aux autres modules de verifier le consentement sans acceder
   * directement a localStorage.
   *
   * @namespace MistralCookies
   * @property {function} isServiceAllowed - Verifie si un service est autorise
   * @property {function} getConsent       - Retourne l'objet consentement complet
   * @property {function} openSettings     - Rouvre la banniere de parametrage
   * @property {Object}   SERVICES         - Catalogue des services configures
   */
  window.MistralCookies = {
    isServiceAllowed: isServiceAllowed,
    getConsent: getConsent,
    openSettings: openSettings,
    SERVICES: SERVICES
  };

  // Demarrage automatique (pas besoin d'appel externe)
  init();

})(window);
