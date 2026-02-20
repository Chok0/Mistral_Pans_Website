// Article loader
(function() {
  'use strict';

  function getSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
  }

  // --- Delegations vers MistralUtils (js/core/utils.js) ---
  const formatDate   = MistralUtils.formatDate;
  const escapeHtml   = MistralUtils.escapeHtml;
  const sanitizeHtml = MistralUtils.sanitizeHtml;

  function loadArticle() {
    const container = document.getElementById('main-content');
    const slug = getSlugFromURL();

    if (!slug) {
      showNotFound(container);
      return;
    }

    // Recuperer les articles depuis MistralSync (in-memory)
    let articles = [];
    if (window.MistralSync && MistralSync.hasKey('mistral_blog_articles')) {
      articles = MistralSync.getData('mistral_blog_articles');
    }

    // Chercher l'article par slug
    const article = articles.find(a => a.slug === slug);

    if (!article) {
      showNotFound(container);
      return;
    }

    // Vérifier si l'article est publié (ou si admin connecté)
    const isAdmin = window.MistralAuth ? window.MistralAuth.isLoggedInSync() : false;
    if (article.status !== 'published' && !isAdmin) {
      showNotFound(container);
      return;
    }

    // Mettre à jour le titre et les meta OG + Twitter + canonical + JSON-LD
    document.title = article.title + ' \u2014 Mistral Pans';
    const articleUrl = 'https://mistralpans.fr/article.html?slug=' + encodeURIComponent(slug);

    const setMeta = (prop, content) => {
      let el = document.querySelector('meta[property="' + prop + '"]');
      if (el) el.setAttribute('content', content);
    };
    const setMetaName = (name, content) => {
      let el = document.querySelector('meta[name="' + name + '"]');
      if (el) el.setAttribute('content', content);
    };

    // Open Graph
    setMeta('og:title', article.title + ' \u2014 Mistral Pans');
    setMeta('og:url', articleUrl);
    if (article.excerpt) setMeta('og:description', article.excerpt);
    if (article.coverImage) {
      let ogImg = document.querySelector('meta[property="og:image"]');
      if (!ogImg) { ogImg = document.createElement('meta'); ogImg.setAttribute('property', 'og:image'); document.head.appendChild(ogImg); }
      ogImg.setAttribute('content', article.coverImage);
    }

    // Twitter Card
    setMetaName('twitter:title', article.title + ' \u2014 Mistral Pans');
    if (article.excerpt) setMetaName('twitter:description', article.excerpt);
    if (article.coverImage) setMetaName('twitter:image', article.coverImage);

    // Canonical
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', articleUrl);

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && article.excerpt) metaDesc.setAttribute('content', article.excerpt);

    // JSON-LD Article
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': article.title,
      'url': articleUrl,
      'author': { '@type': 'Organization', 'name': 'Mistral Pans', 'url': 'https://mistralpans.fr' },
      'publisher': { '@type': 'Organization', 'name': 'Mistral Pans', 'url': 'https://mistralpans.fr' }
    };
    if (article.excerpt) jsonLd.description = article.excerpt;
    if (article.coverImage) jsonLd.image = article.coverImage;
    if (article.publishedAt) jsonLd.datePublished = article.publishedAt;
    if (article.updatedAt) jsonLd.dateModified = article.updatedAt;

    let ldScript = document.querySelector('script[type="application/ld+json"]');
    if (!ldScript) { ldScript = document.createElement('script'); ldScript.type = 'application/ld+json'; document.head.appendChild(ldScript); }
    ldScript.textContent = JSON.stringify(jsonLd);

    // Afficher l'article
    container.innerHTML =
      '<article>' +
        '<div class="article-hero">' +
          (article.coverImage
            ? '<img src="' + article.coverImage + '" alt="' + escapeHtml(article.title) + ' - Image de couverture" class="article-hero__image">'
            : '') +
          '<div class="article-hero__overlay"></div>' +
          '<div class="article-hero__content">' +
            '<div class="container">' +
              '<div class="article-hero__meta">' +
                (article.category ? '<span>' + escapeHtml(article.category) + '</span>' : '') +
                (article.publishedAt ? '<span>' + formatDate(article.publishedAt) + '</span>' : '') +
              '</div>' +
              '<h1 class="article-hero__title">' + escapeHtml(article.title) + '</h1>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="article-content">' +
          sanitizeHtml(article.content || '<p>Contenu de l\'article...</p>') +
        '</div>' +
        '<nav class="article-nav">' +
          '<a href="blog.html" class="article-nav__link">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<line x1="19" y1="12" x2="5" y2="12"></line>' +
              '<polyline points="12 19 5 12 12 5"></polyline>' +
            '</svg>' +
            'Retour au blog' +
          '</a>' +
        '</nav>' +
      '</article>' +
      (article.status === 'draft'
        ? '<div style="position:fixed;bottom:1rem;left:1rem;background:#D97706;color:white;padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.875rem;font-weight:500;">Brouillon (non publié)</div>'
        : '');
  }

  function showNotFound(container) {
    document.title = 'Article non trouvé \u2014 Mistral Pans';
    container.innerHTML =
      '<div class="article-not-found">' +
        '<h1>Article non trouvé</h1>' +
        '<p style="color: var(--color-text-light); margin-bottom: var(--space-lg);">' +
          'Cet article n\'existe pas ou n\'est plus disponible.' +
        '</p>' +
        '<a href="blog.html" class="btn btn--primary">Retour au blog</a>' +
      '</div>';
  }

  // Charger l'article quand les donnees sont pretes
  window.addEventListener('mistral-sync-complete', loadArticle);

  // Aussi tenter au chargement (au cas ou MistralSync est deja pret)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadArticle);
  } else {
    loadArticle();
  }
})();
