/**
 * =============================================================================
 * MISTRAL PANS - Composant Handpan Player Interactif
 * =============================================================================
 *
 * Handpan virtuel interactif avec rendu SVG et lecture audio via Web Audio API.
 *
 * Ce module genere un instrument handpan cliquable/touchable en SVG, capable
 * d'afficher et jouer differentes gammes musicales. Il supporte deux modes :
 *   - Mode "gamme" : selection parmi les gammes de MistralScales (scales-data.js)
 *   - Mode "layout" : positionnement type par type (ding, tonales, mutants, bottoms)
 *     a partir d'une chaine notes_layout du configurateur
 *
 * Fonctionnalites :
 *   - Rendu SVG dynamique avec degrades et ombres
 *   - Lecture audio polyphonique (FLAC/MP3 selon support navigateur)
 *   - Support multi-touch pour appareils mobiles
 *   - Animation d'ondes circulaires au toucher
 *   - Retour haptique (vibration) sur mobile
 *   - Mode agrandi (plein ecran) avec overlay
 *   - Lecture sequentielle automatique (arpege montant puis descendant)
 *   - Notation musicale adaptative (anglo-saxonne / francaise)
 *   - Auto-initialisation via attributs data-* sur le HTML
 *
 * Dependances :
 *   - js/data/scales-data.js (MistralScales) — optionnel, fallback interne
 *   - ressources/audio/*.flac — echantillons audio (E2 a F5, 56 notes)
 *
 * Export :
 *   - Classe globale `HandpanPlayer` (instanciable)
 *   - module.exports pour environnements Node/CommonJS
 *
 * =============================================================================
 */

class HandpanPlayer {

  // ===========================================================================
  // PROPRIETES STATIQUES
  // ===========================================================================

  /** Compteur d'instances pour generer des IDs SVG uniques (evite les collisions de gradient/filtre) */
  static instanceCount = 0;

  // ===========================================================================
  // CONSTRUCTEUR & INITIALISATION
  // ===========================================================================

  /**
   * Cree une nouvelle instance du lecteur Handpan.
   *
   * Le constructeur resout le conteneur DOM, configure les options par defaut,
   * parse un eventuel layout personnalise, construit le dictionnaire de gammes,
   * detecte le format audio supporte, et lance le rendu initial.
   *
   * @param {string|HTMLElement} container - Selecteur CSS ou element DOM qui accueillera le player
   * @param {Object} [options={}] - Options de configuration
   * @param {string} [options.scale='kurd'] - Cle de la gamme par defaut (ex: 'kurd', 'hijaz')
   * @param {boolean} [options.showNoteNames=true] - Afficher les noms des notes sur le SVG
   * @param {boolean} [options.showScaleSelector=true] - Afficher le selecteur de gammes
   * @param {string} [options.accentColor='#0D7377'] - Couleur d'accentuation CSS
   * @param {number} [options.size=300] - Taille du SVG en pixels (largeur = hauteur)
   * @param {boolean} [options.enableHaptics=true] - Activer le retour haptique sur mobile
   * @param {boolean} [options.enableWaveAnimation=true] - Activer l'animation d'ondes au toucher
   * @param {string} [options.layout] - Chaine notes_layout (ex: "D/A-Bb-C-D-E-F-G-A") — active le mode type
   * @param {string} [options.audioPath='ressources/audio/'] - Chemin vers le dossier des echantillons
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      console.error('HandpanPlayer: Container not found');
      return;
    }

    /** Identifiant unique de cette instance (pour les IDs SVG internes) */
    this.instanceId = ++HandpanPlayer.instanceCount;

    // Fusion des options avec les valeurs par defaut
    this.options = {
      scale: options.scale || 'kurd',
      showNoteNames: options.showNoteNames !== false,
      showScaleSelector: options.showScaleSelector !== false,
      accentColor: options.accentColor || '#0D7377',
      size: options.size || 300,
      enableHaptics: options.enableHaptics !== false,
      enableWaveAnimation: options.enableWaveAnimation !== false,
      ...options
    };

    /**
     * Notes personnalisees issues du parsing d'un layout.
     * Si defini, le player passe en mode "type" (ding/tonales/mutants/bottoms)
     * et desactive le selecteur de gammes.
     * @type {Array<{name: string, type: string}>|null}
     */
    this.customNotes = null;
    if (options.layout) {
      this.customNotes = HandpanPlayer.parseLayout(options.layout);
      if (this.customNotes) {
        this.options.showScaleSelector = false;
      }
    }

    /**
     * Dictionnaire des gammes disponibles, construit depuis MistralScales
     * ou depuis un fallback interne si le module n'est pas charge.
     * Structure : { [cle]: { name, description, mood, notes: string[] } }
     */
    this.scales = this._buildScalesFromMistralScales();

    /** Cle de la gamme actuellement selectionnee */
    this.currentScale = this.options.scale;

    /**
     * Cache des objets Audio pre-charges, indexe par nom de fichier.
     * Evite de recharger un echantillon deja telecharge.
     * @type {Object.<string, HTMLAudioElement>}
     */
    this.audioCache = {};

    /**
     * Ensemble des clones Audio en cours de lecture.
     * Permet le nettoyage propre lors de la destruction de l'instance.
     * @type {Set<HTMLAudioElement>}
     */
    this.activeAudioClones = new Set();

    /** Chemin vers le repertoire des fichiers audio */
    this.audioPath = options.audioPath || 'ressources/audio/';

    /**
     * Detection du format audio supporte par le navigateur.
     * FLAC est prefere (meilleure qualite), MP3 en fallback (Safari/iOS ancien).
     */
    const probe = new Audio();
    this.audioExt = (probe.canPlayType('audio/flac') !== '') ? '.flac' : '.mp3';

    // --- Etat interne ---

    /** Indique si une lecture sequentielle de gamme est en cours */
    this.isPlaying = false;

    /** AbortController pour interrompre une lecture sequentielle en cours */
    this.playAbortController = null;

    /**
     * Map des gestionnaires d'evenements attaches, pour un nettoyage fiable.
     * Cle : identifiant unique, Valeur : { element, event, handler }
     * @type {Map<string, {element: Element, event: string, handler: Function}>}
     */
    this.boundHandlers = new Map();

    /**
     * Ensemble des IDs de setTimeout actifs.
     * Permet d'annuler tous les timers en cas de destruction.
     * @type {Set<number>}
     */
    this.activeTimeouts = new Set();

    /**
     * Contexte Web Audio API (partage entre instances si possible).
     * Initialise au premier clic utilisateur (restriction autoplay navigateurs).
     * @type {AudioContext|null}
     */
    this.audioContext = null;

    /**
     * Ecoute les changements de mode de notation (anglo-saxon <-> francais).
     * Quand l'utilisateur bascule la notation, on reconstruit les gammes
     * et on re-rend le player avec les nouveaux noms de notes.
     */
    this._onNotationChange = () => {
      this.scales = this._buildScalesFromMistralScales();
      this.render();
      this.bindEvents();
    };
    window.addEventListener('notation-mode-change', this._onNotationChange);

