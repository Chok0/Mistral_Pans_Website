/**
 * Tests unitaires — js/features/feasibility-module.js (FeasibilityModule)
 *
 * Couvre : calcul de surface, faisabilité, notes interdites.
 * Environnement : jsdom (via vitest.config.js).
 */

import { describe, it, expect } from 'vitest';

// FeasibilityModule est chargé dans window via tests/setup.js
const FM = () => window.FeasibilityModule;

// ============================================================================
// NOTE_SURFACE_TABLE
// ============================================================================

describe('NOTE_SURFACE_TABLE', () => {
  it('contient les notes de E2 à F5', () => {
    const table = FM().NOTE_SURFACE_TABLE;
    expect(table['E2']).toBe(37149);
    expect(table['F5']).toBe(4053);
    expect(table['C4']).toBe(11184);
    expect(table['A3']).toBe(13538);
  });

  it('a 38 entrées (E2 à F5)', () => {
    const table = FM().NOTE_SURFACE_TABLE;
    expect(Object.keys(table).length).toBe(38);
  });

  it('les surfaces décroissent avec la hauteur', () => {
    const table = FM().NOTE_SURFACE_TABLE;
    // E2 > E3 > E4 > E5
    expect(table['E2']).toBeGreaterThan(table['E3']);
    expect(table['E3']).toBeGreaterThan(table['E4']);
    expect(table['E4']).toBeGreaterThan(table['E5']);
  });
});

// ============================================================================
// FEASIBILITY_BY_SIZE
// ============================================================================

describe('FEASIBILITY_BY_SIZE', () => {
  it('contient les 3 tailles standards (53, 50, 45)', () => {
    const sizes = FM().FEASIBILITY_BY_SIZE;
    expect(sizes).toHaveProperty('53');
    expect(sizes).toHaveProperty('50');
    expect(sizes).toHaveProperty('45');
  });

  it('chaque taille a SHELL, COMFORT, WARNING, MAX, FORBIDDEN_NOTES', () => {
    const sizes = FM().FEASIBILITY_BY_SIZE;
    for (const size of ['53', '50', '45']) {
      const s = sizes[size];
      expect(s).toHaveProperty('SHELL');
      expect(s).toHaveProperty('COMFORT');
      expect(s).toHaveProperty('WARNING');
      expect(s).toHaveProperty('MAX');
      expect(s).toHaveProperty('FORBIDDEN_NOTES');
      expect(Array.isArray(s.FORBIDDEN_NOTES)).toBe(true);
    }
  });

  it('les seuils sont dans l\'ordre COMFORT < WARNING < MAX < SHELL', () => {
    const sizes = FM().FEASIBILITY_BY_SIZE;
    for (const size of ['53', '50', '45']) {
      const s = sizes[size];
      expect(s.COMFORT).toBeLessThan(s.WARNING);
      expect(s.WARNING).toBeLessThan(s.MAX);
      expect(s.MAX).toBeLessThan(s.SHELL);
    }
  });

  it('53cm est la plus grande tôle', () => {
    const sizes = FM().FEASIBILITY_BY_SIZE;
    expect(sizes['53'].SHELL).toBeGreaterThan(sizes['50'].SHELL);
    expect(sizes['50'].SHELL).toBeGreaterThan(sizes['45'].SHELL);
  });

  it('notes interdites : A#4 sur 53cm, B4 sur 50cm, C#5 sur 45cm', () => {
    const sizes = FM().FEASIBILITY_BY_SIZE;
    expect(sizes['53'].FORBIDDEN_NOTES).toContain('A#4');
    expect(sizes['50'].FORBIDDEN_NOTES).toContain('B4');
    expect(sizes['45'].FORBIDDEN_NOTES).toContain('C#5');
  });
});

// ============================================================================
// checkFeasibility
// ============================================================================

