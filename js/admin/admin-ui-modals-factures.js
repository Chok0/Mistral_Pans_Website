/* MISTRAL PANS - Admin UI - Modals Factures */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-modals-factures] AdminUI non disponible, module différé');
    return;
  }

  const { $, $$, escapeHtml, formatPrice, formatDate, isValidEmail, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers;
  const { getModalState, clearModalState, showModal, closeModal, withSaveGuard } = window.AdminUI;

  // CRUD Factures
  function editFacture(id) {
    if (typeof MistralGestion === 'undefined') return;
    const facture = MistralGestion.Factures.get(id);
    if (!facture) return;

    $('#modal-facture-title').textContent = 'Modifier la facture';
    $('#facture-id').value = facture.id;

    // Client
    const client = MistralGestion.Clients.get(facture.client_id);
    if (client) {
      $('#facture-client-search').value = `${client.prenom} ${client.nom}`;
      $('#facture-client-id').value = client.id;
    }

    $('#facture-date').value = facture.date_emission || '';
    $('#facture-type').value = facture.type || 'vente';
    $('#facture-paiement-statut').value = facture.statut_paiement || 'en_attente';
    $('#facture-echeance').value = facture.date_echeance || '';
    $('#facture-notes').value = facture.notes || '';

    // Avoir lié : afficher la bannière et verrouiller le type
    if (facture.type === 'avoir' && facture.facture_origine_id) {
      const origFacture = MistralGestion.Factures.get(facture.facture_origine_id);
      const avoirInfo = $('#facture-avoir-info');
      if (avoirInfo) {
        avoirInfo.style.display = 'block';
        $('#facture-avoir-ref').textContent = origFacture ? origFacture.numero : facture.facture_origine_id;
      }
      $('#facture-origine-id').value = facture.facture_origine_id;
      $('#facture-classification-origine').value = facture.classification_origine || '';
      $('#facture-type').disabled = true;
    } else {
      resetAvoirUI();
    }

    // Lignes
    renderFactureLignes(facture.lignes || []);
    updateFactureTotaux();

    showModal('facture');
  }

  function saveFacture() {
    if (typeof MistralGestion === 'undefined') return;

    const id = $('#facture-id')?.value;
    const clientId = $('#facture-client-id')?.value;

    if (!clientId) {
      Toast.error('Client requis');
      return;
    }

    // Collecter les lignes et les IDs d'instruments liés
    const lignes = [];
    const instrumentIds = [];
    $$('#facture-lignes .facture-ligne').forEach(row => {
      const desc = row.querySelector('[name="ligne-desc"]')?.value.trim();
      const qte = parseInt(row.querySelector('[name="ligne-qte"]')?.value) || 1;
      const pu = parseFloat(row.querySelector('[name="ligne-pu"]')?.value) || 0;
      if (desc && pu > 0) {
        const ligne = { description: desc, quantite: qte, prix_unitaire: pu };
        // Récupérer l'ID d'instrument si présent
        if (row.dataset.instrumentId) {
          ligne.instrument_id = row.dataset.instrumentId;
          instrumentIds.push(row.dataset.instrumentId);
        }
        lignes.push(ligne);
      }
    });

    const montantHT = lignes.reduce((sum, l) => sum + (l.quantite * l.prix_unitaire), 0);
    const typeFacture = $('#facture-type')?.value || 'vente';
    const statutPaiement = $('#facture-paiement-statut')?.value || 'en_attente';

    // Champs avoir lié (si présents)
    const factureOrigineId = $('#facture-origine-id')?.value || null;
    const classificationOrigine = $('#facture-classification-origine')?.value || null;

    const data = {
      client_id: clientId,
      date_emission: $('#facture-date')?.value || new Date().toISOString().split('T')[0],
      type: typeFacture,
      lignes: lignes,
      instrument_ids: instrumentIds, // Stocker les IDs d'instruments liés
      montant_ht: montantHT,
      montant_ttc: montantHT, // Pas de TVA (auto-entrepreneur)
      statut_paiement: statutPaiement,
      date_echeance: $('#facture-echeance')?.value || null,
      notes: $('#facture-notes')?.value.trim(),
      facture_origine_id: factureOrigineId,
      classification_origine: classificationOrigine
    };

    try {
      if (id) {
        MistralGestion.Factures.update(id, data);
        Toast.success('Facture modifiée');
      } else {
        MistralGestion.Factures.create(data);
        Toast.success('Facture créée');
      }
    } catch (e) {
      Toast.error(e.message);
      return;
    }

    // Si c'est une vente payée, marquer les instruments comme vendus
    if (typeFacture === 'vente' && statutPaiement === 'paye' && instrumentIds.length > 0) {
      instrumentIds.forEach(instrumentId => {
        if (AdminUI.finaliserVenteInstrument) AdminUI.finaliserVenteInstrument(instrumentId);
      });
    }

    // Reset de l'instrument en vente (scopé au modal facture)
    getModalState('facture').instrumentEnVente = null;

    closeModal('facture');
    AdminUI.renderFactures();
    AdminUI.refreshDashboard();

    // Reset
    $('#facture-id').value = '';
    $('#facture-client-id').value = '';
    $('#modal-facture-title').textContent = 'Nouvelle facture';
    $('#form-facture').reset();
    resetAvoirUI();
    renderFactureLignes([]);
  }

  function addFactureLigne() {
    const container = $('#facture-lignes');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'facture-ligne';
    row.innerHTML = `
      <textarea name="ligne-desc" placeholder="Description" class="admin-form__input facture-ligne__desc" rows="1"></textarea>
      <input type="number" name="ligne-qte" value="1" min="1" class="admin-form__input" data-action="update-facture-totaux" data-on="change">
      <input type="number" name="ligne-pu" placeholder="P.U." min="0" step="0.01" class="admin-form__input" data-action="update-facture-totaux" data-on="change">
      <input type="text" name="ligne-total" readonly class="admin-form__input" style="background: var(--admin-border);">
      <button type="button" class="facture-ligne__remove" data-action="remove-facture-ligne-and-recalc">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    container.appendChild(row);

    // Auto-resize textarea
    const textarea = row.querySelector('textarea');
    textarea.addEventListener('input', autoResizeTextarea);
  }

  /**
   * Ajoute une ligne de facture pré-remplie avec les données d'un instrument
   * @param {string} instrumentId - ID de l'instrument à ajouter
   */
  function addFactureLigneFromInstrument(instrumentId) {
    if (typeof MistralGestion === 'undefined') {
      Toast.error('Module gestion non chargé');
      return;
    }

    const instrument = MistralGestion.Instruments.get(instrumentId);
    if (!instrument) {
      Toast.error('Instrument non trouvé');
      return;
    }

    const container = $('#facture-lignes');
    if (!container) return;

    // Construire la description
    const nom = instrument.nom || `${instrument.tonalite || ''} ${instrument.gamme || ''}`.trim() || 'Handpan';
    const specs = [];
    if (instrument.nombre_notes) specs.push(`${instrument.nombre_notes} notes`);
    if (instrument.taille) specs.push(`${instrument.taille}cm`);
    if (instrument.materiau) specs.push(instrument.materiau);
    const description = specs.length > 0 ? `${nom} (${specs.join(', ')})` : nom;

    const prix = instrument.prix_vente || 0;
    const total = formatPrice(prix);

    const row = document.createElement('div');
    row.className = 'facture-ligne';
    row.dataset.instrumentId = instrumentId; // Stocker l'ID pour le lien
    row.innerHTML = `
      <textarea name="ligne-desc" class="admin-form__input facture-ligne__desc" rows="1">${escapeHtml(description)}</textarea>
      <input type="number" name="ligne-qte" value="1" min="1" class="admin-form__input" data-action="update-facture-totaux" data-on="change">
      <input type="number" name="ligne-pu" value="${prix}" min="0" step="0.01" class="admin-form__input" data-action="update-facture-totaux" data-on="change">
      <input type="text" name="ligne-total" readonly value="${total}" class="admin-form__input" style="background: var(--admin-border);">
      <button type="button" class="facture-ligne__remove" data-action="remove-facture-ligne-and-recalc">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    container.appendChild(row);

    // Auto-resize textarea
    const textarea = row.querySelector('textarea');
    textarea.addEventListener('input', autoResizeTextarea);

    // Mettre à jour les totaux
    updateFactureTotaux();

    Toast.success('Instrument ajouté à la facture');
  }

  function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
  }

  function renderFactureLignes(lignes) {
    const container = $('#facture-lignes');
    if (!container) return;

    container.innerHTML = '';

    if (!lignes.length) {
      addFactureLigne();
      return;
    }

    lignes.forEach(l => {
      const row = document.createElement('div');
      row.className = 'facture-ligne';
      row.innerHTML = `
        <textarea name="ligne-desc" class="admin-form__input facture-ligne__desc" rows="1">${escapeHtml(l.description || '')}</textarea>
        <input type="number" name="ligne-qte" value="${l.quantite || 1}" min="1" class="admin-form__input" data-action="update-facture-totaux" data-on="change">
        <input type="number" name="ligne-pu" value="${l.prix_unitaire || 0}" min="0" step="0.01" class="admin-form__input" data-action="update-facture-totaux" data-on="change">
        <input type="text" name="ligne-total" readonly value="${formatPrice((l.quantite || 1) * (l.prix_unitaire || 0))}" class="admin-form__input" style="background: var(--admin-border);">
        <button type="button" class="facture-ligne__remove" data-action="remove-facture-ligne-and-recalc">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      container.appendChild(row);

      // Auto-resize textarea si contenu multiligne
      const textarea = row.querySelector('textarea');
      textarea.addEventListener('input', autoResizeTextarea);
      // Trigger initial resize
      if (l.description && l.description.includes('\n')) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
      }
    });
  }

  function updateFactureTotaux() {
    let total = 0;
    $$('#facture-lignes .facture-ligne').forEach(row => {
      const qte = parseInt(row.querySelector('[name="ligne-qte"]')?.value) || 0;
      const pu = parseFloat(row.querySelector('[name="ligne-pu"]')?.value) || 0;
      const ligneTotal = qte * pu;
      row.querySelector('[name="ligne-total"]').value = formatPrice(ligneTotal);
      total += ligneTotal;
    });

    $('#facture-total-ht').textContent = formatPrice(total);
    $('#facture-total-ttc').textContent = formatPrice(total);
  }

  function updateFactureEcheance() {
    const dateEmission = $('#facture-date')?.value;
    if (dateEmission) {
      const date = new Date(dateEmission);
      date.setDate(date.getDate() + 30); // +30 jours
      const echeance = date.toISOString().split('T')[0];
      if ($('#facture-echeance')) {
        $('#facture-echeance').value = echeance;
      }
    }
  }

  function downloadFacture(id) {
    if (typeof MistralGestionPDF === 'undefined') {
      Toast.error('Module PDF non chargé');
      return;
    }

    try {
      const result = MistralGestionPDF.generateFacture(id);
      if (!result) {
        Toast.error('Erreur lors de la génération du PDF');
      }
    } catch (error) {
      console.error('[downloadFacture] Erreur:', error);
      Toast.error(`Erreur PDF: ${error.message || 'Génération impossible'}`);
    }
  }

  function marquerPayee(id) {
    if (typeof MistralGestion !== 'undefined') {
      const facture = MistralGestion.Factures.get(id);

      MistralGestion.Factures.update(id, {
        statut_paiement: 'paye',
        date_paiement: new Date().toISOString().split('T')[0]
      });

      // Si c'est une vente avec des instruments liés, les marquer comme vendus
      if (facture && facture.type === 'vente') {
        const instrumentIds = facture.instrument_ids || [];
        // Aussi vérifier les IDs dans les lignes (rétrocompatibilité)
        if (facture.lignes) {
          facture.lignes.forEach(ligne => {
            if (ligne.instrument_id && !instrumentIds.includes(ligne.instrument_id)) {
              instrumentIds.push(ligne.instrument_id);
            }
          });
        }

        if (instrumentIds.length > 0) {
          instrumentIds.forEach(instrumentId => {
            if (AdminUI.finaliserVenteInstrument) AdminUI.finaliserVenteInstrument(instrumentId);
          });
        }
      }

      AdminUI.renderFactures();
      AdminUI.renderInstruments();
      AdminUI.refreshDashboard();
      Toast.success('Facture marquée comme payée');
    }
  }

  /**
   * Envoyer une facture par email au client
   * Utilise l'API Brevo via Netlify Function
   */
  async function envoyerFactureMail(id) {
    if (typeof MistralGestion === 'undefined') return;

    const facture = MistralGestion.Factures.get(id);
    if (!facture) {
      Toast.error('Facture non trouvée');
      return;
    }

    const client = MistralGestion.Clients.get(facture.client_id);
    if (!client) {
      Toast.error('Client non trouvé');
      return;
    }

    if (!client.email) {
      Toast.error('Ce client n\'a pas d\'adresse email');
      return;
    }

    // Demander confirmation
    const confirmed = await Confirm.show({
      title: 'Envoyer la facture',
      message: `Envoyer la facture ${facture.numero} à ${client.email} ?`,
      confirmText: 'Envoyer',
      type: 'primary'
    });

    if (!confirmed) return;

    Toast.info('Préparation de l\'envoi...');

    try {
      // Générer le PDF en base64
      let pdfBase64 = null;
      if (typeof MistralPDF !== 'undefined' && MistralPDF.generateFacturePDF) {
        const doc = MistralPDF.generateFacturePDF(facture);
        if (doc) {
          // Extraire le base64 du data URI
          const dataUri = doc.output('datauristring');
          pdfBase64 = dataUri.split(',')[1]; // Retirer le préfixe "data:application/pdf;base64,"
        }
      }

      // Appeler l'API d'envoi
      const response = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailType: 'invoice',
          client: {
            email: client.email,
            prenom: client.prenom,
            nom: client.nom
          },
          facture: {
            numero: facture.numero,
            montant_ttc: facture.montant_ttc || facture.total,
            date_emission: facture.date_emission || facture.date,
            date_echeance: facture.date_echeance
          },
          pdfBase64: pdfBase64
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erreur lors de l\'envoi');
      }

      // Enregistrer la date d'envoi dans la facture
      MistralGestion.Factures.update(id, {
        date_envoi: new Date().toISOString(),
        email_envoye: true
      });

      AdminUI.renderFactures();
      Toast.success(`Facture envoyée à ${client.email}`);

    } catch (error) {
      console.error('Erreur envoi facture:', error);

      // Fallback : ouvrir le client email local
      const useFallback = await Confirm.show({
        title: 'Erreur d\'envoi',
        message: `L'envoi automatique a échoué (${error.message}). Voulez-vous ouvrir votre client email à la place ?`,
        confirmText: 'Ouvrir email',
        cancelText: 'Annuler',
        type: 'warning'
      });

      if (useFallback) {
        const subject = encodeURIComponent(`Facture ${facture.numero} - Mistral Pans`);
        const body = encodeURIComponent(
          `Bonjour ${client.prenom},\n\n` +
          `Veuillez trouver ci-joint la facture ${facture.numero} d'un montant de ${formatPrice(facture.montant_ttc || facture.total || 0)}.\n\n` +
          `Merci de votre confiance.\n\nCordialement,\nMistral Pans`
        );
        window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, '_blank');
        Toast.info('Client email ouvert - Pensez à joindre le PDF !');
      }
    }
  }

  async function annulerFacture(id) {
    const confirmed = await Confirm.show({
      title: 'Annuler la facture',
      message: 'Cette facture sera marquée comme annulée. Cette action est irréversible.',
      confirmText: 'Annuler la facture',
      type: 'danger'
    });

    if (confirmed && typeof MistralGestion !== 'undefined') {
      MistralGestion.Factures.update(id, {
        statut: 'annulee',
        date_annulation: new Date().toISOString().split('T')[0]
      });
      AdminUI.renderFactures();
      AdminUI.refreshDashboard();
      Toast.info('Facture annulée');
    }
  }

  // ============================================================================
  // AVOIR LIÉ
  // ============================================================================

  /**
   * Classification URSSAF pour déterminer classification_origine des avoirs.
   * Copie locale (le mapping principal est dans admin-ui-compta.js).
   */
  const AVOIR_CLASSIFICATION = {
    'vente': 'BIC_VENTES',
    'acompte': 'BIC_VENTES',
    'solde': 'BIC_VENTES',
    'location': 'BIC_PRESTATIONS',
    'reaccordage': 'BIC_PRESTATIONS',
    'prestation': 'BNC'
  };

  /**
   * Reset le UI spécifique aux avoirs (bannière, hidden fields, select)
   */
  function resetAvoirUI() {
    const avoirInfo = $('#facture-avoir-info');
    if (avoirInfo) avoirInfo.style.display = 'none';
    if ($('#facture-origine-id')) $('#facture-origine-id').value = '';
    if ($('#facture-classification-origine')) $('#facture-classification-origine').value = '';
    if ($('#facture-type')) $('#facture-type').disabled = false;
  }

  /**
   * Émet un avoir lié à une facture existante.
   * Ouvre la modale facture pré-remplie avec les données de la facture d'origine.
   * @param {string} factureOrigineId - ID de la facture d'origine
   */
  function emettreAvoir(factureOrigineId) {
    if (typeof MistralGestion === 'undefined') return;

    const factureOrigine = MistralGestion.Factures.get(factureOrigineId);
    if (!factureOrigine) {
      Toast.error('Facture originale non trouvée');
      return;
    }

    if (factureOrigine.statut === 'annulee') {
      Toast.error('Impossible : cette facture est annulée');
      return;
    }

    if (factureOrigine.type === 'avoir') {
      Toast.error('Impossible : cette facture est déjà un avoir');
      return;
    }

    // Déterminer la classification URSSAF de la facture d'origine
    const classificationOrigine = AVOIR_CLASSIFICATION[factureOrigine.type] || 'BIC_VENTES';

    // Reset le formulaire
    $('#facture-id').value = '';
    $('#facture-client-id').value = '';
    $('#form-facture').reset();

    // Titre
    $('#modal-facture-title').textContent = 'Émettre un avoir';

    // Bannière info
    const avoirInfo = $('#facture-avoir-info');
    if (avoirInfo) {
      avoirInfo.style.display = 'block';
      $('#facture-avoir-ref').textContent = factureOrigine.numero || factureOrigineId;
    }

    // Hidden fields
    $('#facture-origine-id').value = factureOrigineId;
    $('#facture-classification-origine').value = classificationOrigine;

    // Pré-remplir le client
    const client = MistralGestion.Clients.get(factureOrigine.client_id);
    if (client) {
      $('#facture-client-search').value = `${client.prenom || ''} ${client.nom || ''}`.trim();
      $('#facture-client-id').value = client.id;
    }

    // Type verrouillé sur "avoir"
    // Ajouter temporairement l'option avoir si elle n'existe pas dans le select
    const typeSelect = $('#facture-type');
    if (typeSelect) {
      let avoirOption = typeSelect.querySelector('option[value="avoir"]');
      if (!avoirOption) {
        avoirOption = document.createElement('option');
        avoirOption.value = 'avoir';
        avoirOption.textContent = 'Avoir';
        typeSelect.appendChild(avoirOption);
      }
      typeSelect.value = 'avoir';
      typeSelect.disabled = true;
    }

    // Date du jour
    $('#facture-date').value = new Date().toISOString().split('T')[0];

    // Pré-remplir les lignes depuis la facture d'origine
    const lignes = (factureOrigine.lignes || []).map(l => ({
      description: `[AVOIR] ${l.description || ''}`,
      quantite: l.quantite || 1,
      prix_unitaire: l.prix_unitaire || 0
    }));

    // Ouvrir la modale puis remplir les lignes
    showModal('facture');

    setTimeout(() => {
      renderFactureLignes(lignes);
      updateFactureTotaux();
      Toast.info('Modifiez les montants si avoir partiel');
    }, 100);
  }

  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    editFacture,
    saveFacture: withSaveGuard('facture', saveFacture),
    downloadFacture,
    envoyerFactureMail,
    marquerPayee,
    annulerFacture,
    addFactureLigne,
    addFactureLigneFromInstrument,
    updateFactureTotaux,
    updateFactureEcheance,
    renderFactureLignes,
    emettreAvoir
  });

})(window);
