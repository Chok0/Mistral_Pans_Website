/* ==========================================================================
   MISTRAL PANS — Générateur PDF : Carnet d'Entretien
   Module complémentaire à gestion-pdf.js
   Génère un PDF 4 pages pour chaque instrument vendu :
     Page 1 : Logo pleine page
     Page 2 : Infos gamme/accordage/matériau + diagramme handpan avec notes
     Page 3 : Conseils d'entretien
     Page 4 : Promos partenaires (Notepan, Master the Handpan)
   ========================================================================== */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 20;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const COLORS = {
    primary:  [13, 115, 119],
    dark:     [26, 29, 33],
    text:     [51, 51, 51],
    muted:    [128, 128, 128],
    light:    [200, 200, 200],
    white:    [255, 255, 255],
    // Diagramme handpan
    shellOuter:  [122, 122, 122],
    shellInner:  [184, 184, 184],
    dingFill:    [208, 208, 208],
    tonalFill:   [160, 160, 160],
    mutantFill:  [184, 184, 184],
    bottomFill:  [80, 80, 80],
    noteStroke:  [104, 104, 104],
    noteText:    [58, 58, 58],
    bottomText:  [232, 232, 232],
    bottomStroke:[80, 80, 80]
  };

  const FONT = 'helvetica';

  // ============================================================================
  // CONSTANTES MUSICALES
  // ============================================================================

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const FLATS_TO_SHARPS = {
    'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#',
    'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
  };

  const SHARPS_TO_FLATS = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'
  };

  // ============================================================================
  // UTILITAIRES NOTES
  // ============================================================================

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

  function shouldUseFlats(tonality) {
    if (!tonality) return false;
    return ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb'].some(r => tonality.startsWith(r));
  }

  function toDisplayNote(name, useFlats) {
    if (!useFlats) return name;
    const m = name.match(/^([A-G]#?)(\d*)$/);
    if (!m) return name;
    return (SHARPS_TO_FLATS[m[1]] || m[1]) + m[2];
  }

  // ============================================================================
  // PARSING DU LAYOUT (porté depuis HandpanPlayer.parseLayout)
  // ============================================================================

  function parseLayout(layout) {
    if (!layout || typeof layout !== 'string') return null;
    layout = layout.replace(/_$/, '').replace(/\s+/g, ' ').trim();
    const slashIdx = layout.indexOf('/');
    if (slashIdx === -1) return parseSimpleLayout(layout);
    return parseHandpanerLayout(layout, slashIdx);
  }

  function parseSimpleLayout(layout) {
    const tokens = layout.split(/[\s\-]+/).filter(Boolean);
    const notes = [];
    tokens.forEach((token, i) => {
      let type = 'tonal';
      let noteStr = token;
      if (token.startsWith('(') && token.endsWith(')')) {
        type = 'bottom'; noteStr = token.slice(1, -1);
      } else if (token.startsWith('[') && token.endsWith(']')) {
        type = 'mutant'; noteStr = token.slice(1, -1);
      }
      if (i === 0) type = 'ding';
      const parsed = parseNoteStr(noteStr);
      if (parsed) notes.push({ name: parsed.note + (parsed.octave || 3), type });
    });
    return notes.length > 0 ? notes : null;
  }

  function parseHandpanerLayout(layout, slashIdx) {
    const notes = [];
    const dingStr = layout.substring(0, slashIdx).trim();
    const dingParsed = parseNoteStr(dingStr);
    if (!dingParsed) return null;
    const rootNote = dingParsed.note;
    const rootOctave = dingParsed.octave || 3;
    notes.push({ name: rootNote + rootOctave, type: 'ding' });

    const notesPart = layout.substring(slashIdx + 1).trim();
    const tokens = tokenize(notesPart);

    let tonalOctave = rootOctave;
    let lastTonalIndex = NOTE_NAMES.indexOf(rootNote);
    let isFirstTonal = true;
    let bottomOctave = rootOctave;

    tokens.forEach(token => {
      let type = 'tonal';
      let noteStr = token;
      if (token.startsWith('(') && token.endsWith(')')) {
        type = 'bottom'; noteStr = token.slice(1, -1);
      } else if (token.startsWith('[') && token.endsWith(']')) {
        type = 'mutant'; noteStr = token.slice(1, -1);
      }
      const parsed = parseNoteStr(noteStr);
      if (!parsed) return;
      const noteIndex = NOTE_NAMES.indexOf(parsed.note);
      let noteOctave = parsed.octave;
      if (noteOctave === null) {
        if (type === 'tonal' || type === 'mutant') {
          if (isFirstTonal) isFirstTonal = false;
          else if (noteIndex <= lastTonalIndex) tonalOctave++;
          noteOctave = tonalOctave;
          lastTonalIndex = noteIndex;
        } else {
          noteOctave = bottomOctave;
        }
      } else {
        if (type === 'tonal' || type === 'mutant') {
          tonalOctave = noteOctave; lastTonalIndex = noteIndex; isFirstTonal = false;
        } else {
          bottomOctave = noteOctave;
        }
      }
      notes.push({ name: parsed.note + noteOctave, type });
    });
    return notes.length > 1 ? notes : null;
  }

  function tokenize(str) {
    const tokens = [];
    let cur = '';
    let inP = false, inB = false;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '(') { if (cur.trim()) tokens.push(cur.trim()); cur = '('; inP = true; }
      else if (c === ')') { cur += ')'; tokens.push(cur.trim()); cur = ''; inP = false; }
      else if (c === '[') { if (cur.trim()) tokens.push(cur.trim()); cur = '['; inB = true; }
      else if (c === ']') { cur += ']'; tokens.push(cur.trim()); cur = ''; inB = false; }
      else if ((c === '-' || c === ' ') && !inP && !inB) { if (cur.trim()) tokens.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    if (cur.trim()) tokens.push(cur.trim());
    return tokens;
  }

  // ============================================================================
  // POSITIONNEMENT DES NOTES (porté fidèlement depuis HandpanPlayer)
  // Convention : angles trigonométriques, Y PDF inversé (vers le bas)
  // ============================================================================

  function getTonalPosition(index, total, radius, cx, cy) {
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
      if (isEvenTotal) {
        const adjustedIndex = index - 1;
        const middleCount = total - 2;
        const isRight = (adjustedIndex % 2 === 1);
        const sideIndex = Math.floor(adjustedIndex / 2);
        const notesPerSide = Math.ceil(middleCount / 2);
        if (isRight) {
          const step = notesPerSide > 1 ? 90 / (notesPerSide - 1) : 0;
          angleDeg = 315 + sideIndex * step;
          if (angleDeg >= 360) angleDeg -= 360;
        } else {
          const step = notesPerSide > 1 ? 90 / (notesPerSide - 1) : 0;
          angleDeg = 225 - sideIndex * step;
        }
      } else {
        const isRight = (index % 2 === 0);
        const sideIndex = Math.floor(index / 2);
        const notesPerSide = Math.ceil((total - 1) / 2);
        const range = 120;
        const step = notesPerSide > 1 ? range / (notesPerSide - 1) : 0;
        if (isRight) {
          angleDeg = 290 + sideIndex * step;
          if (angleDeg >= 360) angleDeg -= 360;
        } else {
          angleDeg = 250 - sideIndex * step;
        }
      }
    }

    const rad = angleDeg * Math.PI / 180;
    return { x: cx + Math.cos(rad) * radius, y: cy - Math.sin(rad) * radius };
  }

  function getMutantPosition(index, total, radius, cx, cy) {
    if (total === 1) return { x: cx, y: cy - radius };
    const arcSpread = Math.min(120, 40 + (total - 1) * 30);
    const startAngle = 90 + arcSpread / 2;
    const step = arcSpread / (total - 1);
    const angleDeg = startAngle - index * step;
    const rad = angleDeg * Math.PI / 180;
    return { x: cx + Math.cos(rad) * radius, y: cy - Math.sin(rad) * radius };
  }

  function getBottomPosition(index, total, radius, cx, cy) {
    if (total === 1) return { x: cx, y: cy + radius };
    const arcSpread = Math.min(140, 40 + (total - 1) * 25);
    const startAngle = 270 - arcSpread / 2;
    const step = arcSpread / (total - 1);
    const angleDeg = startAngle + index * step;
    const rad = angleDeg * Math.PI / 180;
    return { x: cx + Math.cos(rad) * radius, y: cy - Math.sin(rad) * radius };
  }

  // ============================================================================
  // DESSIN DU DIAGRAMME HANDPAN
  // Même repère que HandpanPlayer : coque unique, bottoms positionnés
  // au-delà du shell radius (0.46 vs 0.42), viewBox étendu vers le bas
  // ============================================================================

  function drawHandpanDiagram(doc, notes, cx, cy, size, useFlats) {
    if (!notes || notes.length === 0) return cy;

    const ding    = notes.find(n => n.type === 'ding');
    const tonals  = notes.filter(n => n.type === 'tonal');
    const mutants = notes.filter(n => n.type === 'mutant');
    const bottoms = notes.filter(n => n.type === 'bottom');

    // Proportions fidèles au HandpanPlayer
    const shellR    = size * 0.42;
    const tonalR    = size * 0.31;
    const dingR     = size * 0.09;
    const noteR     = size * 0.065;
    const mutantOrR = size * 0.18;
    const mutantNR  = noteR * 0.85;
    const bottomOrR = size * 0.46;
    const bottomNR  = noteR * 0.85;

    // --- Coque principale (dégradé simulé) ---
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = shellR * (1 - t * 0.08);
      doc.setFillColor(
        Math.round(COLORS.shellOuter[0] + t * (COLORS.shellInner[0] - COLORS.shellOuter[0])),
        Math.round(COLORS.shellOuter[1] + t * (COLORS.shellInner[1] - COLORS.shellOuter[1])),
        Math.round(COLORS.shellOuter[2] + t * (COLORS.shellInner[2] - COLORS.shellOuter[2]))
      );
      doc.circle(cx, cy, r, 'F');
    }
    doc.setDrawColor(144, 144, 144);
    doc.setLineWidth(0.3);
    doc.circle(cx, cy, shellR - 1, 'S');

    // --- Helper : dessiner une note ---
    function drawNote(x, y, r, fill, stroke, label, textCol, fontSize, dashed) {
      doc.setFillColor(...fill);
      doc.setDrawColor(...stroke);
      doc.setLineWidth(0.3);
      doc.circle(x, y, r, 'FD');

      if (label) {
        const display = toDisplayNote(label, useFlats);
        const m = display.match(/^([A-Gb#]+)(\d+)$/);
        doc.setTextColor(...textCol);
        doc.setFont(FONT, 'bold');
        if (m) {
          // Note + octave en indice
          const base = m[1], sub = m[2];
          const baseFZ = fontSize;
          const subFZ = fontSize * 0.65;
          doc.setFontSize(baseFZ);
          const bw = doc.getTextWidth(base);
          doc.setFontSize(subFZ);
          const sw = doc.getTextWidth(sub);
          const sx = x - (bw + sw) / 2;
          doc.setFontSize(baseFZ);
          doc.text(base, sx, y + baseFZ * 0.12);
          doc.setFontSize(subFZ);
          doc.text(sub, sx + bw, y + baseFZ * 0.3);
        } else {
          doc.setFontSize(fontSize);
          doc.text(display, x, y + fontSize * 0.12, { align: 'center' });
        }
      }
    }

    // --- Ding ---
    if (ding) {
      doc.setFillColor(220, 220, 220);
      doc.circle(cx, cy, dingR * 1.3, 'F');
      drawNote(cx, cy, dingR, COLORS.dingFill, COLORS.noteStroke, ding.name, COLORS.noteText, 9, false);
    }

    // --- Mutants (arc supérieur, anneau intérieur) ---
    mutants.forEach((note, i) => {
      const pos = getMutantPosition(i, mutants.length, mutantOrR, cx, cy);
      drawNote(pos.x, pos.y, mutantNR, COLORS.mutantFill, [120, 120, 120], note.name, COLORS.noteText, 7.5, false);
    });

    // --- Tonales (anneau principal) ---
    tonals.forEach((note, i) => {
      const pos = getTonalPosition(i, tonals.length, tonalR, cx, cy);
      drawNote(pos.x, pos.y, noteR, COLORS.tonalFill, COLORS.noteStroke, note.name, COLORS.noteText, 8, false);
    });

    // --- Bottoms (même coque, orbit > shellR, au-delà du bord inférieur) ---
    let diagramBottom = cy + shellR;
    if (bottoms.length > 0) {
      bottoms.forEach((note, i) => {
        const pos = getBottomPosition(i, bottoms.length, bottomOrR, cx, cy);
        // Cercle avec trait pointillé (style HandpanPlayer)
        doc.setFillColor(...COLORS.bottomFill);
        doc.setDrawColor(...COLORS.bottomStroke);
        doc.setLineWidth(0.3);
        doc.circle(pos.x, pos.y, bottomNR, 'FD');
        // Label
        const display = toDisplayNote(note.name, useFlats);
        const m = display.match(/^([A-Gb#]+)(\d+)$/);
        doc.setTextColor(...COLORS.bottomText);
        doc.setFont(FONT, 'bold');
        if (m) {
          const baseFZ = 7.5, subFZ = 7.5 * 0.65;
          doc.setFontSize(baseFZ);
          const bw = doc.getTextWidth(m[1]);
          doc.setFontSize(subFZ);
          const sw = doc.getTextWidth(m[2]);
          const sx = pos.x - (bw + sw) / 2;
          doc.setFontSize(baseFZ);
          doc.text(m[1], sx, pos.y + baseFZ * 0.12);
          doc.setFontSize(subFZ);
          doc.text(m[2], sx + bw, pos.y + baseFZ * 0.3);
        } else {
          doc.setFontSize(7.5);
          doc.text(display, pos.x, pos.y + 2, { align: 'center' });
        }
        diagramBottom = Math.max(diagramBottom, pos.y + bottomNR);
      });
    }

    return diagramBottom;
  }

  // ============================================================================
  // TEXTES D'ENTRETIEN
  // ============================================================================

  const ENTRETIEN = [
    { title: 'Nettoyage régulier', text: 'Nettoyage après chaque usage avec un chiffon micro-fibre.' },
    { title: 'Nettoyage en profondeur', text: 'Nettoyage occasionnel (si nécessaire) à l\'aide d\'un chiffon imbibé d\'alcool à 90°.' },
    { title: 'Protection de la surface', text: 'Graissage à l\'huile de coco occasionnel à l\'aide d\'un microfibre, ou produits type Phoenix Oil (selon fréquence de jeu et état de surface de l\'instrument).' },
    { title: 'Stockage', text: 'Entreposer à l\'abri de l\'humidité. Housse ouverte ou à l\'air libre.' },
    { title: 'Précautions', text: 'Éviter les grosses variations de températures, les expositions longues en plein soleil, et les chocs.' },
    { title: 'Avant de jouer', text: 'Retirer ses bijoux avant de jouer pour préserver la surface de l\'instrument.' },
    { title: 'Accordage', text: 'La nature du matériau peut entraîner de légères variations de tonalité selon l\'environnement. En cas de changement majeur ou de sentiment de dissonance, un réaccordage est peut-être nécessaire. Merci de nous contacter.' }
  ];

  // ============================================================================
  // UTILITAIRES
  // ============================================================================

  const MAT_LABELS = {
    'ember': 'Acier Inox Ember', 'ES': 'Acier Inox Ember',
    'SS': 'Acier Inoxydable', 'NS': 'Acier Nitruré', 'DC04': 'Acier DC04'
  };

  function getMatLabel(code) {
    if (typeof MistralMateriaux !== 'undefined' && code) {
      return MistralMateriaux.getLabel(code, 'full');
    }
    return MAT_LABELS[code] || code || 'Acier';
  }

  function toRoman(n) {
    if (!n || n <= 0) return '';
    const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    let r = '';
    for (const [v, s] of map) { while (n >= v) { r += s; n -= v; } }
    return r;
  }

  function sanitizeFn(s) {
    return (s || 'instrument').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').substring(0, 60);
  }

  function getLogo() {
    // Lire le logo depuis MistralPDF (exposé par gestion-pdf.js)
    if (window.MistralPDF && window.MistralPDF.LOGO_BASE64) {
      return window.MistralPDF.LOGO_BASE64;
    }
    return null;
  }

  // ============================================================================
  // GÉNÉRATION DU CARNET (4 pages)
  // ============================================================================

  /**
   * @param {Object} instrument - Données instrument (gamme, tonalite, accordage, materiau, notes_layout, nombre_notes, nom)
   * @param {Object} [opts] - { download: true, filename: '' }
   * @returns {jsPDF}
   */
  function generateCarnetEntretien(instrument, opts) {
    opts = opts || {};
    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const config = window.MistralGestion ? window.MistralGestion.getConfig() : {};
    const matLabel = getMatLabel(instrument.materiau);
    const displayName = instrument.nom || ((instrument.tonalite || '') + ' ' + (instrument.gamme || '')).trim() || 'Handpan';
    const parsedNotes = parseLayout(instrument.notes_layout);
    const nbNotes = instrument.nombre_notes || (parsedNotes ? parsedNotes.length : 0);
    const accordage = instrument.accordage || '440';
    const accordageLabel = accordage === '432' ? 'LA 432Hz' : 'LA 440Hz';
    const useFlats = shouldUseFlats(instrument.tonalite);

    // ===================== PAGE 1 : Logo =====================
    const logo = getLogo();
    if (logo) {
      try {
        const logoSize = 120;
        doc.addImage(logo, 'PNG', (PAGE_W - logoSize) / 2, (PAGE_H - logoSize) / 2 - 20, logoSize, logoSize);
      } catch (e) {
        drawLogoFallback(doc);
      }
    } else {
      drawLogoFallback(doc);
    }

    // ===================== PAGE 2 : Infos + Diagramme =====================
    doc.addPage();
    let y = MARGIN;

    doc.setFontSize(14);
    doc.setFont(FONT, 'normal');
    doc.setTextColor(...COLORS.text);
    doc.text('Votre handpan est accordé en', MARGIN, y);
    y += 10;

    // Gamme en gros
    doc.setFontSize(22);
    doc.setFont(FONT, 'bold');
    doc.setTextColor(...COLORS.dark);
    const gammeTitle = ((instrument.tonalite || '') + ' ' + (instrument.gamme || '').toUpperCase() + ' ' + toRoman(nbNotes)).trim();
    doc.text(gammeTitle, MARGIN, y);
    y += 9;

    // Accordage
    doc.setFontSize(13);
    doc.setFont(FONT, 'normal');
    doc.setTextColor(...COLORS.text);
    const accPrefix = 'L\'accordage est réalisé en ';
    doc.text(accPrefix, MARGIN, y);
    doc.setFont(FONT, 'bold');
    doc.text(accordageLabel, MARGIN + doc.getTextWidth(accPrefix), y);
    y += 8;

    // Matériau
    doc.setFont(FONT, 'normal');
    const matPrefix = 'L\'instrument a été fabriqué en ';
    doc.text(matPrefix, MARGIN, y);
    doc.setFont(FONT, 'bold');
    doc.text(matLabel, MARGIN + doc.getTextWidth(matPrefix), y);
    y += 15;

    // Diagramme
    if (parsedNotes) {
      const diagramSize = 80;
      const diagramCx = PAGE_W / 2;
      const diagramCy = y + diagramSize * 0.42;
      const bottom = drawHandpanDiagram(doc, parsedNotes, diagramCx, diagramCy, diagramSize, useFlats);
      y = bottom + 10;
    }

    // ===================== PAGE 3 : Entretien =====================
    doc.addPage();
    y = MARGIN;

    doc.setFontSize(20);
    doc.setFont(FONT, 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Conseils d\'entretien', MARGIN, y);
    y += 4;

    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, MARGIN + 60, y);
    y += 12;

    ENTRETIEN.forEach((c, i) => {
      if (y > PAGE_H - 40) { doc.addPage(); y = MARGIN; }

      // Pastille numérotée
      const ix = MARGIN + 4;
      doc.setFillColor(...COLORS.primary);
      doc.circle(ix, y - 1, 3.5, 'F');
      doc.setFontSize(8);
      doc.setFont(FONT, 'bold');
      doc.setTextColor(...COLORS.white);
      doc.text(String(i + 1), ix, y, { align: 'center' });

      // Titre
      doc.setFontSize(11);
      doc.setFont(FONT, 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text(c.title, MARGIN + 12, y);
      y += 6;

      // Texte
      doc.setFontSize(9.5);
      doc.setFont(FONT, 'normal');
      doc.setTextColor(...COLORS.text);
      const lines = doc.splitTextToSize(c.text, CONTENT_W - 12);
      lines.forEach(line => { doc.text(line, MARGIN + 12, y); y += 4.5; });
      y += 6;
    });

    // Coordonnées en pied
    y = PAGE_H - 45;
    doc.setDrawColor(...COLORS.light);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(FONT, 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text(config.marque || 'Mistral Pans', MARGIN, y);
    y += 5;
    doc.setFontSize(8.5);
    doc.setFont(FONT, 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.text(config.adresse || '105 rue du bas val Mary, 95630 Mériel', MARGIN, y);
    y += 4;
    doc.text((config.telephone || '07 62 76 65 30') + '  —  ' + (config.email || 'contact@mistralpans.fr'), MARGIN, y);

    // ===================== PAGE 4 : Promos =====================
    doc.addPage();
    y = MARGIN + 20;

    drawPartnerBlock(doc, y, 'Notepan',
      'Logiciel de notation musicale pour handpan',
      'Profitez d\'une réduction de 20 € sur votre abonnement ou l\'achat de votre licence à vie pour le logiciel de notation musicale Notepan.',
      'MISTRALPANS', [0, 172, 193]);

    y += 90;

    drawPartnerBlock(doc, y, 'Master the Handpan',
      'Cours en ligne pour progresser au handpan',
      'Bénéficiez de 10% de réduction sur votre abonnement aux cours en ligne Master the Handpan grâce à votre achat Mistral Pans.',
      'MISTRALPANS', [44, 62, 80]);

    // ===================== Sortie =====================
    if (opts.download !== false) {
      doc.save(opts.filename || 'Carnet_entretien_' + sanitizeFn(displayName) + '.pdf');
    }
    return doc;
  }

  // ============================================================================
  // FONCTIONS DE DESSIN AUXILIAIRES
  // ============================================================================

  function drawLogoFallback(doc) {
    doc.setFontSize(48);
    doc.setFont(FONT, 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('MISTRAL', PAGE_W / 2, PAGE_H / 2 - 15, { align: 'center' });
    doc.text('PANS', PAGE_W / 2, PAGE_H / 2 + 15, { align: 'center' });
  }

  function drawPartnerBlock(doc, y, name, tagline, text, code, color) {
    const blockH = 75;
    doc.setDrawColor(...COLORS.light);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN + 5, y, CONTENT_W - 10, blockH, 3, 3, 'S');

    // Barre accent gauche
    doc.setFillColor(...color);
    doc.rect(MARGIN + 5, y, 3, blockH, 'F');

    let py = y + 15;
    doc.setFontSize(18);
    doc.setFont(FONT, 'bold');
    doc.setTextColor(...color);
    doc.text(name, PAGE_W / 2, py, { align: 'center' });

    py += 7;
    doc.setFontSize(9);
    doc.setFont(FONT, 'italic');
    doc.setTextColor(...COLORS.muted);
    doc.text(tagline, PAGE_W / 2, py, { align: 'center' });

    py += 10;
    doc.setFontSize(10);
    doc.setFont(FONT, 'normal');
    doc.setTextColor(...COLORS.text);
    doc.splitTextToSize(text, CONTENT_W - 40).forEach(line => {
      doc.text(line, PAGE_W / 2, py, { align: 'center' });
      py += 5;
    });

    py += 5;
    const codeW = doc.getTextWidth(code) * 1.8 + 16;
    doc.setFillColor(...color);
    doc.roundedRect((PAGE_W - codeW) / 2, py - 5, codeW, 10, 2, 2, 'F');
    doc.setFontSize(12);
    doc.setFont(FONT, 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text(code, PAGE_W / 2, py + 1.5, { align: 'center' });
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================

  // S'accroche à MistralPDF s'il existe, sinon crée le namespace
  const ns = window.MistralPDF = window.MistralPDF || {};
  ns.generateCarnetEntretien = generateCarnetEntretien;

})(window);
