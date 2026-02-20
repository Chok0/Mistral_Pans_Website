/**
 * =============================================================================
 * MISTRAL PANS - Module de Faisabilité des Gammes (Simplifié)
 * =============================================================================
 * 
 * Vérifie si une configuration handpan est réalisable.
 * - Colore les chips de tonalité selon la faisabilité
 * - Bloque le bouton commander si impossible
 * 
 * =============================================================================
 */

const FeasibilityModule = (function() {

  // Notification legere — delegue au systeme global ou admin
  function showNotice(message) {
    if (window.MistralToast) {
      MistralToast.warning(message);
      return;
    }
    if (window.MistralAdmin && MistralAdmin.Toast) {
      MistralAdmin.Toast.warning(message);
      return;
    }
    // Fallback inline
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      background: '#D97706', color: '#fff',
      padding: '12px 24px', borderRadius: '8px', zIndex: '2000',
      fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: '90vw'
    });
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 5000);
  }
  
  // ===========================================================================
  // DONNÉES
  // ===========================================================================
  
  // Table des surfaces par note (mm²)
  const NOTE_SURFACE_TABLE = {
    // Octave 2
    'E2': 37149, 'F2': 35190, 'F#2': 33282, 'G2': 31426,
    'G#2': 29622, 'A2': 27868, 'A#2': 26167, 'B2': 24517,
    // Octave 3
    'C3': 22919, 'C#3': 21372, 'D3': 19877, 'D#3': 18899,
    'E3': 17945, 'F3': 17015, 'F#3': 16109, 'G3': 15228,
    'G#3': 14371, 'A3': 13538, 'A#3': 12729, 'B3': 11944,
    // Octave 4
    'C4': 11184, 'C#4': 10447, 'D4': 9735, 'D#4': 9047,
    'E4': 8384, 'F4': 7744, 'F#4': 7245, 'G4': 6763,
    'G#4': 6297, 'A4': 5848, 'A#4': 5606, 'B4': 5369,
    // Octave 5
    'C5': 5137, 'C#5': 4910, 'D5': 4688, 'D#5': 4471,
    'E5': 4259, 'F5': 4053
  };
  
  // Seuils par taille de tôle (fallback hardcoded)
  // Pourcentages: OK ≤45%, WARNING ≤50%, DIFFICULT ≤59%, IMPOSSIBLE >59%
  const DEFAULT_FEASIBILITY_BY_SIZE = {
    '53': {
      SHELL: 272900,
      COMFORT: 122805,   // 45% - OK jusqu'ici
      WARNING: 136450,   // 50% - WARNING jusqu'ici
      MAX: 161011,       // 59% - DIFFICULT jusqu'ici, au-delà IMPOSSIBLE
      FORBIDDEN_NOTES: ['A#4']
    },
    '50': {
      SHELL: 235200,
      COMFORT: 105840,   // 45%
      WARNING: 117600,   // 50%
      MAX: 138768,       // 59%
      FORBIDDEN_NOTES: ['B4']
    },
    '45': {
      SHELL: 182400,
      COMFORT: 82080,    // 45%
      WARNING: 91200,    // 50%
      MAX: 107616,       // 59%
      FORBIDDEN_NOTES: ['C#5']
    }
  };

  /**
   * Build FEASIBILITY_BY_SIZE from MistralTailles if available.
   * Computes absolute thresholds from shell area + percentages.
   */
  function buildFeasibilityMap() {
    if (typeof MistralTailles === 'undefined') return DEFAULT_FEASIBILITY_BY_SIZE;

    const tailles = MistralTailles.getAll();
    const map = {};
    tailles.forEach(t => {
      const f = t.feasibility;
      if (f && f.shell) {
        map[t.code] = {
          SHELL: f.shell,
          COMFORT: Math.round(f.shell * (f.comfortPct || 45) / 100),
          WARNING: Math.round(f.shell * (f.warningPct || 50) / 100),
          MAX: Math.round(f.shell * (f.maxPct || 59) / 100),
          FORBIDDEN_NOTES: f.forbiddenNotes || []
        };
      }
    });

    // Merge with defaults for any missing sizes
    return { ...DEFAULT_FEASIBILITY_BY_SIZE, ...map };
  }

  // Read dynamically so admin changes take effect immediately
  let FEASIBILITY_BY_SIZE = buildFeasibilityMap();

  // Refresh when tailles data changes
  if (typeof window !== 'undefined') {
    window.addEventListener('taillesUpdated', () => {
      FEASIBILITY_BY_SIZE = buildFeasibilityMap();
    });
  }
  
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // ===========================================================================
  // FONCTIONS UTILITAIRES
  // ===========================================================================
  
  function getNoteSurface(note, octave) {
    const key = `${note}${octave}`;
    if (NOTE_SURFACE_TABLE[key]) return NOTE_SURFACE_TABLE[key];
    
    const noteIndex = NOTE_NAMES.indexOf(note);
    const chromaticPos = (octave - 2) * 12 + noteIndex - 4;
    
    if (chromaticPos < 0) {
      return Math.round(37149 * Math.pow(1.06, Math.abs(chromaticPos)));
    } else if (chromaticPos > 37) {
      return Math.round(4053 * Math.pow(0.95, chromaticPos - 37));
    }
    return 10000;
  }
  
  function calculateTopSurface(notes) {
    const topNotes = notes.filter(n => n.type !== 'bottom');
    return topNotes.reduce((sum, n) => sum + getNoteSurface(n.note, n.octave), 0);
  }
  
  function isNoteForbidden(note, octave, size) {
    const thresholds = FEASIBILITY_BY_SIZE[size] || FEASIBILITY_BY_SIZE['53'];
    const noteKey = `${note}${octave}`;
    return thresholds.FORBIDDEN_NOTES.includes(noteKey);
  }
  
  function findImpossibleNotes(notes, size) {
    return notes.filter(n => n.type !== 'bottom' && isNoteForbidden(n.note, n.octave, size));
  }
  
  // ===========================================================================
  // FONCTION PRINCIPALE
  // ===========================================================================
  
  function checkFeasibility(notes, size) {
    const thresholds = FEASIBILITY_BY_SIZE[size] || FEASIBILITY_BY_SIZE['53'];
    const surface = calculateTopSurface(notes);
    const ratio = surface / thresholds.SHELL;
    
    // Vérifier les notes interdites
    const impossibleNotes = findImpossibleNotes(notes, size);
    if (impossibleNotes.length > 0) {
      return { 
        feasible: false, 
        status: 'impossible', 
        surface, 
        ratio, 
        message: `Note(s) en conflit avec la cavité`,
        impossibleNotes,
        thresholds
      };
    }
    
    // Vérifier la surface
    if (surface <= thresholds.COMFORT) {
      // ≤45% → OK
      return { feasible: true, status: 'ok', surface, ratio, message: 'Configuration standard', thresholds };
    } else if (surface <= thresholds.WARNING) {
      // 45-50% → WARNING
      return { feasible: true, status: 'warning', surface, ratio, message: 'Configuration avancée', thresholds };
    } else if (surface <= thresholds.MAX) {
      // 50-59% → DIFFICULT
      return { feasible: true, status: 'difficult', surface, ratio, message: 'Projet spécial requis', thresholds };
    } else {
      // >59% → IMPOSSIBLE
      return { feasible: false, status: 'impossible', surface, ratio, message: 'Surface trop importante', thresholds };
    }
  }
  
  // ===========================================================================
  // VÉRIFICATION DE TOUTES LES TONALITÉS
  // ===========================================================================
  
  function checkAllTonalities(state, SCALES_DATA, parsePatternFn) {
    const scaleData = SCALES_DATA[state.scale];
    const pattern = scaleData.patterns[state.notes];
    const tonalities = ['F2','F#2','G2','G#2','A2','A#2','B2','C3','C#3','D3','D#3','E3','F3','F#3','G3'];
    const results = {};
    
    tonalities.forEach(tonality => {
      const targetMatch = tonality.match(/^([A-G]#?)(\d)$/);
      const targetNote = targetMatch[1];
      const targetOctave = parseInt(targetMatch[2]);
      
      const baseIndex = NOTE_NAMES.indexOf(scaleData.baseRoot) + scaleData.baseOctave * 12;
      const targetIndex = NOTE_NAMES.indexOf(targetNote) + targetOctave * 12;
      const transpose = targetIndex - baseIndex;
      
      const notes = parsePatternFn(pattern, scaleData.baseRoot, scaleData.baseOctave, transpose);
      results[tonality] = checkFeasibility(notes, state.size);
    });
    
    return results;
  }
  
  // ===========================================================================
  // MISE À JOUR UI - CHIPS TONALITÉ
  // ===========================================================================
  
  function updateTonalityChips(state, SCALES_DATA, parsePatternFn) {
    const results = checkAllTonalities(state, SCALES_DATA, parsePatternFn);
    
    document.querySelectorAll('#chips-tonality .chip').forEach(chip => {
      const tonality = chip.dataset.value;
      const result = results[tonality];
      
      chip.classList.remove('chip--disabled');
      chip.disabled = false;
      chip.title = '';
      
      if (!result) return;
      
      // Seulement grisé si impossible
      if (result.status === 'impossible') {
        chip.classList.add('chip--disabled');
        chip.disabled = true;
        if (result.impossibleNotes?.length > 0) {
          const notesList = result.impossibleNotes.map(n => `${n.note}${n.octave}`).join(', ');
          chip.title = `${notesList} incompatible avec cette taille`;
        } else {
          chip.title = `Configuration non réalisable`;
        }
      }
    });
    
    return results;
  }
  
  // ===========================================================================
  // MISE À JOUR UI - HINT SOUS LES NOTES
  // ===========================================================================
  
  function updateNotesHint(result, noteCount, hintSelector) {
    const hint = document.querySelector(hintSelector);
    if (!hint) return;
    
    // Priorité 1: Maximum de notes atteint
    if (noteCount >= 17) {
      hint.innerHTML = 'Maximum atteint. <a href="#" data-modal="contact">Projet spécial ?</a>';
      return;
    }
    
    // Priorité 2: Configuration impossible
    if (result.status === 'impossible') {
      if (result.impossibleNotes?.length > 0) {
        const notesList = result.impossibleNotes.map(n => `${n.note}${n.octave}`).join(', ');
        hint.innerHTML = `<span style="color: #c62828;">Configuration impossible (${notesList})</span>`;
      } else {
        hint.innerHTML = '<span style="color: #c62828;">Configuration non réalisable</span>';
      }
      return;
    }
    
    // Priorité 3: Projet spécial requis
    if (result.status === 'difficult') {
      hint.innerHTML = '<span style="color: #e65100;">Projet spécial requis</span>';
      return;
    }
    
    // Priorité 4: Configuration avancée (beaucoup de notes OU warning surface)
    if (noteCount >= 14 || result.status === 'warning') {
      hint.textContent = 'Configuration avancée';
      return;
    }
    
    // Sinon: rien
    hint.textContent = '';
  }
  
  // ===========================================================================
  // MISE À JOUR UI - BOUTON COMMANDER
  // ===========================================================================
  
  function updateOrderButton(result, size, buttonSelector, configName) {
    const orderBtn = document.querySelector(buttonSelector);
    const cartBtn = document.querySelector('#btn-add-cart');

    if (result.status === 'impossible') {
      // Config impossible: boutons grisés
      if (orderBtn) {
        orderBtn.textContent = 'Configuration non réalisable';
        orderBtn.classList.add('btn--disabled');
        orderBtn.dataset.blocked = 'true';
      }
      if (cartBtn) {
        cartBtn.textContent = 'Configuration non réalisable';
        cartBtn.classList.add('btn--disabled');
        cartBtn.dataset.blocked = 'true';
      }
    } else if (result.status === 'difficult') {
      // Config difficile: bouton "Vérifier la faisabilité" qui ouvre la modale
      if (orderBtn) {
        orderBtn.textContent = 'Vérifier la faisabilité';
        orderBtn.classList.remove('btn--disabled');
        orderBtn.dataset.blocked = 'contact';
        orderBtn.dataset.contactMessage = 'Bonjour,\n\nJe serais intéressé par un ' + (configName || 'handpan') + ' (' + size + 'cm).\n\nPouvez-vous me renseigner sur la faisabilité de cette configuration ?\n\nMerci !';
      }
      if (cartBtn) {
        cartBtn.textContent = 'Vérifier la faisabilité';
        cartBtn.classList.remove('btn--disabled');
        cartBtn.dataset.blocked = 'contact';
        cartBtn.dataset.contactMessage = orderBtn ? orderBtn.dataset.contactMessage : '';
      }
    } else {
      // Config OK ou warning: comportement normal
      if (orderBtn) {
        orderBtn.textContent = 'Commander directement';
        orderBtn.classList.remove('btn--disabled');
        delete orderBtn.dataset.blocked;
      }
      if (cartBtn) {
        cartBtn.textContent = 'Ajouter au panier';
        cartBtn.classList.remove('btn--disabled');
        delete cartBtn.dataset.blocked;
      }
    }
  }
  
  // ===========================================================================
  // INJECTION CSS (Palette Teal Mistral Pans)
  // ===========================================================================
  
  function injectStyles() {
    if (document.getElementById('feasibility-styles')) return;
    
    const css = `
      /* Chip Disabled - Grisé */
      .chip--disabled {
        background: #e8e8e8 !important;
        border-color: #ccc !important;
        color: #999 !important;
        cursor: not-allowed !important;
        opacity: 0.7;
      }
      .chip--disabled:hover {
        transform: none !important;
        box-shadow: none !important;
        background: #e8e8e8 !important;
      }
      
      /* Bouton désactivé */
      .btn--disabled {
        background: #ccc !important;
        border-color: #bbb !important;
        color: #888 !important;
        cursor: not-allowed !important;
      }
      .btn--disabled:hover {
        background: #ccc !important;
        transform: none !important;
      }
    `;
    
    const style = document.createElement('style');
    style.id = 'feasibility-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }
  
  // ===========================================================================
  // API PUBLIQUE
  // ===========================================================================
  
  return {
    // Données (pour debug)
    NOTE_SURFACE_TABLE,
    get FEASIBILITY_BY_SIZE() { return FEASIBILITY_BY_SIZE; },
    
    // Fonctions de calcul
    checkFeasibility,
    checkAllTonalities,
    
    // Fonctions UI
    updateTonalityChips,
    updateNotesHint,
    updateOrderButton,
    injectStyles,
    
    // Initialisation
    init: function() {
      this.injectStyles();
    },
    
    // Mise à jour complète (à appeler dans updateDisplay)
    update: function(state, notes, SCALES_DATA, parsePatternFn, options = {}) {
      const { 
        orderButtonSelector = '#btn-order',
        hintSelector = '#notes-hint',
        configName = ''
      } = options;
      
      // 1. Mettre à jour les chips
      this.updateTonalityChips(state, SCALES_DATA, parsePatternFn);
      
      // 2. Vérifier la config actuelle
      const result = this.checkFeasibility(notes, state.size);
      
      // 3. Mettre à jour le hint sous les notes
      this.updateNotesHint(result, state.notes, hintSelector);
      
      // 4. Mettre à jour le bouton commander
      this.updateOrderButton(result, state.size, orderButtonSelector, configName);
      
      return result;
    }
  };
  
})();

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => FeasibilityModule.init());
} else {
  FeasibilityModule.init();
}
