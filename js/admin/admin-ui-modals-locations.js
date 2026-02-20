/* MISTRAL PANS - Admin UI - Modals Locations */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-modals-locations] AdminUI non disponible, module différé');
    return;
  }

  const { $, escapeHtml, formatPrice, formatDate, isValidEmail, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers;
  const { getModalState, clearModalState, showModal, closeModal, withSaveGuard } = window.AdminUI;

  // CRUD Locations
  function editLocation(id) {
    if (typeof MistralGestion === 'undefined') return;
    const location = MistralGestion.Locations.get(id);
    if (!location) return;

    $('#modal-location-title').textContent = 'Modifier la location';
    $('#location-id').value = location.id;

    // Client
    const client = MistralGestion.Clients.get(location.client_id);
    if (client) {
      $('#location-client-search').value = `${client.prenom} ${client.nom}`;
      $('#location-client-id').value = client.id;
    }

    // Instrument
    const instrument = MistralGestion.Instruments.get(location.instrument_id);
    if (instrument) {
      $('#location-instrument-search').value = instrument.nom;
      $('#location-instrument-id').value = instrument.id;
    }

    $('#location-date-debut').value = location.date_debut || '';
    $('#location-mode').value = location.mode_location || 'local';
    $('#location-loyer').value = location.loyer_mensuel || 50;
    $('#location-caution').value = location.montant_caution || 1150;
    $('#location-caution-statut').value = location.caution_statut || 'en_attente';
    $('#location-statut').value = location.statut || 'en_cours';
    $('#location-notes').value = location.notes || '';

    showModal('location');
  }

  function saveLocation() {
    if (typeof MistralGestion === 'undefined') return;

    const id = $('#location-id')?.value;
    const clientId = $('#location-client-id')?.value;
    const instrumentId = $('#location-instrument-id')?.value;

    if (!clientId || !instrumentId) {
      Toast.error('Client et instrument requis');
      return;
    }

    const data = {
      client_id: clientId,
      instrument_id: instrumentId,
      date_debut: $('#location-date-debut')?.value,
      mode_location: $('#location-mode')?.value || 'local',
      loyer_mensuel: parseFloat($('#location-loyer')?.value) || 50,
      montant_caution: parseFloat($('#location-caution')?.value) || 1150,
      caution_statut: $('#location-caution-statut')?.value || 'en_attente',
      statut: $('#location-statut')?.value || 'en_cours',
      notes: $('#location-notes')?.value.trim()
    };

    try {
      if (id) {
        MistralGestion.Locations.update(id, data);
        Toast.success('Location modifiée');
      } else {
        MistralGestion.Locations.create(data);
        MistralGestion.Instruments.update(instrumentId, { statut: 'en_location' });
        Toast.success('Location créée');
      }
    } catch (e) {
      Toast.error(e.message);
      return;
    }

    closeModal('location');
    AdminUI.renderLocations();
    AdminUI.renderInstruments();
    AdminUI.refreshDashboard();

    // Reset
    $('#location-id').value = '';
    $('#location-client-id').value = '';
    $('#location-instrument-id').value = '';
    $('#modal-location-title').textContent = 'Nouvelle location';
    $('#form-location').reset();
  }

  async function terminerLocation(id) {
    const confirmed = await Confirm.show({
      title: 'Terminer la location',
      message: 'Marquer cette location comme terminée et restituer la caution ?',
      confirmText: 'Terminer'
    });

    if (confirmed && typeof MistralGestion !== 'undefined') {
      const location = MistralGestion.Locations.get(id);

      MistralGestion.Locations.update(id, {
        statut: 'terminee',
        date_fin_effective: new Date().toISOString().split('T')[0],
        caution_statut: 'restituee'
      });

      // Remettre l'instrument en disponible
      if (location && location.instrument_id) {
        MistralGestion.Instruments.update(location.instrument_id, { statut: 'disponible' });
      }

      AdminUI.renderLocations();
      AdminUI.renderInstruments();
      AdminUI.refreshDashboard();
      Toast.success('Location terminée');
    }
  }

  async function deleteLocation(id) {
    if (typeof MistralGestion === 'undefined') return;

    const location = MistralGestion.Locations.get(id);
    if (!location) return;

    // Check if location is in progress
    if (location.statut === 'en_cours') {
      Toast.error('Impossible de supprimer une location en cours. Terminez-la d\'abord.');
      return;
    }

    const confirmed = await Confirm.show({
      title: 'Supprimer la location',
      message: 'Voulez-vous vraiment supprimer cette location ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      type: 'danger'
    });

    if (confirmed) {
      MistralGestion.Locations.delete(id);
      AdminUI.renderLocations();
      AdminUI.refreshDashboard();
      Toast.success('Location supprimée');
    }
  }

  function downloadContrat(id) {
    if (typeof MistralGestionPDF === 'undefined') {
      Toast.error('Module PDF non chargé');
      return;
    }

    try {
      const result = MistralGestionPDF.generateContrat(id);
      if (!result) {
        Toast.error('Erreur lors de la génération du contrat');
      }
    } catch (error) {
      console.error('[downloadContrat] Erreur:', error);
      Toast.error(`Erreur PDF: ${error.message || 'Génération impossible'}`);
    }
  }

  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    editLocation,
    saveLocation: withSaveGuard('location', saveLocation),
    terminerLocation,
    deleteLocation,
    downloadContrat
  });

})(window);
