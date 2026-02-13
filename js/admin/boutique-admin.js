/* ==========================================================================
   MISTRAL PANS - Boutique Admin Integration
   Version 2.0 - Synchronisé avec admin.html
   
   Utilise les mêmes sources de données que l'admin:
   - Instruments: mistral_gestion_instruments (statut: 'en_ligne')
   - Accessoires: mistral_accessoires (statut: 'en_ligne')
   ========================================================================== */

(function() {
  'use strict';

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
  // CLES DE STOCKAGE (via MistralSync)
  // ============================================================================

  const INSTRUMENTS_KEY = 'mistral_gestion_instruments';
  const ACCESSOIRES_KEY = 'mistral_accessoires';

  // ============================================================================
  // FONCTIONS DE LECTURE DES DONNEES (via MistralSync)
  // ============================================================================

  function getInstrumentsEnLigne() {
    const instruments = (window.MistralSync && MistralSync.hasKey(INSTRUMENTS_KEY))
      ? MistralSync.getData(INSTRUMENTS_KEY)
      : [];
    return instruments.filter(i => i.statut === 'en_ligne');
  }

  function getAccessoiresActifs() {
    const accessoires = (window.MistralSync && MistralSync.hasKey(ACCESSOIRES_KEY))
      ? MistralSync.getData(ACCESSOIRES_KEY)
      : [];
    return accessoires.filter(a => a.statut === 'en_ligne');
  }

  function updateInstrumentStatut(id, statut) {
    if (window.MistralSync && MistralSync.hasKey(INSTRUMENTS_KEY)) {
      const instruments = MistralSync.getData(INSTRUMENTS_KEY);
      const index = instruments.findIndex(i => i.id === id);
      if (index !== -1) {
        instruments[index].statut = statut;
        instruments[index].updated_at = new Date().toISOString();
        MistralSync.setData(INSTRUMENTS_KEY, instruments);
        return true;
      }
    }
    return false;
  }

  function updateAccessoireStatut(id, statut) {
    if (window.MistralSync && MistralSync.hasKey(ACCESSOIRES_KEY)) {
      const accessoires = MistralSync.getData(ACCESSOIRES_KEY);
      const index = accessoires.findIndex(a => a.id === id);
      if (index !== -1) {
        accessoires[index].statut = statut;
        accessoires[index].updated_at = new Date().toISOString();
        MistralSync.setData(ACCESSOIRES_KEY, accessoires);
        return true;
      }
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

    // Make entire card clickable (::after "Voir le détail" is outside <a>)
    container.querySelectorAll('.flash-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('button')) return;
        var link = card.querySelector('a');
        if (link) window.location.href = link.href;
      });
    });
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

    var instrInCart = (typeof MistralCart !== 'undefined' && MistralCart.hasItem(instrument.id));
    var instrCartLabel = instrInCart ? 'Dans le panier' : 'Ajouter au panier';
    var instrCartStyle = instrInCart ? 'background:var(--color-success, #4A7C59);color:white;' : 'background:var(--color-accent);color:white;';

    return '<div class="flash-card" data-type="instrument" data-id="' + instrument.id + '" style="position:relative;text-decoration:none;color:inherit;">' +
      '<a href="annonce.html?ref=' + instrument.id + '" style="text-decoration:none;color:inherit;display:block;">' +
        '<div class="flash-card__image" style="position:relative;">' + imageContent + videoIndicator + photoCount + '</div>' +
        '<div class="flash-card__content">' +
          '<h3 class="flash-card__name">' + utils.escapeHtml(displayName) + '</h3>' +
          specsHtml + notesHtml + descHtml +
          '<div class="flash-card__footer">' + priceHtml +
            '<span class="flash-card__cta-hint" style="font-size:0.75rem;color:var(--color-text-muted);">Cliquez pour voir</span>' +
          '</div>' +
        '</div>' +
      '</a>' +
      '<div style="padding:0 0.75rem 0.75rem;">' +
        '<button class="flash-card__cart-btn" data-cart-instrument="' + instrument.id + '" onclick="event.stopPropagation();BoutiqueAdmin.addInstrumentToCart(\'' + instrument.id + '\', this)" style="width:100%;padding:0.5rem;border:none;border-radius:var(--radius-md,6px);font-size:0.8125rem;font-weight:600;cursor:pointer;transition:all 0.2s;' + instrCartStyle + '">' + instrCartLabel + '</button>' +
      '</div>' +
    '</div>';
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
    
    var inCart = (typeof MistralCart !== 'undefined' && MistralCart.hasItem(accessoire.id));
    var cartBtnLabel = inCart ? 'Dans le panier' : 'Ajouter au panier';
    var cartBtnStyle = inCart ? 'background:var(--color-success, #4A7C59);color:white;' : 'background:var(--color-accent);color:white;';

    return '<div class="flash-card flash-card--accessoire" data-type="accessoire" data-id="' + accessoire.id + '" style="text-decoration:none;color:inherit;">' +
      '<a href="annonce.html?ref=' + accessoire.id + '&type=accessoire" style="text-decoration:none;color:inherit;display:block;">' +
        '<div class="flash-card__image flash-card__image--small" style="position:relative; height: 150px;">' + imageContent + '</div>' +
        '<div class="flash-card__content">' +
          '<span class="flash-card__category" style="font-size:0.75rem;color:var(--color-accent);text-transform:uppercase;letter-spacing:0.05em;">' + categorie + '</span>' +
          '<h3 class="flash-card__name" style="font-size:1rem;margin:0.25rem 0;">' + utils.escapeHtml(accessoire.nom) + '</h3>' +
          descHtml +
          '<div class="flash-card__footer" style="margin-top:auto;">' +
            '<span class="flash-card__price">' + formatPrice(accessoire.prix) + '</span>' +
            stockHtml +
          '</div>' +
        '</div>' +
      '</a>' +
      '<div style="padding:0 0.75rem 0.75rem;">' +
        '<button class="flash-card__cart-btn" data-cart-accessoire="' + accessoire.id + '" onclick="event.stopPropagation();BoutiqueAdmin.addAccessoireToCart(\'' + accessoire.id + '\', this)" style="width:100%;padding:0.5rem;border:none;border-radius:var(--radius-md,6px);font-size:0.8125rem;font-weight:600;cursor:pointer;transition:all 0.2s;' + cartBtnStyle + '">' + cartBtnLabel + '</button>' +
      '</div>' +
    '</div>';
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
      if (updateAccessoireStatut(id, 'disponible')) {
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
  // PANIER - Ajout depuis les cartes
  // ============================================================================

  function addInstrumentToCart(id, btnElement) {
    if (typeof MistralCart === 'undefined') return;
    var instruments = getInstrumentsEnLigne();
    var instrument = instruments.find(function(i) { return i.id === id; });
    if (!instrument) return;

    MistralCart.addInstrument(instrument);

    if (btnElement) {
      btnElement.textContent = 'Dans le panier';
      btnElement.style.background = 'var(--color-success, #4A7C59)';
    }
  }

  function addAccessoireToCart(id, btnElement) {
    if (typeof MistralCart === 'undefined') return;
    var accessoires = getAccessoiresActifs();
    var accessoire = accessoires.find(function(a) { return a.id === id; });
    if (!accessoire) return;

    MistralCart.addAccessoire(accessoire);

    if (btnElement) {
      btnElement.textContent = 'Dans le panier';
      btnElement.style.background = 'var(--color-success, #4A7C59)';
    }
  }

  // ============================================================================
  // NAVIGATION VERS PAGE ANNONCE
  // ============================================================================

  function openInstrumentPage(id) {
    window.location.href = 'annonce.html?ref=' + id;
  }


  // ============================================================================
  // INITIALISATION
  // ============================================================================

  function init() {
    renderFlashCards();

    // Ecouter les changements de donnees via MistralSync
    window.addEventListener('mistral-sync-complete', function() {
      console.log('[Boutique Admin v2] Donnees synchronisees, rafraichissement...');
      renderFlashCards();
    });
    window.addEventListener('mistral-data-change', function(e) {
      if (e.detail && (e.detail.key === INSTRUMENTS_KEY || e.detail.key === ACCESSOIRES_KEY)) {
        renderFlashCards();
      }
    });

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
    addInstrumentToCart: addInstrumentToCart,
    addAccessoireToCart: addAccessoireToCart,
    openInstrumentPage: openInstrumentPage,
    init: init
  };

})();
