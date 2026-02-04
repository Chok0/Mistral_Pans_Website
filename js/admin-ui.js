/* ==========================================================================
   MISTRAL PANS - Admin UI
   Orchestration de la page d'administration unifiée
   ========================================================================== */

(function(window) {
  'use strict';

  // Vérifier les dépendances
  if (typeof MistralAdmin === 'undefined') {
    console.error('[Admin UI] MistralAdmin (admin-core.js) non chargé');
    return;
  }

  const { Auth, Storage, Modal, Toast, Confirm, utils } = MistralAdmin;

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CONFIG = {
    TODO_KEY: 'mistral_admin_todos',
    STORAGE_KEYS: MistralAdmin.CONFIG?.STORAGE_KEYS || {}
  };

  // ============================================================================
  // ÉTAT LOCAL
  // ============================================================================

  let currentSection = 'dashboard';
  let searchFilters = {};

  // ============================================================================
  // UTILITAIRES
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

  function formatPrice(value) {
    if (typeof MistralGestion !== 'undefined' && MistralGestion.utils) {
      return MistralGestion.utils.formatPrice(value);
    }
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value || 0);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    if (typeof MistralGestion !== 'undefined' && MistralGestion.utils) {
      return MistralGestion.utils.formatDateShort(dateStr);
    }
    return new Date(dateStr).toLocaleDateString('fr-FR');
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  function initNavigation() {
    // Navigation principale
    $$('.gestion-nav__item[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        navigateTo(section);
      });
    });

    // Sous-onglets (professeurs, etc.)
    $$('[data-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const subtab = btn.dataset.subtab;
        const container = btn.closest('.gestion-section') || btn.closest('[id^="section-"]');
        
        // Active le bouton
        btn.closest('.admin-tabs, .gestion-nav').querySelectorAll('[data-subtab]').forEach(b => {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        
        // Affiche le contenu
        if (container) {
          container.querySelectorAll('[id^="subtab-"]').forEach(el => {
            el.style.display = 'none';
          });
          const subtabEl = container.querySelector(`#subtab-${subtab}`);
          if (subtabEl) subtabEl.style.display = 'block';
        }
      });
    });

    // Hash URL
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      navigateTo(hash);
    }
  }

  function navigateTo(section) {
    currentSection = section;
    
    // Active l'onglet
    $$('.gestion-nav__item[data-section]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === section);
    });
    
    // Affiche la section
    $$('.gestion-section').forEach(s => {
      s.classList.toggle('active', s.id === `section-${section}`);
    });
    
    // Met à jour l'URL
    history.replaceState(null, '', `#${section}`);
    
    // Charge le contenu
    refreshSection(section);
  }

  function goToTab(section) {
    navigateTo(section);
  }

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  function refreshDashboard() {
    // Stats depuis MistralGestion
    if (typeof MistralGestion !== 'undefined') {
      const G = MistralGestion;
      
      // Stats business
      const locationsEnCours = G.Locations ? G.Locations.list().filter(l => l.statut === 'en_cours').length : 0;
      const instrumentsDispo = G.Instruments ? G.Instruments.list().filter(i => i.statut === 'disponible').length : 0;
      
      // CA
      let caMois = 0, caAnnee = 0;
      if (G.Stats) {
        caMois = G.Stats.getRevenusMois ? G.Stats.getRevenusMois() : 0;
        caAnnee = G.Stats.getRevenusAnnee ? G.Stats.getRevenusAnnee() : 0;
      }
      
      // Commandes et paiements en attente
      const commandesEnCours = G.Commandes ? G.Commandes.list().filter(c => c.statut !== 'livre' && c.statut !== 'annule').length : 0;
      const paiementsEnAttente = G.Factures ? G.Factures.list().filter(f => f.statut_paiement !== 'paye' && f.statut !== 'annulee').length : 0;
      
      // Mise à jour UI
      updateStat('dash-locations', locationsEnCours);
      updateStat('dash-instruments', instrumentsDispo);
      updateStat('dash-ca-mois', formatPrice(caMois));
      updateStat('dash-ca-annee', formatPrice(caAnnee));
      updateStat('dash-pending-orders', commandesEnCours);
      updateStat('dash-pending-payments', paiementsEnAttente);
      
      // Badges navigation
      updateBadge('badge-locations', locationsEnCours);
      updateBadge('badge-commandes', commandesEnCours);
    }
    
    // Demandes de professeurs en attente
    const pendingTeachers = Storage.get(CONFIG.STORAGE_KEYS.pendingTeachers || 'mistral_pending_teachers', []);
    updateStat('dash-pending-teachers', pendingTeachers.length);
    updateBadge('badge-professeurs', pendingTeachers.length);
  }

  function updateStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateBadge(id, count) {
    const badge = document.getElementById(id);
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  // ============================================================================
  // TO-DO LIST
  // ============================================================================

  function loadTodos() {
    const todos = Storage.get(CONFIG.TODO_KEY, []);
    renderTodos(todos);
  }

  function renderTodos(todos) {
    const container = $('#todo-list');
    if (!container) return;
    
    if (!todos.length) {
      container.innerHTML = `
        <div class="gestion-empty" style="padding: 1.5rem;">
          <p class="gestion-empty__text">Aucune tâche pour le moment</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = todos.map((todo, index) => `
      <div class="todo-item ${todo.done ? 'todo-item--done' : ''}" data-index="${index}">
        <button class="todo-item__checkbox" onclick="AdminUI.toggleTodo(${index})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
        <div class="todo-item__content">
          <div class="todo-item__text">${escapeHtml(todo.text)}</div>
          ${todo.category ? `<div class="todo-item__meta">${escapeHtml(todo.category)}</div>` : ''}
        </div>
        <button class="todo-item__delete" onclick="AdminUI.deleteTodo(${index})" title="Supprimer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');
  }

  function addTodo() {
    const input = $('#todo-input');
    if (!input) return;
    
    const text = input.value.trim();
    if (!text) return;
    
    const todos = Storage.get(CONFIG.TODO_KEY, []);
    todos.unshift({
      text,
      done: false,
      created: new Date().toISOString()
    });
    Storage.set(CONFIG.TODO_KEY, todos);
    
    input.value = '';
    renderTodos(todos);
  }

  function toggleTodo(index) {
    const todos = Storage.get(CONFIG.TODO_KEY, []);
    if (todos[index]) {
      todos[index].done = !todos[index].done;
      Storage.set(CONFIG.TODO_KEY, todos);
      renderTodos(todos);
    }
  }

  function deleteTodo(index) {
    const todos = Storage.get(CONFIG.TODO_KEY, []);
    todos.splice(index, 1);
    Storage.set(CONFIG.TODO_KEY, todos);
    renderTodos(todos);
  }

  // ============================================================================
  // REFRESH SECTIONS
  // ============================================================================

  function refreshSection(section) {
    switch (section) {
      case 'dashboard':
        refreshDashboard();
        loadTodos();
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
      case 'boutique':
        renderBoutique();
        initBoutiqueInstrumentSelect();
        break;
      case 'professeurs':
        renderProfesseurs();
        break;
      case 'galerie':
        renderGalerie();
        break;
      case 'blog':
        renderBlog();
        break;
      case 'analytics':
        renderAnalytics();
        break;
      case 'comptabilite':
        initComptabilite();
        break;
      case 'config':
        loadConfig();
        renderMateriaux();
        break;
    }
  }

  function refreshAll() {
    refreshDashboard();
    loadTodos();
    refreshSection(currentSection);
  }

  // ============================================================================
  // RENDER: CLIENTS
  // ============================================================================

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
      
      return `
        <tr>
          <td><code>${escapeHtml(i.reference || '-')}</code></td>
          <td><strong>${escapeHtml(i.nom)}</strong></td>
          <td>${escapeHtml(i.gamme || '-')}</td>
          <td><span class="admin-badge admin-badge--${statutClass}">${statutLabel}</span></td>
          <td>${formatPrice(i.prix_vente)}</td>
          <td>${boutiqueCell}</td>
          <td class="gestion-table__actions">
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
            ` : ''}
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

  // ============================================================================
  // RENDER: BOUTIQUE
  // ============================================================================

  function renderBoutique() {
    renderBoutiqueInstruments();
    renderBoutiqueAccessoires();
  }
  
  function renderBoutiqueInstruments() {
    const grid = $('#boutique-instruments-list');
    const empty = $('#boutique-instruments-empty');
    
    if (!grid) return;
    
    // Récupérer les instruments publiés (statut "en_ligne")
    let instruments = [];
    if (typeof MistralGestion !== 'undefined') {
      instruments = MistralGestion.Instruments.list().filter(i => i.statut === 'en_ligne');
    }
    
    if (!instruments.length) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    
    grid.innerHTML = instruments.map(i => `
      <div class="dashboard__card" style="position: relative;">
        ${i.images && i.images.length > 0 ? `
          <div style="margin: -1rem -1rem 1rem -1rem; height: 120px; overflow: hidden; border-radius: 8px 8px 0 0;">
            <img src="${i.images[0]}" alt="${escapeHtml(i.nom)}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
          <div>
            <strong>${escapeHtml(i.nom || i.reference)}</strong>
            <div style="font-size: 0.875rem; color: var(--admin-text-muted);">
              ${i.nombre_notes || '?'} notes · ${i.taille || '?'}cm · ${i.tonalite || ''} ${i.gamme || ''}
            </div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 1.25rem; font-weight: 600; color: var(--admin-accent);">
            ${formatPrice(i.prix_vente || 0)}
          </div>
          <span class="admin-badge admin-badge--success">En ligne</span>
        </div>
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
          <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editInstrument('${i.id}')">Modifier</button>
          <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.retirerDeBoutique('${i.id}')">Retirer</button>
        </div>
      </div>
    `).join('');
  }
  
  function renderBoutiqueAccessoires() {
    const grid = $('#boutique-accessoires-list');
    const empty = $('#boutique-accessoires-empty');
    
    if (!grid) return;
    
    const accessoires = Storage.get('mistral_accessoires', []);
    
    if (!accessoires.length) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    
    const categorieLabels = {
      'housse': 'Housse',
      'huile': 'Huile',
      'support': 'Support',
      'accessoire': 'Accessoire'
    };
    
    grid.innerHTML = accessoires.map(a => `
      <div class="dashboard__card" style="position: relative; ${a.statut === 'masque' ? 'opacity: 0.6;' : ''}">
        ${a.image ? `
          <div style="margin: -1rem -1rem 1rem -1rem; height: 100px; overflow: hidden; border-radius: 8px 8px 0 0;">
            <img src="${a.image}" alt="${escapeHtml(a.nom)}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
          <div>
            <strong>${escapeHtml(a.nom)}</strong>
            <div style="font-size: 0.875rem; color: var(--admin-text-muted);">
              ${categorieLabels[a.categorie] || a.categorie}
              ${a.stock >= 0 ? ` · Stock: ${a.stock}` : ' · Illimité'}
            </div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 1.25rem; font-weight: 600; color: var(--admin-accent);">
            ${formatPrice(a.prix || 0)}
          </div>
          <span class="admin-badge admin-badge--${a.statut === 'actif' ? 'success' : 'neutral'}">
            ${a.statut === 'actif' ? 'Actif' : 'Masqué'}
          </span>
        </div>
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
          <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editAccessoire('${a.id}')">Modifier</button>
          <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.toggleAccessoire('${a.id}')">
            ${a.statut === 'actif' ? 'Masquer' : 'Afficher'}
          </button>
          <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.deleteAccessoire('${a.id}')">Supprimer</button>
        </div>
      </div>
    `).join('');
  }
  
  // Retirer un instrument de la boutique (passer en statut "disponible")
  function retirerDeBoutique(id) {
    if (typeof MistralGestion === 'undefined') return;
    
    MistralGestion.Instruments.update(id, { statut: 'disponible' });
    renderBoutique();
    renderInstruments();
    Toast.success('Instrument retiré de la boutique');
  }
  
  // Variable pour stocker l'instrument sélectionné pour publication
  let selectedInstrumentForBoutique = null;
  
  // Initialiser le searchable select pour les instruments disponibles
  function initBoutiqueInstrumentSelect() {
    const searchInput = $('#boutique-instrument-search');
    const dropdown = $('#boutique-instrument-dropdown');
    
    if (!searchInput || !dropdown) return;
    
    // Reset
    selectedInstrumentForBoutique = null;
    searchInput.value = '';
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const instruments = getInstrumentsDisponiblesPourBoutique(query);
      
      if (instruments.length === 0) {
        dropdown.innerHTML = `<div class="searchable-dropdown__empty">Aucun instrument disponible</div>`;
      } else {
        dropdown.innerHTML = instruments.map(i => `
          <div class="searchable-dropdown__item" data-id="${i.id}">
            <strong>${escapeHtml(i.nom || i.reference)}</strong>
            <span style="color: var(--admin-text-muted); font-size: 0.8rem;">${i.tonalite || ''} ${i.gamme || ''} · ${i.nombre_notes || '?'} notes · ${formatPrice(i.prix_vente || 0)}</span>
          </div>
        `).join('');
      }
      
      dropdown.style.display = 'block';
    });
    
    searchInput.addEventListener('focus', () => {
      const query = searchInput.value.toLowerCase();
      const instruments = getInstrumentsDisponiblesPourBoutique(query);
      
      if (instruments.length === 0) {
        dropdown.innerHTML = `<div class="searchable-dropdown__empty">Aucun instrument disponible</div>`;
      } else {
        dropdown.innerHTML = instruments.map(i => `
          <div class="searchable-dropdown__item" data-id="${i.id}">
            <strong>${escapeHtml(i.nom || i.reference)}</strong>
            <span style="color: var(--admin-text-muted); font-size: 0.8rem;">${i.tonalite || ''} ${i.gamme || ''} · ${i.nombre_notes || '?'} notes · ${formatPrice(i.prix_vente || 0)}</span>
          </div>
        `).join('');
      }
      
      dropdown.style.display = 'block';
    });
    
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.searchable-dropdown__item');
      if (item) {
        const id = item.dataset.id;
        const instrument = MistralGestion.Instruments.get(id);
        if (instrument) {
          selectedInstrumentForBoutique = instrument;
          searchInput.value = instrument.nom || instrument.reference;
          dropdown.style.display = 'none';
        }
      }
    });
    
    // Fermer dropdown quand on clique ailleurs
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#boutique-instrument-search') && !e.target.closest('#boutique-instrument-dropdown')) {
        dropdown.style.display = 'none';
      }
    });
  }
  
  // Récupérer les instruments disponibles (non publiés)
  function getInstrumentsDisponiblesPourBoutique(query = '') {
    if (typeof MistralGestion === 'undefined') return [];
    
    return MistralGestion.Instruments.list()
      .filter(i => {
        // Seulement les instruments disponibles (pas en ligne, pas en location, pas vendus)
        if (i.statut !== 'disponible') return false;
        
        // Filtre de recherche
        if (query) {
          const searchStr = `${i.nom || ''} ${i.reference || ''} ${i.tonalite || ''} ${i.gamme || ''}`.toLowerCase();
          return searchStr.includes(query);
        }
        return true;
      })
      .slice(0, 10); // Limiter à 10 résultats
  }
  
  // Publier l'instrument sélectionné
  function publierInstrumentSelectionne() {
    if (!selectedInstrumentForBoutique) {
      Toast.error('Sélectionnez un instrument à publier');
      return;
    }
    
    // Vérifier qu'il a un prix
    if (!selectedInstrumentForBoutique.prix_vente || selectedInstrumentForBoutique.prix_vente <= 0) {
      Toast.error('Cet instrument n\'a pas de prix de vente défini');
      return;
    }
    
    // Passer en statut "en_ligne"
    MistralGestion.Instruments.update(selectedInstrumentForBoutique.id, { statut: 'en_ligne' });
    
    // Reset
    selectedInstrumentForBoutique = null;
    if ($('#boutique-instrument-search')) $('#boutique-instrument-search').value = '';
    
    renderBoutique();
    renderInstruments();
    Toast.success('Instrument publié dans la boutique');
  }
  
  // Variable pour indiquer qu'on vient de la boutique
  let publishAfterInstrumentCreation = false;
  
  // Créer un instrument et le publier
  function creerEtPublierInstrument() {
    publishAfterInstrumentCreation = true;
    showModal('instrument');
  }
  
  // ============================================================================
  // GESTION DES ACCESSOIRES
  // ============================================================================
  
  // Stockage temporaire de l'image uploadée
  let accessoireUploadedImage = null;
  
  function initAccessoireUpload() {
    if (typeof MistralUpload === 'undefined') {
      console.warn('[Admin UI] MistralUpload non disponible');
      return;
    }
    
    // Reset
    accessoireUploadedImage = null;
    
    const container = $('#accessoire-image-upload');
    if (container) {
      container.innerHTML = '';
      
      const input = MistralUpload.createUploadInput({
        id: 'accessoire-image-file',
        acceptType: 'image',
        onSelect: async (file) => {
          try {
            const compress = isCompressionEnabled('accessoire');
            const base64 = await fileToBase64(file, compress, 'standard');
            accessoireUploadedImage = {
              type: 'base64',
              data: base64,
              name: file.name
            };
            
            // Afficher preview
            showAccessoireImagePreview(base64);
            Toast.success('Image chargée');
          } catch (e) {
            console.error('[Admin UI] Erreur upload image accessoire:', e);
            Toast.error('Erreur lors du chargement de l\'image');
          }
        }
      });
      
      container.appendChild(input);
    }
    
    // Clear preview
    const preview = $('#accessoire-image-preview');
    if (preview) preview.innerHTML = '';
    
    // Clear URL manuelle
    if ($('#accessoire-image-url')) $('#accessoire-image-url').value = '';
  }
  
  function showAccessoireImagePreview(src) {
    const container = $('#accessoire-image-preview');
    if (!container) return;
    
    container.innerHTML = `
      <div class="upload-preview-item" style="width: 120px; height: 120px;">
        <img src="${src}" alt="Preview">
        <button type="button" class="upload-preview-remove" onclick="AdminUI.removeAccessoireImage()">×</button>
      </div>
    `;
  }
  
  function removeAccessoireImage() {
    accessoireUploadedImage = null;
    const preview = $('#accessoire-image-preview');
    if (preview) preview.innerHTML = '';
  }
  
  function getAccessoireImageForSave() {
    // Priorité : image uploadée > URL manuelle
    if (accessoireUploadedImage) {
      return accessoireUploadedImage.data;
    }
    
    const urlManuelle = $('#accessoire-image-url')?.value?.trim();
    if (urlManuelle) {
      return urlManuelle;
    }
    
    return '';
  }
  
  function loadAccessoireImageForEdit(accessoire) {
    accessoireUploadedImage = null;
    const preview = $('#accessoire-image-preview');
    if (preview) preview.innerHTML = '';
    if ($('#accessoire-image-url')) $('#accessoire-image-url').value = '';
    
    if (accessoire.image) {
      // Charger l'image existante
      accessoireUploadedImage = {
        type: 'url',
        data: accessoire.image
      };
      showAccessoireImagePreview(accessoire.image);
    }
  }
  
  function saveAccessoire() {
    const id = $('#accessoire-id')?.value;

    // Collect compatible sizes
    const taillesCompatibles = [];
    if ($('#accessoire-taille-45')?.checked) taillesCompatibles.push('45');
    if ($('#accessoire-taille-50')?.checked) taillesCompatibles.push('50');
    if ($('#accessoire-taille-53')?.checked) taillesCompatibles.push('53');

    const data = {
      nom: $('#accessoire-nom')?.value.trim(),
      categorie: $('#accessoire-categorie')?.value || 'accessoire',
      prix: parseFloat($('#accessoire-prix')?.value) || 0,
      stock: parseInt($('#accessoire-stock')?.value),
      description: $('#accessoire-description')?.value.trim(),
      image: getAccessoireImageForSave(),
      statut: $('#accessoire-statut')?.value || 'actif',
      visible_configurateur: $('#accessoire-visible-config')?.checked || false,
      tailles_compatibles: taillesCompatibles
    };
    
    // Validation
    if (!data.nom) {
      Toast.error('Nom requis');
      return;
    }
    
    if (data.prix <= 0) {
      Toast.error('Prix requis');
      return;
    }
    
    // Stock -1 = illimité
    if (isNaN(data.stock)) data.stock = -1;
    
    const accessoires = Storage.get('mistral_accessoires', []);
    
    if (id) {
      // Modification
      const index = accessoires.findIndex(a => a.id === id);
      if (index !== -1) {
        accessoires[index] = { ...accessoires[index], ...data, updated_at: new Date().toISOString() };
      }
      Toast.success('Accessoire modifié');
    } else {
      // Création
      data.id = 'acc_' + Date.now();
      data.created_at = new Date().toISOString();
      accessoires.push(data);
      Toast.success('Accessoire créé');
    }
    
    Storage.set('mistral_accessoires', accessoires);
    closeModal('accessoire');
    renderBoutique();
  }
  
  function editAccessoire(id) {
    const accessoires = Storage.get('mistral_accessoires', []);
    const accessoire = accessoires.find(a => a.id === id);
    if (!accessoire) return;

    $('#modal-accessoire-title').textContent = 'Modifier l\'accessoire';
    $('#accessoire-id').value = accessoire.id;
    $('#accessoire-nom').value = accessoire.nom || '';
    $('#accessoire-categorie').value = accessoire.categorie || 'accessoire';
    $('#accessoire-prix').value = accessoire.prix || '';
    $('#accessoire-stock').value = accessoire.stock ?? -1;
    $('#accessoire-description').value = accessoire.description || '';
    $('#accessoire-statut').value = accessoire.statut || 'actif';

    // Load configurator options
    const visibleConfig = accessoire.visible_configurateur || false;
    $('#accessoire-visible-config').checked = visibleConfig;
    toggleAccessoireConfigOptions(visibleConfig);

    // Load compatible sizes
    const tailles = accessoire.tailles_compatibles || [];
    $('#accessoire-taille-45').checked = tailles.includes('45');
    $('#accessoire-taille-50').checked = tailles.includes('50');
    $('#accessoire-taille-53').checked = tailles.includes('53');

    showModal('accessoire');

    // Initialiser l'upload et charger l'image existante
    initAccessoireUpload();
    loadAccessoireImageForEdit(accessoire);
  }

  function toggleAccessoireConfigOptions(show) {
    const optionsDiv = $('#accessoire-config-options');
    if (optionsDiv) {
      optionsDiv.style.display = show ? 'block' : 'none';
    }
  }

  function initAccessoireConfigToggle() {
    const checkbox = $('#accessoire-visible-config');
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        toggleAccessoireConfigOptions(checkbox.checked);
      });
    }
  }
  
  function toggleAccessoire(id) {
    const accessoires = Storage.get('mistral_accessoires', []);
    const index = accessoires.findIndex(a => a.id === id);
    if (index === -1) return;
    
    accessoires[index].statut = accessoires[index].statut === 'actif' ? 'masque' : 'actif';
    Storage.set('mistral_accessoires', accessoires);
    renderBoutique();
    Toast.info(accessoires[index].statut === 'actif' ? 'Accessoire affiché' : 'Accessoire masqué');
  }
  
  async function deleteAccessoire(id) {
    const confirmed = await Confirm.show({
      title: 'Supprimer l\'accessoire',
      message: 'Cette action est irréversible.',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      let accessoires = Storage.get('mistral_accessoires', []);
      accessoires = accessoires.filter(a => a.id !== id);
      Storage.set('mistral_accessoires', accessoires);
      renderBoutique();
      Toast.success('Accessoire supprimé');
    }
  }

  // ============================================================================
  // RENDER: PROFESSEURS (délégué à existant)
  // ============================================================================

  function renderProfesseurs() {
    // Rendu des demandes en attente
    const pending = Storage.get('mistral_pending_teachers', []);
    const pendingList = $('#pending-teachers-list');
    const pendingEmpty = $('#empty-pending');
    
    if (pendingList) {
      if (!pending.length) {
        pendingList.innerHTML = '';
        if (pendingEmpty) pendingEmpty.style.display = 'block';
      } else {
        if (pendingEmpty) pendingEmpty.style.display = 'none';
        pendingList.innerHTML = pending.map(t => `
          <div class="dashboard__card" style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between;">
              <div>
                <strong>${escapeHtml(t.name)}</strong>
                <div style="font-size: 0.875rem; color: var(--admin-text-muted);">${escapeHtml(t.location || '')}</div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="admin-btn admin-btn--primary admin-btn--sm" onclick="AdminUI.approveTeacher('${t.id}')">Approuver</button>
                <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.rejectTeacher('${t.id}')">Rejeter</button>
              </div>
            </div>
          </div>
        `).join('');
      }
    }
    
    // Rendu des professeurs actifs
    const teachers = Storage.get('mistral_teachers', []);
    const teachersList = $('#active-teachers-list');
    const teachersEmpty = $('#empty-teachers');
    
    if (teachersList) {
      if (!teachers.length) {
        teachersList.innerHTML = '';
        if (teachersEmpty) teachersEmpty.style.display = 'block';
      } else {
        if (teachersEmpty) teachersEmpty.style.display = 'none';
        teachersList.innerHTML = teachers.map(t => `
          <div class="dashboard__card" style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between;">
              <div>
                <strong>${escapeHtml(t.name)}</strong>
                <div style="font-size: 0.875rem; color: var(--admin-text-muted);">${escapeHtml(t.location || '')}</div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editTeacher('${t.id}')">Modifier</button>
                <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.deleteTeacher('${t.id}')">Supprimer</button>
              </div>
            </div>
          </div>
        `).join('');
      }
    }
    
    // Mettre à jour les badges
    updateBadge('pending-count', pending.length);
  }

  // ============================================================================
  // RENDER: GALERIE (placeholder)
  // ============================================================================

  function renderGalerie() {
    const grid = $('#gallery-grid');
    const empty = $('#gallery-empty');
    
    if (!grid) return;
    
    const gallery = Storage.get('mistral_gallery', []);
    
    if (!gallery.length) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    
    grid.innerHTML = gallery.map(item => `
      <div class="gallery-item" data-id="${item.id}" style="position: relative; border-radius: 8px; overflow: hidden; background: var(--admin-surface);">
        <div style="aspect-ratio: 1; overflow: hidden;">
          ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.titre || '')}" style="width: 100%; height: 100%; object-fit: cover;">` : 
            `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--admin-surface-hover);"><span style="font-size: 3rem; opacity: 0.3;">🖼️</span></div>`}
          ${item.video ? `<span style="position: absolute; bottom: 0.5rem; left: 0.5rem; background: rgba(0,0,0,0.7); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">▶ Vidéo</span>` : ''}
        </div>
        <div style="padding: 0.75rem;">
          <div style="font-weight: 500; margin-bottom: 0.25rem;">${escapeHtml(item.titre || 'Sans titre')}</div>
          ${item.instrument ? `<div style="font-size: 0.8rem; color: var(--admin-text-muted);">${escapeHtml(item.instrument)}</div>` : ''}
          <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editMedia('${item.id}')">Modifier</button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.deleteMedia('${item.id}')">Supprimer</button>
          </div>
        </div>
      </div>
    `).join('');
  }
  
  // Variables pour upload média
  let mediaUploadedImage = null;
  let mediaUploadedVideo = null;
  
  function initMediaUpload() {
    mediaUploadedImage = null;
    mediaUploadedVideo = null;
    
    // Image upload
    const imageContainer = $('#media-image-upload');
    if (imageContainer && typeof MistralUpload !== 'undefined') {
      imageContainer.innerHTML = '';
      const input = MistralUpload.createUploadInput({
        id: 'media-image-file',
        acceptType: 'image',
        onSelect: async (file) => {
          const compress = isCompressionEnabled('media');
          const base64 = await fileToBase64(file, compress, 'hero');
          mediaUploadedImage = base64;
          showMediaImagePreview(base64);
          Toast.success('Image chargée');
        }
      });
      imageContainer.appendChild(input);
    }
    
    // Clear previews
    if ($('#media-image-preview')) $('#media-image-preview').innerHTML = '';
    if ($('#media-video-preview')) $('#media-video-preview').innerHTML = '';
    if ($('#media-image-url')) $('#media-image-url').value = '';
    if ($('#media-video-url')) $('#media-video-url').value = '';
  }
  
  function showMediaImagePreview(src) {
    const container = $('#media-image-preview');
    if (!container) return;
    container.innerHTML = `
      <div class="upload-preview-item" style="width: 150px; height: 150px;">
        <img src="${src}" alt="Preview">
        <button type="button" class="upload-preview-remove" onclick="AdminUI.removeMediaImage()">×</button>
      </div>
    `;
  }
  
  function removeMediaImage() {
    mediaUploadedImage = null;
    if ($('#media-image-preview')) $('#media-image-preview').innerHTML = '';
  }
  
  function saveMedia() {
    const id = $('#media-id')?.value;
    
    // Récupérer l'image (uploadée ou URL)
    let image = mediaUploadedImage || $('#media-image-url')?.value?.trim() || '';
    let video = $('#media-video-url')?.value?.trim() || '';
    
    const data = {
      titre: $('#media-titre')?.value?.trim(),
      description: $('#media-description')?.value?.trim(),
      image: image,
      video: video,
      instrument: $('#media-instrument')?.value?.trim(),
      date: $('#media-date')?.value || new Date().toISOString().slice(0, 10)
    };
    
    if (!data.titre) {
      Toast.error('Titre requis');
      return;
    }
    
    if (!data.image) {
      Toast.error('Image requise');
      return;
    }
    
    const gallery = Storage.get('mistral_gallery', []);
    
    if (id) {
      const index = gallery.findIndex(m => m.id === id);
      if (index !== -1) {
        gallery[index] = { ...gallery[index], ...data, updated_at: new Date().toISOString() };
      }
      Toast.success('Média modifié');
    } else {
      data.id = 'media_' + Date.now();
      data.created_at = new Date().toISOString();
      gallery.push(data);
      Toast.success('Média ajouté');
    }
    
    Storage.set('mistral_gallery', gallery);
    closeModal('media');
    renderGalerie();
  }
  
  function editMedia(id) {
    const gallery = Storage.get('mistral_gallery', []);
    const media = gallery.find(m => m.id === id);
    if (!media) return;
    
    $('#modal-media-title').textContent = 'Modifier le média';
    showModal('media');
    initMediaUpload();
    
    $('#media-id').value = media.id;
    $('#media-titre').value = media.titre || '';
    $('#media-description').value = media.description || '';
    $('#media-instrument').value = media.instrument || '';
    $('#media-date').value = media.date || '';
    
    if (media.image) {
      mediaUploadedImage = media.image;
      showMediaImagePreview(media.image);
    }
    
    if (media.video) {
      $('#media-video-url').value = media.video;
    }
  }
  
  async function deleteMedia(id) {
    const confirmed = await Confirm.show({
      title: 'Supprimer le média',
      message: 'Cette action est irréversible.',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      let gallery = Storage.get('mistral_gallery', []);
      gallery = gallery.filter(m => m.id !== id);
      Storage.set('mistral_gallery', gallery);
      renderGalerie();
      Toast.success('Média supprimé');
    }
  }

  // ============================================================================
  // RENDER: BLOG (placeholder)
  // ============================================================================

  function renderBlog() {
    
    const list = $('#articles-list');
    const empty = $('#articles-empty');
    
    
    
    
    if (!list) {
      
      return;
    }
    
    const articles = Storage.get('mistral_blog_articles', []);
    
    
    if (!articles.length) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    
    // Trier par date décroissante
    articles.sort((a, b) => (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || ''));
    
    const categorieLabels = {
      'actualite': 'Actualité',
      'tutoriel': 'Tutoriel',
      'fabrication': 'Fabrication',
      'interview': 'Interview',
      'evenement': 'Événement',
      'guide': 'Guide',
      'conseil': 'Conseil'
    };
    
    list.innerHTML = articles.map(article => `
      <div class="dashboard__card" style="margin-bottom: 1rem; display: flex; gap: 1rem;">
        ${article.coverImage ? `
          <div style="width: 120px; height: 80px; flex-shrink: 0; border-radius: 8px; overflow: hidden;">
            <img src="${article.coverImage}" alt="" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        ` : ''}
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <div>
              <h4 style="margin: 0 0 0.25rem 0; font-size: 1rem;">${escapeHtml(article.title || 'Sans titre')}</h4>
              <div style="font-size: 0.8rem; color: var(--admin-text-muted);">
                ${categorieLabels[article.category] || article.category || 'Article'} · ${article.publishedAt ? formatDate(article.publishedAt) : (article.createdAt ? formatDate(article.createdAt) : 'Non daté')}
              </div>
            </div>
            <span class="admin-badge admin-badge--${article.status === 'published' ? 'success' : 'neutral'}">
              ${article.status === 'published' ? 'Publié' : 'Brouillon'}
            </span>
          </div>
          ${article.excerpt ? `<p style="font-size: 0.875rem; color: var(--admin-text-muted); margin: 0.5rem 0; line-height: 1.4;">${escapeHtml(article.excerpt.substring(0, 150))}${article.excerpt.length > 150 ? '...' : ''}</p>` : ''}
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editArticle('${article.id}')">Modifier</button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.toggleArticleStatut('${article.id}')">
              ${article.status === 'published' ? 'Dépublier' : 'Publier'}
            </button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.deleteArticle('${article.id}')">Supprimer</button>
          </div>
        </div>
      </div>
    `).join('');
  }
  
  // Variable pour l'upload d'image article
  let articleUploadedImage = null;
  let articleQuillEditor = null;
  
  function initArticleUpload() {
    articleUploadedImage = null;
    
    const imageContainer = $('#article-image-upload');
    if (imageContainer && typeof MistralUpload !== 'undefined') {
      imageContainer.innerHTML = '';
      const input = MistralUpload.createUploadInput({
        id: 'article-image-file',
        acceptType: 'image',
        onSelect: async (file) => {
          const compress = isCompressionEnabled('article');
          const base64 = await fileToBase64(file, compress, 'standard');
          articleUploadedImage = base64;
          showArticleImagePreview(base64);
          Toast.success('Image chargée');
        }
      });
      imageContainer.appendChild(input);
    }
    
    if ($('#article-image-preview')) $('#article-image-preview').innerHTML = '';
    
    // Init Quill editor
    initArticleEditor();
  }
  
  function initArticleEditor() {
    const editorContainer = $('#article-editor');
    if (!editorContainer) return;
    
    // Détruire l'ancien éditeur si existe
    if (articleQuillEditor) {
      articleQuillEditor = null;
    }
    
    editorContainer.innerHTML = '';
    
    if (typeof Quill !== 'undefined') {
      articleQuillEditor = new Quill('#article-editor', {
        theme: 'snow',
        placeholder: 'Rédigez votre article...',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'image'],
            ['clean']
          ]
        }
      });
    } else {
      // Fallback textarea
      editorContainer.innerHTML = '<textarea class="admin-form__textarea" id="article-contenu-fallback" rows="10" placeholder="Contenu de l\'article..." style="width:100%;"></textarea>';
    }
  }
  
  function showArticleImagePreview(src) {
    const container = $('#article-image-preview');
    if (!container) return;
    container.innerHTML = `
      <div class="upload-preview-item" style="width: 200px; height: 120px;">
        <img src="${src}" alt="Preview">
        <button type="button" class="upload-preview-remove" onclick="AdminUI.removeArticleImage()">×</button>
      </div>
    `;
  }
  
  function removeArticleImage() {
    articleUploadedImage = null;
    if ($('#article-image-preview')) $('#article-image-preview').innerHTML = '';
  }
  
  function saveArticle() {
    
    const id = $('#article-id')?.value;
    
    // Récupérer le contenu de l'éditeur
    let content = '';
    if (articleQuillEditor) {
      content = articleQuillEditor.root.innerHTML;
    } else {
      const fallback = $('#article-contenu-fallback');
      if (fallback) content = fallback.value;
    }
    
    // Mapper vers les noms de champs utilisés par MistralAdmin.Blog
    const data = {
      title: $('#article-titre')?.value?.trim(),
      category: $('#article-categorie')?.value || 'actualite',
      coverImage: articleUploadedImage || '',
      excerpt: $('#article-resume')?.value?.trim(),
      content: content,
      status: $('#article-statut')?.value === 'publie' ? 'published' : 'draft',
      author: 'Mistral Pans'
    };
    
    
    
    // Date de publication si publié
    if (data.status === 'published') {
      data.publishedAt = $('#article-date')?.value ? new Date($('#article-date').value).toISOString() : new Date().toISOString();
    }
    
    if (!data.title) {
      Toast.error('Titre requis');
      return;
    }
    
    const articles = Storage.get('mistral_blog_articles', []);
    
    
    if (id) {
      const index = articles.findIndex(a => a.id === id);
      if (index !== -1) {
        articles[index] = { ...articles[index], ...data, updatedAt: new Date().toISOString() };
        // Regénérer le slug si le titre change
        if (data.title) {
          articles[index].slug = generateSlug(data.title);
        }
      }
      Toast.success('Article modifié');
    } else {
      data.id = 'article_' + Date.now();
      data.createdAt = new Date().toISOString();
      data.slug = generateSlug(data.title);
      articles.push(data);
      Toast.success('Article créé');
    }
    
    Storage.set('mistral_blog_articles', articles);
    
    
    closeModal('article');
    renderBlog();
    
  }
  
  function generateSlug(title) {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  function editArticle(id) {
    const articles = Storage.get('mistral_blog_articles', []);
    const article = articles.find(a => a.id === id);
    if (!article) return;
    
    $('#modal-article-title').textContent = 'Modifier l\'article';
    showModal('article');
    initArticleUpload();
    
    $('#article-id').value = article.id;
    $('#article-titre').value = article.title || '';
    $('#article-categorie').value = article.category || 'actualite';
    $('#article-date').value = article.publishedAt ? article.publishedAt.slice(0, 10) : '';
    $('#article-resume').value = article.excerpt || '';
    $('#article-statut').value = article.status === 'published' ? 'publie' : 'brouillon';
    
    if (article.coverImage) {
      articleUploadedImage = article.coverImage;
      showArticleImagePreview(article.coverImage);
    }
    
    // Charger le contenu dans l'éditeur (sanitizé pour éviter XSS)
    setTimeout(() => {
      if (articleQuillEditor && article.content) {
        // Sanitize le HTML avant de l'injecter dans l'éditeur
        const sanitizedContent = utils.sanitizeHtml ? utils.sanitizeHtml(article.content) : article.content;
        articleQuillEditor.root.innerHTML = sanitizedContent;
      } else {
        const fallback = $('#article-contenu-fallback');
        if (fallback) fallback.value = article.content || '';
      }
    }, 100);
  }
  
  function toggleArticleStatut(id) {
    const articles = Storage.get('mistral_blog_articles', []);
    const index = articles.findIndex(a => a.id === id);
    if (index === -1) return;
    
    const isPublished = articles[index].status === 'published';
    articles[index].status = isPublished ? 'draft' : 'published';
    
    // Mettre à jour publishedAt si on publie
    if (!isPublished) {
      articles[index].publishedAt = new Date().toISOString();
    }
    
    articles[index].updatedAt = new Date().toISOString();
    
    Storage.set('mistral_blog_articles', articles);
    renderBlog();
    Toast.info(articles[index].status === 'published' ? 'Article publié' : 'Article dépublié');
  }
  
  async function deleteArticle(id) {
    const confirmed = await Confirm.show({
      title: 'Supprimer l\'article',
      message: 'Cette action est irréversible.',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      let articles = Storage.get('mistral_blog_articles', []);
      articles = articles.filter(a => a.id !== id);
      Storage.set('mistral_blog_articles', articles);
      renderBlog();
      Toast.success('Article supprimé');
    }
  }

  // ============================================================================
  // RENDER: ANALYTICS (placeholder)
  // ============================================================================

  function renderAnalytics() {
    const content = $('#stats-content');
    if (!content) return;
    
    // Récupérer la période sélectionnée
    const periodSelect = $('#stats-period');
    const days = periodSelect ? parseInt(periodSelect.value) : 30;
    
    if (typeof MistralStats === 'undefined') {
      content.innerHTML = '<p style="color: var(--admin-text-muted);">Module statistiques non chargé</p>';
      return;
    }
    
    const { Reports } = MistralStats;
    
    // Récupérer les données
    const summary = Reports.getSummary(days);
    const topPages = Reports.getTopPages(days, 5);
    const sources = Reports.getTrafficSources(days);
    const devices = Reports.getDevices(days);
    const browsers = Reports.getBrowsers(days);
    const peakHours = Reports.getPeakHours(days);
    const dailyTrend = Reports.getDailyTrend(days);
    const ctaPerformance = Reports.getCTAPerformance(days);
    
    // Construire l'interface
    content.innerHTML = `
      <!-- Résumé -->
      <div class="stats-summary">
        <div class="stats-card stats-card--highlight">
          <div class="stats-card__value">${summary.totalViews.toLocaleString('fr-FR')}</div>
          <div class="stats-card__label">Pages vues</div>
        </div>
        <div class="stats-card">
          <div class="stats-card__value">${summary.avgViewsPerDay}</div>
          <div class="stats-card__label">Moyenne / jour</div>
        </div>
        <div class="stats-card">
          <div class="stats-card__value">${summary.daysWithData}</div>
          <div class="stats-card__label">Jours avec données</div>
        </div>
        <div class="stats-card">
          <div class="stats-card__value">${days}</div>
          <div class="stats-card__label">Période (jours)</div>
        </div>
      </div>
      
      <!-- Graphique tendance -->
      <div class="stats-section">
        <h3 class="stats-section__title">Évolution du trafic</h3>
        <div class="stats-chart-container">
          <canvas id="chart-trend"></canvas>
        </div>
      </div>
      
      <!-- Grille 2 colonnes -->
      <div class="stats-grid">
        <!-- Top pages -->
        <div class="stats-section">
          <h3 class="stats-section__title">Pages populaires</h3>
          ${topPages.length > 0 ? `
            <div class="stats-list">
              ${topPages.map((p, i) => `
                <div class="stats-list__item">
                  <span class="stats-list__rank">${i + 1}</span>
                  <span class="stats-list__label">${escapeHtml(p.page)}</span>
                  <span class="stats-list__value">${p.views}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="stats-empty">Aucune donnée</p>'}
        </div>
        
        <!-- Sources -->
        <div class="stats-section">
          <h3 class="stats-section__title">Sources de trafic</h3>
          ${sources.length > 0 ? `
            <div class="stats-list">
              ${sources.map(s => `
                <div class="stats-list__item">
                  <span class="stats-list__label">${escapeHtml(s.source)}</span>
                  <div class="stats-list__bar-container">
                    <div class="stats-list__bar" style="width: ${s.percent}%"></div>
                  </div>
                  <span class="stats-list__value">${s.percent}%</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="stats-empty">Aucune donnée</p>'}
        </div>
        
        <!-- Appareils -->
        <div class="stats-section">
          <h3 class="stats-section__title">Appareils</h3>
          ${devices.length > 0 ? `
            <div class="stats-list">
              ${devices.map(d => `
                <div class="stats-list__item">
                  <span class="stats-list__icon">${d.device === 'Desktop' ? '🖥️' : d.device === 'Mobile' ? '📱' : '📟'}</span>
                  <span class="stats-list__label">${escapeHtml(d.device)}</span>
                  <div class="stats-list__bar-container">
                    <div class="stats-list__bar" style="width: ${d.percent}%"></div>
                  </div>
                  <span class="stats-list__value">${d.percent}%</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="stats-empty">Aucune donnée</p>'}
        </div>
        
        <!-- Navigateurs -->
        <div class="stats-section">
          <h3 class="stats-section__title">Navigateurs</h3>
          ${browsers.length > 0 ? `
            <div class="stats-list">
              ${browsers.map(b => `
                <div class="stats-list__item">
                  <span class="stats-list__label">${escapeHtml(b.browser)}</span>
                  <div class="stats-list__bar-container">
                    <div class="stats-list__bar" style="width: ${b.percent}%"></div>
                  </div>
                  <span class="stats-list__value">${b.percent}%</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="stats-empty">Aucune donnée</p>'}
        </div>
      </div>
      
      <!-- Heures de pointe -->
      <div class="stats-section">
        <h3 class="stats-section__title">Heures de pointe</h3>
        <div class="stats-chart-container stats-chart-container--small">
          <canvas id="chart-hours"></canvas>
        </div>
      </div>
      
      ${ctaPerformance.length > 0 ? `
        <!-- CTA Performance -->
        <div class="stats-section">
          <h3 class="stats-section__title">Clics sur les CTA</h3>
          <div class="stats-list">
            ${ctaPerformance.map((c, i) => `
              <div class="stats-list__item">
                <span class="stats-list__rank">${i + 1}</span>
                <span class="stats-list__label">${escapeHtml(c.name)}</span>
                <span class="stats-list__value">${c.clicks} clics</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Actions -->
      <div class="stats-actions">
        <button class="admin-btn admin-btn--secondary" onclick="MistralStats.Export.download('mistral-stats-${new Date().toISOString().split('T')[0]}.json', MistralStats.Export.toJSON())">
          Exporter JSON
        </button>
        <button class="admin-btn admin-btn--secondary" onclick="MistralStats.Export.download('mistral-stats-${new Date().toISOString().split('T')[0]}.csv', MistralStats.Export.toCSV(${days}), 'text/csv')">
          Exporter CSV
        </button>
        <button class="admin-btn admin-btn--ghost" onclick="if(confirm('Effacer toutes les statistiques ?')){MistralStats.Admin.clearAll();AdminUI.refreshAll();}">
          Réinitialiser
        </button>
      </div>
    `;
    
    // Initialiser les graphiques Chart.js
    initAnalyticsCharts(dailyTrend, peakHours);
  }
  
  function initAnalyticsCharts(dailyTrend, peakHours) {
    // Vérifier si Chart.js est disponible
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js non disponible');
      return;
    }
    
    // Graphique tendance
    const trendCtx = document.getElementById('chart-trend');
    if (trendCtx) {
      new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: dailyTrend.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
          }),
          datasets: [{
            label: 'Pages vues',
            data: dailyTrend.map(d => d.views),
            borderColor: '#0D7377',
            backgroundColor: 'rgba(13, 115, 119, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            pointHoverRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#a8a5a0', maxRotation: 45 }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#a8a5a0' }
            }
          }
        }
      });
    }
    
    // Graphique heures
    const hoursCtx = document.getElementById('chart-hours');
    if (hoursCtx) {
      new Chart(hoursCtx, {
        type: 'bar',
        data: {
          labels: peakHours.map(h => h.hour),
          datasets: [{
            label: 'Visites',
            data: peakHours.map(h => h.count),
            backgroundColor: 'rgba(13, 115, 119, 0.7)',
            borderColor: '#0D7377',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#a8a5a0' }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#a8a5a0' }
            }
          }
        }
      });
    }
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  function loadConfig() {
    if (typeof MistralGestion !== 'undefined') {
      const config = MistralGestion.getConfig();
      const entreprise = MistralGestion.CONFIG.ENTREPRISE;
      
      // Remplir les champs
      if ($('#config-nom')) $('#config-nom').value = entreprise.marque || '';
      if ($('#config-siret')) $('#config-siret').value = entreprise.siret || '';
      if ($('#config-email')) $('#config-email').value = entreprise.email || '';
      if ($('#config-tel')) $('#config-tel').value = entreprise.telephone || '';
      if ($('#config-loyer')) $('#config-loyer').value = config.loyerMensuel || 50;
      if ($('#config-caution')) $('#config-caution').value = config.montantCaution || 1150;
      if ($('#config-frais')) $('#config-frais').value = config.fraisDossierTransport || 100;
      if ($('#config-fidelite')) $('#config-fidelite').value = config.creditFidelitePourcent || 50;
    }
  }

  function saveConfig() {
    if (typeof MistralGestion !== 'undefined') {
      MistralGestion.setConfigValue('loyerMensuel', parseFloat($('#config-loyer')?.value) || 50);
      MistralGestion.setConfigValue('montantCaution', parseFloat($('#config-caution')?.value) || 1150);
      MistralGestion.setConfigValue('fraisDossierTransport', parseFloat($('#config-frais')?.value) || 100);
      MistralGestion.setConfigValue('creditFidelitePourcent', parseFloat($('#config-fidelite')?.value) || 50);
    }
    Toast.success('Configuration enregistrée');
  }

  // ============================================================================
  // EXPORT / IMPORT
  // ============================================================================

  function exportAllData() {
    if (typeof MistralGestion !== 'undefined') {
      MistralGestion.DataManager.downloadExport();
      Toast.success('Export téléchargé');
    }
  }

  function importData(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const data = JSON.parse(e.target.result);
        const confirmed = await Confirm.show({
          title: 'Confirmer l\'import',
          message: 'Cette action remplacera les données existantes. Continuer ?',
          confirmText: 'Importer'
        });
        
        if (confirmed && typeof MistralGestion !== 'undefined') {
          MistralGestion.DataManager.importAll(data);
          Toast.success('Import réussi');
          refreshAll();
        }
      } catch (err) {
        Toast.error('Erreur: fichier invalide');
      }
    };
    reader.readAsText(file);
  }

  async function resetAllData() {
    const confirmed = await Confirm.show({
      title: '⚠️ Réinitialisation',
      message: 'Cette action supprimera TOUTES les données. Cette action est irréversible !',
      confirmText: 'Tout supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      if (typeof MistralGestion !== 'undefined') {
        MistralGestion.DataManager.resetAll();
      }
      Storage.set(CONFIG.TODO_KEY, []);
      Toast.info('Données réinitialisées');
      setTimeout(() => location.reload(), 1000);
    }
  }

  // ============================================================================
  // MATÉRIAUX MANAGEMENT
  // ============================================================================

  function renderMateriaux() {
    const container = $('#materiaux-list');
    if (!container) return;

    if (typeof MistralMateriaux === 'undefined') {
      container.innerHTML = '<p style="color: var(--admin-text-muted);">Module matériaux non chargé</p>';
      return;
    }

    const materiaux = MistralMateriaux.getAll();

    if (materiaux.length === 0) {
      container.innerHTML = '<p style="color: var(--admin-text-muted);">Aucun matériau configuré</p>';
      return;
    }

    let html = '';
    materiaux.forEach(mat => {
      const statusBadge = mat.disponible
        ? '<span style="color: var(--color-success, #4A7C59); font-size: 0.75rem;">✓ Disponible</span>'
        : '<span style="color: var(--admin-text-muted); font-size: 0.75rem;">✗ Indisponible</span>';

      const configBadge = mat.visible_configurateur
        ? '<span style="background: var(--admin-accent); color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px;">Configurateur</span>'
        : '';

      const colorPreview = mat.couleur
        ? `<span style="display: inline-block; width: 16px; height: 16px; background: ${mat.couleur}; border-radius: 3px; vertical-align: middle; margin-right: 0.5rem; border: 1px solid rgba(0,0,0,0.1);"></span>`
        : '';

      const prixMalusDisplay = mat.prix_malus > 0
        ? `<span style="color: var(--color-warning, #F59E0B); font-size: 0.8rem;">+${mat.prix_malus}%</span>`
        : '<span style="color: var(--admin-text-muted); font-size: 0.8rem;">Inclus</span>';

      html += `
        <div class="materiau-card" style="background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 8px; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <div style="font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                ${colorPreview}
                ${escapeHtml(mat.nom)}
                <code style="background: var(--admin-surface-hover); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.75rem;">${mat.code}</code>
              </div>
              <div style="font-size: 0.85rem; color: var(--admin-text-muted); margin-top: 0.25rem;">
                ${mat.nom_court ? escapeHtml(mat.nom_court) : ''}
              </div>
            </div>
            ${prixMalusDisplay}
          </div>
          ${mat.description ? `<p style="font-size: 0.8rem; color: var(--admin-text-muted); margin: 0.5rem 0; line-height: 1.4;">${escapeHtml(mat.description.substring(0, 100))}${mat.description.length > 100 ? '...' : ''}</p>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--admin-border);">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              ${statusBadge}
              ${configBadge}
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="admin-btn admin-btn--sm admin-btn--secondary" onclick="AdminUI.editMateriau('${mat.id}')" title="Modifier">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="admin-btn admin-btn--sm admin-btn--danger" onclick="AdminUI.deleteMateriau('${mat.id}')" title="Supprimer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function initMateriauColorSync() {
    const picker = $('#materiau-couleur-picker');
    const input = $('#materiau-couleur');
    if (picker && input) {
      picker.addEventListener('input', () => {
        input.value = picker.value;
      });
      input.addEventListener('input', () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(input.value)) {
          picker.value = input.value;
        }
      });
    }
  }

  function populateMateriauxSelect(selectedCode = 'NS') {
    const select = $('#instrument-materiau');
    if (!select) return;

    if (typeof MistralMateriaux !== 'undefined') {
      select.innerHTML = MistralMateriaux.toSelectOptions(selectedCode);
    } else {
      // Fallback if module not loaded
      select.innerHTML = `
        <option value="NS" ${selectedCode === 'NS' ? 'selected' : ''}>Acier nitruré (NS)</option>
        <option value="ES" ${selectedCode === 'ES' ? 'selected' : ''}>Ember Steel (ES)</option>
        <option value="SS" ${selectedCode === 'SS' ? 'selected' : ''}>Inox</option>
      `;
    }
  }

  function editMateriau(id) {
    if (typeof MistralMateriaux === 'undefined') return;

    const materiau = MistralMateriaux.getById(id);
    if (!materiau) return;

    $('#modal-materiau-title').textContent = 'Modifier le matériau';
    $('#materiau-id').value = materiau.id;
    $('#materiau-code').value = materiau.code || '';
    $('#materiau-nom').value = materiau.nom || '';
    $('#materiau-nom-court').value = materiau.nom_court || '';
    $('#materiau-prix-malus').value = materiau.prix_malus || 0;
    $('#materiau-description').value = materiau.description || '';
    $('#materiau-couleur').value = materiau.couleur || '#C9A227';
    $('#materiau-couleur-picker').value = materiau.couleur || '#C9A227';
    $('#materiau-ordre').value = materiau.ordre || 1;
    $('#materiau-disponible').checked = materiau.disponible !== false;
    $('#materiau-visible-config').checked = materiau.visible_configurateur !== false;

    initMateriauColorSync();
    showModal('materiau');
  }

  function saveMateriau() {
    if (typeof MistralMateriaux === 'undefined') {
      Toast.error('Module matériaux non chargé');
      return;
    }

    const id = $('#materiau-id')?.value;
    const code = $('#materiau-code')?.value?.toUpperCase().trim();
    const nom = $('#materiau-nom')?.value?.trim();

    if (!code || !nom) {
      Toast.error('Le code et le nom sont requis');
      return;
    }

    // Check for duplicate code (except when editing same material)
    const existing = MistralMateriaux.getByCode(code);
    if (existing && existing.id !== id) {
      Toast.error(`Le code "${code}" existe déjà`);
      return;
    }

    const materiau = {
      id: id || null,
      code: code,
      nom: nom,
      nom_court: $('#materiau-nom-court')?.value?.trim() || '',
      prix_malus: parseFloat($('#materiau-prix-malus')?.value) || 0,
      description: $('#materiau-description')?.value?.trim() || '',
      couleur: $('#materiau-couleur')?.value?.trim() || '',
      ordre: parseInt($('#materiau-ordre')?.value) || 1,
      disponible: $('#materiau-disponible')?.checked,
      visible_configurateur: $('#materiau-visible-config')?.checked
    };

    MistralMateriaux.save(materiau);
    closeModal('materiau');
    renderMateriaux();
    Toast.success(id ? 'Matériau modifié' : 'Matériau créé');
  }

  async function deleteMateriau(id) {
    if (typeof MistralMateriaux === 'undefined') return;

    const materiau = MistralMateriaux.getById(id);
    if (!materiau) return;

    const confirmed = await Confirm.show({
      title: 'Supprimer le matériau',
      message: `Voulez-vous vraiment supprimer "${materiau.nom}" (${materiau.code}) ?`,
      confirmText: 'Supprimer',
      type: 'danger'
    });

    if (confirmed) {
      MistralMateriaux.remove(id);
      renderMateriaux();
      Toast.success('Matériau supprimé');
    }
  }

  async function resetMateriaux() {
    if (typeof MistralMateriaux === 'undefined') return;

    const confirmed = await Confirm.show({
      title: 'Réinitialiser les matériaux',
      message: 'Ceci remplacera tous les matériaux par les valeurs par défaut (NS, ES, SS). Continuer ?',
      confirmText: 'Réinitialiser',
      type: 'warning'
    });

    if (confirmed) {
      MistralMateriaux.reset();
      renderMateriaux();
      Toast.success('Matériaux réinitialisés');
    }
  }

  // ============================================================================
  // MODALS (stubs - à compléter)
  // ============================================================================

  function showModal(name) {
    const modal = $(`#modal-${name}`);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      
      // Reset du formulaire si nouveau
      const titleEl = modal.querySelector('.admin-modal__title');
      const idField = $(`#${name}-id`);
      if (idField && !idField.value) {
        const form = modal.querySelector('form');
        if (form) form.reset();
        
        // Titres par défaut
        const titles = {
          client: 'Nouveau client',
          instrument: 'Nouvel instrument',
          location: 'Nouvelle location',
          commande: 'Nouvelle commande',
          facture: 'Nouvelle facture',
          materiau: 'Nouveau matériau'
        };
        if (titleEl && titles[name]) {
          titleEl.textContent = titles[name];
        }
        
        // Initialisations spécifiques
        const today = new Date().toISOString().split('T')[0];
        
        if (name === 'facture') {
          // Initialiser les lignes de facture
          renderFactureLignes([]);
          updateFactureTotaux();
          // Date par défaut = aujourd'hui
          if ($('#facture-date')) {
            $('#facture-date').value = today;
            // Ajouter l'événement pour recalculer l'échéance
            $('#facture-date').onchange = updateFactureEcheance;
          }
          // Échéance par défaut = +30 jours
          updateFactureEcheance();
          // Reset client search
          if ($('#facture-client-search')) $('#facture-client-search').value = '';
          if ($('#facture-client-id')) $('#facture-client-id').value = '';
        }
        
        if (name === 'location') {
          if ($('#location-date-debut')) $('#location-date-debut').value = today;
          if ($('#location-client-search')) $('#location-client-search').value = '';
          if ($('#location-client-id')) $('#location-client-id').value = '';
          if ($('#location-instrument-search')) $('#location-instrument-search').value = '';
          if ($('#location-instrument-id')) $('#location-instrument-id').value = '';
        }
        
        if (name === 'commande') {
          if ($('#commande-date')) $('#commande-date').value = today;
          if ($('#commande-client-search')) $('#commande-client-search').value = '';
          if ($('#commande-client-id')) $('#commande-client-id').value = '';
        }
        
        if (name === 'instrument') {
          // Initialiser les uploads
          initInstrumentUploads();
          // Reset les previews
          clearInstrumentMediaPreviews();
        }
        
        if (name === 'accessoire') {
          // Initialiser l'upload d'image
          initAccessoireUpload();
          // Initialiser le toggle des options configurateur
          initAccessoireConfigToggle();
          // Reset config options
          $('#accessoire-visible-config').checked = false;
          toggleAccessoireConfigOptions(false);
          $('#accessoire-taille-45').checked = false;
          $('#accessoire-taille-50').checked = false;
          $('#accessoire-taille-53').checked = false;
        }
        
        if (name === 'media') {
          // Initialiser l'upload d'image/vidéo
          initMediaUpload();
          // Reset titre du modal
          $('#modal-media-title').textContent = 'Ajouter un média';
          $('#media-id').value = '';
          $('#form-media')?.reset();
        }
        
        if (name === 'article') {
          // Initialiser l'upload et l'éditeur
          initArticleUpload();
          // Reset titre du modal
          $('#modal-article-title').textContent = 'Nouvel article';
          $('#article-id').value = '';
          $('#form-article')?.reset();
        }

        if (name === 'materiau') {
          // Reset du formulaire
          $('#modal-materiau-title').textContent = 'Nouveau matériau';
          $('#materiau-id').value = '';
          $('#form-materiau')?.reset();
          // Valeurs par défaut
          $('#materiau-prix-malus').value = 0;
          $('#materiau-ordre').value = 1;
          $('#materiau-couleur').value = '#C9A227';
          $('#materiau-couleur-picker').value = '#C9A227';
          $('#materiau-disponible').checked = true;
          $('#materiau-visible-config').checked = true;
          // Sync color picker
          initMateriauColorSync();
        }

        if (name === 'instrument') {
          // Populate material select with dynamic options
          populateMateriauxSelect();
        }
      }

      // Focus premier champ
      setTimeout(() => {
        const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstInput) firstInput.focus();
      }, 100);
    }
  }

  function closeModal(name) {
    const modal = $(`#modal-${name}`);
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      
      // Reset ID caché
      const idField = $(`#${name}-id`);
      if (idField) idField.value = '';
    }
  }
  
  // Fermer modal avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.admin-modal-overlay.open');
      if (openModal) {
        const name = openModal.id.replace('modal-', '');
        closeModal(name);
      }
    }
  });

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
        renderClients();
        refreshDashboard();
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
        renderClients();
        refreshDashboard();
        Toast.success('Client supprimé');
      }
    }
  }
  
  async function unarchiveClient(id) {
    if (typeof MistralGestion === 'undefined') return;
    
    MistralGestion.Clients.update(id, { archived: false, archived_at: null });
    renderClients();
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
    
    let client;
    if (id) {
      client = MistralGestion.Clients.update(id, data);
      Toast.success('Client modifié');
    } else {
      client = MistralGestion.Clients.create(data);
      Toast.success('Client créé');
    }
    
    closeModal('client');
    renderClients();
    refreshDashboard();
    
    // Reset form
    $('#client-id').value = '';
    $('#modal-client-title').textContent = 'Nouveau client';
    $('#form-client').reset();
    
    // Si un callback est en attente (création depuis un autre modal)
    if (pendingClientCallback && client && !id) {
      pendingClientCallback(client);
      
      // Rouvrir le modal d'origine
      if (pendingClientModalSource) {
        showModalWithData(pendingClientModalSource);
        Toast.success(`Client créé et ajouté`);
      }
      
      // Reset
      pendingClientCallback = null;
      pendingClientModalSource = null;
    }
  }
  
  // Ouvre un modal sans réinitialiser les données
  function showModalWithData(name) {
    const modal = $(`#modal-${name}`);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  // CRUD Instruments
  function editInstrument(id) {
    if (typeof MistralGestion === 'undefined') return;
    const instrument = MistralGestion.Instruments.get(id);
    if (!instrument) return;
    
    $('#modal-instrument-title').textContent = 'Modifier l\'instrument';
    $('#instrument-id').value = instrument.id;
    $('#instrument-reference').value = instrument.reference || '';
    $('#instrument-numero').value = instrument.numero || '';
    $('#instrument-nom').value = instrument.nom || '';
    $('#instrument-tonalite').value = instrument.tonalite || '';
    $('#instrument-gamme').value = instrument.gamme || '';
    $('#instrument-notes').value = instrument.nombre_notes || 9;
    $('#instrument-taille').value = instrument.taille || '53';
    populateMateriauxSelect(instrument.materiau || 'NS');
    $('#instrument-accordage').value = instrument.accordage || '440';
    $('#instrument-prix').value = instrument.prix_vente || '';
    $('#instrument-statut').value = instrument.statut || 'disponible';
    $('#instrument-layout').value = instrument.notes_layout || '';
    $('#instrument-description').value = instrument.description || '';
    $('#instrument-handpaner').value = instrument.handpaner_url || '';
    $('#instrument-commentaires').value = instrument.commentaires || '';
    
    showModal('instrument');
    
    // Initialiser les uploads et charger les médias existants
    initInstrumentUploads();
    loadInstrumentMediaForEdit(instrument);
  }
  
  async function deleteInstrument(id) {
    if (typeof MistralGestion === 'undefined') return;
    
    // Vérifier si l'instrument est en location
    const locations = MistralGestion.Locations.list();
    const locationEnCours = locations.find(l => l.instrument_id === id && l.statut === 'en_cours');
    
    if (locationEnCours) {
      Toast.error('Impossible de supprimer : cet instrument est actuellement en location');
      return;
    }
    
    const confirmed = await Confirm.show({
      title: 'Supprimer l\'instrument',
      message: 'Cette action est irréversible. L\'annonce associée sera également supprimée.',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      // Supprimer l'annonce associée si elle existe
      if (typeof GestionBoutique !== 'undefined') {
        GestionBoutique.depublierInstrument(id);
      }
      
      // Supprimer l'instrument
      MistralGestion.Instruments.delete(id);
      renderInstruments();
      refreshDashboard();
      Toast.success('Instrument supprimé');
    }
  }
  
  // ============================================================================
  // UPLOADS D'INSTRUMENT
  // ============================================================================
  
  // Stockage temporaire des médias uploadés
  let instrumentUploadedImages = [];
  let instrumentUploadedVideo = null;
  let instrumentImageUploadInputs = [];
  let instrumentVideoUploadInput = null;
  
  function initInstrumentUploads() {
    if (typeof MistralUpload === 'undefined') {
      console.warn('[Admin UI] MistralUpload non disponible');
      return;
    }
    
    // Reset les données
    instrumentUploadedImages = [];
    instrumentUploadedVideo = null;
    
    // Conteneur pour les uploads d'images
    const imagesContainer = $('#instrument-images-upload');
    if (imagesContainer) {
      imagesContainer.innerHTML = '';
      
      // Créer le premier input d'upload d'image
      addImageUploadInput();
    }
    
    // Conteneur pour l'upload de vidéo
    const videoContainer = $('#instrument-video-upload');
    if (videoContainer) {
      videoContainer.innerHTML = '';
      
      instrumentVideoUploadInput = MistralUpload.createUploadInput({
        id: 'instrument-video-file',
        acceptType: 'video',
        onSelect: async (file) => {
          try {
            // Sauvegarder en IndexedDB
            const result = await MistralUpload.saveVideo(file, `instrument_video_${Date.now()}`);
            instrumentUploadedVideo = {
              type: 'indexeddb',
              key: result.key,
              name: file.name,
              size: file.size
            };
            
            // Afficher preview
            showVideoPreview(file);
            Toast.success('Vidéo chargée');
          } catch (e) {
            console.error('[Admin UI] Erreur upload vidéo:', e);
            Toast.error('Erreur lors du chargement de la vidéo');
          }
        }
      });
      
      videoContainer.appendChild(instrumentVideoUploadInput);
    }
  }
  
  function addImageUploadInput() {
    const container = $('#instrument-images-upload');
    if (!container || typeof MistralUpload === 'undefined') return;
    
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '0.5rem';
    
    const input = MistralUpload.createUploadInput({
      id: `instrument-image-file-${Date.now()}`,
      acceptType: 'image',
      onSelect: async (file) => {
        try {
          // Convertir en base64 pour stockage
          const compress = isCompressionEnabled('instrument');
          const base64 = await fileToBase64(file, compress, 'hero');
          const imageData = {
            type: 'base64',
            data: base64,
            name: file.name,
            size: file.size
          };
          
          instrumentUploadedImages.push(imageData);
          
          // Afficher preview
          addImagePreview(base64, instrumentUploadedImages.length - 1);
          
          // Ajouter un nouveau champ d'upload si c'était le dernier
          if (wrapper === container.lastElementChild) {
            addImageUploadInput();
          }
          
          Toast.success('Image ajoutée');
        } catch (e) {
          console.error('[Admin UI] Erreur upload image:', e);
          Toast.error('Erreur lors du chargement de l\'image');
        }
      }
    });
    
    wrapper.appendChild(input);
    container.appendChild(wrapper);
    instrumentImageUploadInputs.push(input);
  }
  
  /**
   * Convertit un fichier image en base64, avec compression optionnelle
   * @param {File} file - Fichier à convertir
   * @param {boolean} compress - Activer la compression WebP
   * @param {string} profile - Profil de compression: 'hero', 'standard', 'thumbnail', 'avatar'
   */
  async function fileToBase64(file, compress = false, profile = 'hero') {
    // Si compression activée et MistralUpload disponible
    if (compress && file.type.startsWith('image/') && typeof MistralUpload !== 'undefined') {
      try {
        const result = await MistralUpload.compressImageAdvanced(file, profile);
        console.log(`[fileToBase64] Compressé (${profile}): ${(file.size/1024).toFixed(1)}KB → ${(result.main.size/1024).toFixed(1)}KB (${result.format})`);
        return result.main.dataURL;
      } catch (e) {
        console.warn('[fileToBase64] Compression échouée, fallback:', e);
      }
    }
    
    // Lecture directe sans compression
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Vérifie si la compression est activée pour un formulaire
   */
  function isCompressionEnabled(formId) {
    const checkbox = document.querySelector(`#${formId}-compress, [data-compress-for="${formId}"]`);
    return checkbox ? checkbox.checked : false;
  }
  
  function addImagePreview(src, index) {
    const container = $('#instrument-images-preview');
    if (!container) return;
    
    const preview = document.createElement('div');
    preview.className = 'upload-preview-item';
    preview.dataset.index = index;
    preview.innerHTML = `
      <img src="${src}" alt="Preview">
      <button type="button" class="upload-preview-remove" onclick="AdminUI.removeInstrumentImage(${index})">×</button>
    `;
    container.appendChild(preview);
  }
  
  function removeInstrumentImage(index) {
    instrumentUploadedImages.splice(index, 1);
    
    // Re-render les previews
    const container = $('#instrument-images-preview');
    if (container) {
      container.innerHTML = '';
      instrumentUploadedImages.forEach((img, i) => {
        if (img.type === 'base64') {
          addImagePreview(img.data, i);
        } else if (img.type === 'url') {
          addImagePreview(img.url, i);
        }
      });
    }
  }
  
  function showVideoPreview(file) {
    const container = $('#instrument-video-preview');
    if (!container) return;
    
    container.innerHTML = `
      <div class="upload-preview-item upload-preview-video">
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--admin-surface); border-radius: 8px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          <div>
            <div style="font-weight: 500;">${escapeHtml(file.name)}</div>
            <div style="font-size: 0.8rem; color: var(--admin-text-muted);">${(file.size / 1024 / 1024).toFixed(1)} Mo</div>
          </div>
          <button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.removeInstrumentVideo()" style="margin-left: auto;">Supprimer</button>
        </div>
      </div>
    `;
  }
  
  function removeInstrumentVideo() {
    instrumentUploadedVideo = null;
    const container = $('#instrument-video-preview');
    if (container) container.innerHTML = '';
  }
  
  function clearInstrumentMediaPreviews() {
    instrumentUploadedImages = [];
    instrumentUploadedVideo = null;
    
    const imagesPreview = $('#instrument-images-preview');
    if (imagesPreview) imagesPreview.innerHTML = '';
    
    const videoPreview = $('#instrument-video-preview');
    if (videoPreview) videoPreview.innerHTML = '';
    
    // Reset URLs manuelles
    if ($('#instrument-images-urls')) $('#instrument-images-urls').value = '';
    if ($('#instrument-video-url')) $('#instrument-video-url').value = '';
  }
  
  // Charger les médias existants lors de l'édition
  function loadInstrumentMediaForEdit(instrument) {
    clearInstrumentMediaPreviews();
    
    // Charger les images existantes
    if (instrument.images && instrument.images.length > 0) {
      instrument.images.forEach((url, index) => {
        instrumentUploadedImages.push({
          type: 'url',
          url: url
        });
        addImagePreview(url, index);
      });
    }
    
    // Charger la vidéo existante
    if (instrument.video) {
      instrumentUploadedVideo = {
        type: 'url',
        url: instrument.video
      };
      
      const container = $('#instrument-video-preview');
      if (container) {
        container.innerHTML = `
          <div class="upload-preview-item upload-preview-video">
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--admin-surface); border-radius: 8px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              <div>
                <div style="font-weight: 500;">Vidéo existante</div>
                <div style="font-size: 0.8rem; color: var(--admin-text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(instrument.video)}</div>
              </div>
              <button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.removeInstrumentVideo()" style="margin-left: auto;">Supprimer</button>
            </div>
          </div>
        `;
      }
    }
  }
  
  // Récupérer les médias pour la sauvegarde
  function getInstrumentMediaForSave() {
    const images = [];
    const urlsText = $('#instrument-images-urls')?.value || '';
    
    // Ajouter les images uploadées
    instrumentUploadedImages.forEach(img => {
      if (img.type === 'base64') {
        images.push(img.data);
      } else if (img.type === 'url') {
        images.push(img.url);
      }
    });
    
    // Ajouter les URLs manuelles
    if (urlsText) {
      urlsText.split('\n').map(s => s.trim()).filter(s => s).forEach(url => {
        if (!images.includes(url)) {
          images.push(url);
        }
      });
    }
    
    // Vidéo
    let video = null;
    const videoUrl = $('#instrument-video-url')?.value?.trim();
    
    if (instrumentUploadedVideo) {
      if (instrumentUploadedVideo.type === 'indexeddb') {
        // Pour IndexedDB, on stocke la clé (à gérer différemment si besoin)
        video = `indexeddb:${instrumentUploadedVideo.key}`;
      } else if (instrumentUploadedVideo.type === 'url') {
        video = instrumentUploadedVideo.url;
      }
    } else if (videoUrl) {
      video = videoUrl;
    }
    
    return { images, video };
  }
  
  // Convertit un nombre en chiffres romains
  function toRoman(num) {
    const romans = [
      { value: 36, numeral: 'XXXVI' },
      { value: 35, numeral: 'XXXV' },
      { value: 34, numeral: 'XXXIV' },
      { value: 33, numeral: 'XXXIII' },
      { value: 32, numeral: 'XXXII' },
      { value: 31, numeral: 'XXXI' },
      { value: 30, numeral: 'XXX' },
      { value: 29, numeral: 'XXIX' },
      { value: 28, numeral: 'XXVIII' },
      { value: 27, numeral: 'XXVII' },
      { value: 26, numeral: 'XXVI' },
      { value: 25, numeral: 'XXV' },
      { value: 24, numeral: 'XXIV' },
      { value: 23, numeral: 'XXIII' },
      { value: 22, numeral: 'XXII' },
      { value: 21, numeral: 'XXI' },
      { value: 20, numeral: 'XX' },
      { value: 19, numeral: 'XIX' },
      { value: 18, numeral: 'XVIII' },
      { value: 17, numeral: 'XVII' },
      { value: 16, numeral: 'XVI' },
      { value: 15, numeral: 'XV' },
      { value: 14, numeral: 'XIV' },
      { value: 13, numeral: 'XIII' },
      { value: 12, numeral: 'XII' },
      { value: 11, numeral: 'XI' },
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 8, numeral: 'VIII' },
      { value: 7, numeral: 'VII' }
    ];
    for (const { value, numeral } of romans) {
      if (num >= value) return numeral;
    }
    return String(num);
  }
  
  // Met à jour la référence automatiquement
  function updateInstrumentReference() {
    const materiau = $('#instrument-materiau')?.value || 'NS';
    const tonalite = $('#instrument-tonalite')?.value || '';
    const gamme = $('#instrument-gamme')?.value || '';
    const notes = parseInt($('#instrument-notes')?.value) || 9;
    const numero = $('#instrument-numero')?.value || '';
    
    // Format: MP-HP-NS-D KURD IX-00102
    let ref = 'MP-HP';
    
    // Matériau (NS ou ES)
    ref += '-' + (materiau === 'ES' ? 'ES' : materiau === 'SS' ? 'SS' : 'NS');
    
    // Tonalité + Gamme + Notes en chiffres romains
    if (tonalite || gamme) {
      ref += '-';
      if (tonalite) ref += tonalite;
      if (gamme) ref += ' ' + gamme;
      ref += ' ' + toRoman(notes);
    }
    
    // Numéro
    if (numero) {
      ref += '-' + numero;
    }
    
    $('#instrument-reference').value = ref;
  }
  
  /**
   * Parse une URL Handpaner.com pour extraire les notes
   * Format URL: https://handpaner.com/#D/-A-A#-C-D-E-F-G-A-C_
   * 
   * Convention de notation Handpaner:
   * - NOTE/ = Ding (note centrale)
   * - (NOTE) = Bottom (note sous le Ding)
   * - NOTE = Note standard sur le cercle tonal
   * - [NOTE] = Mutant ou cyclope
   */
  function parseHandpanerUrl() {
    const url = $('#instrument-handpaner')?.value?.trim() || '';
    
    // Vérifier que c'est bien une URL Handpaner avec le format attendu
    if (!url.includes('handpaner.com/#') && !url.includes('handpaner.com/handpan/')) {
      return;
    }
    
    try {
      let hashPart = '';
      
      // Extraire la partie après le premier # 
      // Attention: les notes peuvent contenir des # (ex: A#), donc on doit reconstruire
      if (url.includes('#')) {
        const parts = url.split('#');
        hashPart = parts.slice(1).join('#'); // Rejoindre toutes les parties après le premier #
      }
      
      if (!hashPart) return;
      
      // Nettoyer le _ final si présent
      hashPart = hashPart.replace(/_$/, '');
      
      // Séparer le Ding des autres notes (le / sépare le Ding du reste)
      const slashIndex = hashPart.indexOf('/');
      if (slashIndex === -1) return;
      
      const dingPart = hashPart.substring(0, slashIndex); // Ex: "D" ou "C#2"
      const notesPart = hashPart.substring(slashIndex + 1); // Ex: "-A-A#-C-D-E-F-G-A-C"
      
      // Parser le Ding (note + octave optionnelle)
      let ding = '';
      let dingOctave = '';
      
      // Regex pour capturer la note (avec # ou b) et l'octave optionnelle
      const dingMatch = dingPart.match(/^([A-Ga-g][#b]?)(\d)?$/);
      if (dingMatch) {
        ding = dingMatch[1];
        if (dingMatch[2]) {
          dingOctave = dingMatch[2];
        }
      } else {
        ding = dingPart;
      }
      
      // Parser les notes - attention au format avec tirets
      // Le format est: -A-A#-C-D-E-F-G-A-C
      // On doit gérer les notes avec # et b correctement
      const notesArray = parseHandpanerNotes(notesPart);
      
      // Construire la chaîne de sortie avec la convention Handpaner
      let result = ding + (dingOctave ? dingOctave : '') + '/';
      
      // Ajouter les notes
      result += ' ' + notesArray.join(' ');
      
      // Remplir le champ notes_layout
      const layoutField = $('#instrument-layout');
      if (layoutField) {
        layoutField.value = result;
      }
      
      // Aussi remplir la tonalité si elle est vide
      const tonaliteField = $('#instrument-tonalite');
      if (tonaliteField && !tonaliteField.value && ding) {
        // Normaliser le ding pour correspondre aux options du select (majuscule, garder #)
        const normalizedDing = ding.charAt(0).toUpperCase() + ding.substring(1);
        // Trouver l'option correspondante
        const options = Array.from(tonaliteField.options);
        const match = options.find(opt => opt.value === normalizedDing || opt.value.toUpperCase() === normalizedDing.toUpperCase());
        if (match) {
          tonaliteField.value = match.value;
          updateInstrumentReference();
        }
      }
      
      // Mettre à jour le nombre de notes
      const notesField = $('#instrument-notes');
      if (notesField) {
        const totalNotes = notesArray.length + 1; // +1 pour le Ding
        if (totalNotes >= 7 && totalNotes <= 36) {
          notesField.value = totalNotes;
          updateInstrumentReference();
        }
      }
      
    } catch (e) {
      console.warn('[Admin UI] Erreur parsing URL Handpaner:', e);
    }
  }
  
  /**
   * Parse les notes depuis le format Handpaner
   * Input: "-A-A#-C-D-E-F-G-A-C" ou "(G#)-A-A#-C-D" (avec bottom)
   * Output: ['A', 'A#', 'C', 'D', 'E', 'F', 'G', 'A', 'C']
   */
  function parseHandpanerNotes(notesPart) {
    const notes = [];
    let i = 0;
    
    while (i < notesPart.length) {
      const char = notesPart[i];
      
      // Ignorer les tirets de séparation
      if (char === '-') {
        i++;
        continue;
      }
      
      // Bottom note entre parenthèses
      if (char === '(') {
        const endParen = notesPart.indexOf(')', i);
        if (endParen !== -1) {
          const bottomNote = notesPart.substring(i + 1, endParen);
          notes.push('(' + bottomNote + ')');
          i = endParen + 1;
          continue;
        }
      }
      
      // Mutant/cyclope entre crochets
      if (char === '[') {
        const endBracket = notesPart.indexOf(']', i);
        if (endBracket !== -1) {
          const mutantNote = notesPart.substring(i + 1, endBracket);
          notes.push('[' + mutantNote + ']');
          i = endBracket + 1;
          continue;
        }
      }
      
      // Note standard (lettre + optionnel # ou b + optionnel chiffre d'octave)
      if (/[A-Ga-g]/.test(char)) {
        let note = char.toUpperCase();
        i++;
        
        // Vérifier si # ou b suit
        if (i < notesPart.length && (notesPart[i] === '#' || notesPart[i] === 'b')) {
          note += notesPart[i];
          i++;
        }
        
        // Vérifier si un chiffre d'octave suit
        if (i < notesPart.length && /\d/.test(notesPart[i])) {
          note += notesPart[i];
          i++;
        }
        
        notes.push(note);
        continue;
      }
      
      // Caractère inconnu, avancer
      i++;
    }
    
    return notes;
  }
  
  function saveInstrument() {
    if (typeof MistralGestion === 'undefined') return;
    
    const id = $('#instrument-id')?.value;
    
    // Récupérer les médias (uploadés ou URLs)
    const media = getInstrumentMediaForSave();
    
    const data = {
      reference: $('#instrument-reference')?.value.trim(),
      numero: $('#instrument-numero')?.value.trim(),
      nom: $('#instrument-nom')?.value.trim(),
      tonalite: $('#instrument-tonalite')?.value,
      gamme: $('#instrument-gamme')?.value,
      nombre_notes: parseInt($('#instrument-notes')?.value) || 9,
      taille: $('#instrument-taille')?.value,
      materiau: $('#instrument-materiau')?.value,
      accordage: $('#instrument-accordage')?.value || '440',
      prix_vente: parseFloat($('#instrument-prix')?.value) || null,
      statut: $('#instrument-statut')?.value || 'disponible',
      notes_layout: $('#instrument-layout')?.value.trim(),
      description: $('#instrument-description')?.value.trim(),
      images: media.images,
      video: media.video,
      handpaner_url: $('#instrument-handpaner')?.value.trim(),
      commentaires: $('#instrument-commentaires')?.value.trim()
    };
    
    // Validation
    if (!data.numero) {
      Toast.error('Numéro de série requis');
      return;
    }
    
    if (!data.tonalite || !data.gamme) {
      Toast.error('Tonalité et gamme requis');
      return;
    }
    
    // Générer un nom par défaut si vide
    if (!data.nom) {
      data.nom = `${data.tonalite} ${data.gamme} ${data.nombre_notes} notes`;
    }
    
    let instrument;
    if (id) {
      instrument = MistralGestion.Instruments.update(id, data);
      
      // Mettre à jour l'annonce si elle existe
      if (typeof GestionBoutique !== 'undefined' && GestionBoutique.estPublie(id)) {
        GestionBoutique.mettreAJourAnnonce(id);
      }
      
      Toast.success('Instrument modifié');
    } else {
      instrument = MistralGestion.Instruments.create(data);
      Toast.success('Instrument créé');
    }
    
    closeModal('instrument');
    renderInstruments();
    refreshDashboard();
    
    // Reset
    $('#instrument-id').value = '';
    $('#modal-instrument-title').textContent = 'Nouvel instrument';
    $('#form-instrument').reset();
    $('#instrument-reference').value = '';
    
    // Si un callback est en attente (création depuis facture)
    if (pendingInstrumentCallback && instrument && !id) {
      // Récupérer l'instrument complet avec l'ID
      const createdInstrument = MistralGestion.Instruments.list().find(i => i.reference === data.reference) || instrument;
      pendingInstrumentCallback({
        id: createdInstrument.id,
        nom: createdInstrument.nom || data.nom,
        reference: createdInstrument.reference || data.reference,
        prix_vente: createdInstrument.prix_vente || data.prix_vente || 0
      });
      
      // Rouvrir le modal d'origine
      if (pendingInstrumentModalSource) {
        showModalWithData(pendingInstrumentModalSource);
        Toast.info(`Instrument ajouté à la facture`);
      }
      
      // Reset
      pendingInstrumentCallback = null;
      pendingInstrumentModalSource = null;
    }
    
    // Si on doit publier l'instrument après création (depuis boutique)
    if (publishAfterInstrumentCreation && instrument && !id) {
      // Récupérer l'instrument complet avec l'ID
      const createdInstrument = MistralGestion.Instruments.list().find(i => i.reference === data.reference) || instrument;
      
      // Vérifier qu'il a un prix
      if (createdInstrument.prix_vente && createdInstrument.prix_vente > 0) {
        MistralGestion.Instruments.update(createdInstrument.id, { statut: 'en_ligne' });
        renderBoutique();
        Toast.success('Instrument créé et publié dans la boutique');
      } else {
        Toast.info('Instrument créé. Ajoutez un prix pour le publier.');
      }
      
      publishAfterInstrumentCreation = false;
    }
  }

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
    
    if (id) {
      MistralGestion.Locations.update(id, data);
      Toast.success('Location modifiée');
    } else {
      MistralGestion.Locations.create(data);
      // Mettre à jour le statut de l'instrument
      MistralGestion.Instruments.update(instrumentId, { statut: 'en_location' });
      Toast.success('Location créée');
    }
    
    closeModal('location');
    renderLocations();
    renderInstruments();
    refreshDashboard();
    
    // Reset
    $('#location-id').value = '';
    $('#location-client-id').value = '';
    $('#location-instrument-id').value = '';
    $('#modal-location-title').textContent = 'Nouvelle location';
    $('#form-location').reset();
  }

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
    
    const data = {
      client_id: clientId,
      date_commande: $('#commande-date')?.value || new Date().toISOString().split('T')[0],
      description: $('#commande-description')?.value.trim(),
      montant_total: parseFloat($('#commande-montant')?.value) || 0,
      acompte_verse: parseFloat($('#commande-acompte')?.value) || 0,
      statut_paiement: $('#commande-paiement-statut')?.value || 'en_attente',
      statut: $('#commande-statut')?.value || 'en_attente',
      notes: $('#commande-notes')?.value.trim()
    };
    
    if (id) {
      MistralGestion.Commandes.update(id, data);
      Toast.success('Commande modifiée');
    } else {
      MistralGestion.Commandes.create(data);
      Toast.success('Commande créée');
    }
    
    closeModal('commande');
    renderCommandes();
    refreshDashboard();
    
    // Reset
    $('#commande-id').value = '';
    $('#commande-client-id').value = '';
    $('#modal-commande-title').textContent = 'Nouvelle commande';
    $('#form-commande').reset();
  }

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
    
    // Collecter les lignes
    const lignes = [];
    $$('#facture-lignes .facture-ligne').forEach(row => {
      const desc = row.querySelector('[name="ligne-desc"]')?.value.trim();
      const qte = parseInt(row.querySelector('[name="ligne-qte"]')?.value) || 1;
      const pu = parseFloat(row.querySelector('[name="ligne-pu"]')?.value) || 0;
      if (desc && pu > 0) {
        lignes.push({ description: desc, quantite: qte, prix_unitaire: pu });
      }
    });
    
    const montantHT = lignes.reduce((sum, l) => sum + (l.quantite * l.prix_unitaire), 0);
    
    const data = {
      client_id: clientId,
      date_emission: $('#facture-date')?.value || new Date().toISOString().split('T')[0],
      type: $('#facture-type')?.value || 'vente',
      lignes: lignes,
      montant_ht: montantHT,
      montant_ttc: montantHT, // Pas de TVA (auto-entrepreneur)
      statut_paiement: $('#facture-paiement-statut')?.value || 'en_attente',
      date_echeance: $('#facture-echeance')?.value || null,
      notes: $('#facture-notes')?.value.trim()
    };
    
    if (id) {
      MistralGestion.Factures.update(id, data);
      Toast.success('Facture modifiée');
    } else {
      MistralGestion.Factures.create(data);
      Toast.success('Facture créée');
    }
    
    closeModal('facture');
    renderFactures();
    refreshDashboard();
    
    // Reset
    $('#facture-id').value = '';
    $('#facture-client-id').value = '';
    $('#modal-facture-title').textContent = 'Nouvelle facture';
    $('#form-facture').reset();
    renderFactureLignes([]);
  }
  
  function addFactureLigne() {
    const container = $('#facture-lignes');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'facture-ligne';
    row.innerHTML = `
      <textarea name="ligne-desc" placeholder="Description" class="admin-form__input facture-ligne__desc" rows="1"></textarea>
      <input type="number" name="ligne-qte" value="1" min="1" class="admin-form__input" onchange="AdminUI.updateFactureTotaux()">
      <input type="number" name="ligne-pu" placeholder="P.U." min="0" step="0.01" class="admin-form__input" onchange="AdminUI.updateFactureTotaux()">
      <input type="text" name="ligne-total" readonly class="admin-form__input" style="background: var(--admin-border);">
      <button type="button" class="facture-ligne__remove" onclick="this.parentElement.remove(); AdminUI.updateFactureTotaux();">
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
        <input type="number" name="ligne-qte" value="${l.quantite || 1}" min="1" class="admin-form__input" onchange="AdminUI.updateFactureTotaux()">
        <input type="number" name="ligne-pu" value="${l.prix_unitaire || 0}" min="0" step="0.01" class="admin-form__input" onchange="AdminUI.updateFactureTotaux()">
        <input type="text" name="ligne-total" readonly value="${formatPrice((l.quantite || 1) * (l.prix_unitaire || 0))}" class="admin-form__input" style="background: var(--admin-border);">
        <button type="button" class="facture-ligne__remove" onclick="this.parentElement.remove(); AdminUI.updateFactureTotaux();">
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
    if (typeof MistralGestionPDF !== 'undefined') {
      MistralGestionPDF.generateFacture(id);
    } else {
      Toast.error('Module PDF non chargé');
    }
  }
  
  function marquerPayee(id) {
    if (typeof MistralGestion !== 'undefined') {
      MistralGestion.Factures.update(id, { 
        statut_paiement: 'paye', 
        date_paiement: new Date().toISOString().split('T')[0] 
      });
      renderFactures();
      refreshDashboard();
      Toast.success('Facture marquée comme payée');
    }
  }
  
  /**
   * Envoyer une facture par email au client
   * 
   * TODO: À développer - Intégration email
   * ========================================
   * Options possibles pour l'envoi d'emails :
   * 
   * 1. API EmailJS (gratuit jusqu'à 200 emails/mois)
   *    - Pas besoin de backend
   *    - Configuration via dashboard EmailJS
   *    - https://www.emailjs.com/
   * 
   * 2. API Brevo (ex-Sendinblue) (gratuit jusqu'à 300 emails/jour)
   *    - API REST simple
   *    - Templates d'emails
   *    - https://www.brevo.com/
   * 
   * 3. Backend PHP avec mail() ou PHPMailer
   *    - Nécessite un serveur PHP
   *    - Plus de contrôle
   * 
   * 4. Ouvrir le client email local (mailto:)
   *    - Solution temporaire simple
   *    - Pas d'envoi automatique, mais pré-remplit l'email
   * 
   * Structure de l'email à envoyer :
   * - Destinataire : client.email
   * - Objet : "Facture {numero} - Mistral Pans"
   * - Corps : Message personnalisé + lien/pièce jointe PDF
   * - Pièce jointe : PDF de la facture (généré par gestion-pdf.js)
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
    
    // Pour l'instant : ouvrir le client email local avec mailto:
    // TODO: Remplacer par un vrai envoi d'email via API
    const subject = encodeURIComponent(`Facture ${facture.numero} - Mistral Pans`);
    const body = encodeURIComponent(
      `Bonjour ${client.prenom},\n\n` +
      `Veuillez trouver ci-joint la facture ${facture.numero} d'un montant de ${formatPrice(facture.montant_ttc || facture.total || 0)}.\n\n` +
      `Date d'émission : ${formatDate(facture.date_emission || facture.date)}\n` +
      `Échéance : ${facture.date_echeance ? formatDate(facture.date_echeance) : 'À réception'}\n\n` +
      `Merci de votre confiance.\n\n` +
      `Cordialement,\n` +
      `Mistral Pans\n\n` +
      `---\n` +
      `Note : La facture PDF doit être jointe manuellement à cet email.\n` +
      `Téléchargez-la depuis l'interface d'administration.`
    );
    
    // Ouvrir le client email
    window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, '_blank');
    
    Toast.info('Client email ouvert - Pensez à joindre le PDF !');
    
    // TODO: Quand l'API email sera configurée :
    // 1. Générer le PDF en base64
    // 2. Appeler l'API d'envoi avec le PDF en pièce jointe
    // 3. Enregistrer la date d'envoi dans la facture
    // 4. Afficher un badge "Envoyée" dans la liste
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
      renderFactures();
      refreshDashboard();
      Toast.info('Facture annulée');
    }
  }
  
  // Fonctions Location supplémentaires
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
      
      renderLocations();
      renderInstruments();
      refreshDashboard();
      Toast.success('Location terminée');
    }
  }
  
  function downloadContrat(id) {
    if (typeof MistralGestionPDF !== 'undefined') {
      MistralGestionPDF.generateContrat(id);
    } else {
      Toast.error('Module PDF non chargé');
    }
  }

  // Boutique
  function editAnnonce(id) { console.log('TODO: editAnnonce', id); }
  function toggleAnnonce(id) {
    const annonces = Storage.get('mistral_flash_annonces', []);
    const index = annonces.findIndex(a => a.id === id);
    if (index !== -1) {
      annonces[index].active = !annonces[index].active;
      Storage.set('mistral_flash_annonces', annonces);
      renderBoutique();
    }
  }
  async function deleteAnnonce(id) {
    const confirmed = await Confirm.show({
      title: 'Supprimer l\'annonce',
      message: 'Cette action est irréversible.',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      const annonces = Storage.get('mistral_flash_annonces', []);
      Storage.set('mistral_flash_annonces', annonces.filter(a => a.id !== id));
      renderBoutique();
      Toast.success('Annonce supprimée');
    }
  }

  // Professeurs
  function approveTeacher(id) {
    const pending = Storage.get('mistral_pending_teachers', []);
    const teacher = pending.find(t => t.id === id);
    if (teacher) {
      const teachers = Storage.get('mistral_teachers', []);
      teachers.push(teacher);
      Storage.set('mistral_teachers', teachers);
      Storage.set('mistral_pending_teachers', pending.filter(t => t.id !== id));
      renderProfesseurs();
      refreshDashboard();
      Toast.success('Professeur approuvé');
    }
  }
  async function rejectTeacher(id) {
    const confirmed = await Confirm.show({
      title: 'Rejeter la demande',
      message: 'Cette demande sera supprimée.',
      confirmText: 'Rejeter',
      type: 'danger'
    });
    
    if (confirmed) {
      const pending = Storage.get('mistral_pending_teachers', []);
      Storage.set('mistral_pending_teachers', pending.filter(t => t.id !== id));
      renderProfesseurs();
      refreshDashboard();
      Toast.info('Demande rejetée');
    }
  }
  function editTeacher(id) {
    const teachers = Storage.get('mistral_teachers', []);
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) {
      Toast.error('Professeur non trouvé');
      return;
    }
    
    // Stocker l'ID du professeur en cours d'édition
    currentEditingTeacherId = id;
    
    // Ouvrir le modal
    showModal('professeur');
    
    // Générer le formulaire dans le modal
    const container = document.getElementById('edit-teacher-form-container');
    if (container && typeof TeacherForm !== 'undefined') {
      container.innerHTML = TeacherForm.generate({
        formId: 'edit-teacher-form',
        mode: 'edit',
        showPhoto: true,
        showRecaptcha: false
      });
      TeacherForm.init('edit-teacher-form');
      
      // Pré-remplir les champs
      setTimeout(() => {
        const form = document.getElementById('edit-teacher-form');
        if (form) {
          // Nom
          const nameInput = form.querySelector('[name="name"]') || form.querySelector('#edit-teacher-form-name');
          if (nameInput) nameInput.value = teacher.name || '';
          
          // Email
          const emailInput = form.querySelector('[name="email"]') || form.querySelector('#edit-teacher-form-email');
          if (emailInput) emailInput.value = teacher.email || '';
          
          // Téléphone
          const phoneInput = form.querySelector('[name="phone"]') || form.querySelector('#edit-teacher-form-phone');
          if (phoneInput) phoneInput.value = teacher.phone || '';
          
          // Site web
          const websiteInput = form.querySelector('[name="website"]') || form.querySelector('#edit-teacher-form-website');
          if (websiteInput) websiteInput.value = teacher.website || '';
          
          // Code postal
          const postalInput = form.querySelector('[name="postalcode"]') || form.querySelector('#edit-teacher-form-postalcode');
          if (postalInput) postalInput.value = teacher.postalcode || '';
          
          // Ville
          const cityInput = form.querySelector('[name="city"]') || form.querySelector('#edit-teacher-form-city');
          if (cityInput) cityInput.value = teacher.city || '';
          
          // Bio
          const bioInput = form.querySelector('[name="bio"]') || form.querySelector('#edit-teacher-form-bio');
          if (bioInput) bioInput.value = teacher.bio || '';
          
          // Photo preview
          if (teacher.photo) {
            const photoPreview = form.querySelector('.teacher-form__photo-preview img');
            if (photoPreview) {
              photoPreview.src = teacher.photo;
              photoPreview.style.display = 'block';
            }
          }
          
          // Types de cours (checkboxes)
          if (teacher.courseTypes) {
            teacher.courseTypes.forEach(type => {
              const checkbox = form.querySelector(`[name="courseTypes"][value="${type}"]`);
              if (checkbox) checkbox.checked = true;
            });
          }
          
          // Niveaux
          if (teacher.levels) {
            teacher.levels.forEach(level => {
              const checkbox = form.querySelector(`[name="levels"][value="${level}"]`);
              if (checkbox) checkbox.checked = true;
            });
          }
          
          // Modes d'enseignement
          if (teacher.modes) {
            teacher.modes.forEach(mode => {
              const checkbox = form.querySelector(`[name="modes"][value="${mode}"]`);
              if (checkbox) checkbox.checked = true;
            });
          }
        }
      }, 100);
    }
  }
  
  // Variable pour stocker l'ID du professeur en cours d'édition
  let currentEditingTeacherId = null;
  
  async function saveTeacher() {
    if (!currentEditingTeacherId) {
      Toast.error('Aucun professeur en cours d\'édition');
      return;
    }
    
    if (typeof TeacherForm === 'undefined') {
      Toast.error('Module TeacherForm non chargé');
      return;
    }
    
    // Valider le formulaire
    if (!TeacherForm.validate('edit-teacher-form')) {
      return;
    }

    // Collecter les données
    const data = TeacherForm.collect('edit-teacher-form');
    
    // Géocoder l'adresse si modifiée
    if (data.postalcode && data.city) {
      Toast.info('Géolocalisation en cours...');
      const coords = await TeacherForm.geocode(data.postalcode, data.city);
      data.lat = coords.lat;
      data.lng = coords.lng;
    }
    
    // Mettre à jour le professeur
    const teachers = Storage.get('mistral_teachers', []);
    const index = teachers.findIndex(t => t.id === currentEditingTeacherId);
    
    if (index !== -1) {
      teachers[index] = { 
        ...teachers[index], 
        ...data, 
        updated_at: new Date().toISOString() 
      };
      Storage.set('mistral_teachers', teachers);
      
      // Fermer le modal
      closeModal('professeur');
      
      // Rafraîchir l'affichage
      renderProfesseurs();
      
      // Reset
      currentEditingTeacherId = null;
      
      Toast.success(`${data.name} a été modifié(e)`);
    } else {
      Toast.error('Erreur lors de la sauvegarde');
    }
  }
  async function deleteTeacher(id) {
    const confirmed = await Confirm.show({
      title: 'Supprimer le professeur',
      message: 'Cette action est irréversible.',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      const teachers = Storage.get('mistral_teachers', []);
      Storage.set('mistral_teachers', teachers.filter(t => t.id !== id));
      renderProfesseurs();
      Toast.success('Professeur supprimé');
    }
  }
  
  // Initialiser le formulaire d'ajout de professeur avec le composant TeacherForm
  function initAddTeacherForm() {
    const container = document.getElementById('add-teacher-form-container');
    if (container && typeof TeacherForm !== 'undefined') {
      container.innerHTML = TeacherForm.generate({
        formId: 'add-teacher-form',
        mode: 'add',
        showPhoto: true,
        showRecaptcha: false
      });
      TeacherForm.init('add-teacher-form');
    }
  }
  
  // Soumettre le formulaire d'ajout de professeur
  async function submitAddTeacherForm() {
    if (typeof TeacherForm === 'undefined') {
      Toast.error('Module TeacherForm non chargé');
      return;
    }
    
    // Valider le formulaire
    if (!TeacherForm.validate('add-teacher-form')) {
      return;
    }

    // Collecter les données
    const data = TeacherForm.collect('add-teacher-form');
    
    // Géocoder l'adresse
    if (data.postalcode && data.city) {
      Toast.info('Géolocalisation en cours...');
      const coords = await TeacherForm.geocode(data.postalcode, data.city);
      data.lat = coords.lat;
      data.lng = coords.lng;
    } else {
      // Coordonnées par défaut (Paris)
      data.lat = 48.8566;
      data.lng = 2.3522;
    }
    
    // Générer un ID unique
    data.id = 'teacher_' + Date.now();
    data.created_at = new Date().toISOString();
    
    // Ajouter aux professeurs actifs
    const teachers = Storage.get('mistral_teachers', []);
    teachers.push(data);
    Storage.set('mistral_teachers', teachers);
    
    // Reset le formulaire
    TeacherForm.reset('add-teacher-form');
    
    // Rafraîchir l'affichage
    renderProfesseurs();
    refreshDashboard();
    
    // Basculer vers l'onglet des professeurs actifs
    const activeTab = document.querySelector('[data-subtab="active"]');
    if (activeTab) activeTab.click();
    
    Toast.success(`${data.name} a été ajouté(e)`);
  }

  // ============================================================================
  // COMPTABILITÉ & URSSAF
  // ============================================================================
  
  /**
   * Classification des types de factures :
   * - BIC (Bénéfices Industriels et Commerciaux) : ventes, locations, acomptes, soldes
   * - BNC (Bénéfices Non Commerciaux) : prestations de services
   */
  const TYPE_CLASSIFICATION = {
    'vente': 'BIC',
    'acompte': 'BIC',
    'solde': 'BIC',
    'location': 'BIC',
    'prestation': 'BNC',
    'avoir': 'AVOIR' // Les avoirs réduisent le CA
  };
  
  function initComptabilite() {
    // Initialiser le sélecteur de mois
    const select = $('#compta-mois');
    if (!select) return;
    
    const now = new Date();
    select.innerHTML = '';
    
    // Générer les 12 derniers mois
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
      select.appendChild(option);
    }
    
    // Événement changement de mois
    select.addEventListener('change', () => renderComptabilite());
    
    // Charger la configuration
    loadComptaConfig();
    
    // Afficher le mois en cours
    renderComptabilite();
  }
  
  function renderComptabilite() {
    if (typeof MistralGestion === 'undefined') return;
    
    const moisSelect = $('#compta-mois');
    const mois = moisSelect?.value || new Date().toISOString().slice(0, 7);
    
    // Récupérer les factures du mois (payées uniquement, hors annulées)
    const factures = MistralGestion.Factures.list().filter(f => {
      return f.date && 
             f.date.startsWith(mois) && 
             f.statut_paiement === 'paye' && 
             f.statut !== 'annulee';
    });
    
    // Calculer BIC et BNC
    let totalBIC = 0;
    let totalBNC = 0;
    let totalAvoir = 0;
    
    factures.forEach(f => {
      const montant = f.total || f.montant_ttc || 0;
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC';
      
      if (classification === 'BIC') {
        totalBIC += montant;
      } else if (classification === 'BNC') {
        totalBNC += montant;
      } else if (classification === 'AVOIR') {
        totalAvoir += montant;
      }
    });
    
    // Appliquer les avoirs (réduire le BIC par défaut)
    totalBIC = Math.max(0, totalBIC - totalAvoir);
    
    // Afficher les totaux
    if ($('#compta-bic')) $('#compta-bic').textContent = formatPrice(totalBIC);
    if ($('#compta-bnc')) $('#compta-bnc').textContent = formatPrice(totalBNC);
    if ($('#compta-total')) $('#compta-total').textContent = formatPrice(totalBIC + totalBNC);
    
    // Afficher le détail des factures
    renderComptaFactures(factures, mois);
  }
  
  function renderComptaFactures(factures, mois) {
    const tbody = $('#compta-factures-list');
    if (!tbody) return;
    
    if (!factures.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--admin-text-muted); padding: 2rem;">Aucune facture payée ce mois</td></tr>`;
      return;
    }
    
    // Trier par date
    factures.sort((a, b) => a.date.localeCompare(b.date));
    
    tbody.innerHTML = factures.map(f => {
      const client = MistralGestion.Clients.get(f.client_id);
      const clientNom = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : 'Client inconnu';
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC';
      const montant = f.total || f.montant_ttc || 0;
      
      const typeLabels = {
        'vente': 'Vente',
        'acompte': 'Acompte',
        'solde': 'Solde',
        'location': 'Location',
        'prestation': 'Prestation',
        'avoir': 'Avoir'
      };
      
      return `
        <tr>
          <td>${formatDate(f.date)}</td>
          <td><a href="#" onclick="AdminUI.editFacture('${f.id}'); return false;" style="color: var(--admin-accent);">${f.numero || f.id}</a></td>
          <td>${escapeHtml(clientNom)}</td>
          <td>${typeLabels[f.type] || f.type}</td>
          <td><span class="admin-badge admin-badge--${classification === 'BNC' ? 'warning' : classification === 'AVOIR' ? 'neutral' : 'success'}">${classification}</span></td>
          <td style="text-align: right; font-weight: 500;">${classification === 'AVOIR' ? '-' : ''}${formatPrice(montant)}</td>
        </tr>
      `;
    }).join('');
  }
  
  function genererRapportMensuel() {
    const moisSelect = $('#compta-mois');
    const mois = moisSelect?.value || new Date().toISOString().slice(0, 7);
    const [annee, moisNum] = mois.split('-');
    
    const moisLabel = new Date(annee, parseInt(moisNum) - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    
    // Récupérer les données
    const factures = MistralGestion.Factures.list().filter(f => {
      return f.date && 
             f.date.startsWith(mois) && 
             f.statut_paiement === 'paye' && 
             f.statut !== 'annulee';
    });
    
    let totalBIC = 0;
    let totalBNC = 0;
    
    factures.forEach(f => {
      const montant = f.total || f.montant_ttc || 0;
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC';
      if (classification === 'BIC') totalBIC += montant;
      else if (classification === 'BNC') totalBNC += montant;
    });
    
    // Générer le PDF avec jsPDF
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      Toast.error('Module PDF non chargé');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // En-tête
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport Comptable Mensuel', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1), 105, 30, { align: 'center' });
    
    // Informations entreprise
    const config = Storage.get('mistral_gestion_config', {});
    doc.setFontSize(10);
    doc.text(`${config.nom || 'Mistral Pan'}`, 20, 45);
    doc.text(`SIRET: ${config.siret || '889 482 758 00014'}`, 20, 50);
    
    // Résumé URSSAF
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Montants à déclarer URSSAF', 20, 65);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    // Tableau récapitulatif
    doc.setFillColor(240, 240, 240);
    doc.rect(20, 70, 170, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Catégorie', 25, 77);
    doc.text('Régime', 100, 77);
    doc.text('Montant', 160, 77, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.text('Ventes & Locations', 25, 87);
    doc.text('BIC (Micro-entreprise)', 100, 87);
    doc.text(formatPrice(totalBIC), 185, 87, { align: 'right' });
    
    doc.text('Prestations de services', 25, 97);
    doc.text('BNC (Micro-entreprise)', 100, 97);
    doc.text(formatPrice(totalBNC), 185, 97, { align: 'right' });
    
    doc.setFillColor(220, 240, 220);
    doc.rect(20, 102, 170, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL CA', 25, 109);
    doc.text(formatPrice(totalBIC + totalBNC), 185, 109, { align: 'right' });
    
    // Détail des factures
    doc.setFontSize(14);
    doc.text('Détail des factures', 20, 130);
    
    doc.setFontSize(9);
    let y = 140;
    
    // En-tête tableau
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y - 5, 170, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 22, y);
    doc.text('N° Facture', 45, y);
    doc.text('Client', 80, y);
    doc.text('Type', 130, y);
    doc.text('Montant', 185, y, { align: 'right' });
    y += 8;
    
    doc.setFont('helvetica', 'normal');
    factures.sort((a, b) => a.date.localeCompare(b.date)).forEach(f => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      const client = MistralGestion.Clients.get(f.client_id);
      const clientNom = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : 'Inconnu';
      const montant = f.total || f.montant_ttc || 0;
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC';
      
      doc.text(formatDate(f.date), 22, y);
      doc.text(f.numero || f.id.slice(0, 10), 45, y);
      doc.text(clientNom.slice(0, 25), 80, y);
      doc.text(`${f.type} (${classification})`, 130, y);
      doc.text(formatPrice(montant), 185, y, { align: 'right' });
      y += 6;
    });
    
    // Pied de page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} - Page ${i}/${pageCount}`, 105, 290, { align: 'center' });
    }
    
    // Télécharger
    doc.save(`rapport-comptable-${mois}.pdf`);
    Toast.success('Rapport téléchargé');
  }
  
  /**
   * TODO: Envoi automatique mensuel
   * ================================
   * Options d'implémentation :
   * 
   * 1. CRON JOB + Backend PHP
   *    - Créer un script PHP qui génère et envoie le rapport
   *    - Configurer un cron sur le serveur: 0 8 1 * * php /path/to/send_report.php
   * 
   * 2. Service externe (Zapier, Make, n8n)
   *    - Webhook déclenché le 1er du mois
   *    - Appelle une API pour générer le rapport
   * 
   * 3. API EmailJS ou Brevo
   *    - Nécessite que l'utilisateur ouvre l'app le 1er du mois
   *    - Peut être combiné avec une notification push
   * 
   * Pour l'instant : envoi manuel avec mailto:
   */
  async function envoyerRapportMensuel() {
    const moisSelect = $('#compta-mois');
    const mois = moisSelect?.value || new Date().toISOString().slice(0, 7);
    const [annee, moisNum] = mois.split('-');
    
    const moisLabel = new Date(annee, parseInt(moisNum) - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    
    // Récupérer les données
    const factures = MistralGestion.Factures.list().filter(f => {
      return f.date && 
             f.date.startsWith(mois) && 
             f.statut_paiement === 'paye' && 
             f.statut !== 'annulee';
    });
    
    let totalBIC = 0;
    let totalBNC = 0;
    
    factures.forEach(f => {
      const montant = f.total || f.montant_ttc || 0;
      const classification = TYPE_CLASSIFICATION[f.type] || 'BIC';
      if (classification === 'BIC') totalBIC += montant;
      else if (classification === 'BNC') totalBNC += montant;
    });
    
    // Générer le contenu de l'email
    const config = Storage.get('mistral_gestion_config', {});
    const comptaConfig = Storage.get('mistral_compta_config', {});
    const emailDest = comptaConfig.emailDest || config.email || '';
    
    if (!emailDest) {
      Toast.error('Configurez l\'email de destination');
      return;
    }
    
    const subject = encodeURIComponent(`Rapport comptable - ${moisLabel}`);
    const body = encodeURIComponent(`
Rapport comptable Mistral Pan
${moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1)}
=====================================

MONTANTS À DÉCLARER URSSAF
--------------------------
BIC (Ventes & Locations) : ${formatPrice(totalBIC)}
BNC (Prestations)        : ${formatPrice(totalBNC)}
--------------------------
TOTAL CA                 : ${formatPrice(totalBIC + totalBNC)}

Nombre de factures : ${factures.length}

---
Ce rapport a été généré automatiquement.
Pensez à joindre le PDF du rapport détaillé.
    `.trim());
    
    // D'abord générer le PDF
    genererRapportMensuel();
    
    // Puis ouvrir le client mail
    setTimeout(() => {
      window.open(`mailto:${emailDest}?subject=${subject}&body=${body}`, '_blank');
      Toast.info('Email préparé - Joignez le PDF téléchargé');
    }, 500);
  }
  
  function saveComptaConfig() {
    const config = {
      autoEmail: $('#compta-auto-email')?.checked || false,
      emailDest: $('#compta-email-dest')?.value?.trim() || '',
      includeAnalytics: $('#compta-include-analytics')?.checked || true,
      includeFactures: $('#compta-include-factures')?.checked || true,
      includePdf: $('#compta-include-pdf')?.checked || true
    };
    
    Storage.set('mistral_compta_config', config);
    Toast.success('Configuration enregistrée');
    
    // TODO: Si autoEmail activé, planifier l'envoi automatique
    if (config.autoEmail) {
      Toast.info('L\'envoi automatique nécessite une configuration serveur');
    }
  }
  
  function loadComptaConfig() {
    const config = Storage.get('mistral_compta_config', {});
    
    if ($('#compta-auto-email')) $('#compta-auto-email').checked = config.autoEmail || false;
    if ($('#compta-email-dest')) $('#compta-email-dest').value = config.emailDest || '';
    if ($('#compta-include-analytics')) $('#compta-include-analytics').checked = config.includeAnalytics !== false;
    if ($('#compta-include-factures')) $('#compta-include-factures').checked = config.includeFactures !== false;
    if ($('#compta-include-pdf')) $('#compta-include-pdf').checked = config.includePdf !== false;
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  function init() {
    console.log('[Admin UI] Initialisation...');
    
    initNavigation();
    initSearchableSelects();
    initAddTeacherForm();
    refreshDashboard();
    loadTodos();
    
    // Charger la section depuis le hash ou défaut
    const hash = window.location.hash.replace('#', '');
    if (hash && $(`#section-${hash}`)) {
      navigateTo(hash);
    } else {
      refreshSection('dashboard');
    }
    
    // Event: Enter sur todo input
    const todoInput = $('#todo-input');
    if (todoInput) {
      todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
      });
    }
    
    // Event: Changement de période analytics
    const statsPeriod = $('#stats-period');
    if (statsPeriod) {
      statsPeriod.addEventListener('change', () => {
        renderAnalytics();
      });
    }
    
    console.log('[Admin UI] Prêt');
  }
  
  // ============================================================================
  // SEARCHABLE SELECTS (AUTOCOMPLÉTION)
  // ============================================================================
  
  // Variables pour stocker le modal d'origine lors de la création de client/instrument
  let pendingClientCallback = null;
  let pendingClientModalSource = null;
  let pendingInstrumentCallback = null;
  let pendingInstrumentModalSource = null;
  
  function initSearchableSelects() {
    // Fonction commune pour créer un client depuis un modal
    function createClientFromModal(targetPrefix) {
      // Mémoriser le modal source
      pendingClientModalSource = targetPrefix;
      
      // Sauvegarder le callback
      pendingClientCallback = (client) => {
        const idField = $(`#${targetPrefix}-client-id`);
        const searchField = $(`#${targetPrefix}-client-search`);
        if (idField) idField.value = client.id;
        if (searchField) searchField.value = `${client.prenom} ${client.nom}`;
      };
      
      // Fermer le modal actuel sans reset
      const currentModal = document.querySelector('.admin-modal-overlay.open');
      if (currentModal) {
        currentModal.classList.remove('open');
        document.body.style.overflow = '';
      }
      
      // Ouvrir le modal client (sans reset car c'est nouveau)
      const clientModal = $('#modal-client');
      if (clientModal) {
        // Reset le formulaire client
        $('#form-client')?.reset();
        $('#client-id').value = '';
        $('#modal-client-title').textContent = 'Nouveau client';
        clientModal.classList.add('open');
        document.body.style.overflow = 'hidden';
        
        // Focus sur le prénom
        setTimeout(() => {
          $('#client-prenom')?.focus();
        }, 100);
      }
    }
    
    // Fonction commune pour créer un instrument depuis un modal
    function createInstrumentFromModal(targetPrefix) {
      // Mémoriser le modal source
      pendingInstrumentModalSource = targetPrefix;
      
      // Sauvegarder le callback (sera appelé après création pour ajouter une ligne)
      pendingInstrumentCallback = (instrument) => {
        // Ajouter une ligne à la facture avec l'instrument créé
        addFactureLigneFromInstrument(instrument);
      };
      
      // Fermer le modal actuel sans reset
      const currentModal = document.querySelector('.admin-modal-overlay.open');
      if (currentModal) {
        currentModal.classList.remove('open');
        document.body.style.overflow = '';
      }
      
      // Ouvrir le modal instrument
      const instrumentModal = $('#modal-instrument');
      if (instrumentModal) {
        // Reset le formulaire instrument
        $('#form-instrument')?.reset();
        $('#instrument-id').value = '';
        $('#instrument-reference').value = '';
        $('#modal-instrument-title').textContent = 'Nouvel instrument';
        instrumentModal.classList.add('open');
        document.body.style.overflow = 'hidden';
        
        // Focus sur le numéro
        setTimeout(() => {
          $('#instrument-numero')?.focus();
        }, 100);
      }
    }
    
    // Location - Client (avec création)
    setupSearchableSelect('location-client', getClientsForSearch, (item) => {
      $('#location-client-id').value = item.id;
      $('#location-client-search').value = `${item.prenom} ${item.nom}`;
    }, {
      allowCreate: true,
      createLabel: '+ Créer un nouveau client',
      onCreate: () => createClientFromModal('location')
    });
    
    // Location - Instrument
    setupSearchableSelect('location-instrument', getInstrumentsForSearch, (item) => {
      $('#location-instrument-id').value = item.id;
      $('#location-instrument-search').value = item.nom;
    });
    
    // Commande - Client (avec création)
    setupSearchableSelect('commande-client', getClientsForSearch, (item) => {
      $('#commande-client-id').value = item.id;
      $('#commande-client-search').value = `${item.prenom} ${item.nom}`;
    }, {
      allowCreate: true,
      createLabel: '+ Créer un nouveau client',
      onCreate: () => createClientFromModal('commande')
    });
    
    // Facture - Client (avec création)
    setupSearchableSelect('facture-client', getClientsForSearch, (item) => {
      $('#facture-client-id').value = item.id;
      $('#facture-client-search').value = `${item.prenom} ${item.nom}`;
    }, {
      allowCreate: true,
      createLabel: '+ Créer un nouveau client',
      onCreate: () => createClientFromModal('facture')
    });
    
    // Facture - Instrument (avec création) - Ajoute une ligne automatiquement
    setupSearchableSelect('facture-instrument', getInstrumentsForFacture, (item) => {
      // Ajouter une ligne à la facture avec cet instrument
      addFactureLigneFromInstrument(item);
      // Reset le champ de recherche
      $('#facture-instrument-search').value = '';
    }, {
      allowCreate: true,
      createLabel: '+ Créer un nouvel instrument',
      onCreate: () => createInstrumentFromModal('facture')
    });
  }
  
  // Ajoute une ligne de facture depuis un instrument
  function addFactureLigneFromInstrument(instrument) {
    const container = $('#facture-lignes');
    if (!container) return;
    
    const description = instrument.nom || instrument.reference || 'Handpan';
    const prix = instrument.prix || instrument.prix_vente || 0;
    
    const row = document.createElement('div');
    row.className = 'facture-ligne';
    row.dataset.instrumentId = instrument.id || '';
    row.innerHTML = `
      <textarea name="ligne-desc" class="admin-form__input facture-ligne__desc" rows="1">${escapeHtml(description)}</textarea>
      <input type="number" name="ligne-qte" value="1" min="1" class="admin-form__input" onchange="AdminUI.updateFactureTotaux()">
      <input type="number" name="ligne-pu" value="${prix}" min="0" step="0.01" class="admin-form__input" onchange="AdminUI.updateFactureTotaux()">
      <input type="text" name="ligne-total" readonly value="${formatPrice(prix)}" class="admin-form__input" style="background: var(--admin-border);">
      <button type="button" class="facture-ligne__remove" onclick="this.parentElement.remove(); AdminUI.updateFactureTotaux();">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    container.appendChild(row);
    
    // Auto-resize textarea
    const textarea = row.querySelector('textarea');
    textarea.addEventListener('input', autoResizeTextarea);
    
    updateFactureTotaux();
  }
  
  function setupSearchableSelect(prefix, getItems, onSelect, options = {}) {
    const { allowCreate = false, createLabel = 'Créer nouveau', onCreate = null } = options;
    
    const input = $(`#${prefix}-search`);
    const dropdown = $(`#${prefix}-dropdown`);
    if (!input || !dropdown) return;
    
    let activeIndex = -1;
    let items = [];
    
    input.addEventListener('input', () => {
      const query = input.value.toLowerCase().trim();
      items = getItems(query);
      activeIndex = -1;
      renderDropdown(items, dropdown, activeIndex, onSelect, allowCreate, createLabel);
      dropdown.classList.toggle('open', items.length > 0 || allowCreate);
    });
    
    input.addEventListener('focus', () => {
      const query = input.value.toLowerCase().trim();
      items = getItems(query);
      renderDropdown(items, dropdown, activeIndex, onSelect, allowCreate, createLabel);
      dropdown.classList.toggle('open', items.length > 0 || allowCreate);
    });
    
    input.addEventListener('keydown', (e) => {
      if (!dropdown.classList.contains('open')) return;
      
      const totalItems = allowCreate ? items.length + 1 : items.length;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, totalItems - 1);
        renderDropdown(items, dropdown, activeIndex, onSelect, allowCreate, createLabel);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        renderDropdown(items, dropdown, activeIndex, onSelect, allowCreate, createLabel);
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        if (activeIndex === items.length && allowCreate && onCreate) {
          onCreate();
        } else if (activeIndex < items.length) {
          onSelect(items[activeIndex]);
        }
        dropdown.classList.remove('open');
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('open');
      }
    });
    
    // Gérer l'événement "create-new"
    dropdown.addEventListener('create-new', () => {
      if (onCreate) onCreate();
    });
    
    // Fermer au clic externe
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }
  
  function renderDropdown(items, dropdown, activeIndex, onSelect, allowCreate = false, createLabel = 'Créer nouveau') {
    let html = '';
    
    if (!items.length && !allowCreate) {
      dropdown.innerHTML = '<div class="searchable-dropdown__empty">Aucun résultat</div>';
      return;
    }
    
    html = items.map((item, index) => `
      <div class="searchable-dropdown__item ${index === activeIndex ? 'active' : ''}" data-index="${index}">
        <div class="searchable-dropdown__label">${escapeHtml(item.label)}</div>
        ${item.subtitle ? `<div class="searchable-dropdown__subtitle">${escapeHtml(item.subtitle)}</div>` : ''}
      </div>
    `).join('');
    
    // Ajouter l'option "Créer nouveau" si autorisé
    if (allowCreate) {
      html += `
        <div class="searchable-dropdown__item searchable-dropdown__item--create" data-action="create">
          <div class="searchable-dropdown__label" style="color: var(--admin-accent); display: flex; align-items: center; gap: 0.5rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            ${escapeHtml(createLabel)}
          </div>
        </div>
      `;
    }
    
    dropdown.innerHTML = html;
    
    dropdown.querySelectorAll('.searchable-dropdown__item').forEach((el, idx) => {
      el.addEventListener('click', () => {
        if (el.dataset.action === 'create') {
          // Déclencher la création
          dropdown.dispatchEvent(new CustomEvent('create-new'));
        } else {
          onSelect(items[idx]);
        }
        dropdown.classList.remove('open');
      });
    });
  }
  
  function getClientsForSearch(query) {
    if (typeof MistralGestion === 'undefined') return [];
    const clients = MistralGestion.Clients.list();
    
    return clients
      .filter(c => {
        // Exclure les clients archivés des sélections
        if (c.archived) return false;
        if (!query) return true;
        const fullName = `${c.prenom} ${c.nom}`.toLowerCase();
        return fullName.includes(query) || (c.email && c.email.toLowerCase().includes(query));
      })
      .slice(0, 10)
      .map(c => ({
        id: c.id,
        prenom: c.prenom,
        nom: c.nom,
        label: `${c.prenom} ${c.nom}`,
        subtitle: c.email || c.telephone || ''
      }));
  }
  
  function getInstrumentsForSearch(query) {
    if (typeof MistralGestion === 'undefined') return [];
    // Pour les locations, on veut les instruments disponibles
    const instruments = MistralGestion.Instruments.list().filter(i => i.statut === 'disponible');
    
    return instruments
      .filter(i => {
        if (!query) return true;
        return (i.nom && i.nom.toLowerCase().includes(query)) ||
               (i.reference && i.reference.toLowerCase().includes(query)) ||
               (i.gamme && i.gamme.toLowerCase().includes(query));
      })
      .slice(0, 10)
      .map(i => ({
        id: i.id,
        nom: i.nom,
        label: i.nom,
        subtitle: `${i.reference || ''} ${i.gamme ? '· ' + i.gamme : ''}`
      }));
  }
  
  function getInstrumentsForFacture(query) {
    if (typeof MistralGestion === 'undefined') return [];
    // Pour les factures, on veut tous les instruments (disponibles ou vendus)
    const instruments = MistralGestion.Instruments.list();
    
    return instruments
      .filter(i => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (i.nom && i.nom.toLowerCase().includes(q)) ||
               (i.reference && i.reference.toLowerCase().includes(q)) ||
               (i.gamme && i.gamme.toLowerCase().includes(q));
      })
      .slice(0, 10)
      .map(i => ({
        id: i.id,
        nom: i.nom,
        reference: i.reference,
        prix: i.prix_vente || 0,
        label: i.nom || i.reference,
        subtitle: `${i.reference || ''} · ${formatPrice(i.prix_vente || 0)}`
      }));
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.AdminUI = {
    // Navigation
    init,
    goToTab,
    navigateTo,
    refreshAll,
    
    // Dashboard
    refreshDashboard,
    
    // To-Do
    addTodo,
    toggleTodo,
    deleteTodo,
    
    // Search
    searchClients,
    searchInstruments,
    
    // Clients
    editClient,
    deleteClient,
    unarchiveClient,
    saveClient,
    
    // Instruments
    editInstrument,
    deleteInstrument,
    saveInstrument,
    updateInstrumentReference,
    parseHandpanerUrl,
    removeInstrumentImage,
    removeInstrumentVideo,
    toggleBoutique,
    
    // Locations
    editLocation,
    terminerLocation,
    downloadContrat,
    saveLocation,
    
    // Commandes
    editCommande,
    saveCommande,
    
    // Factures
    editFacture,
    downloadFacture,
    envoyerFactureMail,
    marquerPayee,
    annulerFacture,
    saveFacture,
    addFactureLigne,
    addFactureLigneFromInstrument,
    updateFactureTotaux,
    
    // Boutique
    retirerDeBoutique,
    publierInstrumentSelectionne,
    creerEtPublierInstrument,
    saveAccessoire,
    editAccessoire,
    toggleAccessoire,
    deleteAccessoire,
    removeAccessoireImage,
    
    // Professeurs
    approveTeacher,
    rejectTeacher,
    editTeacher,
    deleteTeacher,
    submitAddTeacherForm,
    saveTeacher,
    
    // Comptabilité
    genererRapportMensuel,
    envoyerRapportMensuel,
    saveComptaConfig,
    
    // Galerie
    saveMedia,
    editMedia,
    deleteMedia,
    removeMediaImage,
    
    // Blog
    saveArticle,
    editArticle,
    toggleArticleStatut,
    deleteArticle,
    removeArticleImage,
    
    // Modals
    showModal,
    closeModal,
    
    // Config
    saveConfig,
    exportAllData,
    importData,
    resetAllData,

    // Matériaux
    renderMateriaux,
    editMateriau,
    saveMateriau,
    deleteMateriau,
    resetMateriaux,
    populateMateriauxSelect
  };

})(window);
