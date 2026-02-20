/* ==========================================================================
   MISTRAL PANS - Module Gammes Centralise
   Version 3.0 - MistralSync/Supabase

   Source unique pour les donnees des gammes (scales).
   Utilise par: configurateur, admin, boutique, formulaires

   Note: les fonctions de theorie musicale (notation, cercle des quintes)
   restent dans scales-data.js. Ce module gere les metadonnees admin.

   Stockage: MistralSync (in-memory + Supabase table 'gammes')
   Fallback: DEFAULT_GAMMES si MistralSync non disponible
   ========================================================================== */

/* ===========================================================================
 *  MISTRAL PANS — Module Gammes (gammes-data.js)
 * ===========================================================================
 *
 *  @fileoverview
 *    Module centralise de gestion des gammes (scales) pour handpan.
 *    Fournit les 12 gammes par defaut (Kurd, Amara, Hijaz, etc.),
 *    les operations CRUD pour l'administration, la gestion de "lots"
 *    (collections nommees de gammes publiees dans le configurateur),
 *    ainsi que la fusion des layouts personnalises (custom_layouts) avec
 *    les patterns issus de scales-data.js (MistralScales.SCALES_DATA).
 *
 *  @module MistralGammes
 *  @version 3.0
 *  @author Mistral Pans
 *
 *  @architecture
 *    - Pattern IIFE : expose l'objet {@link window.MistralGammes}
 *    - Donnees en memoire dans le tableau `gammes` (pas de localStorage)
 *    - Synchronisation bidirectionnelle via MistralSync (table Supabase `gammes`)
 *    - Les lots publies sont stockes dans la table Supabase `configuration`
 *      (namespace = 'configurateur', key = 'published_lots' | 'active_gammes')
 *
 *  @dependencies
 *    - MistralSync   (js/services/supabase-sync.js)  — persistence Supabase
 *    - MistralDB     (js/services/supabase-client.js) — client Supabase brut
 *    - MistralScales (js/data/scales-data.js)         — SCALES_DATA, patterns hardcodes
 *    - MistralGestion (js/admin/gestion.js)           — config gestion (gamme_batches)
 *
 *  @events
 *    Ecoute :
 *      - 'mistral-sync-complete' — declenche le chargement initial depuis Supabase
 *    Emet :
 *      - 'gammesUpdated' (CustomEvent, detail: { gammes: Array<Gamme> })
 *        Emis a chaque modification (save, remove, reorder, publication de lot, etc.)
 *
 *  @exports window.MistralGammes
 *    Lecture   : getAll, getDisponibles, getForConfigurateur, getByCategorie,
 *                getByCode, getById, getLabel, hasConfiguratorPatterns,
 *                getPattern, getBaseNotes, getScaleDataForConfigurateur,
 *                toSelectOptions, getGroupedByCategorie
 *    Admin     : save, remove, saveCustomLayout, removeCustomLayout, reorder, reset
 *    Batches   : getBatches, saveBatch, removeBatch, publishBatch, unpublishBatch,
 *                getPublishedLots
 *    Deprecated: activateBatch, deactivateAllBatches, getActiveBatchId
 *    Constantes: CATEGORIES, DEFAULT_GAMMES
 * =========================================================================== */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Cle utilisee dans MistralSync pour identifier le jeu de donnees des gammes.
   * Correspond a la table Supabase `gammes`.
   *
   * @constant {string}
   */
  const SYNC_KEY = 'mistral_gammes_data';

  /**
   * Dictionnaire des categories de gammes.
   * Chaque categorie possede un libelle affichable et un ordre de tri.
   *
   * @constant {Object<string, CategorieDefinition>}
   *
   * @typedef {Object} CategorieDefinition
   * @property {string} label  — Libelle affichable (ex. 'Debutant', 'Mineur')
   * @property {number} ordre  — Ordre d'affichage (1 = premier)
   */
  const CATEGORIES = {
    debutant: { label: 'Debutant', ordre: 1 },
    mineur: { label: 'Mineur', ordre: 2 },
    majeur: { label: 'Majeur', ordre: 3 },
    modal: { label: 'Modal', ordre: 4 },
    oriental: { label: 'Oriental', ordre: 5 },
    pentatonique: { label: 'Pentatonique', ordre: 6 },
    autre: { label: 'Autre', ordre: 7 }
  };

  /**
   * Les 12 gammes par defaut livrees avec le site.
   * Servent de fallback si MistralSync n'est pas disponible ou vide.
   *
   * Chaque element suit la structure {@link Gamme}.
   *
   * @constant {Array<Gamme>}
   *
   * @typedef {Object} Gamme
   * @property {string}  id                     — Identifiant unique (ex. 'gamme-kurd')
   * @property {string}  code                   — Code court (ex. 'kurd'), utilise comme cle de reference
   * @property {string}  nom                    — Nom affichable (ex. 'Kurd')
   * @property {string}  categorie              — Cle dans CATEGORIES (ex. 'debutant', 'oriental')
   * @property {string}  description            — Description textuelle pour l'utilisateur
   * @property {string}  mood                   — Ambiance / atmosphere (ex. 'Melancolique, introspectif')
   * @property {string}  mode                   — Mode musical (ex. 'aeolian', 'dorian', 'phrygian_dominant')
   * @property {string}  baseRoot               — Note fondamentale (ex. 'D', 'F#', 'C')
   * @property {number}  baseOctave             — Octave de base (ex. 3)
   * @property {Array<string>} baseNotes        — Notes de la gamme en notation americaine (ex. ['D3', 'A3', 'Bb3', ...])
   *                                               Peut etre vide si la gamme n'a pas encore de layout defini.
   * @property {number}  ordre                  — Position de tri (1 = premier affiche)
   * @property {boolean} disponible             — true si la gamme est proposable (active dans le catalogue)
   * @property {boolean} visible_configurateur  — true si visible par defaut dans le configurateur
   *                                               (ignore si des lots publies existent)
   * @property {Object<number, Array<string>>} custom_layouts
   *   — Layouts personnalises par nombre de notes.
   *     Cle = nombre de notes (ex. 9, 10, 11), valeur = tableau de notes.
   *     Ces layouts ont priorite sur les patterns de SCALES_DATA (scales-data.js).
   * @property {string}  [created_at]           — Date ISO de creation (ajoute au save)
   * @property {string}  [updated_at]           — Date ISO de derniere modification (ajoute au save)
   */
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
      baseNotes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
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
      baseNotes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'],
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
      baseNotes: ['D3', 'A3', 'Bb3', 'C#4', 'D4', 'E4', 'F4', 'G4', 'A4'],
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
      baseNotes: ['F#3', 'G#3', 'A3', 'C#4', 'E4', 'F#4', 'G#4', 'A4', 'C#5'],
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
      baseNotes: ['C3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'],
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
      baseNotes: ['F3', 'Ab3', 'C4', 'Db4', 'Eb4', 'F4', 'G4', 'Ab4', 'C5'],
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
      baseNotes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'],
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
      baseNotes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'F4', 'G4', 'A4'],
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
      baseNotes: [],
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
      baseNotes: [],
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
      baseNotes: [],
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
      baseNotes: [],
      ordre: 12,
      disponible: true,
      visible_configurateur: false,
      custom_layouts: {}
    }
  ];

  // ============================================================================
  // IN-MEMORY STORE
  // ============================================================================

  /**
   * Tableau en memoire contenant toutes les gammes.
   * Initialise avec DEFAULT_GAMMES, puis remplace par les donnees Supabase
   * a la reception de l'evenement 'mistral-sync-complete'.
   *
   * @type {Array<Gamme>}
   */
  let gammes = [...DEFAULT_GAMMES];

  /**
   * Lots publies (charges depuis Supabase namespace=configurateur, key='published_lots').
   * - null  : aucun lot publie — le configurateur utilise le fallback `visible_configurateur`
   * - Array : liste de lots publies, chacun contenant un sous-ensemble de codes gammes
   *
   * @type {Array<Lot>|null}
   *
   * @typedef {Object} Lot
   * @property {string}        id     — Identifiant unique du lot (ex. 'batch-m1abc2xyz')
   * @property {string}        nom    — Nom affichable du lot (ex. 'Collection Hiver 2026')
   * @property {Array<string>} gammes — Codes des gammes incluses (ex. ['kurd', 'hijaz', 'amara'])
   * @property {number}        ordre  — Position de tri du lot
   */
  // Lots publiés (chargés depuis Supabase namespace=configurateur)
  // null = aucun lot publié → fallback sur visible_configurateur
  // [{id, nom, gammes: ['kurd',...], ordre}] = lots publiés
  let publishedLots = null;

  /**
   * Liste plate de tous les codes gammes actifs (union de tous les lots publies).
   * Utilisee pour la retro-compatibilite avec l'ancien systeme de batch unique.
   * - null  : pas de filtrage par batch — utiliser visible_configurateur
   * - Array : seuls ces codes sont affiches dans le configurateur
   *
   * @type {Array<string>|null}
   */
  // Legacy: codes gammes actifs (backward compat)
  let activeBatchCodes = null;

  // ===========================================================================
  // INITIALISATION — CHARGEMENT DEPUIS SUPABASE
  // ===========================================================================

  /**
   * Vérifie si MistralSync est disponible et prêt
   * (le module est charge et a deja effectue la synchronisation initiale).
   *
   * @returns {boolean} true si MistralSync est pret ET possede des donnees pour SYNC_KEY
   */
  function isSyncReady() {
    return window.MistralSync && MistralSync.isReady() && MistralSync.hasKey(SYNC_KEY);
  }

  /**
   * Ecouteur de l'evenement 'mistral-sync-complete'.
   *
   * Etapes :
   *   1. Charge les gammes depuis MistralSync (table `gammes`) dans le tableau `gammes`.
   *   2. Tente de charger les lots publies depuis la table `configuration`
   *      (namespace='configurateur', key='published_lots').
   *   3. En fallback, charge l'ancienne cle 'active_gammes' (liste plate de codes).
   *   4. Emet l'evenement 'gammesUpdated' via dispatchUpdate().
   */
  // Charger les gammes + lots publiés depuis Supabase
  window.addEventListener('mistral-sync-complete', function() {
    // 1. Charger les gammes depuis MistralSync (table gammes)
    if (window.MistralSync && MistralSync.hasKey(SYNC_KEY)) {
      const data = MistralSync.getData(SYNC_KEY);
      if (Array.isArray(data) && data.length > 0) {
        gammes = data;
      }
    }

    // 2. Charger les lots publiés (namespace=configurateur)
    if (!window.MistralDB) { dispatchUpdate(); return; }
    const client = MistralDB.getClient();
    if (!client) { dispatchUpdate(); return; }

    // Essayer d'abord published_lots (nouveau format), puis fallback active_gammes
    client
      .from('configuration')
      .select('value')
      .eq('namespace', 'configurateur')
      .eq('key', 'published_lots')
      .maybeSingle()
      .then(function(result) {
        const data = result.data;
        if (data && data.value != null) {
          try {
            const lots = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            if (Array.isArray(lots) && lots.length > 0) {
              publishedLots = lots;
              activeBatchCodes = lots.reduce(function(acc, l) {
                return acc.concat(l.gammes || []);
              }, []);
              dispatchUpdate();
              return;
            }
          } catch (e) { /* fallback */ }
        }

        // Fallback: lire legacy active_gammes
        return client
          .from('configuration')
          .select('value')
          .eq('namespace', 'configurateur')
          .eq('key', 'active_gammes')
          .maybeSingle();
      })
      .then(function(result) {
        if (!result || !result.data) return;
        const data = result.data;
        if (data && data.value != null) {
          try {
            const codes = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            if (Array.isArray(codes)) {
              activeBatchCodes = codes;
            }
          } catch (e) { /* garder null */ }
        }
      })
      .catch(function() {}) // Fail silently
      .finally(function() {
        dispatchUpdate();
      });
  });

  // ============================================================================
  // FONCTIONS UTILITAIRES
  // ============================================================================

  /**
   * Genere un identifiant unique pour une nouvelle gamme.
   * Format : 'gamme-' + timestamp base36 + 5 caracteres aleatoires base36.
   *
   * @returns {string} Identifiant unique (ex. 'gamme-m1abc2xyz5')
   */
  function generateId() {
    return MistralUtils.generateId('gamme');
  }

  // ============================================================================
  // LECTURE — Acces aux donnees des gammes
  // ============================================================================

  /**
   * Retourne toutes les gammes, triees par ordre croissant.
   * Les donnees proviennent du tableau en memoire (alimente par MistralSync
   * ou par DEFAULT_GAMMES en fallback).
   *
   * @returns {Array<Gamme>} Copie triee de toutes les gammes
   */
  function getAll() {
    // MistralSync data is loaded into 'gammes' at sync-complete
    // getAll() always reads from the in-memory array
    return [...gammes].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  }

  /**
   * Retourne les gammes disponibles (disponible === true), triees par ordre.
   *
   * @returns {Array<Gamme>} Gammes actives dans le catalogue
   */
  function getDisponibles() {
    return getAll().filter(g => g.disponible);
  }

  /**
   * Retourne les gammes a afficher dans le configurateur de la boutique.
   *
   * Logique de selection (par priorite) :
   *   1. Si des lots publies existent (publishedLots) : union de toutes les gammes
   *      de tous les lots, filtrees par disponibilite.
   *   2. Si un batch legacy est actif (activeBatchCodes) : gammes dont le code
   *      est dans la liste.
   *   3. Sinon : gammes disponibles avec visible_configurateur === true.
   *
   * @returns {Array<Gamme>} Gammes visibles dans le configurateur
   */
  function getForConfigurateur() {
    // Si des lots sont publiés, retourner l'union de toutes les gammes de tous les lots
    if (publishedLots !== null && publishedLots.length > 0) {
      let allCodes = [];
      publishedLots.forEach(function(l) { allCodes = allCodes.concat(l.gammes || []); });
      const uniqueCodes = allCodes.filter(function(c, i) { return allCodes.indexOf(c) === i; });
      return getAll().filter(function(g) { return g.disponible && uniqueCodes.indexOf(g.code) !== -1; });
    }
    // Legacy: si un batch est actif via activeBatchCodes
    if (activeBatchCodes !== null) {
      return getAll().filter(g => g.disponible && activeBatchCodes.includes(g.code));
    }
    return getAll().filter(g => g.disponible && g.visible_configurateur);
  }

  /**
   * Retourne les lots publiés pour le navigateur de la boutique
   * @returns {Array<Lot>|null} Liste de lots ou null si aucun lot publie
   */
  function getPublishedLots() {
    return publishedLots;
  }

  /**
   * Retourne les gammes disponibles appartenant a une categorie donnee.
   *
   * @param {string} categorie — Cle de categorie (ex. 'debutant', 'oriental', 'modal')
   * @returns {Array<Gamme>} Gammes de la categorie demandee
   */
  function getByCategorie(categorie) {
    return getDisponibles().filter(g => g.categorie === categorie);
  }

  /**
   * Recherche une gamme par son code (comparaison insensible a la casse).
   *
   * @param {string} code — Code de la gamme (ex. 'kurd', 'HIJAZ')
   * @returns {Gamme|null} La gamme trouvee ou null
   */
  function getByCode(code) {
    if (!code) return null;
    return gammes.find(g => g.code.toLowerCase() === code.toLowerCase()) || null;
  }

  /**
   * Recherche une gamme par son identifiant unique.
   *
   * @param {string} id — Identifiant (ex. 'gamme-kurd', 'gamme-m1abc2xyz5')
   * @returns {Gamme|null} La gamme trouvee ou null
   */
  function getById(id) {
    return gammes.find(g => g.id === id) || null;
  }

  /**
   * Retourne un libelle formate pour une gamme.
   *
   * @param {string} code   — Code de la gamme
   * @param {string} [format='short'] — Format souhaite :
   *   - 'short' : nom seul (ex. 'Kurd')
   *   - 'full'  : nom + categorie (ex. 'Kurd (Debutant)')
   *   - 'code'  : code brut (ex. 'kurd')
   * @returns {string} Libelle formate, ou le code brut si la gamme n'est pas trouvee
   */
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
   * Verifie si une gamme possede des patterns pour le configurateur
   * (soit via custom_layouts, soit via SCALES_DATA de scales-data.js).
   *
   * @param {string} code — Code de la gamme
   * @returns {boolean} true si au moins un pattern existe pour cette gamme
   */
  function hasConfiguratorPatterns(code) {
    // custom_layouts a priorite
    const gamme = getByCode(code);
    if (gamme && gamme.custom_layouts && Object.keys(gamme.custom_layouts).length > 0) {
      return true;
    }
    // Fallback SCALES_DATA
    if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA[code]) {
      return MistralScales.SCALES_DATA[code].patterns !== null;
    }
    return false;
  }

  /**
   * Retourne le pattern (disposition des notes) pour une gamme et un nombre de notes donne.
   *
   * Priorite :
   *   1. custom_layouts de la gamme (defini par l'admin)
   *   2. SCALES_DATA.patterns de scales-data.js (hardcode)
   *
   * @param {string} code      — Code de la gamme (ex. 'kurd')
   * @param {number} noteCount — Nombre de notes souhaite (ex. 9, 10, 11)
   * @returns {Array<string>|null} Tableau de notes ordonnees, ou null si aucun pattern
   */
  function getPattern(code, noteCount) {
    const gamme = getByCode(code);

    // custom_layouts a priorite
    if (gamme && gamme.custom_layouts && gamme.custom_layouts[noteCount]) {
      return gamme.custom_layouts[noteCount];
    }

    // Fallback SCALES_DATA
    if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA[code]) {
      const scaleData = MistralScales.SCALES_DATA[code];
      return scaleData.patterns ? scaleData.patterns[noteCount] : null;
    }

    return null;
  }

  /**
   * Retourne les baseNotes pour une gamme
   * Priorite : gamme.baseNotes > SCALES_DATA[code].baseNotes
   *
   * Les baseNotes representent la configuration standard de la gamme
   * (typiquement 8-9 notes pour un handpan classique).
   *
   * @param {string} code — Code de la gamme
   * @returns {Array<string>} Tableau de notes (ex. ['D3', 'A3', 'Bb3', ...]) ou tableau vide
   */
  function getBaseNotes(code) {
    const gamme = getByCode(code);
    if (gamme && gamme.baseNotes && gamme.baseNotes.length > 0) {
      return gamme.baseNotes;
    }
    if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA[code]) {
      return MistralScales.SCALES_DATA[code].baseNotes || [];
    }
    return [];
  }

  /**
   * Retourne un objet unifie compatible avec boutique.js
   * Merge custom_layouts par-dessus SCALES_DATA patterns.
   *
   * Cette fonction est le point d'entree principal pour le configurateur :
   * elle fusionne les metadonnees de la gamme (depuis ce module) avec les
   * patterns musicaux (depuis scales-data.js), en donnant priorite aux
   * custom_layouts definis par l'administrateur.
   *
   * @param {string} code - Code de la gamme
   * @returns {ScaleDataConfigurateur|null} Objet unifie ou null si gamme inconnue
   *
   * @typedef {Object} ScaleDataConfigurateur
   * @property {string}  name        — Nom affichable de la gamme
   * @property {string}  baseRoot    — Note fondamentale (ex. 'D')
   * @property {number}  baseOctave  — Octave de base (ex. 3)
   * @property {string}  mode        — Mode musical (ex. 'aeolian')
   * @property {string}  description — Description textuelle
   * @property {string}  mood        — Ambiance / atmosphere
   * @property {Array<string>} baseNotes — Notes de base de la gamme
   * @property {Object<number, Array<string>>|null} patterns
   *   — Patterns par nombre de notes (fusionne SCALES_DATA + custom_layouts),
   *     ou null si aucun pattern n'existe
   */
  function getScaleDataForConfigurateur(code) {
    const gamme = getByCode(code);
    if (!gamme) return null;

    const scalesData = (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA[code])
      ? MistralScales.SCALES_DATA[code]
      : null;

    // Merge patterns : SCALES_DATA comme base, custom_layouts par-dessus
    const patterns = {};
    if (scalesData && scalesData.patterns) {
      Object.assign(patterns, scalesData.patterns);
    }
    if (gamme.custom_layouts) {
      Object.keys(gamme.custom_layouts).forEach(function(key) {
        if (gamme.custom_layouts[key]) {
          patterns[key] = gamme.custom_layouts[key];
        }
      });
    }

    return {
      name: gamme.nom,
      baseRoot: gamme.baseRoot || (scalesData ? scalesData.baseRoot : 'D'),
      baseOctave: gamme.baseOctave || (scalesData ? scalesData.baseOctave : 3),
      mode: gamme.mode || (scalesData ? scalesData.mode : 'aeolian'),
      description: gamme.description || '',
      mood: gamme.mood || '',
      baseNotes: getBaseNotes(code),
      patterns: Object.keys(patterns).length > 0 ? patterns : null
    };
  }

  /**
   * Genere le HTML des options <option> pour un element <select>.
   *
   * @param {string}  [selected='']               — Code de la gamme pre-selectionnee
   * @param {boolean} [configurateurOnly=false]    — Si true, n'inclut que les gammes
   *                                                  visibles dans le configurateur
   * @returns {string} Chaine HTML des balises <option>
   *
   * @example
   *   // Toutes les gammes disponibles, 'kurd' pre-selectionnee
   *   document.querySelector('select').innerHTML = MistralGammes.toSelectOptions('kurd');
   *
   * @example
   *   // Uniquement les gammes du configurateur
   *   document.querySelector('select').innerHTML = MistralGammes.toSelectOptions('', true);
   */
  function toSelectOptions(selected = '', configurateurOnly = false) {
    const list = configurateurOnly ? getForConfigurateur() : getDisponibles();
    return list.map(g => {
      const isSelected = g.code.toLowerCase() === selected.toLowerCase() ? ' selected' : '';
      const catLabel = CATEGORIES[g.categorie] ? ` (${CATEGORIES[g.categorie].label})` : '';
      return `<option value="${g.code}"${isSelected}>${g.nom}${catLabel}</option>`;
    }).join('');
  }

  /**
   * Retourne les gammes disponibles regroupees par categorie.
   * Seules les categories ayant au moins une gamme sont incluses.
   *
   * @returns {Object<string, CategorieGroup>} Dictionnaire indexe par cle de categorie
   *
   * @typedef {Object} CategorieGroup
   * @property {string}       label  — Libelle de la categorie (ex. 'Debutant')
   * @property {Array<Gamme>} gammes — Gammes de cette categorie
   *
   * @example
   *   // { debutant: { label: 'Debutant', gammes: [...] }, oriental: { ... } }
   *   const grouped = MistralGammes.getGroupedByCategorie();
   */
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
  // ADMIN (CRUD) - Operations en memoire avec persistance Supabase
  // ============================================================================

  /**
   * Sauvegarde une gamme (creation ou mise a jour).
   *
   * - Si `gamme.id` existe et correspond a une gamme connue : mise a jour (merge).
   * - Si `gamme.id` existe mais n'est pas trouve : ajout en fin de liste.
   * - Si `gamme.id` est absent : creation avec un nouvel ID genere.
   *
   * Persiste automatiquement via MistralSync (memoire + Supabase).
   * Emet l'evenement 'gammesUpdated'.
   *
   * @param {Gamme} gamme — Objet gamme a sauvegarder (partiel ou complet)
   * @returns {Gamme} La gamme sauvegardee (avec id, created_at, updated_at)
   */
  function save(gamme) {
    const now = new Date().toISOString();

    if (gamme.id) {
      const index = gammes.findIndex(g => g.id === gamme.id);
      if (index !== -1) {
        gammes[index] = { ...gammes[index], ...gamme, updated_at: now };
      } else {
        gamme.updated_at = now;
        gammes.push(gamme);
      }
    } else {
      gamme.id = generateId();
      gamme.created_at = now;
      gamme.updated_at = now;
      if (!gamme.custom_layouts) gamme.custom_layouts = {};
      if (!gamme.baseNotes) gamme.baseNotes = [];
      gammes.push(gamme);
    }

    // Sauvegarder via MistralSync (memoire + Supabase)
    if (window.MistralSync) {
      MistralSync.setData(SYNC_KEY, gammes);
    }

    dispatchUpdate();
    return gamme;
  }

  /**
   * Supprime une gamme par son identifiant.
   *
   * Utilise MistralSync.setDataLocal pour la memoire et
   * MistralSync.deleteFromSupabase pour la suppression cote serveur.
   * Emet 'gammesUpdated' si la suppression a eu lieu.
   *
   * @param {string} id — Identifiant de la gamme a supprimer
   * @returns {boolean} true si une gamme a ete supprimee, false sinon
   */
  function remove(id) {
    const filtered = gammes.filter(g => g.id !== id);
    if (filtered.length !== gammes.length) {
      gammes = filtered;
      if (window.MistralSync) {
        MistralSync.setDataLocal(SYNC_KEY, gammes);
        MistralSync.deleteFromSupabase(SYNC_KEY, id);
      }
      dispatchUpdate();
      return true;
    }
    return false;
  }

  /**
   * Sauvegarde un layout personnalise pour une gamme et un nombre de notes.
   *
   * Le custom_layout a priorite sur le pattern de SCALES_DATA lors de la
   * resolution dans getPattern() et getScaleDataForConfigurateur().
   *
   * @param {string}        code      — Code de la gamme (ex. 'kurd')
   * @param {number}        noteCount — Nombre de notes (ex. 9, 10, 11)
   * @param {Array<string>} pattern   — Tableau de notes ordonnees
   * @returns {Gamme|false} La gamme mise a jour, ou false si gamme non trouvee
   */
  function saveCustomLayout(code, noteCount, pattern) {
    const gamme = getByCode(code);
    if (!gamme) return false;

    if (!gamme.custom_layouts) gamme.custom_layouts = {};
    gamme.custom_layouts[noteCount] = pattern;
    return save(gamme);
  }

  /**
   * Supprime un layout personnalise pour une gamme et un nombre de notes.
   * Le pattern de SCALES_DATA reprendra effet pour ce nombre de notes.
   *
   * @param {string} code      — Code de la gamme
   * @param {number} noteCount — Nombre de notes a supprimer
   * @returns {Gamme|false} La gamme mise a jour, ou false si gamme/layout non trouve
   */
  function removeCustomLayout(code, noteCount) {
    const gamme = getByCode(code);
    if (!gamme || !gamme.custom_layouts) return false;

    delete gamme.custom_layouts[noteCount];
    return save(gamme);
  }

  /**
   * Reordonne les gammes selon un tableau d'identifiants.
   * Chaque gamme recoit un nouvel `ordre` correspondant a sa position dans le tableau.
   * Emet 'gammesUpdated'.
   *
   * @param {Array<string>} orderedIds — Identifiants dans l'ordre souhaite
   */
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

  /**
   * Reinitialise toutes les gammes aux valeurs par defaut (DEFAULT_GAMMES).
   * Ecrase les donnees en memoire et dans Supabase.
   * Emet 'gammesUpdated'.
   */
  function reset() {
    gammes = [...DEFAULT_GAMMES];
    if (window.MistralSync) {
      MistralSync.setData(SYNC_KEY, gammes);
    }
    dispatchUpdate();
  }

  // ============================================================================
  // BATCHES — Collections nommees de gammes pour le configurateur
  // ============================================================================
  //
  // Un "batch" (ou "lot") est une collection nommee de gammes, geree dans la
  // configuration gestion (MistralGestion). Les lots peuvent etre publies
  // dans le configurateur de la boutique via publishBatch / unpublishBatch.
  //
  // Structure d'un batch :
  //   @typedef {Object} Batch
  //   @property {string}        id        — Identifiant unique (ex. 'batch-m1abc2xyz')
  //   @property {string}        nom       — Nom affichable (ex. 'Collection Ete 2026')
  //   @property {Array<string>} gammes    — Codes des gammes incluses
  //   @property {boolean}       published — true si publie dans le configurateur
  //   @property {number}        ordre     — Position de tri
  //   @property {boolean}       [active]  — (legacy) ancien champ de batch unique
  //
  // Stockage : MistralGestion.getConfig().gamme_batches (Array<Batch>)
  // Publication : table `configuration` (namespace='configurateur')
  // ============================================================================

  /**
   * Récupère les batches depuis la config gestion
   * @returns {Array<Batch>} Liste des batches, ou tableau vide si MistralGestion indisponible
   */
  function getBatches() {
    if (typeof MistralGestion === 'undefined') return [];
    const config = MistralGestion.getConfig();
    return config.gamme_batches || [];
  }

  /**
   * Sauvegarde un batch (création ou mise à jour).
   *
   * - Si `batch.id` existe : mise a jour du batch existant (merge).
   * - Si `batch.id` est absent : creation avec un ID genere automatiquement.
   *   Les champs `ordre` et `published` sont initialises si absents.
   *
   * Persiste via MistralGestion.setConfigValue.
   *
   * @param {Batch} batch — Objet batch a sauvegarder
   * @returns {Batch|null} Le batch sauvegarde, ou null si MistralGestion indisponible
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
      if (batch.ordre === undefined) batch.ordre = batches.length + 1;
      if (batch.published === undefined) batch.published = false;
      batches.push(batch);
    }

    MistralGestion.setConfigValue('gamme_batches', batches);
    return batch;
  }

  /**
   * Supprime un batch. Si le batch était publié, re-sync les lots publiés.
   *
   * Nettoie egalement la reference legacy `gamme_batch_active` si elle
   * pointait vers le batch supprime.
   *
   * @param {string} id — Identifiant du batch a supprimer
   * @returns {boolean} true si la suppression a reussi, false si MistralGestion indisponible
   */
  function removeBatch(id) {
    if (typeof MistralGestion === 'undefined') return false;
    const batchToRemove = getBatches().find(b => b.id === id);
    const batches = getBatches().filter(b => b.id !== id);
    MistralGestion.setConfigValue('gamme_batches', batches);

    // Si c'était un batch publié, re-synchroniser
    if (batchToRemove && batchToRemove.published) {
      syncPublishedLots();
    }

    // Legacy cleanup
    const config = MistralGestion.getConfig();
    if (config.gamme_batch_active === id) {
      MistralGestion.setConfigValue('gamme_batch_active', null);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // PUBLICATION MULTI-LOTS
  // --------------------------------------------------------------------------
  //
  // Systeme de publication permettant de rendre visible un ou plusieurs lots
  // dans le configurateur cote boutique. Les lots publies sont ecrits dans la
  // table Supabase `configuration` (namespace='configurateur') et lus au
  // chargement de la page via l'ecouteur 'mistral-sync-complete'.
  // --------------------------------------------------------------------------

  /**
   * Publie un lot dans le configurateur (visible côté boutique).
   * Marque le batch comme `published = true` et synchronise vers Supabase.
   *
   * @async
   * @param {string} id — Identifiant du batch a publier
   * @returns {Promise<boolean>} true si la publication a reussi, false sinon
   */
  async function publishBatch(id) {
    if (typeof MistralGestion === 'undefined') return false;
    const batches = getBatches();
    const batch = batches.find(b => b.id === id);
    if (!batch) return false;

    batch.published = true;
    MistralGestion.setConfigValue('gamme_batches', batches);

    await syncPublishedLots();
    return true;
  }

  /**
   * Dépublie un lot (le retire du configurateur).
   * Marque le batch comme `published = false` et synchronise vers Supabase.
   *
   * @async
   * @param {string} id — Identifiant du batch a depublier
   * @returns {Promise<boolean>} true si la depublication a reussi, false sinon
   */
  async function unpublishBatch(id) {
    if (typeof MistralGestion === 'undefined') return false;
    const batches = getBatches();
    const batch = batches.find(b => b.id === id);
    if (!batch) return false;

    batch.published = false;
    MistralGestion.setConfigValue('gamme_batches', batches);

    await syncPublishedLots();
    return true;
  }

  /**
   * Synchronise tous les lots publiés vers Supabase (namespace=configurateur).
   * Met à jour l'état local (publishedLots, activeBatchCodes) et dispatch
   * l'événement 'gammesUpdated'.
   *
   * Ecrit deux cles dans la table `configuration` :
   *   - 'published_lots' : format lot complet (nouveau systeme)
   *   - 'active_gammes'  : liste plate de codes (backward compat)
   *
   * Si aucun lot n'est publie, les deux cles sont supprimees de Supabase
   * et le configurateur revient au mode par defaut (visible_configurateur).
   *
   * @async
   * @returns {Promise<void>}
   */
  async function syncPublishedLots() {
    const batches = getBatches().filter(b => b.published);

    if (batches.length === 0) {
      // Aucun lot publié → revenir au mode par défaut
      publishedLots = null;
      activeBatchCodes = null;
      await publishToSupabase('published_lots', null);
      await publishToSupabase('active_gammes', null);
    } else {
      // Construire les lots pour publication
      const lots = batches
        .sort(function(a, b) { return (a.ordre || 0) - (b.ordre || 0); })
        .map(function(b) {
          return { id: b.id, nom: b.nom, gammes: b.gammes || [], ordre: b.ordre || 0 };
        });

      publishedLots = lots;

      // Calculer la liste plate pour backward compat
      let allCodes = [];
      lots.forEach(function(l) { allCodes = allCodes.concat(l.gammes || []); });
      activeBatchCodes = allCodes.filter(function(c, i) { return allCodes.indexOf(c) === i; });

      await publishToSupabase('published_lots', lots);
      await publishToSupabase('active_gammes', activeBatchCodes);
    }

    dispatchUpdate();
  }

  /**
   * Publie (ou supprime) une clé dans le namespace configurateur (RLS publique).
   *
   * Utilise un upsert (INSERT ... ON CONFLICT UPDATE) sur la table `configuration`
   * avec la contrainte unique (key, namespace).
   * Si `value` est null, la ligne est supprimee.
   *
   * @async
   * @param {string} key   — Cle de configuration (ex. 'published_lots', 'active_gammes')
   * @param {*}      value — Valeur a publier (serialisee en JSON), ou null pour supprimer
   * @returns {Promise<void>}
   */
  async function publishToSupabase(key, value) {
    if (!window.MistralDB) return;
    const client = MistralDB.getClient();
    if (!client) return;

    try {
      if (value === null) {
        const { error } = await client
          .from('configuration')
          .delete()
          .eq('namespace', 'configurateur')
          .eq('key', key);
        if (error) throw error;
      } else {
        const { error } = await client
          .from('configuration')
          .upsert({
            key: key,
            value: JSON.stringify(value),
            namespace: 'configurateur',
            updated_at: new Date().toISOString()
          }, { onConflict: 'key,namespace' });
        if (error) throw error;
      }
    } catch (err) {
      console.error('[publishToSupabase] Erreur pour la cle "' + key + '":', err);
    }
  }

  // --------------------------------------------------------------------------
  // LEGACY (deprecated, gardé pour backward compat)
  // --------------------------------------------------------------------------
  //
  // Ces fonctions proviennent de l'ancien systeme de batch unique.
  // Elles sont conservees pour la retro-compatibilite mais ne doivent plus
  // etre utilisees dans le nouveau code. Preferer publishBatch/unpublishBatch.
  // --------------------------------------------------------------------------

  /**
   * @deprecated Utiliser publishBatch() à la place.
   * Alias de publishBatch pour la retro-compatibilite.
   *
   * @async
   * @param {string} id — Identifiant du batch
   * @returns {Promise<boolean>}
   */
  async function activateBatch(id) {
    return publishBatch(id);
  }

  /**
   * @deprecated Utiliser unpublishBatch() sur chaque lot à la place.
   * Depublie tous les batches d'un coup (ancien comportement de desactivation globale).
   *
   * @async
   * @returns {Promise<void>}
   */
  async function deactivateAllBatches() {
    if (typeof MistralGestion === 'undefined') return;
    const batches = getBatches();
    batches.forEach(function(b) { b.published = false; });
    MistralGestion.setConfigValue('gamme_batches', batches);

    await syncPublishedLots();
  }

  /**
   * @deprecated Vérifier batch.published sur chaque lot à la place.
   * Retourne l'ancien ID de batch actif (systeme mono-batch).
   *
   * @returns {string|null} ID du batch actif legacy, ou null
   */
  function getActiveBatchId() {
    if (typeof MistralGestion === 'undefined') return null;
    return MistralGestion.getConfig().gamme_batch_active || null;
  }

  // ============================================================================
  // EVENEMENTS — Notification des modifications
  // ============================================================================

  /**
   * Emet l'evenement personnalise 'gammesUpdated' sur window.
   * Tout module ecoutant cet evenement peut reagir aux changements
   * (ex. mise a jour du configurateur, rafraichissement de l'admin).
   *
   * @fires window#gammesUpdated
   * @private
   */
  function dispatchUpdate() {
    window.dispatchEvent(new CustomEvent('gammesUpdated', {
      detail: { gammes: getAll() }
    }));
  }

  // ============================================================================
  // EXPORTS — API publique du module
  // ============================================================================
  //
  // Expose toutes les fonctions et constantes sur window.MistralGammes.
  // Organisation :
  //   - Lecture        : acces en lecture seule aux donnees des gammes
  //   - Admin          : operations CRUD (necessitent une session admin)
  //   - Batches        : gestion des lots / collections de gammes
  //   - Deprecated     : fonctions conservees pour retro-compatibilite
  //   - Constantes     : CATEGORIES et DEFAULT_GAMMES
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
    getBaseNotes,
    getScaleDataForConfigurateur,
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
    publishBatch,
    unpublishBatch,
    getPublishedLots,

    // Deprecated (backward compat)
    activateBatch,
    deactivateAllBatches,
    getActiveBatchId,

    // Constantes
    CATEGORIES,
    DEFAULT_GAMMES
  };

})();
