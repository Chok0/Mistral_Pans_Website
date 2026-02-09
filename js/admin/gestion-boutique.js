/* ==========================================================================
   MISTRAL PANS - Integration Gestion <-> Boutique
   Version 3.0 - Via MistralSync (in-memory + Supabase)

   Le systeme est maintenant simplifie:
   - instrument.statut === 'en_ligne' -> visible dans la boutique
   - instrument.statut !== 'en_ligne' -> pas visible
   ========================================================================== */

(function(window) {
  'use strict';

  const INSTRUMENTS_KEY = 'mistral_gestion_instruments';

  // ============================================================================
  // HELPERS
  // ============================================================================

  function getInstruments() {
    if (window.MistralSync && MistralSync.hasKey(INSTRUMENTS_KEY)) {
      return MistralSync.getData(INSTRUMENTS_KEY);
    }
    return [];
  }

  function setInstruments(instruments) {
    if (window.MistralSync && MistralSync.hasKey(INSTRUMENTS_KEY)) {
      return MistralSync.setData(INSTRUMENTS_KEY, instruments);
    }
    return false;
  }

  // ============================================================================
  // FONCTIONS PRINCIPALES
  // ============================================================================

  const GestionBoutique = {

    /**
     * Verifie si un instrument est publie (en ligne)
     */
    estPublie(instrumentId) {
      const instruments = getInstruments();
      const instrument = instruments.find(i => i.id === instrumentId);
      return instrument && instrument.statut === 'en_ligne';
    },

    /**
     * Publie un instrument (passe en statut 'en_ligne')
     */
    publier(instrumentId) {
      return this.changerStatut(instrumentId, 'en_ligne');
    },

    /**
     * Retire un instrument de la boutique (passe en statut 'disponible')
     */
    retirer(instrumentId) {
      return this.changerStatut(instrumentId, 'disponible');
    },

    /**
     * Change le statut d'un instrument
     */
    changerStatut(instrumentId, statut) {
      const instruments = getInstruments();
      const index = instruments.findIndex(i => i.id === instrumentId);

      if (index !== -1) {
        instruments[index].statut = statut;
        instruments[index].updated_at = new Date().toISOString();
        setInstruments(instruments);

        // Notifier les autres composants
        window.dispatchEvent(new CustomEvent('instrumentStatutChange', {
          detail: { id: instrumentId, statut: statut }
        }));

        return true;
      }
      return false;
    },

    /**
     * Met a jour les donnees d'un instrument (appele lors de l'edition)
     */
    mettreAJourAnnonce(instrumentId) {
      console.log('[Gestion-Boutique] mettreAJourAnnonce appele pour', instrumentId);

      if (typeof BoutiqueAdmin !== 'undefined') {
        BoutiqueAdmin.renderFlashCards();
      }

      return true;
    },

    /**
     * Recupere tous les instruments publies
     */
    getInstrumentsPublies() {
      return getInstruments().filter(i => i.statut === 'en_ligne');
    },

    /**
     * Synchronise tout (pour compatibilite)
     */
    synchroniserTout() {
      console.log('[Gestion-Boutique] synchroniserTout appele');

      const publies = this.getInstrumentsPublies();

      if (typeof BoutiqueAdmin !== 'undefined') {
        BoutiqueAdmin.renderFlashCards();
      }

      return {
        total: publies.length,
        message: publies.length + ' instrument(s) en ligne'
      };
    },

    /**
     * Formate le materiau pour affichage
     */
    formatMateriau(code) {
      if (typeof MistralMateriaux !== 'undefined') {
        return MistralMateriaux.getLabel(code, 'full');
      }
      const labels = {
        'NS': 'Acier nitrure',
        'ES': 'Ember Steel',
        'SS': 'Acier inoxydable'
      };
      return labels[code] || code;
    }
  };

  // Export
  window.GestionBoutique = GestionBoutique;

})(window);
