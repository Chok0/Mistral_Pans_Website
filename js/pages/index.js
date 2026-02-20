// Gestion des boutons "Voir les instruments" selon le stock
(function() {
  function updateInstrumentsButtons() {
    const btnHero = document.getElementById('btn-hero-instruments');
    const btnCta = document.getElementById('btn-voir-instruments');

    const instruments = (window.MistralSync && MistralSync.hasKey('mistral_gestion_instruments'))
      ? MistralSync.getData('mistral_gestion_instruments')
      : [];
    const enLigne = instruments.filter(function(i) { return i.statut === 'en_ligne'; });

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

  /**
   * Met a jour les prix affiches sur l'accueil depuis la config admin.
   * Loyer location + prix minimum configurateur (9 notes * prixParNote).
   */
  function updateDynamicPrices() {
    var config = MistralUtils.getTarifsPublics();

    var loyer = config.loyerMensuel;
    var prixParNote = config.prixParNote;
    var prixMin = Math.floor((9 * prixParNote) / 5) * 5;

    var elLoyer = document.getElementById('index-location-prix');
    if (elLoyer) elLoyer.textContent = 'Location \u00E0 ' + loyer + '\u20AC/mois';

    var elPrix = document.getElementById('index-boutique-prix');
    if (elPrix) elPrix.textContent = '\u00C0 partir de ' + prixMin.toLocaleString('fr-FR') + '\u20AC';
  }

  // Mettre a jour quand les donnees sont pretes
  window.addEventListener('mistral-sync-complete', function() {
    updateInstrumentsButtons();
    updateDynamicPrices();
  });

  // Aussi executer au chargement (au cas ou MistralSync est deja pret)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateInstrumentsButtons);
  } else {
    updateInstrumentsButtons();
  }
})();
