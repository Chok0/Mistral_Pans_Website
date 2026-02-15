/* ==========================================================================
   MISTRAL PANS - Module Gammes Centralise
   Version 2.0 - In-memory (pas de localStorage)

   Source unique pour les donnees des gammes (scales).
   Utilise par: configurateur, admin, boutique, formulaires

   Note: les fonctions de theorie musicale (notation, cercle des quintes)
   restent dans scales-data.js. Ce module gere les metadonnees admin.
   ========================================================================== */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CATEGORIES = {
    debutant: { label: 'Debutant', ordre: 1 },
    mineur: { label: 'Mineur', ordre: 2 },
    majeur: { label: 'Majeur', ordre: 3 },
    modal: { label: 'Modal', ordre: 4 },
    oriental: { label: 'Oriental', ordre: 5 },
    pentatonique: { label: 'Pentatonique', ordre: 6 },
    autre: { label: 'Autre', ordre: 7 }
  };

  const DEFAULT_GAMMES = [
    {
      id: 'gamme-kurd',
      code: 'kurd',
      nom: 'Kurd',
      categorie: 'debutant',
      description: 'La gamme la plus populaire. Douce, meditative, accessible a tous.',
      mood: 'Melancolique, introspectif',
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
      description: 'Variante du Celtic, plus douce. Ideale pour debuter.',
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
      description: 'Sonorites orientales. Mysterieuse et envoutante.',
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
      description: 'Gamme grave et profonde. Sonorites riches.',
      mood: 'Profond, meditatif',
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
      description: 'Sonorites celtiques et medievales. Tres melodique.',
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
      description: 'Gamme pentatonique africaine. Joyeuse et entrainante.',
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
      description: 'Gamme majeure complete. Polyvalente et lumineuse.',
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
      description: 'Gamme mystique et envoutante.',
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
      mood: 'Zen, meditatif',
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
  // IN-MEMORY STORE
  // ============================================================================

  let gammes = [...DEFAULT_GAMMES];

  // Codes gammes actifs (venant d'un batch activé en admin)
  // null = pas de batch actif → fallback sur visible_configurateur
  // [] = batch actif vide → aucune gamme visible
  // ['kurd', 'amara', ...] = batch actif → ces gammes visibles
  let activeBatchCodes = null;

  // Migration: nettoyer l'ancienne cle localStorage
  try { localStorage.removeItem('mistral_gammes'); } catch (e) {}

  // Charger les codes gammes actifs depuis Supabase (namespace=configurateur)
  window.addEventListener('mistral-sync-complete', function() {
    if (!window.MistralDB) return;
    const client = MistralDB.getClient();
    if (!client) return;

    client
      .from('configuration')
      .select('value')
      .eq('namespace', 'configurateur')
      .eq('key', 'active_gammes')
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.value != null) {
          try {
            const codes = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            if (Array.isArray(codes)) {
              activeBatchCodes = codes;
              dispatchUpdate();
            }
          } catch (e) { /* garder null */ }
        }
      })
      .catch(() => {}); // Fail silently
  });

  // ============================================================================
  // FONCTIONS UTILITAIRES
  // ============================================================================

  function generateId() {
    return 'gamme-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // ============================================================================
  // LECTURE
  // ============================================================================

  function getAll() {
    return [...gammes].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  }

  function getDisponibles() {
    return getAll().filter(g => g.disponible);
  }

  function getForConfigurateur() {
    // Si un batch est actif, utiliser ses codes au lieu de visible_configurateur
    if (activeBatchCodes !== null) {
      return getAll().filter(g => g.disponible && activeBatchCodes.includes(g.code));
    }
    return getAll().filter(g => g.disponible && g.visible_configurateur);
  }

  function getByCategorie(categorie) {
    return getDisponibles().filter(g => g.categorie === categorie);
  }

  function getByCode(code) {
    if (!code) return null;
    return gammes.find(g => g.code.toLowerCase() === code.toLowerCase()) || null;
  }

  function getById(id) {
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

  function hasConfiguratorPatterns(code) {
    if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA[code]) {
      return MistralScales.SCALES_DATA[code].patterns !== null;
    }
    const gamme = getByCode(code);
    return gamme && gamme.custom_layouts && Object.keys(gamme.custom_layouts).length > 0;
  }

  function getPattern(code, noteCount) {
    const gamme = getByCode(code);

    if (gamme && gamme.custom_layouts && gamme.custom_layouts[noteCount]) {
      return gamme.custom_layouts[noteCount];
    }

    if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA[code]) {
      const scaleData = MistralScales.SCALES_DATA[code];
      return scaleData.patterns ? scaleData.patterns[noteCount] : null;
    }

    return null;
  }

  function toSelectOptions(selected = '', configurateurOnly = false) {
    const list = configurateurOnly ? getForConfigurateur() : getDisponibles();
    return list.map(g => {
      const isSelected = g.code.toLowerCase() === selected.toLowerCase() ? ' selected' : '';
      const catLabel = CATEGORIES[g.categorie] ? ` (${CATEGORIES[g.categorie].label})` : '';
      return `<option value="${g.code}"${isSelected}>${g.nom}${catLabel}</option>`;
    }).join('');
  }

  function getGroupedByCategorie() {
    const list = getDisponibles();
    const grouped = {};

    for (const cat of Object.keys(CATEGORIES)) {
      const items = list.filter(g => g.categorie === cat);
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
  // ADMIN (CRUD) - In-memory
  // ============================================================================

  function save(gamme) {
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

    dispatchUpdate();
    return gamme;
  }

  function remove(id) {
    const len = gammes.length;
    gammes = gammes.filter(g => g.id !== id);
    if (gammes.length !== len) {
      dispatchUpdate();
      return true;
    }
    return false;
  }

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
    orderedIds.forEach((id, index) => {
      const gamme = gammes.find(g => g.id === id);
      if (gamme) {
        gamme.ordre = index + 1;
        gamme.updated_at = new Date().toISOString();
      }
    });
    dispatchUpdate();
  }

  function reset() {
    gammes = [...DEFAULT_GAMMES];
    dispatchUpdate();
  }

  // ============================================================================
  // BATCHES (collections nommées de gammes)
  // ============================================================================

  /**
   * Récupère les batches depuis la config gestion
   * @returns {Array} [{id, nom, gammes: ['kurd',...], active: bool, ordre: int}]
   */
  function getBatches() {
    if (typeof MistralGestion === 'undefined') return [];
    const config = MistralGestion.getConfig();
    return config.gamme_batches || [];
  }

  /**
   * Sauvegarde un batch (création ou mise à jour)
   */
  function saveBatch(batch) {
    if (typeof MistralGestion === 'undefined') return null;
    const batches = getBatches();

    if (batch.id) {
      const index = batches.findIndex(b => b.id === batch.id);
      if (index !== -1) {
        batches[index] = { ...batches[index], ...batch };
      } else {
        batches.push(batch);
      }
    } else {
      batch.id = 'batch-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      batches.push(batch);
    }

    MistralGestion.setConfigValue('gamme_batches', batches);
    return batch;
  }

  /**
   * Supprime un batch
   */
  function removeBatch(id) {
    if (typeof MistralGestion === 'undefined') return false;
    const batches = getBatches().filter(b => b.id !== id);
    MistralGestion.setConfigValue('gamme_batches', batches);

    // Si c'était le batch actif, désactiver
    const config = MistralGestion.getConfig();
    if (config.gamme_batch_active === id) {
      deactivateAllBatches();
    }
    return true;
  }

  /**
   * Active un batch → publie ses codes gammes dans le namespace configurateur
   * pour que le configurateur public les utilise
   */
  async function activateBatch(id) {
    if (typeof MistralGestion === 'undefined') return false;
    const batch = getBatches().find(b => b.id === id);
    if (!batch) return false;

    // Sauver l'ID du batch actif dans la config gestion
    MistralGestion.setConfigValue('gamme_batch_active', id);

    // Publier les codes dans le namespace configurateur (lecture publique)
    await publishActiveGammes(batch.gammes || []);

    // Mettre à jour l'état local
    activeBatchCodes = batch.gammes || [];
    dispatchUpdate();
    return true;
  }

  /**
   * Désactive tous les batches → revient au comportement par défaut (visible_configurateur)
   */
  async function deactivateAllBatches() {
    if (typeof MistralGestion !== 'undefined') {
      MistralGestion.setConfigValue('gamme_batch_active', null);
    }

    // Supprimer la config publique
    await publishActiveGammes(null);

    activeBatchCodes = null;
    dispatchUpdate();
  }

  /**
   * Retourne l'ID du batch actif (ou null)
   */
  function getActiveBatchId() {
    if (typeof MistralGestion === 'undefined') return null;
    return MistralGestion.getConfig().gamme_batch_active || null;
  }

  /**
   * Publie (ou supprime) les codes gammes actifs dans le namespace configurateur
   * Ce namespace a une RLS publique en lecture
   */
  async function publishActiveGammes(codes) {
    if (!window.MistralDB) return;
    const client = MistralDB.getClient();
    if (!client) return;

    if (codes === null) {
      // Supprimer la clé
      await client
        .from('configuration')
        .delete()
        .eq('namespace', 'configurateur')
        .eq('key', 'active_gammes');
    } else {
      // Upsert la clé
      await client
        .from('configuration')
        .upsert({
          key: 'active_gammes',
          value: JSON.stringify(codes),
          namespace: 'configurateur',
          updated_at: new Date().toISOString()
        }, { onConflict: 'key,namespace' });
    }
  }

  // ============================================================================
  // EVENEMENTS
  // ============================================================================

  function dispatchUpdate() {
    window.dispatchEvent(new CustomEvent('gammesUpdated', {
      detail: { gammes: getAll() }
    }));
  }

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

    // Batches (collections)
    getBatches,
    saveBatch,
    removeBatch,
    activateBatch,
    deactivateAllBatches,
    getActiveBatchId,

    // Constantes
    CATEGORIES,
    DEFAULT_GAMMES
  };

})();
