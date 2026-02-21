/* ==========================================================================
   MISTRAL PANS - Apprendre Admin Integration
   Intégration du système admin + consentement RGPD Leaflet
   ========================================================================== */

(function() {
  'use strict';

  if (typeof MistralAdmin === 'undefined') {
    console.error('MistralAdmin non chargé');
    return;
  }

  const { Auth, FAB, Modal, Toast, Confirm, Teachers, Consent, utils } = MistralAdmin;

  // Icônes SVG pour les tags professeurs
  const TAG_ICONS = {
    domicile:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    studio:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3h-8l-2 4h12z"/></svg>',
    distance:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    solo:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    groupe:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    instrument:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>'
  };

  const TAG_LABELS = {
    domicile: 'À domicile',
    studio: 'En studio',
    distance: 'À distance',
    solo: 'Cours individuels',
    groupe: 'Cours collectifs',
    instrument: 'Instrument fourni'
  };

  function getTeacherTags(teacher) {
    const tags = [];
    if (teacher.courseTypes?.includes('domicile')) tags.push('domicile');
    if (teacher.courseTypes?.includes('studio')) tags.push('studio');
    if (teacher.courseTypes?.includes('distance')) tags.push('distance');
    if (teacher.courseFormats?.includes('solo')) tags.push('solo');
    if (teacher.courseFormats?.includes('groupe')) tags.push('groupe');
    if (teacher.instrumentAvailable) tags.push('instrument');
    return tags;
  }

  // ============================================================================
  // CONFIGURATION LEAFLET
  // ============================================================================

  const MAP_CONFIG = {
    center: [48.8566, 2.3522], // Paris
    zoom: 10,
    tileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
  };

  let map = null;
  let markers = [];

  // ============================================================================
  // CONSENTEMENT RGPD POUR LEAFLET
  // ============================================================================

  function createConsentOverlay() {
    const mapContainer = document.getElementById('teachers-map');
    if (!mapContainer) return null;

    // Créer l'overlay de consentement
    const overlay = document.createElement('div');
    overlay.id = 'map-consent-overlay';
    overlay.className = 'map-consent-overlay';
    overlay.innerHTML = `
      <div class="map-consent-content">
        <div class="map-consent-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <h3 class="map-consent-title">Carte interactive</h3>
        <p class="map-consent-text">
          Cette carte utilise des données cartographiques externes (OpenStreetMap via CARTO).
          En l'activant, votre adresse IP sera transmise à ces services tiers.
        </p>
        <div class="map-consent-actions">
          <button class="btn btn--primary" id="btn-accept-map">
            Afficher la carte
          </button>
          <button class="btn btn--ghost" id="btn-decline-map">
            Non merci
          </button>
        </div>
        <p class="map-consent-note">
          Vous pouvez toujours voir la liste des professeurs ci-dessous.
        </p>
      </div>
    `;

    // Injecter les styles
    if (!document.getElementById('map-consent-styles')) {
      const styles = document.createElement('style');
      styles.id = 'map-consent-styles';
      styles.textContent = `
        .map-consent-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(250,250,250,0.97) 0%, rgba(245,245,245,0.97) 100%);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000; /* --z-modal */
          border-radius: inherit;
        }

        .map-consent-content {
          text-align: center;
          max-width: 400px;
          padding: 2rem;
        }

        .map-consent-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 1.5rem;
          background: var(--color-accent, #0D7377);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .map-consent-title {
          font-family: var(--font-display, Georgia, serif);
          font-size: 1.5rem;
          font-weight: 500;
          margin-bottom: 0.75rem;
          color: var(--color-text, #2C2825);
        }

        .map-consent-text {
          font-size: 0.9375rem;
          color: var(--color-text-light, #6B6560);
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .map-consent-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .map-consent-note {
          font-size: 0.8125rem;
          color: var(--color-text-muted, #9A958F);
          margin-top: 1rem;
        }

        .map-placeholder {
          position: absolute;
          inset: 0;
          background: #e8e4dc;
          filter: grayscale(100%) blur(2px);
          opacity: 0.5;
        }
      `;
      document.head.appendChild(styles);
    }

    return overlay;
  }

  function initMapWithConsent() {
    const mapContainer = document.getElementById('teachers-map');
    if (!mapContainer) return;

    // Vérifier si le consentement existe déjà
    if (Consent.hasConsent('leaflet')) {
      initLeafletMap();
      return;
    }

    // Ajouter un placeholder flou (image statique de la carte IDF)
    const placeholder = document.createElement('div');
    placeholder.className = 'map-placeholder';
    placeholder.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23e8e4dc\' width=\'100\' height=\'100\'/%3E%3Ctext x=\'50\' y=\'50\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23ccc\' font-size=\'12\'%3ECarte%3C/text%3E%3C/svg%3E")';
    mapContainer.style.position = 'relative';
    mapContainer.appendChild(placeholder);

    // Créer et ajouter l'overlay de consentement
    const overlay = createConsentOverlay();
    if (overlay) {
      mapContainer.appendChild(overlay);

      // Event listeners
      document.getElementById('btn-accept-map').addEventListener('click', () => {
        Consent.setConsent('leaflet', true);
        overlay.remove();
        placeholder.remove();
        initLeafletMap();
        Toast.success('Carte activée');
      });

      document.getElementById('btn-decline-map').addEventListener('click', () => {
        overlay.querySelector('.map-consent-content').innerHTML = `
          <div class="map-consent-icon" style="background: var(--color-text-muted, #9A958F);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h3 class="map-consent-title">Carte désactivée</h3>
          <p class="map-consent-text">
            Pas de problème ! Vous pouvez consulter la liste des professeurs ci-dessous.
          </p>
          <button class="btn btn--ghost" id="btn-enable-map">
            Activer la carte
          </button>
        `;

        document.getElementById('btn-enable-map').addEventListener('click', () => {
          Consent.setConsent('leaflet', true);
          overlay.remove();
          placeholder.remove();
          initLeafletMap();
          Toast.success('Carte activée');
        });
      });
    }
  }

  function initLeafletMap() {
    const mapContainer = document.getElementById('teachers-map');
    if (!mapContainer || map) return;

    // Vérifier que Leaflet est chargé
    if (typeof L === 'undefined') {
      console.error('Leaflet non chargé');
      return;
    }

    map = L.map('teachers-map').setView(MAP_CONFIG.center, MAP_CONFIG.zoom);

    L.tileLayer(MAP_CONFIG.tileUrl, {
      attribution: MAP_CONFIG.attribution,
      maxZoom: 18
    }).addTo(map);

    // Charger les marqueurs
    updateMapMarkers();
  }

  function updateMapMarkers() {
    if (!map) return;

    // Supprimer les anciens marqueurs
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Ajouter les nouveaux
    const teachers = Teachers.getAll();
    teachers.forEach(teacher => {
      if (teacher.lat && teacher.lng) {
        const marker = L.marker([teacher.lat, teacher.lng])
          .addTo(map)
          .bindPopup(`
            <strong>${utils.escapeHtml(teacher.name)}</strong><br>
            ${utils.escapeHtml(teacher.location)}<br>
            <a href="mailto:${teacher.email}">${teacher.email}</a>
          `);
        markers.push(marker);
      }
    });

    // Ajuster la vue si des marqueurs existent
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  // ============================================================================
  // RENDU DES FICHES PROFESSEURS
  // ============================================================================

  function renderTeacherCards() {
    const container = document.getElementById('teachers-list');
    if (!container) return;

    const teachers = Teachers.getAll();

    // CTA pour rejoindre le réseau
    const ctaHtml = `
      <div class="teachers-cta">
        <p>Vous enseignez le handpan en Île-de-France ?</p>
        <a href="#" class="btn btn--secondary btn--sm" data-modal="teacher-signup">Rejoindre le réseau</a>
      </div>
    `;

    if (teachers.length === 0) {
      container.innerHTML = `
        <div class="teacher-empty" style="text-align:center;padding:2rem;">
          <p style="margin-bottom:1rem;">Aucun professeur référencé pour le moment.</p>
          <p>Vous êtes professeur ? <a href="#" data-modal="teacher-signup" style="color:var(--color-accent);">Rejoignez le réseau</a></p>
        </div>
      `;
      return;
    }

    // Générer les cartes des professeurs
    const cardsHtml = teachers.map(t => {
      const firstName = t.name ? t.name.split(' ')[0] : 'ce professeur';
      const phoneClean = t.phone ? t.phone.replace(/\s/g, '') : '';

      const cardTags = getTeacherTags(t);
      const cardTagsHtml = cardTags.length > 0
        ? `<div class="teacher-card__tags" style="display:flex;flex-wrap:wrap;gap:0.375rem;margin-bottom:var(--space-md);">${cardTags.map(key =>
            `<span class="teacher-tag teacher-tag--compact" title="${TAG_LABELS[key]}">${TAG_ICONS[key]}</span>`
          ).join('')}</div>`
        : '';

      return `
        <div class="teacher-card" data-id="${t.id}" data-lat="${t.lat || ''}" data-lng="${t.lng || ''}" data-action="open-teacher-profile" style="cursor:pointer;">
          <h4 class="teacher-card__name">${utils.escapeHtml(t.name)}</h4>
          <p class="teacher-card__location">📍 ${utils.escapeHtml(t.location || t.city || '')}</p>
          ${t.bio ? `<p style="font-size: 0.875rem; color: var(--color-text-light); margin-bottom: var(--space-md);">${utils.escapeHtml(t.bio).substring(0, 100)}${t.bio.length > 100 ? '...' : ''}</p>` : ''}
          ${cardTagsHtml}
          <div class="teacher-card__actions">
            ${window.matchMedia('(max-width: 768px)').matches
              ? `<a href="mailto:${t.email}" class="teacher-card__btn teacher-card__btn--email" data-action="stop-propagation">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Écrire à ${utils.escapeHtml(firstName)}
              </a>`
              : `<span class="teacher-card__btn teacher-card__btn--email" data-action="stop-propagation" style="cursor:default;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                ${utils.escapeHtml(t.email)}
              </span>`}
            ${phoneClean ? (window.matchMedia('(max-width: 768px)').matches
              ? `<a href="tel:${phoneClean}" class="teacher-card__btn teacher-card__btn--phone" data-action="stop-propagation">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.09.6.21 1.19.39 1.77a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.58.18 1.17.3 1.77.39A2 2 0 0 1 22 16.92z"/></svg>
                Appeler
              </a>`
              : `<span class="teacher-card__btn teacher-card__btn--phone" data-action="stop-propagation" style="cursor:default;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.09.6.21 1.19.39 1.77a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.58.18 1.17.3 1.77.39A2 2 0 0 1 22 16.92z"/></svg>
                ${utils.escapeHtml(t.phone)}
              </span>`)
            : ''}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = cardsHtml + ctaHtml;

    // Delegated event listeners for data-action attributes
    container.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset.action;

      if (action === 'stop-propagation') {
        e.stopPropagation();
        return; // Let the default link behavior proceed
      }

      if (action === 'open-teacher-profile') {
        const card = actionEl.closest('.teacher-card');
        const id = card ? card.dataset.id : null;
        if (id) openTeacherProfile(id);
      }
    });
  }

  // ============================================================================
  // ADMIN: GESTION DES DEMANDES
  // ============================================================================

  function openPendingModal() {
    const pending = Teachers.getPending();
    const modalId = 'pending-modal';

    if (pending.length === 0) {
      Toast.info('Aucune demande en attente');
      return;
    }

    // Fermer si déjà ouverte
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
      Modal.destroy(modalId);
    }

    const modal = Modal.create({
      id: modalId,
      title: `Demandes en attente (${pending.length})`,
      size: 'large',
      content: `
        <div class="admin-list" id="pending-list">
          ${pending.map(p => `
            <div class="admin-list-item teacher-card--pending" data-id="${p.id}" style="color: var(--color-text, #333);">
              <div class="teacher-card__avatar" style="width:48px;height:48px;border-radius:50%;background:var(--color-bg-warm, #f5f5f5);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
                ${p.photo ? `<img src="${p.photo}" alt="" style="width:100%;height:100%;object-fit:cover;">` : `
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                `}
              </div>
              <div class="admin-list-item__content">
                <div class="admin-list-item__title" style="color: var(--color-text, #333); font-weight: 500;">${utils.escapeHtml(p.firstname)} ${utils.escapeHtml(p.lastname)}</div>
                <div class="admin-list-item__subtitle" style="color: var(--color-text-muted, #666);">${utils.escapeHtml(p.location || p.city)} • ${utils.escapeHtml(p.email)}</div>
                <div style="font-size:0.75rem;color:var(--color-text-light, #888);margin-top:0.25rem;">
                  Demande le ${utils.formatDate(p.submittedAt)}
                </div>
              </div>
              <div class="admin-list-item__actions">
                <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="view-pending" data-id="${p.id}">
                  Voir
                </button>
                <button class="admin-btn admin-btn--primary admin-btn--sm" data-action="approve" data-ns="ApprendreAdmin" data-id="${p.id}">
                  Approuver
                </button>
                <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="reject" data-ns="ApprendreAdmin" data-id="${p.id}">
                  Refuser
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `,
      footer: `
        <button class="admin-btn admin-btn--secondary" id="pending-modal-close-btn">Fermer</button>
      `
    });

    Modal.open(modal);

    // Attacher l'event listener au bouton fermer après création
    const closeBtn = document.getElementById('pending-modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        Modal.close(modalId);
      });
    }

    // Delegated event listeners for data-action buttons
    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'view-pending':
          openTeacherProfile(id);
          break;
        case 'approve':
          ApprendreAdmin.approve(id);
          break;
        case 'reject':
          ApprendreAdmin.reject(id);
          break;
      }
    });
  }

  function openTeachersListModal() {
    const teachers = Teachers.getAll();
    const modalId = 'teachers-list-modal';

    // Fermer si déjà ouverte
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
      Modal.destroy(modalId);
    }

    const modal = Modal.create({
      id: modalId,
      title: `Professeurs actifs (${teachers.length})`,
      size: 'large',
      content: teachers.length === 0 ? `
        <div class="admin-empty">
          <div class="admin-empty__title" style="color: var(--color-text, #333);">Aucun professeur</div>
          <div class="admin-empty__text" style="color: var(--color-text-muted, #666);">Approuvez des demandes ou ajoutez manuellement</div>
        </div>
      ` : `
        <div class="admin-list" id="teachers-admin-list">
          ${teachers.map(t => `
            <div class="admin-list-item" data-id="${t.id}" style="color: var(--color-text, #333);">
              <div class="teacher-card__avatar" style="width:48px;height:48px;border-radius:50%;background:var(--color-bg-warm, #f5f5f5);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
                ${t.photo ? `<img src="${t.photo}" alt="" style="width:100%;height:100%;object-fit:cover;">` : `
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                `}
              </div>
              <div class="admin-list-item__content">
                <div class="admin-list-item__title" style="color: var(--color-text, #333); font-weight: 500;">${utils.escapeHtml(t.name)}</div>
                <div class="admin-list-item__subtitle" style="color: var(--color-text-muted, #666);">${utils.escapeHtml(t.location)} • ${utils.escapeHtml(t.email)}</div>
              </div>
              <div class="admin-list-item__actions">
                <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="edit" data-ns="ApprendreAdmin" data-id="${t.id}">
                  Modifier
                </button>
                <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="delete" data-ns="ApprendreAdmin" data-id="${t.id}">
                  Supprimer
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `,
      footer: `
        <button class="admin-btn admin-btn--secondary" id="teachers-list-close-btn">Fermer</button>
      `
    });

    Modal.open(modal);

    // Attacher l'event listener au bouton fermer après création
    const closeBtn = document.getElementById('teachers-list-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        Modal.close(modalId);
      });
    }

    // Delegated event listeners for data-action buttons
    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'edit':
          ApprendreAdmin.edit(id);
          break;
        case 'delete':
          ApprendreAdmin.delete(id);
          break;
      }
    });
  }

  // ============================================================================
  // ACTIONS PUBLIQUES
  // ============================================================================

  window.ApprendreAdmin = {
    approve(id) {
      const teacher = Teachers.approve(id);
      if (teacher) {
        Toast.success(`${teacher.name} a été ajouté(e)`);

        // Mettre à jour la modale si ouverte
        const pendingList = document.getElementById('pending-list');
        if (pendingList) {
          const item = pendingList.querySelector(`[data-id="${id}"]`);
          if (item) item.remove();

          // Fermer si vide
          if (pendingList.children.length === 0) {
            Modal.close('pending-modal');
          }
        }

        // Mettre à jour l'affichage
        renderTeacherCards();
        updateMapMarkers();
        updateFABBadge();
      }
    },

    async reject(id) {
      const confirmed = await Confirm.show({
        title: 'Refuser la demande',
        message: 'Voulez-vous vraiment refuser cette demande ?',
        confirmText: 'Refuser',
        type: 'warning'
      });

      if (confirmed) {
        Teachers.reject(id);
        Toast.info('Demande refusée');

        const pendingList = document.getElementById('pending-list');
        if (pendingList) {
          const item = pendingList.querySelector(`[data-id="${id}"]`);
          if (item) item.remove();

          if (pendingList.children.length === 0) {
            Modal.close('pending-modal');
          }
        }

        updateFABBadge();
      }
    },

    edit(id) {
      // Rediriger vers la page admin
      window.location.href = `admin.html#teachers`;
    },

    async delete(id) {
      const confirmed = await Confirm.delete('ce professeur');
      if (confirmed) {
        Teachers.delete(id);
        Toast.success('Professeur supprimé');

        const teachersList = document.getElementById('teachers-admin-list');
        if (teachersList) {
          const item = teachersList.querySelector(`[data-id="${id}"]`);
          if (item) item.remove();
        }

        renderTeacherCards();
        updateMapMarkers();
      }
    }
  };


  // ============================================================================
  // FORMULAIRE DE DEMANDE D'ADHÉSION
  // ============================================================================

  function initSignupForm() {
    const form = document.getElementById('teacher-form');
    if (!form) return;

    const photoInput = document.getElementById('teacher-photo');
    const photoPreview = document.getElementById('photo-preview');
    const submitBtn = document.getElementById('teacher-submit-btn');

    // Gestion de l'upload photo avec aperçu
    if (photoInput && photoPreview) {
      photoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
          Toast.error('Veuillez sélectionner une image');
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          Toast.error('Image trop volumineuse (max 5Mo)');
          return;
        }

        // Afficher aperçu
        const reader = new FileReader();
        reader.onload = (event) => {
          photoPreview.innerHTML = `<img src="${event.target.result}" alt="Aperçu" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        };
        reader.readAsDataURL(file);
      });
    }

    // Soumission du formulaire
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi en cours...';
      }

      try {
        const formData = new FormData(form);

        // Collecter les types de cours (synchrone, rapide)
        const courseTypes = [];
        form.querySelectorAll('input[name="course_type[]"]:checked').forEach(cb => {
          courseTypes.push(cb.value);
        });

        const courseFormats = [];
        form.querySelectorAll('input[name="course_format[]"]:checked').forEach(cb => {
          courseFormats.push(cb.value);
        });

        // Collecter code postal et ville
        const postalcode = formData.get('postalcode')?.trim() || '';
        const city = formData.get('city')?.trim() || '';

        // Lancer photo + geocodage EN PARALLELE pour reduire la latence
        const photoFile = photoInput?.files[0];
        const photoPromise = photoFile
          ? readFileAsBase64(photoFile).then(b64 => b64 ? compressImage(b64, 600, 600, 0.8) : null)
          : Promise.resolve(null);

        // Geocodage avec timeout 3s (fallback Paris si trop lent)
        const geocodeWithTimeout = Promise.race([
          geocodeAddress(postalcode, city),
          new Promise(resolve => setTimeout(() => resolve({ lat: 48.8566, lng: 2.3522 }), 3000))
        ]);

        const [photoData, coords] = await Promise.all([photoPromise, geocodeWithTimeout]);

        // Créer le payload pour la Netlify Function
        const payload = {
          firstname: formData.get('firstname')?.trim() || '',
          lastname: formData.get('lastname')?.trim() || '',
          email: formData.get('email')?.trim() || '',
          phone: formData.get('phone')?.trim() || '',
          postalcode: postalcode,
          city: city,
          lat: coords.lat,
          lng: coords.lng,
          bio: formData.get('bio')?.trim() || '',
          photo: photoData,
          courseTypes: courseTypes,
          courseFormats: courseFormats,
          instrumentAvailable: formData.get('instrument_available') === '1',
          website: formData.get('site_url')?.trim() || null,
          instagram: formData.get('instagram')?.trim() || null,
          facebook: formData.get('facebook')?.trim() || null,
          youtube: formData.get('youtube')?.trim() || null,
          tiktok: formData.get('tiktok')?.trim() || null,
          // Honeypot : champ invisible "website" (si rempli = bot)
          honeypot: formData.get('website') || ''
        };

        // Envoyer via Netlify Function (rate-limited, serveur-side validation)
        const response = await fetch('/.netlify/functions/teacher-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
          // Gerer les erreurs specifiques du serveur
          if (response.status === 429) {
            Toast.error('Trop de demandes. Réessayez dans une heure.');
          } else if (response.status === 409) {
            Toast.error('Une demande avec cet email existe déjà.');
          } else {
            Toast.error(result.error || 'Une erreur est survenue.');
          }
          return;
        }

        // Réinitialiser le formulaire
        form.reset();
        if (photoPreview) {
          photoPreview.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          `;
        }

        // Fermer le modal
        const modal = document.getElementById('teacher-signup');
        if (modal) {
          modal.classList.remove('open');
          document.body.style.overflow = '';
          if (window.MistralFocusTrap) MistralFocusTrap.deactivate();
        }

        // Si admin connecté : rafraîchir le cache MistralSync pour voir la nouvelle demande
        if (Auth.isLoggedIn()) {
          if (window.MistralSync && MistralSync.refresh) {
            MistralSync.refresh().then(() => updateFABBadge());
          } else {
            updateFABBadge();
          }
        }

        Toast.success('Demande envoyée ! Vous recevrez une réponse sous 48h.');

      } catch (error) {
        console.error('Erreur soumission:', error);
        Toast.error('Une erreur est survenue. Veuillez réessayer.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Envoyer ma candidature';
        }
      }
    });
  }

  // ============================================================================
  // WIZARD MULTI-ÉTAPES (mobile)
  // ============================================================================

  /**
   * Initialise le wizard multi-étapes pour le formulaire enseignant.
   * Sur mobile (≤768px), le formulaire affiche une étape à la fois.
   * Sur desktop, toutes les étapes sont visibles (pas de wizard).
   */
  function initWizard() {
    const form = document.getElementById('teacher-form');
    if (!form) return;

    const stepper = document.getElementById('wizard-stepper');
    if (!stepper) return;

    const steps = form.querySelectorAll('.wizard-step');
    const dots = stepper.querySelectorAll('.wizard-step-dot');
    const bars = stepper.querySelectorAll('.wizard-step-bar');
    if (steps.length === 0) return;

    let currentStep = 1;

    /**
     * Naviguer vers une étape donnée
     * @param {number} targetStep - numéro de l'étape (1-based)
     * @param {boolean} [skipValidation=false] - ignorer la validation (retour en arrière)
     */
    function goToStep(targetStep, skipValidation) {
      if (targetStep < 1 || targetStep > steps.length) return;

      // En allant vers l'avant, valider l'étape actuelle
      if (!skipValidation && targetStep > currentStep) {
        if (!validateStep(currentStep)) return;
      }

      // Masquer l'étape courante
      steps.forEach(function (step) {
        step.classList.remove('wizard-step--active');
      });

      // Afficher la nouvelle étape
      const targetEl = form.querySelector('[data-wizard-step="' + targetStep + '"]');
      if (targetEl) {
        targetEl.classList.add('wizard-step--active');
      }

      // Mettre à jour le stepper
      dots.forEach(function (dot, i) {
        var stepNum = i + 1;
        dot.classList.remove('wizard-step-dot--active', 'wizard-step-dot--done');
        dot.removeAttribute('aria-current');

        if (stepNum === targetStep) {
          dot.classList.add('wizard-step-dot--active');
          dot.setAttribute('aria-current', 'step');
        } else if (stepNum < targetStep) {
          dot.classList.add('wizard-step-dot--done');
        }
      });

      // Mettre à jour les barres entre les dots
      bars.forEach(function (bar, i) {
        bar.classList.toggle('wizard-step-bar--done', (i + 1) < targetStep);
      });

      currentStep = targetStep;

      // Scroll en haut du modal body
      var modalBody = form.closest('.modal__body');
      if (modalBody) {
        modalBody.scrollTop = 0;
      }
    }

    /**
     * Valider les champs requis d'une étape
     * @param {number} stepNum
     * @returns {boolean}
     */
    function validateStep(stepNum) {
      var stepEl = form.querySelector('[data-wizard-step="' + stepNum + '"]');
      if (!stepEl) return true;

      // Vérifier les champs required
      var requiredFields = stepEl.querySelectorAll('input[required], textarea[required], select[required]');
      var firstInvalid = null;

      for (var i = 0; i < requiredFields.length; i++) {
        var field = requiredFields[i];
        if (!field.value || !field.value.trim()) {
          field.classList.add('form-input--error');
          if (!firstInvalid) firstInvalid = field;
        } else {
          field.classList.remove('form-input--error');
        }
      }

      // Vérifier email format
      var emailField = stepEl.querySelector('input[type="email"]');
      if (emailField && emailField.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value)) {
        emailField.classList.add('form-input--error');
        if (!firstInvalid) firstInvalid = emailField;
      }

      // Vérifier code postal format
      var postalField = stepEl.querySelector('input[name="postalcode"]');
      if (postalField && postalField.value && !/^[0-9]{5}$/.test(postalField.value)) {
        postalField.classList.add('form-input--error');
        if (!firstInvalid) firstInvalid = postalField;
      }

      // Étape 2 : au moins un type de cours et un format
      if (stepNum === 2) {
        var courseTypes = stepEl.querySelectorAll('input[name="course_type[]"]:checked');
        var courseFormats = stepEl.querySelectorAll('input[name="course_format[]"]:checked');

        if (courseTypes.length === 0) {
          if (typeof Toast !== 'undefined') {
            Toast.error('Sélectionnez au moins un type de cours');
          }
          return false;
        }

        if (courseFormats.length === 0) {
          if (typeof Toast !== 'undefined') {
            Toast.error('Sélectionnez au moins un format de cours');
          }
          return false;
        }
      }

      if (firstInvalid) {
        firstInvalid.focus();
        if (typeof Toast !== 'undefined') {
          Toast.error('Veuillez remplir tous les champs obligatoires');
        }
        return false;
      }

      return true;
    }

    // Event: boutons Suivant / Retour
    form.addEventListener('click', function (e) {
      var nextBtn = e.target.closest('.wizard-btn-next');
      if (nextBtn) {
        var nextStep = parseInt(nextBtn.getAttribute('data-next'), 10);
        if (nextStep) goToStep(nextStep);
        return;
      }

      var prevBtn = e.target.closest('.wizard-btn-prev');
      if (prevBtn) {
        var prevStep = parseInt(prevBtn.getAttribute('data-prev'), 10);
        if (prevStep) goToStep(prevStep, true);
      }
    });

    // Event: clic sur un dot du stepper
    stepper.addEventListener('click', function (e) {
      var dot = e.target.closest('.wizard-step-dot');
      if (!dot) return;
      var targetStep = parseInt(dot.getAttribute('data-step'), 10);
      if (!targetStep || targetStep === currentStep) return;

      // Autoriser retour en arrière sans validation
      if (targetStep < currentStep) {
        goToStep(targetStep, true);
      } else {
        // Valider chaque étape intermédiaire avant d'avancer
        var canAdvance = true;
        for (var s = currentStep; s < targetStep; s++) {
          if (!validateStep(s)) {
            canAdvance = false;
            break;
          }
        }
        if (canAdvance) goToStep(targetStep);
      }
    });

    // Retirer la classe d'erreur quand l'utilisateur corrige
    form.addEventListener('input', function (e) {
      if (e.target.classList.contains('form-input--error')) {
        e.target.classList.remove('form-input--error');
      }
    });

    // Reset wizard quand le modal se ferme
    var signupModal = document.getElementById('teacher-signup');
    if (signupModal) {
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.attributeName === 'class' && !signupModal.classList.contains('open')) {
            // Reset au step 1
            goToStep(1, true);
            // Retirer les erreurs
            form.querySelectorAll('.form-input--error').forEach(function (el) {
              el.classList.remove('form-input--error');
            });
          }
        });
      });
      observer.observe(signupModal, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // Helper: Lire un fichier en base64
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Erreur lecture fichier'));
      reader.readAsDataURL(file);
    });
  }

  // Helper: Compresser une image
  function compressImage(base64, maxWidth = 600, maxHeight = 600, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Erreur chargement image'));
      img.src = base64;
    });
  }

  // Helper: Géocoder une adresse via l'API adresse.data.gouv.fr (plus fiable pour la France)
  async function geocodeAddress(postalcode, city) {
    try {
      // Utiliser l'API adresse du gouvernement français - très fiable
      const query = encodeURIComponent(`${postalcode} ${city}`);
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${query}&limit=1`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erreur réseau API adresse');
      }

      const data = await response.json();

      if (data && data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates;
        const label = data.features[0].properties.label;
        return {
          lat: coords[1],  // L'API retourne [lng, lat]
          lng: coords[0]
        };
      }

      // Fallback: essayer Nominatim avec une query simple
      const nominatimQuery = encodeURIComponent(`${postalcode}, ${city}, France`);
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${nominatimQuery}&format=json&limit=1&countrycodes=fr`,
        {
          headers: {
            'User-Agent': 'MistralPans/1.0'
          }
        }
      );

      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json();
        if (nominatimData && nominatimData.length > 0) {
          return {
            lat: parseFloat(nominatimData[0].lat),
            lng: parseFloat(nominatimData[0].lon)
          };
        }
      }

      // Fallback final: centre de l'Île-de-France
      if (window.MISTRAL_DEBUG) console.warn('Géocodage échoué, utilisation des coordonnées par défaut');
      return { lat: 48.8566, lng: 2.3522 };

    } catch (error) {
      console.error('Erreur géocodage:', error);
      return { lat: 48.8566, lng: 2.3522 };
    }
  }

  // ============================================================================
  // MODAL PROFIL PROFESSEUR
  // ============================================================================

  function openTeacherProfile(teacherId) {
    let teacher = Teachers.get(teacherId);
    // Chercher aussi dans les demandes en attente
    if (!teacher) {
      const pending = Teachers.getPending().find(t => t.id === teacherId);
      if (pending) {
        teacher = {
          ...pending,
          name: pending.name || `${pending.firstname || ''} ${pending.lastname || ''}`.trim()
        };
      }
    }
    if (!teacher) return;

    const modal = document.getElementById('teacher-profile-modal');
    const content = document.getElementById('teacher-profile-content');
    if (!modal || !content) return;

    // Photo
    const photoHtml = teacher.photo
      ? `<img src="${teacher.photo}" alt="${utils.escapeHtml(teacher.name)}">`
      : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>`;

    // Tags
    const tags = getTeacherTags(teacher);
    const tagsHtml = tags.map(key =>
      `<span class="teacher-tag ${key === 'instrument' ? 'teacher-tag--accent' : ''}">${TAG_ICONS[key]}${TAG_LABELS[key]}</span>`
    ).join('');

    // Réseaux sociaux
    const socials = [];
    if (teacher.website) socials.push(`<a href="${teacher.website}" target="_blank" rel="noopener">🌐 Site web</a>`);
    if (teacher.instagram) socials.push(`<a href="https://instagram.com/${teacher.instagram.replace('@', '')}" target="_blank" rel="noopener">📷 Instagram</a>`);
    if (teacher.facebook) socials.push(`<a href="${teacher.facebook.startsWith('http') ? teacher.facebook : 'https://facebook.com/' + teacher.facebook}" target="_blank" rel="noopener">📘 Facebook</a>`);
    if (teacher.youtube) socials.push(`<a href="${teacher.youtube.startsWith('http') ? teacher.youtube : 'https://youtube.com/' + teacher.youtube}" target="_blank" rel="noopener">📺 YouTube</a>`);
    if (teacher.tiktok) socials.push(`<a href="https://tiktok.com/${teacher.tiktok.replace('@', '')}" target="_blank" rel="noopener">🎵 TikTok</a>`);

    const socialsHtml = socials.length > 0
      ? `<div class="teacher-profile__socials" style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem;">${socials.join('')}</div>`
      : '';

    // Boutons contact
    const firstName = teacher.name.split(' ')[0];
    const isMobileProfile = window.matchMedia('(max-width: 768px)').matches;
    let contactHtml = `<div class="teacher-profile__actions" style="display:flex;gap:0.75rem;margin-top:1.5rem;flex-wrap:wrap;">`;
    if (isMobileProfile) {
      contactHtml += `<a href="mailto:${utils.escapeHtml(teacher.email)}" class="btn btn--primary" target="_blank" rel="noopener">📧 Écrire à ${utils.escapeHtml(firstName)}</a>`;
    } else {
      contactHtml += `<span class="btn btn--primary" style="cursor:default;">📧 ${utils.escapeHtml(teacher.email)}</span>`;
    }
    if (teacher.phone) {
      const phoneClean = teacher.phone.replace(/\s/g, '');
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        contactHtml += `<a href="tel:${phoneClean}" class="btn btn--secondary">📞 Appeler ${utils.escapeHtml(firstName)}</a>`;
      } else {
        contactHtml += `<span class="btn btn--secondary" style="cursor:default;">📞 ${utils.escapeHtml(teacher.phone)}</span>`;
      }
    }
    contactHtml += `</div>`;

    content.innerHTML = `
      <div class="teacher-profile" style="display:flex;gap:1.5rem;align-items:flex-start;">
        <div class="teacher-profile__photo" style="width:100px;height:100px;border-radius:50%;background:var(--color-bg-warm);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
          ${photoHtml}
        </div>
        <div style="flex:1;">
          <h3 style="font-family:var(--font-display);font-size:1.5rem;margin-bottom:0.25rem;">${utils.escapeHtml(teacher.name)}</h3>
          <p style="color:var(--color-text-light);margin-bottom:1rem;">📍 ${utils.escapeHtml(teacher.location)}</p>
          <p style="line-height:1.6;">${utils.escapeHtml(teacher.bio)}</p>
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:1rem;">${tagsHtml}</div>
          ${socialsHtml}
          ${contactHtml}
        </div>
      </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.MistralFocusTrap) MistralFocusTrap.activate(modal);
  }

  // Exposer pour les onclick dans le HTML
  window.openTeacherProfile = openTeacherProfile;

  // ============================================================================
  // INIT
  // ============================================================================

  function init() {
    // Initialiser la carte avec consentement
    initMapWithConsent();

    // Rendre les fiches professeurs
    renderTeacherCards();

    // Initialiser le formulaire de demande d'adhésion
    initSignupForm();

    // Initialiser le wizard multi-étapes (mobile)
    initWizard();

    // Fermeture des modals
    initModalCloseHandlers();

    // Ecouter les changements de donnees via MistralSync
    window.addEventListener('mistral-sync-complete', () => {
      renderTeacherCards();
      updateMapMarkers();
    });
    window.addEventListener('mistral-data-change', (e) => {
      if (e.detail && (e.detail.key === 'mistral_teachers' || e.detail.key === 'mistral_pending_teachers')) {
        renderTeacherCards();
        updateMapMarkers();
      }
    });
  }

  function initModalCloseHandlers() {
    // Modal profil professeur
    const profileModal = document.getElementById('teacher-profile-modal');
    if (profileModal) {
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal || e.target.closest('.modal__close')) {
          profileModal.classList.remove('open');
          document.body.style.overflow = '';
          if (window.MistralFocusTrap) MistralFocusTrap.deactivate();
        }
      });
    }

    // Modal inscription professeur
    const signupModal = document.getElementById('teacher-signup');
    if (signupModal) {
      signupModal.addEventListener('click', (e) => {
        if (e.target === signupModal || e.target.closest('.modal__close')) {
          signupModal.classList.remove('open');
          document.body.style.overflow = '';
          if (window.MistralFocusTrap) MistralFocusTrap.deactivate();
        }
      });
    }

    // Fermer les modales via Echap
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const pm = document.getElementById('teacher-profile-modal');
      if (pm && pm.classList.contains('open')) {
        pm.classList.remove('open');
        document.body.style.overflow = '';
        if (window.MistralFocusTrap) MistralFocusTrap.deactivate();
        return;
      }
      const sm = document.getElementById('teacher-signup');
      if (sm && sm.classList.contains('open')) {
        sm.classList.remove('open');
        document.body.style.overflow = '';
        if (window.MistralFocusTrap) MistralFocusTrap.deactivate();
      }
    });

    // Ouvrir le modal d'inscription (event delegation pour les liens dynamiques)
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-modal="teacher-signup"]');
      if (trigger) {
        e.preventDefault();
        const modal = document.getElementById('teacher-signup');
        if (modal) {
          modal.classList.add('open');
          document.body.style.overflow = 'hidden';
          if (window.MistralFocusTrap) MistralFocusTrap.activate(modal);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
