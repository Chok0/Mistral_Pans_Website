/* ==========================================================================
   MISTRAL PANS - Scale Player Component
   Virtual Handpan with Web Audio API
   ========================================================================== */

class HandpanPlayer {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!this.container) {
      console.error('HandpanPlayer: Container not found');
      return;
    }
    
    // Options
    this.options = {
      scale: options.scale || 'kurd',
      showNoteNames: options.showNoteNames !== false,
      showScaleSelector: options.showScaleSelector !== false,
      accentColor: options.accentColor || '#0D7377',
      size: options.size || 300,
      ...options
    };
    
    // Audio context (created on first interaction)
    this.audioContext = null;
    this.gainNode = null;
    
    // Scale definitions
    this.scales = {
      kurd: {
        name: 'D Kurd',
        description: 'La plus populaire. Douce et méditative.',
        mood: 'Mélancolique, introspectif',
        notes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4']
      },
      celtic: {
        name: 'D Celtic Minor',
        description: 'Sonorités celtiques et médiévales.',
        mood: 'Mystique, nostalgique',
        notes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5']
      },
      pygmy: {
        name: 'D Pygmy',
        description: 'Gamme africaine. Joyeuse et entraînante.',
        mood: 'Joyeux, tribal',
        notes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'F4', 'G4', 'A4']
      },
      hijaz: {
        name: 'D Hijaz',
        description: 'Sonorités orientales. Envoûtante.',
        mood: 'Oriental, mystique',
        notes: ['D3', 'A3', 'Bb3', 'C#4', 'D4', 'E4', 'F4', 'G4', 'A4']
      },
      amara: {
        name: 'D Amara',
        description: 'Variante douce du Celtic. Idéale pour débuter.',
        mood: 'Doux, apaisant',
        notes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'A4', 'C5']
      },
      equinox: {
        name: 'F Equinox',
        description: 'Gamme grave et profonde.',
        mood: 'Profond, méditatif',
        notes: ['F3', 'Ab3', 'C4', 'Db4', 'Eb4', 'F4', 'G4', 'Ab4', 'C5']
      }
    };
    
    // Note frequencies (A4 = 440Hz)
    this.noteFrequencies = {
      'C3': 130.81, 'C#3': 138.59, 'Db3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'Eb3': 155.56,
      'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'Gb3': 185.00, 'G3': 196.00, 'G#3': 207.65,
      'Ab3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'Bb3': 233.08, 'B3': 246.94,
      'C4': 261.63, 'C#4': 277.18, 'Db4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'Eb4': 311.13,
      'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'Gb4': 369.99, 'G4': 392.00, 'G#4': 415.30,
      'Ab4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'Bb4': 466.16, 'B4': 493.88,
      'C5': 523.25, 'C#5': 554.37, 'Db5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'Eb5': 622.25,
      'E5': 659.25, 'F5': 698.46
    };
    
    this.currentScale = this.options.scale;
    this.activeNotes = new Set();
    this.audioCache = {};
    this.audioPath = options.audioPath || 'ressources/audio/';
    
    this.init();
  }
  
  init() {
    this.render();
    this.bindEvents();
    this.preloadCurrentScale();
  }
  
  // Convertir le nom de note vers le nom de fichier (C#4 → Cs4, Bb3 → As3)
  noteToFileName(noteName) {
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
  
  // Précharger les notes de la gamme courante
  preloadCurrentScale() {
    const scale = this.scales[this.currentScale];
    if (scale) {
      scale.notes.forEach(note => this.preloadAudio(note));
    }
  }
  
  preloadAudio(noteName) {
    const fileName = this.noteToFileName(noteName);
    if (this.audioCache[fileName]) return;
    
    const audio = new Audio(`${this.audioPath}${fileName}.flac`);
    audio.preload = 'auto';
    this.audioCache[fileName] = audio;
  }
  
  render() {
    const scale = this.scales[this.currentScale];
    const notes = scale.notes;
    const size = this.options.size;
    const center = size / 2;
    const outerRadius = size * 0.42;
    const innerRadius = size * 0.15;
    const noteRadius = size * 0.09;
    
    // Calculate note positions
    const notePositions = this.calculateNotePositions(notes.length, center, outerRadius, innerRadius);
    
    this.container.innerHTML = `
      <div class="handpan-player" style="--accent-color: ${this.options.accentColor}; --size: ${size}px;">
        ${this.options.showScaleSelector ? this.renderScaleSelector() : ''}
        
        <div class="handpan-visual">
          <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
            <!-- Outer shell -->
            <defs>
              <radialGradient id="shell-gradient" cx="30%" cy="30%">
                <stop offset="0%" stop-color="#5a5a5a"/>
                <stop offset="100%" stop-color="#3a3a3a"/>
              </radialGradient>
              <filter id="note-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
              </filter>
            </defs>
            
            <!-- Main shell -->
            <circle cx="${center}" cy="${center}" r="${size * 0.46}" fill="url(#shell-gradient)" />
            <circle cx="${center}" cy="${center}" r="${size * 0.44}" fill="none" stroke="#555" stroke-width="1"/>
            
            <!-- Notes -->
            ${notePositions.map((pos, i) => `
              <g class="note-group" data-note="${notes[i]}" data-index="${i}">
                <circle 
                  cx="${pos.x}" 
                  cy="${pos.y}" 
                  r="${i === 0 ? noteRadius * 1.3 : noteRadius}"
                  class="note-circle"
                  fill="#3d3d3d"
                  stroke="#555"
                  stroke-width="1"
                  filter="url(#note-shadow)"
                />
                ${this.options.showNoteNames ? `
                  <text 
                    x="${pos.x}" 
                    y="${pos.y}" 
                    text-anchor="middle" 
                    dominant-baseline="central"
                    class="note-label"
                    fill="#999"
                    font-size="${size * 0.035}px"
                    font-family="system-ui, sans-serif"
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
        </div>
      </div>
    `;
    
    this.addStyles();
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
      }
      
      .note-group {
        cursor: pointer;
        transition: transform 0.1s ease;
      }
      
      .note-group:hover .note-circle {
        fill: #5a5a5a;
      }
      
      .note-group.active .note-circle {
        fill: var(--accent) !important;
        transform-origin: center;
        animation: note-pulse 0.4s ease;
      }
      
      .note-group.active .note-label {
        fill: white !important;
      }
      
      @keyframes note-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
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
      
      .handpan-btn svg {
        flex-shrink: 0;
      }
    `;
    
    document.head.appendChild(styles);
  }
  
  bindEvents() {
    // Note clicks
    this.container.querySelectorAll('.note-group').forEach(group => {
      group.addEventListener('click', (e) => {
        const note = group.dataset.note;
        this.playNote(note);
        this.animateNote(group);
      });
      
      // Touch support
      group.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const note = group.dataset.note;
        this.playNote(note);
        this.animateNote(group);
      });
    });
    
    // Scale selector
    this.container.querySelectorAll('.handpan-scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setScale(btn.dataset.scale);
      });
    });
    
    // Play scale button
    const playBtn = this.container.querySelector('.handpan-btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.playScale();
      });
    }
  }
  
  playNote(noteName) {
    const fileName = this.noteToFileName(noteName);
    
    // Vérifier si déjà  en cache
    if (this.audioCache[fileName]) {
      const audio = this.audioCache[fileName].cloneNode();
      audio.volume = 0.7;
      audio.play().catch(e => console.warn('Erreur lecture audio:', e));
      return;
    }
    
    // Sinon charger et jouer
    const audio = new Audio(`${this.audioPath}${fileName}.flac`);
    audio.volume = 0.7;
    this.audioCache[fileName] = audio;
    audio.play().catch(e => console.warn('Erreur lecture audio:', e));
  }
  
  animateNote(noteGroup) {
    noteGroup.classList.add('active');
    setTimeout(() => {
      noteGroup.classList.remove('active');
    }, 400);
  }
  
  async playScale() {
    const scale = this.scales[this.currentScale];
    const notes = scale.notes;
    const noteGroups = this.container.querySelectorAll('.note-group');
    const playBtn = this.container.querySelector('.handpan-btn-play');
    
    if (playBtn) {
      playBtn.classList.add('playing');
      playBtn.querySelector('span').textContent = 'Lecture...';
    }
    
    // Play each note with delay
    for (let i = 0; i < notes.length; i++) {
      await this.delay(300);
      this.playNote(notes[i]);
      this.animateNote(noteGroups[i]);
    }
    
    // Play a simple arpeggio back down
    await this.delay(500);
    for (let i = notes.length - 2; i >= 0; i--) {
      await this.delay(250);
      this.playNote(notes[i]);
      this.animateNote(noteGroups[i]);
    }
    
    if (playBtn) {
      playBtn.classList.remove('playing');
      playBtn.querySelector('span').textContent = 'Écouter la gamme';
    }
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  setScale(scaleKey) {
    if (!this.scales[scaleKey]) return;
    
    this.currentScale = scaleKey;
    this.render();
    this.bindEvents();
    
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
}

// Auto-init players with data attributes
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-handpan-player]').forEach(el => {
    new HandpanPlayer(el, {
      scale: el.dataset.scale || 'kurd',
      size: parseInt(el.dataset.size) || 300,
      showScaleSelector: el.dataset.scaleSelector !== 'false',
      showNoteNames: el.dataset.noteNames !== 'false'
    });
  });
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HandpanPlayer;
}
