/* ==========================================================================
   MISTRAL PANS - Module Tailles Centralisé
   Version 1.0

   Source unique pour les données des tailles (sizes).
   Utilisé par: configurateur, admin, boutique, feasibility-module
   ========================================================================== */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const STORAGE_KEY = 'mistral_tailles';

  const DEFAULT_TAILLES = [
    {
      id: 'taille-45',
      code: '45',
      label: '45 cm',
      description: 'Compact — idéal voyage et enfants',
      prix_malus: 5,
      feasibility: {
        maxSurface: 55,
        warnSurface: 42,
        noteSize: 7.8,
        bottomSize: 9.0,
        totalArea: 1590
      },
      ordre: 1,
      disponible: true,
      visible_configurateur: true
    },
    {
      id: 'taille-50',
      code: '50',
      label: '50 cm',
      description: 'Polyvalent — bon compromis taille/son',
      prix_malus: 2.5,
      feasibility: {
        maxSurface: 57,
        warnSurface: 44,
        noteSize: 8.5,
        bottomSize: 9.8,
        totalArea: 1963
      },
      ordre: 2,
      disponible: true,
      visible_configurateur: true
    },
    {
      id: 'taille-53',
      code: '53',
      label: '53 cm',
      description: 'Standard — meilleure résonance',
      prix_malus: 0,
      feasibility: {
        maxSurface: 59,
        warnSurface: 45,
        noteSize: 9.0,
        bottomSize: 10.5,
        totalArea: 2206
      },
      ordre: 3,
      disponible: true,
      visible_configurateur: true
    }
  ];

  // ============================================================================
  // FONCTIONS UTILITAIRES
  // ============================================================================

  function generateId() {
    return 'taille-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // ============================================================================
  // GESTION DU STOCKAGE
  // ============================================================================

  function initTailles() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TAILLES));
      console.log('[Tailles] Données initialisées avec les valeurs par défaut');
    }
  }

  function getAll() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      }
    } catch (e) {
      console.error('[Tailles] Erreur lecture:', e);
    }
    return [...DEFAULT_TAILLES];
  }

  function getDisponibles() {
    return getAll().filter(t => t.disponible);
  }

  function getForConfigurateur() {
    return getAll().filter(t => t.disponible && t.visible_configurateur);
  }

  function getByCode(code) {
    if (!code) return null;
    const tailles = getAll();
    return tailles.find(t => t.code === String(code)) || null;
  }

  function getById(id) {
    const tailles = getAll();
    return tailles.find(t => t.id === id) || null;
  }

  function getPrixMalus(code) {
    const taille = getByCode(code);
    return taille ? (taille.prix_malus || 0) : 0;
  }

  function getFeasibility(code) {
    const taille = getByCode(code);
    return taille ? taille.feasibility : null;
  }

  function toSelectOptions(selected = '53') {
    const tailles = getDisponibles();
    return tailles.map(t => {
      const isSelected = t.code === String(selected) ? ' selected' : '';
      return `<option value="${t.code}"${isSelected}>${t.label}</option>`;
    }).join('');
  }

  /**
   * Retourne le map sizeMalus compatible avec l'ancien format
   * { '53': 0, '50': 0.025, '45': 0.05 }
   */
  function getSizeMalusMap() {
    const tailles = getAll();
    const map = {};
    tailles.forEach(t => {
      map[t.code] = (t.prix_malus || 0) / 100;
    });
    return map;
  }

  // ============================================================================
  // FONCTIONS ADMIN (CRUD)
  // ============================================================================

  function save(taille) {
    const tailles = getAll();
    const now = new Date().toISOString();

    if (taille.id) {
      const index = tailles.findIndex(t => t.id === taille.id);
      if (index !== -1) {
        tailles[index] = { ...tailles[index], ...taille, updated_at: now };
      }
    } else {
      taille.id = generateId();
      taille.created_at = now;
      taille.updated_at = now;
      tailles.push(taille);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(tailles));
    dispatchUpdate();
    return taille;
  }

  function remove(id) {
    const tailles = getAll();
    const filtered = tailles.filter(t => t.id !== id);
    if (filtered.length !== tailles.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      dispatchUpdate();
      return true;
    }
    return false;
  }

  function reset() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TAILLES));
    dispatchUpdate();
  }

  // ============================================================================
  // ÉVÉNEMENTS
  // ============================================================================

  function dispatchUpdate() {
    window.dispatchEvent(new CustomEvent('taillesUpdated', {
      detail: { tailles: getAll() }
    }));
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  initTailles();

  // ============================================================================
  // EXPORTS
  // ============================================================================

  window.MistralTailles = {
    // Lecture
    getAll,
    getDisponibles,
    getForConfigurateur,
    getByCode,
    getById,
    getPrixMalus,
    getFeasibility,
    toSelectOptions,
    getSizeMalusMap,

    // Admin
    save,
    remove,
    reset,

    // Constantes
    STORAGE_KEY,
    DEFAULT_TAILLES
  };

  console.log('[Tailles] Module initialisé');

})();
