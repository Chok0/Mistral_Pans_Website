/* ==========================================================================
   MISTRAL PANS - UI de Gestion Administrative
   Interface utilisateur pour le module de gestion
   ========================================================================== */

(function(window) {
  'use strict';

  // Raccourcis
  const G = window.MistralGestion;
  const PDF = window.MistralPDF;

  // ============================================================================
  // UTILITAIRES UI
  // ============================================================================
  
  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return document.querySelectorAll(selector);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================
  
  function initNavigation() {
    $$('.gestion-nav__item').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        
        // Activer l'onglet
        $$('.gestion-nav__item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Afficher la section
        $$('.gestion-section').forEach(s => s.classList.remove('active'));
        $(`#section-${section}`).classList.add('active');
        
        // Rafraîchir les données
        refreshSection(section);
      });
    });
  }

  function refreshSection(section) {
    switch (section) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'clients':
        renderClients();
        break;
      case 'instruments':
        renderInstruments();
        break;
      case 'locations':
        renderLocations();
        break;
      case 'commandes':
        renderCommandes();
        break;
      case 'factures':
        renderFactures();
        break;
      case 'config':
        loadConfig();
        break;
    }
  }

  // ============================================================================
  // DASHBOARD
  // ============================================================================
  
  function renderDashboard() {
    // Stats
    $('#stat-revenus').textContent = G.utils.formatPrice(G.Stats.getRevenusMois());
    $('#stat-locations').textContent = G.Stats.getLocationsEnCours();
    $('#stat-commandes').textContent = G.Stats.getCommandesEnCours();
    $('#stat-factures').textContent = G.Stats.getFacturesEnAttente();
    
    // Badges navigation
    const locationsEnCours = G.Stats.getLocationsEnCours();
    const commandesEnCours = G.Stats.getCommandesEnCours();
    const facturesEnAttente = G.Stats.getFacturesEnAttente();
    
    updateBadge('locations', locationsEnCours);
    updateBadge('commandes', commandesEnCours);
    updateBadge('factures', facturesEnAttente);
    
    // Alertes
    const alertes = G.Stats.getAlertes();
    const alertsContainer = $('#dashboard-alerts');
    
    if (alertes.length === 0) {
      alertsContainer.innerHTML = '<p style="color: var(--admin-success);">✓ Aucune alerte</p>';
    } else {
      alertsContainer.innerHTML = alertes.map(a => `
        <div class="dashboard-alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>${escapeHtml(a.message)}</span>
        </div>
      `).join('');
    }
  }

  function updateBadge(name, count) {
    const badge = $(`#badge-${name}`);
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // ============================================================================
  // CLIENTS
  // ============================================================================
  
  function renderClients(query = '') {
    const clients = query ? G.Clients.search(query) : G.Clients.list();
    const tbody = $('#table-clients');
    const empty = $('#empty-clients');
    
    if (clients.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      tbody.parentElement.style.display = 'none';
      return;
    }
    
    empty.style.display = 'none';
    tbody.parentElement.style.display = 'block';
    
    tbody.innerHTML = clients.map(c => {
      const locations = G.Clients.getLocations(c.id);
      const locationsEnCours = locations.filter(l => l.statut === 'en_cours').length;
      
      return `
        <tr>
          <td><strong>${escapeHtml(c.prenom)} ${escapeHtml(c.nom)}</strong></td>
          <td>${escapeHtml(c.email)}</td>
          <td>${escapeHtml(c.telephone || '-')}</td>
          <td>${locationsEnCours > 0 ? `<span class="admin-badge admin-badge--info">${locationsEnCours} en cours</span>` : '-'}</td>
          <td class="gestion-table__actions">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.editClient('${c.id}')" title="Modifier">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.deleteClient('${c.id}')" title="Supprimer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function showClientModal(id = null) {
    const modal = $('#modal-client');
    const title = $('#modal-client-title');
    
    if (id) {
      const client = G.Clients.get(id);
      if (!client) return;
      
      title.textContent = 'Modifier le client';
      $('#client-id').value = client.id;
      $('#client-prenom').value = client.prenom || '';
      $('#client-nom').value = client.nom || '';
      $('#client-email').value = client.email || '';
      $('#client-telephone').value = client.telephone || '';
      $('#client-adresse').value = client.adresse || '';
      $('#client-notes').value = client.notes || '';
    } else {
      title.textContent = 'Nouveau client';
      $('#form-client').reset();
      $('#client-id').value = '';
    }
    
    modal.classList.add('open');
  }

  function saveClient() {
    const id = $('#client-id').value;
    const data = {
      prenom: $('#client-prenom').value.trim(),
      nom: $('#client-nom').value.trim(),
      email: $('#client-email').value.trim(),
      telephone: $('#client-telephone').value.trim(),
      adresse: $('#client-adresse').value.trim(),
      notes: $('#client-notes').value.trim()
    };
    
    if (!data.prenom || !data.nom || !data.email) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }
    
    if (id) {
      G.Clients.update(id, data);
    } else {
      G.Clients.create(data);
    }
    
    closeModal('client');
    renderClients();
  }

  function editClient(id) {
    showClientModal(id);
  }

  function deleteClient(id) {
    const client = G.Clients.get(id);
    if (!client) return;
    
    if (confirm(`Supprimer le client ${client.prenom} ${client.nom} ?`)) {
      G.Clients.delete(id);
      renderClients();
    }
  }

  // ============================================================================
  // INSTRUMENTS
  // ============================================================================
  
  function renderInstruments(query = '') {
    const instruments = query ? G.Instruments.search(query) : G.Instruments.list();
    const tbody = $('#table-instruments');
    const empty = $('#empty-instruments');
    
    if (instruments.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      tbody.parentElement.style.display = 'none';
      return;
    }
    
    empty.style.display = 'none';
    tbody.parentElement.style.display = 'block';
    
    // Vérifier si GestionBoutique est disponible
    const boutiqueDisponible = typeof GestionBoutique !== 'undefined';
    
    tbody.innerHTML = instruments.map(i => {
      const statutBadge = getStatutBadge('instrument', i.statut);
      
      // Statut boutique
      let boutiqueCell = '';
      if (boutiqueDisponible) {
        const estPublie = GestionBoutique.estPublie(i.id);
        if (estPublie) {
          boutiqueCell = `
            <span class="admin-badge admin-badge--success" style="cursor:pointer;" onclick="GestionUI.toggleBoutique('${i.id}')" title="Cliquer pour dépublier">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              En ligne
            </span>`;
        } else if (i.statut === 'disponible') {
          boutiqueCell = `
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.toggleBoutique('${i.id}')" title="Publier sur la boutique">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Publier
            </button>`;
        } else {
          boutiqueCell = `<span class="admin-badge admin-badge--neutral">—</span>`;
        }
      }
      
      return `
        <tr>
          <td><code style="font-size: 0.75rem;">${escapeHtml(i.reference)}</code></td>
          <td><strong>${escapeHtml(i.nom)}</strong></td>
          <td>${escapeHtml(i.gamme || '-')}</td>
          <td>${statutBadge}</td>
          <td>${G.utils.formatPrice(i.prix_vente)}</td>
          <td>${G.utils.formatPrice(i.prix_location_mensuel)}/mois</td>
          ${boutiqueDisponible ? `<td>${boutiqueCell}</td>` : ''}
          <td class="gestion-table__actions">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.editInstrument('${i.id}')" title="Modifier">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.deleteInstrument('${i.id}')" title="Supprimer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  function toggleBoutique(instrumentId) {
    if (typeof GestionBoutique === 'undefined') {
      alert('Module boutique non disponible');
      return;
    }
    
    const estPublie = GestionBoutique.estPublie(instrumentId);
    
    if (estPublie) {
      if (confirm('Dépublier cet instrument de la boutique ?')) {
        GestionBoutique.depublierInstrument(instrumentId);
        renderInstruments();
      }
    } else {
      GestionBoutique.publierInstrument(instrumentId);
      renderInstruments();
      alert('✅ Instrument publié sur la boutique !');
    }
  }

  function showInstrumentModal(id = null) {
    const modal = $('#modal-instrument');
    const title = $('#modal-instrument-title');
    const config = G.getConfig();
    
    if (id) {
      const instrument = G.Instruments.get(id);
      if (!instrument) return;
      
      title.textContent = 'Modifier l\'instrument';
      $('#instrument-id').value = instrument.id;
      $('#instrument-reference').value = instrument.reference || '';
      $('#instrument-nom').value = instrument.nom || '';
      $('#instrument-gamme').value = instrument.gamme || '';
      $('#instrument-notes').value = instrument.notes || '';
      $('#instrument-taille').value = instrument.taille || '';
      $('#instrument-accordage').value = instrument.accordage || '440';
      $('#instrument-materiau').value = instrument.materiau || '';
      $('#instrument-statut').value = instrument.statut || 'disponible';
      $('#instrument-prix_vente').value = instrument.prix_vente || '';
      $('#instrument-prix_location_mensuel').value = instrument.prix_location_mensuel || '';
      $('#instrument-montant_caution').value = instrument.montant_caution || '';
      $('#instrument-description').value = instrument.description || '';
    } else {
      title.textContent = 'Nouvel instrument';
      $('#form-instrument').reset();
      $('#instrument-id').value = '';
      $('#instrument-prix_location_mensuel').value = config.loyerMensuel || 50;
      $('#instrument-montant_caution').value = config.montantCaution || 1150;
    }
    
    modal.classList.add('open');
  }

  function saveInstrument() {
    const id = $('#instrument-id').value;
    const data = {
      reference: $('#instrument-reference').value.trim(),
      nom: $('#instrument-nom').value.trim(),
      gamme: $('#instrument-gamme').value.trim(),
      notes: $('#instrument-notes').value.trim(),
      taille: $('#instrument-taille').value ? parseInt($('#instrument-taille').value) : null,
      accordage: parseInt($('#instrument-accordage').value) || 440,
      materiau: $('#instrument-materiau').value.trim(),
      statut: $('#instrument-statut').value,
      prix_vente: $('#instrument-prix_vente').value,
      prix_location_mensuel: $('#instrument-prix_location_mensuel').value,
      montant_caution: $('#instrument-montant_caution').value,
      description: $('#instrument-description').value.trim()
    };
    
    if (!data.reference || !data.nom) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }
    
    if (id) {
      G.Instruments.update(id, data);
    } else {
      G.Instruments.create(data);
    }
    
    closeModal('instrument');
    renderInstruments();
  }

  function editInstrument(id) {
    showInstrumentModal(id);
  }

  function deleteInstrument(id) {
    const instrument = G.Instruments.get(id);
    if (!instrument) return;
    
    if (confirm(`Supprimer l'instrument ${instrument.nom} ?`)) {
      G.Instruments.delete(id);
      renderInstruments();
    }
  }

  // ============================================================================
  // LOCATIONS
  // ============================================================================
  
  function renderLocations(query = '') {
    const locations = G.Locations.list();
    const tbody = $('#table-locations');
    const empty = $('#empty-locations');
    
    if (locations.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      tbody.parentElement.style.display = 'none';
      return;
    }
    
    empty.style.display = 'none';
    tbody.parentElement.style.display = 'block';
    
    tbody.innerHTML = locations.map(l => {
      const client = G.Clients.get(l.client_id);
      const instrument = G.Instruments.get(l.instrument_id);
      const statutBadge = getStatutBadge('location', l.statut);
      const cautionBadge = getStatutBadge('caution', l.caution_statut);
      
      return `
        <tr>
          <td>${client ? escapeHtml(`${client.prenom} ${client.nom}`) : '-'}</td>
          <td>${instrument ? escapeHtml(instrument.nom) : '-'}</td>
          <td>${G.utils.formatDateShort(l.date_debut)}</td>
          <td><span class="admin-badge admin-badge--${l.mode_location === 'distance' ? 'info' : 'neutral'}">${l.mode_location === 'distance' ? 'Distance' : 'Local'}</span></td>
          <td>${G.utils.formatPrice(l.loyer_mensuel)}/mois</td>
          <td>${cautionBadge}</td>
          <td>${statutBadge}</td>
          <td class="gestion-table__actions">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.downloadContrat('${l.id}')" title="Télécharger contrat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.editLocation('${l.id}')" title="Modifier">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            ${l.statut === 'en_cours' ? `
              <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.terminerLocation('${l.id}')" title="Terminer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  function showLocationModal(id = null) {
    const modal = $('#modal-location');
    const title = $('#modal-location-title');
    const config = G.getConfig();
    
    // Initialiser les champs avec autocomplétion
    populateClientSearchable('#location-client_search', '#location-client_id');
    populateInstrumentSearchable('#location-instrument_search', '#location-instrument_id', true);
    
    if (id) {
      const location = G.Locations.get(id);
      if (!location) return;
      
      title.textContent = 'Modifier la location';
      $('#location-id').value = location.id;
      
      // Remplir les champs autocomplete
      setSearchableSelectValue('#location-client_search', '#location-client_id', location.client_id);
      setSearchableSelectValue('#location-instrument_search', '#location-instrument_id', location.instrument_id);
      
      $('#location-mode_location').value = location.mode_location || 'local';
      $('#location-date_debut').value = location.date_debut || '';
      $('#location-loyer_mensuel').value = location.loyer_mensuel || '';
      $('#location-montant_caution').value = location.montant_caution || '';
      $('#location-frais_dossier_transport').value = location.frais_dossier_transport || '';
      $('#location-accessoires').value = location.accessoires || '';
      $('#location-notes').value = location.notes || '';
    } else {
      title.textContent = 'Nouvelle location';
      $('#form-location').reset();
      $('#location-id').value = '';
      $('#location-client_search').value = '';
      $('#location-client_id').value = '';
      $('#location-instrument_search').value = '';
      $('#location-instrument_id').value = '';
      $('#location-date_debut').value = new Date().toISOString().split('T')[0];
      $('#location-loyer_mensuel').value = config.loyerMensuel || 50;
      $('#location-montant_caution').value = config.montantCaution || 1150;
      $('#location-frais_dossier_transport').value = config.fraisDossierTransport || 100;
    }
    
    updateLocationMode();
    modal.classList.add('open');
  }

  function updateLocationMode() {
    const mode = $('#location-mode_location').value;
    const fraisGroup = $('#group-frais-transport');
    
    if (mode === 'distance') {
      fraisGroup.style.display = 'block';
    } else {
      fraisGroup.style.display = 'none';
    }
  }

  function saveLocation() {
    const id = $('#location-id').value;
    const data = {
      client_id: $('#location-client_id').value,
      instrument_id: $('#location-instrument_id').value,
      mode_location: $('#location-mode_location').value,
      date_debut: $('#location-date_debut').value,
      loyer_mensuel: $('#location-loyer_mensuel').value,
      montant_caution: $('#location-montant_caution').value,
      accessoires: $('#location-accessoires').value.trim(),
      notes: $('#location-notes').value.trim()
    };
    
    if (!data.client_id || !data.instrument_id) {
      alert('Veuillez sélectionner un client et un instrument');
      return;
    }
    
    if (id) {
      G.Locations.update(id, data);
    } else {
      G.Locations.create(data);
    }
    
    closeModal('location');
    renderLocations();
    renderDashboard();
  }

  function editLocation(id) {
    showLocationModal(id);
  }

  function terminerLocation(id) {
    if (confirm('Terminer cette location ? L\'instrument sera remis en disponibilité.')) {
      G.Locations.terminer(id);
      renderLocations();
      renderInstruments();
      renderDashboard();
    }
  }

  function downloadContrat(id) {
    const location = G.Locations.get(id);
    if (location && PDF) {
      PDF.downloadContrat(location);
    }
  }

  // ============================================================================
  // COMMANDES
  // ============================================================================
  
  function renderCommandes(query = '') {
    const commandes = G.Commandes.list();
    const tbody = $('#table-commandes');
    const empty = $('#empty-commandes');
    
    if (commandes.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      tbody.parentElement.style.display = 'none';
      return;
    }
    
    empty.style.display = 'none';
    tbody.parentElement.style.display = 'block';
    
    tbody.innerHTML = commandes.map(c => {
      const client = G.Clients.get(c.client_id);
      const statutBadge = getStatutBadge('commande', c.statut);
      const solde = G.Commandes.getSoldeRestant(c.id);
      
      return `
        <tr>
          <td>${client ? escapeHtml(`${client.prenom} ${client.nom}`) : '-'}</td>
          <td>${escapeHtml(c.description ? c.description.substring(0, 50) + (c.description.length > 50 ? '...' : '') : '-')}</td>
          <td>${G.utils.formatDateShort(c.date_commande)}</td>
          <td>${G.utils.formatPrice(c.montant_total)}</td>
          <td>${G.utils.formatPrice(c.montant_paye)} <small style="color: var(--admin-text-muted);">(reste ${G.utils.formatPrice(solde)})</small></td>
          <td>${statutBadge}</td>
          <td class="gestion-table__actions">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.createAcompte('${c.id}')" title="Créer un acompte">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.editCommande('${c.id}')" title="Modifier">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function showCommandeModal(id = null) {
    const modal = $('#modal-commande');
    const title = $('#modal-commande-title');
    
    // Initialiser l'autocomplétion client
    populateClientSearchable('#commande-client_search', '#commande-client_id');
    
    if (id) {
      const commande = G.Commandes.get(id);
      if (!commande) return;
      
      title.textContent = 'Modifier la commande';
      $('#commande-id').value = commande.id;
      setSearchableSelectValue('#commande-client_search', '#commande-client_id', commande.client_id);
      $('#commande-description').value = commande.description || '';
      $('#commande-montant_total').value = commande.montant_total || '';
      $('#commande-statut').value = commande.statut || 'en_attente';
      $('#commande-date_livraison_prevue').value = commande.date_livraison_prevue || '';
      $('#commande-notes').value = commande.notes || '';
    } else {
      title.textContent = 'Nouvelle commande';
      $('#form-commande').reset();
      $('#commande-id').value = '';
      $('#commande-client_search').value = '';
      $('#commande-client_id').value = '';
    }
    
    modal.classList.add('open');
  }

  function saveCommande() {
    const id = $('#commande-id').value;
    const data = {
      client_id: $('#commande-client_id').value,
      description: $('#commande-description').value.trim(),
      montant_total: $('#commande-montant_total').value,
      statut: $('#commande-statut').value,
      date_livraison_prevue: $('#commande-date_livraison_prevue').value || null,
      notes: $('#commande-notes').value.trim()
    };
    
    if (!data.client_id || !data.description || !data.montant_total) {
      alert('Veuillez remplir les champs obligatoires');
      return;
    }
    
    if (id) {
      G.Commandes.update(id, data);
    } else {
      G.Commandes.create(data);
    }
    
    closeModal('commande');
    renderCommandes();
    renderDashboard();
  }

  function editCommande(id) {
    showCommandeModal(id);
  }

  function createAcompte(commandeId) {
    const commande = G.Commandes.get(commandeId);
    if (!commande) return;
    
    // Ouvrir le modal facture en mode acompte
    showFactureModal();
    $('#facture-type').value = 'acompte';
    $('#facture-client_id').value = commande.client_id;
    $('#facture-commande_id').value = commandeId;
    updateFactureType();
  }

  // ============================================================================
  // FACTURES
  // ============================================================================
  
  let factureLignes = [];

  function renderFactures(query = '') {
    const factures = G.Factures.list();
    const tbody = $('#table-factures');
    const empty = $('#empty-factures');
    
    if (factures.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      tbody.parentElement.style.display = 'none';
      return;
    }
    
    empty.style.display = 'none';
    tbody.parentElement.style.display = 'block';
    
    // Trier par date décroissante
    const sorted = [...factures].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = sorted.map(f => {
      const client = G.Clients.get(f.client_id);
      const statutBadge = getStatutBadge('paiement', f.statut_paiement);
      const typeBadge = `<span class="admin-badge admin-badge--neutral">${G.CONFIG.TYPES_FACTURE[f.type] || f.type}</span>`;
      
      return `
        <tr>
          <td><strong>${escapeHtml(f.numero)}</strong></td>
          <td>${G.utils.formatDateShort(f.date)}</td>
          <td>${client ? escapeHtml(`${client.prenom} ${client.nom}`) : '-'}</td>
          <td>${typeBadge}</td>
          <td>${G.utils.formatPrice(f.total)}</td>
          <td>${statutBadge}</td>
          <td class="gestion-table__actions">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.downloadFacture('${f.id}')" title="Télécharger PDF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            ${f.statut_paiement !== 'paye' ? `
              <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.marquerPayee('${f.id}')" title="Marquer payée">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  function showFactureModal(id = null) {
    const modal = $('#modal-facture');
    const title = $('#modal-facture-title');
    
    // Initialiser l'autocomplétion client
    populateClientSearchable('#facture-client_search', '#facture-client_id');
    populateCommandeSelect('#facture-commande_id');
    populateLocationSelect('#facture-location_id');
    
    factureLignes = [];
    
    if (id) {
      // TODO: Mode édition
    } else {
      title.textContent = 'Nouvelle facture';
      $('#form-facture').reset();
      $('#facture-id').value = '';
      $('#facture-client_search').value = '';
      $('#facture-client_id').value = '';
      $('#facture-date').value = new Date().toISOString().split('T')[0];
      
      // Ajouter une ligne par défaut
      addFactureLigne();
    }
    
    updateFactureType();
    updateFactureTotaux();
    modal.classList.add('open');
  }

  function updateFactureType() {
    const type = $('#facture-type').value;
    const groupCommande = $('#group-commande');
    const groupLocation = $('#group-location');
    
    groupCommande.style.display = (type === 'acompte' || type === 'solde') ? 'block' : 'none';
    groupLocation.style.display = (type === 'location') ? 'block' : 'none';
  }

  function addFactureLigne(data = {}) {
    const container = $('#facture-lignes');
    const index = factureLignes.length;
    
    factureLignes.push({
      description: data.description || '',
      quantite: data.quantite || 1,
      prix_unitaire: data.prix_unitaire || 0
    });
    
    const row = document.createElement('div');
    row.className = 'form-row';
    row.style.marginBottom = '0.5rem';
    row.innerHTML = `
      <div class="admin-form__group" style="flex: 3;">
        <input type="text" class="admin-form__input" placeholder="Description" 
               onchange="GestionUI.updateLigne(${index}, 'description', this.value)"
               value="${escapeHtml(data.description || '')}">
      </div>
      <div class="admin-form__group" style="flex: 1;">
        <input type="number" class="admin-form__input" placeholder="Qté" min="1"
               onchange="GestionUI.updateLigne(${index}, 'quantite', this.value)"
               value="${data.quantite || 1}">
      </div>
      <div class="admin-form__group" style="flex: 1;">
        <input type="number" class="admin-form__input" placeholder="P.U." step="0.01"
               onchange="GestionUI.updateLigne(${index}, 'prix_unitaire', this.value)"
               value="${data.prix_unitaire || ''}">
      </div>
      <button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" onclick="GestionUI.removeLigne(${index})" style="align-self: center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    
    container.appendChild(row);
  }

  function updateLigne(index, field, value) {
    if (factureLignes[index]) {
      factureLignes[index][field] = field === 'quantite' ? parseInt(value) || 1 : value;
      updateFactureTotaux();
    }
  }

  function removeLigne(index) {
    factureLignes.splice(index, 1);
    renderFactureLignes();
    updateFactureTotaux();
  }

  function renderFactureLignes() {
    const container = $('#facture-lignes');
    container.innerHTML = '';
    const lignesCopy = [...factureLignes];
    factureLignes = [];
    lignesCopy.forEach(l => addFactureLigne(l));
  }

  function updateFactureTotaux() {
    const sousTotal = factureLignes.reduce((sum, l) => {
      return sum + (l.quantite || 1) * (G.utils.parsePrice(l.prix_unitaire) || 0);
    }, 0);
    
    // TODO: Calculer les acomptes pour les factures de solde
    const acomptes = 0;
    const total = sousTotal - acomptes;
    
    $('#facture-sous-total').textContent = G.utils.formatPrice(sousTotal);
    $('#facture-acomptes').textContent = `- ${G.utils.formatPrice(acomptes)}`;
    $('#facture-total').textContent = G.utils.formatPrice(total);
  }

  function saveFacture() {
    const data = {
      type: $('#facture-type').value,
      date: $('#facture-date').value,
      client_id: $('#facture-client_id').value,
      commande_id: $('#facture-commande_id').value || null,
      location_id: $('#facture-location_id').value || null,
      lignes: factureLignes.filter(l => l.description && l.prix_unitaire)
    };
    
    if (!data.client_id) {
      alert('Veuillez sélectionner un client');
      return;
    }
    
    if (data.lignes.length === 0) {
      alert('Veuillez ajouter au moins une ligne');
      return;
    }
    
    const facture = G.Factures.create(data);
    
    closeModal('facture');
    renderFactures();
    renderDashboard();
    
    // Proposer de télécharger
    if (confirm('Facture créée ! Voulez-vous télécharger le PDF ?')) {
      downloadFacture(facture.id);
    }
  }

  function previewFacture() {
    const data = {
      numero: 'PREVIEW',
      type: $('#facture-type').value,
      date: $('#facture-date').value || new Date().toISOString().split('T')[0],
      client_id: $('#facture-client_id').value,
      lignes: factureLignes.filter(l => l.description && l.prix_unitaire).map(l => ({
        ...l,
        total: (l.quantite || 1) * (G.utils.parsePrice(l.prix_unitaire) || 0)
      })),
      sous_total: factureLignes.reduce((sum, l) => sum + (l.quantite || 1) * (G.utils.parsePrice(l.prix_unitaire) || 0), 0),
      acomptes_deduits: 0,
      total: factureLignes.reduce((sum, l) => sum + (l.quantite || 1) * (G.utils.parsePrice(l.prix_unitaire) || 0), 0)
    };
    
    if (PDF) {
      PDF.previewFacture(data);
    }
  }

  function downloadFacture(id) {
    const facture = G.Factures.get(id);
    if (facture && PDF) {
      PDF.downloadFacture(facture);
    }
  }

  function marquerPayee(id) {
    if (confirm('Marquer cette facture comme payée ?')) {
      G.Factures.marquerPayee(id);
      renderFactures();
      renderDashboard();
    }
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  function loadConfig() {
    const config = G.getConfig();
    
    $('#config-nom').value = config.nom || '';
    $('#config-marque').value = config.marque || '';
    $('#config-adresse').value = config.adresse || '';
    $('#config-codePostal').value = config.codePostal || '';
    $('#config-ville').value = config.ville || '';
    $('#config-siret').value = config.siret || '';
    $('#config-email').value = config.email || '';
    $('#config-telephone').value = config.telephone || '';
    $('#config-iban').value = config.iban || '';
    $('#config-bic').value = config.bic || '';
    $('#config-banque').value = config.banque || '';
    $('#config-dernier_numero_facture').value = config.dernier_numero_facture || '';
    $('#config-loyerMensuel').value = config.loyerMensuel || '';
    $('#config-montantCaution').value = config.montantCaution || '';
    $('#config-fraisDossierTransport').value = config.fraisDossierTransport || '';
  }

  function saveConfig() {
    const fields = ['nom', 'marque', 'adresse', 'codePostal', 'ville', 'siret', 'email', 'telephone', 
                    'iban', 'bic', 'banque', 'dernier_numero_facture', 'loyerMensuel', 'montantCaution', 'fraisDossierTransport'];
    
    fields.forEach(field => {
      const value = $(`#config-${field}`).value;
      G.setConfigValue(field, value);
    });
    
    alert('Configuration enregistrée');
  }

  // ============================================================================
  // HELPERS
  // ============================================================================
  
  function getStatutBadge(type, statut) {
    const statuts = G.CONFIG.STATUTS[type];
    const label = statuts ? statuts[statut] || statut : statut;
    
    let variant = 'neutral';
    switch (statut) {
      case 'disponible':
      case 'paye':
      case 'restituee':
      case 'terminee':
      case 'livre':
        variant = 'success';
        break;
      case 'en_cours':
      case 'en_location':
      case 'en_fabrication':
      case 'recue':
        variant = 'info';
        break;
      case 'en_attente':
      case 'partiel':
      case 'pret':
        variant = 'warning';
        break;
      case 'annulee':
      case 'annule':
      case 'encaissee':
        variant = 'error';
        break;
    }
    
    return `<span class="admin-badge admin-badge--${variant}">${escapeHtml(label)}</span>`;
  }

  // ============================================================================
  // COMPOSANT SEARCHABLE SELECT (Autocomplétion)
  // ============================================================================
  
  function initSearchableSelect(inputSelector, hiddenSelector, items, options = {}) {
    const input = $(inputSelector);
    const hidden = $(hiddenSelector);
    if (!input || !hidden) return;
    
    const placeholder = options.placeholder || 'Rechercher...';
    const displayField = options.displayField || 'label';
    
    // Créer le conteneur dropdown
    let dropdown = input.parentElement.querySelector('.searchable-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'searchable-dropdown';
      input.parentElement.style.position = 'relative';
      input.parentElement.appendChild(dropdown);
    }
    
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    
    // Stocker les items pour référence
    input._items = items;
    input._hiddenInput = hidden;
    input._dropdown = dropdown;
    input._displayField = displayField;
    
    // Event: focus -> afficher dropdown
    input.addEventListener('focus', () => {
      showDropdown(input, items);
    });
    
    // Event: input -> filtrer
    input.addEventListener('input', () => {
      const query = input.value.toLowerCase();
      const filtered = items.filter(item => {
        const searchText = (item.searchText || item[displayField] || '').toLowerCase();
        return searchText.includes(query);
      });
      showDropdown(input, filtered);
      
      // Si la valeur ne correspond plus à un item, vider le hidden
      if (!items.find(i => i[displayField] === input.value)) {
        hidden.value = '';
      }
    });
    
    // Event: blur -> fermer dropdown (avec délai pour permettre le clic)
    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.remove('open');
      }, 200);
    });
    
    // Event: keydown -> navigation clavier
    input.addEventListener('keydown', (e) => {
      const visibleItems = dropdown.querySelectorAll('.searchable-dropdown__item:not(.hidden)');
      const activeItem = dropdown.querySelector('.searchable-dropdown__item.active');
      let activeIndex = Array.from(visibleItems).indexOf(activeItem);
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, visibleItems.length - 1);
        visibleItems.forEach((item, i) => item.classList.toggle('active', i === activeIndex));
        visibleItems[activeIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        visibleItems.forEach((item, i) => item.classList.toggle('active', i === activeIndex));
        visibleItems[activeIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeItem) {
          selectItem(input, activeItem._itemData);
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('open');
        input.blur();
      }
    });
  }
  
  function showDropdown(input, items) {
    const dropdown = input._dropdown;
    const displayField = input._displayField;
    
    dropdown.innerHTML = items.length === 0 
      ? '<div class="searchable-dropdown__empty">Aucun résultat</div>'
      : items.map((item, index) => {
          const label = item[displayField] || '';
          const subtitle = item.subtitle || '';
          return `<div class="searchable-dropdown__item${index === 0 ? ' active' : ''}" data-index="${index}">
            <div class="searchable-dropdown__label">${escapeHtml(label)}</div>
            ${subtitle ? `<div class="searchable-dropdown__subtitle">${escapeHtml(subtitle)}</div>` : ''}
          </div>`;
        }).join('');
    
    // Attacher les données aux éléments
    dropdown.querySelectorAll('.searchable-dropdown__item').forEach((el, i) => {
      el._itemData = items[i];
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectItem(input, items[i]);
      });
      el.addEventListener('mouseenter', () => {
        dropdown.querySelectorAll('.searchable-dropdown__item').forEach(item => item.classList.remove('active'));
        el.classList.add('active');
      });
    });
    
    dropdown.classList.add('open');
  }
  
  function selectItem(input, item) {
    const displayField = input._displayField;
    input.value = item[displayField] || '';
    input._hiddenInput.value = item.id || '';
    input._dropdown.classList.remove('open');
    
    // Déclencher un event change sur le hidden
    input._hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  function setSearchableSelectValue(inputSelector, hiddenSelector, id) {
    const input = $(inputSelector);
    const hidden = $(hiddenSelector);
    if (!input || !hidden || !input._items) return;
    
    const item = input._items.find(i => i.id === id);
    if (item) {
      input.value = item[input._displayField] || '';
      hidden.value = id;
    } else {
      input.value = '';
      hidden.value = '';
    }
  }

  function populateClientSelect(selector) {
    const select = $(selector);
    const clients = G.Clients.list();
    
    // Si c'est un select classique, on garde l'ancien comportement
    if (select.tagName === 'SELECT') {
      select.innerHTML = '<option value="">Sélectionner un client</option>' +
        clients.map(c => `<option value="${c.id}">${escapeHtml(c.prenom)} ${escapeHtml(c.nom)}</option>`).join('');
    }
  }
  
  function populateClientSearchable(inputSelector, hiddenSelector) {
    const clients = G.Clients.list();
    const items = clients.map(c => ({
      id: c.id,
      label: `${c.prenom} ${c.nom}`,
      subtitle: c.email || c.telephone || '',
      searchText: `${c.prenom} ${c.nom} ${c.email || ''} ${c.telephone || ''}`
    }));
    
    initSearchableSelect(inputSelector, hiddenSelector, items, {
      placeholder: 'Rechercher un client (nom, email, tel)...',
      displayField: 'label'
    });
  }

  function populateInstrumentSelect(selector, onlyDisponibles = false) {
    const select = $(selector);
    const instruments = onlyDisponibles ? G.Instruments.listDisponibles() : G.Instruments.list();
    
    // Si c'est un select classique, on garde l'ancien comportement
    if (select.tagName === 'SELECT') {
      select.innerHTML = '<option value="">Sélectionner un instrument</option>' +
        instruments.map(i => `<option value="${i.id}">${escapeHtml(i.nom)} (${escapeHtml(i.reference)})</option>`).join('');
    }
  }
  
  function populateInstrumentSearchable(inputSelector, hiddenSelector, onlyDisponibles = false) {
    const instruments = onlyDisponibles ? G.Instruments.listDisponibles() : G.Instruments.list();
    const items = instruments.map(i => ({
      id: i.id,
      label: `${i.reference}`,
      subtitle: `${i.nom} - ${i.gamme || ''} ${i.taille ? i.taille + 'cm' : ''}`,
      searchText: `${i.reference} ${i.nom} ${i.gamme || ''} ${i.notes || ''}`
    }));
    
    initSearchableSelect(inputSelector, hiddenSelector, items, {
      placeholder: 'Rechercher par référence, gamme, nom...',
      displayField: 'label'
    });
  }

  function populateCommandeSelect(selector) {
    const select = $(selector);
    const commandes = G.Commandes.listEnCours();
    
    select.innerHTML = '<option value="">Sélectionner une commande</option>' +
      commandes.map(c => {
        const client = G.Clients.get(c.client_id);
        const clientNom = client ? `${client.prenom} ${client.nom}` : 'Client';
        return `<option value="${c.id}">${escapeHtml(clientNom)} - ${G.utils.formatPrice(c.montant_total)}</option>`;
      }).join('');
  }

  function populateLocationSelect(selector) {
    const select = $(selector);
    const locations = G.Locations.listEnCours();
    
    select.innerHTML = '<option value="">Sélectionner une location</option>' +
      locations.map(l => {
        const client = G.Clients.get(l.client_id);
        const instrument = G.Instruments.get(l.instrument_id);
        return `<option value="${l.id}">${client ? escapeHtml(`${client.prenom} ${client.nom}`) : 'Client'} - ${instrument ? escapeHtml(instrument.nom) : 'Instrument'}</option>`;
      }).join('');
  }

  function closeModal(name) {
    $(`#modal-${name}`).classList.remove('open');
  }

  // ============================================================================
  // EXPORT / IMPORT
  // ============================================================================
  
  function exportData() {
    G.DataManager.downloadExport();
  }

  function showImportModal() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = G.DataManager.importAll(ev.target.result);
          if (result.success) {
            alert('Import réussi !');
            location.reload();
          } else {
            alert('Erreur lors de l\'import: ' + result.error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  // ============================================================================
  // RECHERCHE
  // ============================================================================
  
  function initSearch() {
    $('#search-clients')?.addEventListener('input', (e) => renderClients(e.target.value));
    $('#search-instruments')?.addEventListener('input', (e) => renderInstruments(e.target.value));
    // TODO: autres recherches
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================
  
  function init() {
    initNavigation();
    initSearch();
    renderDashboard();
    renderClients();
    renderInstruments();
    renderLocations();
    renderCommandes();
    renderFactures();
    loadConfig();
  }

  // Attendre que le DOM soit prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================
  
  window.GestionUI = {
    // Clients
    showClientModal,
    saveClient,
    editClient,
    deleteClient,
    
    // Instruments
    showInstrumentModal,
    saveInstrument,
    editInstrument,
    deleteInstrument,
    toggleBoutique,
    
    // Locations
    showLocationModal,
    saveLocation,
    editLocation,
    terminerLocation,
    downloadContrat,
    updateLocationMode,
    
    // Commandes
    showCommandeModal,
    saveCommande,
    editCommande,
    createAcompte,
    
    // Factures
    showFactureModal,
    saveFacture,
    previewFacture,
    downloadFacture,
    marquerPayee,
    updateFactureType,
    addFactureLigne,
    updateLigne,
    removeLigne,
    
    // Config
    saveConfig,
    
    // Modal
    closeModal,
    
    // Export/Import
    exportData,
    showImportModal
  };

  console.log('✅ GestionUI chargé');

})(window);
