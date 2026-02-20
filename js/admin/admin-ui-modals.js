/* ==========================================================================
   MISTRAL PANS - Admin UI - Module Modals (Core)
   Utilitaires partagés : showModal, closeModal, état scopé, saveGuard
   ========================================================================== */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-modals] AdminUI non disponible, module différé');
    return;
  }

  const { $, $$, escapeHtml, formatPrice, formatDate, isValidEmail, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers;

  // Guard anti-double-clic pour les sauvegardes
  const _savingGuards = new Set();
  function withSaveGuard(name, fn) {
    return async function() {
      if (_savingGuards.has(name)) return;
      _savingGuards.add(name);
      try { await fn.apply(this, arguments); }
      finally { _savingGuards.delete(name); }
    };
  }

  // État scopé par modal (élimine les variables globales mutables)
  const _modalState = {};

  function getModalState(name) {
    if (!_modalState[name]) _modalState[name] = {};
    return _modalState[name];
  }

  function clearModalState(name) {
    delete _modalState[name];
  }

  function showModal(name) {
    const modal = $(`#modal-${name}`);

    if (!modal) {
      console.error(`[showModal] Modal #modal-${name} not found`);
      Toast.error(`Modal "${name}" introuvable`);
      return;
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

      // Focus trap (WCAG 2.4.3)
      if (window.MistralFocusTrap) MistralFocusTrap.activate(modal);

      // Reset du formulaire si nouveau
      const titleEl = modal.querySelector('.admin-modal__title');
      const idField = $(`#${name}-id`);
      if (idField && !idField.value) {
        const form = modal.querySelector('form');
        if (form) form.reset();

        // Titres par défaut
        const titles = {
          client: 'Nouveau client',
          instrument: 'Nouvel instrument',
          location: 'Nouvelle location',
          commande: 'Nouvelle commande',
          facture: 'Nouvelle facture',
          materiau: 'Nouveau matériau',
          gamme: 'Nouvelle gamme',
          taille: 'Nouvelle taille'
        };
        if (titleEl && titles[name]) {
          titleEl.textContent = titles[name];
        }

        // Initialisations spécifiques
        const today = new Date().toISOString().split('T')[0];

        if (name === 'facture') {
          // Initialiser les lignes de facture
          if (AdminUI.renderFactureLignes) AdminUI.renderFactureLignes([]);
          if (AdminUI.updateFactureTotaux) AdminUI.updateFactureTotaux();
          // Date par défaut = aujourd'hui
          if ($('#facture-date')) {
            $('#facture-date').value = today;
            // Ajouter l'événement pour recalculer l'échéance
            $('#facture-date').onchange = function() { if (AdminUI.updateFactureEcheance) AdminUI.updateFactureEcheance(); };
          }
          // Échéance par défaut = +30 jours
          if (AdminUI.updateFactureEcheance) AdminUI.updateFactureEcheance();
          // Reset client search
          if ($('#facture-client-search')) $('#facture-client-search').value = '';
          if ($('#facture-client-id')) $('#facture-client-id').value = '';
        }

        if (name === 'location') {
          if ($('#location-date-debut')) $('#location-date-debut').value = today;
          if ($('#location-client-search')) $('#location-client-search').value = '';
          if ($('#location-client-id')) $('#location-client-id').value = '';
          if ($('#location-instrument-search')) $('#location-instrument-search').value = '';
          if ($('#location-instrument-id')) $('#location-instrument-id').value = '';
        }

        if (name === 'commande') {
          if ($('#commande-date')) $('#commande-date').value = today;
          if ($('#commande-client-search')) $('#commande-client-search').value = '';
          if ($('#commande-client-id')) $('#commande-client-id').value = '';
        }

        if (name === 'instrument') {
          // Initialiser les uploads
          if (AdminUI.initInstrumentUploads) AdminUI.initInstrumentUploads();
          // Reset les previews
          if (AdminUI.clearInstrumentMediaPreviews) AdminUI.clearInstrumentMediaPreviews();
        }

        if (name === 'accessoire') {
          // Initialiser l'upload d'image
          if (AdminUI.initAccessoireUpload) AdminUI.initAccessoireUpload();
          // Initialiser le toggle des options configurateur
          if (AdminUI.initAccessoireConfigToggle) AdminUI.initAccessoireConfigToggle();
          // Render dynamic tailles checkboxes and reset
          if (AdminUI.renderAccessoireTailles) AdminUI.renderAccessoireTailles();
          // Reset config options
          $('#accessoire-visible-config').checked = false;
          if (AdminUI.toggleAccessoireConfigOptions) AdminUI.toggleAccessoireConfigOptions(false);
        }

        if (name === 'media') {
          // Initialiser l'upload d'image/vidéo
          if (AdminUI.initMediaUpload) AdminUI.initMediaUpload();
          // Reset titre du modal
          $('#modal-media-title').textContent = 'Ajouter un média';
          $('#media-id').value = '';
          $('#form-media')?.reset();
        }

        if (name === 'article') {
          // Initialiser l'upload et l'éditeur
          if (AdminUI.initArticleUpload) AdminUI.initArticleUpload();
          // Reset titre du modal
          $('#modal-article-title').textContent = 'Nouvel article';
          $('#article-id').value = '';
          $('#form-article')?.reset();
        }

        if (name === 'materiau') {
          // Reset du formulaire
          $('#modal-materiau-title').textContent = 'Nouveau matériau';
          $('#materiau-id').value = '';
          $('#form-materiau')?.reset();
          // Valeurs par défaut
          $('#materiau-prix-malus').value = 0;
          $('#materiau-ordre').value = 1;
          $('#materiau-couleur').value = '#C9A227';
          $('#materiau-couleur-picker').value = '#C9A227';
          $('#materiau-disponible').checked = true;
          $('#materiau-visible-config').checked = true;
          // Sync color picker
          if (typeof initMateriauColorSync === 'function') initMateriauColorSync();
          else if (AdminUI.initMateriauColorSync) AdminUI.initMateriauColorSync();
        }

        if (name === 'instrument') {
          // Populate dynamic selects
          AdminUI.populateMateriauxSelect();
          if (AdminUI.populateGammesSelect) AdminUI.populateGammesSelect();
          if (AdminUI.populateTaillesSelect) AdminUI.populateTaillesSelect();
        }

        if (name === 'gamme') {
          $('#modal-gamme-title').textContent = 'Nouvelle gamme';
          $('#gamme-id').value = '';
          $('#form-gamme')?.reset();
          $('#gamme-ordre').value = 1;
          $('#gamme-baseoctave').value = 3;
          $('#gamme-disponible').checked = true;
          $('#gamme-visible-config').checked = false;
          // Init pattern inputs and clear them
          if (AdminUI.renderPatternInputs) AdminUI.renderPatternInputs();
          const importBtn = document.getElementById('gamme-import-patterns-btn');
          if (importBtn) importBtn.style.display = '';
        }

        if (name === 'taille') {
          $('#modal-taille-title').textContent = 'Nouvelle taille';
          $('#taille-id').value = '';
          $('#form-taille')?.reset();
          $('#taille-ordre').value = 1;
          $('#taille-disponible').checked = true;
          $('#taille-visible-config').checked = true;
        }
      }

    // Focus premier champ
    setTimeout(() => {
      const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  function closeModal(name) {
    const modal = $(`#modal-${name}`);
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';

      // Reset ID caché
      const idField = $(`#${name}-id`);
      if (idField) idField.value = '';
    }

    // Desactiver le piege de focus et restaurer le focus precedent
    if (window.MistralFocusTrap) MistralFocusTrap.deactivate();

    // Liberer les etats pour eviter les fuites memoire
    clearModalState(name);
  }

  // Fermer modal avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.admin-modal-overlay.open');
      if (openModal) {
        const name = openModal.id.replace('modal-', '');
        closeModal(name);
      }
    }
  });

  // Ouvre un modal sans réinitialiser les données
  function showModalWithData(name) {
    const modal = $(`#modal-${name}`);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  // Export core functions to AdminUI
  Object.assign(window.AdminUI, {
    getModalState,
    clearModalState,
    showModal,
    closeModal,
    showModalWithData,
    withSaveGuard
  });

})(window);
