/* ==========================================================================
   MISTRAL PANS - Admin Event Delegation Engine
   Remplace tous les inline handlers (onclick, onchange, etc.) par de la
   delegation d'evenements via data-action.
   ========================================================================== */

(function(window) {
  'use strict';

  // ============================================================================
  // REGISTRE DES ACTIONS
  // ============================================================================

  const ACTION_HANDLERS = {};

  /**
   * Enregistre une action explicite.
   * @param {string} name  - Nom kebab-case (ex: 'close-modal')
   * @param {Function} handler - function(el, event)
   */
  function registerAction(name, handler) {
    ACTION_HANDLERS[name] = handler;
  }

  // ============================================================================
  // REGISTRE DES NAMESPACES
  // ============================================================================

  const NAMESPACES = {
    'AdminUI':        () => window.AdminUI,
    'BlogAdmin':      () => window.BlogAdmin,
    'ApprendreAdmin': () => window.ApprendreAdmin,
    'GalerieAdmin':   () => window.GalerieAdmin,
    'GaleriePublic':  () => window.GaleriePublic,
    'BoutiqueAdmin':  () => window.BoutiqueAdmin,
    'MistralAdmin':   () => window.MistralAdmin,
    'MistralStats':   () => window.MistralStats,
    'VendorCheck':    () => window.VendorCheck
  };

  // ============================================================================
  // UTILITAIRES
  // ============================================================================

  /** kebab-case → camelCase */
  function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, function(_, c) { return c.toUpperCase(); });
  }

  // ============================================================================
  // RESOLUTION DE HANDLER
  // ============================================================================

  /**
   * Resout un handler pour un data-action donne.
   * 1. Verifie le registre explicite
   * 2. Auto-resolve: kebab→camel sur le namespace
   */
  function resolveHandler(actionName, el) {
    // 1. Registre explicite
    if (ACTION_HANDLERS[actionName]) {
      return ACTION_HANDLERS[actionName];
    }

    // 2. Auto-resolve sur namespace
    var ns = el.dataset.ns || 'AdminUI';
    var nsGetter = NAMESPACES[ns];
    if (!nsGetter) {
      console.warn('[Delegation] Namespace inconnu:', ns);
      return null;
    }
    var target = nsGetter();
    if (!target) {
      console.warn('[Delegation] Namespace non charge:', ns);
      return null;
    }

    var fnName = kebabToCamel(actionName);
    if (typeof target[fnName] === 'function') {
      return function(el, event) {
        var id = el.dataset.id;
        var param = el.dataset.param;
        if (id) {
          target[fnName](id);
        } else if (param) {
          target[fnName](param);
        } else {
          target[fnName]();
        }
      };
    }

    console.warn('[Delegation] Pas de handler pour action:', actionName, 'sur', ns);
    return null;
  }

  // ============================================================================
  // LISTENERS DELEGUES
  // ============================================================================

  function handleEvent(eventType, e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;

    var declaredOn = el.dataset.on || 'click';
    var eventTypes = declaredOn.split(/\s+/);
    if (eventTypes.indexOf(eventType) === -1) return;

    var actionName = el.dataset.action;
    var handler = resolveHandler(actionName, el);
    if (handler) {
      handler(el, e);
    }
  }

  document.addEventListener('click', function(e) { handleEvent('click', e); });
  document.addEventListener('change', function(e) { handleEvent('change', e); });
  document.addEventListener('input', function(e) { handleEvent('input', e); });
  document.addEventListener('keypress', function(e) { handleEvent('keypress', e); });
  document.addEventListener('focus', function(e) { handleEvent('focus', e); }, true); // focus needs capture
  document.addEventListener('submit', function(e) { handleEvent('submit', e); });

  // ============================================================================
  // ACTIONS EXPLICITES — Modals
  // ============================================================================

  // No-op : ces actions sont gerees par addEventListener direct dans Confirm.show()
  // On les enregistre pour eviter le warning "[Delegation] Pas de handler"
  registerAction('confirm', function() {});
  registerAction('cancel', function() {});
  registerAction('stop-propagation', function(el, e) { e.stopPropagation(); });

  registerAction('close-modal', function(el) {
    var name = el.dataset.param;
    if (window.AdminUI && window.AdminUI.closeModal) window.AdminUI.closeModal(name);
  });

  registerAction('show-modal', function(el) {
    var name = el.dataset.param;
    if (window.AdminUI && window.AdminUI.showModal) window.AdminUI.showModal(name);
  });

  registerAction('modal-close', function(el) {
    var name = el.dataset.param;
    if (window.MistralAdmin && window.MistralAdmin.Modal) window.MistralAdmin.Modal.close(name);
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Navigation
  // ============================================================================

  registerAction('go-to-tab', function(el) {
    var section = el.dataset.param;
    if (window.AdminUI && window.AdminUI.goToTab) window.AdminUI.goToTab(section);
  });

  registerAction('toggle-config-section', function(el) {
    var section = el.dataset.param;
    if (window.AdminUI && window.AdminUI.toggleConfigSection) window.AdminUI.toggleConfigSection(section);
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Todo
  // ============================================================================

  registerAction('add-todo-on-enter', function(el, e) {
    if (e.key === 'Enter' && window.AdminUI) window.AdminUI.addTodo();
  });

  registerAction('toggle-todo', function(el) {
    var index = parseInt(el.dataset.param, 10);
    if (window.AdminUI) window.AdminUI.toggleTodo(index);
  });

  registerAction('delete-todo', function(el) {
    var index = parseInt(el.dataset.param, 10);
    if (window.AdminUI) window.AdminUI.deleteTodo(index);
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Recherche (passent el.value)
  // ============================================================================

  registerAction('search-clients', function(el) {
    if (window.AdminUI && window.AdminUI.searchClients) window.AdminUI.searchClients(el.value);
  });

  registerAction('search-instruments', function(el) {
    if (window.AdminUI && window.AdminUI.searchInstruments) window.AdminUI.searchInstruments(el.value);
  });

  registerAction('filter-gamme-dropdown', function(el) {
    if (window.AdminUI && window.AdminUI.filterGammeDropdown) window.AdminUI.filterGammeDropdown(el.value);
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Factures
  // ============================================================================

  registerAction('update-facture-totaux', function() {
    if (window.AdminUI && window.AdminUI.updateFactureTotaux) window.AdminUI.updateFactureTotaux();
  });

  registerAction('remove-facture-ligne-and-recalc', function(el) {
    var ligne = el.closest('.facture-ligne');
    if (ligne) ligne.remove();
    if (window.AdminUI && window.AdminUI.updateFactureTotaux) window.AdminUI.updateFactureTotaux();
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Config
  // ============================================================================

  registerAction('on-email-toggle', function(el) {
    var key = el.dataset.param;
    if (window.AdminUI && window.AdminUI.onEmailToggle) window.AdminUI.onEmailToggle(key, el.checked);
  });

  registerAction('validate-pattern', function(el) {
    var n = parseInt(el.dataset.param, 10);
    if (window.AdminUI && window.AdminUI.validatePattern) window.AdminUI.validatePattern(n);
  });

  registerAction('clear-pattern', function(el) {
    var n = parseInt(el.dataset.param, 10);
    var input = document.getElementById('gamme-pattern-' + n);
    if (input) input.value = '';
    if (window.AdminUI && window.AdminUI.validatePattern) window.AdminUI.validatePattern(n);
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Import/Export
  // ============================================================================

  registerAction('trigger-import-file', function() {
    var input = document.getElementById('import-file');
    if (input) input.click();
  });

  registerAction('import-data-from-file', function(el) {
    if (el.files && el.files[0] && window.AdminUI && window.AdminUI.importData) {
      window.AdminUI.importData(el.files[0]);
    }
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Statistics
  // ============================================================================

  registerAction('stats-period-change', function() {
    if (window.AdminUI && window.AdminUI.renderAnalytics) window.AdminUI.renderAnalytics();
  });

  registerAction('export-stats-json', function() {
    if (!window.MistralStats || !window.MistralStats.Export) return;
    var filename = 'mistral-stats-' + new Date().toISOString().split('T')[0] + '.json';
    window.MistralStats.Export.download(filename, window.MistralStats.Export.toJSON());
  });

  registerAction('export-stats-csv', function(el) {
    if (!window.MistralStats || !window.MistralStats.Export) return;
    var days = parseInt(el.dataset.param || '30', 10);
    var filename = 'mistral-stats-' + new Date().toISOString().split('T')[0] + '.csv';
    window.MistralStats.Export.download(filename, window.MistralStats.Export.toCSV(days), 'text/csv');
  });

  registerAction('clear-stats-confirm', function() {
    if (confirm('Effacer toutes les statistiques ?')) {
      if (window.MistralStats && window.MistralStats.Admin) window.MistralStats.Admin.clearAll();
      if (window.AdminUI) window.AdminUI.refreshAll();
    }
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Boutique cart (stopPropagation)
  // ============================================================================

  registerAction('add-to-cart-instrument', function(el, e) {
    e.stopPropagation();
    if (window.BoutiqueAdmin) window.BoutiqueAdmin.addInstrumentToCart(el.dataset.id, el);
  });

  registerAction('add-to-cart-accessoire', function(el, e) {
    e.stopPropagation();
    if (window.BoutiqueAdmin) window.BoutiqueAdmin.addAccessoireToCart(el.dataset.id, el);
  });

  registerAction('stop-propagation', function(el, e) {
    e.stopPropagation();
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Instruments images/video
  // ============================================================================

  registerAction('remove-instrument-image', function(el) {
    var index = parseInt(el.dataset.param, 10);
    if (window.AdminUI && window.AdminUI.removeInstrumentImage) window.AdminUI.removeInstrumentImage(index);
  });

  registerAction('remove-instrument-video', function() {
    if (window.AdminUI && window.AdminUI.removeInstrumentVideo) window.AdminUI.removeInstrumentVideo();
  });

  registerAction('auto-price-instrument', function() {
    if (window.AdminUI && window.AdminUI.autoPriceInstrument) window.AdminUI.autoPriceInstrument();
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Comptabilite (rappel banner)
  // ============================================================================

  registerAction('envoyer-rapport-rappel', function(el) {
    var mois = el.dataset.param;
    if (window.AdminUI && window.AdminUI.envoyerRapportRappel) {
      window.AdminUI.envoyerRapportRappel(mois);
    }
  });

  registerAction('fermer-rappel-banner', function() {
    if (window.AdminUI && window.AdminUI.fermerRappelBanner) {
      window.AdminUI.fermerRappelBanner();
    }
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Contact modal
  // ============================================================================

  registerAction('close-contact-modal', function() {
    if (window.closeContactModal) window.closeContactModal();
  });

  registerAction('submit-contact-form', function(el, e) {
    if (window.submitContactForm) window.submitContactForm(e);
  });

  // ============================================================================
  // ACTIONS EXPLICITES — Teacher profile (apprendre-admin)
  // ============================================================================

  registerAction('open-teacher-profile', function(el) {
    var id = el.dataset.id || (el.closest('[data-id]') ? el.closest('[data-id]').dataset.id : null);
    if (id && window.openTeacherProfile) window.openTeacherProfile(id);
  });

  // Carnet d'entretien (modal instrument)
  registerAction('generate-carnet', function() {
    var idEl = document.getElementById('instrument-id');
    if (!idEl || !idEl.value || !window.MistralGestion) return;
    var instrument = window.MistralGestion.Instruments.get(idEl.value);
    if (!instrument) return;

    // Lazy-load jsPDF + carnet module
    function doGenerate() {
      if (!window.MistralPDF || !window.MistralPDF.generateCarnetEntretien) {
        if (window.MistralAdmin && window.MistralAdmin.Toast) {
          window.MistralAdmin.Toast.error('Module carnet non chargé');
        }
        return;
      }
      if (!instrument.notes_layout) {
        if (window.MistralAdmin && window.MistralAdmin.Toast) {
          window.MistralAdmin.Toast.warning('Cet instrument n\'a pas de notes_layout');
        }
      }
      window.MistralPDF.generateCarnetEntretien(instrument, {
        download: true,
        filename: 'Carnet_entretien_' + (instrument.reference || instrument.id) + '.pdf'
      });
      if (window.MistralAdmin && window.MistralAdmin.Toast) {
        window.MistralAdmin.Toast.success('Carnet d\'entretien généré');
      }
    }

    var utils = window.MistralUtils || {};
    var loadScript = utils.loadScript || function(src) {
      return new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    };

    // Charger les dépendances si nécessaire
    var needJsPDF = (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined');
    var needCarnet = !window.MistralPDF || !window.MistralPDF.generateCarnetEntretien;

    if (!needJsPDF && !needCarnet) {
      doGenerate();
    } else {
      var chain = Promise.resolve();
      if (needJsPDF) chain = chain.then(function() { return loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); });
      if (needCarnet) chain = chain.then(function() { return loadScript('js/admin/carnet-entretien-pdf.js'); });
      chain.then(doGenerate).catch(function(err) {
        console.error('[Carnet] Erreur chargement:', err);
        if (window.MistralAdmin && window.MistralAdmin.Toast) {
          window.MistralAdmin.Toast.error('Erreur lors du chargement du module PDF');
        }
      });
    }
  });

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.AdminDelegation = {
    registerAction: registerAction,
    _handlers: ACTION_HANDLERS // debug
  };

  console.log('[Admin Delegation] Moteur initialise');

})(window);
