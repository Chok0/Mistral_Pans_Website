/**
 * Test setup — charge les modules IIFE dans le contexte JSDOM (window global).
 *
 * Vitest utilise jsdom, donc `window` et `document` existent.
 * Les fichiers source utilisent soit :
 * - Le pattern IIFE : (function(window) { window.Foo = ... })(window);
 * - Le pattern const : const Foo = (function() { return {...}; })();
 *
 * Pour le pattern const, on remplace `const X =` par `window.X =` afin
 * que le module soit accessible depuis les tests.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Charge un fichier JS dans le contexte global (window).
 * Gère les deux patterns (IIFE window et const global).
 * @param {string} relativePath - chemin relatif depuis la racine du projet
 */
function loadModule(relativePath) {
  let code = readFileSync(resolve(ROOT, relativePath), 'utf-8');

  // Transformer les `const X = (function()` en `window.X = (function()`
  // pour que les modules soient accessibles depuis les tests.
  code = code.replace(
    /^(const|let|var)\s+(\w+)\s*=\s*\(function\s*\(/gm,
    'window.$2 = (function('
  );

  const fn = new Function('window', 'document', code);
  fn(globalThis.window, globalThis.document);
}

// Charger les modules utilitaires
loadModule('js/core/utils.js');
loadModule('js/features/feasibility-module.js');
loadModule('js/data/scales-data.js');
