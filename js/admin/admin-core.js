/* ==========================================================================
   MISTRAL PANS - Admin Core
   Systeme d'administration centralise
   ========================================================================== */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CONFIG = {
    // Storage keys
    STORAGE_KEYS: {
      annonces: 'mistral_flash_annonces',
      teachers: 'mistral_teachers',
      pendingTeachers: 'mistral_pending_teachers',
      gallery: 'mistral_gallery',
      articles: 'mistral_blog_articles',
      leafletConsent: 'mistral_leaflet_consent'
    }
  };

  // ============================================================================
  // UTILITAIRES
  // ============================================================================

  // --- Delegations vers MistralUtils (js/core/utils.js) ---
  const generateId   = MistralUtils.generateId;
  const formatDate   = MistralUtils.formatDate;
  const formatPrice  = MistralUtils.formatPrice;
  const escapeHtml   = MistralUtils.escapeHtml;
  const sanitizeHtml = MistralUtils.sanitizeHtml;
  const debounce     = MistralUtils.debounce;

  // ============================================================================
  // AUTHENTIFICATION (delegue a MistralAuth / Supabase)
  // ============================================================================

  const Auth = {
    /**
     * Verifie si l'admin est connecte (synchrone, via MistralAuth)
     */
    isLoggedIn() {
      if (window.MistralAuth) {
        return window.MistralAuth.isLoggedInSync();
      }
      return false;
    },

    /**
     * Connexion admin via Supabase Auth
     */
    async login(email, password) {
      if (!window.MistralAuth) {
        console.error('[Admin] MistralAuth non disponible');
        return false;
      }
      const result = await window.MistralAuth.login(email, password);
      return result.success;
    },

    /**
     * Deconnexion via Supabase Auth
     */
    logout() {
      if (window.MistralAuth) {
        window.MistralAuth.logout();
      }
      // Dispatch un evenement pour que les pages puissent reagir
      window.dispatchEvent(new CustomEvent('adminLogout'));
    },

    /**
     * Recupere les infos de session
     */
    getSession() {
      if (!window.MistralAuth) return null;
      const user = window.MistralAuth.getUserSync();
      if (!user) return null;
      return { user: user.email, supabase: true };
    }
  };

  // ============================================================================
  // STOCKAGE GENERIQUE (CRUD)
  // ============================================================================

  const Storage = {
    /**
     * Recupere des donnees (MistralSync pour les cles gerees, localStorage sinon)
     */
    get(key, defaultValue = []) {
      // Cles gerees par MistralSync -> lecture depuis memoire
      if (window.MistralSync && MistralSync.hasKey(key)) {
        const data = MistralSync.getData(key);
        // Pour les tableaux, verifier s'ils sont non-vides
        if (Array.isArray(data)) {
          return data.length > 0 ? data : defaultValue;
        }
        // Pour les objets (config key-value), verifier s'ils ont des cles
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          return data;
        }
        return defaultValue;
      }
      // Cles locales (consent, etc.) -> localStorage
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
      } catch {
        return defaultValue;
      }
    },

    /**
     * Sauvegarde des donnees (MistralSync pour les cles gerees, localStorage sinon)
     */
    set(key, value) {
      // Cles gerees par MistralSync -> ecriture memoire + Supabase
      if (window.MistralSync && MistralSync.hasKey(key)) {
        const result = MistralSync.setData(key, value);
        window.dispatchEvent(new CustomEvent('storageUpdate', { detail: { key, value } }));
        return result;
      }
      // Cles locales (consent, etc.) -> localStorage
      try {
        localStorage.setItem(key, JSON.stringify(value));
        window.dispatchEvent(new CustomEvent('storageUpdate', { detail: { key, value } }));
        return true;
      } catch (e) {
        console.error('Storage error:', e);
        return false;
      }
    },

    /**
     * Ajoute un element a une collection
     */
    add(key, item, idField = 'id') {
      const items = this.get(key, []);

      // Generer un ID si non present
      if (!item[idField]) {
        const prefix = key.split('_').pop();
        item[idField] = generateId(prefix);
      }

      // Ajouter timestamps
      item.createdAt = item.createdAt || new Date().toISOString();
      item.updatedAt = new Date().toISOString();

      items.push(item);
      this.set(key, items);
      return item;
    },

    /**
     * Met a jour un element dans une collection
     */
    update(key, id, updates, idField = 'id') {
      const items = this.get(key, []);
      const index = items.findIndex(item => String(item[idField]) === String(id));

      if (index === -1) return null;

      items[index] = {
        ...items[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.set(key, items);
      return items[index];
    },

    /**
     * Supprime un element d'une collection
     */
    remove(key, id, idField = 'id') {
      const items = this.get(key, []);
      const filtered = items.filter(item => String(item[idField]) !== String(id));

      if (filtered.length === items.length) return false;

      // Mettre a jour la memoire locale SANS upsert Supabase
      // (un upsert ne supprime pas les lignes absentes, il faut un DELETE explicite)
      if (window.MistralSync && MistralSync.hasKey(key)) {
        MistralSync.setDataLocal(key, filtered);
        window.dispatchEvent(new CustomEvent('storageUpdate', { detail: { key, value: filtered } }));
      } else {
        this.set(key, filtered);
      }

      // Supprimer dans Supabase via DELETE explicite
      if (window.MistralSync && MistralSync.deleteFromSupabase) {
        MistralSync.deleteFromSupabase(key, id).then(success => {
          if (!success) {
            console.error(`[Storage] Echec suppression Supabase ${key}/${id}`);
          }
        }).catch(err => {
          console.error(`[Storage] Erreur suppression Supabase ${key}/${id}:`, err);
        });
      }

      return true;
    },

    /**
     * Trouve un element par ID
     */
    find(key, id, idField = 'id') {
      const items = this.get(key, []);
      // Comparaison souple pour gerer les IDs numeriques et strings
      return items.find(item => String(item[idField]) === String(id)) || null;
    },

    /**
     * Reordonne une collection
     */
    reorder(key, orderedIds, idField = 'id') {
      const items = this.get(key, []);
      const reordered = orderedIds
        .map(id => items.find(item => item[idField] === id))
        .filter(Boolean);

      // Ajouter les items non presents dans orderedIds a la fin
      items.forEach(item => {
        if (!orderedIds.includes(item[idField])) {
          reordered.push(item);
        }
      });

      this.set(key, reordered);
      return reordered;
    }
  };

  // ============================================================================
  // COMPOSANT MODAL
  // ============================================================================

  const Modal = {
    activeModals: [],

    /**
     * Cree une modale
     */
    create(options = {}) {
      const {
        id = generateId('modal'),
        title = '',
        content = '',
        size = 'medium', // small, medium, large, fullscreen
        closable = true,
        onClose = null,
        onOpen = null,
        footer = null
      } = options;

      const modal = document.createElement('div');
      modal.id = id;
      modal.className = `admin-modal-overlay admin-modal--${size}`;
      modal.innerHTML = `
        <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
          <div class="admin-modal__header">
            <h2 class="admin-modal__title" id="${id}-title">${escapeHtml(title)}</h2>
            ${closable ? `
              <button class="admin-modal__close" aria-label="Fermer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            ` : ''}
          </div>
          <div class="admin-modal__body">
            ${content}
          </div>
          ${footer ? `<div class="admin-modal__footer">${footer}</div>` : ''}
        </div>
      `;

      // Ajouter au DOM
      document.body.appendChild(modal);

      // Events
      if (closable) {
        const ac = new AbortController();
        modal._abortController = ac;

        const closeBtn = modal.querySelector('.admin-modal__close');
        closeBtn.addEventListener('click', () => this.close(id));

        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            this.close(id);
          }
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && this.activeModals[this.activeModals.length - 1] === id) {
            this.close(id);
          }
        }, { signal: ac.signal });
      }

      // Stocker les callbacks
      modal._onClose = onClose;
      modal._onOpen = onOpen;

      return modal;
    },

    /**
     * Ouvre une modale
     */
    open(modalOrId) {
      const modal = typeof modalOrId === 'string'
        ? document.getElementById(modalOrId)
        : modalOrId;

      if (!modal) return;

      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      this.activeModals.push(modal.id);

      if (modal._onOpen) {
        modal._onOpen(modal);
      }

      // Focus trap + premier element focusable (WCAG 2.4.3)
      if (window.MistralFocusTrap) {
        MistralFocusTrap.activate(modal);
      } else {
        setTimeout(() => {
          const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (focusable) focusable.focus();
        }, 100);
      }
    },

    /**
     * Ferme une modale
     */
    close(modalOrId) {
      const modal = typeof modalOrId === 'string'
        ? document.getElementById(modalOrId)
        : modalOrId;

      if (!modal) return;

      modal.classList.remove('open');

      const index = this.activeModals.indexOf(modal.id);
      if (index > -1) {
        this.activeModals.splice(index, 1);
      }

      if (this.activeModals.length === 0) {
        document.body.style.overflow = '';
      }

      // Nettoyer les listeners globaux
      if (modal._abortController) {
        modal._abortController.abort();
        modal._abortController = null;
      }

      // Desactiver le piege de focus
      if (window.MistralFocusTrap) MistralFocusTrap.deactivate();

      if (modal._onClose) {
        modal._onClose(modal);
      }
    },

    /**
     * Met a jour le contenu d'une modale
     */
    setContent(modalOrId, content) {
      const modal = typeof modalOrId === 'string'
        ? document.getElementById(modalOrId)
        : modalOrId;

      if (!modal) return;

      const body = modal.querySelector('.admin-modal__body');
      if (body) {
        body.innerHTML = content;
      }
    },

    /**
     * Supprime une modale
     */
    destroy(modalOrId) {
      const modal = typeof modalOrId === 'string'
        ? document.getElementById(modalOrId)
        : modalOrId;

      if (modal) {
        modal._onClose = null;
        modal._onOpen = null;
      }
      this.close(modalOrId);
      if (modal) {
        modal.remove();
      }
    }
  };

  // ============================================================================
  // COMPOSANT TOAST (NOTIFICATIONS)
  // ============================================================================

  const Toast = {
    container: null,

    /**
     * Initialise le conteneur de toasts
     */
    init() {
      if (this.container) return;

      this.container = document.createElement('div');
      this.container.className = 'admin-toast-container';
      document.body.appendChild(this.container);
    },

    /**
     * Affiche un toast
     */
    show(message, type = 'info', duration = 3000) {
      this.init();

      const toast = document.createElement('div');
      toast.className = `admin-toast admin-toast--${type}`;

      const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
      };

      toast.innerHTML = `
        <span class="admin-toast__icon">${icons[type] || icons.info}</span>
        <span class="admin-toast__message">${escapeHtml(message)}</span>
        <button class="admin-toast__close" aria-label="Fermer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      this.container.appendChild(toast);

      // Animation d'entree
      requestAnimationFrame(() => {
        toast.classList.add('show');
      });

      // Fermer au clic
      toast.querySelector('.admin-toast__close').addEventListener('click', () => {
        this.hide(toast);
      });

      // Auto-fermeture
      if (duration > 0) {
        setTimeout(() => this.hide(toast), duration);
      }

      return toast;
    },

    /**
     * Cache un toast
     */
    hide(toast) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    },

    // Raccourcis
    success(message, duration) { return this.show(message, 'success', duration); },
    error(message, duration) { return this.show(message, 'error', duration); },
    warning(message, duration) { return this.show(message, 'warning', duration); },
    info(message, duration) { return this.show(message, 'info', duration); }
  };

  // ============================================================================
  // COMPOSANT CONFIRM
  // ============================================================================

  const Confirm = {
    /**
     * Affiche une boite de dialogue de confirmation
     */
    show(options = {}) {
      return new Promise((resolve) => {
        const {
          title = 'Confirmation',
          message = 'Etes-vous sur ?',
          confirmText = 'Confirmer',
          cancelText = 'Annuler',
          type = 'warning', // warning, danger, info
          isHtml = false
        } = options;

        const modal = Modal.create({
          id: generateId('confirm'),
          title,
          size: 'small',
          content: `
            <div class="admin-confirm__message">${isHtml ? message : escapeHtml(message)}</div>
          `,
          footer: `
            <button class="admin-btn admin-btn--secondary" data-action="cancel">${escapeHtml(cancelText)}</button>
            <button class="admin-btn admin-btn--${type === 'danger' ? 'danger' : 'primary'}" data-action="confirm">${escapeHtml(confirmText)}</button>
          `,
          closable: true,
          onClose: () => {
            resolve(false);
            Modal.destroy(modal);
          }
        });

        modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
          resolve(false);
          Modal.destroy(modal);
        });

        modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
          resolve(true);
          Modal.destroy(modal);
        });

        Modal.open(modal);
      });
    },

    /**
     * Raccourci pour suppression
     */
    delete(itemName = 'cet element') {
      return this.show({
        title: 'Supprimer',
        message: `Voulez-vous vraiment supprimer ${itemName} ? Cette action est irreversible.`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        type: 'danger'
      });
    }
  };

  // ============================================================================
  // MODULES METIER
  // ============================================================================

  // --- Module Migrations (cleanup orphaned data) ---
  const Migrations = {
    // Clean up orphaned mistral_flash_annonces (old system replaced by mistral_gestion_instruments)
    cleanupOldAnnonces() {
      const oldKey = CONFIG.STORAGE_KEYS.annonces; // 'mistral_flash_annonces'
      try {
        const oldData = localStorage.getItem(oldKey);
        if (oldData) {
          console.log('[MistralAdmin] Nettoyage des anciennes annonces orphelines...');
          localStorage.removeItem(oldKey);
          return true;
        }
      } catch (e) {
        // Ignorer
      }
      return false;
    },

    // Run all migrations
    runAll() {
      let cleaned = false;
      if (this.cleanupOldAnnonces()) cleaned = true;
      if (cleaned) {
        console.log('[MistralAdmin] Migrations terminees');
      }
      return cleaned;
    }
  };

  // Auto-run migrations on load
  Migrations.runAll();

  // --- Module Professeurs ---
  const Teachers = {
    KEY: CONFIG.STORAGE_KEYS.teachers,
    PENDING_KEY: CONFIG.STORAGE_KEYS.pendingTeachers,

    // Professeurs valides
    getAll() {
      return Storage.get(this.KEY, []);
    },

    get(id) {
      return Storage.find(this.KEY, id);
    },

    add(teacher) {
      return Storage.add(this.KEY, {
        ...teacher,
        status: 'active'
      });
    },

    update(id, updates) {
      return Storage.update(this.KEY, id, updates);
    },

    delete(id) {
      return Storage.remove(this.KEY, id);
    },

    // Supprimer tous les professeurs (pour reset)
    clearAll() {
      Storage.set(this.KEY, []);
      return [];
    },

    // Supprimer toutes les demandes en attente
    clearAllPending() {
      Storage.set(this.PENDING_KEY, []);
      return [];
    },

    // Demandes en attente
    getPending() {
      return Storage.get(this.PENDING_KEY, []);
    },

    getPendingCount() {
      return this.getPending().length;
    },

    addPending(request) {
      return Storage.add(this.PENDING_KEY, {
        ...request,
        status: 'pending',
        submittedAt: new Date().toISOString()
      });
    },

    approve(pendingId) {
      const pending = Storage.find(this.PENDING_KEY, pendingId);
      if (!pending) return null;

      // Transformer en professeur
      const teacher = {
        name: `${pending.firstname} ${pending.lastname}`,
        firstname: pending.firstname,
        lastname: pending.lastname,
        location: pending.location || pending.city,
        postalcode: pending.postalcode,
        city: pending.city,
        lat: pending.lat || 48.8566,
        lng: pending.lng || 2.3522,
        bio: pending.bio,
        email: pending.email,
        phone: pending.phone,
        photo: pending.photo,
        courseTypes: pending.courseTypes || [],
        courseFormats: pending.courseFormats || [],
        instrumentAvailable: pending.instrumentAvailable || false,
        website: pending.website,
        instagram: pending.instagram,
        facebook: pending.facebook,
        youtube: pending.youtube,
        tiktok: pending.tiktok
      };

      // Ajouter aux professeurs
      const newTeacher = this.add(teacher);

      // Supprimer des demandes
      Storage.remove(this.PENDING_KEY, pendingId);

      return newTeacher;
    },

    reject(pendingId) {
      return Storage.remove(this.PENDING_KEY, pendingId);
    }
  };

  // --- Module Galerie ---
  const Gallery = {
    KEY: CONFIG.STORAGE_KEYS.gallery,

    getAll() {
      return Storage.get(this.KEY, []);
    },

    get(id) {
      return Storage.find(this.KEY, id);
    },

    add(media) {
      return Storage.add(this.KEY, {
        ...media,
        ordre: this.getAll().length + 1
      });
    },

    update(id, updates) {
      return Storage.update(this.KEY, id, updates);
    },

    delete(id) {
      return Storage.remove(this.KEY, id);
    },

    reorder(orderedIds) {
      return Storage.reorder(this.KEY, orderedIds);
    }
  };

  // --- Module Blog ---
  const Blog = {
    KEY: CONFIG.STORAGE_KEYS.articles,

    getAll() {
      return Storage.get(this.KEY, []);
    },

    getPublished() {
      return this.getAll().filter(a => a.status === 'published');
    },

    getDrafts() {
      return this.getAll().filter(a => a.status === 'draft');
    },

    get(id) {
      return Storage.find(this.KEY, id);
    },

    getBySlug(slug) {
      const articles = this.getAll();
      return articles.find(a => a.slug === slug) || null;
    },

    add(article) {
      // Generer un slug si non fourni
      if (!article.slug) {
        article.slug = this.generateSlug(article.title);
      }
      return Storage.add(this.KEY, {
        ...article,
        status: article.status || 'draft'
      });
    },

    update(id, updates) {
      // Regenerer le slug si le titre change
      if (updates.title && !updates.slug) {
        updates.slug = this.generateSlug(updates.title);
      }
      return Storage.update(this.KEY, id, updates);
    },

    delete(id) {
      return Storage.remove(this.KEY, id);
    },

    publish(id) {
      return this.update(id, {
        status: 'published',
        publishedAt: new Date().toISOString()
      });
    },

    unpublish(id) {
      return this.update(id, { status: 'draft' });
    },

    generateSlug(title) {
      return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
  };

  // ============================================================================
  // CONSENTEMENT RGPD (Leaflet)
  // ============================================================================

  const Consent = {
    KEY: CONFIG.STORAGE_KEYS.leafletConsent,

    hasConsent(type = 'leaflet') {
      const consents = Storage.get(this.KEY, {});
      return consents[type] === true;
    },

    setConsent(type = 'leaflet', value = true) {
      const consents = Storage.get(this.KEY, {});
      consents[type] = value;
      Storage.set(this.KEY, consents);
    },

    revokeConsent(type = 'leaflet') {
      this.setConsent(type, false);
    }
  };

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  function init() {
    // Rien a initialiser automatiquement — l'admin accede directement a admin.html
  }

  // Auto-init au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============================================================================
  // EXPORT PUBLIC API
  // ============================================================================

  window.MistralAdmin = {
    // Utils
    utils: {
      generateId,
      formatDate,
      formatPrice,
      escapeHtml,
      sanitizeHtml,
      debounce
    },

    // Core
    Auth,
    Storage,

    // UI Components
    Modal,
    Toast,
    Confirm,

    // Business Modules
    Migrations,
    Teachers,
    Gallery,
    Blog,

    // RGPD
    Consent
  };

})(window);
