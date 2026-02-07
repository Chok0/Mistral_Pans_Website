/* ==========================================================================
   MISTRAL PANS - Module Gammes Centralisé
   Version 1.0

   Source unique pour les données des gammes (scales).
   Utilisé par: configurateur, admin, boutique, formulaires

   Note: les fonctions de théorie musicale (notation, cercle des quintes)
   restent dans scales-data.js. Ce module gère les métadonnées admin.
   ========================================================================== */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const STORAGE_KEY = 'mistral_gammes';

  const CATEGORIES = {
    debutant: { label: 'Débutant', ordre: 1 },
    mineur: { label: 'Mineur', ordre: 2 },
    majeur: { label: 'Majeur', ordre: 3 },
    modal: { label: 'Modal', ordre: 4 },
    oriental: { label: 'Oriental', ordre: 5 },
    pentatonique: { label: 'Pentatonique', ordre: 6 },
    autre: { label: 'Autre', ordre: 7 }
  };

  // Gammes par défaut — fusionnées depuis scales-data.js + admin.html
  // Les patterns restent dans scales-data.js (SCALES_DATA)
  const DEFAULT_GAMMES = [
    {
      id: 'gamme-kurd',
      code: 'kurd',
      nom: 'Kurd',
      categorie: 'debutant',
      description: 'La gamme la plus populaire. Douce, méditative, accessible à tous.',
      mood: 'Mélancolique, introspectif',
      mode: 'aeolian',
      baseRoot: 'D',
      baseOctave: 3,
      ordre: 1,
      disponible: true,
      visible_configurateur: true,
      custom_layouts: {}
    },
    {
      id: 'gamme-amara',
      code: 'amara',
      nom: 'Amara',
      categorie: 'debutant',
      description: 'Variante du Celtic, plus douce. Idéale pour débuter.',
      mood: 'Doux, apaisant',
      mode: 'dorian',
      baseRoot: 'D',
      baseOctave: 3,
      ordre: 2,
      disponible: true,
      visible_configurateur: true,
      custom_layouts: {}
    },
    {
      id: 'gamme-hijaz',
      code: 'hijaz',
      nom: 'Hijaz',
      categorie: 'oriental',
      description: 'Sonorités orientales. Mystérieuse et envoûtante.',
      mood: 'Oriental, mystique',
      mode: 'phrygian_dominant',
      baseRoot: 'D',
      baseOctave: 3,
      ordre: 3,
      disponible: true,
      visible_configurateur: true,
      custom_layouts: {}
    },
    {
      id: 'gamme-lowpygmy',
      code: 'lowpygmy',
      nom: 'Low Pygmy',
      categorie: 'pentatonique',
      description: 'Version grave du Pygmy. Profonde et hypnotique.',
      mood: 'Profond, tribal',
      mode: 'aeolian',
      baseRoot: 'F#',
      baseOctave: 3,
      ordre: 4,
      disponible: true,
      visible_configurateur: true,
      custom_layouts: {}
    },
    {
      id: 'gamme-myxolydian',
      code: 'myxolydian',
      nom: 'Myxolydian',
      categorie: 'modal',
      description: 'Mode grec lumineux. Joyeux et ouvert.',
      mood: 'Lumineux, joyeux',
      mode: 'mixolydian',
      baseRoot: 'C',
      baseOctave: 3,
      ordre: 5,
      disponible: true,
      visible_configurateur: true,
      custom_layouts: {}
    },
    {
      id: 'gamme-equinox',
      code: 'equinox',
      nom: 'Equinox',
      categorie: 'modal',
      description: 'Gamme grave et profonde. Sonorités riches.',
      mood: 'Profond, méditatif',
      mode: 'phrygian',
      baseRoot: 'F',
      baseOctave: 3,
      ordre: 6,
      disponible: true,
      visible_configurateur: true,
      custom_layouts: {}
    },
    {
      id: 'gamme-celtic',
      code: 'celtic',
      nom: 'Celtic Minor',
      categorie: 'mineur',
      description: 'Sonorités celtiques et médiévales. Très mélodique.',
      mood: 'Mystique, nostalgique',
      mode: 'dorian',
      baseRoot: 'D',
      baseOctave: 3,
      ordre: 7,
      disponible: true,
      visible_configurateur: false,
      custom_layouts: {}
    },
    {
      id: 'gamme-pygmy',
      code: 'pygmy',
      nom: 'Pygmy',
      categorie: 'pentatonique',
      description: 'Gamme pentatonique africaine. Joyeuse et entraînante.',
      mood: 'Joyeux, tribal',
      mode: 'aeolian',
      baseRoot: 'D',
      baseOctave: 3,
      ordre: 8,
      disponible: true,
      visible_configurateur: false,
      custom_layouts: {}
    },
    {
      id: 'gamme-integral',
      code: 'integral',
      nom: 'Integral',
      categorie: 'majeur',
      description: 'Gamme majeure complète. Polyvalente et lumineuse.',
      mood: 'Lumineux, complet',
      mode: 'ionian',
      baseRoot: 'D',
      baseOctave: 3,
      ordre: 9,
      disponible: true,
      visible_configurateur: false,
      custom_layouts: {}
    },
    {
      id: 'gamme-oxalis',
      code: 'oxalis',
      nom: 'Oxalis',
      categorie: 'mineur',
      description: 'Gamme mineure douce et expressive.',
      mood: 'Doux, expressif',
      mode: 'aeolian',
      baseRoot: 'F',
      baseOctave: 3,
      ordre: 10,
      disponible: true,
      visible_configurateur: false,
      custom_layouts: {}
    },
    {
      id: 'gamme-mystic',
      code: 'mystic',
      nom: 'Mystic',
      categorie: 'modal',
      description: 'Gamme mystique et envoûtante.',
      mood: 'Mystique, contemplatif',
      mode: 'mixolydian',
      baseRoot: 'C',
      baseOctave: 3,
      ordre: 11,
      disponible: true,
      visible_configurateur: false,
      custom_layouts: {}
    },
    {
      id: 'gamme-akebono',
      code: 'akebono',
      nom: 'Akebono',
      categorie: 'pentatonique',
      description: 'Gamme japonaise traditionnelle. Zen et contemplative.',
      mood: 'Zen, méditatif',
      mode: 'phrygian',
      baseRoot: 'D',
      baseOctave: 3,
      ordre: 12,
      disponible: true,
      visible_configurateur: false,
      custom_layouts: {}
    }
  ];

  // ============================================================================
  // FONCTIONS UTILITAIRES
  // ============================================================================

  function generateId() {
    return 'gamme-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // ============================================================================
  // GESTION DU STOCKAGE
  // ============================================================================

  function initGammes() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GAMMES));
      console.log('[Gammes] Données initialisées avec les valeurs par défaut');
    }
  }

  function getAll() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      }
    } catch (e) {
      console.error('[Gammes] Erreur lecture:', e);
    }
    return [...DEFAULT_GAMMES];
  }

  function getDisponibles() {
    return getAll().filter(g => g.disponible);
  }

  function getForConfigurateur() {
    return getAll().filter(g => g.disponible && g.visible_configurateur);
  }

  function getByCategorie(categorie) {
    return getDisponibles().filter(g => g.categorie === categorie);
  }

  function getByCode(code) {
    if (!code) return null;
    const gammes = getAll();
    return gammes.find(g => g.code.toLowerCase() === code.toLowerCase()) || null;
  }

  function getById(id) {
    const gammes = getAll();
    return gammes.find(g => g.id === id) || null;
  }

  function getLabel(code, format = 'short') {
    const gamme = getByCode(code);
    if (!gamme) return code;
    switch (format) {
      case 'full': return `${gamme.nom} (${gamme.categorie})`;
      case 'short': return gamme.nom;
      case 'code': return gamme.code;
      default: return gamme.nom;
    }
  }

  /**
   * Vérifie si une gamme a des patterns de configurateur
   * Cherche d'abord dans scales-data.js, puis dans custom_layouts
   */
  function hasConfiguratorPatterns(code) {
    // Vérifier dans scales-data.js
    if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA[code]) {
      return MistralScales.SCALES_DATA[code].patterns !== null;
    }
    // Vérifier dans custom_layouts
    const gamme = getByCode(code);
    return gamme && gamme.custom_layouts && Object.keys(gamme.custom_layouts).length > 0;
  }

  /**
   * Récupère le pattern de layout pour un nombre de notes donné
   * Priorité: custom_layouts > scales-data.js patterns
   */
  function getPattern(code, noteCount) {
    const gamme = getByCode(code);

    // Vérifier d'abord les custom layouts
    if (gamme && gamme.custom_layouts && gamme.custom_layouts[noteCount]) {
      return gamme.custom_layouts[noteCount];
    }

    // Sinon, chercher dans scales-data.js
    if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA[code]) {
      const scaleData = MistralScales.SCALES_DATA[code];
      return scaleData.patterns ? scaleData.patterns[noteCount] : null;
    }

    return null;
  }

  /**
   * Génère les options HTML pour un select
   */
  function toSelectOptions(selected = '', configurateurOnly = false) {
    const gammes = configurateurOnly ? getForConfigurateur() : getDisponibles();
    return gammes.map(g => {
      const isSelected = g.code.toLowerCase() === selected.toLowerCase() ? ' selected' : '';
      const catLabel = CATEGORIES[g.categorie] ? ` (${CATEGORIES[g.categorie].label})` : '';
      return `<option value="${g.code}"${isSelected}>${g.nom}${catLabel}</option>`;
    }).join('');
  }

  /**
   * Retourne les gammes groupées par catégorie (pour le searchable select)
   */
  function getGroupedByCategorie() {
    const gammes = getDisponibles();
    const grouped = {};

    for (const cat of Object.keys(CATEGORIES)) {
      const items = gammes.filter(g => g.categorie === cat);
      if (items.length > 0) {
        grouped[cat] = {
          label: CATEGORIES[cat].label,
          gammes: items
        };
      }
    }
    return grouped;
  }

  // ============================================================================
  // FONCTIONS ADMIN (CRUD)
  // ============================================================================

  function save(gamme) {
    const gammes = getAll();
    const now = new Date().toISOString();

    if (gamme.id) {
      const index = gammes.findIndex(g => g.id === gamme.id);
      if (index !== -1) {
        gammes[index] = { ...gammes[index], ...gamme, updated_at: now };
      }
    } else {
      gamme.id = generateId();
      gamme.created_at = now;
      gamme.updated_at = now;
      if (!gamme.custom_layouts) gamme.custom_layouts = {};
      gammes.push(gamme);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(gammes));
    dispatchUpdate();
    return gamme;
  }

  function remove(id) {
    const gammes = getAll();
    const filtered = gammes.filter(g => g.id !== id);
    if (filtered.length !== gammes.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      dispatchUpdate();
      return true;
    }
    return false;
  }

  /**
   * Sauvegarde un custom layout pour une gamme (cas spécial)
   * Ex: D Kurd 12 avec bass E+F au lieu de F+G
   */
  function saveCustomLayout(code, noteCount, pattern) {
    const gamme = getByCode(code);
    if (!gamme) return false;

    if (!gamme.custom_layouts) gamme.custom_layouts = {};
    gamme.custom_layouts[noteCount] = pattern;
    return save(gamme);
  }

  function removeCustomLayout(code, noteCount) {
    const gamme = getByCode(code);
    if (!gamme || !gamme.custom_layouts) return false;

    delete gamme.custom_layouts[noteCount];
    return save(gamme);
  }

  function reorder(orderedIds) {
    const gammes = getAll();
    orderedIds.forEach((id, index) => {
      const gamme = gammes.find(g => g.id === id);
      if (gamme) {
        gamme.ordre = index + 1;
        gamme.updated_at = new Date().toISOString();
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gammes));
    dispatchUpdate();
  }

  function reset() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GAMMES));
    dispatchUpdate();
  }

  // ============================================================================
  // ÉVÉNEMENTS
  // ============================================================================

  function dispatchUpdate() {
    window.dispatchEvent(new CustomEvent('gammesUpdated', {
      detail: { gammes: getAll() }
    }));
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  initGammes();

  // ============================================================================
  // EXPORTS
  // ============================================================================

  window.MistralGammes = {
    // Lecture
    getAll,
    getDisponibles,
    getForConfigurateur,
    getByCategorie,
    getByCode,
    getById,
    getLabel,
    hasConfiguratorPatterns,
    getPattern,
    toSelectOptions,
    getGroupedByCategorie,

    // Admin
    save,
    remove,
    saveCustomLayout,
    removeCustomLayout,
    reorder,
    reset,

    // Constantes
    STORAGE_KEY,
    CATEGORIES,
    DEFAULT_GAMMES
  };

  console.log('[Gammes] Module initialisé');

})();
