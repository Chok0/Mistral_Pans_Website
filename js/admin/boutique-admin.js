/* ==========================================================================
   MISTRAL PANS - Boutique Admin Integration
   Version 2.0 - Synchronisé avec admin.html
   
   Utilise les mêmes sources de données que l'admin:
   - Instruments: mistral_gestion_instruments (statut: 'en_ligne')
   - Accessoires: mistral_accessoires (statut: 'actif')
   ========================================================================== */

(function() {
  'use strict';

  console.log('[Boutique Admin v2] Initialisation...');

  // Attendre que admin-core soit chargé (optionnel pour page publique)
  const hasAdminCore = typeof MistralAdmin !== 'undefined';
  
  // Utilitaires
  const utils = hasAdminCore ? MistralAdmin.utils : {
    escapeHtml: (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  };
  
  // Toast (fallback si pas d'admin)
  const Toast = hasAdminCore ? MistralAdmin.Toast : {
    success: (msg) => console.log('[Toast]', msg),
    error: (msg) => console.error('[Toast]', msg),
    info: (msg) => console.info('[Toast]', msg)
  };
  
  // Confirm (fallback)
  const Confirm = hasAdminCore ? MistralAdmin.Confirm : {
    show: async (opts) => window.confirm(opts.message)
  };

  // ============================================================================
  // CLÉS DE STOCKAGE (synchronisées avec admin)
  // ============================================================================
  
  const INSTRUMENTS_KEY = 'mistral_gestion_instruments';
  const ACCESSOIRES_KEY = 'mistral_accessoires';

  // ============================================================================
  // FONCTIONS DE LECTURE DES DONNÉES
  // ============================================================================

  function getInstrumentsEnLigne() {
    try {
      const stored = localStorage.getItem(INSTRUMENTS_KEY);
      if (stored) {
        const instruments = JSON.parse(stored);
        return instruments.filter(i => i.statut === 'en_ligne');
      }
    } catch (e) {
      console.error('[Boutique Admin] Erreur lecture instruments:', e);
    }
    return [];
  }

  function getAccessoiresActifs() {
    try {
      const stored = localStorage.getItem(ACCESSOIRES_KEY);
      if (stored) {
        const accessoires = JSON.parse(stored);
        return accessoires.filter(a => a.statut === 'actif');
      }
    } catch (e) {
      console.error('[Boutique Admin] Erreur lecture accessoires:', e);
    }
    return [];
  }

  function updateInstrumentStatut(id, statut) {
    try {
      const stored = localStorage.getItem(INSTRUMENTS_KEY);
      if (stored) {
        const instruments = JSON.parse(stored);
        const index = instruments.findIndex(i => i.id === id);
        if (index !== -1) {
          instruments[index].statut = statut;
          instruments[index].updated_at = new Date().toISOString();
          localStorage.setItem(INSTRUMENTS_KEY, JSON.stringify(instruments));
          return true;
        }
      }
    } catch (e) {
      console.error('[Boutique Admin] Erreur mise à jour instrument:', e);
    }
    return false;
  }

  function updateAccessoireStatut(id, statut) {
    try {
      const stored = localStorage.getItem(ACCESSOIRES_KEY);
      if (stored) {
        const accessoires = JSON.parse(stored);
        const index = accessoires.findIndex(a => a.id === id);
        if (index !== -1) {
          accessoires[index].statut = statut;
          accessoires[index].updated_at = new Date().toISOString();
          localStorage.setItem(ACCESSOIRES_KEY, JSON.stringify(accessoires));
          return true;
        }
      }
    } catch (e) {
      console.error('[Boutique Admin] Erreur mise à jour accessoire:', e);
    }
    return false;
  }

  // ============================================================================
  // FONCTIONS UTILITAIRES
  // ============================================================================

  function hasValue(val) {
    return val !== null && val !== undefined && val !== '' && val !== 'null' && String(val).trim() !== '';
  }

  function formatPrice(price) {
    if (!price && price !== 0) return 'Prix sur demande';
    return Number(price).toLocaleString('fr-FR') + ' €';
  }

  // ============================================================================
  // RENDU DES FLASH CARDS
  // ============================================================================

  function renderFlashCards() {
    const container = document.getElementById('flash-cards-container');
    if (!container) {
      console.warn('[Boutique Admin] Container flash-cards-container non trouvé');
      return;
    }

    const instruments = getInstrumentsEnLigne();
    const accessoires = getAccessoiresActifs();
    const totalCount = instruments.length + accessoires.length;

    updateStockCounters(totalCount);

    let html = '';
    
    // Section Instruments
    if (instruments.length > 0) {
      html += '<div class="flash-section-title" style="grid-column: 1 / -1; font-family: var(--font-display); font-size: 1.25rem; margin-bottom: 0.5rem; padding-top: 1rem;">Instruments</div>';
      html += instruments.map(renderInstrumentCard).join('');
    }
    
    // Section Accessoires
    if (accessoires.length > 0) {
      html += '<div class="flash-section-title" style="grid-column: 1 / -1; font-family: var(--font-display); font-size: 1.25rem; margin: 1.5rem 0 0.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border, #e0e0e0);">Accessoires</div>';
      html += accessoires.map(renderAccessoireCard).join('');
    }
    
    if (totalCount === 0) {
      html = '<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--color-text-muted);"><p style="font-family: var(--font-display); font-size: 1.25rem; margin-bottom: 0.5rem;">Aucun article disponible</p><p style="font-size: 0.9375rem;">Revenez bientôt pour découvrir nos prochaines créations</p></div>';
    }

    container.innerHTML = html;
  }

  function renderInstrumentCard(instrument) {
    const hasImage = instrument.images && instrument.images.length > 0;
    const imageContent = hasImage
      ? '<img src="' + instrument.images[0] + '" alt="' + utils.escapeHtml(instrument.nom || '') + '" style="width:100%;height:100%;object-fit:cover;">'
      : '<span style="font-size: 4rem; opacity: 0.2;">🎵</span>';

    const videoIndicator = hasValue(instrument.video)
      ? '<span class="flash-card__video-badge" style="position:absolute;bottom:0.5rem;left:0.5rem;background:rgba(0,0,0,0.7);color:white;padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;">▶ Vidéo</span>'
      : '';

    const photoCount = (instrument.images && instrument.images.length > 1)
      ? '<span class="flash-card__photo-count" style="position:absolute;top:0.5rem;right:0.5rem;background:rgba(0,0,0,0.7);color:white;padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;">' + instrument.images.length + ' photos</span>'
      : '';

    const specs = [];
    if (hasValue(instrument.nombre_notes)) specs.push(instrument.nombre_notes + ' notes');
    if (hasValue(instrument.taille)) specs.push(instrument.taille + 'cm');
    if (hasValue(instrument.accordage)) specs.push(instrument.accordage + 'Hz');
    if (hasValue(instrument.materiau)) {
      // Use centralized material labels from MistralMateriaux module
      const label = typeof MistralMateriaux !== 'undefined'
        ? MistralMateriaux.getLabel(instrument.materiau, 'short')
        : instrument.materiau;
      specs.push(label);
    }
    const specsHtml = specs.length > 0 ? '<p class="flash-card__specs">' + specs.join(' · ') + '</p>' : '';

    const notesHtml = hasValue(instrument.notes_layout)
      ? '<p class="flash-card__notes">' + instrument.notes_layout.split(' ').filter(function(n) { return n.trim(); }).join(' · ') + '</p>'
      : '';

    const descHtml = hasValue(instrument.description)
      ? '<p class="flash-card__desc" style="font-size:0.875rem;color:var(--color-text-muted);margin:0.5rem 0;line-height:1.4;">' + utils.escapeHtml(instrument.description.substring(0, 100)) + (instrument.description.length > 100 ? '...' : '') + '</p>'
      : '';

    const priceHtml = hasValue(instrument.prix_vente)
      ? '<span class="flash-card__price">' + formatPrice(instrument.prix_vente) + '</span>'
      : '<span class="flash-card__price" style="font-size:0.875rem;">Prix sur demande</span>';

    const displayName = instrument.nom || ((instrument.tonalite || '') + ' ' + (instrument.gamme || '')).trim() || instrument.reference || 'Instrument';

    return '<div class="flash-card" data-type="instrument" data-id="' + instrument.id + '" onclick="BoutiqueAdmin.openInstrumentModal(\'' + instrument.id + '\')" style="position:relative;">' +
      '<div class="flash-card__image" style="position:relative;">' + imageContent + videoIndicator + photoCount + '</div>' +
      '<div class="flash-card__content">' +
        '<h3 class="flash-card__name">' + utils.escapeHtml(displayName) + '</h3>' +
        specsHtml + notesHtml + descHtml +
        '<div class="flash-card__footer">' + priceHtml +
          '<span class="flash-card__cta-hint" style="font-size:0.75rem;color:var(--color-text-muted);">Cliquez pour voir</span>' +
        '</div>' +
      '</div></div>';
  }

  function renderAccessoireCard(accessoire) {
    const hasImage = hasValue(accessoire.image);
    const imageContent = hasImage 
      ? '<img src="' + accessoire.image + '" alt="' + utils.escapeHtml(accessoire.nom || '') + '" style="width:100%;height:100%;object-fit:cover;">'
      : '<span style="font-size: 3rem; opacity: 0.3;">🎒</span>';
    
    const categorieLabels = { 'housse': 'Housse', 'huile': 'Huile d\'entretien', 'support': 'Support', 'accessoire': 'Accessoire' };
    const categorie = categorieLabels[accessoire.categorie] || accessoire.categorie || 'Accessoire';
    
    const stockHtml = accessoire.stock >= 0 
      ? '<span style="font-size:0.75rem;color:var(--color-text-muted);">Stock: ' + accessoire.stock + '</span>'
      : '';
    
    const descHtml = hasValue(accessoire.description)
      ? '<p class="flash-card__desc" style="font-size:0.875rem;color:var(--color-text-muted);margin:0.5rem 0;line-height:1.4;">' + utils.escapeHtml(accessoire.description.substring(0, 80)) + (accessoire.description.length > 80 ? '...' : '') + '</p>'
      : '';
    
    return '<div class="flash-card flash-card--accessoire" data-type="accessoire" data-id="' + accessoire.id + '">' +
      '<div class="flash-card__image flash-card__image--small" style="position:relative; height: 150px;">' + imageContent + '</div>' +
      '<div class="flash-card__content">' +
        '<span class="flash-card__category" style="font-size:0.75rem;color:var(--color-accent);text-transform:uppercase;letter-spacing:0.05em;">' + categorie + '</span>' +
        '<h3 class="flash-card__name" style="font-size:1rem;margin:0.25rem 0;">' + utils.escapeHtml(accessoire.nom) + '</h3>' +
        descHtml +
        '<div class="flash-card__footer" style="margin-top:auto;">' +
          '<span class="flash-card__price">' + formatPrice(accessoire.prix) + '</span>' +
          stockHtml +
          '<button class="flash-card__cta" onclick="BoutiqueAdmin.contacterPourAccessoire(\'' + accessoire.id + '\')">Commander</button>' +
        '</div>' +
      '</div></div>';
  }

  function updateStockCounters(count) {
    var badge = document.querySelector('.flash-badge');
    if (badge) {
      badge.innerHTML = '<span class="flash-dot" style="width:6px;height:6px;animation:none;"></span> ' + count + ' en stock';
    }
    
    var tabCount = document.getElementById('stock-count-tab');
    if (tabCount) tabCount.textContent = count;
    
    var sectionCount = document.getElementById('stock-count-section');
    if (sectionCount) sectionCount.textContent = count;
    
    window.dispatchEvent(new CustomEvent('stockUpdated', { detail: { count: count } }));
  }

  // ============================================================================
  // ACTIONS ADMIN
  // ============================================================================

  async function retirerInstrument(id) {
    if (!hasAdminCore) return;
    
    var confirmed = await Confirm.show({
      title: 'Retirer de la boutique',
      message: 'Cet instrument ne sera plus visible dans la boutique.',
      confirmText: 'Retirer',
      type: 'warning'
    });
    
    if (confirmed) {
      if (updateInstrumentStatut(id, 'disponible')) {
        renderFlashCards();
        Toast.success('Instrument retiré de la boutique');
      }
    }
  }

  async function retirerAccessoire(id) {
    if (!hasAdminCore) return;
    
    var confirmed = await Confirm.show({
      title: 'Masquer l\'accessoire',
      message: 'Cet accessoire ne sera plus visible dans la boutique.',
      confirmText: 'Masquer',
      type: 'warning'
    });
    
    if (confirmed) {
      if (updateAccessoireStatut(id, 'masque')) {
        renderFlashCards();
        Toast.success('Accessoire masqué');
      }
    }
  }

  // ============================================================================
  // CONTACT PUBLIC
  // ============================================================================

  function contacterPourInstrument(id) {
    var instruments = getInstrumentsEnLigne();
    var instrument = instruments.find(function(i) { return i.id === id; });
    
    if (!instrument) return;
    
    var nom = instrument.nom || ((instrument.tonalite || '') + ' ' + (instrument.gamme || '')).trim();
    var prix = instrument.prix_vente ? formatPrice(instrument.prix_vente) : 'Prix sur demande';
    
    var subject = encodeURIComponent('Demande d\'information - ' + nom);
    var body = encodeURIComponent('Bonjour,\n\nJe suis intéressé(e) par l\'instrument "' + nom + '" (' + prix + ').\n\nPouvez-vous me donner plus d\'informations ?\n\nCordialement');
    
    var contactModal = document.querySelector('[data-modal="contact"]');
    if (contactModal) {
      contactModal.click();
      setTimeout(function() {
        var subjectInput = document.getElementById('contact-subject');
        if (subjectInput) subjectInput.value = 'Demande d\'information - ' + nom;
        var messageInput = document.getElementById('contact-message');
        if (messageInput) messageInput.value = 'Je suis intéressé(e) par l\'instrument "' + nom + '" (' + prix + ').\n\nPouvez-vous me donner plus d\'informations ?';
      }, 300);
    } else {
      window.location.href = 'mailto:contact@mistralpans.fr?subject=' + subject + '&body=' + body;
    }
  }

  function contacterPourAccessoire(id) {
    var accessoires = getAccessoiresActifs();
    var accessoire = accessoires.find(function(a) { return a.id === id; });
    
    if (!accessoire) return;
    
    var prix = accessoire.prix ? formatPrice(accessoire.prix) : 'Prix sur demande';
    var subject = encodeURIComponent('Commande - ' + accessoire.nom);
    var body = encodeURIComponent('Bonjour,\n\nJe souhaite commander "' + accessoire.nom + '" (' + prix + ').\n\nCordialement');
    
    var contactModal = document.querySelector('[data-modal="contact"]');
    if (contactModal) {
      contactModal.click();
      setTimeout(function() {
        var subjectInput = document.getElementById('contact-subject');
        if (subjectInput) subjectInput.value = 'Commande - ' + accessoire.nom;
        var messageInput = document.getElementById('contact-message');
        if (messageInput) messageInput.value = 'Je souhaite commander "' + accessoire.nom + '" (' + prix + ').';
      }, 300);
    } else {
      window.location.href = 'mailto:contact@mistralpans.fr?subject=' + subject + '&body=' + body;
    }
  }

  // ============================================================================
  // MODALE DÉTAIL INSTRUMENT
  // ============================================================================

  let currentInstrument = null;
  let currentGalleryIndex = 0;

  function openInstrumentModal(id) {
    const instruments = getInstrumentsEnLigne();
    const instrument = instruments.find(function(i) { return i.id === id; });

    if (!instrument) {
      console.warn('[Boutique Admin] Instrument non trouvé:', id);
      return;
    }

    currentInstrument = instrument;
    currentGalleryIndex = 0;

    const modal = document.getElementById('annonce-modal');
    if (!modal) return;

    // Title
    const displayName = instrument.nom || ((instrument.tonalite || '') + ' ' + (instrument.gamme || '')).trim() || 'Instrument';
    document.getElementById('modal-annonce-title').textContent = displayName;

    // Gallery
    setupModalGallery(instrument.images || []);

    // Specs
    document.getElementById('modal-spec-gamme').textContent = instrument.gamme || '—';
    document.getElementById('modal-spec-notes').textContent = instrument.nombre_notes ? instrument.nombre_notes + ' notes' : '—';
    document.getElementById('modal-spec-tonalite').textContent = instrument.tonalite || '—';
    document.getElementById('modal-spec-accordage').textContent = instrument.accordage ? instrument.accordage + ' Hz' : '—';
    document.getElementById('modal-spec-taille').textContent = instrument.taille ? instrument.taille + ' cm' : '—';

    // Material
    const matLabel = hasValue(instrument.materiau) && typeof MistralMateriaux !== 'undefined'
      ? MistralMateriaux.getLabel(instrument.materiau, 'full')
      : (instrument.materiau || '—');
    document.getElementById('modal-spec-materiau').textContent = matLabel;

    // Notes layout
    const notesLayout = document.getElementById('modal-notes-layout');
    const notesValue = document.getElementById('modal-notes-value');
    if (hasValue(instrument.notes_layout)) {
      notesLayout.style.display = 'block';
      notesValue.textContent = instrument.notes_layout;
    } else {
      notesLayout.style.display = 'none';
    }

    // Description
    const descContainer = document.getElementById('modal-description-container');
    const descEl = document.getElementById('modal-description');
    if (hasValue(instrument.description)) {
      descContainer.style.display = 'block';
      descEl.textContent = instrument.description;
    } else {
      descContainer.style.display = 'none';
    }

    // Video link
    const videoLink = document.getElementById('modal-video-link');
    if (hasValue(instrument.video)) {
      videoLink.style.display = 'inline-flex';
      videoLink.href = instrument.video;
    } else {
      videoLink.style.display = 'none';
    }

    // Handpaner link
    const handpanerLink = document.getElementById('modal-handpaner-link');
    if (hasValue(instrument.handpaner_url)) {
      handpanerLink.style.display = 'inline-flex';
      handpanerLink.href = instrument.handpaner_url;
    } else {
      handpanerLink.style.display = 'none';
    }

    // Housse options
    setupModalHousse(instrument.taille);

    // Reset livraison
    const livraisonCheckbox = document.getElementById('modal-livraison-checkbox');
    if (livraisonCheckbox) livraisonCheckbox.checked = false;

    // Price
    updateModalPrice();

    // Show modal
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeAnnonceModal() {
    const modal = document.getElementById('annonce-modal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
    currentInstrument = null;
  }

  function setupModalGallery(images) {
    const mainImage = document.getElementById('modal-main-image');
    const noImageEl = document.getElementById('modal-no-image');
    const thumbsContainer = document.getElementById('modal-gallery-thumbs');
    const prevBtn = document.getElementById('modal-gallery-prev');
    const nextBtn = document.getElementById('modal-gallery-next');

    if (!images || images.length === 0) {
      mainImage.style.display = 'none';
      noImageEl.style.display = 'flex';
      thumbsContainer.innerHTML = '';
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
      return;
    }

    mainImage.style.display = 'block';
    noImageEl.style.display = 'none';
    mainImage.src = images[0];

    // Navigation buttons
    if (images.length > 1) {
      prevBtn.style.display = 'flex';
      nextBtn.style.display = 'flex';
    } else {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }

    // Thumbnails
    let thumbsHtml = '';
    images.forEach(function(img, idx) {
      const activeClass = idx === 0 ? ' active' : '';
      thumbsHtml += '<div class="annonce-gallery__thumb' + activeClass + '" data-index="' + idx + '"><img src="' + img + '" alt="Photo ' + (idx + 1) + '"></div>';
    });
    thumbsContainer.innerHTML = thumbsHtml;

    // Use event delegation for thumbnail clicks (avoids memory leak from per-element listeners)
    if (!thumbsContainer._delegated) {
      thumbsContainer.addEventListener('click', function(e) {
        const thumb = e.target.closest('.annonce-gallery__thumb');
        if (thumb) {
          const idx = parseInt(thumb.dataset.index);
          setGalleryIndex(idx);
        }
      });
      thumbsContainer._delegated = true;
    }

    updateGalleryNav(images);
  }

  function setGalleryIndex(idx, images) {
    if (!images) {
      images = currentInstrument && currentInstrument.images ? currentInstrument.images : [];
    }

    if (idx < 0) idx = images.length - 1;
    if (idx >= images.length) idx = 0;

    currentGalleryIndex = idx;

    const mainImage = document.getElementById('modal-main-image');
    if (mainImage) mainImage.src = images[idx];

    // Update active thumbnail
    document.querySelectorAll('.annonce-gallery__thumb').forEach(function(thumb, i) {
      thumb.classList.toggle('active', i === idx);
    });

    updateGalleryNav(images);
  }

  function updateGalleryNav(images) {
    const prevBtn = document.getElementById('modal-gallery-prev');
    const nextBtn = document.getElementById('modal-gallery-next');

    if (prevBtn) prevBtn.disabled = currentGalleryIndex === 0;
    if (nextBtn) nextBtn.disabled = currentGalleryIndex === images.length - 1;
  }

  function navigateGallery(direction) {
    const images = currentInstrument && currentInstrument.images ? currentInstrument.images : [];
    if (images.length === 0) return;

    const newIndex = currentGalleryIndex + direction;
    setGalleryIndex(newIndex, images);
  }

  function setupModalHousse(taille) {
    const housseContainer = document.getElementById('modal-housse-container');
    const housseSelect = document.getElementById('modal-housse-select');

    if (!housseContainer || !housseSelect) return;

    // Get compatible accessories
    const accessoires = getHoussesForTaille(taille);

    if (accessoires.length === 0) {
      housseContainer.style.display = 'none';
      return;
    }

    housseContainer.style.display = 'block';

    let optionsHtml = '<option value="">Sans housse</option>';
    accessoires.forEach(function(acc) {
      optionsHtml += '<option value="' + acc.id + '" data-prix="' + acc.prix + '">' +
        utils.escapeHtml(acc.nom) + ' (+' + formatPrice(acc.prix) + ')' +
        '</option>';
    });

    housseSelect.innerHTML = optionsHtml;
    housseSelect.value = '';
  }

  function getHoussesForTaille(taille) {
    try {
      const stored = localStorage.getItem(ACCESSOIRES_KEY);
      if (stored) {
        const accessoires = JSON.parse(stored);
        return accessoires.filter(function(a) {
          return a.statut === 'actif' &&
                 a.visible_configurateur === true &&
                 a.tailles_compatibles &&
                 a.tailles_compatibles.includes(taille);
        });
      }
    } catch (e) {
      console.warn('[Boutique Admin] Erreur lecture housses:', e);
    }
    return [];
  }

  function updateModalPrice() {
    if (!currentInstrument) return;

    const instrumentPrice = currentInstrument.prix_vente || 0;
    const livraisonCheckbox = document.getElementById('modal-livraison-checkbox');
    const housseSelect = document.getElementById('modal-housse-select');

    let houssePrice = 0;
    let housseName = null;
    if (housseSelect && housseSelect.value) {
      const selectedOption = housseSelect.options[housseSelect.selectedIndex];
      houssePrice = parseFloat(selectedOption.dataset.prix) || 0;
      housseName = selectedOption.textContent.split(' (+')[0];
    }

    const livraisonPrice = (livraisonCheckbox && livraisonCheckbox.checked) ? 50 : 0;
    const totalPrice = instrumentPrice + houssePrice + livraisonPrice;

    // Update display
    document.getElementById('modal-price-instrument').textContent = formatPrice(instrumentPrice);

    const housseLine = document.getElementById('modal-price-housse-line');
    const housseEl = document.getElementById('modal-price-housse');
    if (houssePrice > 0) {
      housseLine.style.display = 'flex';
      housseEl.textContent = formatPrice(houssePrice);
    } else {
      housseLine.style.display = 'none';
    }

    const livraisonLine = document.getElementById('modal-price-livraison-line');
    if (livraisonPrice > 0) {
      livraisonLine.style.display = 'flex';
    } else {
      livraisonLine.style.display = 'none';
    }

    document.getElementById('modal-price-total').textContent = formatPrice(totalPrice);

    // Update order button URL
    updateModalOrderUrl(totalPrice, housseSelect ? housseSelect.value : null, housseName, houssePrice, livraisonCheckbox ? livraisonCheckbox.checked : false);
  }

  function updateModalOrderUrl(totalPrice, housseId, housseName, houssePrice, livraison) {
    if (!currentInstrument) return;

    const orderBtn = document.getElementById('modal-order-btn');
    if (!orderBtn) return;

    const params = new URLSearchParams({
      type: 'stock',
      instrument_id: currentInstrument.id,
      name: currentInstrument.nom || ((currentInstrument.tonalite || '') + ' ' + (currentInstrument.gamme || '')).trim(),
      gamme: currentInstrument.gamme || '',
      tonalite: currentInstrument.tonalite || '',
      notes: currentInstrument.nombre_notes || '',
      accordage: currentInstrument.accordage || '',
      taille: currentInstrument.taille || '',
      materiau: currentInstrument.materiau || '',
      price: totalPrice,
      instrument_price: currentInstrument.prix_vente || 0
    });

    if (housseId) {
      params.set('housse_id', housseId);
      if (housseName) params.set('housse_nom', housseName);
      params.set('housse_prix', houssePrice);
    }

    if (livraison) {
      params.set('livraison', '1');
    }

    orderBtn.href = 'commander.html?' + params.toString();
  }

  function initAnnonceModalListeners() {
    // Close button
    const closeBtn = document.getElementById('modal-annonce-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeAnnonceModal);
    }

    // Overlay click
    const overlay = document.querySelector('.annonce-modal__overlay');
    if (overlay) {
      overlay.addEventListener('click', closeAnnonceModal);
    }

    // Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeAnnonceModal();
      }
    });

    // Gallery navigation
    const prevBtn = document.getElementById('modal-gallery-prev');
    const nextBtn = document.getElementById('modal-gallery-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigateGallery(-1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigateGallery(1);
      });
    }

    // Housse change
    const housseSelect = document.getElementById('modal-housse-select');
    if (housseSelect) {
      housseSelect.addEventListener('change', updateModalPrice);
    }

    // Livraison change
    const livraisonCheckbox = document.getElementById('modal-livraison-checkbox');
    if (livraisonCheckbox) {
      livraisonCheckbox.addEventListener('change', updateModalPrice);
    }

    // Keyboard navigation for gallery
    document.addEventListener('keydown', function(e) {
      const modal = document.getElementById('annonce-modal');
      if (!modal || !modal.classList.contains('open')) return;

      if (e.key === 'ArrowLeft') {
        navigateGallery(-1);
      } else if (e.key === 'ArrowRight') {
        navigateGallery(1);
      }
    });
  }

  // ============================================================================
  // FAB ADMIN
  // ============================================================================

  function setupAdminFAB() {
    if (!hasAdminCore || !MistralAdmin.Auth.isLoggedIn()) return;
    
    const instruments = getInstrumentsEnLigne();
    const accessoires = getAccessoiresActifs();
    const totalCount = instruments.length + accessoires.length;
    
    MistralAdmin.FAB.create({
      position: 'bottom-right',
      actions: [
        {
          id: 'manage',
          label: 'Gérer la boutique',
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
          badge: totalCount > 0 ? totalCount + ' en ligne' : null,
          handler: function() { window.location.href = 'admin.html#boutique'; }
        },
        {
          id: 'logout',
          label: 'Déconnexion',
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
          handler: function() {
            MistralAdmin.Auth.logout();
            MistralAdmin.FAB.destroy();
            Toast.info('Déconnecté');
          }
        }
      ],
      advancedLink: 'admin.html#boutique'
    });
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  function init() {
    console.log('[Boutique Admin v2] Rendu initial...');
    renderFlashCards();
    setupAdminFAB();
    initAnnonceModalListeners();

    window.addEventListener('storage', function(e) {
      if (e.key === INSTRUMENTS_KEY || e.key === ACCESSOIRES_KEY) {
        console.log('[Boutique Admin v2] Données modifiées, rafraîchissement...');
        renderFlashCards();
      }
    });

    console.log('[Boutique Admin v2] Prêt');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============================================================================
  // EXPORTS
  // ============================================================================

  window.BoutiqueAdmin = {
    getInstrumentsEnLigne: getInstrumentsEnLigne,
    getAccessoiresActifs: getAccessoiresActifs,
    renderFlashCards: renderFlashCards,
    retirerInstrument: retirerInstrument,
    retirerAccessoire: retirerAccessoire,
    contacterPourInstrument: contacterPourInstrument,
    contacterPourAccessoire: contacterPourAccessoire,
    openInstrumentModal: openInstrumentModal,
    closeAnnonceModal: closeAnnonceModal,
    init: init
  };

})();
