/* ==========================================================================
   MISTRAL PANS - Admin UI Core
   Module principal: Configuration, Navigation, Dashboard, Initialisation
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
  // UTILITAIRES PARTAGÉS
  // ============================================================================

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return document.querySelectorAll(selector);
  }

  // --- Delegations vers MistralUtils (js/core/utils.js) ---
  const escapeHtml  = MistralUtils.escapeHtml;
  const formatPrice = MistralUtils.formatPrice;
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return MistralUtils.formatDateShort(dateStr);
  }

  function isValidEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Export des helpers pour les modules
  window.AdminUIHelpers = {
    $, $$, escapeHtml, formatPrice, formatDate, isValidEmail,
    Toast, Confirm, Modal, Storage, utils,
    CONFIG
  };

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
    if (hash && hash !== 'dashboard') {
      navigateTo(hash);
    } else {
      navigateTo('dashboard');
    }
  }

  function navigateTo(section) {
    currentSection = section;

    const dashboard = document.getElementById('dashboard-section');

    if (section === 'dashboard') {
      // Affiche le dashboard, masque les sections
      if (dashboard) dashboard.style.display = '';
      $$('.gestion-section').forEach(s => s.classList.remove('active'));
      $$('.gestion-nav__item[data-section]').forEach(btn => btn.classList.remove('active'));
      history.replaceState(null, '', window.location.pathname);
      refreshSection('dashboard');
      return;
    }

    // Masque le dashboard
    if (dashboard) dashboard.style.display = 'none';

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

      // Publier le délai de fabrication estimé (visible côté public)
      // Formule : max(4, commandesEnCours * 1 + 2) semaines
      updateDelaiFabrication(commandesEnCours);
    }

    // Demandes de professeurs en attente
    const pendingTeachers = Storage.get(CONFIG.STORAGE_KEYS.pendingTeachers || 'mistral_pending_teachers', []);
    updateStat('dash-pending-teachers', pendingTeachers.length);
    updateBadge('badge-professeurs', pendingTeachers.length);

    // Widget vendor check
    if (typeof VendorCheck !== 'undefined' && document.getElementById('vendor-check-container')) {
      VendorCheck.render('vendor-check-container');
    }

    // Analytics (intégré au dashboard)
    if (window.AdminUI.renderAnalytics) window.AdminUI.renderAnalytics();
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
  // DÉLAI DE FABRICATION (publié vers namespace=configurateur)
  // ============================================================================

  /**
   * Calcule et publie le délai de fabrication estimé dans la config publique.
   * Formule : max(4, commandesEnCours * 1 + 2) semaines.
   * Minimum garanti : 4 semaines (1 mois).
   *
   * @param {number} commandesEnCours - Nombre de commandes en cours (ni livrées, ni annulées)
   */
  async function updateDelaiFabrication(commandesEnCours) {
    if (!window.MistralDB) { console.warn('[Dashboard] MistralDB non disponible — délai fabrication non publié'); return; }
    const client = MistralDB.getClient();
    if (!client) { console.warn('[Dashboard] Supabase client non initialisé — délai fabrication non publié'); return; }

    const delaiSemaines = Math.max(4, commandesEnCours + 2);

    try {
      await client
        .from('configuration')
        .upsert({
          key: 'delai_fabrication',
          value: JSON.stringify(delaiSemaines),
          namespace: 'configurateur',
          updated_at: new Date().toISOString()
        }, { onConflict: 'key,namespace' });
    } catch (err) {
      console.error('[updateDelaiFabrication] Erreur:', err);
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
      container.innerHTML = '<li class="todo-empty">Aucune tâche en cours</li>';
      return;
    }

    container.innerHTML = todos.map((todo, index) => `
      <li class="todo-item${todo.done ? ' done' : ''}">
        <input type="checkbox" ${todo.done ? 'checked' : ''} data-action="toggle-todo" data-param="${index}" data-on="change">
        <span class="todo-text">${escapeHtml(todo.text)}</span>
        <button class="todo-delete" data-action="delete-todo" data-param="${index}" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </li>
    `).join('');
  }

  function addTodo() {
    const input = $('#todo-input');
    if (!input || !input.value.trim()) return;

    const todos = Storage.get(CONFIG.TODO_KEY, []);
    todos.push({ text: input.value.trim(), done: false });
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
        if (window.AdminUI.renderClients) window.AdminUI.renderClients();
        break;
      case 'instruments':
        if (window.AdminUI.renderInstruments) window.AdminUI.renderInstruments();
        break;
      case 'locations':
        if (window.AdminUI.renderLocations) window.AdminUI.renderLocations();
        break;
      case 'commandes':
        if (window.AdminUI.renderCommandes) window.AdminUI.renderCommandes();
        break;
      case 'factures':
        if (window.AdminUI.renderFactures) window.AdminUI.renderFactures();
        break;
      case 'boutique':
        if (window.AdminUI.renderBoutique) window.AdminUI.renderBoutique();
        if (window.AdminUI.initBoutiqueInstrumentSelect) window.AdminUI.initBoutiqueInstrumentSelect();
        break;
      case 'professeurs':
        if (window.AdminUI.renderProfesseurs) window.AdminUI.renderProfesseurs();
        if (window.AdminUI.initAddTeacherForm) window.AdminUI.initAddTeacherForm();
        break;
      case 'galerie':
        if (window.AdminUI.renderGalerie) window.AdminUI.renderGalerie();
        if (window.AdminUI.initMediaUpload) window.AdminUI.initMediaUpload();
        break;
      case 'blog':
        if (window.AdminUI.renderBlog) window.AdminUI.renderBlog();
        if (window.AdminUI.initArticleUpload) window.AdminUI.initArticleUpload();
        if (window.AdminUI.initArticleEditor) window.AdminUI.initArticleEditor();
        break;
      case 'config':
        if (window.AdminUI.renderConfiguration) window.AdminUI.renderConfiguration();
        if (window.AdminUI.renderMateriaux) window.AdminUI.renderMateriaux();
        if (window.AdminUI.renderGammes) window.AdminUI.renderGammes();
        if (window.AdminUI.renderGammeBatches) window.AdminUI.renderGammeBatches();
        if (window.AdminUI.renderTailles) window.AdminUI.renderTailles();
        if (window.AdminUI.renderEmailAutomations) window.AdminUI.renderEmailAutomations();
        if (window.AdminUI.initConfigSections) window.AdminUI.initConfigSections();
        break;
      case 'comptabilite':
        if (window.AdminUI.renderComptabilite) window.AdminUI.renderComptabilite();
        break;
    }
  }

  function refreshAll() {
    refreshSection(currentSection);
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  function init() {
    // Note: L'authentification est gérée par admin.html qui appelle init() après login
    // Ne pas vérifier ici car cela empêcherait l'affichage du formulaire de connexion

    // Initialiser la navigation
    initNavigation();

    // Charger la section initiale
    refreshDashboard();
    loadTodos();

    // Initialiser les modules additionnels
    if (window.AdminUI.initAccessoireUpload) window.AdminUI.initAccessoireUpload();
    if (window.AdminUI.initAccessoireConfigToggle) window.AdminUI.initAccessoireConfigToggle();

    // Initialiser les selects avec recherche
    if (window.AdminUI.initSearchableSelects) window.AdminUI.initSearchableSelects();

    // Re-render quand les donnees Supabase arrivent
    window.addEventListener('mistral-sync-complete', () => {
      refreshAll();
    });

    console.log('[Admin UI Core] Initialisé');
  }

  // Note: Pas d'auto-init - admin.html gère le flow de login et appelle AdminUI.init()

  // ============================================================================
  // SEARCHABLE SELECTS (Clients, Instruments dans modals)
  // ============================================================================

  /**
   * Initialise un searchable select générique.
   * @param {string} searchId  - ID de l'input de recherche
   * @param {string} dropdownId - ID du conteneur dropdown
   * @param {string} hiddenId  - ID de l'input hidden (valeur sélectionnée)
   * @param {Function} getItems - Retourne un tableau d'items [{id, label, subtitle}]
   */
  function setupSearchableSelect(searchId, dropdownId, hiddenId, getItems) {
    const searchInput = $(`#${searchId}`);
    const dropdown = $(`#${dropdownId}`);
    const hidden = hiddenId ? $(`#${hiddenId}`) : null;

    if (!searchInput || !dropdown) return;

    // Éviter double-init
    if (searchInput._searchableInit) return;
    searchInput._searchableInit = true;

    function renderDropdown(query) {
      const items = getItems(query);
      if (!items.length) {
        dropdown.innerHTML = '<div class="searchable-dropdown__empty" style="padding:0.625rem 0.875rem;color:var(--admin-text-muted);">Aucun résultat</div>';
      } else {
        dropdown.innerHTML = items.map(i => `
          <div class="searchable-dropdown__item" data-id="${i.id}">
            <div class="searchable-dropdown__item-label">${escapeHtml(i.label)}</div>
            ${i.subtitle ? `<div class="searchable-dropdown__item-subtitle">${escapeHtml(i.subtitle)}</div>` : ''}
          </div>
        `).join('');
      }
      dropdown.classList.add('show');
    }

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (q.length >= 1) {
        renderDropdown(q);
      } else {
        dropdown.classList.remove('show');
      }
    });

    searchInput.addEventListener('focus', () => {
      // N'ouvrir le dropdown au focus que si l'input contient deja du texte
      const q = searchInput.value.trim().toLowerCase();
      if (q.length >= 1) {
        renderDropdown(q);
      }
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.searchable-dropdown__item');
      if (!item) return;
      const id = item.dataset.id;
      const label = item.querySelector('.searchable-dropdown__item-label')?.textContent || '';
      searchInput.value = label;
      if (hidden) hidden.value = id;
      dropdown.classList.remove('show');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest(`#${searchId}`) && !e.target.closest(`#${dropdownId}`)) {
        dropdown.classList.remove('show');
      }
    });
  }

  function getClientItems(query) {
    if (typeof MistralGestion === 'undefined') return [];
    return MistralGestion.Clients.list()
      .filter(c => {
        if (!query) return true;
        const s = `${c.prenom || ''} ${c.nom || ''} ${c.email || ''} ${c.telephone || ''}`.toLowerCase();
        return s.includes(query);
      })
      .slice(0, 20)
      .map(c => ({
        id: c.id,
        label: `${c.prenom || ''} ${c.nom || ''}`.trim(),
        subtitle: [c.email, c.telephone].filter(Boolean).join(' · ')
      }));
  }

  function getInstrumentItems(query) {
    if (typeof MistralGestion === 'undefined') return [];
    return MistralGestion.Instruments.list()
      .filter(i => {
        if (!query) return true;
        const s = `${i.nom || ''} ${i.reference || ''} ${i.tonalite || ''} ${i.gamme || ''}`.toLowerCase();
        return s.includes(query);
      })
      .slice(0, 20)
      .map(i => ({
        id: i.id,
        label: i.nom || i.reference || 'Sans nom',
        subtitle: [i.tonalite, i.gamme, i.nombre_notes ? i.nombre_notes + ' notes' : null, formatPrice(i.prix_vente || 0)].filter(Boolean).join(' · ')
      }));
  }

  function initSearchableSelects() {
    // Client selects dans les modals
    setupSearchableSelect('commande-client-search', 'commande-client-dropdown', 'commande-client-id', getClientItems);
    setupSearchableSelect('location-client-search', 'location-client-dropdown', 'location-client-id', getClientItems);
    setupSearchableSelect('facture-client-search', 'facture-client-dropdown', 'facture-client-id', getClientItems);

    // Instrument selects dans les modals
    setupSearchableSelect('location-instrument-search', 'location-instrument-dropdown', 'location-instrument-id', getInstrumentItems);
    setupSearchableSelect('facture-instrument-search', 'facture-instrument-dropdown', null, (query) => {
      // Pour factures, on insère une ligne au clic (pas de hidden ID)
      return getInstrumentItems(query);
    });

    // Handler spécial pour facture-instrument : ajouter une ligne au lieu de sélectionner
    const factureInstDropdown = $(`#facture-instrument-dropdown`);
    const factureInstSearch = $(`#facture-instrument-search`);
    if (factureInstDropdown && factureInstSearch) {
      // Remplacer le handler par défaut pour insérer une ligne facture
      factureInstDropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.searchable-dropdown__item');
        if (!item) return;
        e.stopPropagation(); // Empêcher le handler générique de remettre le label
        const id = item.dataset.id;
        if (typeof MistralGestion !== 'undefined') {
          const inst = MistralGestion.Instruments.get(id);
          if (inst && window.AdminUI.addFactureLigneFromInstrument) {
            window.AdminUI.addFactureLigneFromInstrument(inst.id);
          } else if (inst && window.AdminUI.addFactureLigne) {
            // Fallback: ajouter une ligne libre puis remplir
            window.AdminUI.addFactureLigne();
            const lignes = document.querySelectorAll('#facture-lignes .facture-ligne');
            const lastLigne = lignes[lignes.length - 1];
            if (lastLigne) {
              const descInput = lastLigne.querySelector('[name="ligne-desc"]');
              const puInput = lastLigne.querySelector('[name="ligne-pu"]');
              if (descInput) descInput.value = `${inst.nom || inst.reference || 'Instrument'} - ${inst.tonalite || ''} ${inst.gamme || ''}`.trim();
              if (puInput) {
                puInput.value = inst.prix_vente || 0;
                puInput.dispatchEvent(new Event('input'));
              }
            }
          }
        }
        factureInstSearch.value = '';
        factureInstDropdown.classList.remove('show');
      }, true); // Capture phase pour s'exécuter avant le handler générique
    }
  }

  // ============================================================================
  // EXPORT - BASE ADMINUI
  // ============================================================================

  window.AdminUI = {
    // Core
    init,
    goToTab,
    navigateTo,
    refreshAll,
    refreshSection,

    // Dashboard
    refreshDashboard,
    updateBadge,

    // Searchable selects
    initSearchableSelects,

    // To-Do
    addTodo,
    toggleTodo,
    deleteTodo,

    // Helpers (for modules)
    _helpers: { $, $$, escapeHtml, formatPrice, formatDate }
  };

})(window);
