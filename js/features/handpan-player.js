/* ==========================================================================
   MISTRAL PANS - Scale Player Component
   Virtual Handpan with Web Audio API
   Uses MistralScales from scales-data.js when available
   ========================================================================== */

class HandpanPlayer {
  // Instance counter for unique IDs
  static instanceCount = 0;

  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      console.error('HandpanPlayer: Container not found');
      return;
    }

    // Unique instance ID for SVG elements
    this.instanceId = ++HandpanPlayer.instanceCount;

    // Options
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

    // Custom notes from layout string (bypasses scale system)
    this.customNotes = null;
    if (options.layout) {
      this.customNotes = HandpanPlayer.parseLayout(options.layout);
      if (this.customNotes) {
        this.options.showScaleSelector = false;
      }
    }

    // Scale definitions - use unified MistralScales if available
    this.scales = this._buildScalesFromMistralScales();

    this.currentScale = this.options.scale;
    this.audioCache = {};
    this.activeAudioClones = new Set();
    this.audioPath = options.audioPath || 'ressources/audio/';

    // Detect supported audio format: prefer FLAC, fallback to MP3 (Safari/iOS)
    const probe = new Audio();
    this.audioExt = (probe.canPlayType('audio/flac') !== '') ? '.flac' : '.mp3';

    // State management
    this.isPlaying = false;
    this.playAbortController = null;
    this.boundHandlers = new Map();
    this.activeTimeouts = new Set();

    // Web Audio API context (shared across instances)
    this.audioContext = null;

    // Listen for notation mode changes
    this._onNotationChange = () => {
      this.scales = this._buildScalesFromMistralScales();
      this.render();
      this.bindEvents();
    };
    window.addEventListener('notation-mode-change', this._onNotationChange);

    this.init();
  }

  // Build scales object from MistralScales (unified source) or use fallback
  _buildScalesFromMistralScales() {
    // Use MistralScales if available (from scales-data.js)
    if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA) {
      const scales = {};
      const userNotation = MistralScales.toUserNotation || MistralScales.toDisplayNotation;
      for (const [key, data] of Object.entries(MistralScales.SCALES_DATA)) {
        if (data.baseNotes && data.baseNotes.length > 0) {
          // Use proper music theory to determine sharp/flat for base tonality
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

    // Fallback if MistralScales not loaded
    return {
      kurd: { name: 'D Kurd', description: 'La plus populaire.', mood: 'Melancolique', notes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'] },
      amara: { name: 'D Amara', description: 'Variante douce.', mood: 'Doux', notes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'] },
      hijaz: { name: 'D Hijaz', description: 'Orientale.', mood: 'Mystique', notes: ['D3', 'A3', 'Bb3', 'C#4', 'D4', 'E4', 'F4', 'G4', 'A4'] },
      equinox: { name: 'F Equinox', description: 'Grave et profonde.', mood: 'Meditatif', notes: ['F3', 'Ab3', 'C4', 'Db4', 'Eb4', 'F4', 'G4', 'Ab4', 'C5'] }
    };
  }

  init() {
    this.render();
    this.bindEvents();
    this.preloadCurrentScale();
  }

  // Initialize Web Audio API on first user interaction
  initAudioContext() {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported, falling back to HTML Audio');
    }
  }

  // Convert note name to audio file name (C#4 -> Cs4, Bb3 -> As3)
  noteToFileName(noteName) {
    // Use MistralScales if available
    if (typeof MistralScales !== 'undefined' && MistralScales.noteToFileName) {
      return MistralScales.noteToFileName(noteName);
    }

    // Fallback
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

  // Preload audio for current scale or custom notes
  preloadCurrentScale() {
    const notes = this._getNoteNames();
    notes.forEach(note => this.preloadAudio(note));
  }

  preloadAudio(noteName) {
    const fileName = this.noteToFileName(noteName);
    if (this.audioCache[fileName]) return;

    const audio = new Audio(`${this.audioPath}${fileName}${this.audioExt}`);
    audio.preload = 'auto';
    this.audioCache[fileName] = audio;
  }

  // Get unique SVG IDs for this instance
  getSvgIds() {
    return {
      shellGradient: `shell-gradient-${this.instanceId}`,
      noteShadow: `note-shadow-${this.instanceId}`,
      waveAnimation: `wave-animation-${this.instanceId}`
    };
  }

  // Get the list of note names for the current state (custom or scale-based)
  _getNoteNames() {
    if (this.customNotes) {
      return this.customNotes.map(n => this._toDisplayName(n.name));
    }
    const scale = this.scales[this.currentScale];
    return scale ? scale.notes : [];
  }

  // Convert internal sharp notation to display (flats when appropriate, French if preferred)
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

  render() {
    if (this.customNotes) {
      this._renderTyped();
    } else {
      this._renderSimple();
    }
    this.addStyles();
  }

  // Original render for scale-based mode
  _renderSimple() {
    const scale = this.scales[this.currentScale];
    if (!scale) {
      console.error(`HandpanPlayer: Scale "${this.currentScale}" not found`);
      return;
    }

    const notes = scale.notes;
    const size = this.options.size;
    const center = size / 2;
    const outerRadius = size * 0.42;
    const innerRadius = size * 0.15;
    const noteRadius = size * 0.09;
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

  // Type-aware render for layout-based mode (ding, tonals, mutants, bottoms)
  _renderTyped() {
    const allNotes = this.customNotes;
    const size = this.options.size;
    const center = size / 2;
    const ids = this.getSvgIds();

    const ding = allNotes.find(n => n.type === 'ding');
    const tonals = allNotes.filter(n => n.type === 'tonal');
    const mutants = allNotes.filter(n => n.type === 'mutant');
    const bottoms = allNotes.filter(n => n.type === 'bottom');

    const shellRadius = size * 0.42;
    const tonalRadius = size * 0.31;
    const dingSize = size * 0.09;
    const noteSize = size * 0.065;
    const mutantRadius = size * 0.18;
    const mutantNoteSize = noteSize * 0.85;
    const bottomRadius = size * 0.46;
    const bottomNoteSize = noteSize * 0.85;
    const fontSize = size * 0.032;

    const hasBottoms = bottoms.length > 0;
    const viewH = hasBottoms ? size * 1.15 : size;
    const viewY = 0;

    let svgNotes = '';
    let noteIndex = 0;

    // Ding
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

    // Mutants (inner ring, top)
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

    // Tonals (main ring)
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

    // Bottoms (outer ring, bottom half)
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

    // Build note names for info display (ordered: ding, tonals, mutants, bottoms)
    const displayNotes = allNotes.map(n => this._toDisplayName(n.name));
    const scaleName = ding ? this._toDisplayName(ding.name).replace(/\d$/, '') : '';

    // Legend
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

  // Tonal positioning (alternating left/right, same as configurator)
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
        adjustedIndex = index - 1;
        middleCount = total - 2;
        isRight = (adjustedIndex % 2 === 1);
        sideIndex = Math.floor(adjustedIndex / 2);
        notesPerSide = Math.ceil(middleCount / 2);

        if (isRight) {
          const step = notesPerSide > 1 ? 90 / (notesPerSide - 1) : 0;
          angleDeg = 315 + sideIndex * step;
          if (angleDeg >= 360) angleDeg -= 360;
        } else {
          const step = notesPerSide > 1 ? 90 / (notesPerSide - 1) : 0;
          angleDeg = 225 - sideIndex * step;
        }
      } else {
        isRight = (index % 2 === 0);
        sideIndex = Math.floor(index / 2);
        notesPerSide = Math.ceil((total - 1) / 2);

        if (isRight) {
          const range = 120;
          const step = notesPerSide > 1 ? range / (notesPerSide - 1) : 0;
          angleDeg = 290 + sideIndex * step;
          if (angleDeg >= 360) angleDeg -= 360;
        } else {
          const range = 120;
          const step = notesPerSide > 1 ? range / (notesPerSide - 1) : 0;
          angleDeg = 250 - sideIndex * step;
        }
      }
    }

    const angleRad = angleDeg * Math.PI / 180;
    return {
      x: center + Math.cos(angleRad) * radius,
      y: center - Math.sin(angleRad) * radius
    };
  }

  // Mutant positioning (arc at top of shell)
  _getMutantPosition(index, total, radius, center) {
    if (total === 1) {
      return { x: center, y: center - radius };
    }
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

  // Bottom positioning (arc at bottom of shell)
  _getBottomPosition(index, total, radius, center) {
    if (total === 1) {
      return { x: center, y: center + radius };
    }
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

  calculateNotePositions(noteCount, center, outerRadius, innerRadius) {
    const positions = [];

    // First note (Ding) is always in the center-top
    positions.push({ x: center, y: center - innerRadius * 0.5 });

    // Remaining notes arranged in a circle
    const remainingNotes = noteCount - 1;
    const startAngle = -Math.PI / 2 + Math.PI / remainingNotes; // Start from top-right

    for (let i = 0; i < remainingNotes; i++) {
      // Alternate between left and right, going down
      const index = i % 2 === 0 ? Math.floor(i / 2) : remainingNotes - 1 - Math.floor(i / 2);
      const angle = startAngle + (index * 2 * Math.PI / remainingNotes);

      positions.push({
        x: center + Math.cos(angle) * outerRadius,
        y: center + Math.sin(angle) * outerRadius
      });
    }

    return positions;
  }

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
        z-index: 1000;
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
        z-index: 999;
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
        touch-action: manipulation;
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

      /* Wave animation */
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

      /* Legend for typed notes */
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

      /* Typed note styles */
      .note-mutant { opacity: 0.85; }
    `;

    document.head.appendChild(styles);
  }

  bindEvents() {
    // Clear previous handlers
    this.unbindEvents();

    const svg = this.container.querySelector('svg');
    if (!svg) return;

    // Use pointer events for unified touch/mouse handling
    const handlePointerDown = (e) => {
      const noteGroup = e.target.closest('.note-group');
      if (!noteGroup) return;

      // Prevent double-firing on touch devices
      if (e.pointerType === 'touch') {
        e.preventDefault();
      }

      const note = noteGroup.dataset.note;
      this.triggerNote(noteGroup, note);
    };

    svg.addEventListener('pointerdown', handlePointerDown);
    this.boundHandlers.set('svg-pointerdown', { element: svg, event: 'pointerdown', handler: handlePointerDown });

    // Multi-touch support
    const handleTouchStart = (e) => {
      // Allow multi-touch - process all touch points
      Array.from(e.changedTouches).forEach(touch => {
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const noteGroup = element?.closest('.note-group');
        if (noteGroup) {
          const note = noteGroup.dataset.note;
          this.triggerNote(noteGroup, note);
        }
      });
    };

    svg.addEventListener('touchstart', handleTouchStart, { passive: true });
    this.boundHandlers.set('svg-touchstart', { element: svg, event: 'touchstart', handler: handleTouchStart });

    // Scale selector
    this.container.querySelectorAll('.handpan-scale-btn').forEach((btn, index) => {
      const handler = () => this.setScale(btn.dataset.scale);
      btn.addEventListener('click', handler);
      this.boundHandlers.set(`scale-btn-${index}`, { element: btn, event: 'click', handler });
    });

    // Play scale button
    const playBtn = this.container.querySelector('.handpan-btn-play');
    if (playBtn) {
      const playHandler = () => this.togglePlayScale();
      playBtn.addEventListener('click', playHandler);
      this.boundHandlers.set('play-btn', { element: playBtn, event: 'click', handler: playHandler });
    }

    // Resize button
    const resizeBtn = this.container.querySelector('.handpan-btn-resize');
    if (resizeBtn) {
      const resizeHandler = () => this.toggleEnlarged();
      resizeBtn.addEventListener('click', resizeHandler);
      this.boundHandlers.set('resize-btn', { element: resizeBtn, event: 'click', handler: resizeHandler });
    }
  }

  unbindEvents() {
    this.boundHandlers.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.boundHandlers.clear();
  }

  // Unified note trigger with haptics and wave animation
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

  // Haptic feedback for mobile
  triggerHaptic() {
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  }

  // Wave animation from note
  createWaveAnimation(noteGroup) {
    const svg = this.container.querySelector('svg');
    const waveContainer = svg.querySelector('.wave-container');
    if (!waveContainer) return;

    const x = parseFloat(noteGroup.dataset.x);
    const y = parseFloat(noteGroup.dataset.y);
    const isCenter = noteGroup.dataset.index === '0';
    const baseRadius = isCenter ? this.options.size * 0.09 * 1.3 : this.options.size * 0.09;

    const wave = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    wave.setAttribute('cx', x);
    wave.setAttribute('cy', y);
    wave.setAttribute('r', baseRadius);
    wave.setAttribute('class', 'wave-ring');
    wave.style.transformOrigin = `${x}px ${y}px`;
    wave.style.animation = 'wave-expand 0.6s ease-out forwards';

    waveContainer.appendChild(wave);

    // Cleanup after animation
    const timeoutId = setTimeout(() => {
      wave.remove();
      this.activeTimeouts.delete(timeoutId);
    }, 600);
    this.activeTimeouts.add(timeoutId);
  }

  // Toggle enlarged view
  toggleEnlarged() {
    const player = this.container.querySelector('.handpan-player');
    const isEnlarged = player.classList.contains('enlarged');

    if (isEnlarged) {
      // Remove overlay
      const overlay = document.querySelector('.handpan-overlay');
      if (overlay) overlay.remove();
      player.classList.remove('enlarged');
    } else {
      // Add overlay
      const overlay = document.createElement('div');
      overlay.className = 'handpan-overlay';
      overlay.addEventListener('click', () => this.toggleEnlarged());
      document.body.appendChild(overlay);
      player.classList.add('enlarged');
    }

    // Re-bind events for new SVG size context
    this.bindEvents();
  }

  playNote(noteName) {
    const fileName = this.noteToFileName(noteName);

    // Check cache
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

    // Load and play
    const audio = new Audio(`${this.audioPath}${fileName}${this.audioExt}`);
    audio.volume = 0.7;
    this.audioCache[fileName] = audio;
    audio.play().catch(e => console.warn('Erreur lecture audio:', e));
  }

  animateNote(noteGroup) {
    noteGroup.classList.add('active');
    const timeoutId = setTimeout(() => {
      noteGroup.classList.remove('active');
      this.activeTimeouts.delete(timeoutId);
    }, 400);
    this.activeTimeouts.add(timeoutId);
  }

  // Toggle play/stop for scale playback
  togglePlayScale() {
    if (this.isPlaying) {
      this.stopPlayScale();
    } else {
      this.playScale();
    }
  }

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

  async playScale() {
    if (this.isPlaying) return;

    const notes = this._getNoteNames();
    const playBtn = this.container.querySelector('.handpan-btn-play');

    // Build a map of note name -> DOM element for reliable lookup
    const noteGroupMap = {};
    this.container.querySelectorAll('.note-group').forEach(g => {
      const noteName = g.dataset.note;
      if (noteName) {
        // Map both internal name and display name
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
      // Play each note with delay
      for (let i = 0; i < notes.length; i++) {
        if (signal.aborted) return;
        await this.delay(300);
        if (signal.aborted) return;
        const group = noteGroupMap[notes[i]];
        if (group) this.triggerNote(group, notes[i]);
      }

      // Play a simple arpeggio back down
      await this.delay(500);
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

  delay(ms) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.activeTimeouts.delete(timeoutId);
        resolve();
      }, ms);
      this.activeTimeouts.add(timeoutId);

      // Support abort
      if (this.playAbortController) {
        this.playAbortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          this.activeTimeouts.delete(timeoutId);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }
    });
  }

  setScale(scaleKey) {
    if (!this.scales[scaleKey]) return;

    // Stop any playing sequence
    this.stopPlayScale();

    this.currentScale = scaleKey;
    this.render();
    this.bindEvents();
    this.preloadCurrentScale();

    // Dispatch event for external listeners
    this.container.dispatchEvent(new CustomEvent('scalechange', {
      detail: { scale: scaleKey, scaleData: this.scales[scaleKey] }
    }));
  }

  getScale() {
    return {
      key: this.currentScale,
      ...this.scales[this.currentScale]
    };
  }

  // Update size dynamically
  setSize(newSize) {
    this.options.size = newSize;
    this.render();
    this.bindEvents();
  }

  // Cleanup method to prevent memory leaks
  destroy() {
    // Stop playback
    this.stopPlayScale();

    // Clear all timeouts
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts.clear();

    // Remove event listeners
    this.unbindEvents();
    if (this._onNotationChange) {
      window.removeEventListener('notation-mode-change', this._onNotationChange);
    }

    // Remove overlay if enlarged
    const overlay = document.querySelector('.handpan-overlay');
    if (overlay) overlay.remove();

    // Clean up active audio clones
    this.activeAudioClones.forEach(a => { a.pause(); a.src = ''; });
    this.activeAudioClones.clear();

    // Clear audio cache
    Object.values(this.audioCache).forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    this.audioCache = {};

    // Clear container
    this.container.innerHTML = '';

    // Close audio context if we own it
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
  }

  // ── Static: Parse a notes_layout string into typed note objects ──
  // Layout format: "D/-A-Bb-C-D-E-F-G-A_" or "D/(F)-(G)-A-Bb-C-D-E-F-G-A-C-[D]"
  // Returns array of {name: "D3", type: "ding"|"tonal"|"mutant"|"bottom"}
  static parseLayout(layout) {
    if (!layout || typeof layout !== 'string') return null;

    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLATS_TO_SHARPS = {
      'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#',
      'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
    };

    function normalizeNote(str) {
      for (const [flat, sharp] of Object.entries(FLATS_TO_SHARPS)) {
        if (str.startsWith(flat)) return str.replace(flat, sharp);
      }
      return str;
    }

    function parseNoteStr(str) {
      str = normalizeNote(str);
      const m = str.match(/^([A-G]#?)(\d)?$/);
      if (!m) return null;
      return { note: m[1], octave: m[2] ? parseInt(m[2]) : null };
    }

    // Clean up
    let cleaned = layout.replace(/_$/, '').replace(/\s+/g, ' ').trim();
    const slashIdx = cleaned.indexOf('/');
    if (slashIdx === -1) return null;

    // Parse ding (before /)
    const dingStr = cleaned.substring(0, slashIdx).trim();
    const dingParsed = parseNoteStr(dingStr);
    if (!dingParsed) return null;

    const rootOctave = dingParsed.octave || 3;
    const rootNote = dingParsed.note;

    // Tokenize the rest
    const notesPart = cleaned.substring(slashIdx + 1).trim();
    const tokens = [];
    let current = '';
    let inParens = false;
    let inBrackets = false;

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
        if (current.trim()) tokens.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    const results = [];

    // Add ding
    results.push({
      name: rootNote + rootOctave,
      type: 'ding'
    });

    // Track octave state
    const rootIndex = NOTE_NAMES.indexOf(rootNote);
    let tonalOctave = rootOctave;
    let lastTonalIndex = rootIndex;
    let isFirstTonal = true;
    let bottomOctave = rootOctave;

    tokens.filter(t => t.length > 0).forEach(token => {
      let type = 'tonal';
      let noteStr = token;

      if (token.startsWith('(') && token.endsWith(')')) {
        type = 'bottom';
        noteStr = token.slice(1, -1);
      } else if (token.startsWith('[') && token.endsWith(']')) {
        type = 'mutant';
        noteStr = token.slice(1, -1);
      }

      const parsed = parseNoteStr(noteStr);
      if (!parsed) return;

      let noteOctave = parsed.octave;
      const noteIndex = NOTE_NAMES.indexOf(parsed.note);

      if (noteOctave === null) {
        if (type === 'tonal' || type === 'mutant') {
          if (isFirstTonal) {
            isFirstTonal = false;
          } else {
            if (noteIndex <= lastTonalIndex) tonalOctave++;
          }
          noteOctave = tonalOctave;
          lastTonalIndex = noteIndex;
        } else {
          noteOctave = bottomOctave;
        }
      } else {
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

    return results.length > 1 ? results : null;
  }
}

// Auto-init players with data attributes
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

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HandpanPlayer;
}
