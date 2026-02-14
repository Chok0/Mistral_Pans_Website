/**
 * Mistral Pans - Unified Scales Data
 *
 * Single source of truth for all scale definitions across the website.
 * Used by: boutique.html, handpan-player.js, main.js
 */

(function() {
  'use strict';

  // ============================================================================
  // NOTATION CONVERSION MAPS
  // ============================================================================

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const FLATS_TO_SHARPS = {
    'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#',
    'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
  };

  const SHARPS_TO_FLATS = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'
  };

  // French solfège notation mapping
  const AMERICAN_TO_FRENCH = {
    'C': 'Do', 'D': 'Ré', 'E': 'Mi', 'F': 'Fa',
    'G': 'Sol', 'A': 'La', 'B': 'Si'
  };

  // ============================================================================
  // MUSIC THEORY: CIRCLE OF FIFTHS & KEY SIGNATURES
  // ============================================================================
  // Each root note has a position on the circle of fifths:
  // - Positive = sharp keys, Negative = flat keys
  // - The position indicates how many sharps (+) or flats (-) in the major key
  //
  // For enharmonic pairs (C#/Db, F#/Gb, G#/Ab), we store BOTH positions:
  // - Sharp spelling position (e.g., G# = +8)
  // - Flat spelling position (e.g., Ab = -4)
  // Then we compare which produces fewer accidentals for the given mode.

  // Circle of fifths: sharp key positions (for calculating sharp spelling)
  const CIRCLE_SHARP = {
    'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5,
    'F#': 6, 'C#': 7, 'G#': 8, 'D#': 9, 'A#': 10,
    'F': -1
  };

  // Circle of fifths: flat key positions (for calculating flat spelling)
  const CIRCLE_FLAT = {
    'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5,
    'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6
  };

  // Mode offsets relative to Ionian (major scale)
  // These determine the key signature: root_position + mode_offset
  // Positive = sharps, Negative = flats
  const MODE_OFFSETS = {
    'lydian': 1,
    'ionian': 0,
    'mixolydian': -1,
    'dorian': -2,
    'aeolian': -3,
    'phrygian': -4,
    'phrygian_dominant': -4,  // Same key signature tendency as phrygian
    'locrian': -5
  };

  // Map sharp notes to their flat equivalents
  const SHARP_TO_FLAT_ROOT = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'
  };

  // Map flat notes to their sharp equivalents
  const FLAT_TO_SHARP_ROOT = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
  };

  // Roots that should ALWAYS use flat spelling
  // A# (position 10) and D# (position 9) are theoretical only - their major keys
  // would require double sharps, which don't exist in standard notation.
  // In practice, musicians always use Bb and Eb instead.
  const ALWAYS_FLAT_ROOTS = ['A#', 'D#'];

  // ============================================================================
  // SCALES DATA
  // ============================================================================

  const SCALES_DATA = {
    kurd: {
      name: 'Kurd',
      baseRoot: 'D',
      baseOctave: 3,
      mode: 'aeolian',  // Natural minor - determines sharp/flat based on root
      description: 'La gamme la plus populaire. Douce, meditative, accessible a tous.',
      mood: 'Melancolique, introspectif',
      baseNotes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
      patterns: {
        9: 'D/-A-Bb-C-D-E-F-G-A_',
        10: 'D/-A-Bb-C-D-E-F-G-A-C',
        11: 'D/-A-Bb-C-D-E-F-G-A-C-[D]',
        12: 'D/(F)-(G)-A-Bb-C-D-E-F-G-A-C',
        13: 'D/(F)-(G)-A-Bb-C-D-E-F-G-A-C-[D]',
        14: 'D/(E)-(F)-(G)-A-Bb-C-D-E-F-G-A-C-[D]',
        15: 'D/(C3)-(E)-(F)-(G)-A-Bb-C-D-E-F-G-A-C-[D]',
        16: 'D/(Bb2)-(C3)-(F)-(G)-A-Bb-C-D-E-F-G-A-C-[D]-(E)',
        17: 'D/(C3)-(E3)-(F)-(G)-A-Bb-C-D-E-F-G-A-C-[D]-(E5)-(F5)',
      }
    },

    amara: {
      name: 'Amara',
      baseRoot: 'D',
      baseOctave: 3,
      mode: 'dorian',  // Dorian mode - determines sharp/flat based on root
      description: 'Variante du Celtic, plus douce. Ideale pour debuter.',
      mood: 'Doux, apaisant',
      baseNotes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'],
      patterns: {
        9: 'D/-A-C-D-E-F-G-A-C_',
        10: 'D/-A-C-D-E-F-G-A-C-D',
        11: 'D/A-(Bb)-C-D-E-F-G-A-C-D',
        12: 'D/(F)-(G)-A-C-D-E-F-G-A-C-D',
        13: 'D/(E)-(F)-(G)-A-C-D-E-F-G-A-C-D',
        14: 'D/(A2)-(C3)-(F)-(G)-A-C-D-E-F-G-A-C-D',
        15: 'D/(C3)-(F)-(G)-A-(Bb)-C-D-E-F-G-A-C-D-[F]',
        16: 'D/(C3)-(E)-(F)-(G)-A-C-D-E-F-G-A-C-D-(E)-(F)',
        17: 'D/(A2)-(C3)-(F)-(G)-A-C-D-E-F-G-A-C-D-[E]-(F)-(G)',
      }
    },

    celtic: {
      name: 'Celtic Minor',
      baseRoot: 'D',
      baseOctave: 3,
      mode: 'dorian',  // Dorian mode - same as Amara
      description: 'Sonorites celtiques et medievales. Tres melodique.',
      mood: 'Mystique, nostalgique',
      baseNotes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'],
      patterns: null  // Non disponible dans le configurateur
    },

    pygmy: {
      name: 'Pygmy',
      baseRoot: 'D',
      baseOctave: 3,
      mode: 'aeolian',  // Minor pentatonic based - uses aeolian for key signature
      description: 'Gamme pentatonique africaine. Joyeuse et entrainante.',
      mood: 'Joyeux, tribal',
      baseNotes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'F4', 'G4', 'A4'],
      patterns: null  // Non disponible dans le configurateur
    },

    lowpygmy: {
      name: 'Low Pygmy',
      baseRoot: 'F#',
      baseOctave: 3,
      mode: 'aeolian',  // Minor pentatonic based - uses aeolian for key signature
      description: 'Version grave du Pygmy. Profonde et hypnotique.',
      mood: 'Profond, tribal',
      baseNotes: ['F#3', 'G#3', 'A3', 'C#4', 'E4', 'F#4', 'G#4', 'A4', 'C#5'],
      patterns: {
        9: 'F#/-G#-A-C#-E-F#-G#-A-C#',
        10: 'F#/-G#-A-C#-E-F#-G#-A-C#-E',
        11: 'F#/-G#-A-C#-E-F#-G#-A-C#-E-[F#]',
        12: 'F#/-G#-A-C#-E-F#-G#-A-C#-E-[F#]-[G#]',
        13: 'F#/-G#-A-(B)-C#-E-F#-G#-A-C#-E-[F#]-[G#]',
        14: 'F#/-G#-A-(B)-C#-(D)-E-F#-G#-A-C#-E-[F#]-[G#]',
        15: 'F#/-G#-A-(B)-C#-(D)-E-F#-G#-A-(B)-C#-E-[F#]-[G#]',
        16: 'F#/-G#-A-(B)-C#-(D)-E-F#-G#-A-(B)-C#-(D)-E-[F#]-[G#]',
        17: 'F#/-(D3)-(E3)-G#3-A-(B4)-C#4-(D4)-E-F#-G#-A-(B)-C#-E-[F#]-[G#]',
      }
    },

    hijaz: {
      name: 'Hijaz',
      baseRoot: 'D',
      baseOctave: 3,
      mode: 'phrygian_dominant',  // Phrygian dominant (5th mode of harmonic minor)
      description: 'Sonorites orientales. Mysterieuse et envoutante.',
      mood: 'Oriental, mystique',
      baseNotes: ['D3', 'A3', 'Bb3', 'C#4', 'D4', 'E4', 'F4', 'G4', 'A4'],
      patterns: {
        9: 'D/-A-A#-C#-D-E-F-G-A',
        10: 'D/-A-A#-C#-D-E-F-G-A-C#',
        11: 'D/-A-A#-C#-D-E-F-G-A-C#-[D]',
        12: 'D/-(E)-(F)-A-A#-C#-D-E-F-G-A-C#',
        13: 'D/-(E)-(F)-A-A#-C#-D-E-F-G-A-C#-[D]',
        14: 'D/-(E)-(F)-(G)-A-A#-C#-D-E-F-G-A-C#-[D]',
        15: 'D/-(E)-(F)-A-A#-C#-D-E-F-G-A-C#-[D]-(E)-(F)',
        16: 'D/-(E)-(F)-(G)-A-A#-C#-D-E-F-G-A-C#-[D]-(E)-(F)',
        17: 'D/-(A#2)-(C#3)-(E)-(F)-A-A#-C#-D-E-F-G-A-C#-[D]-(E)-(F)',
      }
    },

    myxolydian: {
      name: 'Myxolydian',
      baseRoot: 'C',
      baseOctave: 3,
      mode: 'mixolydian',  // Mixolydian mode
      description: 'Mode grec lumineux. Joyeux et ouvert.',
      mood: 'Lumineux, joyeux',
      baseNotes: ['C3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'],
      patterns: {
        9: 'C/-G-A-B-C-D-E-F-G',
        10: 'C/-G-A-B-C-D-E-F-G-A',
        11: 'C/-G-A-B-C-D-E-F-G-A-(C)',
        12: 'C/-(E)-(F)-G-A-B-C-D-E-F-G-A',
        13: 'C/-(E)-(F)-G-A-B-C-D-E-F-G-A-(C)',
        14: 'C/-(E)-(F)-G-A-B-C-D-E-F-G-A-(B)-(C)',
        15: 'C/-(D)-(E)-(F)-G-A-B-C-D-E-F-G-A-(B)-(C)',
        16: 'C/-(E)-(F)-G-A-B-C-D-E-F-G-A-(B)-(C)-(D)-(E)',
        17: 'C/-(D)-(E)-(F)-G-A-B-C-D-E-F-G-A-B-(C)-(D)-(E)',
      }
    },

    equinox: {
      name: 'Equinox',
      baseRoot: 'F',
      baseOctave: 3,
      mode: 'phrygian',  // Phrygian mode
      description: 'Gamme grave et profonde. Sonorites riches.',
      mood: 'Profond, meditatif',
      baseNotes: ['F3', 'Ab3', 'C4', 'Db4', 'Eb4', 'F4', 'G4', 'Ab4', 'C5'],
      patterns: {
        9: 'F/-G#3-C4-C#4-D#4-F4-G4-G#4-C5',
        10: 'F/-G#3-C4-C#4-D#4-F4-G4-G#4-C5-D#',
        11: 'F/-G#3-C4-C#4-D#4-F4-G4-G#4-C5-D#-[F]',
        12: 'F/-G#3-C4-C#4-D#4-F4-G4-G#4-C5-C#-D#-[F]',
        13: 'F/-(C3)-(C#3)-G#3-C4-C#4-D#4-F4-G4-G#4-C5-C#-[F]',
        14: 'F/-(C3)-(C#3)-G#3-C4-C#4-D#4-F4-G4-G#4-C5-C#-D#-[F]',
        15: 'F/-(C3)-(C#3)-(G3)-G#3-C4-C#4-D#4-F4-G4-G#4-C5-C#-D#-[F]',
        16: 'F/-(C3)-(C#3)-(G3)-G#3-C4-C#4-D#4-F4-G4-G#4-C5-C#-D#-[F]-[G]',
        17: 'F/-(C3)-(C#3)-(G3)-G#3-C4-C#4-D#4-F4-G4-G#4-C5-C#-D#-[F]-[G]-[G#]',
      }
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Convert sharp notation to flat for display (based on scale preference)
   * @param {string} noteWithOctave - Note like "A#3" or "Bb3"
   * @param {boolean} useFlats - Whether to display as flats
   * @returns {string} - Converted note
   */
  function toDisplayNotation(noteWithOctave, useFlats) {
    if (!useFlats) return noteWithOctave;
    const match = noteWithOctave.match(/^([A-G]#?)(\d)?$/);
    if (!match) return noteWithOctave;
    const note = match[1];
    const octave = match[2] || '';
    const flat = SHARPS_TO_FLATS[note];
    return flat ? flat + octave : noteWithOctave;
  }

  /**
   * Convert flat notation to sharp (for internal storage/audio files)
   * @param {string} noteWithOctave - Note like "Bb3"
   * @returns {string} - Sharp notation like "A#3"
   */
  function toSharpNotation(noteWithOctave) {
    let result = noteWithOctave;
    for (const [flat, sharp] of Object.entries(FLATS_TO_SHARPS)) {
      if (result.startsWith(flat)) {
        result = result.replace(flat, sharp);
        break;
      }
    }
    return result;
  }

  /**
   * Convert note name to audio file name (C#4 -> Cs4, Bb3 -> As3)
   * @param {string} noteName - Note like "C#4" or "Bb3"
   * @returns {string} - File name like "Cs4" or "As3"
   */
  function noteToFileName(noteName) {
    // First convert flats to sharps
    let fileName = toSharpNotation(noteName);
    // Then convert # to s for file name
    return fileName.replace('#', 's');
  }

  /**
   * Determine if we should use flats for displaying notes in a scale
   * Based on proper music theory using Circle of Fifths:
   *
   * For each enharmonic root (C#/Db, F#/Gb, G#/Ab, etc.), we calculate
   * the number of accidentals for BOTH spellings and choose the simpler one.
   *
   * Examples:
   * - G# aeolian: G#(+8) + (-3) = 5 sharps vs Ab(-4) + (-3) = 7 flats → G# wins
   * - G# mixolydian: G#(+8) + (-1) = 7 sharps vs Ab(-4) + (-1) = 5 flats → Ab wins
   * - F# mixolydian: F#(+6) + (-1) = 5 sharps vs Gb(-6) + (-1) = 7 flats → wait...
   *   Actually Gb(-6) + (-1) = -7 → |7| flats, F#(+6) + (-1) = 5 sharps → F# wins
   *   But user says F# Mixolydian should be Gb... let me recalculate
   *
   * @param {string} tonality - Root note with octave like "C#3" or "D3"
   * @param {object} scaleData - Scale data object with mode property
   * @returns {boolean} - True if should display as flats
   */
  function shouldUseFlats(tonality, scaleData) {
    if (!scaleData) return false;

    // Extract root note from tonality (e.g., "C#3" -> "C#", "D3" -> "D")
    const match = tonality.match(/^([A-G][#b]?)(\d)$/);
    if (!match) return false;

    let root = match[1];

    // Normalize: convert flat input to sharp for consistent lookup
    const sharpRoot = root.includes('b') ? (FLATS_TO_SHARPS[root] || root) : root;
    const flatRoot = SHARP_TO_FLAT_ROOT[sharpRoot] || null;

    // A# and D# are NEVER valid key centers - always use Bb and Eb
    // These roots have circle positions (10, 9) that would require double sharps
    if (ALWAYS_FLAT_ROOTS.includes(sharpRoot)) {
      return true;
    }

    // Get mode offset (default to aeolian if not specified)
    const mode = scaleData.mode || 'aeolian';
    const modeOffset = MODE_OFFSETS[mode] !== undefined ? MODE_OFFSETS[mode] : -3;

    // For natural notes (no enharmonic equivalent), just calculate directly
    if (!flatRoot) {
      const position = CIRCLE_SHARP[sharpRoot];
      if (position === undefined) return false;
      const effectiveKey = position + modeOffset;
      return effectiveKey < 0;
    }

    // For enharmonic roots, calculate BOTH options and compare
    const sharpPosition = CIRCLE_SHARP[sharpRoot];
    const flatPosition = CIRCLE_FLAT[flatRoot];

    if (sharpPosition === undefined || flatPosition === undefined) return false;

    const sharpAccidentals = Math.abs(sharpPosition + modeOffset);
    const flatAccidentals = Math.abs(flatPosition + modeOffset);

    // Choose the spelling with fewer accidentals
    if (flatAccidentals < sharpAccidentals) {
      return true;  // Use flat spelling
    } else if (sharpAccidentals < flatAccidentals) {
      return false; // Use sharp spelling
    } else {
      // Equal accidentals - prefer the one that stays within practical range
      // Practical range is typically -6 to +6 (up to 6 accidentals)
      const sharpEffective = sharpPosition + modeOffset;
      const flatEffective = flatPosition + modeOffset;

      // If sharp is within range and flat is not, use sharp
      if (sharpEffective <= 6 && sharpEffective >= 0 && flatEffective < -6) return false;
      // If flat is within range and sharp is not, use flat
      if (flatEffective >= -6 && flatEffective <= 0 && sharpEffective > 6) return true;

      // Both within range - prefer sharps (they're generally more common for these keys)
      return false;
    }
  }

  /**
   * Get the correct notation for a tonality chip based on music theory
   * This determines how each individual root note chip should be displayed
   *
   * Uses the same Circle of Fifths calculation as shouldUseFlats():
   * - For each root + scale combination, determine the optimal spelling
   * - Compare sharp vs flat accidental counts and choose the simpler one
   *
   * @param {string} tonalityValue - Note in sharp notation like "A#3"
   * @param {object} scaleData - Scale data object with mode property
   * @returns {string} - Display notation like "Bb3"
   */
  function getTonalityChipNotation(tonalityValue, scaleData) {
    const match = tonalityValue.match(/^([A-G]#?)(\d)$/);
    if (!match) return tonalityValue;

    const note = match[1];
    const octave = match[2];

    // Natural notes - no conversion needed
    if (!note.includes('#')) return tonalityValue;

    // For any sharp note with a flat equivalent, use shouldUseFlats to decide
    if (SHARP_TO_FLAT_ROOT[note]) {
      const useFlats = shouldUseFlats(tonalityValue, scaleData);
      if (useFlats) {
        return SHARPS_TO_FLATS[note] + octave;
      }
    }

    return tonalityValue;
  }

  /**
   * Get base notes for a scale, converted to display notation
   * @param {string} scaleKey - Scale key like "kurd"
   * @param {boolean} [forceFlats] - Override useFlats calculation
   * @returns {string[]} - Array of notes in display notation
   */
  function getScaleNotes(scaleKey, forceFlats) {
    const scale = SCALES_DATA[scaleKey];
    if (!scale) return [];
    // Use proper music theory to determine flats/sharps for base tonality
    const baseTonality = scale.baseRoot + scale.baseOctave;
    const useFlats = forceFlats !== undefined ? forceFlats : shouldUseFlats(baseTonality, scale);
    return scale.baseNotes.map(note => toDisplayNotation(note, useFlats));
  }

  /**
   * Get scale display name with root in correct notation
   * @param {string} scaleKey - Scale key like "kurd"
   * @param {string} [tonality] - Optional tonality override like "F#3"
   * @returns {string} - Display name like "D Kurd" or "Gb Kurd"
   */
  function getScaleDisplayName(scaleKey, tonality) {
    const scale = SCALES_DATA[scaleKey];
    if (!scale) return '';

    let root = tonality || (scale.baseRoot + scale.baseOctave);
    const rootMatch = root.match(/^([A-G][#b]?)(\d)?$/);
    const rootNote = rootMatch ? rootMatch[1] : root;
    const octave = rootMatch ? rootMatch[2] : scale.baseOctave;

    // Use proper music theory to determine sharp/flat display
    const useFlats = shouldUseFlats(rootNote + octave, scale);
    const displayRoot = toDisplayNotation(rootNote, useFlats);

    return `${displayRoot} ${scale.name}`;
  }

  /**
   * Check if a scale has configurator patterns
   * @param {string} scaleKey - Scale key
   * @returns {boolean}
   */
  function hasConfiguratorSupport(scaleKey) {
    const scale = SCALES_DATA[scaleKey];
    return scale && scale.patterns !== null;
  }

  /**
   * Get list of scales available for configurator
   * @returns {string[]} - Array of scale keys
   */
  function getConfiguratorScales() {
    return Object.keys(SCALES_DATA).filter(key => hasConfiguratorSupport(key));
  }

  /**
   * Get list of all scales
   * @returns {string[]} - Array of scale keys
   */
  function getAllScales() {
    return Object.keys(SCALES_DATA);
  }

  // ============================================================================
  // NOTATION MODE (American / French solfège)
  // ============================================================================

  let _notationMode = null;

  /**
   * Get current notation mode ('american' or 'french')
   */
  function getNotationMode() {
    if (_notationMode === null) {
      try { _notationMode = localStorage.getItem('mistral_notation_mode') || 'american'; }
      catch (e) { _notationMode = 'american'; }
    }
    return _notationMode;
  }

  /**
   * Set notation mode and persist preference
   * @param {'american'|'french'} mode
   */
  function setNotationMode(mode) {
    _notationMode = mode;
    try { localStorage.setItem('mistral_notation_mode', mode); } catch (e) {}
    window.dispatchEvent(new CustomEvent('notation-mode-change', { detail: { mode } }));
  }

  /**
   * Convert a single note to French solfège notation
   * @param {string} noteWithOctave - Note like "Bb3", "C#4", "D3"
   * @returns {string} - French notation like "Sib3", "Do#4", "Ré3"
   */
  function toFrenchNotation(noteWithOctave) {
    const match = noteWithOctave.match(/^([A-G])([#b]?)(\d?)$/);
    if (!match) return noteWithOctave;
    const base = AMERICAN_TO_FRENCH[match[1]] || match[1];
    return base + match[2] + match[3];
  }

  /**
   * Convert a note to user-preferred notation (American or French)
   * Applies sharp/flat conversion first, then French if needed
   * @param {string} noteWithOctave - Note like "A#3"
   * @param {boolean} useFlats - Whether to display as flats
   * @returns {string} - Note in user's preferred notation
   */
  function toUserNotation(noteWithOctave, useFlats) {
    let note = toDisplayNotation(noteWithOctave, useFlats);
    if (getNotationMode() === 'french') {
      note = toFrenchNotation(note);
    }
    return note;
  }

  /**
   * Convert all note names within a string (e.g., notes_layout pattern)
   * Respects current notation mode
   * @param {string} str - String containing note names
   * @returns {string} - String with notes converted to user notation
   */
  function convertNotesInString(str) {
    if (!str || getNotationMode() !== 'french') return str;
    return str.replace(/([A-G])([#b]?)(\d?)/g, function(match, letter, accidental, octave) {
      const french = AMERICAN_TO_FRENCH[letter] || letter;
      return french + accidental + octave;
    });
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.MistralScales = {
    // Data
    SCALES_DATA: SCALES_DATA,
    NOTE_NAMES: NOTE_NAMES,
    FLATS_TO_SHARPS: FLATS_TO_SHARPS,
    SHARPS_TO_FLATS: SHARPS_TO_FLATS,
    CIRCLE_SHARP: CIRCLE_SHARP,
    CIRCLE_FLAT: CIRCLE_FLAT,
    MODE_OFFSETS: MODE_OFFSETS,
    SHARP_TO_FLAT_ROOT: SHARP_TO_FLAT_ROOT,
    FLAT_TO_SHARP_ROOT: FLAT_TO_SHARP_ROOT,
    ALWAYS_FLAT_ROOTS: ALWAYS_FLAT_ROOTS,

    // Functions
    toDisplayNotation: toDisplayNotation,
    toSharpNotation: toSharpNotation,
    noteToFileName: noteToFileName,
    shouldUseFlats: shouldUseFlats,
    getTonalityChipNotation: getTonalityChipNotation,
    getScaleNotes: getScaleNotes,
    getScaleDisplayName: getScaleDisplayName,
    hasConfiguratorSupport: hasConfiguratorSupport,
    getConfiguratorScales: getConfiguratorScales,
    getAllScales: getAllScales,

    // Notation mode (American / French)
    AMERICAN_TO_FRENCH: AMERICAN_TO_FRENCH,
    toFrenchNotation: toFrenchNotation,
    toUserNotation: toUserNotation,
    convertNotesInString: convertNotesInString,
    getNotationMode: getNotationMode,
    setNotationMode: setNotationMode
  };

  // Also expose SCALES_DATA directly for backward compatibility
  window.SCALES_DATA = SCALES_DATA;

})();
