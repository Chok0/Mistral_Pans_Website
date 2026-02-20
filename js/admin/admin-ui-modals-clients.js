/* MISTRAL PANS - Admin UI - Modals Clients */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-modals-clients] AdminUI non disponible, module différé');
    return;
  }

  const { $, escapeHtml, formatPrice, formatDate, isValidEmail, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers;
  const { getModalState, clearModalState, showModal, closeModal, showModalWithData, withSaveGuard } = window.AdminUI;

  // CRUD Clients
  function editClient(id) {
    if (typeof MistralGestion === 'undefined') return;
    const client = MistralGestion.Clients.get(id);
    if (!client) return;

    $('#modal-client-title').textContent = 'Modifier le client';
    $('#client-id').value = client.id;
    $('#client-prenom').value = client.prenom || '';
    $('#client-nom').value = client.nom || '';
    $('#client-email').value = client.email || '';
    $('#client-telephone').value = client.telephone || '';
    $('#client-adresse').value = client.adresse || '';
    $('#client-notes').value = client.notes || '';

    showModal('client');
  }

  async function deleteClient(id) {
    if (typeof MistralGestion === 'undefined') return;

    // Vérifier si le client a des factures associées
    const factures = MistralGestion.Factures.list().filter(f => f.client_id === id);

    if (factures.length > 0) {
      // Archiver au lieu de supprimer
      const confirmed = await Confirm.show({
        title: 'Archiver le client',
        message: `Ce client a ${factures.length} facture(s) associée(s).\n\nIl sera archivé (masqué des listes) mais ses données seront conservées.`,
        confirmText: 'Archiver',
        type: 'warning'
      });

      if (confirmed) {
        MistralGestion.Clients.update(id, { archived: true, archived_at: new Date().toISOString() });
        AdminUI.renderClients();
        AdminUI.refreshDashboard();
        Toast.info('Client archivé');
      }
    } else {
      // Suppression normale
      const confirmed = await Confirm.show({
        title: 'Supprimer le client',
        message: 'Ce client n\'a aucune facture associée. Il sera définitivement supprimé.',
        confirmText: 'Supprimer',
        type: 'danger'
      });

      if (confirmed) {
        MistralGestion.Clients.delete(id);
        AdminUI.renderClients();
        AdminUI.refreshDashboard();
        Toast.success('Client supprimé');
      }
    }
  }

  async function unarchiveClient(id) {
    if (typeof MistralGestion === 'undefined') return;

    MistralGestion.Clients.update(id, { archived: false, archived_at: null });
    AdminUI.renderClients();
    Toast.success('Client restauré');
  }

  function saveClient() {
    if (typeof MistralGestion === 'undefined') return;

    const id = $('#client-id')?.value;
    const data = {
      prenom: $('#client-prenom')?.value.trim(),
      nom: $('#client-nom')?.value.trim(),
      email: $('#client-email')?.value.trim(),
      telephone: $('#client-telephone')?.value.trim(),
      adresse: $('#client-adresse')?.value.trim(),
      notes: $('#client-notes')?.value.trim()
    };

    if (!data.prenom || !data.nom) {
      Toast.error('Prénom et nom requis');
      return;
    }

    if (data.email && !isValidEmail(data.email)) {
      Toast.error('Format d\'email invalide');
      return;
    }

    let client;
    try {
      if (id) {
        client = MistralGestion.Clients.update(id, data);
        Toast.success('Client modifié');
      } else {
        client = MistralGestion.Clients.create(data);
        Toast.success('Client créé');
      }
    } catch (e) {
      Toast.error(e.message);
      return;
    }

    closeModal('client');
    AdminUI.renderClients();
    AdminUI.refreshDashboard();

    // Reset form
    $('#client-id').value = '';
    $('#modal-client-title').textContent = 'Nouveau client';
    $('#form-client').reset();

    // Si un callback est en attente (création depuis un autre modal)
    const clientState = getModalState('client');
    if (clientState.pendingCallback && client && !id) {
      clientState.pendingCallback(client);

      // Rouvrir le modal d'origine
      if (clientState.pendingSource) {
        showModalWithData(clientState.pendingSource);
        Toast.success(`Client créé et ajouté`);
      }

      // Reset
      clientState.pendingCallback = null;
      clientState.pendingSource = null;
    }
  }

  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    editClient,
    saveClient: withSaveGuard('client', saveClient),
    deleteClient,
    unarchiveClient
  });

})(window);
