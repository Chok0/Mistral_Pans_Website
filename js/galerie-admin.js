/* ==========================================================================
   MISTRAL PANS - Galerie Admin Integration
   SystÃ¨me de galerie avec fiches instruments et lightbox plein Ã©cran
   ========================================================================== */

(function() {
  'use strict';

  if (typeof MistralAdmin === 'undefined') {
    console.error('MistralAdmin non chargÃ©');
    return;
  }

  const { Auth, FAB, Modal, Toast, Confirm, Gallery, utils } = MistralAdmin;

  // ============================================================================
  // RENDU DE LA GALERIE (GRILLE)
  // ============================================================================

  function renderGallery() {
    const container = document.getElementById('gallery-grid');
    if (!container) return;

    const instruments = Gallery.getAll();

    if (instruments.length === 0) {
      container.innerHTML = `
        <div class="gallery-empty" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
          <p style="font-family: var(--font-display); font-size: 1.25rem; margin-bottom: 0.5rem;">Galerie en construction</p>
          <p style="color: var(--color-text-muted);">De nouvelles crÃ©ations arrivent bientÃ´t</p>
        </div>
      `;
      return;
    }

    container.innerHTML = instruments.map(instr => `
      <div class="gallery-item" data-id="${instr.id}" onclick="GaleriePublic.openLightbox('${instr.id}')">
        <img src="${instr.cover || instr.thumbnail || instr.src || ''}" alt="${utils.escapeHtml(instr.title || '')}" loading="lazy">
        ${instr.media && instr.media.some(m => m.type === 'video') ? `
          <div class="gallery-item__video-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
        ` : ''}
        ${instr.title ? `
          <div class="gallery-item__caption">
            <span class="gallery-item__title">${utils.escapeHtml(instr.title)}</span>
            ${instr.subtitle ? `<span class="gallery-item__subtitle">${utils.escapeHtml(instr.subtitle)}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  // ============================================================================
  // LIGHTBOX FICHE INSTRUMENT
  // ============================================================================

  let currentInstrument = null;
  let currentMediaIndex = 0;

  function createLightbox() {
    if (document.getElementById('instrument-lightbox')) return;

    const lightbox = document.createElement('div');
    lightbox.id = 'instrument-lightbox';
    lightbox.className = 'instrument-lightbox';
    lightbox.innerHTML = `
      <button class="instrument-lightbox__close" aria-label="Fermer">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      
      <div class="instrument-lightbox__media">
        <button class="instrument-lightbox__nav instrument-lightbox__nav--prev" aria-label="PrÃ©cÃ©dent">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        
        <div class="instrument-lightbox__content">
          <img class="instrument-lightbox__image" src="" alt="" style="display:none;">
          <video class="instrument-lightbox__video" controls style="display:none;"></video>
        </div>
        
        <button class="instrument-lightbox__nav instrument-lightbox__nav--next" aria-label="Suivant">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      
      <div class="instrument-lightbox__dots"></div>
      
      <div class="instrument-lightbox__info">
        <div class="instrument-lightbox__text">
          <h2 class="instrument-lightbox__title"></h2>
          <p class="instrument-lightbox__subtitle"></p>
        </div>
        <button class="instrument-lightbox__cta btn btn--primary">
          Demander des infos
        </button>
      </div>
    `;

    // Ajouter les styles
    injectLightboxStyles();

    document.body.appendChild(lightbox);

    // Event listeners
    lightbox.querySelector('.instrument-lightbox__close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.instrument-lightbox__nav--prev').addEventListener('click', () => navigateMedia(-1));
    lightbox.querySelector('.instrument-lightbox__nav--next').addEventListener('click', () => navigateMedia(1));
    lightbox.querySelector('.instrument-lightbox__cta').addEventListener('click', openContactFromLightbox);
    
    // Fermer au clic sur l'overlay (mais pas sur le contenu)
    lightbox.querySelector('.instrument-lightbox__media').addEventListener('click', (e) => {
      if (e.target.classList.contains('instrument-lightbox__media')) {
        closeLightbox();
      }
    });

    // Navigation clavier
    document.addEventListener('keydown', handleLightboxKeyboard);

    return lightbox;
  }

  function openLightbox(instrumentId) {
    const instruments = Gallery.getAll();
    const instrument = instruments.find(i => i.id === instrumentId);
    
    if (!instrument) {
      console.error('Instrument non trouvÃ©:', instrumentId);
      return;
    }

    currentInstrument = instrument;
    currentMediaIndex = 0;

    let lightbox = document.getElementById('instrument-lightbox');
    if (!lightbox) {
      lightbox = createLightbox();
    }

    // Mettre Ã  jour les infos
    lightbox.querySelector('.instrument-lightbox__title').textContent = instrument.title || '';
    lightbox.querySelector('.instrument-lightbox__subtitle').textContent = instrument.subtitle || '';

    // GÃ©nÃ©rer les mÃ©dias (cover + media[])
    const allMedia = buildMediaList(instrument);
    
    // CrÃ©er les dots de navigation
    const dotsContainer = lightbox.querySelector('.instrument-lightbox__dots');
    if (allMedia.length > 1) {
      dotsContainer.innerHTML = allMedia.map((_, i) => `
        <button class="instrument-lightbox__dot ${i === 0 ? 'active' : ''}" data-index="${i}"></button>
      `).join('');
      dotsContainer.style.display = 'flex';
      
      // Event listeners pour les dots
      dotsContainer.querySelectorAll('.instrument-lightbox__dot').forEach(dot => {
        dot.addEventListener('click', () => {
          currentMediaIndex = parseInt(dot.dataset.index);
          updateLightboxMedia();
        });
      });
    } else {
      dotsContainer.style.display = 'none';
    }

    // Afficher/masquer les flÃ¨ches
    const prevBtn = lightbox.querySelector('.instrument-lightbox__nav--prev');
    const nextBtn = lightbox.querySelector('.instrument-lightbox__nav--next');
    prevBtn.style.display = allMedia.length > 1 ? 'flex' : 'none';
    nextBtn.style.display = allMedia.length > 1 ? 'flex' : 'none';

    // Afficher le premier mÃ©dia
    updateLightboxMedia();

    // Ouvrir
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    const lightbox = document.getElementById('instrument-lightbox');
    if (!lightbox) return;

    // ArrÃªter la vidÃ©o si en cours
    const video = lightbox.querySelector('.instrument-lightbox__video');
    if (video) {
      video.pause();
      video.src = '';
    }

    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    currentInstrument = null;
    currentMediaIndex = 0;
  }

  function buildMediaList(instrument) {
    const list = [];
    
    // Cover en premier
    if (instrument.cover) {
      list.push({ type: 'image', src: instrument.cover });
    }
    
    // Puis les mÃ©dias additionnels
    if (instrument.media && Array.isArray(instrument.media)) {
      instrument.media.forEach(m => {
        list.push(m);
      });
    }
    
    // Fallback pour ancien format (src direct)
    if (list.length === 0 && instrument.src) {
      list.push({ type: instrument.type || 'image', src: instrument.src });
    }
    
    // Fallback thumbnail
    if (list.length === 0 && instrument.thumbnail) {
      list.push({ type: 'image', src: instrument.thumbnail });
    }
    
    return list;
  }

  function updateLightboxMedia() {
    if (!currentInstrument) return;

    const lightbox = document.getElementById('instrument-lightbox');
    const allMedia = buildMediaList(currentInstrument);
    const media = allMedia[currentMediaIndex];

    if (!media) return;

    const imgEl = lightbox.querySelector('.instrument-lightbox__image');
    const videoEl = lightbox.querySelector('.instrument-lightbox__video');

    // Reset
    imgEl.style.display = 'none';
    videoEl.style.display = 'none';
    videoEl.pause();

    if (media.type === 'video') {
      videoEl.src = media.src;
      videoEl.style.display = 'block';
    } else {
      imgEl.src = media.src;
      imgEl.alt = currentInstrument.title || '';
      imgEl.style.display = 'block';
    }

    // Mettre Ã  jour les dots
    lightbox.querySelectorAll('.instrument-lightbox__dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentMediaIndex);
    });
  }

  function navigateMedia(direction) {
    if (!currentInstrument) return;

    const allMedia = buildMediaList(currentInstrument);
    currentMediaIndex = (currentMediaIndex + direction + allMedia.length) % allMedia.length;
    updateLightboxMedia();
  }

  function handleLightboxKeyboard(e) {
    const lightbox = document.getElementById('instrument-lightbox');
    if (!lightbox || !lightbox.classList.contains('open')) return;

    switch(e.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowLeft':
        navigateMedia(-1);
        break;
      case 'ArrowRight':
        navigateMedia(1);
        break;
    }
  }

  function openContactFromLightbox() {
    // Ouvrir la modale de contact avec sujet prÃ©-rempli
    const instrumentTitle = currentInstrument ? currentInstrument.title : '';
    
    // Chercher la modale contact
    const contactModal = document.getElementById('contact-modal');
    if (contactModal) {
      contactModal.classList.add('active');
      contactModal.style.zIndex = '10001'; // Au-dessus de la lightbox
      
      // PrÃ©-remplir le message
      const messageField = contactModal.querySelector('textarea[name="message"]');
      if (messageField && instrumentTitle) {
        messageField.value = `Je souhaite avoir des informations sur l'instrument "${instrumentTitle}".

`;
        messageField.focus();
        // Placer le curseur Ã  la fin
        messageField.setSelectionRange(messageField.value.length, messageField.value.length);
      }
    } else if (typeof openContactModal === 'function') {
      openContactModal();
    }
  }

  // ============================================================================
  // STYLES LIGHTBOX
  // ============================================================================

  function injectLightboxStyles() {
    if (document.getElementById('instrument-lightbox-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'instrument-lightbox-styles';
    styles.textContent = `
      .instrument-lightbox {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.95);
        display: none;
        flex-direction: column;
      }
      
      .instrument-lightbox.open {
        display: flex;
      }
      
      .instrument-lightbox__close {
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 10;
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
        padding: 0.5rem;
      }
      
      .instrument-lightbox__close:hover {
        opacity: 1;
      }
      
      .instrument-lightbox__media {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        padding: 1rem;
        cursor: pointer;
      }
      
      .instrument-lightbox__content {
        max-width: 90vw;
        max-height: calc(100vh - 180px);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: default;
      }
      
      .instrument-lightbox__image {
        max-width: 100%;
        max-height: calc(100vh - 180px);
        object-fit: contain;
        cursor: default;
      }
      
      .instrument-lightbox__video {
        max-width: 100%;
        max-height: calc(100vh - 180px);
        background: black;
        cursor: default;
      }
      
      .instrument-lightbox__nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.5);
        border: none;
        color: white;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s, background 0.2s;
        padding: 1rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 5;
      }
      
      .instrument-lightbox__nav:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.8);
      }
      
      .instrument-lightbox__nav--prev {
        left: 1rem;
      }
      
      .instrument-lightbox__nav--next {
        right: 1rem;
      }
      
      .instrument-lightbox__dots {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.5rem;
      }
      
      .instrument-lightbox__dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.5);
        background: transparent;
        cursor: pointer;
        padding: 0;
        transition: all 0.2s;
      }
      
      .instrument-lightbox__dot:hover {
        border-color: white;
      }
      
      .instrument-lightbox__dot.active {
        background: white;
        border-color: white;
      }
      
      .instrument-lightbox__info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 2rem;
        background: rgba(0, 0, 0, 0.8);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .instrument-lightbox__text {
        color: white;
      }
      
      .instrument-lightbox__title {
        font-family: var(--font-display, 'Fraunces', Georgia, serif);
        font-size: 1.5rem;
        font-weight: 500;
        margin: 0 0 0.25rem 0;
      }
      
      .instrument-lightbox__subtitle {
        font-size: 0.9375rem;
        opacity: 0.7;
        margin: 0;
      }
      
      .instrument-lightbox__cta {
        white-space: nowrap;
        flex-shrink: 0;
      }
      
      /* Badge vidÃ©o sur la grille */
      .gallery-item {
        position: relative;
        cursor: pointer;
      }
      
      .gallery-item__video-badge {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        width: 28px;
        height: 28px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }
      
      .gallery-item__subtitle {
        display: block;
        font-size: 0.75rem;
        opacity: 0.8;
        margin-top: 0.125rem;
      }
      
      /* Responsive */
      @media (max-width: 768px) {
        .instrument-lightbox__info {
          flex-direction: column;
          gap: 1rem;
          text-align: center;
          padding: 1rem;
        }
        
        .instrument-lightbox__title {
          font-size: 1.25rem;
        }
        
        .instrument-lightbox__nav {
          padding: 0.75rem;
        }
        
        .instrument-lightbox__nav svg {
          width: 24px;
          height: 24px;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  // ============================================================================
  // MODALE D'AJOUT INSTRUMENT
  // ============================================================================

  let coverUpload = null;
  let mediaUploads = [];

  function createAddInstrumentModal() {
    // DÃ©truire l'ancienne modale si elle existe
    const existing = document.getElementById('add-instrument-modal');
    if (existing) {
      Modal.destroy(existing);
    }

    const modal = Modal.create({
      id: 'add-instrument-modal',
      title: 'Ajouter un instrument',
      size: 'large',
      content: `
        <form id="add-instrument-form" class="admin-form">
          <div class="admin-form__row" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <div class="admin-form__group">
              <label class="admin-form__label">Titre *</label>
              <input type="text" class="admin-form__input" name="title" placeholder="D Kurd" required>
            </div>
            <div class="admin-form__group">
              <label class="admin-form__label">Sous-titre</label>
              <input type="text" class="admin-form__input" name="subtitle" placeholder="9 notes â€¢ 432 Hz â€¢ Finition dorÃ©e">
            </div>
          </div>
          
          <div class="admin-form__group">
            <label class="admin-form__label">Description</label>
            <textarea class="admin-form__textarea" name="description" rows="2" placeholder="Description de l'instrument..."></textarea>
          </div>
          
          <div class="admin-form__group">
            <label class="admin-form__label">Gamme associÃ©e</label>
            <select class="admin-form__select" name="gamme">
              <option value="">-- Aucune --</option>
              <option value="kurd">Kurd</option>
              <option value="amara">Amara</option>
              <option value="lowpygmy">Low Pygmy</option>
              <option value="hijaz">Hijaz</option>
              <option value="mystic">Mystic</option>
              <option value="equinox">Equinox</option>
              <option value="celtic">Celtic</option>
              <option value="pygmy">Pygmy</option>
            </select>
          </div>
          
          <hr style="border:none;border-top:1px solid var(--admin-border);margin:1.5rem 0;">
          
          <div class="admin-form__group">
            <label class="admin-form__label">Photo de couverture *</label>
            <div id="cover-upload-wrapper"></div>
          </div>
          
          <div class="admin-form__group">
            <label class="admin-form__label">MÃ©dias additionnels (images ou vidÃ©o)</label>
            <div id="media-uploads-list"></div>
            <button type="button" class="admin-btn admin-btn--secondary admin-btn--sm" id="btn-add-media" style="margin-top:0.75rem;">
              + Ajouter un mÃ©dia
            </button>
          </div>
          
          <div class="admin-form__checkbox" style="margin-top:1rem;">
            <input type="checkbox" id="instr-featured" name="featured">
            <label for="instr-featured">Mettre en avant sur la page d'accueil</label>
          </div>
        </form>
      `,
      footer: `
        <button class="admin-btn admin-btn--secondary" data-action="cancel">Annuler</button>
        <button class="admin-btn admin-btn--primary" data-action="save">Ajouter l'instrument</button>
      `
    });

    // Initialiser l'upload de couverture
    if (typeof MistralUpload !== 'undefined') {
      const coverWrapper = modal.querySelector('#cover-upload-wrapper');
      coverUpload = MistralUpload.createUploadInput({
        id: 'cover-image-upload',
        acceptType: 'image',
        onError: (msg) => Toast.error(msg)
      });
      coverWrapper.appendChild(coverUpload);
    }

    // Bouton ajouter mÃ©dia
    mediaUploads = [];
    modal.querySelector('#btn-add-media').addEventListener('click', () => {
      addMediaUploadField(modal);
    });

    // Annuler
    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      Modal.close(modal);
      resetUploadFields();
    });

    // Sauvegarder
    modal.querySelector('[data-action="save"]').addEventListener('click', async () => {
      await saveInstrument(modal);
    });

    return modal;
  }

  function addMediaUploadField(modal) {
    const list = modal.querySelector('#media-uploads-list');
    const index = mediaUploads.length;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'media-upload-item';
    wrapper.style.cssText = 'margin-bottom:1rem;padding:1rem;background:var(--admin-bg);border-radius:var(--admin-radius-md);position:relative;';
    
    wrapper.innerHTML = `
      <button type="button" class="media-upload-remove" style="position:absolute;top:0.5rem;right:0.5rem;background:none;border:none;color:var(--admin-text-muted);cursor:pointer;font-size:1.25rem;">Ã—</button>
      <div class="media-upload-wrapper"></div>
    `;
    
    // Bouton supprimer
    wrapper.querySelector('.media-upload-remove').addEventListener('click', () => {
      const idx = mediaUploads.findIndex(m => m.wrapper === wrapper);
      if (idx > -1) {
        mediaUploads.splice(idx, 1);
      }
      wrapper.remove();
    });
    
    // CrÃ©er l'upload
    if (typeof MistralUpload !== 'undefined') {
      const uploadInput = MistralUpload.createUploadInput({
        id: `media-upload-${index}`,
        acceptType: 'all',
        onError: (msg) => Toast.error(msg)
      });
      wrapper.querySelector('.media-upload-wrapper').appendChild(uploadInput);
      
      mediaUploads.push({
        wrapper: wrapper,
        input: uploadInput
      });
    }
    
    list.appendChild(wrapper);
  }

  async function saveInstrument(modal) {
    const form = modal.querySelector('#add-instrument-form');
    const formData = new FormData(form);
    
    // Valider
    const title = formData.get('title')?.trim();
    if (!title) {
      Toast.error('Le titre est obligatoire');
      return;
    }
    
    if (!coverUpload || !coverUpload.getFile()) {
      Toast.error('La photo de couverture est obligatoire');
      return;
    }

    try {
      Toast.info('Upload en cours...');
      
      // Upload cover
      const coverResult = await coverUpload.upload();
      
      // Upload mÃ©dias additionnels
      const mediaList = [];
      for (const mediaItem of mediaUploads) {
        if (mediaItem.input.getFile()) {
          const result = await mediaItem.input.upload();
          mediaList.push({
            type: result.type,
            src: result.src,
            thumbnail: result.thumbnail
          });
        }
      }
      
      // CrÃ©er l'instrument
      const instrumentData = {
        title: title,
        subtitle: formData.get('subtitle')?.trim() || '',
        description: formData.get('description')?.trim() || '',
        gamme: formData.get('gamme') || null,
        cover: coverResult.src,
        thumbnail: coverResult.thumbnail,
        media: mediaList,
        featured: formData.get('featured') === 'on',
        isLocal: coverResult.isLocal
      };
      
      Gallery.add(instrumentData);
      
      Toast.success('Instrument ajoutÃ©');
      Modal.close(modal);
      renderGallery();
      resetUploadFields();
      
    } catch (error) {
      Toast.error(error.message || 'Erreur lors de l\'ajout');
      console.error(error);
    }
  }

  function resetUploadFields() {
    if (coverUpload) {
      coverUpload.reset();
      coverUpload = null;
    }
    mediaUploads = [];
  }

  // ============================================================================
  // MODALE DE GESTION
  // ============================================================================

  function openManageModal() {
    const instruments = Gallery.getAll();

    const modal = Modal.create({
      id: 'manage-gallery-modal',
      title: 'GÃ©rer la galerie',
      size: 'large',
      content: instruments.length === 0 ? `
        <div class="admin-empty">
          <div class="admin-empty__title">Galerie vide</div>
          <div class="admin-empty__text">Ajoutez votre premier instrument</div>
        </div>
      ` : `
        <div class="admin-gallery-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:1rem;">
          ${instruments.map(instr => `
            <div class="admin-gallery-item" data-id="${instr.id}" style="position:relative;aspect-ratio:1;background:var(--admin-bg);border:1px solid var(--admin-border);border-radius:var(--admin-radius-md);overflow:hidden;">
              <img src="${instr.cover || instr.thumbnail || instr.src || ''}" alt="" style="width:100%;height:100%;object-fit:cover;">
              ${instr.media && instr.media.some(m => m.type === 'video') ? '<div style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);color:white;font-size:0.625rem;padding:2px 6px;border-radius:4px;">ðŸŽ¬</div>' : ''}
              <div style="position:absolute;bottom:0;left:0;right:0;padding:0.5rem;background:linear-gradient(transparent,rgba(0,0,0,0.8));color:white;font-size:0.75rem;">
                ${utils.escapeHtml(instr.title || 'Sans titre')}
              </div>
              <div style="position:absolute;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;gap:0.5rem;opacity:0;transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
                <button class="admin-btn admin-btn--icon admin-btn--sm admin-btn--secondary" onclick="GalerieAdmin.delete('${instr.id}')" title="Supprimer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `,
      footer: `
        <button class="admin-btn admin-btn--secondary" onclick="MistralAdmin.Modal.close('manage-gallery-modal')">Fermer</button>
        <button class="admin-btn admin-btn--primary" onclick="GalerieAdmin.openAddModal()">
          Ajouter un instrument
        </button>
      `
    });

    Modal.open(modal);
  }

  // ============================================================================
  // ACTIONS PUBLIQUES
  // ============================================================================

  window.GalerieAdmin = {
    openAddModal() {
      Modal.close('manage-gallery-modal');
      const modal = createAddInstrumentModal();
      Modal.open(modal);
    },

    async delete(id) {
      const confirmed = await Confirm.delete('cet instrument');
      if (confirmed) {
        Gallery.delete(id);
        Toast.success('Instrument supprimÃ©');
        renderGallery();
        
        // Mettre Ã  jour la modale si ouverte
        Modal.close('manage-gallery-modal');
        openManageModal();
      }
    }
  };

  window.GaleriePublic = {
    openLightbox
  };

  // ============================================================================
  // FAB
  // ============================================================================

  function initAdminFAB() {
    if (!Auth.isLoggedIn()) return;

    const instruments = Gallery.getAll();

    FAB.create({
      position: 'bottom-right',
      actions: [
        {
          id: 'manage',
          label: 'GÃ©rer la galerie',
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
          badge: instruments.length > 0 ? instruments.length : null,
          handler: openManageModal
        },
        {
          id: 'add',
          label: 'Ajouter un instrument',
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
          handler: () => GalerieAdmin.openAddModal()
        },
        {
          id: 'admin-panel',
          label: 'Panneau admin',
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
          handler: () => {
            window.location.href = 'admin.html#galerie';
          }
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
      ]
    });
  }

  // ============================================================================
  // INIT
  // ============================================================================

  function init() {
    renderGallery();
    initAdminFAB();

    window.addEventListener('adminLogout', () => {
      FAB.destroy();
    });

    window.addEventListener('storage', (e) => {
      if (e.key && e.key.includes('mistral_gallery')) {
        renderGallery();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
