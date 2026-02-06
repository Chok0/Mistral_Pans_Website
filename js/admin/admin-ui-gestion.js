/* ==========================================================================
   MISTRAL PANS - Admin UI - Module Gestion
   Clients, Instruments, Locations, Commandes, Factures
   ========================================================================== */

(function(window) {
  'use strict';

  // Attendre que AdminUI soit disponible
  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-gestion] AdminUI non disponible, module différé');
    return;
  }

  // Destructure helpers with fallbacks
  const helpers = window.AdminUIHelpers || {};
  const $ = helpers.$ || ((sel) => document.querySelector(sel));
  const $$ = helpers.$$ || ((sel) => document.querySelectorAll(sel));
  const escapeHtml = helpers.escapeHtml || ((text) => { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; });
  const formatPrice = helpers.formatPrice || ((val) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(val || 0));
  const formatDate = helpers.formatDate || ((d) => d ? new Date(d).toLocaleDateString('fr-FR') : '-');
  const Toast = helpers.Toast || { success: console.log, error: console.error, info: console.log };
  const Confirm = helpers.Confirm || { show: async () => confirm('Confirmer ?') };
  const Modal = helpers.Modal || {};
  const Storage = helpers.Storage || { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } }, set: (k, v) => localStorage.setItem(k, JSON.stringify(v)) };

  function renderClients(query = '') {
    if (typeof MistralGestion === 'undefined') return;
    
    let clients = MistralGestion.Clients.list();
    
    // Filtrage
    if (query) {
      const q = query.toLowerCase();
      clients = clients.filter(c => 
        (c.nom && c.nom.toLowerCase().includes(q)) ||
        (c.prenom && c.prenom.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.telephone && c.telephone.includes(q))
      );
    }
    
    const tbody = $('#table-clients');
    const empty = $('#empty-clients');
    const container = tbody?.closest('.gestion-table-container');
    
    if (!clients.length) {
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      if (container) container.style.display = 'none';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    if (container) container.style.display = 'block';
    
    // Compter locations par client
    const locations = MistralGestion.Locations.list();
    
    tbody.innerHTML = clients.map(c => {
      const nbLocations = locations.filter(l => l.client_id === c.id).length;
      const creditFidelite = parseFloat(c.credit_fidelite) || 0;
      const isArchived = c.archived === true;
      
      return `
        <tr${isArchived ? ' style="opacity: 0.6;"' : ''}>
          <td>
            <strong>${escapeHtml(c.prenom)} ${escapeHtml(c.nom)}</strong>
            ${isArchived ? '<span class="admin-badge admin-badge--warning" style="margin-left: 0.5rem; font-size: 0.7rem;">Archivé</span>' : ''}
          </td>
          <td>${escapeHtml(c.email || '-')}</td>
          <td>${escapeHtml(c.telephone || '-')}</td>
          <td>${nbLocations}</td>
          <td>${creditFidelite > 0 ? `<span style="color:var(--admin-success);">${creditFidelite.toFixed(0)} €</span>` : '-'}</td>
          <td class="gestion-table__actions">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editClient('${c.id}')" title="Modifier">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            ${isArchived ? `
              <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.unarchiveClient('${c.id}')" title="Restaurer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            ` : `
              <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.deleteClient('${c.id}')" title="Supprimer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }

  function searchClients(query) {
    renderClients(query);
  }

  // ============================================================================
  // RENDER: INSTRUMENTS
  // ============================================================================

  function renderInstruments(query = '') {
    if (typeof MistralGestion === 'undefined') return;
    
    let instruments = MistralGestion.Instruments.list();
    
    if (query) {
      const q = query.toLowerCase();
      instruments = instruments.filter(i =>
        (i.reference && i.reference.toLowerCase().includes(q)) ||
        (i.nom && i.nom.toLowerCase().includes(q)) ||
        (i.gamme && i.gamme.toLowerCase().includes(q))
      );
    }
    
    const tbody = $('#table-instruments');
    const empty = $('#empty-instruments');
    const container = tbody?.closest('.gestion-table-container');
    
    if (!instruments.length) {
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      if (container) container.style.display = 'none';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    if (container) container.style.display = 'block';
    
    // Vérifier GestionBoutique pour le statut en ligne
    const hasBoutique = typeof GestionBoutique !== 'undefined';
    
    tbody.innerHTML = instruments.map(i => {
      const statutClass = {
        'disponible': 'success',
        'en_location': 'info',
        'vendu': 'neutral',
        'reserve': 'warning',
        'prete': 'info'
      }[i.statut] || 'neutral';
      
      const statutLabel = {
        'disponible': 'Disponible',
        'en_location': 'En location',
        'vendu': 'Vendu',
        'reserve': 'Réservé',
        'prete': 'Prêté'
      }[i.statut] || i.statut;
      
      // Boutique
      let boutiqueCell = '<span class="admin-badge admin-badge--neutral">—</span>';
      if (hasBoutique) {
        const estPublie = GestionBoutique.estPublie(i.id);
        if (estPublie) {
          boutiqueCell = `
            <span class="admin-badge admin-badge--success" style="cursor:pointer;" onclick="AdminUI.toggleBoutique('${i.id}')" title="Cliquer pour dépublier">
              En ligne
            </span>`;
        } else if (i.statut === 'disponible') {
          boutiqueCell = `
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.toggleBoutique('${i.id}')" title="Publier">
              Publier
            </button>`;
        }
      }
      
      // Déterminer si l'instrument peut être vendu
      const canSell = ['disponible', 'en_ligne', 'reserve'].includes(i.statut);

      return `
        <tr>
          <td><code>${escapeHtml(i.reference || '-')}</code></td>
          <td><strong>${escapeHtml(i.nom)}</strong></td>
          <td>${escapeHtml(i.gamme || '-')}</td>
          <td><span class="admin-badge admin-badge--${statutClass}">${statutLabel}</span></td>
          <td>${formatPrice(i.prix_vente)}</td>
          <td>${boutiqueCell}</td>
          <td class="gestion-table__actions">
            ${canSell ? `
              <button class="admin-btn admin-btn--primary admin-btn--sm" onclick="AdminUI.vendreInstrument('${i.id}')" title="Vendre cet instrument">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
              </button>
            ` : ''}
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editInstrument('${i.id}')" title="Modifier">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.deleteInstrument('${i.id}')" title="Supprimer">
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

  function searchInstruments(query) {
    renderInstruments(query);
  }

  async function toggleBoutique(instrumentId) {
    if (typeof GestionBoutique === 'undefined') {
      Toast.error('Module boutique non disponible');
      return;
    }
    
    const estPublie = GestionBoutique.estPublie(instrumentId);
    
    if (estPublie) {
      const confirmed = await Confirm.show({
        title: 'Dépublier',
        message: 'Retirer cet instrument de la boutique ?',
        confirmText: 'Dépublier'
      });
      
      if (confirmed) {
        GestionBoutique.depublierInstrument(instrumentId);
        renderInstruments();
        Toast.success('Instrument dépublié');
      }
    } else {
      GestionBoutique.publierInstrument(instrumentId);
      renderInstruments();
      Toast.success('Instrument publié sur la boutique');
    }
  }

  // ============================================================================
  // RENDER: LOCATIONS
  // ============================================================================

  function renderLocations() {
    if (typeof MistralGestion === 'undefined') return;
    
    const locations = MistralGestion.Locations.list();
    const tbody = $('#table-locations');
    const empty = $('#empty-locations');
    const container = tbody?.closest('.gestion-table-container');
    
    if (!locations.length) {
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      if (container) container.style.display = 'none';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    if (container) container.style.display = 'block';
    
    tbody.innerHTML = locations.map(l => {
      const client = MistralGestion.Clients.get(l.client_id);
      const instrument = MistralGestion.Instruments.get(l.instrument_id);
      
      const statutClass = l.statut === 'en_cours' ? 'success' : 'neutral';
      const statutLabel = l.statut === 'en_cours' ? 'En cours' : 'Terminée';
      
      const cautionClass = l.caution_statut === 'recue' ? 'success' : (l.caution_statut === 'restituee' ? 'neutral' : 'warning');
      const cautionLabel = {
        'recue': 'Reçue',
        'restituee': 'Restituée',
        'en_attente': 'En attente'
      }[l.caution_statut] || l.caution_statut || '-';
      
      const modeLabel = l.mode_location === 'distance' ? 'Distance' : 'Local';
      const modeClass = l.mode_location === 'distance' ? 'info' : 'neutral';
      
      return `
        <tr>
          <td>${client ? escapeHtml(`${client.prenom} ${client.nom}`) : '-'}</td>
          <td>${instrument ? escapeHtml(instrument.nom) : '-'}</td>
          <td>${formatDate(l.date_debut)}</td>
          <td><span class="admin-badge admin-badge--${modeClass}">${modeLabel}</span></td>
          <td>${formatPrice(l.loyer_mensuel)}/mois</td>
          <td><span class="admin-badge admin-badge--${cautionClass}">${cautionLabel}</span></td>
          <td><span class="admin-badge admin-badge--${statutClass}">${statutLabel}</span></td>
          <td class="gestion-table__actions">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.downloadContrat('${l.id}')" title="Télécharger contrat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editLocation('${l.id}')" title="Modifier">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            ${l.statut === 'en_cours' ? `
              <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.terminerLocation('${l.id}')" title="Terminer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            ` : `
              <button class="admin-btn admin-btn--ghost admin-btn--sm admin-btn--danger" onclick="AdminUI.deleteLocation('${l.id}')" title="Supprimer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }

  // ============================================================================
  // RENDER: COMMANDES
  // ============================================================================

  function renderCommandes() {
    if (typeof MistralGestion === 'undefined') return;
    
    const commandes = MistralGestion.Commandes.list();
    const tbody = $('#table-commandes');
    const empty = $('#empty-commandes');
    const container = tbody?.closest('.gestion-table-container');
    
    if (!commandes.length) {
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      if (container) container.style.display = 'none';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    if (container) container.style.display = 'block';
    
    tbody.innerHTML = commandes.map(cmd => {
      const client = MistralGestion.Clients.get(cmd.client_id);
      
      const statutClass = {
        'en_attente': 'warning',
        'en_fabrication': 'info',
        'pret': 'success',
        'livre': 'neutral',
        'annule': 'error'
      }[cmd.statut] || 'neutral';
      
      const statutLabel = {
        'en_attente': 'En attente',
        'en_fabrication': 'En fabrication',
        'pret': 'Prêt',
        'livre': 'Livré',
        'annule': 'Annulé'
      }[cmd.statut] || cmd.statut;
      
      const paiementClass = {
        'en_attente': 'warning',
        'partiel': 'info',
        'paye': 'success'
      }[cmd.statut_paiement] || 'neutral';
      
      const paiementLabel = {
        'en_attente': 'En attente',
        'partiel': 'Partiel',
        'paye': 'Payé'
      }[cmd.statut_paiement] || cmd.statut_paiement || '-';
      
      return `
        <tr>
          <td>${formatDate(cmd.date_commande)}</td>
          <td>${client ? escapeHtml(`${client.prenom} ${client.nom}`) : '-'}</td>
          <td>${escapeHtml(cmd.description || '-')}</td>
          <td>${formatPrice(cmd.montant_total)}</td>
          <td><span class="admin-badge admin-badge--${paiementClass}">${paiementLabel}</span></td>
          <td><span class="admin-badge admin-badge--${statutClass}">${statutLabel}</span></td>
          <td class="gestion-table__actions">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editCommande('${cmd.id}')" title="Modifier">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm admin-btn--danger" onclick="AdminUI.deleteCommande('${cmd.id}')" title="Supprimer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ============================================================================
  // RENDER: FACTURES
  // ============================================================================

  function renderFactures() {
    if (typeof MistralGestion === 'undefined') return;
    
    const factures = MistralGestion.Factures.list();
    const tbody = $('#table-factures');
    const empty = $('#empty-factures');
    const container = tbody?.closest('.gestion-table-container');
    
    if (!factures.length) {
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      if (container) container.style.display = 'none';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    if (container) container.style.display = 'block';
    
    tbody.innerHTML = factures.map(f => {
      const client = MistralGestion.Clients.get(f.client_id);
      
      const typeLabel = {
        'vente': 'Vente',
        'acompte': 'Acompte',
        'solde': 'Solde',
        'location': 'Location',
        'prestation': 'Prestation',
        'avoir': 'Avoir'
      }[f.type] || f.type;
      
      // Gérer le statut annulée
      let statutClass, statutLabel;
      if (f.statut === 'annulee') {
        statutClass = 'danger';
        statutLabel = 'Annulée';
      } else if (f.statut_paiement === 'paye') {
        statutClass = 'success';
        statutLabel = 'Payée';
      } else if (f.statut_paiement === 'partiel') {
        statutClass = 'info';
        statutLabel = 'Partiel';
      } else {
        statutClass = 'warning';
        statutLabel = 'En attente';
      }
      
      const isAnnulee = f.statut === 'annulee';
      
      return `
        <tr${isAnnulee ? ' style="opacity: 0.5;"' : ''}>
          <td><strong>${escapeHtml(f.numero)}</strong></td>
          <td>${formatDate(f.date_emission)}</td>
          <td>${client ? escapeHtml(`${client.prenom} ${client.nom}`) : '-'}</td>
          <td>${typeLabel}</td>
          <td>${isAnnulee ? `<s style="color:var(--admin-text-muted);">${formatPrice(f.montant_ttc || f.total || 0)}</s>` : formatPrice(f.montant_ttc || f.total || 0)}</td>
          <td><span class="admin-badge admin-badge--${statutClass}">${statutLabel}</span></td>
          <td class="gestion-table__actions">
            ${!isAnnulee ? `
              <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.downloadFacture('${f.id}')" title="Télécharger PDF">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.envoyerFactureMail('${f.id}')" title="Envoyer par email">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </button>
              <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editFacture('${f.id}')" title="Modifier">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              ${f.statut_paiement !== 'paye' ? `
                <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.marquerPayee('${f.id}')" title="Marquer payée">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
              ` : ''}
              <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.annulerFacture('${f.id}')" title="Annuler">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </button>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    renderClients,
    searchClients,
    renderInstruments,
    searchInstruments,
    toggleBoutique,
    renderLocations,
    renderCommandes,
    renderFactures
  });

  console.log('[admin-ui-gestion] Module chargé');

})(window);
