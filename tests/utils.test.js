/**
 * Tests unitaires — js/core/utils.js (MistralUtils)
 *
 * Couvre : formatage, escaping/sanitisation, validation, helpers.
 * Environnement : jsdom (via vitest.config.js).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// MistralUtils est chargé dans window via tests/setup.js
const utils = () => window.MistralUtils;

// ============================================================================
// FORMATTING
// ============================================================================

describe('formatDate', () => {
  it('retourne une date en français long', () => {
    const result = utils().formatDate('2026-02-14');
    expect(result).toContain('14');
    expect(result).toContain('2026');
    // "février" en français
    expect(result.toLowerCase()).toContain('février');
  });

  it('accepte un objet Date', () => {
    const result = utils().formatDate(new Date(2026, 0, 1)); // 1er janvier 2026
    expect(result).toContain('1');
    expect(result.toLowerCase()).toContain('janvier');
    expect(result).toContain('2026');
  });

  it('accepte des options de surcharge', () => {
    const result = utils().formatDate('2026-06-15', { month: 'short' });
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('retourne chaîne vide si null', () => {
    expect(utils().formatDate(null)).toBe('');
  });

  it('retourne chaîne vide si undefined', () => {
    expect(utils().formatDate(undefined)).toBe('');
  });

  it('retourne chaîne vide si chaîne vide', () => {
    expect(utils().formatDate('')).toBe('');
  });
});

describe('formatDateShort', () => {
  it('retourne une date au format JJ/MM/AAAA', () => {
    const result = utils().formatDateShort('2026-02-14');
    expect(result).toBe('14/02/2026');
  });

  it('retourne chaîne vide si falsy', () => {
    expect(utils().formatDateShort(null)).toBe('');
    expect(utils().formatDateShort('')).toBe('');
    expect(utils().formatDateShort(undefined)).toBe('');
  });
});

describe('formatPrice', () => {
  it('formate un prix entier avec symbole €', () => {
    const result = utils().formatPrice(1250);
    // Intl peut utiliser des espaces insécables — on normalise
    const normalized = result.replace(/\s/g, ' ');
    expect(normalized).toContain('1');
    expect(normalized).toContain('250');
    expect(normalized).toContain('€');
  });

  it('formate 0', () => {
    const result = utils().formatPrice(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('gère null → "0 €"', () => {
    expect(utils().formatPrice(null)).toBe('0 €');
  });

  it('gère undefined → "0 €"', () => {
    expect(utils().formatPrice(undefined)).toBe('0 €');
  });

  it('formate un nombre négatif', () => {
    const result = utils().formatPrice(-500);
    const normalized = result.replace(/\s/g, ' ');
    expect(normalized).toContain('500');
    expect(normalized).toContain('€');
  });

  it('affiche les décimales si présentes (minimumFractionDigits: 0)', () => {
    const result = utils().formatPrice(1250.99);
    const normalized = result.replace(/\s/g, ' ');
    // minimumFractionDigits: 0 → affiche les décimales si non-nulles
    expect(normalized).toContain('1');
    expect(normalized).toContain('250,99');
    expect(normalized).toContain('€');
  });

  it('masque les décimales pour un entier', () => {
    const result = utils().formatPrice(1250);
    const normalized = result.replace(/\s/g, ' ');
    expect(normalized).not.toContain(',');
    expect(normalized).toContain('€');
  });
});

describe('formatPriceRaw', () => {
  it('formate avec 2 décimales', () => {
    const result = utils().formatPriceRaw(1250);
    const normalized = result.replace(/\s/g, ' ');
    expect(normalized).toContain('1');
    expect(normalized).toContain('250');
    expect(normalized).toContain(',00');
  });

  it('gère null → "0,00"', () => {
    expect(utils().formatPriceRaw(null)).toBe('0,00');
  });

  it('gère undefined → "0,00"', () => {
    expect(utils().formatPriceRaw(undefined)).toBe('0,00');
  });

  it('formate les centimes', () => {
    const result = utils().formatPriceRaw(1250.5);
    expect(result).toContain(',50');
  });
});

describe('parsePrice', () => {
  it('parse un prix français (ex: "1 250,50 €")', () => {
    expect(utils().parsePrice('1 250,50 €')).toBe(1250.5);
  });

  it('parse un prix simple', () => {
    expect(utils().parsePrice('100')).toBe(100);
  });

  it('parse un nombre avec virgule', () => {
    expect(utils().parsePrice('99,99')).toBe(99.99);
  });

  it('retourne le nombre tel quel si déjà un nombre', () => {
    expect(utils().parsePrice(42)).toBe(42);
  });

  it('retourne 0 pour une chaîne vide', () => {
    expect(utils().parsePrice('')).toBe(0);
  });

  it('retourne 0 pour null', () => {
    expect(utils().parsePrice(null)).toBe(0);
  });

  it('retourne 0 pour undefined', () => {
    expect(utils().parsePrice(undefined)).toBe(0);
  });

  it('retourne 0 pour une chaîne sans chiffres', () => {
    expect(utils().parsePrice('abc')).toBe(0);
  });

  it('gère les nombres négatifs', () => {
    expect(utils().parsePrice('-50,00')).toBe(-50);
  });
});

// ============================================================================
// SECURITY / ESCAPING
// ============================================================================

describe('escapeHtml', () => {
  it('échappe les caractères dangereux', () => {
    expect(utils().escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('échappe le &', () => {
    expect(utils().escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('échappe les chevrons', () => {
    expect(utils().escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('échappe les guillemets doubles', () => {
    expect(utils().escapeHtml('a="b"')).toBe('a=&quot;b&quot;');
  });

  it('retourne chaîne vide pour null', () => {
    expect(utils().escapeHtml(null)).toBe('');
  });

  it('retourne chaîne vide pour undefined', () => {
    expect(utils().escapeHtml(undefined)).toBe('');
  });

  it('retourne chaîne vide pour chaîne vide', () => {
    expect(utils().escapeHtml('')).toBe('');
  });

  it('ne modifie pas le texte pur', () => {
    expect(utils().escapeHtml('Bonjour le monde')).toBe('Bonjour le monde');
  });

  it('convertit les nombres en chaîne', () => {
    expect(utils().escapeHtml(42)).toBe('42');
  });
});

describe('sanitizeHtml (fallback DOMParser)', () => {
  // Note : dans l'env de test (jsdom), DOMPurify n'est pas chargé
  // donc on teste le fallback DOMParser

  it('retourne chaîne vide pour null', () => {
    expect(utils().sanitizeHtml(null)).toBe('');
  });

  it('retourne chaîne vide pour chaîne vide', () => {
    expect(utils().sanitizeHtml('')).toBe('');
  });

  it('garde les balises autorisées (p, strong, em)', () => {
    const input = '<p>Hello <strong>world</strong> <em>!</em></p>';
    const result = utils().sanitizeHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
  });

  it('supprime les balises script', () => {
    const input = '<p>OK</p><script>alert("xss")</script>';
    const result = utils().sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>OK</p>');
  });

  it('supprime les balises iframe', () => {
    const input = '<p>OK</p><iframe src="evil.html"></iframe>';
    const result = utils().sanitizeHtml(input);
    expect(result).not.toContain('<iframe');
  });

  it('supprime les balises form/input/button', () => {
    const input = '<form><input type="text"><button>Submit</button></form>';
    const result = utils().sanitizeHtml(input);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
    expect(result).not.toContain('<button');
  });

  it('supprime les attributs on* (onclick, onerror...)', () => {
    const input = '<p onclick="alert(1)">Test</p>';
    const result = utils().sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('<p');
    expect(result).toContain('Test');
  });

  it('supprime les href javascript:', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = utils().sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });

  it('garde les href http(s)', () => {
    const input = '<a href="https://example.com" title="Lien">Test</a>';
    const result = utils().sanitizeHtml(input);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('title="Lien"');
  });

  it('ajoute rel="noopener noreferrer" aux liens target="_blank"', () => {
    const input = '<a href="https://example.com" target="_blank">Test</a>';
    const result = utils().sanitizeHtml(input);
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('garde les images avec src/alt', () => {
    const input = '<img src="photo.jpg" alt="Photo" width="200">';
    const result = utils().sanitizeHtml(input);
    expect(result).toContain('src="photo.jpg"');
    expect(result).toContain('alt="Photo"');
  });

  it('nettoie les styles dangereux (expression, javascript, url)', () => {
    const input = '<p style="color:red; background: url(evil.js)">Test</p>';
    const result = utils().sanitizeHtml(input);
    expect(result).toContain('color:red');
    expect(result).not.toContain('url(');
  });

  it('garde les balises de tableau', () => {
    const input = '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>';
    const result = utils().sanitizeHtml(input);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>');
    expect(result).toContain('<td>');
  });

  it('garde les balises de liste', () => {
    const input = '<ul><li>Un</li><li>Deux</li></ul>';
    const result = utils().sanitizeHtml(input);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });

  it('garde les titres h1-h6', () => {
    const input = '<h1>Titre</h1><h3>Sous-titre</h3>';
    const result = utils().sanitizeHtml(input);
    expect(result).toContain('<h1>');
    expect(result).toContain('<h3>');
  });

  it('supprime les balises non-autorisées mais garde le contenu', () => {
    const input = '<marquee>Texte défilant</marquee>';
    const result = utils().sanitizeHtml(input);
    expect(result).not.toContain('<marquee');
    expect(result).toContain('Texte défilant');
  });
});

// ============================================================================
// VALIDATION
// ============================================================================

describe('hasValue', () => {
  it('retourne true pour une chaîne non-vide', () => {
    expect(utils().hasValue('hello')).toBe(true);
  });

  it('retourne true pour un nombre', () => {
    expect(utils().hasValue(42)).toBe(true);
  });

  it('retourne true pour 0', () => {
    expect(utils().hasValue(0)).toBe(true);
  });

  it('retourne true pour false', () => {
    expect(utils().hasValue(false)).toBe(true);
  });

  it('retourne false pour null', () => {
    expect(utils().hasValue(null)).toBe(false);
  });

  it('retourne false pour undefined', () => {
    expect(utils().hasValue(undefined)).toBe(false);
  });

  it('retourne false pour chaîne vide', () => {
    expect(utils().hasValue('')).toBe(false);
  });

  it('retourne false pour "null" (string)', () => {
    expect(utils().hasValue('null')).toBe(false);
  });

  it('retourne false pour des espaces uniquement', () => {
    expect(utils().hasValue('   ')).toBe(false);
  });

  it('retourne false pour un tab uniquement', () => {
    expect(utils().hasValue('\t')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('accepte un email valide simple', () => {
    expect(utils().isValidEmail('user@example.com')).toBe(true);
  });

  it('accepte un email avec sous-domaine', () => {
    expect(utils().isValidEmail('user@sub.example.com')).toBe(true);
  });

  it('accepte un email avec +', () => {
    expect(utils().isValidEmail('user+tag@example.com')).toBe(true);
  });

  it('accepte un email avec points', () => {
    expect(utils().isValidEmail('first.last@example.com')).toBe(true);
  });

  it('rejette sans @', () => {
    expect(utils().isValidEmail('userexample.com')).toBe(false);
  });

  it('rejette sans domaine', () => {
    expect(utils().isValidEmail('user@')).toBe(false);
  });

  it('rejette sans extension', () => {
    expect(utils().isValidEmail('user@example')).toBe(false);
  });

  it('rejette avec espace', () => {
    expect(utils().isValidEmail('user @example.com')).toBe(false);
  });

  it('rejette chaîne vide', () => {
    expect(utils().isValidEmail('')).toBe(false);
  });
});

describe('isValidDate', () => {
  it('accepte une date ISO valide', () => {
    expect(utils().isValidDate('2026-02-14')).toBe(true);
  });

  it('accepte une date ISO avec timestamp', () => {
    expect(utils().isValidDate('2026-02-14T10:30:00Z')).toBe(true);
  });

  it('rejette un format invalide', () => {
    expect(utils().isValidDate('14/02/2026')).toBe(false);
  });

  it('rejette une date inexistante', () => {
    // new Date('2026-13-45') retourne Invalid Date
    expect(utils().isValidDate('2026-13-45')).toBe(false);
  });

  it('rejette une chaîne aléatoire', () => {
    expect(utils().isValidDate('hello')).toBe(false);
  });

  it('rejette une chaîne vide', () => {
    expect(utils().isValidDate('')).toBe(false);
  });
});

// ============================================================================
// HELPERS
// ============================================================================

describe('generateId', () => {
  it('génère un ID avec préfixe par défaut "id"', () => {
    const id = utils().generateId();
    expect(id).toMatch(/^id_\d+_[a-z0-9]+$/);
  });

  it('génère un ID avec préfixe personnalisé', () => {
    const id = utils().generateId('teacher');
    expect(id).toMatch(/^teacher_\d+_[a-z0-9]+$/);
  });

  it('génère des IDs uniques', () => {
    const id1 = utils().generateId();
    const id2 = utils().generateId();
    expect(id1).not.toBe(id2);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retarde l\'exécution de la fonction', () => {
    const fn = vi.fn();
    const debounced = utils().debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ne s\'exécute qu\'une fois si appelée plusieurs fois rapidement', () => {
    const fn = vi.fn();
    const debounced = utils().debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reset le timer à chaque appel', () => {
    const fn = vi.fn();
    const debounced = utils().debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced(); // reset le timer
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled(); // seulement 50ms depuis le dernier appel

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passe les arguments correctement', () => {
    const fn = vi.fn();
    const debounced = utils().debounce(fn, 100);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('préserve le contexte this', () => {
    let capturedThis = null;
    const fn = function () { capturedThis = this; };
    const debounced = utils().debounce(fn, 100);

    const obj = { call: debounced };
    obj.call();
    vi.advanceTimersByTime(100);

    expect(capturedThis).toBe(obj);
  });
});

// ============================================================================
// LAZY LOADING
// ============================================================================

describe('loadScript', () => {
  it('crée un élément script dans le head', async () => {
    const initialScripts = document.head.querySelectorAll('script').length;

    // Lancer le chargement (ne résoudra pas car jsdom ne charge pas réellement)
    const promise = utils().loadScript('https://example.com/test.js');

    const scripts = document.head.querySelectorAll('script');
    expect(scripts.length).toBe(initialScripts + 1);

    const lastScript = scripts[scripts.length - 1];
    expect(lastScript.src).toContain('example.com/test.js');
  });

  it('retourne la même Promise si appelée 2 fois avec la même URL', () => {
    const p1 = utils().loadScript('https://example.com/cached.js');
    const p2 = utils().loadScript('https://example.com/cached.js');
    expect(p1).toBe(p2);
  });
});

describe('loadStylesheet', () => {
  it('crée un élément link dans le head', () => {
    const initialLinks = document.head.querySelectorAll('link[rel="stylesheet"]').length;

    utils().loadStylesheet('https://example.com/style.css');

    const links = document.head.querySelectorAll('link[rel="stylesheet"]');
    expect(links.length).toBe(initialLinks + 1);

    const lastLink = links[links.length - 1];
    expect(lastLink.href).toContain('example.com/style.css');
  });

  it('retourne la même Promise si appelée 2 fois avec la même URL', () => {
    const p1 = utils().loadStylesheet('https://example.com/cached.css');
    const p2 = utils().loadStylesheet('https://example.com/cached.css');
    expect(p1).toBe(p2);
  });
});

// ============================================================================
// EDGE CASES / ROBUSTESSE
// ============================================================================

describe('Robustesse — Entrées inattendues', () => {
  it('escapeHtml gère un nombre', () => {
    expect(utils().escapeHtml(123)).toBe('123');
  });

  it('escapeHtml gère un booléen', () => {
    expect(utils().escapeHtml(true)).toBe('true');
  });

  it('formatDate gère une date invalide sans crash', () => {
    // new Date('invalid') → NaN → toLocaleDateString retourne "Invalid Date" ou vide
    const result = utils().formatDate('not-a-date');
    expect(typeof result).toBe('string');
  });

  it('parsePrice gère le format français (virgule = décimale)', () => {
    // parsePrice est conçu pour le format FR : "1 250,50 €" → 1250.5
    // Le format US "$1,500.00" n'est pas supporté (comma = decimal separator)
    expect(utils().parsePrice('1 250,50 €')).toBe(1250.5);
    expect(utils().parsePrice('99,99 €')).toBe(99.99);
  });

  it('generateId retourne toujours une chaîne non-vide', () => {
    for (let i = 0; i < 10; i++) {
      const id = utils().generateId();
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('hasValue distingue 0 de "vide"', () => {
    expect(utils().hasValue(0)).toBe(true);
    expect(utils().hasValue('0')).toBe(true);
    expect(utils().hasValue('')).toBe(false);
  });
});
