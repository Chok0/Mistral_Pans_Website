/* ==========================================================================
   MISTRAL PANS - Intégration Gestion ↔ Boutique
   Version 2.0 - Synchronisé via statut instrument
   
   Le système est maintenant simplifié:
   - instrument.statut === 'en_ligne' → visible dans la boutique
   - instrument.statut !== 'en_ligne' → pas visible
   ========================================================================== */

(function(window) {
  'use strict';

  const INSTRUMENTS_KEY = 'mistral_gestion_instruments';

  // ============================================================================
  // FONCTIONS PRINCIPALES
  // ============================================================================

  const GestionBoutique = {
    
    /**
     * Vérifie si un instrument est publié (en ligne)
     */
    estPublie(instrumentId) {
      try {
        const stored = localStorage.getItem(INSTRUMENTS_KEY);
        if (stored) {
          const instruments = JSON.parse(stored);
          const instrument = instruments.find(i => i.id === instrumentId);
          return instrument && instrument.statut === 'en_ligne';
        }
      } catch (e) {
        console.error('[Gestion-Boutique] Erreur:', e);
      }
      return false;
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
      try {
        const stored = localStorage.getItem(INSTRUMENTS_KEY);
        if (stored) {
          const instruments = JSON.parse(stored);
          const index = instruments.findIndex(i => i.id === instrumentId);
          if (index !== -1) {
            instruments[index].statut = statut;
            instruments[index].updated_at = new Date().toISOString();
            localStorage.setItem(INSTRUMENTS_KEY, JSON.stringify(instruments));
            
            // Notifier les autres composants
            window.dispatchEvent(new CustomEvent('instrumentStatutChange', { 
              detail: { id: instrumentId, statut: statut } 
            }));
            
            return true;
          }
        }
      } catch (e) {
        console.error('[Gestion-Boutique] Erreur changement statut:', e);
      }
      return false;
    },

    /**
     * Met à jour les données d'un instrument (appelé lors de l'édition)
     * Note: maintenant c'est juste un wrapper, la boutique lit directement les instruments
     */
    mettreAJourAnnonce(instrumentId) {
      // Rien à faire - la boutique lit directement les instruments
      // Cette fonction existe pour compatibilité avec le code existant
      console.log('[Gestion-Boutique] mettreAJourAnnonce appelé pour', instrumentId);
      
      // Déclencher un refresh de la boutique si elle est ouverte
      if (typeof BoutiqueAdmin !== 'undefined') {
        BoutiqueAdmin.renderFlashCards();
      }
      
      return true;
    },

    /**
     * Récupère tous les instruments publiés
     */
    getInstrumentsPublies() {
      try {
        const stored = localStorage.getItem(INSTRUMENTS_KEY);
        if (stored) {
          const instruments = JSON.parse(stored);
          return instruments.filter(i => i.statut === 'en_ligne');
        }
      } catch (e) {
        console.error('[Gestion-Boutique] Erreur:', e);
      }
      return [];
    },

    /**
     * Synchronise tout (pour compatibilité - ne fait plus rien de spécial)
     */
    synchroniserTout() {
      console.log('[Gestion-Boutique] synchroniserTout appelé');
      
      const publies = this.getInstrumentsPublies();
      
      // Déclencher un refresh
      if (typeof BoutiqueAdmin !== 'undefined') {
        BoutiqueAdmin.renderFlashCards();
      }
      
      return {
        total: publies.length,
        message: publies.length + ' instrument(s) en ligne'
      };
    },

    /**
     * Formate le matériau pour affichage
     */
    formatMateriau(code) {
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
