/* ==========================================================================
   MISTRAL PANS - Admin UI - Module Boutique
   Gestion boutique et accessoires
   ========================================================================== */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-boutique] AdminUI non disponible, module différé');
    return;
  }

  const { $, $$, escapeHtml, formatPrice, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers || {};

  // État local du module
  let accessoireUploadedImage = null;

  function renderBoutique() {
    renderBoutiqueInstruments();
    renderBoutiqueAccessoires();
  }
  
  function renderBoutiqueInstruments() {
    const grid = $('#boutique-instruments-list');
    const empty = $('#boutique-instruments-empty');
    
    if (!grid) return;
    
    // Récupérer les instruments publiés (statut "en_ligne")
    let instruments = [];
    if (typeof MistralGestion !== 'undefined') {
      instruments = MistralGestion.Instruments.list().filter(i => i.statut === 'en_ligne');
    }
    
    if (!instruments.length) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    
    grid.innerHTML = instruments.map(i => `
      <div class="dashboard__card" style="position: relative;">
        ${i.images && i.images.length > 0 ? `
          <div style="margin: -1rem -1rem 1rem -1rem; height: 120px; overflow: hidden; border-radius: 8px 8px 0 0;">
            <img src="${i.images[0]}" alt="${escapeHtml(i.nom)}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
          <div>
            <strong>${escapeHtml(i.nom || i.reference)}</strong>
            <div style="font-size: 0.875rem; color: var(--admin-text-muted);">
              ${i.nombre_notes || '?'} notes · ${i.taille || '?'}cm · ${i.tonalite || ''} ${i.gamme || ''}
            </div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 1.25rem; font-weight: 600; color: var(--admin-accent);">
            ${formatPrice(i.prix_vente || 0)}
          </div>
          <span class="admin-badge admin-badge--success">En ligne</span>
        </div>
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
          <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editInstrument('${i.id}')">Modifier</button>
          <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.retirerDeBoutique('${i.id}')">Retirer</button>
        </div>
      </div>
    `).join('');
  }
  
  function renderBoutiqueAccessoires() {
    const grid = $('#boutique-accessoires-list');
    const empty = $('#boutique-accessoires-empty');
    
    if (!grid) return;
    
    const accessoires = Storage.get('mistral_accessoires', []);
    
    if (!accessoires.length) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    
    const categorieLabels = {
      'housse': 'Housse',
      'huile': 'Huile',
      'support': 'Support',
      'accessoire': 'Accessoire'
    };
    
    grid.innerHTML = accessoires.map(a => `
      <div class="dashboard__card" style="position: relative; ${a.statut === 'masque' ? 'opacity: 0.6;' : ''}">
        ${a.image ? `
          <div style="margin: -1rem -1rem 1rem -1rem; height: 100px; overflow: hidden; border-radius: 8px 8px 0 0;">
            <img src="${a.image}" alt="${escapeHtml(a.nom)}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
          <div>
            <strong>${escapeHtml(a.nom)}</strong>
            <div style="font-size: 0.875rem; color: var(--admin-text-muted);">
              ${categorieLabels[a.categorie] || a.categorie}
              ${a.stock >= 0 ? ` · Stock: ${a.stock}` : ' · Illimité'}
            </div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 1.25rem; font-weight: 600; color: var(--admin-accent);">
            ${formatPrice(a.prix || 0)}
          </div>
          <span class="admin-badge admin-badge--${a.statut === 'actif' ? 'success' : 'neutral'}">
            ${a.statut === 'actif' ? 'Actif' : 'Masqué'}
          </span>
        </div>
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
          <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.editAccessoire('${a.id}')">Modifier</button>
          <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.toggleAccessoire('${a.id}')">
            ${a.statut === 'actif' ? 'Masquer' : 'Afficher'}
          </button>
          <button class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.deleteAccessoire('${a.id}')">Supprimer</button>
        </div>
      </div>
    `).join('');
  }
  
  // Retirer un instrument de la boutique (passer en statut "disponible")
  function retirerDeBoutique(id) {
    if (typeof MistralGestion === 'undefined') return;
    
    MistralGestion.Instruments.update(id, { statut: 'disponible' });
    renderBoutique();
    renderInstruments();
    Toast.success('Instrument retiré de la boutique');
  }
  
  // Variable pour stocker l'instrument sélectionné pour publication
  let selectedInstrumentForBoutique = null;
  
  // Initialiser le searchable select pour les instruments disponibles
  function initBoutiqueInstrumentSelect() {
    const searchInput = $('#boutique-instrument-search');
    const dropdown = $('#boutique-instrument-dropdown');
    
    if (!searchInput || !dropdown) return;
    
    // Reset
    selectedInstrumentForBoutique = null;
    searchInput.value = '';
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const instruments = getInstrumentsDisponiblesPourBoutique(query);
      
      if (instruments.length === 0) {
        dropdown.innerHTML = `<div class="searchable-dropdown__empty">Aucun instrument disponible</div>`;
      } else {
        dropdown.innerHTML = instruments.map(i => `
          <div class="searchable-dropdown__item" data-id="${i.id}">
            <strong>${escapeHtml(i.nom || i.reference)}</strong>
            <span style="color: var(--admin-text-muted); font-size: 0.8rem;">${i.tonalite || ''} ${i.gamme || ''} · ${i.nombre_notes || '?'} notes · ${formatPrice(i.prix_vente || 0)}</span>
          </div>
        `).join('');
      }
      
      dropdown.style.display = 'block';
    });
    
    searchInput.addEventListener('focus', () => {
      const query = searchInput.value.toLowerCase();
      const instruments = getInstrumentsDisponiblesPourBoutique(query);
      
      if (instruments.length === 0) {
        dropdown.innerHTML = `<div class="searchable-dropdown__empty">Aucun instrument disponible</div>`;
      } else {
        dropdown.innerHTML = instruments.map(i => `
          <div class="searchable-dropdown__item" data-id="${i.id}">
            <strong>${escapeHtml(i.nom || i.reference)}</strong>
            <span style="color: var(--admin-text-muted); font-size: 0.8rem;">${i.tonalite || ''} ${i.gamme || ''} · ${i.nombre_notes || '?'} notes · ${formatPrice(i.prix_vente || 0)}</span>
          </div>
        `).join('');
      }
      
      dropdown.style.display = 'block';
    });
    
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.searchable-dropdown__item');
      if (item) {
        const id = item.dataset.id;
        const instrument = MistralGestion.Instruments.get(id);
        if (instrument) {
          selectedInstrumentForBoutique = instrument;
          searchInput.value = instrument.nom || instrument.reference;
          dropdown.style.display = 'none';
        }
      }
    });
    
    // Fermer dropdown quand on clique ailleurs
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#boutique-instrument-search') && !e.target.closest('#boutique-instrument-dropdown')) {
        dropdown.style.display = 'none';
      }
    });
  }
  
  // Récupérer les instruments disponibles (non publiés)
  function getInstrumentsDisponiblesPourBoutique(query = '') {
    if (typeof MistralGestion === 'undefined') return [];
    
    return MistralGestion.Instruments.list()
      .filter(i => {
        // Seulement les instruments disponibles (pas en ligne, pas en location, pas vendus)
        if (i.statut !== 'disponible') return false;
        
        // Filtre de recherche
        if (query) {
          const searchStr = `${i.nom || ''} ${i.reference || ''} ${i.tonalite || ''} ${i.gamme || ''}`.toLowerCase();
          return searchStr.includes(query);
        }
        return true;
      })
      .slice(0, 10); // Limiter à 10 résultats
  }
  
  // Publier l'instrument sélectionné
  function publierInstrumentSelectionne() {
    if (!selectedInstrumentForBoutique) {
      Toast.error('Sélectionnez un instrument à publier');
      return;
    }
    
    // Vérifier qu'il a un prix
    if (!selectedInstrumentForBoutique.prix_vente || selectedInstrumentForBoutique.prix_vente <= 0) {
      Toast.error('Cet instrument n\'a pas de prix de vente défini');
      return;
    }
    
    // Passer en statut "en_ligne"
    MistralGestion.Instruments.update(selectedInstrumentForBoutique.id, { statut: 'en_ligne' });
    
    // Reset
    selectedInstrumentForBoutique = null;
    if ($('#boutique-instrument-search')) $('#boutique-instrument-search').value = '';
    
    renderBoutique();
    renderInstruments();
    Toast.success('Instrument publié dans la boutique');
  }
  
  // Variable pour indiquer qu'on vient de la boutique
  let publishAfterInstrumentCreation = false;
  
  // Créer un instrument et le publier
  function creerEtPublierInstrument() {
    publishAfterInstrumentCreation = true;
    showModal('instrument');
  }
  
  // ============================================================================
  // GESTION DES ACCESSOIRES
  // ============================================================================
  
  // Stockage temporaire de l'image uploadée
  let accessoireUploadedImage = null;
  
  function initAccessoireUpload() {
    if (typeof MistralUpload === 'undefined') {
      console.warn('[Admin UI] MistralUpload non disponible');
      return;
    }
    
    // Reset
    accessoireUploadedImage = null;
    
    const container = $('#accessoire-image-upload');
    if (container) {
      container.innerHTML = '';
      
      const input = MistralUpload.createUploadInput({
        id: 'accessoire-image-file',
        acceptType: 'image',
        onSelect: async (file) => {
          try {
            const compress = isCompressionEnabled('accessoire');
            const base64 = await fileToBase64(file, compress, 'standard');
            accessoireUploadedImage = {
              type: 'base64',
              data: base64,
              name: file.name
            };
            
            // Afficher preview
            showAccessoireImagePreview(base64);
            Toast.success('Image chargée');
          } catch (e) {
            console.error('[Admin UI] Erreur upload image accessoire:', e);
            Toast.error('Erreur lors du chargement de l\'image');
          }
        }
      });
      
      container.appendChild(input);
    }
    
    // Clear preview
    const preview = $('#accessoire-image-preview');
    if (preview) preview.innerHTML = '';
    
    // Clear URL manuelle
    if ($('#accessoire-image-url')) $('#accessoire-image-url').value = '';
  }
  
  function showAccessoireImagePreview(src) {
    const container = $('#accessoire-image-preview');
    if (!container) return;
    
    container.innerHTML = `
      <div class="upload-preview-item" style="width: 120px; height: 120px;">
        <img src="${src}" alt="Preview">
        <button type="button" class="upload-preview-remove" onclick="AdminUI.removeAccessoireImage()">×</button>
      </div>
    `;
  }
  
  function removeAccessoireImage() {
    accessoireUploadedImage = null;
    const preview = $('#accessoire-image-preview');
    if (preview) preview.innerHTML = '';
  }
  
  function getAccessoireImageForSave() {
    // Priorité : image uploadée > URL manuelle
    if (accessoireUploadedImage) {
      return accessoireUploadedImage.data;
    }
    
    const urlManuelle = $('#accessoire-image-url')?.value?.trim();
    if (urlManuelle) {
      return urlManuelle;
    }
    
    return '';
  }
  
  function loadAccessoireImageForEdit(accessoire) {
    accessoireUploadedImage = null;
    const preview = $('#accessoire-image-preview');
    if (preview) preview.innerHTML = '';
    if ($('#accessoire-image-url')) $('#accessoire-image-url').value = '';
    
    if (accessoire.image) {
      // Charger l'image existante
      accessoireUploadedImage = {
        type: 'url',
        data: accessoire.image
      };
      showAccessoireImagePreview(accessoire.image);
    }
  }
  
  function saveAccessoire() {
    const id = $('#accessoire-id')?.value;

    // Collect compatible sizes
    const taillesCompatibles = [];
    if ($('#accessoire-taille-45')?.checked) taillesCompatibles.push('45');
    if ($('#accessoire-taille-50')?.checked) taillesCompatibles.push('50');
    if ($('#accessoire-taille-53')?.checked) taillesCompatibles.push('53');

    const data = {
      nom: $('#accessoire-nom')?.value.trim(),
      categorie: $('#accessoire-categorie')?.value || 'accessoire',
      prix: parseFloat($('#accessoire-prix')?.value) || 0,
      stock: parseInt($('#accessoire-stock')?.value),
      description: $('#accessoire-description')?.value.trim(),
      image: getAccessoireImageForSave(),
      statut: $('#accessoire-statut')?.value || 'actif',
      visible_configurateur: $('#accessoire-visible-config')?.checked || false,
      tailles_compatibles: taillesCompatibles
    };
    
    // Validation
    if (!data.nom) {
      Toast.error('Nom requis');
      return;
    }
    
    if (data.prix <= 0) {
      Toast.error('Prix requis');
      return;
    }
    
    // Stock -1 = illimité
    if (isNaN(data.stock)) data.stock = -1;
    
    const accessoires = Storage.get('mistral_accessoires', []);
    
    if (id) {
      // Modification
      const index = accessoires.findIndex(a => a.id === id);
      if (index !== -1) {
        accessoires[index] = { ...accessoires[index], ...data, updated_at: new Date().toISOString() };
      }
      Toast.success('Accessoire modifié');
    } else {
      // Création
      data.id = 'acc_' + Date.now();
      data.created_at = new Date().toISOString();
      accessoires.push(data);
      Toast.success('Accessoire créé');
    }
    
    Storage.set('mistral_accessoires', accessoires);
    closeModal('accessoire');
    renderBoutique();
  }
  
  function editAccessoire(id) {
    const accessoires = Storage.get('mistral_accessoires', []);
    const accessoire = accessoires.find(a => a.id === id);
    if (!accessoire) return;

    $('#modal-accessoire-title').textContent = 'Modifier l\'accessoire';
    $('#accessoire-id').value = accessoire.id;
    $('#accessoire-nom').value = accessoire.nom || '';
    $('#accessoire-categorie').value = accessoire.categorie || 'accessoire';
    $('#accessoire-prix').value = accessoire.prix || '';
    $('#accessoire-stock').value = accessoire.stock ?? -1;
    $('#accessoire-description').value = accessoire.description || '';
    $('#accessoire-statut').value = accessoire.statut || 'actif';

    // Load configurator options
    const visibleConfig = accessoire.visible_configurateur || false;
    $('#accessoire-visible-config').checked = visibleConfig;
    toggleAccessoireConfigOptions(visibleConfig);

    // Load compatible sizes
    const tailles = accessoire.tailles_compatibles || [];
    $('#accessoire-taille-45').checked = tailles.includes('45');
    $('#accessoire-taille-50').checked = tailles.includes('50');
    $('#accessoire-taille-53').checked = tailles.includes('53');

    showModal('accessoire');

    // Initialiser l'upload et charger l'image existante
    initAccessoireUpload();
    loadAccessoireImageForEdit(accessoire);
  }

  function toggleAccessoireConfigOptions(show) {
    const optionsDiv = $('#accessoire-config-options');
    if (optionsDiv) {
      optionsDiv.style.display = show ? 'block' : 'none';
    }
  }

  function initAccessoireConfigToggle() {
    const checkbox = $('#accessoire-visible-config');
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        toggleAccessoireConfigOptions(checkbox.checked);
      });
    }
  }
  
  function toggleAccessoire(id) {
    const accessoires = Storage.get('mistral_accessoires', []);
    const index = accessoires.findIndex(a => a.id === id);
    if (index === -1) return;
    
    accessoires[index].statut = accessoires[index].statut === 'actif' ? 'masque' : 'actif';
    Storage.set('mistral_accessoires', accessoires);
    renderBoutique();
    Toast.info(accessoires[index].statut === 'actif' ? 'Accessoire affiché' : 'Accessoire masqué');
  }
  
  async function deleteAccessoire(id) {
    const confirmed = await Confirm.show({
      title: 'Supprimer l\'accessoire',
      message: 'Cette action est irréversible.',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      let accessoires = Storage.get('mistral_accessoires', []);
      accessoires = accessoires.filter(a => a.id !== id);
      Storage.set('mistral_accessoires', accessoires);
      renderBoutique();
      Toast.success('Accessoire supprimé');
    }
  }

  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    renderBoutique,
    renderBoutiqueInstruments,
    renderBoutiqueAccessoires,
    retirerDeBoutique,
    initBoutiqueInstrumentSelect,
    publierInstrumentSelectionne,
    creerEtPublierInstrument,
    initAccessoireUpload,
    saveAccessoire,
    editAccessoire,
    toggleAccessoire,
    deleteAccessoire,
    removeAccessoireImage
  });

  console.log('[admin-ui-boutique] Module chargé');

})(window);
