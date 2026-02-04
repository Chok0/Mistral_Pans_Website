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

  // ============================================================================
  // SCALES DATA
  // ============================================================================

  const SCALES_DATA = {
    kurd: {
      name: 'Kurd',
      baseRoot: 'D',
      baseOctave: 3,
      useFlats: true,  // Kurd utilise Bb (mode mineur naturel)
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
      useFlats: true,  // Amara utilise Bb (derive du mode dorien)
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
      useFlats: false,  // Celtic utilise des notes naturelles principalement
      description: 'Sonorites celtiques et medievales. Tres melodique.',
      mood: 'Mystique, nostalgique',
      baseNotes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'],
      patterns: null  // Non disponible dans le configurateur
    },

    pygmy: {
      name: 'Pygmy',
      baseRoot: 'D',
      baseOctave: 3,
      useFlats: true,  // Pygmy utilise Bb
      description: 'Gamme pentatonique africaine. Joyeuse et entrainante.',
      mood: 'Joyeux, tribal',
      baseNotes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'F4', 'G4', 'A4'],
      patterns: null  // Non disponible dans le configurateur
    },

    lowpygmy: {
      name: 'Low Pygmy',
      baseRoot: 'F#',
      baseOctave: 3,
      useFlats: false,  // Low Pygmy utilise F#, G#, C# (gamme a dieses)
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
      useFlats: false,  // Hijaz utilise la seconde augmentee (A#-C#) - dieses
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
      useFlats: false,  // Myxolydien en Do = notes naturelles (pas d'alteration)
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
      useFlats: true,  // Equinox = Fa mineur, utilise bemols (Ab, Db, Eb)
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
   * Get base notes for a scale, converted to display notation
   * @param {string} scaleKey - Scale key like "kurd"
   * @param {boolean} [forceFlats] - Override useFlats setting
   * @returns {string[]} - Array of notes in display notation
   */
  function getScaleNotes(scaleKey, forceFlats) {
    const scale = SCALES_DATA[scaleKey];
    if (!scale) return [];
    const useFlats = forceFlats !== undefined ? forceFlats : scale.useFlats;
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
    const rootMatch = root.match(/^([A-G]#?)(\d)?$/);
    const rootNote = rootMatch ? rootMatch[1] : root;
    const displayRoot = toDisplayNotation(rootNote, scale.useFlats);

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
  // EXPORT
  // ============================================================================

  window.MistralScales = {
    // Data
    SCALES_DATA: SCALES_DATA,
    NOTE_NAMES: NOTE_NAMES,
    FLATS_TO_SHARPS: FLATS_TO_SHARPS,
    SHARPS_TO_FLATS: SHARPS_TO_FLATS,

    // Functions
    toDisplayNotation: toDisplayNotation,
    toSharpNotation: toSharpNotation,
    noteToFileName: noteToFileName,
    getScaleNotes: getScaleNotes,
    getScaleDisplayName: getScaleDisplayName,
    hasConfiguratorSupport: hasConfiguratorSupport,
    getConfiguratorScales: getConfiguratorScales,
    getAllScales: getAllScales
  };

  // Also expose SCALES_DATA directly for backward compatibility
  window.SCALES_DATA = SCALES_DATA;

})();
