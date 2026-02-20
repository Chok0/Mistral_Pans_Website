/* ==========================================================================
   MISTRAL PANS - Module Tailles Centralisé
   Version 2.0

   Source unique pour les données des tailles (sizes).
   Utilisé par: configurateur, admin, boutique, feasibility-module

   Stockage: MistralSync (in-memory + Supabase)
   Fallback: DEFAULT_TAILLES si MistralSync non disponible
   ========================================================================== */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const SYNC_KEY = 'mistral_tailles';

  const DEFAULT_TAILLES = [
    {
      id: 'taille-45',
      code: '45',
      label: '45 cm',
      description: 'Compact — idéal voyage et enfants',
      prix_malus: 100,
      feasibility: {
        shell: 182400,           // Total shell area (mm²)
        comfortPct: 45,          // OK threshold (%)
        warningPct: 50,          // Warning threshold (%)
        maxPct: 59,              // Difficult threshold (%, above = impossible)
        forbiddenNotes: ['C#5'], // Notes that conflict with cavity
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
      prix_malus: 100,
      feasibility: {
        shell: 235200,           // Total shell area (mm²)
        comfortPct: 45,
        warningPct: 50,
        maxPct: 59,
        forbiddenNotes: ['B4'],
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
        shell: 272900,           // Total shell area (mm²)
        comfortPct: 45,
        warningPct: 50,
        maxPct: 59,
        forbiddenNotes: ['A#4'],
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
    return MistralUtils.generateId('taille');
  }

  /**
   * Vérifie si MistralSync est disponible et prêt
   */
  function isSyncReady() {
    return window.MistralSync && MistralSync.isReady() && MistralSync.hasKey(SYNC_KEY);
  }

  // ============================================================================
  // LECTURE DES DONNÉES
  // ============================================================================

  function getAll() {
    if (isSyncReady()) {
      const data = MistralSync.getData(SYNC_KEY);
      if (Array.isArray(data) && data.length > 0) {
        return data.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      }
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
    return getAll().find(t => t.code === String(code)) || null;
  }

  function getById(id) {
    return getAll().find(t => t.id === id) || null;
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
    return getDisponibles().map(t => {
      const isSelected = t.code === String(selected) ? ' selected' : '';
      return `<option value="${t.code}"${isSelected}>${t.label}</option>`;
    }).join('');
  }

  /**
   * Retourne le malus taille en EUR pour un code donné
   * Ex: getSizeMalusEur('45') => 100
   */
  function getSizeMalusEur(code) {
    const taille = getByCode(code);
    return taille ? (taille.prix_malus || 0) : 0;
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

    // Sauvegarder via MistralSync (mémoire + Supabase)
    if (window.MistralSync) {
      MistralSync.setData(SYNC_KEY, tailles);
    }

    dispatchUpdate();
    return taille;
  }

  function remove(id) {
    const tailles = getAll();
    const filtered = tailles.filter(t => t.id !== id);
    if (filtered.length !== tailles.length) {
      if (window.MistralSync) {
        // Mettre à jour la mémoire sans push (on va supprimer côté Supabase)
        MistralSync.setDataLocal(SYNC_KEY, filtered);
        MistralSync.deleteFromSupabase(SYNC_KEY, id);
      }
      dispatchUpdate();
      return true;
    }
    return false;
  }

  function reset() {
    if (window.MistralSync) {
      MistralSync.setData(SYNC_KEY, [...DEFAULT_TAILLES]);
    }
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

  // Quand MistralSync termine le fetch Supabase, notifier les consommateurs
  window.addEventListener('mistral-sync-complete', () => {
    dispatchUpdate();
  });

  // Nettoyer l'ancien localStorage (migration depuis v1.0)
  try { localStorage.removeItem('mistral_tailles'); } catch (e) { /* Ignorer */ }

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
    getSizeMalusEur,

    // Admin
    save,
    remove,
    reset,

    // Constantes
    SYNC_KEY,
    DEFAULT_TAILLES
  };

  console.log('[Tailles] Module initialisé (MistralSync)');

})();
