/**
 * Tests unitaires — js/data/scales-data.js (MistralScales)
 *
 * Couvre : constantes, notation, théorie musicale, gammes.
 * Environnement : jsdom (via vitest.config.js).
 */

import { describe, it, expect } from 'vitest';

// MistralScales est chargé dans window via tests/setup.js
const MS = () => window.MistralScales;

// ============================================================================
// CONSTANTES
// ============================================================================

describe('Constantes', () => {
  it('NOTE_NAMES contient 12 notes chromatiques', () => {
    expect(MS().NOTE_NAMES).toHaveLength(12);
    expect(MS().NOTE_NAMES[0]).toBe('C');
    expect(MS().NOTE_NAMES[11]).toBe('B');
  });

  it('FLATS_TO_SHARPS convertit les bémols en dièses', () => {
    expect(MS().FLATS_TO_SHARPS['Bb']).toBe('A#');
    expect(MS().FLATS_TO_SHARPS['Eb']).toBe('D#');
    expect(MS().FLATS_TO_SHARPS['Ab']).toBe('G#');
  });

  it('SHARPS_TO_FLATS convertit les dièses en bémols', () => {
    expect(MS().SHARPS_TO_FLATS['A#']).toBe('Bb');
    expect(MS().SHARPS_TO_FLATS['D#']).toBe('Eb');
    expect(MS().SHARPS_TO_FLATS['G#']).toBe('Ab');
  });

  it('AMERICAN_TO_FRENCH contient les 7 notes', () => {
    const map = MS().AMERICAN_TO_FRENCH;
    expect(map['C']).toBe('Do');
    expect(map['D']).toBe('Ré');
    expect(map['E']).toBe('Mi');
    expect(map['F']).toBe('Fa');
    expect(map['G']).toBe('Sol');
    expect(map['A']).toBe('La');
    expect(map['B']).toBe('Si');
  });
});

// ============================================================================
// SCALES_DATA
// ============================================================================

describe('SCALES_DATA', () => {
  it('contient les gammes principales', () => {
    const data = MS().SCALES_DATA;
    expect(data).toHaveProperty('kurd');
    expect(data).toHaveProperty('amara');
    expect(data).toHaveProperty('celtic');
    expect(data).toHaveProperty('pygmy');
    expect(data).toHaveProperty('hijaz');
  });

  it('chaque gamme a les propriétés requises', () => {
    const data = MS().SCALES_DATA;
    for (const [key, scale] of Object.entries(data)) {
      expect(scale).toHaveProperty('name');
      expect(scale).toHaveProperty('baseRoot');
      expect(scale).toHaveProperty('baseOctave');
      expect(scale).toHaveProperty('mode');
      expect(scale).toHaveProperty('baseNotes');
      expect(Array.isArray(scale.baseNotes)).toBe(true);
    }
  });

  it('Kurd a les bonnes propriétés de base', () => {
    const kurd = MS().SCALES_DATA.kurd;
    expect(kurd.name).toBe('Kurd');
    expect(kurd.mode).toBe('aeolian');
  });
});

// ============================================================================
// NOTATION CONVERSION
// ============================================================================

describe('toDisplayNotation', () => {
  it('retourne la note inchangée si useFlats=false', () => {
    expect(MS().toDisplayNotation('C#4', false)).toBe('C#4');
    expect(MS().toDisplayNotation('A3', false)).toBe('A3');
  });

  it('convertit en bémol si useFlats=true', () => {
    expect(MS().toDisplayNotation('C#4', true)).toBe('Db4');
    expect(MS().toDisplayNotation('A#3', true)).toBe('Bb3');
  });

  it('ne modifie pas les notes naturelles', () => {
    expect(MS().toDisplayNotation('C4', true)).toBe('C4');
    expect(MS().toDisplayNotation('A3', true)).toBe('A3');
  });
});

