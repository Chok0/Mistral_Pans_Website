/* ==========================================================================
   MISTRAL PANS - Shared Utilities (utils.js)
   Helpers partages : formatage, echappement, validation, etc.
   Charge avant tous les autres modules applicatifs.
   ========================================================================== */

(function (window) {
  'use strict';

  // ==========================================================================
  // FORMATTING
  // ==========================================================================

  /**
   * Formate une date en francais (ex: "14 février 2026")
   * @param {string|Date} dateString
   * @param {Intl.DateTimeFormatOptions} [options] - surcharge (ex: { month: 'short' })
   * @returns {string}
   */
  function formatDate(dateString, options) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const defaults = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('fr-FR', Object.assign({}, defaults, options || {}));
  }

  /**
   * Formate une date courte (JJ/MM/AAAA)
   * @param {string|Date} dateString
   * @returns {string}
   */
  function formatDateShort(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR');
  }

  /**
   * Formate un prix en euros (ex: "1 250 €")
   * @param {number} price
   * @returns {string}
   */
  function formatPrice(price) {
    if (price === null || price === undefined) return '0 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(price);
  }

  /**
   * Formate un prix avec decimales (ex: "1 250,00")
   * @param {number} price
   * @returns {string}
   */
  function formatPriceRaw(price) {
    if (price === null || price === undefined) return '0,00';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  }

  /**
   * Parse une chaine prix en nombre (ex: "1 250,50 €" → 1250.5)
   * @param {string|number} str
   * @returns {number}
   */
  function parsePrice(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    return parseFloat(str.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
  }

  // ==========================================================================
  // SECURITY / ESCAPING
  // ==========================================================================

  /**
   * Echappe le HTML pour eviter les injections XSS
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Sanitize HTML — garde les balises sures, supprime les dangereuses.
   * Pour le contenu WYSIWYG (blog, descriptions).
   * @param {string} html
   * @returns {string}
   */
  // Configuration DOMPurify partagee (meme whitelist que l'ancienne implementation)
  const SANITIZE_CONFIG = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'img',
      'figure', 'figcaption', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'target', 'rel',      // a
      'src', 'alt', 'width', 'height',        // img
      'class', 'style'                         // global
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false
  };

  /**
   * Sanitise du HTML WYSIWYG via DOMPurify (avec fallback DOMParser).
   * Utilise DOMPurify si charge, sinon tombe sur un nettoyage basique.
   * @param {string} html
   * @returns {string}
   */
  function sanitizeHtml(html) {
    if (!html) return '';

    // DOMPurify disponible → utiliser directement
    if (window.DOMPurify) {
      return DOMPurify.sanitize(html, SANITIZE_CONFIG);
    }

    // Fallback : nettoyage basique via DOMParser (meme logique que l'ancienne implementation)
    const allowedTags = SANITIZE_CONFIG.ALLOWED_TAGS;
    const allowedAttrsByTag = {
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class', 'style']
    };

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body;

    body.querySelectorAll('script, style, iframe, object, embed, form, input, textarea, button')
      .forEach(function (el) { el.remove(); });

    body.querySelectorAll('*').forEach(function (el) {
      const tagName = el.tagName.toLowerCase();

      if (!allowedTags.includes(tagName)) {
        el.replaceWith.apply(el, Array.from(el.childNodes));
        return;
      }

      Array.from(el.attributes).forEach(function (attr) {
        const attrName = attr.name.toLowerCase();
        if (attrName.startsWith('on')) { el.removeAttribute(attr.name); return; }

        const tagAllowed = allowedAttrsByTag[tagName] || [];
        const globalAllowed = allowedAttrsByTag['*'] || [];
        if (!tagAllowed.includes(attrName) && !globalAllowed.includes(attrName)) {
          el.removeAttribute(attr.name);
          return;
        }

        if (attrName === 'href' || attrName === 'src') {
          let value;
          try { value = decodeURIComponent(attr.value); } catch (e) { value = attr.value; }
          const normalized = value.replace(/[\s\x00-\x1f]/g, '').toLowerCase();
          if (/^(javascript|data|vbscript|blob):/.test(normalized)) {
            el.removeAttribute(attr.name);
          }
        }

        if (attrName === 'style') {
          const cleanStyle = attr.value
            .replace(/expression\s*\(/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/behavior\s*:/gi, '')
            .replace(/-moz-binding\s*:/gi, '')
            .replace(/url\s*\(/gi, '')
            .replace(/@import/gi, '');
          el.setAttribute('style', cleanStyle);
        }
      });

      if (tagName === 'a' && el.getAttribute('target') === '_blank') {
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });

    return body.innerHTML;
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Verifie qu'une valeur n'est ni null, ni vide, ni "null"
   * @param {*} val
   * @returns {boolean}
   */
  function hasValue(val) {
    return val !== null && val !== undefined && val !== '' && val !== 'null' && String(val).trim() !== '';
  }

  /**
   * Valide un email
   * @param {string} email
   * @returns {boolean}
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Valide une date ISO (YYYY-MM-DD)
   * @param {string} str
   * @returns {boolean}
   */
  function isValidDate(str) {
    return /^\d{4}-\d{2}-\d{2}/.test(str) && !isNaN(new Date(str).getTime());
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Genere un ID unique avec prefixe
   * @param {string} [prefix='id']
   * @returns {string}
   */
  function generateId(prefix) {
    prefix = prefix || 'id';
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Debounce une fonction
   * @param {Function} func
   * @param {number} wait - delai en ms
   * @returns {Function}
   */
  function debounce(func, wait) {
    let timeout;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        func.apply(context, args);
      }, wait);
    };
  }

  // ==========================================================================
  // LAZY LOADING
  // ==========================================================================

  /** Cache des scripts/styles deja charges (Map<src, Promise>) */
  const _loadCache = new Map();

  /**
   * Charge un script JS dynamiquement (une seule fois grace au cache).
   * @param {string} src - URL du script
   * @returns {Promise<void>}
   */
  function loadScript(src) {
    if (_loadCache.has(src)) return _loadCache.get(src);
    const p = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Echec chargement : ' + src)); };
      document.head.appendChild(script);
    });
    _loadCache.set(src, p);
    return p;
  }

  /**
   * Charge une feuille de style CSS dynamiquement (une seule fois).
   * @param {string} href - URL du CSS
   * @returns {Promise<void>}
   */
  function loadStylesheet(href) {
    if (_loadCache.has(href)) return _loadCache.get(href);
    const p = new Promise(function (resolve, reject) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = function () { reject(new Error('Echec chargement CSS : ' + href)); };
      document.head.appendChild(link);
    });
    _loadCache.set(href, p);
    return p;
  }

  // ==========================================================================
  // TARIFS PUBLICS (lecture cross-contexte)
  // ==========================================================================

  /** Defaults utilises si ni Supabase ni MistralGestion ne sont disponibles */
  var TARIFS_DEFAULTS = {
    prixParNote: 115,
    bonusOctave2: 50,
    bonusBottoms: 25,
    malusDifficulteWarning: 5,
    malusDifficulteDifficile: 10,
    loyerMensuel: 60,
    montantCaution: 1150,
    fraisDossierTransport: 100,
    fraisExpeditionColissimo: 50,
    tauxAcompte: 30,
    creditFidelitePourcent: 50
  };

  /**
   * Retourne les tarifs publics, quelque soit le contexte :
   * 1. namespace=configurateur (public, via MistralSync) — pages publiques
   * 2. MistralGestion.getConfig() — admin panel
   * 3. Defaults hardcodes — fallback ultime
   *
   * @returns {Object} Tarifs avec toutes les cles garanties
   */
  function getTarifsPublics() {
    // 1. Essayer MistralSync namespace=configurateur (cle tarifs_publics)
    if (window.MistralSync && MistralSync.hasKey('mistral_tarifs_publics')) {
      var pub = MistralSync.getData('mistral_tarifs_publics');
      if (pub && pub.tarifs_publics) {
        // tarifs_publics est un objet JSON stocke comme valeur de la cle
        var tarifs = pub.tarifs_publics;
        if (typeof tarifs === 'string') {
          try { tarifs = JSON.parse(tarifs); } catch (e) { tarifs = {}; }
        }
        return Object.assign({}, TARIFS_DEFAULTS, tarifs);
      }
    }
    // 2. Fallback MistralGestion (admin connecte ou namespace gestion accessible)
    if (typeof MistralGestion !== 'undefined' && MistralGestion.getConfig) {
      var config = MistralGestion.getConfig();
      if (config && config.prixParNote != null) {
        return Object.assign({}, TARIFS_DEFAULTS, config);
      }
    }
    // 3. Defaults
    return Object.assign({}, TARIFS_DEFAULTS);
  }

  // ==========================================================================
  // EXPORT
  // ==========================================================================

  window.MistralUtils = {
    // Formatting
    formatDate: formatDate,
    formatDateShort: formatDateShort,
    formatPrice: formatPrice,
    formatPriceRaw: formatPriceRaw,
    parsePrice: parsePrice,

    // Security
    escapeHtml: escapeHtml,
    sanitizeHtml: sanitizeHtml,

    // Validation
    hasValue: hasValue,
    isValidEmail: isValidEmail,
    isValidDate: isValidDate,

    // Helpers
    generateId: generateId,
    debounce: debounce,
    loadScript: loadScript,
    loadStylesheet: loadStylesheet,

    // Tarifs
    getTarifsPublics: getTarifsPublics
  };

})(window);
