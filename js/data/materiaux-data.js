/* ==========================================================================
   MISTRAL PANS - Module Materiaux Centralise
   Version 2.0 - In-memory (pas de localStorage)

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
  // IN-MEMORY STORE
  // ============================================================================

  // Les materiaux sont stockes en memoire uniquement
  let materiaux = [...DEFAULT_MATERIAUX];

  // Migration: nettoyer l'ancienne cle localStorage
  try { localStorage.removeItem('mistral_materiaux'); } catch (e) {}

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
    return [...materiaux].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  }

  function getDisponibles() {
    return getAll().filter(m => m.disponible);
  }

  function getForConfigurateur() {
    return getAll().filter(m => m.disponible && m.visible_configurateur);
  }

  function getByCode(code) {
    return materiaux.find(m => m.code === code) || null;
  }

  function getById(id) {
    return materiaux.find(m => m.id === id) || null;
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
  // ADMIN (CRUD) - In-memory
  // ============================================================================

  function save(materiau) {
    const now = new Date().toISOString();

    if (materiau.id) {
      const index = materiaux.findIndex(m => m.id === materiau.id);
      if (index !== -1) {
        materiaux[index] = { ...materiaux[index], ...materiau, updated_at: now };
      }
    } else {
      materiau.id = generateId();
      materiau.created_at = now;
      materiau.updated_at = now;
      materiaux.push(materiau);
    }

    dispatchUpdate();
    return materiau;
  }

  function remove(id) {
    const len = materiaux.length;
    materiaux = materiaux.filter(m => m.id !== id);
    if (materiaux.length !== len) {
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
    orderedIds.forEach((id, index) => {
      const materiau = materiaux.find(m => m.id === id);
      if (materiau) {
        materiau.ordre = index + 1;
        materiau.updated_at = new Date().toISOString();
      }
    });
    dispatchUpdate();
  }

  function reset() {
    materiaux = [...DEFAULT_MATERIAUX];
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
    DEFAULT_MATERIAUX
  };

})();
