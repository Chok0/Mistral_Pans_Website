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
  const shouldUseFlats = MistralScales.shouldUseFlats;
  const getTonalityChipNotation = MistralScales.getTonalityChipNotation;

  // Update tonality chips labels based on music theory rules
  // Each chip displays its correct notation according to the cycle of fifths:
  // - Eb, Ab, Bb always shown as flats (D#, G#, A# are theoretically impractical)
  // - Db shown as flat (easier than C# with 7 sharps)
  // - F#/Gb depends on scale preference
  function updateTonalityChipsLabels() {
    const scaleData = SCALES_DATA[state.scale];

    document.querySelectorAll('#chips-tonality .chip').forEach(chip => {
      const value = chip.dataset.value; // Always stored as sharps internally
      chip.textContent = getTonalityChipNotation(value, scaleData);
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
    if (typeof MistralGestion !== 'undefined') {
      const config = MistralGestion.getConfig();
      return {
        prixParNote: config.prixParNote ?? PRICING_DEFAULTS.prixParNote,
        bonusOctave2: config.bonusOctave2 ?? PRICING_DEFAULTS.bonusOctave2,
        bonusBottoms: config.bonusBottoms ?? PRICING_DEFAULTS.bonusBottoms,
        malusDifficulteWarning: config.malusDifficulteWarning ?? PRICING_DEFAULTS.malusDifficulteWarning,
        malusDifficulteDifficile: config.malusDifficulteDifficile ?? PRICING_DEFAULTS.malusDifficulteDifficile
      };
    }
    return { ...PRICING_DEFAULTS };
  }

  // Size malus - read dynamically from centralized module
  function getSizeMalus() {
    return typeof MistralTailles !== 'undefined'
      ? MistralTailles.getSizeMalusMap()
      : { '53': 0, '50': 0.025, '45': 0.05 };
  }

  function calculatePrice(notes, size, feasibilityStatus, materialCode) {
    const pricing = getPricingConfig();
    let price = 0;
    let hasBottom = false;

    notes.forEach(note => {
      price += pricing.prixParNote;
      if (note.octave === 2) {
        price += pricing.bonusOctave2;
      }
      if (note.type === 'bottom') {
        hasBottom = true;
      }
    });

    // Bonus bottom (une seule fois)
    if (hasBottom) {
      price += pricing.bonusBottoms;
    }

    // Malus taille (en %)
    const sizeMalus = getSizeMalus();
    const sizeMultiplier = 1 + (sizeMalus[size] || 0);
    price = price * sizeMultiplier;

    // Note: tous les materiaux sont au meme prix (pas de malus)

    // Pourcentage selon difficulte
    if (feasibilityStatus === 'warning') {
      price = price * (1 + pricing.malusDifficulteWarning / 100);
    } else if (feasibilityStatus === 'difficult') {
      price = price * (1 + pricing.malusDifficulteDifficile / 100);
    }

    // Arrondir a la tranche de 5 inferieure
    return Math.floor(price / 5) * 5;
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
    const scaleData = SCALES_DATA[state.scale];
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
    const scaleData = SCALES_DATA[state.scale];
    const pattern = scaleData.patterns[state.notes];
    if (!pattern) return [];

    const transpose = getTransposition();
    return parsePattern(pattern, scaleData.baseRoot, scaleData.baseOctave, transpose);
  }

  // ===== RENDER PLAYER =====
  function renderPlayer() {
    const notes = getCurrentNotes();
    const scaleData = SCALES_DATA[state.scale];
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
    `;

    if (ding) {
      const dingDisplay = toDisplayNotation(`${ding.note}${ding.octave}`, useFlats);
      svg += `
        <g class="note-group" data-note="${ding.note}${ding.octave}" data-freq="${ding.freq}">
          <circle cx="${center}" cy="${center}" r="${dingSize}" class="note-circle note-ding" stroke="#686868" stroke-width="1.5"/>
          <text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central" class="note-label" fill="#3A3A3A" font-size="24" font-weight="600" font-family="system-ui">${dingDisplay}</text>
        </g>
      `;
    }

    mutants.forEach((note, i) => {
      const pos = getMutantPosition(i, mutants.length, mutantRadius, center);
      const noteDisplay = toDisplayNotation(`${note.note}${note.octave}`, useFlats);
      svg += `
        <g class="note-group" data-note="${note.note}${note.octave}" data-freq="${note.freq}">
          <circle cx="${pos.x}" cy="${pos.y}" r="${mutantNoteSize}" class="note-circle note-mutant" stroke="#787878" stroke-width="1.5"/>
          <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" class="note-label" fill="#3A3A3A" font-size="20" font-weight="600" font-family="system-ui">${noteDisplay}</text>
        </g>
      `;
    });

    tonals.forEach((note, i) => {
      const pos = getTonalPosition(i, tonals.length, tonalRadius, center);
      const noteDisplay = toDisplayNotation(`${note.note}${note.octave}`, useFlats);
      svg += `
        <g class="note-group" data-note="${note.note}${note.octave}" data-freq="${note.freq}">
          <circle cx="${pos.x}" cy="${pos.y}" r="${noteSize}" class="note-circle note-tonal" stroke="#686868" stroke-width="1.5"/>
          <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" class="note-label" fill="#3A3A3A" font-size="22" font-weight="600" font-family="system-ui">${noteDisplay}</text>
        </g>
      `;
    });

    bottoms.forEach((note, i) => {
      const pos = getBottomPosition(i, bottoms.length, bottomRadius, center);
      const noteDisplay = toDisplayNotation(`${note.note}${note.octave}`, useFlats);
      svg += `
        <g class="note-group" data-note="${note.note}${note.octave}" data-freq="${note.freq}">
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

  // ===== UPDATE DISPLAY =====
  function updateDisplay() {
    const scaleData = SCALES_DATA[state.scale];
    // Music theory rules: Eb/Ab/Bb/Db roots use flats, F# depends on scale, natural roots use scale preference
    const useFlats = shouldUseFlats(state.tonality, scaleData);
    const notes = getCurrentNotes();

    const rootMatch = state.tonality.match(/^([A-G]#?)(\d)$/);
    const rootNote = rootMatch ? rootMatch[1] : state.tonality;
    // Root display: convert to flat notation if needed (A# -> Bb, G# -> Ab, etc.)
    const rootDisplay = useFlats ? (SHARPS_TO_FLATS[rootNote] || rootNote) : rootNote;
    document.getElementById('display-name').textContent = `${rootDisplay} ${scaleData.name}`;
    document.getElementById('display-notes').textContent = notes.map(n => toDisplayNotation(`${n.note}${n.octave}`, useFlats)).join(' \u2022 ');
    document.getElementById('display-mood').textContent = `${state.notes} notes`;

    // Tonality label: stays as stored (sharps internally), displayed per context
    document.getElementById('label-tonality').textContent = toDisplayNotation(state.tonality, useFlats);

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
      FeasibilityModule.update(state, notes, SCALES_DATA, parsePattern, {
        configName: configName
      });
    }

    renderPlayer();
  }

  // ===== UPDATE PRICE DISPLAY =====
  function updatePriceDisplay() {
    const instrumentPrice = state._instrumentPrice || 0;
    const houssePrice = state.housse ? (state.housse.prix || 0) : 0;
    const totalPrice = instrumentPrice + houssePrice;

    // Update price breakdown
    const priceBreakdown = document.getElementById('price-breakdown');
    const priceInstrument = document.getElementById('price-instrument');
    const priceHousseLine = document.getElementById('price-housse-line');
    const priceHousse = document.getElementById('price-housse');

    if (state.housse && priceBreakdown) {
      priceBreakdown.style.display = 'block';
      if (priceInstrument) priceInstrument.textContent = instrumentPrice.toLocaleString('fr-FR') + ' \u20AC';
      if (priceHousseLine) priceHousseLine.style.display = 'block';
      if (priceHousse) priceHousse.textContent = houssePrice.toLocaleString('fr-FR') + ' \u20AC';
    } else if (priceBreakdown) {
      priceBreakdown.style.display = 'none';
      if (priceHousseLine) priceHousseLine.style.display = 'none';
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

    const orderUrl = `commander.html?${orderParams.toString()}`;
    document.getElementById('btn-order').href = orderUrl;
    document.getElementById('btn-order').dataset.originalHref = orderUrl;
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

    // Get gammes from centralized module, with fallback
    const gammes = typeof MistralGammes !== 'undefined'
      ? MistralGammes.getForConfigurateur()
      : [
          { code: 'kurd', nom: 'Kurd' },
          { code: 'amara', nom: 'Amara' },
          { code: 'lowpygmy', nom: 'Low Pygmy' },
          { code: 'hijaz', nom: 'Hijaz' },
          { code: 'myxolydian', nom: 'Myxolydian' },
          { code: 'equinox', nom: 'Equinox' }
        ];

    // Only show gammes that have patterns in scales-data.js
    const availableGammes = gammes.filter(g => SCALES_DATA[g.code]);

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

        const scaleData = SCALES_DATA[state.scale];
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

  // ===== RENDER SIZE CARDS =====
  function renderSizeCards() {
    const container = document.getElementById('cards-size');
    if (!container) return;

    // Get tailles from centralized module, with fallback
    const tailles = typeof MistralTailles !== 'undefined'
      ? MistralTailles.getDisponibles()
      : [
          { code: '45', label: '45 cm', description: 'Compact', prix_malus: 5 },
          { code: '50', label: '50 cm', description: 'Medium', prix_malus: 2.5 },
          { code: '53', label: '53 cm', description: 'Standard', prix_malus: 0 }
        ];

    let html = '';
    tailles.forEach(t => {
      const isActive = t.code === state.size ? ' active' : '';
      const priceHtml = t.prix_malus > 0
        ? `<div class="radio-card__price">+${Math.round(t.prix_malus)}%</div>`
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
      a.statut === 'actif' &&
      a.visible_configurateur === true &&
      a.tailles_compatibles &&
      a.tailles_compatibles.includes(size)
    );
  }

  function renderAccessoiresSection() {
    const section = document.getElementById('accessoires-section');
    const container = document.getElementById('accessoires-list');
    if (!section || !container) return;

    const accessoires = getAccessoiresForConfigurateur(state.size);

    // Hide section if no accessoires available
    if (accessoires.length === 0) {
      section.style.display = 'none';
      // Reset housse selection if current housse is not available
      if (state.housse) {
        state.housse = null;
      }
      return;
    }

    section.style.display = 'block';

    // Check if current housse is still available for this size
    if (state.housse && !accessoires.find(a => a.id === state.housse.id)) {
      state.housse = null;
    }

    let html = `
      <div class="accessoire-card accessoire-card--none${!state.housse ? ' active' : ''}" data-id="">
        <div class="accessoire-card__content">
          <div class="accessoire-card__name">Sans housse</div>
          <div class="accessoire-card__price">\u2014</div>
        </div>
      </div>
    `;

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

    container.innerHTML = html;

    // Bind events
    container.querySelectorAll('.accessoire-card').forEach(card => {
      card.addEventListener('click', () => {
        container.querySelectorAll('.accessoire-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const id = card.dataset.id;
        if (id) {
          state.housse = accessoires.find(a => a.id === id) || null;
        } else {
          state.housse = null;
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

  // ===== SWIPE NAVIGATION SYSTEM =====
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

    // Update active state based on scroll position
    function updateActiveState(panel) {
      tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.panel === panel);
      });
      dots.forEach(dot => {
        dot.classList.toggle('active', dot.dataset.panel === panel);
      });
    }

    // Update nav band state
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
        navBandText.textContent = 'Cr\u00E9er sur mesure';
        arrowDown.style.display = 'none';
        arrowUp.style.display = 'block';
        if (navBandBadge) navBandBadge.style.display = 'none';
        navBand.classList.add('is-stock');
      }
    }

    // Scroll to panel
    function scrollToPanel(panel) {
      const target = panel === 'config' ? panelConfig : panelStock;
      if (target) {
        // Mobile: horizontal scroll
        if (window.innerWidth <= 768) {
          wrapper.scrollTo({
            left: target.offsetLeft,
            behavior: 'smooth'
          });
        } else {
          // Desktop: vertical scroll
          if (panel === 'config') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            // Scroll to stock section (after nav band)
            const stockSection = document.getElementById('flash-sales');
            if (stockSection) {
              stockSection.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }
      }
    }

    // Tab click handlers
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        scrollToPanel(tab.dataset.panel);
      });
    });

    // Dot click handlers
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        scrollToPanel(dot.dataset.panel);
      });
    });

    // Nav band click handler
    if (navBandBtn) {
      navBandBtn.addEventListener('click', () => {
        if (currentSection === 'config') {
          scrollToPanel('stock');
        } else {
          scrollToPanel('config');
        }
      });
    }

    // Detect scroll position on mobile (horizontal)
    let scrollTimeout;
    wrapper.addEventListener('scroll', () => {
      if (window.innerWidth > 768) return;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollLeft = wrapper.scrollLeft;
        const panelWidth = wrapper.offsetWidth;
        const activePanel = scrollLeft < panelWidth / 2 ? 'config' : 'stock';
        updateActiveState(activePanel);
      }, 50);
    });

    // Detect scroll position on desktop (vertical)
    function checkDesktopScroll() {
      if (window.innerWidth <= 768) return;

      if (!navBand) return;

      // Check if nav band is stuck (at top under header)
      const navBandRect = navBand.getBoundingClientRect();
      const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '64');

      // If the nav band is stuck at the top (its top equals header height), we're in stock mode
      const isStuck = navBandRect.top <= headerHeight + 2; // +2 for tolerance

      if (isStuck) {
        updateNavBand('stock');
      } else {
        updateNavBand('config');
      }
    }

    // Throttled scroll handler for desktop
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          checkDesktopScroll();
          ticking = false;
        });
        ticking = true;
      }
    });

    // Update stock count in tab and nav band
    function updateStockCount() {
      const stockCountTab = document.getElementById('stock-count-tab');
      let count = 0;

      // Use new system (BoutiqueAdmin) - instruments en_ligne + accessoires actifs
      if (typeof BoutiqueAdmin !== 'undefined') {
        const instruments = BoutiqueAdmin.getInstrumentsEnLigne();
        const accessoires = BoutiqueAdmin.getAccessoiresActifs();
        count = instruments.length + accessoires.length;
      }

      if (stockCountTab) {
        stockCountTab.textContent = count;
      }

      if (navBandCount) {
        navBandCount.textContent = count;
      }
    }

    // Expose scrollToStock for compatibility
    window.scrollToStock = function() {
      scrollToPanel('stock');
    };

    // Init
    setTimeout(() => {
      updateStockCount();
      checkDesktopScroll();
    }, 100);
    window.addEventListener('storageUpdate', updateStockCount);
    window.addEventListener('stockUpdated', (e) => {
      const count = e.detail?.count || 0;
      if (document.getElementById('stock-count-tab')) {
        document.getElementById('stock-count-tab').textContent = count;
      }
      if (navBandCount) {
        navBandCount.textContent = count;
      }
    });
    window.addEventListener('resize', checkDesktopScroll);
  })();

  // ===== INIT =====
  document.addEventListener('DOMContentLoaded', () => {
    renderScaleChips();      // Render scale chips from MistralGammes
    renderSizeCards();       // Render size cards from MistralTailles
    renderMaterialCards();   // Render material chips from MistralMateriaux
    bindEvents();
    updateTonalityChipsLabels();  // Set chip labels based on default scale (Kurd = flats)
    updateDisplay();

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
  });

})(window);
