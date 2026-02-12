/* ==========================================================================
   MISTRAL PANS - Module Materiaux Centralise
   Version 2.1 - localStorage (persistent)

   Source unique pour les donnees des materiaux.
   Utilise par: configurateur, admin, boutique, formulaires
   ========================================================================== */

(function() {
  'use strict';

  // ============================================================================
  // DONNEES PAR DEFAUT
  // ============================================================================

  // Note: tous les materiaux sont au meme prix (pas de malus)
  const DEFAULT_MATERIAUX = [
    {
      id: 'mat-ns',
      code: 'NS',
      nom: 'Acier Nitrure',
      nom_court: 'Nitrure',
      description: 'Acier traite par nitruration pour une protection optimale contre la corrosion. Ton d\'or caracteristique.',
      prix_malus: 0,
      ordre: 1,
      couleur: '#C9A227',
      disponible: true,
      visible_configurateur: true
    },
    {
      id: 'mat-es',
      code: 'ES',
      nom: 'Ember Steel',
      nom_court: 'Ember Steel',
      description: 'Acier avec finition cuivree unique. Chaleur du son et esthetique distinctive.',
      prix_malus: 0,
      ordre: 2,
      couleur: '#CD853F',
      disponible: true,
      visible_configurateur: true
    },
    {
      id: 'mat-ss',
      code: 'SS',
      nom: 'Acier Inoxydable',
      nom_court: 'Inox',
      description: 'Acier inoxydable pour une durabilite maximale. Finition brillante argentee.',
      prix_malus: 0,
      ordre: 3,
      couleur: '#C0C0C0',
      disponible: true,
      visible_configurateur: true
    }
  ];

  // ============================================================================
  // PERSISTENT STORE (localStorage)
  // ============================================================================

  const STORAGE_KEY = 'mistral_materiaux';

  function initMateriaux() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MATERIAUX));
    }
  }

  // ============================================================================
  // FONCTIONS UTILITAIRES
  // ============================================================================

  function generateId() {
    return 'mat-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // ============================================================================
  // LECTURE
  // ============================================================================

  function getAll() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      }
    } catch (e) {
      console.error('[Materiaux] Erreur lecture:', e);
    }
    return [...DEFAULT_MATERIAUX];
  }

  function getDisponibles() {
    return getAll().filter(m => m.disponible);
  }

  function getForConfigurateur() {
    return getAll().filter(m => m.disponible && m.visible_configurateur);
  }

  function getByCode(code) {
    const all = getAll();
    return all.find(m => m.code === code) || null;
  }

  function getById(id) {
    const all = getAll();
    return all.find(m => m.id === id) || null;
  }

  function getLabel(code, format = 'short') {
    const materiau = getByCode(code);
    if (!materiau) return code;

    switch (format) {
      case 'full':
        return materiau.nom;
      case 'short':
        return materiau.nom_court || materiau.nom;
      case 'code':
        return materiau.code;
      default:
        return materiau.nom_court || materiau.nom;
    }
  }

  function getPrixMalus(code) {
    const materiau = getByCode(code);
    return materiau ? (materiau.prix_malus || 0) : 0;
  }

  function toSelectOptions(selected = '', configurateurOnly = false) {
    const list = configurateurOnly ? getForConfigurateur() : getDisponibles();
    return list.map(m => {
      const isSelected = m.code === selected ? ' selected' : '';
      const prixInfo = m.prix_malus > 0 ? ` (+${m.prix_malus}%)` : '';
      return `<option value="${m.code}"${isSelected}>${m.nom}${prixInfo}</option>`;
    }).join('');
  }

  // ============================================================================
  // ADMIN (CRUD) - localStorage
  // ============================================================================

  function save(materiau) {
    const all = getAll();
    const now = new Date().toISOString();

    if (materiau.id) {
      const index = all.findIndex(m => m.id === materiau.id);
      if (index !== -1) {
        all[index] = { ...all[index], ...materiau, updated_at: now };
      }
    } else {
      materiau.id = generateId();
      materiau.created_at = now;
      materiau.updated_at = now;
      all.push(materiau);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    dispatchUpdate();
    return materiau;
  }

  function remove(id) {
    const all = getAll();
    const filtered = all.filter(m => m.id !== id);
    if (filtered.length !== all.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      dispatchUpdate();
      return true;
    }
    return false;
  }

  function setDisponible(id, disponible) {
    const materiau = getById(id);
    if (materiau) {
      materiau.disponible = disponible;
      return save(materiau) !== null;
    }
    return false;
  }

  function setVisibleConfigurateur(id, visible) {
    const materiau = getById(id);
    if (materiau) {
      materiau.visible_configurateur = visible;
      return save(materiau) !== null;
    }
    return false;
  }

  function reorder(orderedIds) {
    const all = getAll();
    orderedIds.forEach((id, index) => {
      const materiau = all.find(m => m.id === id);
      if (materiau) {
        materiau.ordre = index + 1;
        materiau.updated_at = new Date().toISOString();
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    dispatchUpdate();
  }

  function reset() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MATERIAUX));
    dispatchUpdate();
  }

  // ============================================================================
  // EVENEMENTS
  // ============================================================================

  function dispatchUpdate() {
    window.dispatchEvent(new CustomEvent('materiauxUpdated', {
      detail: { materiaux: getAll() }
    }));
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  initMateriaux();

  // ============================================================================
  // EXPORTS
  // ============================================================================

  window.MistralMateriaux = {
    // Lecture
    getAll,
    getDisponibles,
    getForConfigurateur,
    getByCode,
    getById,
    getLabel,
    getPrixMalus,
    toSelectOptions,

    // Admin
    save,
    remove,
    setDisponible,
    setVisibleConfigurateur,
    reorder,
    reset,

    // Constantes
    STORAGE_KEY,
    DEFAULT_MATERIAUX
  };

  console.log('[Materiaux] Module initialisé');

})();
