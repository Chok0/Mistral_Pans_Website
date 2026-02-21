/* ==========================================================================
   MISTRAL PANS - Admin UI - Module Content
   Professeurs, Galerie, Blog, Analytics
   ========================================================================== */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-content] AdminUI non disponible, module différé');
    return;
  }

  const { $, $$, escapeHtml, formatPrice, formatDate, Toast, Confirm, Modal, Storage, utils } = window.AdminUIHelpers;

  // État scopé par modal via AdminUI.getModalState()

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
                <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="open-teacher-profile" data-id="${t.id}">Voir</button>
                <button class="admin-btn admin-btn--primary admin-btn--sm" data-action="approve-teacher" data-id="${t.id}">Approuver</button>
                <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="reject-teacher" data-id="${t.id}">Rejeter</button>
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
                <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="edit-teacher" data-id="${t.id}">Modifier</button>
                <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="delete-teacher" data-id="${t.id}">Supprimer</button>
              </div>
            </div>
          </div>
        `).join('');
      }
    }
    
    // Mettre à jour les badges
    if (AdminUI.updateBadge) AdminUI.updateBadge('pending-count', pending.length);
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
          ${item.images && item.images.length > 1 ? `<span style="position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.7); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">&#128247; ${item.images.length}</span>` : ''}
          ${item.video ? `<span style="position: absolute; bottom: 0.5rem; left: 0.5rem; background: rgba(0,0,0,0.7); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">▶ Vidéo</span>` : ''}
        </div>
        <div style="padding: 0.75rem;">
          <div style="font-weight: 500; margin-bottom: 0.25rem;">${escapeHtml(item.titre || 'Sans titre')}</div>
          ${item.instrument ? `<div style="font-size: 0.8rem; color: var(--admin-text-muted);">${escapeHtml(item.instrument)}</div>` : ''}
          <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
            <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="edit-media" data-id="${item.id}">Modifier</button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="delete-media" data-id="${item.id}">Supprimer</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function initMediaUpload() {
    const mediaState = AdminUI.getModalState('media');
    mediaState.uploadedImages = [];
    mediaState.uploadedVideo = null;

    // Image upload (multi-image support)
    const imageContainer = $('#media-image-upload');
    if (imageContainer && typeof MistralUpload !== 'undefined') {
      imageContainer.innerHTML = '';
      const input = MistralUpload.createUploadInput({
        id: 'media-image-file',
        acceptType: 'image',
        multiple: true,
        onSelect: async (files) => {
          const fileList = files instanceof FileList ? Array.from(files) : (Array.isArray(files) ? files : [files]);
          for (const file of fileList) {
            const compress = (AdminUI.isCompressionEnabled ? AdminUI.isCompressionEnabled('media') : false);
            const base64 = await AdminUI.fileToBase64(file, compress, 'hero');
            mediaState.uploadedImages.push(base64);
          }
          showMediaImagesPreview(mediaState.uploadedImages);
          Toast.success(fileList.length > 1 ? `${fileList.length} images chargées` : 'Image chargée');
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
  
  function showMediaImagesPreview(images) {
    const container = $('#media-image-preview');
    if (!container) return;
    if (!images || images.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = images.map((src, index) => `
      <div class="upload-preview-item" style="width: 100px; height: 100px; display: inline-block; position: relative; margin: 4px;">
        <img src="${src}" alt="Preview ${index + 1}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
        <button type="button" class="upload-preview-remove" data-action="remove-media-image-at" data-param="${index}" style="position: absolute; top: -6px; right: -6px;">×</button>
        ${index === 0 ? '<span style="position: absolute; bottom: 2px; left: 2px; background: var(--color-accent); color: white; font-size: 0.65rem; padding: 1px 4px; border-radius: 3px;">Cover</span>' : ''}
      </div>
    `).join('');
  }

  // Backward compat alias
  function showMediaImagePreview(src) {
    showMediaImagesPreview(src ? [src] : []);
  }
  
  function removeMediaImageAt(index) {
    const images = AdminUI.getModalState('media').uploadedImages || [];
    const idx = parseInt(index, 10);
    if (idx >= 0 && idx < images.length) {
      images.splice(idx, 1);
    }
    showMediaImagesPreview(images);
  }

  // Backward compat: remove all images
  function removeMediaImage() {
    AdminUI.getModalState('media').uploadedImages = [];
    showMediaImagesPreview([]);
  }
  
  function saveMedia() {
    const id = $('#media-id')?.value;
    const mediaState = AdminUI.getModalState('media');

    // Récupérer les images (uploadées ou URL fallback)
    let images = mediaState.uploadedImages || [];

    // Also check URL input as single image fallback
    const imageUrl = $('#media-image-url')?.value?.trim();
    if (imageUrl && images.length === 0) {
      images = [imageUrl];
    }

    const image = images.length > 0 ? images[0] : '';
    let video = $('#media-video-url')?.value?.trim() || '';

    const data = {
      titre: $('#media-titre')?.value?.trim(),
      description: $('#media-description')?.value?.trim(),
      image: image,
      images: images,
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
      data.id = crypto.randomUUID();
      data.created_at = new Date().toISOString();
      gallery.push(data);
      Toast.success('Média ajouté');
    }
    
    Storage.set('mistral_gallery', gallery);
    AdminUI.closeModal('media');
    renderGalerie();
  }
  
  function editMedia(id) {
    const gallery = Storage.get('mistral_gallery', []);
    const media = gallery.find(m => m.id === id);
    if (!media) return;
    
    $('#modal-media-title').textContent = 'Modifier le média';
    AdminUI.showModal('media');
    initMediaUpload();
    
    $('#media-id').value = media.id;
    $('#media-titre').value = media.titre || '';
    $('#media-description').value = media.description || '';
    $('#media-instrument').value = media.instrument || '';
    $('#media-date').value = media.date || '';
    
    // Load existing images array (backward compat: fallback to single image)
    if (media.images && media.images.length > 0) {
      AdminUI.getModalState('media').uploadedImages = [...media.images];
      showMediaImagesPreview(media.images);
    } else if (media.image) {
      AdminUI.getModalState('media').uploadedImages = [media.image];
      showMediaImagesPreview([media.image]);
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
      Storage.remove('mistral_gallery', id);
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
            <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="edit-article" data-id="${article.id}">Modifier</button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="toggle-article-statut" data-id="${article.id}">
              ${article.status === 'published' ? 'Dépublier' : 'Publier'}
            </button>
            <button class="admin-btn admin-btn--ghost admin-btn--sm" data-action="delete-article" data-id="${article.id}">Supprimer</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function initArticleUpload() {
    AdminUI.getModalState('article').uploadedImage = null;
    
    const imageContainer = $('#article-image-upload');
    if (imageContainer && typeof MistralUpload !== 'undefined') {
      imageContainer.innerHTML = '';
      const input = MistralUpload.createUploadInput({
        id: 'article-image-file',
        acceptType: 'image',
        onSelect: async (file) => {
          const compress = (AdminUI.isCompressionEnabled ? AdminUI.isCompressionEnabled('article') : false);
          const base64 = await AdminUI.fileToBase64(file, compress, 'standard');
          AdminUI.getModalState('article').uploadedImage = base64;
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
  
  async function initArticleEditor() {
    const editorContainer = $('#article-editor');
    if (!editorContainer) return;

    // Détruire l'ancien éditeur si existe
    const artState = AdminUI.getModalState('article');
    if (artState.quillEditor) {
      artState.quillEditor = null;
    }

    editorContainer.innerHTML = '';

    // Lazy-load Quill.js + CSS si pas encore chargé
    if (typeof Quill === 'undefined' && window.MistralUtils) {
      try {
        await Promise.all([
          MistralUtils.loadScript('js/vendor/quill.min.js?v=3.5.3'),
          MistralUtils.loadStylesheet('js/vendor/quill.snow.css?v=3.5.3')
        ]);
      } catch (err) {
        console.warn('[Blog] Echec chargement Quill.js :', err.message);
      }
    }

    if (typeof Quill !== 'undefined') {
      // Nettoyer les toolbars Quill existantes pour éviter les doublons
      var editorEl = document.getElementById('article-editor');
      if (editorEl) {
        var existingToolbar = editorEl.previousElementSibling;
        while (existingToolbar && existingToolbar.classList.contains('ql-toolbar')) {
          var tb = existingToolbar;
          existingToolbar = existingToolbar.previousElementSibling;
          tb.remove();
        }
        editorEl.innerHTML = '';
        editorEl.className = editorEl.className.replace(/ql-\S+/g, '').trim();
      }
      artState.quillEditor = new Quill('#article-editor', {
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
        <button type="button" class="upload-preview-remove" data-action="remove-article-image">×</button>
      </div>
    `;
  }
  
  function removeArticleImage() {
    AdminUI.getModalState('article').uploadedImage = null;
    if ($('#article-image-preview')) $('#article-image-preview').innerHTML = '';
  }
  
  function saveArticle() {
    
    const id = $('#article-id')?.value;
    
    // Récupérer le contenu de l'éditeur et sanitiser avant persistence
    const artState = AdminUI.getModalState('article');
    let content = '';
    if (artState.quillEditor) {
      content = artState.quillEditor.root.innerHTML;
    } else {
      const fallback = $('#article-contenu-fallback');
      if (fallback) content = fallback.value;
    }
    // Sanitiser le HTML Quill avant sauvegarde (protection XSS sur article.html)
    if (content && utils.sanitizeHtml) {
      content = utils.sanitizeHtml(content);
    }
    
    // Mapper vers les noms de champs utilisés par MistralAdmin.Blog
    const data = {
      title: $('#article-titre')?.value?.trim(),
      category: $('#article-categorie')?.value || 'actualite',
      coverImage: artState.uploadedImage || '',
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
      data.id = crypto.randomUUID();
      data.createdAt = new Date().toISOString();
      data.slug = generateSlug(data.title);
      articles.push(data);
      Toast.success('Article créé');
    }
    
    Storage.set('mistral_blog_articles', articles);
    
    
    AdminUI.closeModal('article');
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
    AdminUI.showModal('article');
    initArticleUpload();
    
    $('#article-id').value = article.id;
    $('#article-titre').value = article.title || '';
    $('#article-categorie').value = article.category || 'actualite';
    $('#article-date').value = article.publishedAt ? article.publishedAt.slice(0, 10) : '';
    $('#article-resume').value = article.excerpt || '';
    $('#article-statut').value = article.status === 'published' ? 'publie' : 'brouillon';
    
    if (article.coverImage) {
      AdminUI.getModalState('article').uploadedImage = article.coverImage;
      showArticleImagePreview(article.coverImage);
    }
    
    // Charger le contenu dans l'éditeur (sanitizé pour éviter XSS)
    setTimeout(() => {
      const artEditor = AdminUI.getModalState('article').quillEditor;
      if (artEditor && article.content) {
        // Sanitize le HTML avant de l'injecter dans l'éditeur
        const sanitizedContent = utils.sanitizeHtml ? utils.sanitizeHtml(article.content) : article.content;
        artEditor.root.innerHTML = sanitizedContent;
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
      Storage.remove('mistral_blog_articles', id);
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
        <button class="admin-btn admin-btn--secondary" data-action="export-stats-json">
          Exporter JSON
        </button>
        <button class="admin-btn admin-btn--secondary" data-action="export-stats-csv" data-param="${days}">
          Exporter CSV
        </button>
        <button class="admin-btn admin-btn--ghost" data-action="clear-stats-confirm">
          Réinitialiser
        </button>
      </div>
    `;
    
    // Initialiser les graphiques Chart.js (lazy-load)
    initAnalyticsCharts(dailyTrend, peakHours);
  }

  // Instances Chart.js (pour détruire avant re-création)
  let _chartTrend = null;
  let _chartHours = null;

  async function initAnalyticsCharts(dailyTrend, peakHours) {
    // Lazy-load Chart.js si pas encore chargé
    if (typeof Chart === 'undefined' && window.MistralUtils) {
      try {
        await MistralUtils.loadScript('js/vendor/chart.umd.js?v=3.5.3');
      } catch (err) {
        console.warn('[Analytics] Echec chargement Chart.js :', err.message);
      }
    }

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js non disponible');
      return;
    }

    // Détruire les anciens charts avant re-création
    if (_chartTrend) { _chartTrend.destroy(); _chartTrend = null; }
    if (_chartHours) { _chartHours.destroy(); _chartHours = null; }

    // Graphique tendance
    const trendCtx = document.getElementById('chart-trend');
    if (trendCtx) {
      _chartTrend = new Chart(trendCtx, {
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
      _chartHours = new Chart(hoursCtx, {
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


  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    renderProfesseurs,
    renderGalerie,
    initMediaUpload,
    saveMedia,
    editMedia,
    deleteMedia,
    removeMediaImage,
    removeMediaImageAt,
    renderBlog,
    initArticleUpload,
    initArticleEditor,
    saveArticle,
    editArticle,
    toggleArticleStatut,
    deleteArticle,
    removeArticleImage,
    renderAnalytics
  });

})(window);
