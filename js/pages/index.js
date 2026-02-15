// Gestion des boutons "Voir les instruments" selon le stock
(function() {
  function updateInstrumentsButtons() {
    var btnHero = document.getElementById('btn-hero-instruments');
    var btnCta = document.getElementById('btn-voir-instruments');

    var instruments = (window.MistralSync && MistralSync.hasKey('mistral_gestion_instruments'))
      ? MistralSync.getData('mistral_gestion_instruments')
      : [];
    var enLigne = instruments.filter(function(i) { return i.statut === 'en_ligne'; });

    if (enLigne.length === 0) {
      if (btnHero) {
        btnHero.href = 'boutique.html';
        btnHero.textContent = 'Configurer un instrument';
      }
      if (btnCta) {
        btnCta.href = 'boutique.html';
        btnCta.textContent = 'Configurer un instrument';
      }
    }
  }

  // Mettre a jour quand les donnees sont pretes
  window.addEventListener('mistral-sync-complete', updateInstrumentsButtons);

  // Aussi executer au chargement (au cas ou MistralSync est deja pret)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateInstrumentsButtons);
  } else {
    updateInstrumentsButtons();
  }
})();