    this.init();
  }

  /**
   * Construit le dictionnaire de gammes a partir de MistralScales (source unifiee).
   *
   * Algorithme :
   * 1. Si MistralScales est disponible, itere sur SCALES_DATA
   * 2. Pour chaque gamme ayant des baseNotes, determine si la tonalite
   *    utilise des bemols ou des dieses (theorie musicale)
   * 3. Convertit les notes internes vers la notation utilisateur
   * 4. Si MistralScales n'est pas charge, retourne un fallback minimal
   *    avec 4 gammes classiques (Kurd, Amara, Hijaz, Equinox)
   *
   * @returns {Object.<string, {name: string, description: string, mood: string, notes: string[]}>}
   *   Dictionnaire gammes indexe par cle (ex: 'kurd', 'hijaz')
   * @private
   */
  _buildScalesFromMistralScales() {
    // Utilise MistralScales si disponible (charge depuis scales-data.js)
    if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA) {
      const scales = {};
      const userNotation = MistralScales.toUserNotation || MistralScales.toDisplayNotation;
      for (const [key, data] of Object.entries(MistralScales.SCALES_DATA)) {
        if (data.baseNotes && data.baseNotes.length > 0) {
          // Determine si la tonalite de base doit s'ecrire avec des bemols
          // (ex: F Equinox -> Ab, Db, Eb) ou des dieses (ex: D Hijaz -> C#)
          const baseTonality = data.baseRoot + data.baseOctave;
          const useFlats = MistralScales.shouldUseFlats(baseTonality, data);
          const notes = data.baseNotes.map(n => userNotation(n, useFlats));
          scales[key] = {
            name: `${userNotation(data.baseRoot, useFlats)} ${data.name}`,
            description: data.description || '',
            mood: data.mood || '',
            notes: notes
          };
        }
      }
      return scales;
    }

    // Fallback minimal si MistralScales n'est pas charge (4 gammes de base)
    return {
      kurd: { name: 'D Kurd', description: 'La plus populaire.', mood: 'Melancolique', notes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'] },
      amara: { name: 'D Amara', description: 'Variante douce.', mood: 'Doux', notes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'] },
      hijaz: { name: 'D Hijaz', description: 'Orientale.', mood: 'Mystique', notes: ['D3', 'A3', 'Bb3', 'C#4', 'D4', 'E4', 'F4', 'G4', 'A4'] },
      equinox: { name: 'F Equinox', description: 'Grave et profonde.', mood: 'Meditatif', notes: ['F3', 'Ab3', 'C4', 'Db4', 'Eb4', 'F4', 'G4', 'Ab4', 'C5'] }
    };
  }

  /**
   * Initialisation du player : rendu SVG, attachement des evenements,
   * et pre-chargement des echantillons audio de la gamme courante.
   * @private
   */
  init() {
    this.render();
    this.bindEvents();
    this.preloadCurrentScale();
  }

  // ===========================================================================
  // AUDIO — CONTEXTE, CHARGEMENT ET LECTURE
  // ===========================================================================

  /**
   * Initialise le contexte Web Audio API lors de la premiere interaction utilisateur.
   *
   * Les navigateurs modernes bloquent la lecture audio tant qu'il n'y a pas eu
   * d'interaction utilisateur (politique autoplay). Cette methode est donc appelee
   * au premier clic/touch sur une note.
   * @private
   */
  initAudioContext() {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported, falling back to HTML Audio');
    }
  }

  /**
   * Convertit un nom de note musicale en nom de fichier audio.
   *
   * Convention de nommage des fichiers :
   *   - Les dieses (#) deviennent 's' : C#4 -> Cs4
   *   - Les bemols (b) sont convertis en dieses enharmoniques : Bb3 -> As3
   *
   * Delegue a MistralScales.noteToFileName() si disponible, sinon
   * utilise une table de conversion interne (bemols -> dieses).
   *
   * @param {string} noteName - Nom de la note (ex: "C#4", "Bb3", "D4")
   * @returns {string} Nom du fichier sans extension (ex: "Cs4", "As3", "D4")
   */
  noteToFileName(noteName) {
    // Delegue a MistralScales si disponible (gestion centralisee)
    if (typeof MistralScales !== 'undefined' && MistralScales.noteToFileName) {
      return MistralScales.noteToFileName(noteName);
    }

    // Table de conversion bemols -> dieses pour noms de fichiers
    const flatToSharp = {
      'Db': 'Cs', 'Eb': 'Ds', 'Fb': 'E', 'Gb': 'Fs',
      'Ab': 'Gs', 'Bb': 'As', 'Cb': 'B'
    };

    let fileName = noteName;
    for (const [flat, sharp] of Object.entries(flatToSharp)) {
      if (fileName.startsWith(flat)) {
        fileName = fileName.replace(flat, sharp);
        break;
      }
    }
    return fileName.replace('#', 's');
  }

  /**
   * Pre-charge les echantillons audio de toutes les notes de la gamme courante.
   * Cree des objets Audio en avance pour eviter la latence au premier clic.
   */
  preloadCurrentScale() {
    const notes = this._getNoteNames();
    notes.forEach(note => this.preloadAudio(note));
  }

  /**
   * Pre-charge un echantillon audio unique dans le cache.
   *
   * Si le fichier est deja en cache, ne fait rien (evite les doublons).
   * L'attribut preload='auto' demande au navigateur de telecharger le fichier.
   *
   * @param {string} noteName - Nom de la note a pre-charger (ex: "D3", "Bb3")
   */
  preloadAudio(noteName) {
    const fileName = this.noteToFileName(noteName);
    if (this.audioCache[fileName]) return;

    const audio = new Audio(`${this.audioPath}${fileName}${this.audioExt}`);
    audio.preload = 'auto';
    this.audioCache[fileName] = audio;
  }

  /**
   * Joue un echantillon audio pour une note donnee.
   *
   * Strategie de lecture polyphonique :
   * 1. Si la note est en cache, on clone l'element Audio (permet de jouer
   *    la meme note plusieurs fois simultanement)
   * 2. Sinon, on cree un nouvel Audio, on le met en cache, et on le joue
   * 3. Le volume est fixe a 0.7 (70%) pour eviter la saturation
   * 4. Les clones sont nettoyes automatiquement a la fin de la lecture
   *
   * @param {string} noteName - Nom de la note a jouer (ex: "D3", "A4")
   */
  playNote(noteName) {
    const fileName = this.noteToFileName(noteName);

    // Si en cache : cloner pour permettre la polyphonie (meme note jouee plusieurs fois)
    if (this.audioCache[fileName]) {
      const audio = this.audioCache[fileName].cloneNode();
      audio.volume = 0.7;
      this.activeAudioClones.add(audio);
      audio.addEventListener('ended', () => {
        this.activeAudioClones.delete(audio);
        audio.src = '';
      }, { once: true });
      audio.play().catch(e => console.warn('Erreur lecture audio:', e));
      return;
    }

    // Pas en cache : charger, mettre en cache et jouer
    const audio = new Audio(`${this.audioPath}${fileName}${this.audioExt}`);
    audio.volume = 0.7;
    this.audioCache[fileName] = audio;
    audio.play().catch(e => console.warn('Erreur lecture audio:', e));
  }

  // ===========================================================================
  // SVG — IDENTIFIANTS UNIQUES ET RESOLUTION DES NOTES
  // ===========================================================================

  /**
   * Genere les identifiants SVG uniques pour cette instance.
   *
   * Chaque instance a ses propres IDs de gradient et filtre pour eviter
   * les conflits quand plusieurs players coexistent sur la meme page.
   *
   * @returns {{shellGradient: string, noteShadow: string, waveAnimation: string}}
   *   Objet contenant les IDs SVG uniques
   */
  getSvgIds() {
    return {
      shellGradient: `shell-gradient-${this.instanceId}`,
      noteShadow: `note-shadow-${this.instanceId}`,
      waveAnimation: `wave-animation-${this.instanceId}`
    };
  }

  /**
   * Recupere la liste des noms de notes pour l'etat actuel du player.
   *
   * En mode "layout" (customNotes), retourne les noms affiches des notes
   * personnalisees. En mode "gamme", retourne les notes de la gamme selectionnee.
   *
   * @returns {string[]} Tableau des noms de notes (ex: ["D3", "A3", "Bb3", ...])
   * @private
   */
  _getNoteNames() {
    if (this.customNotes) {
      return this.customNotes.map(n => this._toDisplayName(n.name));
    }
    const scale = this.scales[this.currentScale];
    return scale ? scale.notes : [];
  }

  /**
   * Convertit une note interne (notation anglo-saxonne avec dieses)
   * vers la notation d'affichage appropriee.
   *
   * Transformations appliquees :
   * 1. Dieses -> bemols enharmoniques si applicable (C# -> Db)
   * 2. Anglo-saxon -> francais si le mode notation est "french" (Db -> Reb)
   *
   * Necessite MistralScales pour les conversions avancees, sinon
   * retourne la note telle quelle.
   *
   * @param {string} noteName - Nom interne de la note (ex: "C#4", "A3")
   * @returns {string} Nom d'affichage adapte au mode de notation courant
   * @private
   */
  _toDisplayName(noteName) {
    if (typeof MistralScales !== 'undefined' && MistralScales.SHARPS_TO_FLATS) {
      const m = noteName.match(/^([A-G]#?)(\d)?$/);
      let display = noteName;
      if (m && m[1].includes('#') && MistralScales.SHARPS_TO_FLATS[m[1]]) {
        display = MistralScales.SHARPS_TO_FLATS[m[1]] + (m[2] || '');
      }
      if (MistralScales.getNotationMode && MistralScales.getNotationMode() === 'french') {
        display = MistralScales.toFrenchNotation(display);
      }
      return display;
    }
    return noteName;
  }

  // ===========================================================================
  // RENDU SVG — GENERATION DU HANDPAN VISUEL
  // ===========================================================================

  /**
   * Point d'entree principal du rendu.
   *
   * Aiguille vers le mode de rendu adapte :
   * - _renderTyped() si un layout personnalise est defini (ding/tonales/mutants/bottoms)
   * - _renderSimple() pour le mode gamme classique (selecteur + cercle de notes)
   *
   * Injecte ensuite les styles CSS du composant dans le <head> si absents.
   */
  render() {
    if (this.customNotes) {
      this._renderTyped();
    } else {
      this._renderSimple();
    }
    this.addStyles();
  }

  /**
   * Rendu en mode "gamme" (simple) : affiche un handpan avec selecteur de gammes.
   *
   * Structure generee :
   * - Selecteur de gammes (boutons radio visuels)
   * - SVG du handpan : coquille circulaire + notes disposees en cercle
   * - Bloc d'info : nom de gamme, liste des notes, ambiance
   * - Boutons de controle : lecture sequentielle + mode agrandi
   *
   * Le Ding (premiere note) est place au centre-haut avec un rayon plus grand.
   * Les notes restantes sont disposees en cercle autour du centre par
   * calculateNotePositions().
   * @private
   */
  _renderSimple() {
    const scale = this.scales[this.currentScale];
    if (!scale) {
      console.error(`HandpanPlayer: Scale "${this.currentScale}" not found`);
      return;
    }

    const notes = scale.notes;
    const size = this.options.size;
    const center = size / 2;               // Centre du SVG
    const outerRadius = size * 0.42;       // Rayon du cercle de notes peripheriques
    const innerRadius = size * 0.15;       // Rayon de la zone centrale (position du ding)
    const noteRadius = size * 0.09;        // Rayon de chaque cercle de note
    const ids = this.getSvgIds();

    const notePositions = this.calculateNotePositions(notes.length, center, outerRadius, innerRadius);

    this.container.innerHTML = `
      <div class="handpan-player" style="--accent-color: ${this.options.accentColor}; --size: ${size}px;">
        ${this.options.showScaleSelector ? this.renderScaleSelector() : ''}

        <div class="handpan-visual">
          <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
            <defs>
              <radialGradient id="${ids.shellGradient}" cx="30%" cy="30%">
                <stop offset="0%" stop-color="#E8E8E8"/>
                <stop offset="70%" stop-color="#B8B8B8"/>
                <stop offset="100%" stop-color="#7A7A7A"/>
              </radialGradient>
              <filter id="${ids.noteShadow}" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.2"/>
              </filter>
            </defs>

            <circle cx="${center}" cy="${center}" r="${size * 0.46}" fill="url(#${ids.shellGradient})" />
            <circle cx="${center}" cy="${center}" r="${size * 0.44}" fill="none" stroke="#909090" stroke-width="1.5"/>

            <g class="wave-container"></g>

            ${notePositions.map((pos, i) => `
              <g class="note-group" data-note="${notes[i]}" data-index="${i}" data-x="${pos.x}" data-y="${pos.y}">
                <circle
                  cx="${pos.x}" cy="${pos.y}"
                  r="${i === 0 ? noteRadius * 1.3 : noteRadius}"
                  class="note-circle"
                  fill="${i === 0 ? '#D0D0D0' : '#A0A0A0'}"
                  stroke="#686868" stroke-width="1.5"
                  filter="url(#${ids.noteShadow})"
                />
                ${this.options.showNoteNames ? `
                  <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central"
                    class="note-label" fill="#3A3A3A" font-size="${size * 0.035}px"
                    font-weight="600" font-family="system-ui, sans-serif"
                  >${notes[i]}</text>
                ` : ''}
              </g>
            `).join('')}
          </svg>

          <div class="handpan-play-hint">
            <span>Cliquez sur les notes</span>
          </div>
        </div>

        <div class="handpan-info">
          <h4 class="handpan-scale-name">${scale.name}</h4>
          <p class="handpan-scale-notes">${notes.join(' • ')}</p>
          <p class="handpan-scale-mood">${scale.mood}</p>
        </div>

        <div class="handpan-controls">
          <button class="handpan-btn handpan-btn-play" title="Jouer la gamme">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            <span>Écouter la gamme</span>
          </button>
          <button class="handpan-btn handpan-btn-resize" title="Agrandir">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15,3 21,3 21,9"/>
              <polyline points="9,21 3,21 3,15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Rendu en mode "type" (layout) : affiche un handpan avec positionnement par type de note.
   *
   * Ce mode est utilise par le configurateur quand un layout personnalise est fourni.
   * Les notes sont classees en 4 categories, chacune avec un style visuel distinct :
   *   - Ding (centre) : note fondamentale, cercle plus grand, gris clair
   *   - Tonales (anneau principal) : notes melodiques, gris moyen
   *   - Mutants (anneau interieur, haut) : notes additionnelles, gris clair, opacite reduite
   *   - Bottoms (anneau exterieur, bas) : notes graves sous la coque, gris fonce, trait pointille
   *
   * Si des bottoms sont presents, le viewBox SVG est etendu vers le bas (115% de la taille)
   * pour accommoder les notes sous la coque.
   *
   * Genere aussi une legende visuelle si des mutants ou bottoms sont presents.
   * @private
   */
  _renderTyped() {
    const allNotes = this.customNotes;
    const size = this.options.size;
    const center = size / 2;
    const ids = this.getSvgIds();

    // Separation des notes par type pour un positionnement adapte
    const ding = allNotes.find(n => n.type === 'ding');
    const tonals = allNotes.filter(n => n.type === 'tonal');
    const mutants = allNotes.filter(n => n.type === 'mutant');
    const bottoms = allNotes.filter(n => n.type === 'bottom');

    // --- Dimensions proportionnelles au size ---
    const shellRadius = size * 0.42;       // Rayon de la coque
    const tonalRadius = size * 0.31;       // Rayon de l'anneau des tonales
    const dingSize = size * 0.09;          // Rayon du ding central
    const noteSize = size * 0.065;         // Rayon des notes tonales
    const mutantRadius = size * 0.18;      // Rayon de l'anneau des mutants (plus proche du centre)
    const mutantNoteSize = noteSize * 0.85;  // Mutants legerement plus petits
    const bottomRadius = size * 0.46;      // Rayon des bottoms (au-dela de la coque)
    const bottomNoteSize = noteSize * 0.85;  // Bottoms legerement plus petits
    const fontSize = size * 0.032;         // Taille de police proportionnelle

    // Etendre le viewBox si des bottoms sont presents (notes sous la coque)
    const hasBottoms = bottoms.length > 0;
    const viewH = hasBottoms ? size * 1.15 : size;
    const viewY = 0;

    let svgNotes = '';
    let noteIndex = 0;

    // --- Ding (note centrale fondamentale) ---
    if (ding) {
      const dName = this._toDisplayName(ding.name);
      svgNotes += `
        <g class="note-group" data-note="${ding.name}" data-index="${noteIndex}" data-x="${center}" data-y="${center}">
          <circle cx="${center}" cy="${center}" r="${dingSize}"
            class="note-circle note-ding" fill="#D0D0D0" stroke="#686868" stroke-width="1.5"
            filter="url(#${ids.noteShadow})"/>
          ${this.options.showNoteNames ? `
            <text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central"
              class="note-label" fill="#3A3A3A" font-size="${fontSize * 1.1}px"
              font-weight="600" font-family="system-ui, sans-serif">${dName}</text>
          ` : ''}
        </g>`;
      noteIndex++;
    }

    // --- Mutants (anneau interieur, arc dans la partie haute de la coque) ---
    mutants.forEach((note, i) => {
      const pos = this._getMutantPosition(i, mutants.length, mutantRadius, center);
      const dName = this._toDisplayName(note.name);
      svgNotes += `
        <g class="note-group" data-note="${note.name}" data-index="${noteIndex}" data-x="${pos.x}" data-y="${pos.y}">
          <circle cx="${pos.x}" cy="${pos.y}" r="${mutantNoteSize}"
            class="note-circle note-mutant" fill="#B8B8B8" stroke="#787878" stroke-width="1.5"
            filter="url(#${ids.noteShadow})"/>
          ${this.options.showNoteNames ? `
            <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central"
              class="note-label" fill="#3A3A3A" font-size="${fontSize * 0.9}px"
              font-weight="600" font-family="system-ui, sans-serif">${dName}</text>
          ` : ''}
        </g>`;
      noteIndex++;
    });

    // --- Tonales (anneau principal, disposition alternee gauche/droite) ---
    tonals.forEach((note, i) => {
      const pos = this._getTonalPosition(i, tonals.length, tonalRadius, center);
      const dName = this._toDisplayName(note.name);
      svgNotes += `
        <g class="note-group" data-note="${note.name}" data-index="${noteIndex}" data-x="${pos.x}" data-y="${pos.y}">
          <circle cx="${pos.x}" cy="${pos.y}" r="${noteSize}"
            class="note-circle note-tonal" fill="#A0A0A0" stroke="#686868" stroke-width="1.5"
            filter="url(#${ids.noteShadow})"/>
          ${this.options.showNoteNames ? `
            <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central"
              class="note-label" fill="#3A3A3A" font-size="${fontSize}px"
              font-weight="600" font-family="system-ui, sans-serif">${dName}</text>
          ` : ''}
        </g>`;
      noteIndex++;
    });

    // --- Bottoms (anneau exterieur, arc dans la partie basse, sous la coque) ---
    bottoms.forEach((note, i) => {
      const pos = this._getBottomPosition(i, bottoms.length, bottomRadius, center);
      const dName = this._toDisplayName(note.name);
      svgNotes += `
        <g class="note-group" data-note="${note.name}" data-index="${noteIndex}" data-x="${pos.x}" data-y="${pos.y}">
          <circle cx="${pos.x}" cy="${pos.y}" r="${bottomNoteSize}"
            class="note-circle note-bottom" fill="#505050" stroke="#505050" stroke-width="1.5"
            stroke-dasharray="3 2" filter="url(#${ids.noteShadow})"/>
          ${this.options.showNoteNames ? `
            <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central"
              class="note-label" fill="#E8E8E8" font-size="${fontSize * 0.9}px"
              font-weight="600" font-family="system-ui, sans-serif">${dName}</text>
          ` : ''}
        </g>`;
      noteIndex++;
    });

    // Construction de l'affichage des noms de notes (ordre : ding, tonales, mutants, bottoms)
    const displayNotes = allNotes.map(n => this._toDisplayName(n.name));
    const scaleName = ding ? this._toDisplayName(ding.name).replace(/\d$/, '') : '';

    // Legende visuelle (affichee uniquement si mutants ou bottoms presents)
    let legendHtml = '';
    if (mutants.length > 0 || bottoms.length > 0) {
      legendHtml = '<div class="handpan-legend">';
      legendHtml += '<span class="legend-item"><span class="legend-dot legend-dot--tonal"></span> Tonales</span>';
      if (mutants.length > 0) {
        legendHtml += '<span class="legend-item"><span class="legend-dot legend-dot--mutant"></span> Mutants</span>';
      }
      if (bottoms.length > 0) {
        legendHtml += '<span class="legend-item"><span class="legend-dot legend-dot--bottom"></span> Bottoms</span>';
      }
      legendHtml += '</div>';
    }

    this.container.innerHTML = `
      <div class="handpan-player" style="--accent-color: ${this.options.accentColor}; --size: ${size}px;">
        <div class="handpan-visual">
          <svg viewBox="0 ${viewY} ${size} ${viewH}" width="${size}" height="${viewH}" style="overflow: visible;">
            <defs>
              <radialGradient id="${ids.shellGradient}" cx="30%" cy="30%">
                <stop offset="0%" stop-color="#E8E8E8"/>
                <stop offset="70%" stop-color="#B8B8B8"/>
                <stop offset="100%" stop-color="#7A7A7A"/>
              </radialGradient>
              <filter id="${ids.noteShadow}" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.2"/>
              </filter>
            </defs>

            <circle cx="${center}" cy="${center}" r="${shellRadius}" fill="url(#${ids.shellGradient})" />
            <circle cx="${center}" cy="${center}" r="${shellRadius - 2}" fill="none" stroke="#909090" stroke-width="1.5"/>

            <g class="wave-container"></g>

            ${svgNotes}
          </svg>

          <div class="handpan-play-hint">
            <span>Cliquez sur les notes</span>
          </div>
        </div>

        ${legendHtml}

        <div class="handpan-info">
          <p class="handpan-scale-notes">${displayNotes.join(' • ')}</p>
          <p class="handpan-scale-mood">${allNotes.length} notes</p>
        </div>

        <div class="handpan-controls">
          <button class="handpan-btn handpan-btn-play" title="Jouer la gamme">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            <span>Écouter</span>
          </button>
          <button class="handpan-btn handpan-btn-resize" title="Agrandir">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15,3 21,3 21,9"/>
              <polyline points="9,21 3,21 3,15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  // ===========================================================================
  // POSITIONNEMENT DES NOTES — ALGORITHMES GEOMETRIQUES
  // ===========================================================================

  /**
   * Calcule la position d'une note tonale sur l'anneau principal.
   *
   * Algorithme de disposition alternee gauche/droite, identique au configurateur :
   *   - Les notes sont reparties en alternant cote droit et cote gauche
   *   - La derniere note est toujours placee en bas (90 degres)
   *   - Le comportement differe selon la parite du nombre total de notes
   *
   * Pour un nombre pair de tonales :
   *   - La premiere note est en haut (270 degres)
   *   - Les notes intermediaires alternent droite (315+) et gauche (225-)
   *   - La derniere note est en bas (90 degres)
   *
   * Pour un nombre impair de tonales :
   *   - Les notes alternent directement droite (290+) et gauche (250-)
   *   - La derniere note est en bas (90 degres)
   *
   * Les angles sont en degres trigonometriques (0=droite, 90=haut, 180=gauche, 270=bas)
   * mais l'axe Y SVG est inverse, d'ou le `center - sin(angle)` dans le retour.
   *
   * @param {number} index - Index de la note dans la liste des tonales
   * @param {number} total - Nombre total de tonales
   * @param {number} radius - Rayon de l'anneau des tonales
   * @param {number} center - Coordonnee du centre du SVG
   * @returns {{x: number, y: number}} Position SVG de la note
   * @private
   */
  _getTonalPosition(index, total, radius, center) {
    let angleDeg;
    const lastIndex = total - 1;
    const isEvenTotal = (total % 2 === 0);

    if (total === 1) {
      angleDeg = 270;
    } else if (total === 2) {
      angleDeg = index === 0 ? 250 : 290;
    } else if (index === lastIndex) {
      angleDeg = 90;
    } else if (isEvenTotal && index === 0) {
      angleDeg = 270;
    } else {
      let adjustedIndex, middleCount, isRight, sideIndex, notesPerSide;

      if (isEvenTotal) {
        // Nombre pair : la 1ere note est en haut, on distribue le reste en alternant
        adjustedIndex = index - 1;
        middleCount = total - 2;
        isRight = (adjustedIndex % 2 === 1);
        sideIndex = Math.floor(adjustedIndex / 2);
        notesPerSide = Math.ceil(middleCount / 2);

        if (isRight) {
          // Cote droit : de 315 degres vers le bas
          const step = notesPerSide > 1 ? 90 / (notesPerSide - 1) : 0;
          angleDeg = 315 + sideIndex * step;
          if (angleDeg >= 360) angleDeg -= 360;
        } else {
          // Cote gauche : de 225 degres vers le bas
          const step = notesPerSide > 1 ? 90 / (notesPerSide - 1) : 0;
          angleDeg = 225 - sideIndex * step;
        }
      } else {
        // Nombre impair : alternance directe droite/gauche
        isRight = (index % 2 === 0);
        sideIndex = Math.floor(index / 2);
        notesPerSide = Math.ceil((total - 1) / 2);

        if (isRight) {
          // Cote droit : plage de 120 degres depuis 290 degres
          const range = 120;
          const step = notesPerSide > 1 ? range / (notesPerSide - 1) : 0;
          angleDeg = 290 + sideIndex * step;
          if (angleDeg >= 360) angleDeg -= 360;
        } else {
          // Cote gauche : plage de 120 degres depuis 250 degres
          const range = 120;
          const step = notesPerSide > 1 ? range / (notesPerSide - 1) : 0;
          angleDeg = 250 - sideIndex * step;
        }
      }
    }

    // Conversion degres -> coordonnees SVG (Y inverse car SVG a l'axe Y vers le bas)
    const angleRad = angleDeg * Math.PI / 180;
    return {
      x: center + Math.cos(angleRad) * radius,
      y: center - Math.sin(angleRad) * radius
    };
  }

  /**
   * Calcule la position d'une note mutant sur l'arc superieur de la coque.
   *
   * Les mutants sont disposes en arc de cercle dans la partie haute du handpan,
   * entre le ding et les tonales. L'arc s'elargit avec le nombre de notes
   * (de 40 degres pour 1 note a 120 degres max pour plusieurs).
   *
   * @param {number} index - Index du mutant dans la liste
   * @param {number} total - Nombre total de mutants
   * @param {number} radius - Rayon de l'anneau des mutants
   * @param {number} center - Coordonnee du centre du SVG
   * @returns {{x: number, y: number}} Position SVG du mutant
   * @private
   */
  _getMutantPosition(index, total, radius, center) {
    if (total === 1) {
      return { x: center, y: center - radius };
    }
    // Largeur de l'arc proportionnelle au nombre de mutants (40 + 30 par note, max 120)
    const arcSpread = Math.min(120, 40 + (total - 1) * 30);
    const startAngle = 90 + arcSpread / 2;
    const step = arcSpread / (total - 1);
    const angleDeg = startAngle - (index * step);

    const angleRad = angleDeg * Math.PI / 180;
    return {
      x: center + Math.cos(angleRad) * radius,
      y: center - Math.sin(angleRad) * radius
    };
  }

  /**
   * Calcule la position d'une note bottom sur l'arc inferieur (sous la coque).
   *
   * Les bottoms sont disposes en arc de cercle dans la partie basse,
   * au-dela du rayon de la coque, representant les notes situees physiquement
   * sous l'instrument. L'arc s'elargit avec le nombre de notes
   * (de 40 degres pour 1 note a 140 degres max pour plusieurs).
   *
   * @param {number} index - Index du bottom dans la liste
   * @param {number} total - Nombre total de bottoms
   * @param {number} radius - Rayon de l'anneau des bottoms
   * @param {number} center - Coordonnee du centre du SVG
   * @returns {{x: number, y: number}} Position SVG du bottom
   * @private
   */
  _getBottomPosition(index, total, radius, center) {
    if (total === 1) {
      return { x: center, y: center + radius };
    }
    // Largeur de l'arc proportionnelle au nombre de bottoms (40 + 25 par note, max 140)
    const arcSpread = Math.min(140, 40 + (total - 1) * 25);
    const startAngle = 270 - arcSpread / 2;
    const step = arcSpread / (total - 1);
    const angleDeg = startAngle + (index * step);

    const angleRad = angleDeg * Math.PI / 180;
    return {
      x: center + Math.cos(angleRad) * radius,
      y: center - Math.sin(angleRad) * radius
    };
  }

  /**
   * Calcule les positions des notes pour le mode "gamme" simple (non-type).
   *
   * Disposition :
   * - Le Ding (index 0) est place au centre-haut, a mi-distance du rayon interieur
   * - Les notes restantes sont disposees en cercle sur le rayon exterieur
   * - L'alternance gauche/droite simule la disposition physique d'un vrai handpan
   *   (notes basses en haut, notes hautes en bas, en zigzag)
   *
   * @param {number} noteCount - Nombre total de notes (ding inclus)
   * @param {number} center - Coordonnee du centre du SVG
   * @param {number} outerRadius - Rayon du cercle des notes peripheriques
   * @param {number} innerRadius - Rayon de la zone centrale (pour le ding)
   * @returns {Array<{x: number, y: number}>} Tableau des positions pour chaque note
   */
  calculateNotePositions(noteCount, center, outerRadius, innerRadius) {
    const positions = [];

    // Ding (premiere note) : place au centre-haut
    positions.push({ x: center, y: center - innerRadius * 0.5 });

    // Notes peripheriques : disposees en cercle avec alternance gauche/droite
    const remainingNotes = noteCount - 1;
    const startAngle = -Math.PI / 2 + Math.PI / remainingNotes; // Depart depuis le haut-droit

    for (let i = 0; i < remainingNotes; i++) {
      // Alternance : indices pairs a droite, impairs a gauche (zigzag descendant)
      const index = i % 2 === 0 ? Math.floor(i / 2) : remainingNotes - 1 - Math.floor(i / 2);
      const angle = startAngle + (index * 2 * Math.PI / remainingNotes);

      positions.push({
        x: center + Math.cos(angle) * outerRadius,
        y: center + Math.sin(angle) * outerRadius
      });
    }

    return positions;
  }

  // ===========================================================================
  // SELECTEUR DE GAMMES
  // ===========================================================================

  /**
   * Genere le HTML du selecteur de gammes (boutons radio visuels).
   *
   * Chaque bouton affiche le nom de la gamme et porte un title avec sa description.
   * La gamme courante est marquee avec la classe 'active'.
   *
   * @returns {string} Fragment HTML du selecteur de gammes
   */
  renderScaleSelector() {
    return `
      <div class="handpan-scale-selector">
        <label class="handpan-selector-label">Gamme :</label>
        <div class="handpan-scale-buttons">
          ${Object.entries(this.scales).map(([key, scale]) => `
            <button
              class="handpan-scale-btn ${key === this.currentScale ? 'active' : ''}"
              data-scale="${key}"
              title="${scale.description}"
            >
              ${scale.name}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ===========================================================================
  // STYLES CSS — INJECTION DYNAMIQUE
  // ===========================================================================

  /**
   * Injecte les styles CSS du composant dans le <head> du document.
   *
   * Les styles ne sont injectes qu'une seule fois (verifie l'ID 'handpan-player-styles').
   * Cela permet a plusieurs instances de coexister sans dupliquer les styles.
   *
   * Le CSS utilise des variables CSS pour la personnalisation :
   *   - --accent-color : couleur d'accentuation (boutons actifs, mood)
   *   - --size : taille du player
   *
   * Z-index respecte l'echelle du design system :
   *   - 499 : overlay du mode agrandi (--z-player-overlay)
   *   - 500 : player en mode agrandi (--z-player-enlarged)
   */
  addStyles() {
    if (document.getElementById('handpan-player-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'handpan-player-styles';
    styles.textContent = `
      .handpan-player {
        --accent: var(--accent-color, #0D7377);
        font-family: 'DM Sans', system-ui, sans-serif;
        max-width: var(--size, 300px);
        margin: 0 auto;
      }

      .handpan-player.enlarged {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        max-width: 90vmin;
        z-index: 500; /* --z-player-enlarged */
        background: rgba(255,255,255,0.98);
        padding: 2rem;
        border-radius: 1rem;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      }

      .handpan-player.enlarged .handpan-visual svg {
        width: min(500px, 80vmin);
        height: min(500px, 80vmin);
      }

      .handpan-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 499; /* --z-player-overlay */
        -webkit-backdrop-filter: blur(4px);
        backdrop-filter: blur(4px);
      }

      .handpan-scale-selector {
        margin-bottom: 1rem;
      }

      .handpan-selector-label {
        display: block;
        font-size: 0.75rem;
        color: #666;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .handpan-scale-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .handpan-scale-btn {
        padding: 0.4rem 0.75rem;
        font-size: 0.8125rem;
        border: 1px solid #ddd;
        border-radius: 999px;
        background: white;
        color: #666;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      }

      .handpan-scale-btn:hover {
        border-color: #999;
        color: #333;
      }

      .handpan-scale-btn.active {
        background: var(--accent);
        border-color: var(--accent);
        color: white;
      }

      .handpan-visual {
        position: relative;
        display: flex;
        justify-content: center;
        margin-bottom: 1rem;
      }

      .handpan-visual svg {
        display: block;
        filter: drop-shadow(0 8px 24px rgba(0,0,0,0.15));
        touch-action: none;
      }

      .note-group {
        cursor: pointer;
        transition: transform 0.1s ease;
      }

      .note-group:hover .note-circle {
        fill: #C8C8C8;
      }

      .note-group.active .note-circle {
        fill: white !important;
        transform-origin: center;
        animation: note-pulse 0.4s ease;
      }

      .note-group.active .note-label {
        fill: #2C1810 !important;
      }

      @keyframes note-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }

      /* Animation d'ondes circulaires au toucher d'une note */
      .wave-ring {
        fill: none;
        stroke: rgba(255,255,255,0.6);
        stroke-width: 2;
        pointer-events: none;
      }

      @keyframes wave-expand {
        0% {
          transform: scale(1);
          opacity: 0.8;
        }
        100% {
          transform: scale(3);
          opacity: 0;
        }
      }

      .handpan-play-hint {
        position: absolute;
        bottom: -0.5rem;
        left: 50%;
        transform: translateX(-50%);
        font-size: 0.75rem;
        color: #999;
        opacity: 0.8;
        pointer-events: none;
      }

      .handpan-info {
        text-align: center;
        margin-bottom: 1rem;
      }

      .handpan-scale-name {
        font-family: 'Cormorant Garamond', Georgia, serif;
        font-size: 1.25rem;
        font-weight: 500;
        margin: 0 0 0.25rem 0;
        color: #2C2825;
      }

      .handpan-scale-notes {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.75rem;
        color: #999;
        margin: 0 0 0.25rem 0;
      }

      .handpan-scale-mood {
        font-size: 0.8125rem;
        color: var(--accent);
        margin: 0;
        font-style: italic;
      }

      .handpan-controls {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
      }

      .handpan-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1.25rem;
        font-size: 0.875rem;
        font-family: inherit;
        font-weight: 500;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .handpan-btn-play {
        background: #2C2825;
        color: white;
      }

      .handpan-btn-play:hover {
        background: #1a1815;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }

      .handpan-btn-play.playing {
        background: var(--accent);
      }

      .handpan-btn-resize {
        background: #f5f5f5;
        color: #666;
        padding: 0.6rem;
      }

      .handpan-btn-resize:hover {
        background: #e8e8e8;
        color: #333;
      }

      .handpan-player.enlarged .handpan-btn-resize svg {
        transform: rotate(180deg);
      }

      .handpan-btn svg {
        flex-shrink: 0;
      }

      /* Legende pour les notes typees (tonales, mutants, bottoms) */
      .handpan-legend {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-bottom: 0.5rem;
        font-size: 0.6875rem;
        color: #999;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
      }

      .legend-dot--tonal { background: #A0A0A0; border: 1px solid #686868; }
      .legend-dot--mutant { background: #B8B8B8; border: 1px solid #787878; }
      .legend-dot--bottom { background: #505050; border: 1px solid #505050; }

      /* Style specifique des notes mutant (opacite reduite) */
      .note-mutant { opacity: 0.85; }
    `;

    document.head.appendChild(styles);
  }

  // ===========================================================================
  // EVENEMENTS — GESTION DES INTERACTIONS UTILISATEUR
  // ===========================================================================

  /**
   * Attache tous les gestionnaires d'evenements du player.
   *
   * Evenements geres :
   * - pointerdown sur le SVG : clic/touch sur une note (unifie souris + tactile)
   * - touchstart sur le SVG : support multi-touch (accords a plusieurs doigts)
   * - click sur les boutons de gamme : changement de gamme
   * - click sur le bouton play : lecture sequentielle de la gamme
   * - click sur le bouton resize : mode agrandi/reduit
   *
   * Chaque gestionnaire est stocke dans this.boundHandlers pour un
   * nettoyage fiable via unbindEvents().
   */
  bindEvents() {
    // Nettoyer les gestionnaires precedents (evite les doublons apres re-rendu)
    this.unbindEvents();

    const svg = this.container.querySelector('svg');
    if (!svg) return;

    // --- Tactile : touchstart non-passif pour multi-touch rapide ---
    // On utilise touchstart comme handler principal sur tactile,
    // et pointerdown uniquement pour la souris (desktop).
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isTouchDevice) {
      // Touch : handler non-passif pour pouvoir preventDefault (evite le scroll)
      const handleTouchStart = (e) => {
        let triggered = false;
        Array.from(e.changedTouches).forEach(touch => {
          const element = document.elementFromPoint(touch.clientX, touch.clientY);
          const noteGroup = element?.closest('.note-group');
          if (noteGroup) {
            triggered = true;
            const note = noteGroup.dataset.note;
            this.triggerNote(noteGroup, note);
          }
        });
        // Empecher le scroll et le zoom si on a touche une note
        if (triggered) e.preventDefault();
      };

      svg.addEventListener('touchstart', handleTouchStart, { passive: false });
      this.boundHandlers.set('svg-touchstart', { element: svg, event: 'touchstart', handler: handleTouchStart });

      // Touchmove : detecter le glissement sur d'autres notes (slide entre notes)
      const recentlyTriggered = new Set();
      const handleTouchMove = (e) => {
        Array.from(e.changedTouches).forEach(touch => {
          const element = document.elementFromPoint(touch.clientX, touch.clientY);
          const noteGroup = element?.closest('.note-group');
          if (noteGroup) {
            const note = noteGroup.dataset.note;
            const key = touch.identifier + '-' + note;
            if (!recentlyTriggered.has(key)) {
              recentlyTriggered.add(key);
              this.triggerNote(noteGroup, note);
              // Autoriser re-declenchement apres 150ms
              setTimeout(() => recentlyTriggered.delete(key), 150);
            }
          }
        });
        e.preventDefault();
      };

      svg.addEventListener('touchmove', handleTouchMove, { passive: false });
      this.boundHandlers.set('svg-touchmove', { element: svg, event: 'touchmove', handler: handleTouchMove });
    } else {
      // Desktop : pointerdown pour la souris
      const handlePointerDown = (e) => {
        const noteGroup = e.target.closest('.note-group');
        if (!noteGroup) return;
        const note = noteGroup.dataset.note;
        this.triggerNote(noteGroup, note);
      };

      svg.addEventListener('pointerdown', handlePointerDown);
      this.boundHandlers.set('svg-pointerdown', { element: svg, event: 'pointerdown', handler: handlePointerDown });
    }

    // --- Selecteur de gammes ---
    this.container.querySelectorAll('.handpan-scale-btn').forEach((btn, index) => {
      const handler = () => this.setScale(btn.dataset.scale);
      btn.addEventListener('click', handler);
      this.boundHandlers.set(`scale-btn-${index}`, { element: btn, event: 'click', handler });
    });

    // --- Bouton lecture sequentielle ---
    const playBtn = this.container.querySelector('.handpan-btn-play');
    if (playBtn) {
      const playHandler = () => this.togglePlayScale();
      playBtn.addEventListener('click', playHandler);
      this.boundHandlers.set('play-btn', { element: playBtn, event: 'click', handler: playHandler });
    }

    // --- Bouton agrandir/reduire ---
    const resizeBtn = this.container.querySelector('.handpan-btn-resize');
    if (resizeBtn) {
      const resizeHandler = () => this.toggleEnlarged();
      resizeBtn.addEventListener('click', resizeHandler);
      this.boundHandlers.set('resize-btn', { element: resizeBtn, event: 'click', handler: resizeHandler });
    }
  }

  /**
   * Detache tous les gestionnaires d'evenements precedemment attaches.
   * Appele avant chaque bindEvents() pour eviter les doublons,
   * et lors de la destruction de l'instance.
   */
  unbindEvents() {
    this.boundHandlers.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.boundHandlers.clear();
  }

  // ===========================================================================
  // INTERACTION — DECLENCHEMENT DE NOTE ET EFFETS
  // ===========================================================================

  /**
   * Declencheur unifie pour jouer une note avec tous ses effets associes.
   *
   * Enchaine dans l'ordre :
   * 1. Initialisation du contexte audio (si premier clic)
   * 2. Lecture de l'echantillon audio
   * 3. Animation visuelle de pulsation sur la note
   * 4. Animation d'ondes circulaires (si activee)
   * 5. Retour haptique par vibration (si active et supporte)
   *
   * @param {SVGGElement} noteGroup - Element SVG <g> de la note cliquee
   * @param {string} note - Nom de la note (ex: "D3", "Bb3")
   */
  triggerNote(noteGroup, note) {
    this.initAudioContext();
    this.playNote(note);
    this.animateNote(noteGroup);

    if (this.options.enableWaveAnimation) {
      this.createWaveAnimation(noteGroup);
    }

    if (this.options.enableHaptics) {
      this.triggerHaptic();
    }
  }

  /**
   * Declenche un retour haptique (vibration courte) sur les appareils mobiles.
   * Utilise l'API Vibration si disponible (15ms — discret mais perceptible).
   */
  triggerHaptic() {
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  }

  /**
   * Cree une animation d'onde circulaire emanant d'une note touchee.
   *
   * L'onde est un cercle SVG qui s'agrandit (scale x3) et disparait (opacity 0)
   * en 600ms. Elle est ajoutee au conteneur <g class="wave-container"> du SVG
   * et supprimee automatiquement apres l'animation.
   *
   * Le rayon initial de l'onde correspond au rayon de la note touchee
   * (plus grand pour le ding central).
   *
   * @param {SVGGElement} noteGroup - Element SVG <g> de la note source
   */
  createWaveAnimation(noteGroup) {
    const svg = this.container.querySelector('svg');
    const waveContainer = svg.querySelector('.wave-container');
    if (!waveContainer) return;

    // Recuperer les coordonnees de la note depuis ses data-attributes
    const x = parseFloat(noteGroup.dataset.x);
    const y = parseFloat(noteGroup.dataset.y);
    const isCenter = noteGroup.dataset.index === '0';
    const baseRadius = isCenter ? this.options.size * 0.09 * 1.3 : this.options.size * 0.09;

    // Creer l'element cercle SVG pour l'onde
    const wave = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    wave.setAttribute('cx', x);
    wave.setAttribute('cy', y);
    wave.setAttribute('r', baseRadius);
    wave.setAttribute('class', 'wave-ring');
    wave.style.transformOrigin = `${x}px ${y}px`;
    wave.style.animation = 'wave-expand 0.6s ease-out forwards';

    waveContainer.appendChild(wave);

    // Supprimer l'onde du DOM apres la fin de l'animation (600ms)
    const timeoutId = setTimeout(() => {
      wave.remove();
      this.activeTimeouts.delete(timeoutId);
    }, 600);
    this.activeTimeouts.add(timeoutId);
  }

  /**
   * Anime visuellement une note (pulsation de 400ms).
   *
   * Ajoute la classe CSS 'active' qui declenche l'animation note-pulse
   * (scale 1 -> 1.05 -> 1 avec remplissage blanc). La classe est retiree
   * automatiquement apres 400ms.
   *
   * @param {SVGGElement} noteGroup - Element SVG <g> de la note a animer
   */
  animateNote(noteGroup) {
    noteGroup.classList.add('active');
    const timeoutId = setTimeout(() => {
      noteGroup.classList.remove('active');
      this.activeTimeouts.delete(timeoutId);
    }, 400);
    this.activeTimeouts.add(timeoutId);
  }

  // ===========================================================================
  // MODE AGRANDI (FULLSCREEN-LIKE)
  // ===========================================================================

  /**
   * Bascule entre le mode normal et le mode agrandi du player.
   *
   * En mode agrandi :
   * - Un overlay semi-transparent avec flou est ajoute derriere le player
   * - Le player passe en position fixe centree (z-index 500)
   * - Le SVG est agrandi a min(500px, 80vmin)
   * - L'icone du bouton resize est pivotee a 180 degres
   * - Un clic sur l'overlay ferme le mode agrandi
   *
   * Apres chaque bascule, les evenements sont re-attaches car le DOM a change.
   */
  toggleEnlarged() {
    const player = this.container.querySelector('.handpan-player');
    const isEnlarged = player.classList.contains('enlarged');

    if (isEnlarged) {
      // Fermer le mode agrandi : retirer l'overlay et la classe
      const overlay = document.querySelector('.handpan-overlay');
      if (overlay) overlay.remove();
      player.classList.remove('enlarged');
    } else {
      // Ouvrir le mode agrandi : ajouter overlay + classe
      const overlay = document.createElement('div');
      overlay.className = 'handpan-overlay';
      overlay.addEventListener('click', () => this.toggleEnlarged());
      document.body.appendChild(overlay);
      player.classList.add('enlarged');
    }

    // Re-attacher les evenements apres le changement de contexte SVG
    this.bindEvents();
  }

  // ===========================================================================
  // LECTURE SEQUENTIELLE — ARPEGE AUTOMATIQUE
  // ===========================================================================

  /**
   * Bascule entre lecture et arret de la gamme (toggle play/stop).
   */
  togglePlayScale() {
    if (this.isPlaying) {
      this.stopPlayScale();
    } else {
      this.playScale();
    }
  }

  /**
   * Arrete la lecture sequentielle en cours.
   *
   * Utilise l'AbortController pour interrompre la boucle async de playScale().
   * Remet le bouton play dans son etat initial.
   */
  stopPlayScale() {
    this.isPlaying = false;
    if (this.playAbortController) {
      this.playAbortController.abort();
      this.playAbortController = null;
    }

    const playBtn = this.container.querySelector('.handpan-btn-play');
    if (playBtn) {
      playBtn.classList.remove('playing');
      playBtn.querySelector('span').textContent = this.customNotes ? 'Écouter' : 'Écouter la gamme';
    }
  }

  /**
   * Joue la gamme complete de maniere sequentielle (arpege montant puis descendant).
   *
   * Sequence de lecture :
   * 1. Arpege montant : chaque note jouee avec 300ms d'intervalle
   * 2. Pause de 500ms au sommet
   * 3. Arpege descendant : retour en arriere avec 250ms d'intervalle
   *    (exclut la derniere note pour eviter la repetition)
   *
   * La lecture est interruptible a tout moment via stopPlayScale() grace
   * a un AbortController. Chaque point d'attente verifie le signal d'abort.
   *
   * Un mapping note -> element DOM est construit au prealable pour un lookup
   * fiable (supporte les noms internes ET les noms affiches).
   *
   * @returns {Promise<void>}
   */
  async playScale() {
    if (this.isPlaying) return;

    const notes = this._getNoteNames();
    const playBtn = this.container.querySelector('.handpan-btn-play');

    // Construire une map nom de note -> element DOM pour un lookup fiable
    // On mappe a la fois le nom interne (data-note) et le nom affiche
    const noteGroupMap = {};
    this.container.querySelectorAll('.note-group').forEach(g => {
      const noteName = g.dataset.note;
      if (noteName) {
        noteGroupMap[noteName] = g;
        noteGroupMap[this._toDisplayName(noteName)] = g;
      }
    });

    this.isPlaying = true;
    this.playAbortController = new AbortController();
    const signal = this.playAbortController.signal;

    if (playBtn) {
      playBtn.classList.add('playing');
      playBtn.querySelector('span').textContent = 'Stop';
    }

    try {
      // Phase 1 : arpege montant (du ding vers la note la plus aigue)
      for (let i = 0; i < notes.length; i++) {
        if (signal.aborted) return;
        await this.delay(300);
        if (signal.aborted) return;
        const group = noteGroupMap[notes[i]];
        if (group) this.triggerNote(group, notes[i]);
      }

      // Pause au sommet de l'arpege
      await this.delay(500);

      // Phase 2 : arpege descendant (retour vers le ding, sans repeter la derniere note)
      for (let i = notes.length - 2; i >= 0; i--) {
        if (signal.aborted) return;
        await this.delay(250);
        if (signal.aborted) return;
        const group = noteGroupMap[notes[i]];
        if (group) this.triggerNote(group, notes[i]);
      }
    } finally {
      this.stopPlayScale();
    }
  }

  /**
   * Utilitaire de delai asynchrone avec support d'annulation.
   *
   * Retourne une Promise qui se resout apres le delai specifie,
   * ou se rejette avec une DOMException 'AbortError' si le
   * playAbortController est signale pendant l'attente.
   *
   * Le timeout est enregistre dans activeTimeouts pour un nettoyage
   * fiable lors de la destruction de l'instance.
   *
   * @param {number} ms - Delai en millisecondes
   * @returns {Promise<void>}
   * @throws {DOMException} AbortError si la lecture est interrompue
   */
  delay(ms) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.activeTimeouts.delete(timeoutId);
        resolve();
      }, ms);
      this.activeTimeouts.add(timeoutId);

      // Ecouter le signal d'abort pour interrompre le delai
      if (this.playAbortController) {
        this.playAbortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          this.activeTimeouts.delete(timeoutId);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }
    });
  }

  // ===========================================================================
  // API PUBLIQUE — SELECTION DE GAMME, TAILLE, ETAT
  // ===========================================================================

  /**
   * Change la gamme active du player.
   *
   * Arrete toute lecture en cours, met a jour la gamme, re-rend le SVG,
   * re-attache les evenements, pre-charge les echantillons audio,
   * et emet un evenement 'scalechange' pour les ecouteurs externes.
   *
   * @param {string} scaleKey - Cle de la nouvelle gamme (ex: 'kurd', 'hijaz')
   */
  setScale(scaleKey) {
    if (!this.scales[scaleKey]) return;

    // Arreter toute lecture sequentielle en cours
    this.stopPlayScale();

    this.currentScale = scaleKey;
    this.render();
    this.bindEvents();
    this.preloadCurrentScale();

    // Emettre un evenement personnalise pour les composants externes
    this.container.dispatchEvent(new CustomEvent('scalechange', {
      detail: { scale: scaleKey, scaleData: this.scales[scaleKey] }
    }));
  }

  /**
   * Retourne les informations de la gamme actuellement selectionnee.
   *
   * @returns {{key: string, name: string, description: string, mood: string, notes: string[]}}
   *   Objet contenant la cle et les donnees de la gamme active
   */
  getScale() {
    return {
      key: this.currentScale,
      ...this.scales[this.currentScale]
    };
  }

  /**
   * Met a jour dynamiquement la taille du player et re-rend le SVG.
   *
   * @param {number} newSize - Nouvelle taille en pixels
   */
  setSize(newSize) {
    this.options.size = newSize;
    this.render();
    this.bindEvents();
  }

  // ===========================================================================
  // DESTRUCTION — NETTOYAGE MEMOIRE
  // ===========================================================================

  /**
   * Detruit completement l'instance du player et libere toutes les ressources.
   *
   * Operations de nettoyage :
   * 1. Arrete toute lecture sequentielle en cours
   * 2. Annule tous les timeouts actifs (animations, delais)
   * 3. Detache tous les gestionnaires d'evenements (SVG, boutons)
   * 4. Retire l'ecouteur global de changement de notation
   * 5. Supprime l'overlay du mode agrandi si present
   * 6. Arrete et libere tous les clones audio en cours de lecture
   * 7. Vide le cache audio (arrete et libere chaque echantillon)
   * 8. Vide le conteneur DOM
   * 9. Ferme le contexte Web Audio API
   *
   * Appeler cette methode est essentiel pour eviter les fuites memoire
   * quand le player est retire de la page (SPA, changement de gamme
   * dans le configurateur, etc.).
   */
  destroy() {
    // 1. Arreter la lecture sequentielle
    this.stopPlayScale();

    // 2. Annuler tous les timeouts actifs
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts.clear();

    // 3. Detacher tous les event listeners
    this.unbindEvents();
    if (this._onNotationChange) {
      window.removeEventListener('notation-mode-change', this._onNotationChange);
    }

    // 4. Supprimer l'overlay du mode agrandi
    const overlay = document.querySelector('.handpan-overlay');
    if (overlay) overlay.remove();

    // 5. Arreter et liberer les clones audio actifs
    this.activeAudioClones.forEach(a => { a.pause(); a.src = ''; });
    this.activeAudioClones.clear();

    // 6. Vider le cache audio
    Object.values(this.audioCache).forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    this.audioCache = {};

    // 7. Vider le conteneur DOM
    this.container.innerHTML = '';

    // 8. Fermer le contexte Web Audio API
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
  }

  // ===========================================================================
  // METHODE STATIQUE — PARSING DE LAYOUT (notes_layout)
  // ===========================================================================

  /**
   * Parse une chaine notes_layout en tableau d'objets notes types.
   *
   * Format du layout :
   *   "D/A-Bb-C-D-E-F-G-A"            -> ding + tonales simples
   *   "D/A-Bb-C-D-E-F-G-A_"           -> trailing underscore ignore
   *   "D/(F)-(G)-A-Bb-C-D-E-F-G-A-C"  -> (parentheses) = bottoms
   *   "D/[E]-A-Bb-C-D-E-F-G-A"        -> [crochets] = mutants
   *   "D3/A3-Bb3-C4-D4-E4-F4-G4-A4"   -> octaves explicites
   *
   * Algorithme de resolution des octaves :
   * - Si une note a un numero d'octave explicite, il est utilise directement
   * - Sinon, l'algorithme infere l'octave en suivant le chromatisme :
   *   - Pour les tonales/mutants : quand l'index chromatique d'une note est
   *     inferieur ou egal a celui de la note precedente, on incremente l'octave
   *     (la gamme monte naturellement)
   *   - Pour les bottoms : l'octave est independant des tonales
   * - Le ding definit l'octave de reference (defaut: 3 si non precise)
   *
   * Separateurs acceptes : tiret (-) ou espace
   *
   * @param {string} layout - Chaine notes_layout a parser
   * @returns {Array<{name: string, type: string}>|null}
   *   Tableau d'objets {name: "D3", type: "ding"|"tonal"|"mutant"|"bottom"}
   *   ou null si le layout est invalide ou vide
   * @static
   */
  static parseLayout(layout) {
    if (!layout || typeof layout !== 'string') return null;

    /** Noms des 12 notes chromatiques (utilises pour calculer les index et inferer les octaves) */
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    /** Table de conversion bemols -> dieses enharmoniques */
    const FLATS_TO_SHARPS = {
      'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#',
      'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
    };

    /**
     * Normalise un nom de note en remplacant les bemols par leurs dieses enharmoniques.
     * @param {string} str - Nom de note potentiellement avec bemol
     * @returns {string} Nom de note normalise avec diese
     */
    function normalizeNote(str) {
      for (const [flat, sharp] of Object.entries(FLATS_TO_SHARPS)) {
        if (str.startsWith(flat)) return str.replace(flat, sharp);
      }
      return str;
    }

    /**
     * Parse une chaine de note en ses composants (nom + octave optionnelle).
     * @param {string} str - Chaine de note (ex: "C#4", "Bb", "D3")
     * @returns {{note: string, octave: number|null}|null} Composants parses ou null si invalide
     */
    function parseNoteStr(str) {
      str = normalizeNote(str);
      const m = str.match(/^([A-G]#?)(\d)?$/);
      if (!m) return null;
      return { note: m[1], octave: m[2] ? parseInt(m[2]) : null };
    }

    // Nettoyage : retirer le underscore trailing et les espaces superflus
    let cleaned = layout.replace(/_$/, '').replace(/\s+/g, ' ').trim();
    const slashIdx = cleaned.indexOf('/');
    if (slashIdx === -1) return null;

    // --- Parsing du ding (partie avant le /) ---
    const dingStr = cleaned.substring(0, slashIdx).trim();
    const dingParsed = parseNoteStr(dingStr);
    if (!dingParsed) return null;

    const rootOctave = dingParsed.octave || 3;  // Octave par defaut : 3
    const rootNote = dingParsed.note;

    // --- Tokenisation de la partie apres le / ---
    // Les parentheses () delimitent les bottoms, les crochets [] les mutants
    const notesPart = cleaned.substring(slashIdx + 1).trim();
    const tokens = [];
    let current = '';
    let inParens = false;    // Dans des parentheses (bottom)
    let inBrackets = false;  // Dans des crochets (mutant)

    for (let i = 0; i < notesPart.length; i++) {
      const ch = notesPart[i];
      if (ch === '(') {
        if (current.trim()) tokens.push(current.trim());
        current = '('; inParens = true;
      } else if (ch === ')') {
        current += ')'; tokens.push(current.trim());
        current = ''; inParens = false;
      } else if (ch === '[') {
        if (current.trim()) tokens.push(current.trim());
        current = '['; inBrackets = true;
      } else if (ch === ']') {
        current += ']'; tokens.push(current.trim());
        current = ''; inBrackets = false;
      } else if ((ch === '-' || ch === ' ') && !inParens && !inBrackets) {
        // Separateur (tiret ou espace) en dehors des delimiteurs
        if (current.trim()) tokens.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    const results = [];

    // Ajouter le ding comme premiere note
    results.push({
      name: rootNote + rootOctave,
      type: 'ding'
    });

    // --- Resolution automatique des octaves ---
    // L'algorithme suit la progression chromatique : quand l'index d'une note
    // est inferieur ou egal a la precedente, on monte d'une octave
    const rootIndex = NOTE_NAMES.indexOf(rootNote);
    let tonalOctave = rootOctave;     // Octave courante pour tonales/mutants
    let lastTonalIndex = rootIndex;    // Dernier index chromatique (pour detection de wrap)
    let isFirstTonal = true;           // La premiere tonale ne declenche pas d'increment
    let bottomOctave = rootOctave;     // Octave independante pour les bottoms

    tokens.filter(t => t.length > 0).forEach(token => {
      let type = 'tonal';  // Type par defaut
      let noteStr = token;

      // Determiner le type selon les delimiteurs
      if (token.startsWith('(') && token.endsWith(')')) {
        type = 'bottom';
        noteStr = token.slice(1, -1);  // Retirer les parentheses
      } else if (token.startsWith('[') && token.endsWith(']')) {
        type = 'mutant';
        noteStr = token.slice(1, -1);  // Retirer les crochets
      }

      const parsed = parseNoteStr(noteStr);
      if (!parsed) return;

      let noteOctave = parsed.octave;
      const noteIndex = NOTE_NAMES.indexOf(parsed.note);

      if (noteOctave === null) {
        // Octave non specifiee : inferer automatiquement
        if (type === 'tonal' || type === 'mutant') {
          if (isFirstTonal) {
            isFirstTonal = false;
          } else {
            // Si l'index chromatique descend ou reste egal, on monte d'octave
            if (noteIndex <= lastTonalIndex) tonalOctave++;
          }
          noteOctave = tonalOctave;
          lastTonalIndex = noteIndex;
        } else {
          // Les bottoms utilisent leur propre suivi d'octave
          noteOctave = bottomOctave;
        }
      } else {
        // Octave explicite : mettre a jour le suivi pour les notes suivantes
        if (type === 'tonal' || type === 'mutant') {
          tonalOctave = noteOctave;
          lastTonalIndex = noteIndex;
          isFirstTonal = false;
        } else {
          bottomOctave = noteOctave;
        }
      }

      results.push({
        name: parsed.note + noteOctave,
        type: type
      });
    });

    // Retourner null si seul le ding a ete parse (layout invalide ou incomplet)
    return results.length > 1 ? results : null;
  }
}

// =============================================================================
// AUTO-INITIALISATION VIA ATTRIBUTS DATA-*
// =============================================================================

/**
 * Initialise automatiquement un HandpanPlayer pour chaque element
 * portant l'attribut `data-handpan-player` dans le DOM.
 *
 * Attributs data-* supportes :
 *   - data-scale : cle de la gamme initiale (defaut: 'kurd')
 *   - data-size : taille en pixels (defaut: 300)
 *   - data-scale-selector : afficher le selecteur ('false' pour masquer)
 *   - data-note-names : afficher les noms de notes ('false' pour masquer)
 *   - data-haptics : activer le retour haptique ('false' pour desactiver)
 *   - data-wave : activer l'animation d'ondes ('false' pour desactiver)
 *
 * Exemple HTML :
 *   <div data-handpan-player data-scale="hijaz" data-size="400"></div>
 */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-handpan-player]').forEach(el => {
    new HandpanPlayer(el, {
      scale: el.dataset.scale || 'kurd',
      size: parseInt(el.dataset.size) || 300,
      showScaleSelector: el.dataset.scaleSelector !== 'false',
      showNoteNames: el.dataset.noteNames !== 'false',
      enableHaptics: el.dataset.haptics !== 'false',
      enableWaveAnimation: el.dataset.wave !== 'false'
    });
  });
});

// Export pour usage en tant que module CommonJS (tests Node, bundlers)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HandpanPlayer;
}
