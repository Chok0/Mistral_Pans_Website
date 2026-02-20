/* MISTRAL PANS - Admin UI - Modals Commandes */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-modals-commandes] AdminUI non disponible, module différé');
    return;
  }

  const { $, escapeHtml, formatPrice, formatDate, isValidEmail, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers;
  const { getModalState, clearModalState, showModal, closeModal, withSaveGuard } = window.AdminUI;

  // CRUD Commandes
  function editCommande(id) {
    if (typeof MistralGestion === 'undefined') return;
    const commande = MistralGestion.Commandes.get(id);
    if (!commande) return;

    $('#modal-commande-title').textContent = 'Modifier la commande';
    $('#commande-id').value = commande.id;

    // Client
    const client = MistralGestion.Clients.get(commande.client_id);
    if (client) {
      $('#commande-client-search').value = `${client.prenom} ${client.nom}`;
      $('#commande-client-id').value = client.id;
    }

    $('#commande-date').value = commande.date_commande || '';
    $('#commande-description').value = commande.description || '';
    $('#commande-montant').value = commande.montant_total || '';
    $('#commande-acompte').value = commande.acompte_verse || 0;
    $('#commande-paiement-statut').value = commande.statut_paiement || 'en_attente';
    $('#commande-statut').value = commande.statut || 'en_attente';
    if ($('#commande-tracking')) $('#commande-tracking').value = commande.tracking_number || '';
    if ($('#commande-delivery')) $('#commande-delivery').value = commande.estimated_delivery || '';
    $('#commande-notes').value = commande.notes || '';

    showModal('commande');
  }

  function saveCommande() {
    if (typeof MistralGestion === 'undefined') return;

    const id = $('#commande-id')?.value;
    const clientId = $('#commande-client-id')?.value;

    if (!clientId) {
      Toast.error('Client requis');
      return;
    }

    // Récupérer l'ancien statut pour détecter les transitions
    const oldCommande = id ? MistralGestion.Commandes.get(id) : null;
    const oldStatut = oldCommande?.statut || null;

    const data = {
      client_id: clientId,
      date_commande: $('#commande-date')?.value || new Date().toISOString().split('T')[0],
      description: $('#commande-description')?.value.trim(),
      montant_total: parseFloat($('#commande-montant')?.value) || 0,
      acompte_verse: parseFloat($('#commande-acompte')?.value) || 0,
      statut_paiement: $('#commande-paiement-statut')?.value || 'en_attente',
      statut: $('#commande-statut')?.value || 'en_attente',
      tracking_number: $('#commande-tracking')?.value.trim() || null,
      estimated_delivery: $('#commande-delivery')?.value.trim() || null,
      notes: $('#commande-notes')?.value.trim()
    };

    try {
      if (id) {
        MistralGestion.Commandes.update(id, data);
        Toast.success('Commande modifiée');
      } else {
        MistralGestion.Commandes.create(data);
        Toast.success('Commande créée');
      }
    } catch (e) {
      Toast.error(e.message);
      return;
    }

    // Automatisations lifecycle : détecter les transitions de statut
    if (id && oldStatut && oldStatut !== data.statut) {
      handleCommandeStatusTransition(id, oldStatut, data.statut, data, clientId);
    }

    closeModal('commande');
    AdminUI.renderCommandes();
    AdminUI.refreshDashboard();

    // Reset
    $('#commande-id').value = '';
    $('#commande-client-id').value = '';
    $('#modal-commande-title').textContent = 'Nouvelle commande';
    $('#form-commande').reset();
  }

  /**
   * Gère les actions automatiques lors d'un changement de statut de commande
   */
  async function handleCommandeStatusTransition(commandeId, oldStatut, newStatut, commandeData, clientId) {
    const client = MistralGestion.Clients.get(clientId);
    if (!client?.email) return;

    const commande = MistralGestion.Commandes.get(commandeId);
    const reference = commande?.reference || commande?.payplug_reference || commandeId;
    const productName = commande?.product_name || commande?.description || 'Handpan';

    // Helper: check if automation is enabled (via config)
    const isEnabled = (type) => {
      if (window.AdminUI?.isEmailAutomationEnabled) {
        return window.AdminUI.isEmailAutomationEnabled(type);
      }
      return true; // default enabled if config module not loaded
    };

    // Transition vers "prêt" → demande de solde (si paiement partiel)
    if (newStatut === 'pret' && commandeData.statut_paiement === 'partiel') {
      if (!isEnabled('balance_request')) {
        Toast.info('Email de demande de solde désactivé (config)');
        return;
      }
      const remainingAmount = (commandeData.montant_total || 0) - (commandeData.acompte_verse || 0);
      if (remainingAmount > 0) {
        try {
          const response = await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              emailType: 'balance_request',
              client: {
                email: client.email,
                prenom: client.prenom || client.nom?.split(' ')[0] || '',
                nom: client.nom || ''
              },
              order: {
                reference: reference,
                productName: productName
              },
              payment: {
                remainingAmount: remainingAmount,
                paymentUrl: null
              }
            })
          });
          if (response.ok) {
            Toast.success('Email de demande de solde envoyé à ' + client.email);
          } else {
            Toast.error('Erreur envoi email de solde');
          }
        } catch (err) {
          console.error('Erreur envoi email solde:', err);
          Toast.error('Erreur envoi email');
        }
      }
    }

    // Transition vers "expédié" → notification d'expédition
    if (newStatut === 'expedie' || newStatut === 'livre') {
      if (oldStatut !== 'expedie' && oldStatut !== 'livre') {
        if (!isEnabled('shipping_notification')) {
          Toast.info('Email d\'expédition désactivé (config)');
          return;
        }
        try {
          const response = await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              emailType: 'shipping_notification',
              client: {
                email: client.email,
                prenom: client.prenom || client.nom?.split(' ')[0] || '',
                nom: client.nom || ''
              },
              order: {
                reference: reference,
                productName: productName,
                trackingNumber: commande?.tracking_number || null,
                estimatedDelivery: commande?.estimated_delivery || null
              }
            })
          });
          if (response.ok) {
            Toast.success('Email d\'expédition envoyé à ' + client.email);
          } else {
            Toast.error('Erreur envoi email d\'expédition');
          }
        } catch (err) {
          console.error('Erreur envoi email expédition:', err);
          Toast.error('Erreur envoi email');
        }
      }
    }
  }

  async function deleteCommande(id) {
    if (typeof MistralGestion === 'undefined') return;

    const commande = MistralGestion.Commandes.get(id);
    if (!commande) return;

    // Check if commande has linked factures
    const factures = MistralGestion.Factures.list().filter(f => f.commande_id === id);

    if (factures.length > 0) {
      Toast.error(`Cette commande a ${factures.length} facture(s) associée(s). Supprimez-les d'abord.`);
      return;
    }

    const confirmed = await Confirm.show({
      title: 'Supprimer la commande',
      message: 'Voulez-vous vraiment supprimer cette commande ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      type: 'danger'
    });

    if (confirmed) {
      MistralGestion.Commandes.delete(id);
      AdminUI.renderCommandes();
      AdminUI.refreshDashboard();
      Toast.success('Commande supprimée');
    }
  }

  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    editCommande,
    saveCommande: withSaveGuard('commande', saveCommande),
    deleteCommande
  });

})(window);
