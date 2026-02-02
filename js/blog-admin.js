/* ==========================================================================
   MISTRAL PANS - Blog Admin Integration
   Intégration du système admin dans la page blog
   ========================================================================== */

(function() {
  'use strict';

  if (typeof MistralAdmin === 'undefined') {
    console.error('MistralAdmin non chargé');
    return;
  }

  const { Auth, FAB, Modal, Toast, Confirm, Blog, utils } = MistralAdmin;

  // ============================================================================
  // DONNÉES PAR DÉFAUT (exemples d'articles)
  // ============================================================================

  const DEFAULT_ARTICLES = [
    {
      id: 'article_default_1',
      slug: 'choisir-premiere-gamme-handpan',
      title: 'Comment choisir sa première gamme de handpan',
      excerpt: 'Guide complet pour les débutants qui souhaitent choisir leur première gamme de handpan.',
      content: '<p>Le choix de votre première gamme de handpan est une étape cruciale...</p>',
      coverImage: 'ressources/images/blog/gammes-cover.jpg',
      author: 'Mistral Pans',
      category: 'guide',
      tags: ['débutant', 'gammes', 'conseil'],
      status: 'published',
      publishedAt: '2025-01-15T10:00:00Z',
      createdAt: '2025-01-10T09:00:00Z',
      updatedAt: '2025-01-15T10:00:00Z'
    },
    {
      id: 'article_default_2',
      slug: 'entretien-handpan-conseils',
      title: 'Entretenir son handpan : les gestes essentiels',
      excerpt: 'Découvrez les bonnes pratiques pour garder votre handpan en parfait état.',
      content: '<p>Un handpan bien entretenu vous accompagnera pendant de nombreuses années...</p>',
      coverImage: 'ressources/images/blog/entretien-cover.jpg',
      author: 'Mistral Pans',
      category: 'conseil',
      tags: ['entretien', 'protection', 'conseil'],
      status: 'published',
      publishedAt: '2025-01-20T14:00:00Z',
      createdAt: '2025-01-18T11:00:00Z',
      updatedAt: '2025-01-20T14:00:00Z'
    }
  ];

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  function initDefaultData() {
    const existing = Blog.getAll();
    if (existing.length === 0) {
      // Les articles par défaut seront ajoutés si le blog est vide
      // Pour l'instant on laisse vide, l'admin les créera
    }
  }

  // ============================================================================
  // RENDU DES ARTICLES (PUBLIC)
  // ============================================================================

  function renderArticles() {
    const container = document.getElementById('blog-articles-grid');
    if (!container) return;

    const articles = Blog.getPublished();

    if (articles.length === 0) {
      container.innerHTML = `
        <div class="blog-empty" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
          <p style="font-family: var(--font-display); font-size: 1.25rem; margin-bottom: 0.5rem;">Blog en construction</p>
          <p style="color: var(--color-text-muted);">Les premiers articles arrivent bientôt</p>
        </div>
      `;
      return;
    }

    container.innerHTML = articles.map(article => `
      <article class="blog-card" data-id="${article.id}">
        <div class="blog-card__image">
          ${article.coverImage ? `
            <img src="${article.coverImage}" alt="${utils.escapeHtml(article.title)}" loading="lazy">
          ` : `
            <div class="blog-card__placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </div>
          `}
        </div>
        <div class="blog-card__content">
          <div class="blog-card__meta">
            ${article.category ? `<span class="blog-card__category">${utils.escapeHtml(article.category)}</span>` : ''}
            <span class="blog-card__date">${utils.formatDate(article.publishedAt)}</span>
          </div>
          <h2 class="blog-card__title">
            <a href="article.html?slug=${article.slug}">${utils.escapeHtml(article.title)}</a>
          </h2>
          ${article.excerpt ? `
            <p class="blog-card__excerpt">${utils.escapeHtml(article.excerpt)}</p>
          ` : ''}
          <a href="article.html?slug=${article.slug}" class="blog-card__link">Lire la suite â†'</a>
        </div>
      </article>
    `).join('');
  }

  // ============================================================================
  // MODALE DE GESTION RAPIDE
  // ============================================================================

  function openManageModal() {
    const articles = Blog.getAll();

    const modal = Modal.create({
      id: 'manage-blog-modal',
      title: 'Gérer les articles',
      size: 'large',
      content: articles.length === 0 ? `
        <div class="admin-empty">
          <div class="admin-empty__title">Aucun article</div>
          <div class="admin-empty__text">Rédigez votre premier article depuis la page d'administration</div>
        </div>
      ` : `
        <div class="admin-list">
          ${articles.map(a => `
            <div class="admin-list-item" data-id="${a.id}">
              <div class="admin-list-item__content">
                <div class="admin-list-item__title">
                  ${utils.escapeHtml(a.title)}
                  <span class="admin-badge ${a.status === 'published' ? 'admin-badge--success' : 'admin-badge--neutral'}" style="margin-left: 0.5rem;">
                    ${a.status === 'published' ? 'Publié' : 'Brouillon'}
                  </span>
                </div>
                <div class="admin-list-item__subtitle">
                  ${a.publishedAt ? utils.formatDate(a.publishedAt) : 'Non publié'}
                  ${a.category ? ` "¢ ${utils.escapeHtml(a.category)}` : ''}
                </div>
              </div>
              <div class="admin-list-item__actions">
                <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="BlogAdmin.toggleStatus('${a.id}')">
                  ${a.status === 'published' ? 'Dépublier' : 'Publier'}
                </button>
                <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="BlogAdmin.edit('${a.id}')">
                  Modifier
                </button>
                <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="BlogAdmin.delete('${a.id}')">
                  Supprimer
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `,
      footer: `
        <button class="admin-btn admin-btn--secondary" onclick="MistralAdmin.Modal.close('manage-blog-modal')">Fermer</button>
        <button class="admin-btn admin-btn--primary" onclick="BlogAdmin.newArticle()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          Nouvel article
        </button>
      `
    });

    Modal.open(modal);
  }

  // ============================================================================
  // ACTIONS PUBLIQUES
  // ============================================================================

  window.BlogAdmin = {
    newArticle() {
      // Rediriger vers l'éditeur dans la page admin
      window.location.href = 'admin.html#blog';
    },

    edit(id) {
      // Rediriger vers l'éditeur avec l'ID de l'article
      window.location.href = `admin.html#blog&edit=${id}`;
    },

    toggleStatus(id) {
      const article = Blog.get(id);
      if (article) {
        if (article.status === 'published') {
          Blog.unpublish(id);
          Toast.info('Article dépublié');
        } else {
          Blog.publish(id);
          Toast.success('Article publié');
        }
        renderArticles();
        
        // Mettre à jour la modale
        Modal.close('manage-blog-modal');
        openManageModal();
      }
    },

    async delete(id) {
      const confirmed = await Confirm.delete('cet article');
      if (confirmed) {
        Blog.delete(id);
        Toast.success('Article supprimé');
        renderArticles();
        
        Modal.close('manage-blog-modal');
        openManageModal();
      }
    }
  };

  // ============================================================================
  // FAB
  // ============================================================================

  function initAdminFAB() {
    if (!Auth.isLoggedIn()) return;

    const publishedCount = Blog.getPublished().length;
    const draftCount = Blog.getDrafts().length;

    FAB.create({
      position: 'bottom-right',
      actions: [
        {
          id: 'manage',
          label: 'Gérer les articles',
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
          badge: draftCount > 0 ? `${draftCount} brouillon${draftCount > 1 ? 's' : ''}` : null,
          handler: openManageModal
        },
        {
          id: 'new',
          label: 'Nouvel article',
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
          handler: () => BlogAdmin.newArticle()
        },
        {
          id: 'logout',
          label: 'Déconnexion',
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
          handler: () => {
            Auth.logout();
            FAB.destroy();
            Toast.info('Déconnecté');
          }
        }
      ],
      advancedLink: 'admin.html#blog'
    });
  }

  // ============================================================================
  // INIT
  // ============================================================================

  function init() {
    initDefaultData();
    renderArticles();
    initAdminFAB();

    window.addEventListener('adminLogout', () => {
      FAB.destroy();
    });

    window.addEventListener('storage', (e) => {
      if (e.key && e.key.includes('mistral_blog')) {
        renderArticles();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
