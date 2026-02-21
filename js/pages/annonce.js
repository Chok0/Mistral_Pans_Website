(function() {
  'use strict';

  // ── Config ──
  const INSTRUMENTS_KEY = 'mistral_gestion_instruments';
  const ACCESSOIRES_KEY = 'mistral_accessoires';

  let currentInstrument = null;
  let currentAccessoire = null;
  let currentItemType = null; // 'instrument' ou 'accessoire'
  let currentGalleryIndex = 0;

  // ── Notation ──

  function getNotation() {
    return (typeof MistralScales !== 'undefined' && MistralScales.getNotationMode)
      ? MistralScales.getNotationMode() : 'american';
  }

  // ── Utilitaires ──

  const escapeHtml = MistralUtils.escapeHtml;
  const hasValue   = MistralUtils.hasValue;

  function formatPrice(price) {
    if (!price && price !== 0) return 'Prix sur demande';
    return MistralUtils.formatPrice(price);
  }

  function getIdFromURL() {
    // 1. Query params (?ref=xxx) — production Netlify
    const params = new URLSearchParams(window.location.search);
    const id = params.get('ref');
    if (id) return id;
    // 2. Hash params (#ref=xxx) — compatible clean URL servers
    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    return hashParams.get('ref') || null;
  }

  function getTypeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type) return type;
    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    return hashParams.get('type') || null;
  }

  // ── Chargement de l'article (instrument OU accessoire) ──

  let syncComplete = false;

  function loadInstrument() {
    const container = document.getElementById('main-content');
    const id = getIdFromURL();
    const urlType = getTypeFromURL();

    if (!id) {
      showNotFound(container);
      return;
    }

    // Chercher dans les instruments
    let instruments = [];
    if (window.MistralSync && MistralSync.hasKey(INSTRUMENTS_KEY)) {
      instruments = MistralSync.getData(INSTRUMENTS_KEY);
    }

    const instrument = (urlType !== 'accessoire') ? instruments.find(function(i) { return i.id === id; }) : null;

    // Chercher dans les accessoires si pas trouvé dans les instruments
    let accessoires = [];
    if (window.MistralSync && MistralSync.hasKey(ACCESSOIRES_KEY)) {
      accessoires = MistralSync.getData(ACCESSOIRES_KEY);
    }

    const accessoire = !instrument ? accessoires.find(function(a) { return a.id === id; }) : null;

    if (!instrument && !accessoire) {
      if (!syncComplete) return;
      showNotFound(container);
      return;
    }

    // Vérifier si l'utilisateur est admin :
    // 1. Via MistralAuth (si supabase-auth.js est chargé — admin.html uniquement)
    // 2. Via MistralAdmin.Auth (si admin-core.js est chargé)
    // 3. Fallback : si le Supabase client a retourné cet instrument avec un statut
    //    non-public, c'est que l'utilisateur a un JWT valide (session admin active)
    let isAdmin = false;
    if (window.MistralAuth && MistralAuth.isLoggedInSync()) {
      isAdmin = true;
    } else if (window.MistralAdmin && MistralAdmin.Auth && MistralAdmin.Auth.isLoggedIn()) {
      isAdmin = true;
    } else if (window.MistralDB) {
      // Si le client Supabase a retourné des instruments non-publics,
      // c'est que l'utilisateur a une session authentifiée (bypass RLS)
      const hasNonPublic = instruments.some(function(i) {
        return i.statut && i.statut !== 'en_ligne';
      });
      if (hasNonPublic) isAdmin = true;
    }

    if (instrument) {
      if (instrument.statut !== 'en_ligne' && !isAdmin) {
        showNotFound(container);
        return;
      }
      currentInstrument = instrument;
      currentItemType = 'instrument';
      currentGalleryIndex = 0;
      updateMeta(instrument);
      renderInstrument(container, instrument);
      // Bind CTA buttons (CSP-safe, pas de onclick inline)
      var cartBtn = document.getElementById('annonce-cart-btn');
      if (cartBtn) cartBtn.addEventListener('click', function() { window.addInstrumentToCart(); });
      var orderBtn = document.getElementById('annonce-order-btn');
      if (orderBtn) orderBtn.addEventListener('click', function() { window.orderInstrumentDirectly(); });
      bindNotationToggle();
      const hasPlayerSlide = initVirtualPlayer(instrument);
      initGallery(instrument.images || [], hasPlayerSlide);
      initHousse(instrument.taille);
      initKeyboard();
      updatePrice();
    } else if (accessoire) {
      if (accessoire.statut !== 'en_ligne' && accessoire.statut !== 'actif' && !isAdmin) {
        showNotFound(container);
        return;
      }
      currentAccessoire = accessoire;
      currentItemType = 'accessoire';
      currentGalleryIndex = 0;
      updateMetaAccessoire(accessoire);
      renderAccessoire(container, accessoire);
      // Bind CTA button (CSP-safe, pas de onclick inline)
      var accCartBtn = document.getElementById('annonce-add-cart-btn');
      if (accCartBtn) accCartBtn.addEventListener('click', function() { window.addAccessoireToCart(); });
      initGalleryAccessoire(accessoire);
      initKeyboard();
    }
  }

  // ── Meta tags SEO ──

  function updateMeta(instrument) {
    let displayName = instrument.nom || ((instrument.tonalite || '') + ' ' + (instrument.gamme || '')).trim() || 'Instrument';
    const specs = [];
    if (hasValue(instrument.nombre_notes)) specs.push(instrument.nombre_notes + ' notes');
    if (hasValue(instrument.taille)) specs.push(instrument.taille + 'cm');
    if (hasValue(instrument.gamme)) specs.push(instrument.gamme);
    const specsStr = specs.length > 0 ? ' - ' + specs.join(', ') : '';

    const title = displayName + specsStr + ' | Mistral Pans';
    const description = 'Handpan ' + displayName + specsStr + '. Instrument artisanal fabriqué à la main en Île-de-France par Mistral Pans.';

    document.title = title;

    const setMeta = function(selector, attr, value) {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', 'content', description);
    setMeta('link[rel="canonical"]', 'href', 'https://mistralpans.fr/annonce.html?ref=' + instrument.id);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', 'https://mistralpans.fr/annonce.html?ref=' + instrument.id);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);

    // Image
    if (instrument.images && instrument.images.length > 0) {
      setMeta('meta[property="og:image"]', 'content', instrument.images[0]);
      setMeta('meta[name="twitter:image"]', 'content', instrument.images[0]);
    }
  }

  // ── Structured Data JSON-LD ──

  function buildJsonLd(instrument) {
    let displayName = instrument.nom || ((instrument.tonalite || '') + ' ' + (instrument.gamme || '')).trim() || 'Handpan Mistral Pans';
    const desc = instrument.description || ('Handpan ' + displayName + ' fabriqué artisanalement par Mistral Pans en Île-de-France.');

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': displayName,
      'description': desc,
      'brand': { '@type': 'Brand', 'name': 'Mistral Pans' },
      'category': 'Instruments de musique',
      'url': 'https://mistralpans.fr/annonce.html?ref=' + instrument.id
    };

    if (instrument.images && instrument.images.length > 0) {
      ld.image = instrument.images;
    }

    if (hasValue(instrument.prix_vente)) {
      const ldPrice = instrument.promo_percent > 0
        ? Math.floor(instrument.prix_vente * (1 - instrument.promo_percent / 100) / 5) * 5
        : instrument.prix_vente;
      ld.offers = {
        '@type': 'Offer',
        'price': ldPrice,
        'priceCurrency': 'EUR',
        'availability': 'https://schema.org/InStock',
        'seller': { '@type': 'Organization', 'name': 'Mistral Pans' }
      };
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(ld);
    return script;
  }

  // ── Rendu principal ──

  function convertNotes(str) {
    if (!str) return str;
    return (typeof MistralScales !== 'undefined' && MistralScales.convertNotesInString)
      ? MistralScales.convertNotesInString(str) : str;
  }

  function renderInstrument(container, instrument) {
    let displayName;
    if (instrument.nom) {
      displayName = instrument.nom;
    } else {
      const tonaliteDisplay = instrument.tonalite ? convertNotes(instrument.tonalite) : '';
      const gammeDisplay = instrument.gamme || '';
      displayName = (tonaliteDisplay + ' ' + gammeDisplay).trim() || 'Instrument';
    }

    const hasImages = instrument.images && instrument.images.length > 0;
    const hasPlayer = hasValue(instrument.notes_layout) && typeof HandpanPlayer !== 'undefined' && HandpanPlayer.parseLayout(instrument.notes_layout);
    const galleryHtml = '<div class="annonce-gallery">' +
      '<div class="annonce-gallery__main" id="annonce-gallery-main">' +
        (hasImages
          ? '<img alt="' + escapeHtml(displayName) + '" id="annonce-main-image" src="' + instrument.images[0] + '">'
          : '<span class="annonce-gallery__no-image" id="annonce-no-image">' +
              '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
                '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>' +
                '<circle cx="8.5" cy="8.5" r="1.5"></circle>' +
                '<polyline points="21 15 16 10 5 21"></polyline>' +
              '</svg>' +
              '<span>Aucune photo</span>' +
            '</span>'
        ) +
        (hasPlayer
          ? '<div class="annonce-gallery__player-slide" id="annonce-player-slide" style="display:none;">' +
              '<div id="annonce-player"></div>' +
            '</div>'
          : '') +
        '<button class="annonce-gallery__nav annonce-gallery__nav--prev" id="annonce-gallery-prev" aria-label="Précédent" style="display:none;">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>' +
        '</button>' +
        '<button class="annonce-gallery__nav annonce-gallery__nav--next" id="annonce-gallery-next" aria-label="Suivant" style="display:none;">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
        '</button>' +
      '</div>' +
      '<div class="annonce-gallery__thumbs" id="annonce-gallery-thumbs"></div>' +
    '</div>';

    // Material label
    const matLabel = hasValue(instrument.materiau) && typeof MistralMateriaux !== 'undefined'
      ? MistralMateriaux.getLabel(instrument.materiau, 'full')
      : (instrument.materiau || '—');

    const specsHtml = '<div class="annonce-specs">' +
      renderSpec('Gamme', instrument.gamme) +
      renderSpec('Notes', instrument.nombre_notes ? instrument.nombre_notes + ' notes' : null) +
      renderSpec('Tonalité', convertNotes(instrument.tonalite)) +
      renderSpec('Accordage', instrument.accordage ? instrument.accordage + ' Hz' : null) +
      renderSpec('Taille', instrument.taille ? instrument.taille + ' cm' : null) +
      renderSpec('Matériau', matLabel) +
    '</div>';

    let notesLayoutHtml = '';
    if (hasValue(instrument.notes_layout)) {
      notesLayoutHtml = '<div class="annonce-notes-layout">' +
        '<span class="annonce-notes-layout__label">Disposition des notes</span>' +
        '<span class="annonce-notes-layout__value">' + escapeHtml(convertNotes(instrument.notes_layout)) + '</span>' +
      '</div>';
    }

    let descHtml = '';
    if (hasValue(instrument.description)) {
      descHtml = '<div class="annonce-description"><p>' + escapeHtml(instrument.description) + '</p></div>';
    }

    let videoHtml = '';
    if (hasValue(instrument.video_url)) {
      videoHtml = '<a href="' + escapeHtml(instrument.video_url) + '" class="annonce-link" target="_blank" rel="noopener">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>' +
        'Voir la vidéo</a>';
    }

    let handpanerHtml = '';
    if (hasValue(instrument.handpaner_url)) {
      handpanerHtml = '<a href="' + escapeHtml(instrument.handpaner_url) + '" class="annonce-link" target="_blank" rel="noopener">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
          '<polyline points="15 3 21 3 21 9"/>' +
          '<line x1="10" y1="14" x2="21" y2="3"/>' +
        '</svg>' +
        'Voir sur Handpaner</a>';
    }

    const optionsHtml = '<div class="annonce-options">' +
      '<div id="annonce-housse-container" style="display:none;">' +
        '<label class="annonce-option__label" for="annonce-housse-select">Ajouter une housse</label>' +
        '<select class="annonce-option__select" id="annonce-housse-select"><option value="">Sans housse</option></select>' +
      '</div>' +
    '</div>';

    const priceHtml = '<div class="annonce-price">' +
      '<div class="annonce-price__breakdown">' +
        '<div class="annonce-price__line"><span>Instrument</span><span id="annonce-price-instrument">0 €</span></div>' +
        '<div class="annonce-price__line" id="annonce-price-housse-line" style="display:none;"><span>Housse</span><span id="annonce-price-housse">0 €</span></div>' +
      '</div>' +
      '<div class="annonce-price__total">' +
        '<span class="annonce-price__label">Prix total</span>' +
        '<span class="annonce-price__value" id="annonce-price-total">0 €</span>' +
      '</div>' +
    '</div>';

    const ctaHtml = '<button class="annonce-cta" id="annonce-cart-btn" style="margin-bottom:0.5rem;">Ajouter au panier</button>' +
      '<button class="annonce-cta" id="annonce-order-btn" style="background:transparent;color:var(--color-accent);border:2px solid var(--color-accent);cursor:pointer;">Commander directement</button>' +
      '<p class="annonce-contact-note">Des questions ? <a href="#" data-modal="contact">Contactez-moi</a></p>';

    const promoBadgeHtml = instrument.promo_percent > 0
      ? ' <span style="display:inline-block;font-size:0.8125rem;font-weight:600;color:white;background:var(--color-accent,#0D7377);padding:0.375rem 0.75rem;border-radius:6px;vertical-align:middle;white-space:nowrap;">-' + instrument.promo_percent + '%</span>'
      : '';

    const flagUS = '<svg style="width:20px;height:14px;border-radius:2px;display:block;opacity:' + (getNotation() === 'american' ? '1' : '0.4') + '" viewBox="0 0 60 40" aria-hidden="true"><rect fill="#B22234" width="60" height="40"/><rect fill="#fff" y="6" width="60" height="4"/><rect fill="#fff" y="14" width="60" height="4"/><rect fill="#fff" y="22" width="60" height="4"/><rect fill="#fff" y="30" width="60" height="4"/><rect fill="#3C3B6E" width="25" height="22"/></svg>';
    const flagFR = '<svg style="width:20px;height:14px;border-radius:2px;display:block;opacity:' + (getNotation() === 'french' ? '1' : '0.4') + '" viewBox="0 0 3 2" aria-hidden="true"><rect fill="#002654" width="1" height="2"/><rect fill="#fff" x="1" width="1" height="2"/><rect fill="#CE1126" x="2" width="1" height="2"/></svg>';
    const notationToggleHtml = '<div class="notation-toggle" id="notation-toggle" style="display:inline-flex;border:1px solid #e5e7eb;border-radius:999px;overflow:hidden;margin-bottom:0.75rem;background:white;">' +
      '<button class="notation-toggle__opt' + (getNotation() === 'american' ? ' active' : '') + '" data-mode="american" title="C D E" style="padding:0.375rem 0.5rem;border:none;background:' + (getNotation() === 'american' ? 'var(--color-accent,#0D7377)' : 'transparent') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:0;">' + flagUS + '</button>' +
      '<button class="notation-toggle__opt' + (getNotation() === 'french' ? ' active' : '') + '" data-mode="french" title="Do Ré Mi" style="padding:0.375rem 0.5rem;border:none;background:' + (getNotation() === 'french' ? 'var(--color-accent,#0D7377)' : 'transparent') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:0;">' + flagFR + '</button>' +
    '</div>';

    const detailsHtml = '<div class="annonce-details">' +
      '<h1 class="annonce-details__title">' + escapeHtml(displayName) + promoBadgeHtml + '</h1>' +
      notationToggleHtml +
      specsHtml + notesLayoutHtml + descHtml + videoHtml + handpanerHtml +
      optionsHtml + priceHtml + ctaHtml +
    '</div>';

    const navHtml = '<nav class="annonce-nav">' +
      '<a href="boutique.html#flash-sales" class="annonce-nav__link">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<line x1="19" y1="12" x2="5" y2="12"></line>' +
          '<polyline points="12 19 5 12 12 5"></polyline>' +
        '</svg>' +
        'Retour à la boutique' +
      '</a>' +
    '</nav>';

    let statusBadge = '';
    if (instrument.statut !== 'en_ligne') {
      statusBadge = '<div style="position:fixed;bottom:1rem;left:1rem;background:#D97706;color:white;padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.875rem;font-weight:500;">' +
        'Statut : ' + escapeHtml(instrument.statut) + ' (non visible publiquement)' +
      '</div>';
    }

    container.innerHTML = '<div class="annonce-container">' +
      '<div class="annonce-layout">' + galleryHtml + detailsHtml + '</div>' +
      navHtml + statusBadge +
    '</div>';

    // Inject JSON-LD via DOM (instead of inline script string)
    const jsonLdScript = buildJsonLd(instrument);
    container.querySelector('.annonce-container').prepend(jsonLdScript);
  }

  function renderSpec(label, value) {
    return '<div class="annonce-spec">' +
      '<span class="annonce-spec__label">' + escapeHtml(label) + '</span>' +
      '<span class="annonce-spec__value">' + escapeHtml(value || '—') + '</span>' +
    '</div>';
  }

  // ── Galerie ──

  // Gallery: total slide count = images + player (if available)
  let galleryHasPlayer = false;
  let galleryTotalSlides = 0;

  function getGalleryImages() {
    return currentInstrument && currentInstrument.images ? currentInstrument.images : [];
  }

  function initGallery(images, hasPlayerSlide) {
    galleryHasPlayer = !!hasPlayerSlide;
    const imageCount = images ? images.length : 0;
    galleryTotalSlides = imageCount + (galleryHasPlayer ? 1 : 0);

    if (galleryTotalSlides <= 1 && imageCount <= 1 && !galleryHasPlayer) return;

    const prevBtn = document.getElementById('annonce-gallery-prev');
    const nextBtn = document.getElementById('annonce-gallery-next');
    const thumbsContainer = document.getElementById('annonce-gallery-thumbs');

    if (galleryTotalSlides > 1) {
      if (prevBtn) prevBtn.style.display = 'flex';
      if (nextBtn) nextBtn.style.display = 'flex';

      if (prevBtn) prevBtn.addEventListener('click', function() { navigateGallery(-1); });
      if (nextBtn) nextBtn.addEventListener('click', function() { navigateGallery(1); });
    }

    // Thumbnails
    if (thumbsContainer) {
      let html = '';
      if (images) {
        images.forEach(function(img, idx) {
          const activeClass = idx === 0 ? ' active' : '';
          html += '<div class="annonce-gallery__thumb' + activeClass + '" data-index="' + idx + '">' +
            '<img src="' + img + '" alt="Photo ' + (idx + 1) + '">' +
          '</div>';
        });
      }

      // Player thumbnail (last position)
      if (galleryHasPlayer) {
        const playerIdx = imageCount;
        const activeClass = imageCount === 0 ? ' active' : '';
        html += '<div class="annonce-gallery__thumb annonce-gallery__thumb--player' + activeClass + '" data-index="' + playerIdx + '" title="Instrument virtuel">' +
          '<svg viewBox="0 0 64 64" width="64" height="64">' +
            '<circle cx="32" cy="32" r="26" fill="#B8B8B8" stroke="#909090" stroke-width="1.5"/>' +
            '<circle cx="32" cy="32" r="24" fill="none" stroke="#909090" stroke-width="0.75"/>' +
            '<circle cx="32" cy="25" r="5" fill="#D0D0D0" stroke="#686868" stroke-width="1"/>' +
            '<circle cx="22" cy="33" r="4" fill="#A0A0A0" stroke="#686868" stroke-width="1"/>' +
            '<circle cx="42" cy="33" r="4" fill="#A0A0A0" stroke="#686868" stroke-width="1"/>' +
            '<circle cx="25" cy="42" r="4" fill="#A0A0A0" stroke="#686868" stroke-width="1"/>' +
            '<circle cx="39" cy="42" r="4" fill="#A0A0A0" stroke="#686868" stroke-width="1"/>' +
          '</svg>' +
        '</div>';
      }

      thumbsContainer.innerHTML = html;

      thumbsContainer.addEventListener('click', function(e) {
        const thumb = e.target.closest('.annonce-gallery__thumb');
        if (thumb) {
          setGalleryIndex(parseInt(thumb.dataset.index));
        }
      });
    }

    // If no images but has player, show player immediately
    if (imageCount === 0 && galleryHasPlayer) {
      setGalleryIndex(0);
    } else {
      updateGalleryNav();
    }
  }

  function navigateGallery(direction) {
    if (galleryTotalSlides === 0) return;
    setGalleryIndex(currentGalleryIndex + direction);
  }

  function setGalleryIndex(idx) {
    const images = getGalleryImages();
    const imageCount = images.length;

    if (idx < 0) idx = galleryTotalSlides - 1;
    if (idx >= galleryTotalSlides) idx = 0;
    currentGalleryIndex = idx;

    const mainImage = document.getElementById('annonce-main-image');
    const noImage = document.getElementById('annonce-no-image');
    const playerSlide = document.getElementById('annonce-player-slide');
    const isPlayerSlide = galleryHasPlayer && idx === imageCount;

    if (isPlayerSlide) {
      // Show player, hide image
      if (mainImage) mainImage.style.display = 'none';
      if (noImage) noImage.style.display = 'none';
      if (playerSlide) playerSlide.style.display = 'flex';
    } else {
      // Show image, hide player
      if (playerSlide) playerSlide.style.display = 'none';
      if (noImage) noImage.style.display = 'none';
      if (mainImage) {
        mainImage.style.display = '';
        mainImage.src = images[idx];
      }
    }

    document.querySelectorAll('.annonce-gallery__thumb').forEach(function(thumb, i) {
      thumb.classList.toggle('active', i === idx);
    });

    updateGalleryNav();
  }

  function updateGalleryNav() {
    const prevBtn = document.getElementById('annonce-gallery-prev');
    const nextBtn = document.getElementById('annonce-gallery-next');
    if (prevBtn) prevBtn.disabled = currentGalleryIndex === 0;
    if (nextBtn) nextBtn.disabled = currentGalleryIndex === galleryTotalSlides - 1;
  }

  // ── Housse ──

  function initHousse(taille) {
    const container = document.getElementById('annonce-housse-container');
    const select = document.getElementById('annonce-housse-select');
    if (!container || !select) return;

    let accessoires = [];
    if (window.MistralSync && MistralSync.hasKey(ACCESSOIRES_KEY)) {
      accessoires = MistralSync.getData(ACCESSOIRES_KEY);
    }
    const housses = accessoires.filter(function(a) {
      return a.statut === 'actif' &&
        a.visible_configurateur === true &&
        a.tailles_compatibles &&
        a.tailles_compatibles.includes(taille);
    });

    if (housses.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    let optionsHtml = '<option value="">Sans housse</option>';
    housses.forEach(function(h) {
      optionsHtml += '<option value="' + h.id + '" data-prix="' + h.prix + '">' +
        escapeHtml(h.nom) + ' (+' + formatPrice(h.prix) + ')' +
      '</option>';
    });
    select.innerHTML = optionsHtml;

    select.addEventListener('change', updatePrice);
  }

  // ── Keyboard ──

  function initKeyboard() {
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowLeft') navigateGallery(-1);
      else if (e.key === 'ArrowRight') navigateGallery(1);
    });
  }

  // ── Prix ──

  function updatePrice() {
    if (!currentInstrument) return;

    const originalPrice = currentInstrument.prix_vente || 0;
    const promoPercent = currentInstrument.promo_percent || 0;
    const instrumentPrice = promoPercent > 0
      ? Math.floor(originalPrice * (1 - promoPercent / 100) / 5) * 5
      : originalPrice;

    const housseSelect = document.getElementById('annonce-housse-select');

    let houssePrice = 0;
    let housseName = null;
    if (housseSelect && housseSelect.value) {
      const opt = housseSelect.options[housseSelect.selectedIndex];
      houssePrice = parseFloat(opt.dataset.prix) || 0;
      housseName = opt.textContent.split(' (+')[0];
    }

    const totalPrice = instrumentPrice + houssePrice;

    const priceInstrument = document.getElementById('annonce-price-instrument');
    if (priceInstrument) {
      if (promoPercent > 0) {
        priceInstrument.innerHTML = '<span style="text-decoration:line-through;opacity:0.5;font-size:0.8em;">' + formatPrice(originalPrice) + '</span> ' + formatPrice(instrumentPrice);
      } else {
        priceInstrument.textContent = formatPrice(instrumentPrice);
      }
    }

    const housseLine = document.getElementById('annonce-price-housse-line');
    const housseEl = document.getElementById('annonce-price-housse');
    if (housseLine) housseLine.style.display = houssePrice > 0 ? 'flex' : 'none';
    if (housseEl) housseEl.textContent = formatPrice(houssePrice);

    const totalEl = document.getElementById('annonce-price-total');
    if (totalEl) totalEl.textContent = formatPrice(totalPrice);
  }

  // ── Commander directement (global pour onclick) ──

  window.orderInstrumentDirectly = function() {
    if (!currentInstrument || typeof MistralCart === 'undefined') return;

    const housseSelect = document.getElementById('annonce-housse-select');

    const options = {};
    if (housseSelect && housseSelect.value) {
      const opt = housseSelect.options[housseSelect.selectedIndex];
      options.housse = {
        id: housseSelect.value,
        nom: opt.textContent.split(' (+')[0],
        prix: parseFloat(opt.dataset.prix) || 0
      };
    }

    MistralCart.addInstrument(currentInstrument, options);
    window.location.href = 'commander.html?from=cart';
  };

  // ── Meta tags accessoire ──

  function updateMetaAccessoire(accessoire) {
    let displayName = accessoire.nom || 'Accessoire';
    const categorie = accessoire.categorie || '';
    const title = displayName + ' | Mistral Pans';
    const description = categorie.charAt(0).toUpperCase() + categorie.slice(1) + ' ' + displayName + ' - Accessoire pour handpan par Mistral Pans.';

    document.title = title;

    const setMeta = function(selector, attr, value) {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', 'content', description);
    setMeta('link[rel="canonical"]', 'href', 'https://mistralpans.fr/annonce.html?ref=' + accessoire.id + '&type=accessoire');
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', 'https://mistralpans.fr/annonce.html?ref=' + accessoire.id + '&type=accessoire');
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);

    if (hasValue(accessoire.image)) {
      setMeta('meta[property="og:image"]', 'content', accessoire.image);
      setMeta('meta[name="twitter:image"]', 'content', accessoire.image);
    }
  }

  // ── Rendu accessoire ──

  function renderAccessoire(container, accessoire) {
    let displayName = accessoire.nom || 'Accessoire';
    const hasImage = hasValue(accessoire.image);

    const categorieLabels = { 'housse': 'Housse', 'huile': 'Huile d\'entretien', 'support': 'Support', 'accessoire': 'Accessoire' };
    const categorie = categorieLabels[accessoire.categorie] || accessoire.categorie || 'Accessoire';

    const galleryHtml = '<div class="annonce-gallery">' +
      '<div class="annonce-gallery__main" id="annonce-gallery-main">' +
        (hasImage
          ? '<img alt="' + escapeHtml(displayName) + '" id="annonce-main-image" src="' + accessoire.image + '">'
          : '<span class="annonce-gallery__no-image" id="annonce-no-image">' +
              '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
                '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>' +
                '<circle cx="8.5" cy="8.5" r="1.5"></circle>' +
                '<polyline points="21 15 16 10 5 21"></polyline>' +
              '</svg>' +
              '<span>Aucune photo</span>' +
            '</span>'
        ) +
      '</div>' +
    '</div>';

    let descHtml = '';
    if (hasValue(accessoire.description)) {
      descHtml = '<div class="annonce-description"><p>' + escapeHtml(accessoire.description) + '</p></div>';
    }

    let compatHtml = '';
    if (accessoire.tailles_compatibles && accessoire.tailles_compatibles.length > 0) {
      compatHtml = '<div class="annonce-notes-layout">' +
        '<span class="annonce-notes-layout__label">Tailles compatibles</span>' +
        '<span class="annonce-notes-layout__value">' + accessoire.tailles_compatibles.map(function(t) { return t + ' cm'; }).join(', ') + '</span>' +
      '</div>';
    }

    let stockHtml = '';
    let stock = accessoire.stock;
    if (stock !== null && stock !== undefined) {
      if (stock === -1) {
        stockHtml = '<div class="annonce-spec">' +
          '<span class="annonce-spec__label">Disponibilité</span>' +
          '<span class="annonce-spec__value" style="color: var(--color-success, #3D6B4A);">En stock</span>' +
        '</div>';
      } else if (stock > 0) {
        stockHtml = '<div class="annonce-spec">' +
          '<span class="annonce-spec__label">Disponibilité</span>' +
          '<span class="annonce-spec__value" style="color: var(--color-success, #3D6B4A);">En stock (' + stock + ')</span>' +
        '</div>';
      } else if (stock === 0) {
        stockHtml = '<div class="annonce-spec">' +
          '<span class="annonce-spec__label">Disponibilité</span>' +
          '<span class="annonce-spec__value" style="color: var(--color-error, #DC2626);">Rupture de stock</span>' +
        '</div>';
      }
    }

    const specsHtml = '<div class="annonce-specs">' +
      '<div class="annonce-spec"><span class="annonce-spec__label">Catégorie</span><span class="annonce-spec__value">' + escapeHtml(categorie) + '</span></div>' +
      stockHtml +
    '</div>';

    const accOriginalPrice = accessoire.prix || 0;
    const accPromoPercent = accessoire.promo_percent || 0;
    const accFinalPrice = accPromoPercent > 0
      ? Math.floor(accOriginalPrice * (1 - accPromoPercent / 100) / 5) * 5
      : accOriginalPrice;

    const priceHtml = '<div class="annonce-price">' +
      '<div class="annonce-price__total">' +
        '<span class="annonce-price__label">Prix</span>' +
        '<span class="annonce-price__value" id="annonce-price-total">' +
          (accPromoPercent > 0
            ? '<span style="text-decoration:line-through;opacity:0.5;font-size:0.65em;">' + formatPrice(accOriginalPrice) + '</span> ' + formatPrice(accFinalPrice)
            : formatPrice(accOriginalPrice)) +
        '</span>' +
      '</div>' +
    '</div>';

    const canBuy = stock === null || stock === undefined || stock === -1 || stock > 0;
    let ctaHtml = canBuy
      ? '<button class="annonce-cta" id="annonce-add-cart-btn">Ajouter au panier</button>'
      : '<button class="annonce-cta" disabled style="opacity:0.5;cursor:not-allowed;">Rupture de stock</button>';
    ctaHtml += '<p class="annonce-contact-note">Des questions ? <a href="#" data-modal="contact">Contactez-moi</a></p>';

    const accPromoBadgeHtml = accessoire.promo_percent > 0
      ? ' <span style="display:inline-block;font-size:0.8125rem;font-weight:600;color:white;background:var(--color-accent,#0D7377);padding:0.375rem 0.75rem;border-radius:6px;vertical-align:middle;white-space:nowrap;">-' + accessoire.promo_percent + '%</span>'
      : '';

    const detailsHtml = '<div class="annonce-details">' +
      '<h1 class="annonce-details__title">' + escapeHtml(displayName) + accPromoBadgeHtml + '</h1>' +
      specsHtml + compatHtml + descHtml + priceHtml + ctaHtml +
    '</div>';

    const navHtml = '<nav class="annonce-nav">' +
      '<a href="boutique.html#flash-sales" class="annonce-nav__link">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<line x1="19" y1="12" x2="5" y2="12"></line>' +
          '<polyline points="12 19 5 12 12 5"></polyline>' +
        '</svg>' +
        'Retour à la boutique' +
      '</a>' +
    '</nav>';

    let statusBadge = '';
    if (accessoire.statut !== 'en_ligne' && accessoire.statut !== 'actif') {
      statusBadge = '<div style="position:fixed;bottom:1rem;left:1rem;background:#D97706;color:white;padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.875rem;font-weight:500;">' +
        'Statut : ' + escapeHtml(accessoire.statut) + ' (non visible publiquement)' +
      '</div>';
    }

    container.innerHTML = '<div class="annonce-container">' +
      '<div class="annonce-layout">' + galleryHtml + detailsHtml + '</div>' +
      navHtml + statusBadge +
    '</div>';
  }

  function initGalleryAccessoire(accessoire) {
    // Accessoire n'a qu'une seule image, pas de galerie à initialiser
  }

  // ── Ajouter instrument au panier ──

  window.addInstrumentToCart = function() {
    if (!currentInstrument || typeof MistralCart === 'undefined') return;

    const housseSelect = document.getElementById('annonce-housse-select');

    const options = {};
    if (housseSelect && housseSelect.value) {
      const opt = housseSelect.options[housseSelect.selectedIndex];
      options.housse = {
        id: housseSelect.value,
        nom: opt.textContent.split(' (+')[0],
        prix: parseFloat(opt.dataset.prix) || 0
      };
    }

    const id = MistralCart.addInstrument(currentInstrument, options);
    if (id) {
      const btn = document.getElementById('annonce-cart-btn');
      if (btn) {
        btn.textContent = 'Ajouté au panier !';
        btn.style.background = 'var(--color-success, #3D6B4A)';
        setTimeout(function() {
          if (MistralCart.hasItem(currentInstrument.id)) {
            btn.textContent = 'Déjà dans le panier';
          } else {
            btn.textContent = 'Ajouter au panier';
            btn.style.background = '';
          }
        }, 2000);
      }
    }
  };

  // ── Ajouter accessoire au panier ──

  window.addAccessoireToCart = function() {
    if (!currentAccessoire || typeof MistralCart === 'undefined') return;
    const id = MistralCart.addAccessoire(currentAccessoire);
    if (id) {
      const btn = document.getElementById('annonce-add-cart-btn');
      if (btn) {
        btn.textContent = 'Ajouté au panier !';
        btn.style.background = 'var(--color-success, #3D6B4A)';
        setTimeout(function() {
          if (MistralCart.hasItem(currentAccessoire.id)) {
            btn.textContent = 'Déjà dans le panier';
          } else {
            btn.textContent = 'Ajouter au panier';
            btn.style.background = '';
          }
        }, 2000);
      }
    }
  };

  // ── Not found ──

  function showNotFound(container) {
    document.title = 'Instrument non trouvé — Mistral Pans';
    container.innerHTML = '<div class="annonce-container">' +
      '<div class="annonce-not-found">' +
        '<h1>Instrument non trouvé</h1>' +
        '<p style="color: var(--color-text-light); margin-bottom: var(--space-lg);">' +
          'Cet instrument n\'existe pas ou n\'est plus disponible.' +
        '</p>' +
        '<a href="boutique.html#flash-sales" class="annonce-cta" style="max-width:300px;margin:0 auto;">Retour à la boutique</a>' +
      '</div>' +
    '</div>';
  }

  // ── Instrument virtuel ──

  let virtualPlayer = null;

  function initVirtualPlayer(instrument) {
    if (!hasValue(instrument.notes_layout)) return false;

    // Vérifier que HandpanPlayer est disponible
    if (typeof HandpanPlayer === 'undefined') return false;

    // Vérifier que le layout est parsable
    const parsed = HandpanPlayer.parseLayout(instrument.notes_layout);
    if (!parsed) return false;

    const container = document.getElementById('annonce-player');
    if (!container) return false;

    // Nettoyer l'instance précédente
    if (virtualPlayer) {
      virtualPlayer.destroy();
      virtualPlayer = null;
    }

    virtualPlayer = new HandpanPlayer(container, {
      layout: instrument.notes_layout,
      size: 280,
      showScaleSelector: false,
      showNoteNames: true,
      enableHaptics: true,
      enableWaveAnimation: true
    });

    return true;
  }

  // ── Notation toggle binding ──

  function bindNotationToggle() {
    const toggle = document.getElementById('notation-toggle');
    if (!toggle) return;

    toggle.querySelectorAll('.notation-toggle__opt').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const mode = btn.dataset.mode;
        if (typeof MistralScales !== 'undefined' && MistralScales.setNotationMode) {
          MistralScales.setNotationMode(mode);
        }
      });
    });
  }

  // Re-render on notation change
  window.addEventListener('notation-mode-change', function() {
    loadInstrument();
  });

  // ── Init ──

  window.addEventListener('mistral-sync-complete', function() {
    syncComplete = true;
    loadInstrument();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadInstrument);
  } else {
    loadInstrument();
  }
})();