describe('checkFeasibility', () => {
  // Helper pour créer des notes
  function makeNotes(noteOctaves, type) {
    type = type || 'top';
    return noteOctaves.map(function (no) {
      return { note: no[0], octave: no[1], type: type };
    });
  }

  it('retourne "ok" pour une config légère (peu de notes)', () => {
    // 4 notes en octave 4 — très léger
    const notes = makeNotes([['C', 4], ['D', 4], ['E', 4], ['G', 4]]);
    const result = FM().checkFeasibility(notes, '53');

    expect(result.feasible).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.surface).toBeGreaterThan(0);
    expect(result.ratio).toBeGreaterThan(0);
    expect(result.ratio).toBeLessThan(0.45);
  });

  it('retourne "impossible" si notes interdites', () => {
    // A#4 est interdit sur 53cm
    const notes = makeNotes([['C', 4], ['D', 4], ['A#', 4]]);
    const result = FM().checkFeasibility(notes, '53');

    expect(result.feasible).toBe(false);
    expect(result.status).toBe('impossible');
    expect(result.impossibleNotes.length).toBeGreaterThan(0);
  });

  it('les notes "bottom" ne comptent pas dans la surface', () => {
    const topNotes = makeNotes([['C', 4], ['D', 4]], 'top');
    const bottomNotes = makeNotes([['E', 2], ['F', 2]], 'bottom');
    const combined = topNotes.concat(bottomNotes);

    const resultTop = FM().checkFeasibility(topNotes, '53');
    const resultCombined = FM().checkFeasibility(combined, '53');

    // La surface devrait être identique (les bottom notes sont ignorées)
    expect(resultCombined.surface).toBe(resultTop.surface);
  });

  it('les notes "bottom" ne déclenchent pas l\'interdiction', () => {
    // A#4 en tant que bottom → ne devrait pas être interdit
    const notes = [
      { note: 'C', octave: 4, type: 'top' },
      { note: 'A#', octave: 4, type: 'bottom' }
    ];
    const result = FM().checkFeasibility(notes, '53');

    // La note bottom n'est pas vérifiée pour l'interdiction
    expect(result.status).not.toBe('impossible');
  });

  it('retourne "impossible" si surface > MAX (beaucoup de grosses notes)', () => {
    // Beaucoup de notes basses en octave 2-3 → surface énorme
    const notes = makeNotes([
      ['E', 2], ['F', 2], ['G', 2], ['A', 2], ['B', 2],
      ['C', 3], ['D', 3], ['E', 3], ['F', 3], ['G', 3]
    ]);
    const result = FM().checkFeasibility(notes, '45'); // petite tôle

    expect(result.feasible).toBe(false);
    expect(result.status).toBe('impossible');
    expect(result.surface).toBeGreaterThan(FM().FEASIBILITY_BY_SIZE['45'].MAX);
  });

  it('utilise la taille par défaut (53) si taille inconnue', () => {
    const notes = makeNotes([['C', 4], ['D', 4]]);
    const result = FM().checkFeasibility(notes, '99');

    // Devrait utiliser les seuils de 53cm en fallback
    expect(result.thresholds.SHELL).toBe(FM().FEASIBILITY_BY_SIZE['53'].SHELL);
  });

  it('retourne les thresholds dans le résultat', () => {
    const notes = makeNotes([['C', 4]]);
    const result = FM().checkFeasibility(notes, '50');

    expect(result.thresholds).toBeDefined();
    expect(result.thresholds.SHELL).toBe(FM().FEASIBILITY_BY_SIZE['50'].SHELL);
  });

  it('le ratio est surface/SHELL', () => {
    const notes = makeNotes([['C', 4], ['D', 4], ['E', 4]]);
    const result = FM().checkFeasibility(notes, '53');
    const expected = result.surface / FM().FEASIBILITY_BY_SIZE['53'].SHELL;

    expect(result.ratio).toBeCloseTo(expected, 5);
  });

  it('config vide (0 notes) → ok, surface 0', () => {
    const result = FM().checkFeasibility([], '53');

    expect(result.feasible).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.surface).toBe(0);
    expect(result.ratio).toBe(0);
  });
});

// ============================================================================
// TRANSITIONS DE SEUILS
// ============================================================================

describe('Transitions de seuils (ok → warning → difficult → impossible)', () => {
  // Construire une config avec N notes de même surface pour contrôler le total
  function buildConfig(count, noteKey) {
    noteKey = noteKey || ['C', 4];
    var notes = [];
    for (var i = 0; i < count; i++) {
      notes.push({ note: noteKey[0], octave: noteKey[1], type: 'top' });
    }
    return notes;
  }

  it('passage ok → warning autour de 45% (53cm)', () => {
    // C4 = 11184 mm² ; COMFORT(53) = 122805
    // 122805 / 11184 ≈ 10.98 → 10 notes = OK, 11 notes = WARNING
    const okNotes = buildConfig(10);
    const warningNotes = buildConfig(11);

    expect(FM().checkFeasibility(okNotes, '53').status).toBe('ok');
    expect(FM().checkFeasibility(warningNotes, '53').status).toBe('warning');
  });

  it('passage warning → difficult autour de 50% (53cm)', () => {
    // WARNING(53) = 136450 ; 136450 / 11184 ≈ 12.2 → 12 notes = WARNING, 13 = DIFFICULT
    const warningNotes = buildConfig(12);
    const difficultNotes = buildConfig(13);

    const w = FM().checkFeasibility(warningNotes, '53');
    const d = FM().checkFeasibility(difficultNotes, '53');

    expect(w.status).toBe('warning');
    expect(d.status).toBe('difficult');
  });

  it('passage difficult → impossible autour de 59% (53cm)', () => {
    // MAX(53) = 161011 ; 161011 / 11184 ≈ 14.4 → 14 notes = DIFFICULT, 15 = IMPOSSIBLE
    const difficultNotes = buildConfig(14);
    const impossibleNotes = buildConfig(15);

    const d = FM().checkFeasibility(difficultNotes, '53');
    const i = FM().checkFeasibility(impossibleNotes, '53');

    expect(d.status).toBe('difficult');
    expect(i.status).toBe('impossible');
    expect(i.feasible).toBe(false);
  });
});

// ============================================================================
// SURFACES CONNUES (tests de non-régression)
// ============================================================================

describe('Surfaces connues (non-régression)', () => {
  it('surface de C4 = 11184 mm²', () => {
    const notes = [{ note: 'C', octave: 4, type: 'top' }];
    const result = FM().checkFeasibility(notes, '53');
    expect(result.surface).toBe(11184);
  });

  it('surface de A3 = 13538 mm²', () => {
    const notes = [{ note: 'A', octave: 3, type: 'top' }];
    const result = FM().checkFeasibility(notes, '53');
    expect(result.surface).toBe(13538);
  });

  it('surface additive (C4 + D4 = 11184 + 9735)', () => {
    const notes = [
      { note: 'C', octave: 4, type: 'top' },
      { note: 'D', octave: 4, type: 'top' }
    ];
    const result = FM().checkFeasibility(notes, '53');
    expect(result.surface).toBe(11184 + 9735);
  });
});
