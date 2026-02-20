/**
 * 404.js — Easter egg : clic sur le handpan = wobble + son
 */
(function() {
  var hp = document.getElementById('handpan-404');
  if (!hp) return;

  hp.addEventListener('click', function() {
    hp.classList.remove('ping');
    void hp.offsetWidth; // force reflow
    hp.classList.add('ping');

    // Jouer une note si Web Audio dispo
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 293.66; // D4
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch(e) {}
  });
})();