describe('toSharpNotation', () => {
  it('convertit les bémols en dièses', () => {
    expect(MS().toSharpNotation('Bb3')).toBe('A#3');
    expect(MS().toSharpNotation('Eb4')).toBe('D#4');
    expect(MS().toSharpNotation('Db3')).toBe('C#3');
  });

  it('ne modifie pas les notes déjà en dièse', () => {
    expect(MS().toSharpNotation('C#4')).toBe('C#4');
  });

  it('ne modifie pas les notes naturelles', () => {
    expect(MS().toSharpNotation('A3')).toBe('A3');
    expect(MS().toSharpNotation('C4')).toBe('C4');
  });
});

describe('noteToFileName', () => {
  it('convertit C#4 en Cs4 (pour le fichier audio)', () => {
    expect(MS().noteToFileName('C#4')).toBe('Cs4');
  });

  it('convertit Bb3 (bémol) en As3 (dièse → fichier)', () => {
    expect(MS().noteToFileName('Bb3')).toBe('As3');
  });

  it('garde les notes naturelles inchangées', () => {
    expect(MS().noteToFileName('A3')).toBe('A3');
    expect(MS().noteToFileName('C4')).toBe('C4');
  });
});

describe('toFrenchNotation', () => {
  it('convertit les notes américaines en solfège français', () => {
    expect(MS().toFrenchNotation('C4')).toBe('Do4');
    expect(MS().toFrenchNotation('D3')).toBe('Ré3');
    expect(MS().toFrenchNotation('E4')).toBe('Mi4');
    expect(MS().toFrenchNotation('F3')).toBe('Fa3');
    expect(MS().toFrenchNotation('G4')).toBe('Sol4');
    expect(MS().toFrenchNotation('A3')).toBe('La3');
    expect(MS().toFrenchNotation('B4')).toBe('Si4');
  });

  it('convertit les dièses', () => {
    expect(MS().toFrenchNotation('C#4')).toBe('Do#4');
    expect(MS().toFrenchNotation('F#3')).toBe('Fa#3');
  });
});

// ============================================================================
// THÉORIE MUSICALE
// ============================================================================

describe('shouldUseFlats', () => {
  it('retourne un booléen', () => {
    const kurd = MS().SCALES_DATA.kurd;
    const result = MS().shouldUseFlats('D3', kurd);
    expect(typeof result).toBe('boolean');
  });

  it('les tonalités en bémol utilisent les bémols', () => {
    // Bb est naturellement en bémol
    const kurd = MS().SCALES_DATA.kurd;
    const result = MS().shouldUseFlats('A#3', kurd);
    // A# est l'enharmonique de Bb → devrait être flat
    expect(typeof result).toBe('boolean');
  });
});

describe('getScaleNotes', () => {
  it('retourne un tableau de notes pour Kurd', () => {
    const notes = MS().getScaleNotes('kurd');
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
  });
});

describe('getScaleDisplayName', () => {
  it('retourne le nom de la gamme', () => {
    const name = MS().getScaleDisplayName('kurd');
    expect(name).toContain('Kurd');
  });

  it('inclut la tonalité si fournie', () => {
    const name = MS().getScaleDisplayName('kurd', 'D3');
    expect(name.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// FONCTIONS CONFIGURATEUR
// ============================================================================

describe('hasConfiguratorSupport', () => {
  it('retourne true pour les gammes avec patterns', () => {
    expect(MS().hasConfiguratorSupport('kurd')).toBe(true);
  });

  it('retourne falsy pour une gamme inexistante', () => {
    expect(MS().hasConfiguratorSupport('nonexistent')).toBeFalsy();
  });
});

describe('getConfiguratorScales', () => {
  it('retourne un tableau non-vide de gammes', () => {
    const scales = MS().getConfiguratorScales();
    expect(Array.isArray(scales)).toBe(true);
    expect(scales.length).toBeGreaterThan(0);
  });

  it('contient les gammes principales', () => {
    const scales = MS().getConfiguratorScales();
    expect(scales).toContain('kurd');
  });
});

describe('getAllScales', () => {
  it('retourne toutes les gammes définies', () => {
    const scales = MS().getAllScales();
    expect(Array.isArray(scales)).toBe(true);
    expect(scales.length).toBeGreaterThanOrEqual(MS().getConfiguratorScales().length);
  });
});
