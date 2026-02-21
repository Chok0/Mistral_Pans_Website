/* ==========================================================================
   MISTRAL PANS - Page Boutique (Configurateur)
   Logique du configurateur interactif : gammes, tonalites, tailles,
   materiaux, player SVG, faisabilite, prix, accessoires, navigation
   ========================================================================== */

(function(window) {
  'use strict';

  // ===== SCALES DATA (from unified scales-data.js) =====
  const SCALES_DATA = MistralScales.SCALES_DATA;
  const NOTE_NAMES = MistralScales.NOTE_NAMES;
  const FLATS_TO_SHARPS = MistralScales.FLATS_TO_SHARPS;
  const SHARPS_TO_FLATS = MistralScales.SHARPS_TO_FLATS;
  const toDisplayNotation = MistralScales.toDisplayNotation;
  const toUserNotation = MistralScales.toUserNotation;
  const shouldUseFlats = MistralScales.shouldUseFlats;
  const getTonalityChipNotation = MistralScales.getTonalityChipNotation;

  // Unified scale data accessor: custom_layouts (admin) > SCALES_DATA (hardcoded)
  function getScaleDataUnified(code) {
    if (typeof MistralGammes !== 'undefined' && MistralGammes.getScaleDataForConfigurateur) {
      const data = MistralGammes.getScaleDataForConfigurateur(code);
      if (data) return data;
    }
    return SCALES_DATA[code] || null;
  }

  // Update tonality chips labels based on music theory rules
  // Each chip displays its correct notation according to the cycle of fifths:
  // - Eb, Ab, Bb always shown as flats (D#, G#, A# are theoretically impractical)
  // - Db shown as flat (easier than C# with 7 sharps)
  // - F#/Gb depends on scale preference
  function updateTonalityChipsLabels() {
    const scaleData = getScaleDataUnified(state.scale);
    if (!scaleData) return;
    const isFrench = MistralScales.getNotationMode() === 'french';

    document.querySelectorAll('#chips-tonality .chip').forEach(chip => {
      const value = chip.dataset.value; // Always stored as sharps internally
      let label = getTonalityChipNotation(value, scaleData);
      if (isFrench) label = MistralScales.toFrenchNotation(label);
      chip.textContent = label;
    });
  }

  // Base frequencies for octave 0
  const BASE_FREQ = 16.35; // C0

  // ===== STATE =====
  const state = {
    scale: 'kurd',
    notes: 9,
    tonality: 'D3',
    tuning: '440',
    size: '53',
    material: 'NS',  // Default material: Acier Nitrure
    housse: null     // Selected housse accessory (null = none)
  };

  // Lot navigator state
  let currentLotIndex = 0;
  let lotNavBound = false;

  // ===== PRICING =====
  // Defaults (overridden by admin config if available)
  const PRICING_DEFAULTS = {
    prixParNote: 115,
    bonusOctave2: 50,
    bonusBottoms: 25,
    malusDifficulteWarning: 5,
    malusDifficulteDifficile: 10
  };

  function getPricingConfig() {
    const config = MistralUtils.getTarifsPublics();
    return {
      prixParNote: config.prixParNote,
      bonusOctave2: config.bonusOctave2,
      bonusBottoms: config.bonusBottoms,
      malusDifficulteWarning: config.malusDifficulteWarning,
      malusDifficulteDifficile: config.malusDifficulteDifficile
    };
  }

  function calculatePrice(notes, size, feasibilityStatus, materialCode) {
    const pricing = getPricingConfig();
    let basePrice = 0;
    let octave2Bonus = 0;
    let hasBottom = false;
    let octave2Count = 0;

    notes.forEach(note => {
      basePrice += pricing.prixParNote;
      if (note.octave === 2) {
        octave2Bonus += pricing.bonusOctave2;
        octave2Count++;
      }
      if (note.type === 'bottom') {
        hasBottom = true;
      }
    });

    const bottomsBonus = hasBottom ? pricing.bonusBottoms : 0;

    // Malus taille (montant fixe en EUR)
    const sizeMalus = typeof MistralTailles !== 'undefined'
      ? MistralTailles.getSizeMalusEur(size)
      : 0;

    // Sous-total avant difficulte
    const subtotal = basePrice + octave2Bonus + bottomsBonus + sizeMalus;

    // Pourcentage selon difficulte
    let difficultyPercent = 0;
    let difficultyAmount = 0;
    if (feasibilityStatus === 'warning') {
      difficultyPercent = pricing.malusDifficulteWarning;
      difficultyAmount = subtotal * (difficultyPercent / 100);
    } else if (feasibilityStatus === 'difficult') {
      difficultyPercent = pricing.malusDifficulteDifficile;
      difficultyAmount = subtotal * (difficultyPercent / 100);
    }

    const rawPrice = subtotal + difficultyAmount;

    // Arrondir a la tranche de 5 inferieure
    const finalPrice = Math.floor(rawPrice / 5) * 5;

    // Stocker la decomposition pour affichage
    state._priceBreakdown = {
      noteCount: notes.length,
      prixParNote: pricing.prixParNote,
      basePrice: basePrice,
      octave2Count: octave2Count,
      octave2Bonus: octave2Bonus,
      bottomsBonus: bottomsBonus,
      sizeMalus: sizeMalus,
      sizeLabel: size + ' cm',
      subtotal: subtotal,
      difficultyPercent: difficultyPercent,
      difficultyAmount: difficultyAmount,
      feasibilityStatus: feasibilityStatus,
      rawPrice: rawPrice,
      rounding: finalPrice - rawPrice,
      finalPrice: finalPrice
    };

    return finalPrice;
  }

  // ===== AUDIO (FLAC Samples) =====
  const audioCache = {};
  const AUDIO_PATH = 'ressources/audio/';

  // Convertir le nom de note interne vers le nom du fichier
  // Ex: "C#4" -> "Cs4", "Bb3" -> "As3" (Bb = A#)
  function noteToFileName(noteName) {
    // D'abord normaliser les bemols en dieses
    const flatToSharp = {
      'Db': 'Cs', 'Eb': 'Ds', 'Fb': 'E', 'Gb': 'Fs',
      'Ab': 'Gs', 'Bb': 'As', 'Cb': 'B'
    };

    let fileName = noteName;

    // Remplacer les bemols par leurs equivalents dieses
    for (const [flat, sharp] of Object.entries(flatToSharp)) {
      if (fileName.startsWith(flat)) {
        fileName = fileName.replace(flat, sharp);
        break;
      }
    }

    // Remplacer # par s pour le nom de fichier
    fileName = fileName.replace('#', 's');

    return fileName;
  }

  // Precharger un fichier audio
  async function preloadAudio(noteName) {
    const fileName = noteToFileName(noteName);
    if (audioCache[fileName]) return audioCache[fileName];

    try {
      const audio = new Audio(`${AUDIO_PATH}${fileName}.flac`);
      audio.preload = 'auto';
      audioCache[fileName] = audio;
      return audio;
    } catch (e) {
      console.warn(`Impossible de charger ${fileName}.flac`);
      return null;
    }
  }

  // Jouer une note
  function playNote(noteName) {
    const fileName = noteToFileName(noteName);

    // Verifier si deja en cache
    if (audioCache[fileName]) {
      const audio = audioCache[fileName].cloneNode();
      audio.volume = 0.7;
      audio.addEventListener('ended', () => { audio.src = ''; }, { once: true });
      audio.play().catch(e => console.warn('Erreur lecture audio:', e));
      return;
    }

    // Sinon charger et jouer
    const audio = new Audio(`${AUDIO_PATH}${fileName}.flac`);
    audio.volume = 0.7;
    audioCache[fileName] = audio;
    audio.play().catch(e => console.warn('Erreur lecture audio:', e));
  }

  // Precharger les notes de la gamme courante
  function preloadCurrentScale() {
    const notes = getCurrentNotes();
    notes.forEach(n => preloadAudio(`${n.note}${n.octave}`));
  }

  // Compatibilite avec l'ancien code (freq -> note)
  // Garder getFrequency pour le tri des notes par hauteur
  function getFrequency(note, octave) {
    const noteIndex = NOTE_NAMES.indexOf(note);
    if (noteIndex === -1) return 0;
    const semitones = octave * 12 + noteIndex;
    let freq = BASE_FREQ * Math.pow(2, semitones / 12);
    if (state.tuning === '432') freq *= (432 / 440);
    return freq;
  }

  // ===== PARSE PATTERN =====
  function normalizeNote(noteStr) {
    for (const [flat, sharp] of Object.entries(FLATS_TO_SHARPS)) {
      if (noteStr.startsWith(flat)) {
        return noteStr.replace(flat, sharp);
      }
    }
    return noteStr;
  }

  function parseNote(noteStr) {
    noteStr = normalizeNote(noteStr);
    const match = noteStr.match(/^([A-G]#?)(\d)?$/);
    if (!match) return null;
    return { note: match[1], octave: match[2] ? parseInt(match[2]) : null };
  }

  function parsePattern(pattern, rootNote, rootOctave, transpose) {
    const notes = [];
    pattern = pattern.replace(/_$/, '').replace(/\s+/g, ' ').trim();

    const slashIndex = pattern.indexOf('/');
    if (slashIndex === -1) return notes;

    let notesPart = pattern.substring(slashIndex + 1).trim();

    const tokens = [];
    let current = '';
    let inParens = false;
    let inBrackets = false;

    for (let i = 0; i < notesPart.length; i++) {
      const char = notesPart[i];

      if (char === '(') {
        if (current.trim()) tokens.push(current.trim());
        current = '(';
        inParens = true;
      } else if (char === ')') {
        current += ')';
        tokens.push(current.trim());
        current = '';
        inParens = false;
      } else if (char === '[') {
        if (current.trim()) tokens.push(current.trim());
        current = '[';
        inBrackets = true;
      } else if (char === ']') {
        current += ']';
        tokens.push(current.trim());
        current = '';
        inBrackets = false;
      } else if ((char === '-' || char === ' ') && !inParens && !inBrackets) {
        if (current.trim()) tokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    const filteredTokens = tokens.filter(t => t && t.length > 0);

    const dingNote = transposeNote(rootNote, rootOctave, transpose);
    notes.push({
      ...dingNote,
      type: 'ding',
      freq: getFrequency(dingNote.note, dingNote.octave)
    });

    const rootIndex = NOTE_NAMES.indexOf(rootNote);

    let tonalOctave = rootOctave;
    let lastTonalIndex = rootIndex;
    let isFirstTonal = true;
    let bottomOctave = rootOctave;

    filteredTokens.forEach(token => {
      let type = 'tonal';
      let noteStr = token;

      if (token.startsWith('(') && token.endsWith(')')) {
        type = 'bottom';
        noteStr = token.slice(1, -1);
      } else if (token.startsWith('[') && token.endsWith(']')) {
        type = 'mutant';
        noteStr = token.slice(1, -1);
      }

      const parsed = parseNote(noteStr);
      if (!parsed) return;

      let noteOctave = parsed.octave;
      const noteIndex = NOTE_NAMES.indexOf(parsed.note);

      if (noteOctave === null) {
        if (type === 'tonal' || type === 'mutant') {
          if (isFirstTonal) {
            isFirstTonal = false;
          } else {
            if (noteIndex <= lastTonalIndex) {
              tonalOctave++;
            }
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

      const transposed = transposeNote(parsed.note, noteOctave, transpose);
      notes.push({
        ...transposed,
        type: type,
        freq: getFrequency(transposed.note, transposed.octave)
      });
    });

    return notes;
  }

  function transposeNote(note, octave, semitones) {
    const noteIndex = NOTE_NAMES.indexOf(note);
    const newIndex = noteIndex + semitones;
    const newOctave = octave + Math.floor(newIndex / 12);
    const newNote = NOTE_NAMES[((newIndex % 12) + 12) % 12];
    return { note: newNote, octave: newOctave };
  }

  function getTransposition() {
    const scaleData = getScaleDataUnified(state.scale);
    if (!scaleData) return 0;
    const baseNote = scaleData.baseRoot;
    const baseOctave = scaleData.baseOctave;

    const targetMatch = state.tonality.match(/^([A-G]#?)(\d)$/);
    if (!targetMatch) return 0;

    const targetNote = targetMatch[1];
    const targetOctave = parseInt(targetMatch[2]);

    const baseIndex = NOTE_NAMES.indexOf(baseNote) + baseOctave * 12;
    const targetIndex = NOTE_NAMES.indexOf(targetNote) + targetOctave * 12;

    return targetIndex - baseIndex;
  }

  function getCurrentNotes() {
    const scaleData = getScaleDataUnified(state.scale);
    if (!scaleData || !scaleData.patterns) return [];
    const pattern = scaleData.patterns[state.notes];
    if (!pattern) return [];

    const transpose = getTransposition();
    return parsePattern(pattern, scaleData.baseRoot, scaleData.baseOctave, transpose);
  }

  // ===== RENDER PLAYER =====
  function renderPlayer() {
    const notes = getCurrentNotes();
    const scaleData = getScaleDataUnified(state.scale);
    if (!scaleData) return;
    const useFlats = shouldUseFlats(state.tonality, scaleData);
    const size = 900;
    const center = size / 2;

    const ding = notes.find(n => n.type === 'ding');
    const tonals = notes.filter(n => n.type === 'tonal');
    const mutants = notes.filter(n => n.type === 'mutant');
    const bottoms = notes.filter(n => n.type === 'bottom');

    const shellRadius = size * 0.35;
    const tonalRadius = size * 0.26;
    const dingSize = size * 0.08;
    const noteSize = size * 0.055;
    const mutantRadius = size * 0.15;
    const mutantNoteSize = noteSize * 0.85;
    const bottomRadius = size * 0.46;
    const bottomNoteSize = noteSize * 0.9;

    const margin = 100;
    const viewBoxX = -margin;
    const viewBoxY = -margin;
    const viewBoxW = size + margin * 2;
    const viewBoxH = size + margin * 2.2;

    let svg = `
      <svg viewBox="${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}" width="${size}" height="${size * 1.1}" style="overflow: visible;">
        <defs>
          <radialGradient id="shell-grad" cx="30%" cy="30%">
            <stop offset="0%" stop-color="#E8E8E8"/>
            <stop offset="70%" stop-color="#B8B8B8"/>
            <stop offset="100%" stop-color="#7A7A7A"/>
          </radialGradient>
        </defs>

        <circle cx="${center}" cy="${center}" r="${shellRadius}" fill="url(#shell-grad)"/>
        <circle cx="${center}" cy="${center}" r="${shellRadius - 2}" fill="none" stroke="#909090" stroke-width="1.5"/>

        <g class="wave-container"></g>
    `;

    if (ding) {
      const dingDisplay = toUserNotation(`${ding.note}${ding.octave}`, useFlats);
      svg += `
        <g class="note-group" data-note="${ding.note}${ding.octave}" data-freq="${ding.freq}" data-x="${center}" data-y="${center}" data-r="${dingSize}">
          <circle cx="${center}" cy="${center}" r="${dingSize}" class="note-circle note-ding" stroke="#686868" stroke-width="1.5"/>
          <text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central" class="note-label" fill="#3A3A3A" font-size="24" font-weight="600" font-family="system-ui">${dingDisplay}</text>
        </g>
      `;
    }

    mutants.forEach((note, i) => {
      const pos = getMutantPosition(i, mutants.length, mutantRadius, center);
      const noteDisplay = toUserNotation(`${note.note}${note.octave}`, useFlats);
      svg += `
        <g class="note-group" data-note="${note.note}${note.octave}" data-freq="${note.freq}" data-x="${pos.x}" data-y="${pos.y}" data-r="${mutantNoteSize}">
          <circle cx="${pos.x}" cy="${pos.y}" r="${mutantNoteSize}" class="note-circle note-mutant" stroke="#787878" stroke-width="1.5"/>
          <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" class="note-label" fill="#3A3A3A" font-size="20" font-weight="600" font-family="system-ui">${noteDisplay}</text>
        </g>
      `;
    });

    tonals.forEach((note, i) => {
      const pos = getTonalPosition(i, tonals.length, tonalRadius, center);
      const noteDisplay = toUserNotation(`${note.note}${note.octave}`, useFlats);
      svg += `
        <g class="note-group" data-note="${note.note}${note.octave}" data-freq="${note.freq}" data-x="${pos.x}" data-y="${pos.y}" data-r="${noteSize}">
          <circle cx="${pos.x}" cy="${pos.y}" r="${noteSize}" class="note-circle note-tonal" stroke="#686868" stroke-width="1.5"/>
          <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" class="note-label" fill="#3A3A3A" font-size="22" font-weight="600" font-family="system-ui">${noteDisplay}</text>
        </g>
      `;
    });

    bottoms.forEach((note, i) => {
      const pos = getBottomPosition(i, bottoms.length, bottomRadius, center);
      const noteDisplay = toUserNotation(`${note.note}${note.octave}`, useFlats);
      svg += `
        <g class="note-group" data-note="${note.note}${note.octave}" data-freq="${note.freq}" data-x="${pos.x}" data-y="${pos.y}" data-r="${bottomNoteSize}">
          <circle cx="${pos.x}" cy="${pos.y}" r="${bottomNoteSize}" class="note-circle note-bottom" stroke="#505050" stroke-width="1.5" stroke-dasharray="3 2"/>
          <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" class="note-label" fill="#E8E8E8" font-size="20" font-weight="600" font-family="system-ui">${noteDisplay}</text>
        </g>
      `;
    });

    svg += '</svg>';

    document.getElementById('player-visual').innerHTML = svg;

    let legendHTML = '<span class="legend-item"><span class="legend-dot legend-dot--tonal"></span> Tonales</span>';
    if (mutants.length > 0) {
      legendHTML += '<span class="legend-item"><span class="legend-dot legend-dot--mutant"></span> Mutants</span>';
    }
    if (bottoms.length > 0) {
      legendHTML += '<span class="legend-item"><span class="legend-dot legend-dot--bottom"></span> Bottoms</span>';
    }
    document.getElementById('player-legend').innerHTML = legendHTML;

    // Precharger les notes de la gamme
    preloadCurrentScale();

    document.querySelectorAll('.note-group').forEach(g => {
      g.addEventListener('click', () => {
        const noteName = g.dataset.note;
        if (noteName) playNote(noteName);
        g.classList.add('active');
        setTimeout(() => g.classList.remove('active'), 300);
        createWaveAnimation(g);
      });
    });
  }

  function getTonalPosition(index, total, radius, center) {
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
    const x = center + Math.cos(angleRad) * radius;
    const y = center - Math.sin(angleRad) * radius;

    return { x, y };
  }

  function getMutantPosition(index, total, radius, center) {
    if (total === 1) {
      return { x: center, y: center - radius };
    }

    const arcSpread = Math.min(120, 40 + (total - 1) * 30);
    const startAngle = 90 + arcSpread / 2;
    const step = arcSpread / (total - 1);
    const angleDeg = startAngle - (index * step);

    const angleRad = angleDeg * Math.PI / 180;
    const x = center + Math.cos(angleRad) * radius;
    const y = center - Math.sin(angleRad) * radius;

    return { x, y };
  }

  function getBottomPosition(index, total, radius, center) {
    if (total === 1) {
      return { x: center, y: center + radius };
    }

    const arcSpread = Math.min(140, 40 + (total - 1) * 25);
    const startAngle = 270 - arcSpread / 2;
    const step = arcSpread / (total - 1);
    const angleDeg = startAngle + (index * step);

    const angleRad = angleDeg * Math.PI / 180;
    const x = center + Math.cos(angleRad) * radius;
    const y = center - Math.sin(angleRad) * radius;

    return { x, y };
  }

  // ===== WAVE ANIMATION =====
  function createWaveAnimation(noteGroup) {
    const svg = document.querySelector('#player-visual svg');
    if (!svg) return;
    const waveContainer = svg.querySelector('.wave-container');
    if (!waveContainer) return;

    const x = parseFloat(noteGroup.dataset.x);
    const y = parseFloat(noteGroup.dataset.y);
    const r = parseFloat(noteGroup.dataset.r) || 50;

    const wave = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    wave.setAttribute('cx', x);
    wave.setAttribute('cy', y);
    wave.setAttribute('r', r);
    wave.setAttribute('class', 'wave-ring');
    wave.style.transformOrigin = `${x}px ${y}px`;
    wave.style.animation = 'wave-expand 0.6s ease-out forwards';

    waveContainer.appendChild(wave);
    setTimeout(() => wave.remove(), 600);
  }

  // ===== UPDATE DISPLAY =====
  function updateDisplay() {
    const scaleData = getScaleDataUnified(state.scale);
    if (!scaleData) return;
    // Music theory rules: Eb/Ab/Bb/Db roots use flats, F# depends on scale, natural roots use scale preference
    const useFlats = shouldUseFlats(state.tonality, scaleData);
    const notes = getCurrentNotes();

    const rootMatch = state.tonality.match(/^([A-G]#?)(\d)$/);
    const rootNote = rootMatch ? rootMatch[1] : state.tonality;
    // Root display: convert to flat notation if needed (A# -> Bb, G# -> Ab, etc.)
    let rootDisplay = useFlats ? (SHARPS_TO_FLATS[rootNote] || rootNote) : rootNote;
    if (MistralScales.getNotationMode() === 'french') rootDisplay = MistralScales.toFrenchNotation(rootDisplay);
    document.getElementById('display-name').textContent = `${rootDisplay} ${scaleData.name}`;
    document.getElementById('display-notes').textContent = notes.map(n => toUserNotation(`${n.note}${n.octave}`, useFlats)).join(' \u2022 ');
    document.getElementById('display-mood').textContent = `${state.notes} notes`;

    // Tonality label: stays as stored (sharps internally), displayed per context
    document.getElementById('label-tonality').textContent = toUserNotation(state.tonality, useFlats);

    document.getElementById('notes-value').textContent = state.notes;
    document.getElementById('notes-minus').disabled = state.notes <= 9;
    document.getElementById('notes-plus').disabled = state.notes >= 17;

    // Nom de la configuration
    const configName = `${rootDisplay} ${scaleData.name} ${state.notes} notes`;

    // Verifier la faisabilite AVANT de calculer le prix
    let feasibilityStatus = 'ok';
    if (typeof FeasibilityModule !== 'undefined') {
      const result = FeasibilityModule.checkFeasibility(notes, state.size);
      feasibilityStatus = result.status;
    }

    // Store instrument price for later use
    state._instrumentPrice = calculatePrice(notes, state.size, feasibilityStatus, state.material);
    state._feasibilityStatus = feasibilityStatus;
    state._configName = configName;
    state._rootDisplay = rootDisplay;
    state._scaleData = scaleData;

    // Render accessoires section (depends on size)
    renderAccessoiresSection();

    // Update price display (includes housse if selected)
    updatePriceDisplay();

    // Mettre a jour l'UI de faisabilite (chips, hint, bouton)
    if (typeof FeasibilityModule !== 'undefined') {
      const scalesProxy = {};
      scalesProxy[state.scale] = getScaleDataUnified(state.scale);
      FeasibilityModule.update(state, notes, scalesProxy, parsePattern, {
        configName: configName
      });
    }

    renderPlayer();
  }

  // ===== CTA BUTTONS STATE =====
  function isHousseRequired() {
    const accessoires = getAccessoiresForConfigurateur(state.size);
    return accessoires.some(function(a) { return a.categorie === 'housse'; });
  }

  function scrollToHousseSection() {
    const section = document.getElementById('accessoires-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      section.style.outline = '2px solid var(--color-error, #DC2626)';
      section.style.outlineOffset = '4px';
      section.style.borderRadius = '8px';
      setTimeout(function() { section.style.outline = ''; section.style.outlineOffset = ''; }, 2000);
    }
  }

  // ===== FEASIBILITY HELPERS =====
  function showFeasibilityNotice() {
    if (window.MistralAdmin && MistralAdmin.Toast) {
      MistralAdmin.Toast.warning('Configuration non réalisable. Essayez une autre taille ou tonalité.');
    }
  }

  function openFeasibilityContact(message) {
    const messageField = document.getElementById('contact-message');
    if (messageField && message) messageField.value = message;
    if (typeof openContactModal === 'function') {
      openContactModal();
    }
  }

  // ===== UPDATE PRICE DISPLAY =====
  function updatePriceDisplay() {
    const instrumentPrice = state._instrumentPrice || 0;
    const houssePrice = state.housse ? (state.housse.prix || 0) : 0;
    const totalPrice = instrumentPrice + houssePrice;
    const bd = state._priceBreakdown || {};
    const fmt = function(n) { return Math.round(n).toLocaleString('fr-FR') + ' \u20AC'; };

    // --- Ligne base : "9 notes × 115 €" ---
    const baseLabel = document.getElementById('price-base-label');
    const baseVal = document.getElementById('price-base');
    if (baseLabel) baseLabel.textContent = bd.noteCount + ' notes \u00D7 ' + (bd.prixParNote || 115) + ' \u20AC';
    if (baseVal) baseVal.textContent = fmt(bd.basePrice || 0);

    // --- Ligne octave 2 (masquee si 0) ---
    const oct2Line = document.getElementById('price-octave2-line');
    const oct2Label = document.getElementById('price-octave2-label');
    const oct2Val = document.getElementById('price-octave2');
    if (oct2Line) {
      if (bd.octave2Bonus > 0) {
        oct2Line.style.display = '';
        if (oct2Label) oct2Label.textContent = bd.octave2Count + ' note' + (bd.octave2Count > 1 ? 's' : '') + ' octave 2';
        if (oct2Val) oct2Val.textContent = '+' + fmt(bd.octave2Bonus);
      } else {
        oct2Line.style.display = 'none';
      }
    }

    // --- Ligne bottoms (masquee si 0) ---
    const bottomsLine = document.getElementById('price-bottoms-line');
    const bottomsVal = document.getElementById('price-bottoms');
    if (bottomsLine) {
      if (bd.bottomsBonus > 0) {
        bottomsLine.style.display = '';
        if (bottomsVal) bottomsVal.textContent = '+' + fmt(bd.bottomsBonus);
      } else {
        bottomsLine.style.display = 'none';
      }
    }

    // --- Ligne taille (masquee si 0) ---
    const sizeLine = document.getElementById('price-size-line');
    const sizeLabel = document.getElementById('price-size-label');
    const sizeVal = document.getElementById('price-size');
    if (sizeLine) {
      if (bd.sizeMalus > 0) {
        sizeLine.style.display = '';
        if (sizeLabel) sizeLabel.textContent = 'Taille ' + bd.sizeLabel;
        if (sizeVal) sizeVal.textContent = '+' + fmt(bd.sizeMalus);
      } else {
        sizeLine.style.display = 'none';
      }
    }

    // --- Ligne difficulte (masquee si 0) ---
    const diffLine = document.getElementById('price-difficulty-line');
    const diffLabel = document.getElementById('price-difficulty-label');
    const diffVal = document.getElementById('price-difficulty');
    if (diffLine) {
      if (bd.difficultyAmount > 0) {
        diffLine.style.display = '';
        if (diffLabel) diffLabel.textContent = 'Difficult\u00E9 (+' + bd.difficultyPercent + ' %)';
        if (diffVal) diffVal.textContent = '+' + fmt(bd.difficultyAmount);
      } else {
        diffLine.style.display = 'none';
      }
    }

    // --- Ligne housse (masquee si pas de housse) ---
    const housseLine = document.getElementById('price-housse-line');
    const housseVal = document.getElementById('price-housse');
    if (housseLine) {
      if (state.housse) {
        housseLine.style.display = '';
        if (housseVal) housseVal.textContent = '+' + fmt(houssePrice);
      } else {
        housseLine.style.display = 'none';
      }
    }

    // Update total price
    document.getElementById('total-price').textContent = totalPrice.toLocaleString('fr-FR') + ' \u20AC';

    // Update order URL
    const orderParams = new URLSearchParams({
      scale: state.scale,
      tonality: state.tonality,
      notes: state.notes,
      tuning: state.tuning,
      size: state.size,
      material: state.material,
      price: totalPrice,
      instrument_price: instrumentPrice,
      name: `${state._rootDisplay || ''} ${state._scaleData?.name || ''}`
    });

    // Add housse info if selected
    if (state.housse) {
      orderParams.set('housse_id', state.housse.id);
      orderParams.set('housse_nom', state.housse.nom);
      orderParams.set('housse_prix', state.housse.prix);
    }

    // Store order params for legacy fallback
    state._orderParams = orderParams;

  }

  // ===== RENDER MATERIAL CHIPS =====
  function renderMaterialCards() {
    const container = document.getElementById('chips-material');
    if (!container) return;

    // Recuperer les materiaux depuis le module
    const materiaux = typeof MistralMateriaux !== 'undefined'
      ? MistralMateriaux.getForConfigurateur()
      : [
          { code: 'NS', nom: 'Acier Nitrure', nom_court: 'Nitrure' },
          { code: 'ES', nom: 'Ember Steel', nom_court: 'Ember Steel' },
          { code: 'SS', nom: 'Acier Inoxydable', nom_court: 'Inox' }
        ];

    let html = '';
    materiaux.forEach(mat => {
      const isActive = mat.code === state.material ? ' active' : '';
      html += `<button class="chip${isActive}" data-value="${mat.code}">${mat.nom_court || mat.nom}</button>`;
    });

    container.innerHTML = html;

    // Bind events
    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.material = chip.dataset.value;
        updateDisplay();
      });
    });
  }

  // ===== RENDER SCALE CHIPS =====
  function renderScaleChips() {
    const container = document.getElementById('chips-scale');
    if (!container) return;

    const navigator = document.getElementById('lot-navigator');
    const labelEl = document.getElementById('lot-label');

    // Check for published lots
    const lots = typeof MistralGammes !== 'undefined' && MistralGammes.getPublishedLots
      ? MistralGammes.getPublishedLots()
      : null;

    let gammes;

    if (lots && lots.length > 0) {
      // Multi-lot mode: show navigator, filter gammes by current lot
      if (navigator) navigator.style.display = 'flex';

      // Clamp index
      if (currentLotIndex >= lots.length) currentLotIndex = 0;
      if (currentLotIndex < 0) currentLotIndex = lots.length - 1;

      const currentLot = lots[currentLotIndex];
      if (labelEl) labelEl.textContent = currentLot.nom;

      // Get gamme objects for this lot's codes
      gammes = (currentLot.gammes || []).map(code => {
        if (typeof MistralGammes !== 'undefined') {
          return MistralGammes.getByCode(code);
        }
        return null;
      }).filter(Boolean);

      // Update prev/next button states (wrap-around, always enabled if > 1 lot)
      const prevBtn = document.getElementById('lot-prev');
      const nextBtn = document.getElementById('lot-next');
      if (prevBtn) prevBtn.disabled = lots.length <= 1;
      if (nextBtn) nextBtn.disabled = lots.length <= 1;

      // Bind lot nav buttons (once)
      if (!lotNavBound) {
        lotNavBound = true;
        if (prevBtn) {
          prevBtn.addEventListener('click', function() {
            const l = typeof MistralGammes !== 'undefined' && MistralGammes.getPublishedLots
              ? MistralGammes.getPublishedLots() : null;
            if (!l || l.length <= 1) return;
            currentLotIndex = (currentLotIndex - 1 + l.length) % l.length;
            renderScaleChips();
            updateDisplay();
          });
        }
        if (nextBtn) {
          nextBtn.addEventListener('click', function() {
            const l = typeof MistralGammes !== 'undefined' && MistralGammes.getPublishedLots
              ? MistralGammes.getPublishedLots() : null;
            if (!l || l.length <= 1) return;
            currentLotIndex = (currentLotIndex + 1) % l.length;
            renderScaleChips();
            updateDisplay();
          });
        }
      }
    } else {
      // Flat mode: hide navigator, use all configurateur gammes
      if (navigator) navigator.style.display = 'none';

      gammes = typeof MistralGammes !== 'undefined'
        ? MistralGammes.getForConfigurateur()
        : [
            { code: 'kurd', nom: 'Kurd' },
            { code: 'amara', nom: 'Amara' },
            { code: 'lowpygmy', nom: 'Low Pygmy' },
            { code: 'hijaz', nom: 'Hijaz' },
            { code: 'myxolydian', nom: 'Myxolydian' },
            { code: 'equinox', nom: 'Equinox' }
          ];
    }

    // Only show gammes that have patterns in scales-data.js
    const availableGammes = gammes.filter(g => {
      if (typeof MistralGammes !== 'undefined' && MistralGammes.hasConfiguratorPatterns) {
        return MistralGammes.hasConfiguratorPatterns(g.code);
      }
      return SCALES_DATA[g.code] && SCALES_DATA[g.code].patterns !== null;
    });

    let html = '';
    availableGammes.forEach(g => {
      const isActive = g.code === state.scale ? ' active' : '';
      html += `<button class="chip${isActive}" data-value="${g.code}">${g.nom}</button>`;
    });

    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.scale = chip.dataset.value;

        const scaleData = getScaleDataUnified(state.scale);
        if (!scaleData) return;
        state.tonality = scaleData.baseRoot + scaleData.baseOctave;
        document.querySelectorAll('#chips-tonality .chip').forEach(c => {
          c.classList.toggle('active', c.dataset.value === state.tonality);
        });

        updateTonalityChipsLabels();
        updateDisplay();
      });
    });

    // If current scale is not in the list, select the first available
    if (availableGammes.length > 0 && !availableGammes.find(g => g.code === state.scale)) {
      state.scale = availableGammes[0].code;
      const firstChip = container.querySelector('.chip');
      if (firstChip) firstChip.classList.add('active');
    }
  }

  // gammesUpdated listener is registered in DOMContentLoaded block below (single registration)

  // ===== RENDER SIZE CARDS =====
  function renderSizeCards() {
    const container = document.getElementById('cards-size');
    if (!container) return;

    // Get tailles from centralized module, with fallback
    const tailles = typeof MistralTailles !== 'undefined'
      ? MistralTailles.getForConfigurateur()
      : [
          { code: '45', label: '45 cm', description: 'Compact', prix_malus: 5 },
          { code: '50', label: '50 cm', description: 'Medium', prix_malus: 2.5 },
          { code: '53', label: '53 cm', description: 'Standard', prix_malus: 0 }
        ];

    let html = '';
    tailles.forEach(t => {
      const isActive = t.code === state.size ? ' active' : '';
      const priceHtml = t.prix_malus > 0
        ? `<div class="radio-card__price">+${Math.round(t.prix_malus)} €</div>`
        : '';
      const desc = t.description ? t.description.split('\u2014')[0].trim() : t.code + ' cm';
      html += `<div class="radio-card${isActive}" data-value="${t.code}">
                <div class="radio-card__value">${t.label || t.code + ' cm'}</div>
                <div class="radio-card__label">${desc}</div>
                ${priceHtml}
              </div>`;
    });

    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.radio-card').forEach(card => {
      card.addEventListener('click', () => {
        container.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.size = card.dataset.value;
        updateDisplay();
      });
    });

    // If current size is not in the list, select the default (53) or first
    if (tailles.length > 0 && !tailles.find(t => t.code === state.size)) {
      const defaultTaille = tailles.find(t => t.code === '53') || tailles[tailles.length - 1];
      state.size = defaultTaille.code;
    }
  }

  // ===== RENDER ACCESSOIRES (HOUSSE) =====
  function getAccessoiresForConfigurateur(size) {
    // Get accessoires from MistralSync in-memory store
    const accessoires = (window.MistralSync && MistralSync.hasKey('mistral_accessoires'))
      ? MistralSync.getData('mistral_accessoires')
      : [];
    return accessoires.filter(a =>
      a.statut === 'en_ligne' &&
      a.visible_configurateur === true &&
      a.tailles_compatibles &&
      a.tailles_compatibles.includes(size) &&
      a.stock !== 0 // stock: -1 = infini, >0 = dispo, 0 = rupture
    );
  }

  function renderAccessoiresSection() {
    const section = document.getElementById('accessoires-section');
    const container = document.getElementById('accessoires-list');
    if (!section || !container) return;

    const accessoires = getAccessoiresForConfigurateur(state.size);
    const housses = accessoires.filter(a => a.categorie === 'housse');
    const housseRequired = housses.length > 0;

    // Hide section if no accessoires available
    if (accessoires.length === 0) {
      section.style.display = 'none';
      if (state.housse) {
        state.housse = null;
      }
        return;
    }

    section.style.display = 'block';

    // Update label based on mandatory status
    const label = section.querySelector('.option-label');
    if (label) {
      label.innerHTML = housseRequired
        ? 'Choisir une housse <span style="color:var(--color-error,#DC2626);">*</span>'
        : 'Ajouter une housse';
    }

    // Check if current housse is still available for this size
    if (state.housse && !accessoires.find(a => a.id === state.housse.id)) {
      state.housse = null;
    }

    let html = '';

    accessoires.forEach(acc => {
      const isActive = state.housse && state.housse.id === acc.id ? ' active' : '';
      const hasImage = acc.image;
      const imageHtml = hasImage
        ? `<div class="accessoire-card__image"><img src="${acc.image}" alt="${escapeHtmlAttr(acc.nom)}"></div>`
        : '';

      html += `
        <div class="accessoire-card${isActive}" data-id="${acc.id}">
          ${imageHtml}
          <div class="accessoire-card__content">
            <div class="accessoire-card__name">${escapeHtmlAttr(acc.nom)}</div>
            <div class="accessoire-card__price">+${Number(acc.prix).toLocaleString('fr-FR')} \u20AC</div>
          </div>
        </div>
      `;
    });

    // Add validation hint when housse required but not selected
    if (housseRequired && !state.housse) {
      html += '<p class="accessoire-hint" style="color:var(--color-error,#DC2626);font-size:0.85rem;margin:0.5rem 0 0;">Veuillez sélectionner une housse pour continuer</p>';
    }

    container.innerHTML = html;

    // Bind events — housse mandatory: can switch but not deselect
    container.querySelectorAll('.accessoire-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        if (card.classList.contains('active')) {
          // If housse is mandatory, don't allow deselection
          if (housseRequired) return;
          card.classList.remove('active');
          state.housse = null;
        } else {
          container.querySelectorAll('.accessoire-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          state.housse = accessoires.find(a => a.id === id) || null;
          // Remove validation hint once selected
          const hint = container.querySelector('.accessoire-hint');
          if (hint) hint.remove();
        }
        updatePriceDisplay();
      });
    });

  }

  function escapeHtmlAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ===== BIND EVENTS =====
  function bindEvents() {
    const toggleBtn = document.getElementById('toggle-advanced');
    const advancedContent = document.getElementById('advanced-content');
    toggleBtn.addEventListener('click', () => {
      toggleBtn.classList.toggle('open');
      advancedContent.classList.toggle('open');
    });

    document.getElementById('notes-minus').addEventListener('click', () => {
      if (state.notes > 9) { state.notes--; updateDisplay(); }
    });
    document.getElementById('notes-plus').addEventListener('click', () => {
      if (state.notes < 17) { state.notes++; updateDisplay(); }
    });

    // Scale chip events are bound in renderScaleChips()

    document.querySelectorAll('#chips-tonality .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        // Ne pas changer si le chip est desactive
        if (chip.disabled || chip.classList.contains('chip--disabled')) return;

        document.querySelectorAll('#chips-tonality .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.tonality = chip.dataset.value;

        // Update chip labels based on new tonality (sharp root = sharps, natural = scale pref)
        updateTonalityChipsLabels();

        updateDisplay();
      });
    });

    document.querySelectorAll('#cards-tuning .radio-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('#cards-tuning .radio-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.tuning = card.dataset.value;
        updateDisplay();
      });
    });

    // Size card events are bound in renderSizeCards()

    document.getElementById('btn-play').addEventListener('click', playScale);
  }

  async function playScale() {
    const btn = document.getElementById('btn-play');
    const notes = getCurrentNotes();
    const sortedNotes = [...notes].sort((a, b) => a.freq - b.freq);

    btn.classList.add('playing');
    btn.querySelector('span').textContent = '...';

    for (let i = 0; i < sortedNotes.length; i++) {
      await delay(280);
      const noteName = `${sortedNotes[i].note}${sortedNotes[i].octave}`;
      playNote(noteName);

      const noteGroups = document.querySelectorAll('.note-group');
      noteGroups.forEach(g => {
        if (g.dataset.note === noteName) {
          g.classList.add('active');
          setTimeout(() => g.classList.remove('active'), 280);
        }
      });
    }

    btn.classList.remove('playing');
    btn.querySelector('span').textContent = '\u00C9couter';
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ===== NAVIGATION SYSTEM =====
  // Mobile: CSS scroll-snap horizontal (x mandatory) — handled by CSS.
  // Desktop/Tablet: native vertical scroll + sticky teal nav band as clickable shortcut.
  // No scroll hijacking — the browser handles everything.

  (function() {
    const wrapper = document.getElementById('boutique-wrapper');
    const tabs = document.querySelectorAll('.boutique-tab');
    const dots = document.querySelectorAll('.boutique-dot');
    const panelConfig = document.getElementById('panel-config');
    const panelStock = document.getElementById('panel-stock');

    // Nav band elements
    const navBand = document.getElementById('nav-band');
    const navBandBtn = document.getElementById('nav-band-btn');
    const navBandText = document.getElementById('nav-band-text');
    const navBandBadge = document.getElementById('nav-band-badge');
    const navBandCount = document.getElementById('nav-band-count');
    const arrowDown = document.getElementById('nav-arrow-down');
    const arrowUp = document.getElementById('nav-arrow-up');

    let currentSection = 'config'; // 'config' or 'stock'

    if (!wrapper) return;

    // ----- State updates -----

    function updateActiveState(panel) {
      tabs.forEach(tab => {
        const isActive = tab.dataset.panel === panel;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
      });
      dots.forEach(dot => {
        dot.classList.toggle('active', dot.dataset.panel === panel);
      });
    }

    function updateNavBand(section) {
      if (!navBand || window.innerWidth <= 768) return;

      currentSection = section;

      if (section === 'config') {
        navBandText.textContent = 'Instruments en stock';
        arrowDown.style.display = 'block';
        arrowUp.style.display = 'none';
        if (navBandBadge) navBandBadge.style.display = 'inline-flex';
        navBand.classList.remove('is-stock');
      } else {
        navBandText.textContent = 'Créer sur mesure';
        arrowDown.style.display = 'none';
        arrowUp.style.display = 'block';
        if (navBandBadge) navBandBadge.style.display = 'none';
        navBand.classList.add('is-stock');
      }
    }

    // ----- Scroll to panel -----

    function scrollToPanel(panel) {
      if (window.innerWidth <= 768) {
        // Mobile: horizontal scroll in wrapper (CSS snap)
        const target = panel === 'config' ? panelConfig : panelStock;
        if (target) {
          // Reset le scroll vertical du panel cible pour afficher le haut
          target.scrollTop = 0;
          wrapper.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
        }
      } else {
        // Desktop/Tablet: native vertical scroll
        if (panel === 'config') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (navBand) {
          const headerHeight = parseInt(
            getComputedStyle(document.documentElement)
              .getPropertyValue('--header-height') || '72'
          );
          const navBandDocTop = navBand.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: navBandDocTop - headerHeight + 5, behavior: 'smooth' });
        }
      }
    }

    // ----- Click handlers -----

    tabs.forEach(tab => {
      tab.addEventListener('click', () => scrollToPanel(tab.dataset.panel));
    });

    dots.forEach(dot => {
      dot.addEventListener('click', () => scrollToPanel(dot.dataset.panel));
    });

    if (navBandBtn) {
      navBandBtn.addEventListener('click', () => {
        scrollToPanel(currentSection === 'config' ? 'stock' : 'config');
      });
    }

    // ----- Scroll detection -----

    // Mobile: detect horizontal scroll position in wrapper
    let scrollTimeout;
    let lastActivePanel = 'config';
    wrapper.addEventListener('scroll', () => {
      if (window.innerWidth > 768) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const activePanel = wrapper.scrollLeft < wrapper.offsetWidth / 2 ? 'config' : 'stock';
        // Si on change de panel, reset le scroll vertical du nouveau panel
        if (activePanel !== lastActivePanel) {
          const target = activePanel === 'config' ? panelConfig : panelStock;
          if (target) target.scrollTop = 0;
          lastActivePanel = activePanel;
        }
        updateActiveState(activePanel);
      }, 50);
    });

    // Desktop/Tablet: detect nav band sticky state to update its label/arrows
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (window.innerWidth <= 768) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (navBand) {
            const headerHeight = parseInt(
              getComputedStyle(document.documentElement)
                .getPropertyValue('--header-height') || '64'
            );
            const isStuck = navBand.getBoundingClientRect().top <= headerHeight + 2;
            updateNavBand(isStuck ? 'stock' : 'config');
          }
          ticking = false;
        });
        ticking = true;
      }
    });

    // ----- Stock count -----

    function updateStockCount() {
      const stockCountTab = document.getElementById('stock-count-tab');
      let count = 0;

      if (typeof BoutiqueAdmin !== 'undefined') {
        const instruments = BoutiqueAdmin.getInstrumentsEnLigne();
        count = instruments.length;
      }

      if (stockCountTab) stockCountTab.textContent = count;
      if (navBandCount) navBandCount.textContent = count;
    }

    // Expose scrollToStock for compatibility
    window.scrollToStock = function() {
      scrollToPanel('stock');
    };

    // ----- Init -----

    setTimeout(updateStockCount, 100);
    window.addEventListener('storageUpdate', updateStockCount);
    window.addEventListener('stockUpdated', (e) => {
      const count = e.detail?.count || 0;
      if (document.getElementById('stock-count-tab')) {
        document.getElementById('stock-count-tab').textContent = count;
      }
      if (navBandCount) navBandCount.textContent = count;
    });
  })();

  // ===== COMMANDER DIRECTEMENT =====
  window.orderDirectly = function() {
    const btn = document.getElementById('btn-order');
    // Guard: feasibility blocked
    if (btn && btn.dataset.blocked === 'true') {
      showFeasibilityNotice();
      return;
    }
    if (btn && btn.dataset.blocked === 'contact') {
      openFeasibilityContact(btn.dataset.contactMessage);
      return;
    }
    // Guard: housse obligatoire si disponible
    if (isHousseRequired() && !state.housse) {
      scrollToHousseSection();
      return;
    }
    // Add current config to cart, then go to checkout
    if (typeof MistralCart !== 'undefined') {
      const config = {
        name: (state._rootDisplay || '') + ' ' + (state._scaleData?.name || state.scale || ''),
        price: state._instrumentPrice || 0,
        gamme: state.scale,
        tonalite: state.tonality,
        notes: state.notes,
        accordage: state.tuning,
        taille: state.size,
        materiau: state.material,
        housse: state.housse ? { id: state.housse.id, nom: state.housse.nom, prix: state.housse.prix } : null
      };
      MistralCart.addCustom(config);
      window.location.href = 'commander.html?from=cart';
    } else {
      // Fallback: legacy URL params
      window.location.href = 'commander.html?' + (state._orderParams || '').toString();
    }
  };

  // ===== PANIER - Ajout configuration sur mesure =====
  window.addConfigToCart = function() {
    if (typeof MistralCart === 'undefined') return;
    const cartBtn = document.getElementById('btn-add-cart');
    // Guard: feasibility blocked
    if (cartBtn && cartBtn.dataset.blocked === 'true') {
      showFeasibilityNotice();
      return;
    }
    if (cartBtn && cartBtn.dataset.blocked === 'contact') {
      openFeasibilityContact(cartBtn.dataset.contactMessage);
      return;
    }
    // Guard: housse obligatoire si disponible
    if (isHousseRequired() && !state.housse) {
      scrollToHousseSection();
      return;
    }

    const config = {
      name: (state._rootDisplay || '') + ' ' + (state._scaleData?.name || state.scale || ''),
      price: state._instrumentPrice || 0,
      gamme: state.scale,
      tonalite: state.tonality,
      notes: state.notes,
      accordage: state.tuning,
      taille: state.size,
      materiau: state.material,
      housse: state.housse ? { id: state.housse.id, nom: state.housse.nom, prix: state.housse.prix } : null
    };

    const id = MistralCart.addCustom(config);
    if (id) {
      const btn = document.getElementById('btn-add-cart');
      if (btn) {
        btn.textContent = 'Ajouté au panier !';
        btn.style.background = 'var(--color-success, #3D6B4A)';
        btn.style.color = 'white';
        btn.style.borderColor = 'var(--color-success, #3D6B4A)';
        setTimeout(function() {
          btn.textContent = 'Ajouter au panier';
          btn.style.background = '';
          btn.style.color = '';
          btn.style.borderColor = '';
        }, 2500);
      }
    }
  };

  // ===== NOTATION TOGGLE =====
  function initNotationToggle() {
    const toggle = document.getElementById('notation-toggle');
    if (!toggle) return;

    // Set initial state from preference
    const currentMode = MistralScales.getNotationMode();
    toggle.querySelectorAll('.notation-toggle__opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === currentMode);
    });

    // Bind click events
    toggle.querySelectorAll('.notation-toggle__opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === MistralScales.getNotationMode()) return;
        toggle.querySelectorAll('.notation-toggle__opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        MistralScales.setNotationMode(mode);
      });
    });

    // Listen for notation changes (also from other pages/tabs)
    window.addEventListener('notation-mode-change', () => {
      const mode = MistralScales.getNotationMode();
      toggle.querySelectorAll('.notation-toggle__opt').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      updateTonalityChipsLabels();
      updateDisplay();
    });
  }

  // ===== INIT =====
  document.addEventListener('DOMContentLoaded', () => {
    renderScaleChips();      // Render scale chips from MistralGammes
    renderSizeCards();       // Render size cards from MistralTailles
    renderMaterialCards();   // Render material chips from MistralMateriaux
    bindEvents();
    try { initNotationToggle(); } catch (e) { console.error('Notation toggle init error:', e); }
    updateTonalityChipsLabels();  // Set chip labels based on default scale (Kurd = flats)
    updateDisplay();

    // Bind cart/order buttons (CSP-safe, pas de onclick inline)
    const btnAddCart = document.getElementById('btn-add-cart');
    const btnOrder = document.getElementById('btn-order');
    if (btnAddCart) btnAddCart.addEventListener('click', () => window.addConfigToCart());
    if (btnOrder) btnOrder.addEventListener('click', () => window.orderDirectly());

    // Listen for data module updates from admin
    window.addEventListener('materiauxUpdated', () => {
      renderMaterialCards();
      updateDisplay();
    });
    window.addEventListener('gammesUpdated', () => {
      renderScaleChips();
      updateDisplay();
    });
    window.addEventListener('taillesUpdated', () => {
      renderSizeCards();
      updateDisplay();
    });

    // Re-render accessoires + recalculer prix quand Supabase data arrive
    // (getPricingConfig() retourne les vraies valeurs admin apres sync)
    window.addEventListener('mistral-sync-complete', () => {
      renderAccessoiresSection();
      updateDisplay();
      loadDelaiFabrication();
    });
    window.addEventListener('mistral-data-change', (e) => {
      if (e.detail?.key === 'mistral_accessoires') {
        renderAccessoiresSection();
        updatePriceDisplay();
      }
    });
  });

  /**
   * Charge le delai de fabrication depuis la config Supabase (namespace=configurateur)
   * et l'affiche dans l'element #config-delay-estimate du configurateur.
   */
  function loadDelaiFabrication() {
    var el = document.getElementById('config-delay-estimate');
    if (!el) return;

    var fallback = 'Délai de fabrication : 4 à 6 semaines';
    var data = typeof MistralSync !== 'undefined'
      ? MistralSync.getData('mistral_tarifs_publics')
      : null;

    if (data && data.delai_fabrication != null) {
      var semaines = parseInt(data.delai_fabrication, 10);
      if (semaines > 0) {
        el.textContent = 'Délai de fabrication : environ ' + semaines + ' semaines';
        return;
      }
    }
    el.textContent = fallback;
  }

})(window);
