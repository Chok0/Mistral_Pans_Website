/* ==========================================================================
   MISTRAL PANS - CGV - Prix dynamiques
   Met a jour les montants des CGV depuis la config admin (Supabase).
   Les valeurs par defaut dans le HTML restent affichees tant que la
   config n'est pas chargee (pas de flash).
   ========================================================================== */

(function() {
  'use strict';

  window.addEventListener('mistral-sync-complete', function() {
    var config = MistralUtils.getTarifsPublics();

    // Tarification configurateur
    var prixNote = config.prixParNote;
    var bonusOct2 = config.bonusOctave2;
    var bonusBot = config.bonusBottoms;
    var malusMax = config.malusDifficulteDifficile;
    var loyer = config.loyerMensuel;
    var caution = config.montantCaution;
    var tauxAcompte = config.tauxAcompte;

    // Calculer le montant d'acompte type (9 notes, arrondi 5 EUR)
    var prixBase = Math.floor((9 * prixNote) / 5) * 5;
    var montantAcompte = Math.round(prixBase * tauxAcompte / 100);

    // Mise a jour DOM
    var el;
    el = document.getElementById('cgv-prix-note');
    if (el) el.textContent = prixNote;

    el = document.getElementById('cgv-bonus-octave2');
    if (el) el.textContent = bonusOct2;

    el = document.getElementById('cgv-bonus-bottoms');
    if (el) el.textContent = bonusBot;

    el = document.getElementById('cgv-malus-max');
    if (el) el.textContent = malusMax;

    el = document.getElementById('cgv-acompte');
    if (el) el.textContent = montantAcompte;

    el = document.getElementById('cgv-loyer');
    if (el) el.textContent = loyer;

    el = document.getElementById('cgv-caution');
    if (el) el.textContent = caution.toLocaleString('fr-FR');
  });
})();
