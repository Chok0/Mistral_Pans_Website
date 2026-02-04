/* ==========================================================================
   MISTRAL PANS - Admin UI - Module Modals
   Formulaires et modals de gestion
   ========================================================================== */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-modals] AdminUI non disponible, module différé');
    return;
  }

  const { $, $$, escapeHtml, formatPrice, formatDate, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers || {};

  // État local pour les uploads
  let instrumentImages = [];
  let instrumentVideo = null;


  function showModal(name) {
    const modal = $(`#modal-${name}`);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      
      // Reset du formulaire si nouveau
      const titleEl = modal.querySelector('.admin-modal__title');
      const idField = $(`#${name}-id`);
      if (idField && !idField.value) {
        const form = modal.querySelector('form');
        if (form) form.reset();
        
        // Titres par défaut
        const titles = {
          client: 'Nouveau client',
          instrument: 'Nouvel instrument',
          location: 'Nouvelle location',
          commande: 'Nouvelle commande',
          facture: 'Nouvelle facture',
          materiau: 'Nouveau matériau'
        };
        if (titleEl && titles[name]) {
          titleEl.textContent = titles[name];
        }
        
        // Initialisations spécifiques
        const today = new Date().toISOString().split('T')[0];
        
        if (name === 'facture') {
          // Initialiser les lignes de facture
          renderFactureLignes([]);
          updateFactureTotaux();
          // Date par défaut = aujourd'hui
          if ($('#facture-date')) {
            $('#facture-date').value = today;
            // Ajouter l'événement pour recalculer l'échéance
            $('#facture-date').onchange = updateFactureEcheance;
          }
          // Échéance par défaut = +30 jours
          updateFactureEcheance();
          // Reset client search
          if ($('#facture-client-search')) $('#facture-client-search').value = '';
          if ($('#facture-client-id')) $('#facture-client-id').value = '';
        }
        
        if (name === 'location') {
          if ($('#location-date-debut')) $('#location-date-debut').value = today;
          if ($('#location-client-search')) $('#location-client-search').value = '';
          if ($('#location-client-id')) $('#location-client-id').value = '';
          if ($('#location-instrument-search')) $('#location-instrument-search').value = '';
          if ($('#location-instrument-id')) $('#location-instrument-id').value = '';
        }
        
        if (name === 'commande') {
          if ($('#commande-date')) $('#commande-date').value = today;
          if ($('#commande-client-search')) $('#commande-client-search').value = '';
          if ($('#commande-client-id')) $('#commande-client-id').value = '';
        }
        
        if (name === 'instrument') {
          // Initialiser les uploads
          initInstrumentUploads();
          // Reset les previews
          clearInstrumentMediaPreviews();
        }
        
        if (name === 'accessoire') {
          // Initialiser l'upload d'image
          initAccessoireUpload();
          // Initialiser le toggle des options configurateur
          initAccessoireConfigToggle();
          // Reset config options
          $('#accessoire-visible-config').checked = false;
          toggleAccessoireConfigOptions(false);
          $('#accessoire-taille-45').checked = false;
          $('#accessoire-taille-50').checked = false;
          $('#accessoire-taille-53').checked = false;
        }
        
        if (name === 'media') {
          // Initialiser l'upload d'image/vidéo
          initMediaUpload();
          // Reset titre du modal
          $('#modal-media-title').textContent = 'Ajouter un média';
          $('#media-id').value = '';
          $('#form-media')?.reset();
        }
        
        if (name === 'article') {
          // Initialiser l'upload et l'éditeur
          initArticleUpload();
          // Reset titre du modal
          $('#modal-article-title').textContent = 'Nouvel article';
          $('#article-id').value = '';
          $('#form-article')?.reset();
        }

        if (name === 'materiau') {
          // Reset du formulaire
          $('#modal-materiau-title').textContent = 'Nouveau matériau';
          $('#materiau-id').value = '';
          $('#form-materiau')?.reset();
          // Valeurs par défaut
          $('#materiau-prix-malus').value = 0;
          $('#materiau-ordre').value = 1;
          $('#materiau-couleur').value = '#C9A227';
          $('#materiau-couleur-picker').value = '#C9A227';
          $('#materiau-disponible').checked = true;
          $('#materiau-visible-config').checked = true;
          // Sync color picker
          initMateriauColorSync();
        }

        if (name === 'instrument') {
          // Populate material select with dynamic options
          populateMateriauxSelect();
        }
      }

      // Focus premier champ
      setTimeout(() => {
        const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstInput) firstInput.focus();
      }, 100);
    }
  }

  function closeModal(name) {
    const modal = $(`#modal-${name}`);
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      
      // Reset ID caché
      const idField = $(`#${name}-id`);
      if (idField) idField.value = '';
    }
  }
  
  // Fermer modal avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.admin-modal-overlay.open');
      if (openModal) {
        const name = openModal.id.replace('modal-', '');
        closeModal(name);
      }
    }
  });

  // CRUD Clients
  function editClient(id) {
    if (typeof MistralGestion === 'undefined') return;
    const client = MistralGestion.Clients.get(id);
    if (!client) return;
    
    $('#modal-client-title').textContent = 'Modifier le client';
    $('#client-id').value = client.id;
    $('#client-prenom').value = client.prenom || '';
    $('#client-nom').value = client.nom || '';
    $('#client-email').value = client.email || '';
    $('#client-telephone').value = client.telephone || '';
    $('#client-adresse').value = client.adresse || '';
    $('#client-notes').value = client.notes || '';
    
    showModal('client');
  }
  
  async function deleteClient(id) {
    if (typeof MistralGestion === 'undefined') return;
    
    // Vérifier si le client a des factures associées
    const factures = MistralGestion.Factures.list().filter(f => f.client_id === id);
    
    if (factures.length > 0) {
      // Archiver au lieu de supprimer
      const confirmed = await Confirm.show({
        title: 'Archiver le client',
        message: `Ce client a ${factures.length} facture(s) associée(s).\n\nIl sera archivé (masqué des listes) mais ses données seront conservées.`,
        confirmText: 'Archiver',
        type: 'warning'
      });
      
      if (confirmed) {
        MistralGestion.Clients.update(id, { archived: true, archived_at: new Date().toISOString() });
        renderClients();
        refreshDashboard();
        Toast.info('Client archivé');
      }
    } else {
      // Suppression normale
      const confirmed = await Confirm.show({
        title: 'Supprimer le client',
        message: 'Ce client n\'a aucune facture associée. Il sera définitivement supprimé.',
        confirmText: 'Supprimer',
        type: 'danger'
      });
      
      if (confirmed) {
        MistralGestion.Clients.delete(id);
        renderClients();
        refreshDashboard();
        Toast.success('Client supprimé');
      }
    }
  }
  
  async function unarchiveClient(id) {
    if (typeof MistralGestion === 'undefined') return;
    
    MistralGestion.Clients.update(id, { archived: false, archived_at: null });
    renderClients();
    Toast.success('Client restauré');
  }
  
  function saveClient() {
    if (typeof MistralGestion === 'undefined') return;
    
    const id = $('#client-id')?.value;
    const data = {
      prenom: $('#client-prenom')?.value.trim(),
      nom: $('#client-nom')?.value.trim(),
      email: $('#client-email')?.value.trim(),
      telephone: $('#client-telephone')?.value.trim(),
      adresse: $('#client-adresse')?.value.trim(),
      notes: $('#client-notes')?.value.trim()
    };
    
    if (!data.prenom || !data.nom) {
      Toast.error('Prénom et nom requis');
      return;
    }
    
    let client;
    if (id) {
      client = MistralGestion.Clients.update(id, data);
      Toast.success('Client modifié');
    } else {
      client = MistralGestion.Clients.create(data);
      Toast.success('Client créé');
    }
    
    closeModal('client');
    renderClients();
    refreshDashboard();
    
    // Reset form
    $('#client-id').value = '';
    $('#modal-client-title').textContent = 'Nouveau client';
    $('#form-client').reset();
    
    // Si un callback est en attente (création depuis un autre modal)
    if (pendingClientCallback && client && !id) {
      pendingClientCallback(client);
      
      // Rouvrir le modal d'origine
      if (pendingClientModalSource) {
        showModalWithData(pendingClientModalSource);
        Toast.success(`Client créé et ajouté`);
      }
      
      // Reset
      pendingClientCallback = null;
      pendingClientModalSource = null;
    }
  }
  
  // Ouvre un modal sans réinitialiser les données
  function showModalWithData(name) {
    const modal = $(`#modal-${name}`);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  // CRUD Instruments
  function editInstrument(id) {
    if (typeof MistralGestion === 'undefined') return;
    const instrument = MistralGestion.Instruments.get(id);
    if (!instrument) return;
    
    $('#modal-instrument-title').textContent = 'Modifier l\'instrument';
    $('#instrument-id').value = instrument.id;
    $('#instrument-reference').value = instrument.reference || '';
    $('#instrument-numero').value = instrument.numero || '';
    $('#instrument-nom').value = instrument.nom || '';
    $('#instrument-tonalite').value = instrument.tonalite || '';
    $('#instrument-gamme').value = instrument.gamme || '';
    $('#instrument-notes').value = instrument.nombre_notes || 9;
    $('#instrument-taille').value = instrument.taille || '53';
    populateMateriauxSelect(instrument.materiau || 'NS');
    $('#instrument-accordage').value = instrument.accordage || '440';
    $('#instrument-prix').value = instrument.prix_vente || '';
    $('#instrument-statut').value = instrument.statut || 'disponible';
    $('#instrument-layout').value = instrument.notes_layout || '';
    $('#instrument-description').value = instrument.description || '';
    $('#instrument-handpaner').value = instrument.handpaner_url || '';
    $('#instrument-commentaires').value = instrument.commentaires || '';
    
    showModal('instrument');
    
    // Initialiser les uploads et charger les médias existants
    initInstrumentUploads();
    loadInstrumentMediaForEdit(instrument);
  }
  
  async function deleteInstrument(id) {
    if (typeof MistralGestion === 'undefined') return;
    
    // Vérifier si l'instrument est en location
    const locations = MistralGestion.Locations.list();
    const locationEnCours = locations.find(l => l.instrument_id === id && l.statut === 'en_cours');
    
    if (locationEnCours) {
      Toast.error('Impossible de supprimer : cet instrument est actuellement en location');
      return;
    }
    
    const confirmed = await Confirm.show({
      title: 'Supprimer l\'instrument',
      message: 'Cette action est irréversible. L\'annonce associée sera également supprimée.',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      // Supprimer l'annonce associée si elle existe
      if (typeof GestionBoutique !== 'undefined') {
        GestionBoutique.depublierInstrument(id);
      }
      
      // Supprimer l'instrument
      MistralGestion.Instruments.delete(id);
      renderInstruments();
      refreshDashboard();
      Toast.success('Instrument supprimé');
    }
  }
  
  // ============================================================================
  // UPLOADS D'INSTRUMENT
  // ============================================================================
  
  // Stockage temporaire des médias uploadés
  let instrumentUploadedImages = [];
  let instrumentUploadedVideo = null;
  let instrumentImageUploadInputs = [];
  let instrumentVideoUploadInput = null;
  
  function initInstrumentUploads() {
    if (typeof MistralUpload === 'undefined') {
      console.warn('[Admin UI] MistralUpload non disponible');
      return;
    }
    
    // Reset les données
    instrumentUploadedImages = [];
    instrumentUploadedVideo = null;
    
    // Conteneur pour les uploads d'images
    const imagesContainer = $('#instrument-images-upload');
    if (imagesContainer) {
      imagesContainer.innerHTML = '';
      
      // Créer le premier input d'upload d'image
      addImageUploadInput();
    }
    
    // Conteneur pour l'upload de vidéo
    const videoContainer = $('#instrument-video-upload');
    if (videoContainer) {
      videoContainer.innerHTML = '';
      
      instrumentVideoUploadInput = MistralUpload.createUploadInput({
        id: 'instrument-video-file',
        acceptType: 'video',
        onSelect: async (file) => {
          try {
            // Sauvegarder en IndexedDB
            const result = await MistralUpload.saveVideo(file, `instrument_video_${Date.now()}`);
            instrumentUploadedVideo = {
              type: 'indexeddb',
              key: result.key,
              name: file.name,
              size: file.size
            };
            
            // Afficher preview
            showVideoPreview(file);
            Toast.success('Vidéo chargée');
          } catch (e) {
            console.error('[Admin UI] Erreur upload vidéo:', e);
            Toast.error('Erreur lors du chargement de la vidéo');
          }
        }
      });
      
      videoContainer.appendChild(instrumentVideoUploadInput);
    }
  }
  
  function addImageUploadInput() {
    const container = $('#instrument-images-upload');
    if (!container || typeof MistralUpload === 'undefined') return;
    
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '0.5rem';
    
    const input = MistralUpload.createUploadInput({
      id: `instrument-image-file-${Date.now()}`,
      acceptType: 'image',
      onSelect: async (file) => {
        try {
          // Convertir en base64 pour stockage
          const compress = isCompressionEnabled('instrument');
          const base64 = await fileToBase64(file, compress, 'hero');
          const imageData = {
            type: 'base64',
            data: base64,
            name: file.name,
            size: file.size
          };
          
          instrumentUploadedImages.push(imageData);
          
          // Afficher preview
          addImagePreview(base64, instrumentUploadedImages.length - 1);
          
          // Ajouter un nouveau champ d'upload si c'était le dernier
          if (wrapper === container.lastElementChild) {
            addImageUploadInput();
          }
          
          Toast.success('Image ajoutée');
        } catch (e) {
          console.error('[Admin UI] Erreur upload image:', e);
          Toast.error('Erreur lors du chargement de l\'image');
        }
      }
    });
    
    wrapper.appendChild(input);
    container.appendChild(wrapper);
    instrumentImageUploadInputs.push(input);
  }
  
  /**
   * Convertit un fichier image en base64, avec compression optionnelle
   * @param {File} file - Fichier à convertir
   * @param {boolean} compress - Activer la compression WebP
   * @param {string} profile - Profil de compression: 'hero', 'standard', 'thumbnail', 'avatar'
   */
  async function fileToBase64(file, compress = false, profile = 'hero') {
    // Si compression activée et MistralUpload disponible
    if (compress && file.type.startsWith('image/') && typeof MistralUpload !== 'undefined') {
      try {
        const result = await MistralUpload.compressImageAdvanced(file, profile);
        console.log(`[fileToBase64] Compressé (${profile}): ${(file.size/1024).toFixed(1)}KB → ${(result.main.size/1024).toFixed(1)}KB (${result.format})`);
        return result.main.dataURL;
      } catch (e) {
        console.warn('[fileToBase64] Compression échouée, fallback:', e);
      }
    }
    
    // Lecture directe sans compression
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Vérifie si la compression est activée pour un formulaire
   */
  function isCompressionEnabled(formId) {
    const checkbox = document.querySelector(`#${formId}-compress, [data-compress-for="${formId}"]`);
    return checkbox ? checkbox.checked : false;
  }
  
  function addImagePreview(src, index) {
    const container = $('#instrument-images-preview');
    if (!container) return;
    
    const preview = document.createElement('div');
    preview.className = 'upload-preview-item';
    preview.dataset.index = index;
    preview.innerHTML = `
      <img src="${src}" alt="Preview">
      <button type="button" class="upload-preview-remove" onclick="AdminUI.removeInstrumentImage(${index})">×</button>
    `;
    container.appendChild(preview);
  }
  
  function removeInstrumentImage(index) {
    instrumentUploadedImages.splice(index, 1);
    
    // Re-render les previews
    const container = $('#instrument-images-preview');
    if (container) {
      container.innerHTML = '';
      instrumentUploadedImages.forEach((img, i) => {
        if (img.type === 'base64') {
          addImagePreview(img.data, i);
        } else if (img.type === 'url') {
          addImagePreview(img.url, i);
        }
      });
    }
  }
  
  function showVideoPreview(file) {
    const container = $('#instrument-video-preview');
    if (!container) return;
    
    container.innerHTML = `
      <div class="upload-preview-item upload-preview-video">
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--admin-surface); border-radius: 8px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          <div>
            <div style="font-weight: 500;">${escapeHtml(file.name)}</div>
            <div style="font-size: 0.8rem; color: var(--admin-text-muted);">${(file.size / 1024 / 1024).toFixed(1)} Mo</div>
          </div>
          <button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.removeInstrumentVideo()" style="margin-left: auto;">Supprimer</button>
        </div>
      </div>
    `;
  }
  
  function removeInstrumentVideo() {
    instrumentUploadedVideo = null;
    const container = $('#instrument-video-preview');
    if (container) container.innerHTML = '';
  }
  
  function clearInstrumentMediaPreviews() {
    instrumentUploadedImages = [];
    instrumentUploadedVideo = null;
    
    const imagesPreview = $('#instrument-images-preview');
    if (imagesPreview) imagesPreview.innerHTML = '';
    
    const videoPreview = $('#instrument-video-preview');
    if (videoPreview) videoPreview.innerHTML = '';
    
    // Reset URLs manuelles
    if ($('#instrument-images-urls')) $('#instrument-images-urls').value = '';
    if ($('#instrument-video-url')) $('#instrument-video-url').value = '';
  }
  
  // Charger les médias existants lors de l'édition
  function loadInstrumentMediaForEdit(instrument) {
    clearInstrumentMediaPreviews();
    
    // Charger les images existantes
    if (instrument.images && instrument.images.length > 0) {
      instrument.images.forEach((url, index) => {
        instrumentUploadedImages.push({
          type: 'url',
          url: url
        });
        addImagePreview(url, index);
      });
    }
    
    // Charger la vidéo existante
    if (instrument.video) {
      instrumentUploadedVideo = {
        type: 'url',
        url: instrument.video
      };
      
      const container = $('#instrument-video-preview');
      if (container) {
        container.innerHTML = `
          <div class="upload-preview-item upload-preview-video">
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--admin-surface); border-radius: 8px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              <div>
                <div style="font-weight: 500;">Vidéo existante</div>
                <div style="font-size: 0.8rem; color: var(--admin-text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(instrument.video)}</div>
              </div>
              <button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" onclick="AdminUI.removeInstrumentVideo()" style="margin-left: auto;">Supprimer</button>
            </div>
          </div>
        `;
      }
    }
  }
  
  // Récupérer les médias pour la sauvegarde
  function getInstrumentMediaForSave() {
    const images = [];
    const urlsText = $('#instrument-images-urls')?.value || '';
    
    // Ajouter les images uploadées
    instrumentUploadedImages.forEach(img => {
      if (img.type === 'base64') {
        images.push(img.data);
      } else if (img.type === 'url') {
        images.push(img.url);
      }
    });
    
    // Ajouter les URLs manuelles
    if (urlsText) {
      urlsText.split('\n').map(s => s.trim()).filter(s => s).forEach(url => {
        if (!images.includes(url)) {
          images.push(url);
        }
      });
    }
    
    // Vidéo
    let video = null;
    const videoUrl = $('#instrument-video-url')?.value?.trim();
    
    if (instrumentUploadedVideo) {
      if (instrumentUploadedVideo.type === 'indexeddb') {
        // Pour IndexedDB, on stocke la clé (à gérer différemment si besoin)
        video = `indexeddb:${instrumentUploadedVideo.key}`;
      } else if (instrumentUploadedVideo.type === 'url') {
        video = instrumentUploadedVideo.url;
      }
    } else if (videoUrl) {
      video = videoUrl;
    }
    
    return { images, video };
  }
  
  // Convertit un nombre en chiffres romains
  function toRoman(num) {
    const romans = [
      { value: 36, numeral: 'XXXVI' },
      { value: 35, numeral: 'XXXV' },
      { value: 34, numeral: 'XXXIV' },
      { value: 33, numeral: 'XXXIII' },
      { value: 32, numeral: 'XXXII' },
      { value: 31, numeral: 'XXXI' },
      { value: 30, numeral: 'XXX' },
      { value: 29, numeral: 'XXIX' },
      { value: 28, numeral: 'XXVIII' },
      { value: 27, numeral: 'XXVII' },
      { value: 26, numeral: 'XXVI' },
      { value: 25, numeral: 'XXV' },
      { value: 24, numeral: 'XXIV' },
      { value: 23, numeral: 'XXIII' },
      { value: 22, numeral: 'XXII' },
      { value: 21, numeral: 'XXI' },
      { value: 20, numeral: 'XX' },
      { value: 19, numeral: 'XIX' },
      { value: 18, numeral: 'XVIII' },
      { value: 17, numeral: 'XVII' },
      { value: 16, numeral: 'XVI' },
      { value: 15, numeral: 'XV' },
      { value: 14, numeral: 'XIV' },
      { value: 13, numeral: 'XIII' },
      { value: 12, numeral: 'XII' },
      { value: 11, numeral: 'XI' },
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 8, numeral: 'VIII' },
      { value: 7, numeral: 'VII' }
    ];
    for (const { value, numeral } of romans) {
      if (num >= value) return numeral;
    }
    return String(num);
  }
  
  // Met à jour la référence automatiquement
  function updateInstrumentReference() {
    const materiau = $('#instrument-materiau')?.value || 'NS';
    const tonalite = $('#instrument-tonalite')?.value || '';
    const gamme = $('#instrument-gamme')?.value || '';
    const notes = parseInt($('#instrument-notes')?.value) || 9;
    const numero = $('#instrument-numero')?.value || '';
    
    // Format: MP-HP-NS-D KURD IX-00102
    let ref = 'MP-HP';
    
    // Matériau (NS ou ES)
    ref += '-' + (materiau === 'ES' ? 'ES' : materiau === 'SS' ? 'SS' : 'NS');
    
    // Tonalité + Gamme + Notes en chiffres romains
    if (tonalite || gamme) {
      ref += '-';
      if (tonalite) ref += tonalite;
      if (gamme) ref += ' ' + gamme;
      ref += ' ' + toRoman(notes);
    }
    
    // Numéro
    if (numero) {
      ref += '-' + numero;
    }
    
    $('#instrument-reference').value = ref;
  }
  
  /**
   * Parse une URL Handpaner.com pour extraire les notes
   * Format URL: https://handpaner.com/#D/-A-A#-C-D-E-F-G-A-C_
   * 
   * Convention de notation Handpaner:
   * - NOTE/ = Ding (note centrale)
   * - (NOTE) = Bottom (note sous le Ding)
   * - NOTE = Note standard sur le cercle tonal
   * - [NOTE] = Mutant ou cyclope
   */
  function parseHandpanerUrl() {
    const url = $('#instrument-handpaner')?.value?.trim() || '';
    
    // Vérifier que c'est bien une URL Handpaner avec le format attendu
    if (!url.includes('handpaner.com/#') && !url.includes('handpaner.com/handpan/')) {
      return;
    }
    
    try {
      let hashPart = '';
      
      // Extraire la partie après le premier # 
      // Attention: les notes peuvent contenir des # (ex: A#), donc on doit reconstruire
      if (url.includes('#')) {
        const parts = url.split('#');
        hashPart = parts.slice(1).join('#'); // Rejoindre toutes les parties après le premier #
      }
      
      if (!hashPart) return;
      
      // Nettoyer le _ final si présent
      hashPart = hashPart.replace(/_$/, '');
      
      // Séparer le Ding des autres notes (le / sépare le Ding du reste)
      const slashIndex = hashPart.indexOf('/');
      if (slashIndex === -1) return;
      
      const dingPart = hashPart.substring(0, slashIndex); // Ex: "D" ou "C#2"
      const notesPart = hashPart.substring(slashIndex + 1); // Ex: "-A-A#-C-D-E-F-G-A-C"
      
      // Parser le Ding (note + octave optionnelle)
      let ding = '';
      let dingOctave = '';
      
      // Regex pour capturer la note (avec # ou b) et l'octave optionnelle
      const dingMatch = dingPart.match(/^([A-Ga-g][#b]?)(\d)?$/);
      if (dingMatch) {
        ding = dingMatch[1];
        if (dingMatch[2]) {
          dingOctave = dingMatch[2];
        }
      } else {
        ding = dingPart;
      }
      
      // Parser les notes - attention au format avec tirets
      // Le format est: -A-A#-C-D-E-F-G-A-C
      // On doit gérer les notes avec # et b correctement
      const notesArray = parseHandpanerNotes(notesPart);
      
      // Construire la chaîne de sortie avec la convention Handpaner
      let result = ding + (dingOctave ? dingOctave : '') + '/';
      
      // Ajouter les notes
      result += ' ' + notesArray.join(' ');
      
      // Remplir le champ notes_layout
      const layoutField = $('#instrument-layout');
      if (layoutField) {
        layoutField.value = result;
      }
      
      // Aussi remplir la tonalité si elle est vide
      const tonaliteField = $('#instrument-tonalite');
      if (tonaliteField && !tonaliteField.value && ding) {
        // Normaliser le ding pour correspondre aux options du select (majuscule, garder #)
        const normalizedDing = ding.charAt(0).toUpperCase() + ding.substring(1);
        // Trouver l'option correspondante
        const options = Array.from(tonaliteField.options);
        const match = options.find(opt => opt.value === normalizedDing || opt.value.toUpperCase() === normalizedDing.toUpperCase());
        if (match) {
          tonaliteField.value = match.value;
          updateInstrumentReference();
        }
      }
      
      // Mettre à jour le nombre de notes
      const notesField = $('#instrument-notes');
      if (notesField) {
        const totalNotes = notesArray.length + 1; // +1 pour le Ding
        if (totalNotes >= 7 && totalNotes <= 36) {
          notesField.value = totalNotes;
          updateInstrumentReference();
        }
      }
      
    } catch (e) {
      console.warn('[Admin UI] Erreur parsing URL Handpaner:', e);
    }
  }
  
  /**
   * Parse les notes depuis le format Handpaner
   * Input: "-A-A#-C-D-E-F-G-A-C" ou "(G#)-A-A#-C-D" (avec bottom)
   * Output: ['A', 'A#', 'C', 'D', 'E', 'F', 'G', 'A', 'C']
   */
  function parseHandpanerNotes(notesPart) {
    const notes = [];
    let i = 0;
    
    while (i < notesPart.length) {
      const char = notesPart[i];
      
      // Ignorer les tirets de séparation
      if (char === '-') {
        i++;
        continue;
      }
      
      // Bottom note entre parenthèses
      if (char === '(') {
        const endParen = notesPart.indexOf(')', i);
        if (endParen !== -1) {
          const bottomNote = notesPart.substring(i + 1, endParen);
          notes.push('(' + bottomNote + ')');
          i = endParen + 1;
          continue;
        }
      }
      
      // Mutant/cyclope entre crochets
      if (char === '[') {
        const endBracket = notesPart.indexOf(']', i);
        if (endBracket !== -1) {
          const mutantNote = notesPart.substring(i + 1, endBracket);
          notes.push('[' + mutantNote + ']');
          i = endBracket + 1;
          continue;
        }
      }
      
      // Note standard (lettre + optionnel # ou b + optionnel chiffre d'octave)
      if (/[A-Ga-g]/.test(char)) {
        let note = char.toUpperCase();
        i++;
        
        // Vérifier si # ou b suit
        if (i < notesPart.length && (notesPart[i] === '#' || notesPart[i] === 'b')) {
          note += notesPart[i];
          i++;
        }
        
        // Vérifier si un chiffre d'octave suit
        if (i < notesPart.length && /\d/.test(notesPart[i])) {
          note += notesPart[i];
          i++;
        }
        
        notes.push(note);
        continue;
      }
      
      // Caractère inconnu, avancer
      i++;
    }
    
    return notes;
  }
  
  function saveInstrument() {
    if (typeof MistralGestion === 'undefined') return;
    
    const id = $('#instrument-id')?.value;
    
    // Récupérer les médias (uploadés ou URLs)
    const media = getInstrumentMediaForSave();
    
    const data = {
      reference: $('#instrument-reference')?.value.trim(),
      numero: $('#instrument-numero')?.value.trim(),
      nom: $('#instrument-nom')?.value.trim(),
      tonalite: $('#instrument-tonalite')?.value,
      gamme: $('#instrument-gamme')?.value,
      nombre_notes: parseInt($('#instrument-notes')?.value) || 9,
      taille: $('#instrument-taille')?.value,
      materiau: $('#instrument-materiau')?.value,
      accordage: $('#instrument-accordage')?.value || '440',
      prix_vente: parseFloat($('#instrument-prix')?.value) || null,
      statut: $('#instrument-statut')?.value || 'disponible',
      notes_layout: $('#instrument-layout')?.value.trim(),
      description: $('#instrument-description')?.value.trim(),
      images: media.images,
      video: media.video,
      handpaner_url: $('#instrument-handpaner')?.value.trim(),
      commentaires: $('#instrument-commentaires')?.value.trim()
    };
    
    // Validation
    if (!data.numero) {
      Toast.error('Numéro de série requis');
      return;
    }
    
    if (!data.tonalite || !data.gamme) {
      Toast.error('Tonalité et gamme requis');
      return;
    }
    
    // Générer un nom par défaut si vide
    if (!data.nom) {
      data.nom = `${data.tonalite} ${data.gamme} ${data.nombre_notes} notes`;
    }
    
    let instrument;
    if (id) {
      instrument = MistralGestion.Instruments.update(id, data);
      
      // Mettre à jour l'annonce si elle existe
      if (typeof GestionBoutique !== 'undefined' && GestionBoutique.estPublie(id)) {
        GestionBoutique.mettreAJourAnnonce(id);
      }
      
      Toast.success('Instrument modifié');
    } else {
      instrument = MistralGestion.Instruments.create(data);
      Toast.success('Instrument créé');
    }
    
    closeModal('instrument');
    renderInstruments();
    refreshDashboard();
    
    // Reset
    $('#instrument-id').value = '';
    $('#modal-instrument-title').textContent = 'Nouvel instrument';
    $('#form-instrument').reset();
    $('#instrument-reference').value = '';
    
    // Si un callback est en attente (création depuis facture)
    if (pendingInstrumentCallback && instrument && !id) {
      // Récupérer l'instrument complet avec l'ID
      const createdInstrument = MistralGestion.Instruments.list().find(i => i.reference === data.reference) || instrument;
      pendingInstrumentCallback({
        id: createdInstrument.id,
        nom: createdInstrument.nom || data.nom,
        reference: createdInstrument.reference || data.reference,
        prix_vente: createdInstrument.prix_vente || data.prix_vente || 0
      });
      
      // Rouvrir le modal d'origine
      if (pendingInstrumentModalSource) {
        showModalWithData(pendingInstrumentModalSource);
        Toast.info(`Instrument ajouté à la facture`);
      }
      
      // Reset
      pendingInstrumentCallback = null;
      pendingInstrumentModalSource = null;
    }
    
    // Si on doit publier l'instrument après création (depuis boutique)
    if (publishAfterInstrumentCreation && instrument && !id) {
      // Récupérer l'instrument complet avec l'ID
      const createdInstrument = MistralGestion.Instruments.list().find(i => i.reference === data.reference) || instrument;
      
      // Vérifier qu'il a un prix
      if (createdInstrument.prix_vente && createdInstrument.prix_vente > 0) {
        MistralGestion.Instruments.update(createdInstrument.id, { statut: 'en_ligne' });
        renderBoutique();
        Toast.success('Instrument créé et publié dans la boutique');
      } else {
        Toast.info('Instrument créé. Ajoutez un prix pour le publier.');
      }
      
      publishAfterInstrumentCreation = false;
    }
  }

  // CRUD Locations
  function editLocation(id) {
    if (typeof MistralGestion === 'undefined') return;
    const location = MistralGestion.Locations.get(id);
    if (!location) return;
    
    $('#modal-location-title').textContent = 'Modifier la location';
    $('#location-id').value = location.id;
    
    // Client
    const client = MistralGestion.Clients.get(location.client_id);
    if (client) {
      $('#location-client-search').value = `${client.prenom} ${client.nom}`;
      $('#location-client-id').value = client.id;
    }
    
    // Instrument
    const instrument = MistralGestion.Instruments.get(location.instrument_id);
    if (instrument) {
      $('#location-instrument-search').value = instrument.nom;
      $('#location-instrument-id').value = instrument.id;
    }
    
    $('#location-date-debut').value = location.date_debut || '';
    $('#location-mode').value = location.mode_location || 'local';
    $('#location-loyer').value = location.loyer_mensuel || 50;
    $('#location-caution').value = location.montant_caution || 1150;
    $('#location-caution-statut').value = location.caution_statut || 'en_attente';
    $('#location-statut').value = location.statut || 'en_cours';
    $('#location-notes').value = location.notes || '';
    
    showModal('location');
  }
  
  function saveLocation() {
    if (typeof MistralGestion === 'undefined') return;
    
    const id = $('#location-id')?.value;
    const clientId = $('#location-client-id')?.value;
    const instrumentId = $('#location-instrument-id')?.value;
    
    if (!clientId || !instrumentId) {
      Toast.error('Client et instrument requis');
      return;
    }
    
    const data = {
      client_id: clientId,
      instrument_id: instrumentId,
      date_debut: $('#location-date-debut')?.value,
      mode_location: $('#location-mode')?.value || 'local',
      loyer_mensuel: parseFloat($('#location-loyer')?.value) || 50,
      montant_caution: parseFloat($('#location-caution')?.value) || 1150,
      caution_statut: $('#location-caution-statut')?.value || 'en_attente',
      statut: $('#location-statut')?.value || 'en_cours',
      notes: $('#location-notes')?.value.trim()
    };
    
    if (id) {
      MistralGestion.Locations.update(id, data);
      Toast.success('Location modifiée');
    } else {
      MistralGestion.Locations.create(data);
      // Mettre à jour le statut de l'instrument
      MistralGestion.Instruments.update(instrumentId, { statut: 'en_location' });
      Toast.success('Location créée');
    }
    
    closeModal('location');
    renderLocations();
    renderInstruments();
    refreshDashboard();
    
    // Reset
    $('#location-id').value = '';
    $('#location-client-id').value = '';
    $('#location-instrument-id').value = '';
    $('#modal-location-title').textContent = 'Nouvelle location';
    $('#form-location').reset();
  }

  // CRUD Commandes
  function editCommande(id) {
    if (typeof MistralGestion === 'undefined') return;
    const commande = MistralGestion.Commandes.get(id);
    if (!commande) return;
    
    $('#modal-commande-title').textContent = 'Modifier la commande';
    $('#commande-id').value = commande.id;
    
    // Client
    const client = MistralGestion.Clients.get(commande.client_id);
    if (client) {
      $('#commande-client-search').value = `${client.prenom} ${client.nom}`;
      $('#commande-client-id').value = client.id;
    }
    
    $('#commande-date').value = commande.date_commande || '';
    $('#commande-description').value = commande.description || '';
    $('#commande-montant').value = commande.montant_total || '';
    $('#commande-acompte').value = commande.acompte_verse || 0;
    $('#commande-paiement-statut').value = commande.statut_paiement || 'en_attente';
    $('#commande-statut').value = commande.statut || 'en_attente';
    $('#commande-notes').value = commande.notes || '';
    
    showModal('commande');
  }
  
  function saveCommande() {
    if (typeof MistralGestion === 'undefined') return;
    
    const id = $('#commande-id')?.value;
    const clientId = $('#commande-client-id')?.value;
    
    if (!clientId) {
      Toast.error('Client requis');
      return;
    }
    
    const data = {
      client_id: clientId,
      date_commande: $('#commande-date')?.value || new Date().toISOString().split('T')[0],
      description: $('#commande-description')?.value.trim(),
      montant_total: parseFloat($('#commande-montant')?.value) || 0,
      acompte_verse: parseFloat($('#commande-acompte')?.value) || 0,
      statut_paiement: $('#commande-paiement-statut')?.value || 'en_attente',
      statut: $('#commande-statut')?.value || 'en_attente',
      notes: $('#commande-notes')?.value.trim()
    };
    
    if (id) {
      MistralGestion.Commandes.update(id, data);
      Toast.success('Commande modifiée');
    } else {
      MistralGestion.Commandes.create(data);
      Toast.success('Commande créée');
    }
    
    closeModal('commande');
    renderCommandes();
    refreshDashboard();
    
    // Reset
    $('#commande-id').value = '';
    $('#commande-client-id').value = '';
    $('#modal-commande-title').textContent = 'Nouvelle commande';
    $('#form-commande').reset();
  }

  // CRUD Factures
  function editFacture(id) {
    if (typeof MistralGestion === 'undefined') return;
    const facture = MistralGestion.Factures.get(id);
    if (!facture) return;
    
    $('#modal-facture-title').textContent = 'Modifier la facture';
    $('#facture-id').value = facture.id;
    
    // Client
    const client = MistralGestion.Clients.get(facture.client_id);
    if (client) {
      $('#facture-client-search').value = `${client.prenom} ${client.nom}`;
      $('#facture-client-id').value = client.id;
    }
    
    $('#facture-date').value = facture.date_emission || '';
    $('#facture-type').value = facture.type || 'vente';
    $('#facture-paiement-statut').value = facture.statut_paiement || 'en_attente';
    $('#facture-echeance').value = facture.date_echeance || '';
    $('#facture-notes').value = facture.notes || '';
    
    // Lignes
    renderFactureLignes(facture.lignes || []);
    updateFactureTotaux();
    
    showModal('facture');
  }
  
  function saveFacture() {
    if (typeof MistralGestion === 'undefined') return;
    
    const id = $('#facture-id')?.value;
    const clientId = $('#facture-client-id')?.value;
    
    if (!clientId) {
      Toast.error('Client requis');
      return;
    }
    
    // Collecter les lignes
    const lignes = [];
    $$('#facture-lignes .facture-ligne').forEach(row => {
      const desc = row.querySelector('[name="ligne-desc"]')?.value.trim();
      const qte = parseInt(row.querySelector('[name="ligne-qte"]')?.value) || 1;
      const pu = parseFloat(row.querySelector('[name="ligne-pu"]')?.value) || 0;
      if (desc && pu > 0) {
        lignes.push({ description: desc, quantite: qte, prix_unitaire: pu });
      }
    });
    
    const montantHT = lignes.reduce((sum, l) => sum + (l.quantite * l.prix_unitaire), 0);
    
    const data = {
      client_id: clientId,
      date_emission: $('#facture-date')?.value || new Date().toISOString().split('T')[0],
      type: $('#facture-type')?.value || 'vente',
      lignes: lignes,
      montant_ht: montantHT,
      montant_ttc: montantHT, // Pas de TVA (auto-entrepreneur)
      statut_paiement: $('#facture-paiement-statut')?.value || 'en_attente',
      date_echeance: $('#facture-echeance')?.value || null,
      notes: $('#facture-notes')?.value.trim()
    };
    
    if (id) {
      MistralGestion.Factures.update(id, data);
      Toast.success('Facture modifiée');
    } else {
      MistralGestion.Factures.create(data);
      Toast.success('Facture créée');
    }
    
    closeModal('facture');
    renderFactures();
    refreshDashboard();
    
    // Reset
    $('#facture-id').value = '';
    $('#facture-client-id').value = '';
    $('#modal-facture-title').textContent = 'Nouvelle facture';
    $('#form-facture').reset();
    renderFactureLignes([]);
  }
  
  function addFactureLigne() {
    const container = $('#facture-lignes');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'facture-ligne';
    row.innerHTML = `
      <textarea name="ligne-desc" placeholder="Description" class="admin-form__input facture-ligne__desc" rows="1"></textarea>
      <input type="number" name="ligne-qte" value="1" min="1" class="admin-form__input" onchange="AdminUI.updateFactureTotaux()">
      <input type="number" name="ligne-pu" placeholder="P.U." min="0" step="0.01" class="admin-form__input" onchange="AdminUI.updateFactureTotaux()">
      <input type="text" name="ligne-total" readonly class="admin-form__input" style="background: var(--admin-border);">
      <button type="button" class="facture-ligne__remove" onclick="this.parentElement.remove(); AdminUI.updateFactureTotaux();">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    container.appendChild(row);
    
    // Auto-resize textarea
    const textarea = row.querySelector('textarea');
    textarea.addEventListener('input', autoResizeTextarea);
  }
  
  function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
  }
  
  function renderFactureLignes(lignes) {
    const container = $('#facture-lignes');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!lignes.length) {
      addFactureLigne();
      return;
    }
    
    lignes.forEach(l => {
      const row = document.createElement('div');
      row.className = 'facture-ligne';
      row.innerHTML = `
        <textarea name="ligne-desc" class="admin-form__input facture-ligne__desc" rows="1">${escapeHtml(l.description || '')}</textarea>
        <input type="number" name="ligne-qte" value="${l.quantite || 1}" min="1" class="admin-form__input" onchange="AdminUI.updateFactureTotaux()">
        <input type="number" name="ligne-pu" value="${l.prix_unitaire || 0}" min="0" step="0.01" class="admin-form__input" onchange="AdminUI.updateFactureTotaux()">
        <input type="text" name="ligne-total" readonly value="${formatPrice((l.quantite || 1) * (l.prix_unitaire || 0))}" class="admin-form__input" style="background: var(--admin-border);">
        <button type="button" class="facture-ligne__remove" onclick="this.parentElement.remove(); AdminUI.updateFactureTotaux();">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      container.appendChild(row);
      
      // Auto-resize textarea si contenu multiligne
      const textarea = row.querySelector('textarea');
      textarea.addEventListener('input', autoResizeTextarea);
      // Trigger initial resize
      if (l.description && l.description.includes('\n')) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
      }
    });
  }
  
  function updateFactureTotaux() {
    let total = 0;
    $$('#facture-lignes .facture-ligne').forEach(row => {
      const qte = parseInt(row.querySelector('[name="ligne-qte"]')?.value) || 0;
      const pu = parseFloat(row.querySelector('[name="ligne-pu"]')?.value) || 0;
      const ligneTotal = qte * pu;
      row.querySelector('[name="ligne-total"]').value = formatPrice(ligneTotal);
      total += ligneTotal;
    });
    
    $('#facture-total-ht').textContent = formatPrice(total);
    $('#facture-total-ttc').textContent = formatPrice(total);
  }
  
  function updateFactureEcheance() {
    const dateEmission = $('#facture-date')?.value;
    if (dateEmission) {
      const date = new Date(dateEmission);
      date.setDate(date.getDate() + 30); // +30 jours
      const echeance = date.toISOString().split('T')[0];
      if ($('#facture-echeance')) {
        $('#facture-echeance').value = echeance;
      }
    }
  }
  
  function downloadFacture(id) {
    if (typeof MistralGestionPDF !== 'undefined') {
      MistralGestionPDF.generateFacture(id);
    } else {
      Toast.error('Module PDF non chargé');
    }
  }
  
  function marquerPayee(id) {
    if (typeof MistralGestion !== 'undefined') {
      MistralGestion.Factures.update(id, { 
        statut_paiement: 'paye', 
        date_paiement: new Date().toISOString().split('T')[0] 
      });
      renderFactures();
      refreshDashboard();
      Toast.success('Facture marquée comme payée');
    }
  }
  
  /**
   * Envoyer une facture par email au client
   * 
   * TODO: À développer - Intégration email
   * ========================================
   * Options possibles pour l'envoi d'emails :
   * 
   * 1. API EmailJS (gratuit jusqu'à 200 emails/mois)
   *    - Pas besoin de backend
   *    - Configuration via dashboard EmailJS
   *    - https://www.emailjs.com/
   * 
   * 2. API Brevo (ex-Sendinblue) (gratuit jusqu'à 300 emails/jour)
   *    - API REST simple
   *    - Templates d'emails
   *    - https://www.brevo.com/
   * 
   * 3. Backend PHP avec mail() ou PHPMailer
   *    - Nécessite un serveur PHP
   *    - Plus de contrôle
   * 
   * 4. Ouvrir le client email local (mailto:)
   *    - Solution temporaire simple
   *    - Pas d'envoi automatique, mais pré-remplit l'email
   * 
   * Structure de l'email à envoyer :
   * - Destinataire : client.email
   * - Objet : "Facture {numero} - Mistral Pans"
   * - Corps : Message personnalisé + lien/pièce jointe PDF
   * - Pièce jointe : PDF de la facture (généré par gestion-pdf.js)
   */
  async function envoyerFactureMail(id) {
    if (typeof MistralGestion === 'undefined') return;
    
    const facture = MistralGestion.Factures.get(id);
    if (!facture) {
      Toast.error('Facture non trouvée');
      return;
    }
    
    const client = MistralGestion.Clients.get(facture.client_id);
    if (!client) {
      Toast.error('Client non trouvé');
      return;
    }
    
    if (!client.email) {
      Toast.error('Ce client n\'a pas d\'adresse email');
      return;
    }
    
    // Pour l'instant : ouvrir le client email local avec mailto:
    // TODO: Remplacer par un vrai envoi d'email via API
    const subject = encodeURIComponent(`Facture ${facture.numero} - Mistral Pans`);
    const body = encodeURIComponent(
      `Bonjour ${client.prenom},\n\n` +
      `Veuillez trouver ci-joint la facture ${facture.numero} d'un montant de ${formatPrice(facture.montant_ttc || facture.total || 0)}.\n\n` +
      `Date d'émission : ${formatDate(facture.date_emission || facture.date)}\n` +
      `Échéance : ${facture.date_echeance ? formatDate(facture.date_echeance) : 'À réception'}\n\n` +
      `Merci de votre confiance.\n\n` +
      `Cordialement,\n` +
      `Mistral Pans\n\n` +
      `---\n` +
      `Note : La facture PDF doit être jointe manuellement à cet email.\n` +
      `Téléchargez-la depuis l'interface d'administration.`
    );
    
    // Ouvrir le client email
    window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, '_blank');
    
    Toast.info('Client email ouvert - Pensez à joindre le PDF !');
    
    // TODO: Quand l'API email sera configurée :
    // 1. Générer le PDF en base64
    // 2. Appeler l'API d'envoi avec le PDF en pièce jointe
    // 3. Enregistrer la date d'envoi dans la facture
    // 4. Afficher un badge "Envoyée" dans la liste
  }
  
  async function annulerFacture(id) {
    const confirmed = await Confirm.show({
      title: 'Annuler la facture',
      message: 'Cette facture sera marquée comme annulée. Cette action est irréversible.',
      confirmText: 'Annuler la facture',
      type: 'danger'
    });
    
    if (confirmed && typeof MistralGestion !== 'undefined') {
      MistralGestion.Factures.update(id, { 
        statut: 'annulee',
        date_annulation: new Date().toISOString().split('T')[0]
      });
      renderFactures();
      refreshDashboard();
      Toast.info('Facture annulée');
    }
  }
  
  // Fonctions Location supplémentaires
  async function terminerLocation(id) {
    const confirmed = await Confirm.show({
      title: 'Terminer la location',
      message: 'Marquer cette location comme terminée et restituer la caution ?',
      confirmText: 'Terminer'
    });
    
    if (confirmed && typeof MistralGestion !== 'undefined') {
      const location = MistralGestion.Locations.get(id);
      
      MistralGestion.Locations.update(id, {
        statut: 'terminee',
        date_fin_effective: new Date().toISOString().split('T')[0],
        caution_statut: 'restituee'
      });
      
      // Remettre l'instrument en disponible
      if (location && location.instrument_id) {
        MistralGestion.Instruments.update(location.instrument_id, { statut: 'disponible' });
      }
      
      renderLocations();
      renderInstruments();
      refreshDashboard();
      Toast.success('Location terminée');
    }
  }
  
  function downloadContrat(id) {
    if (typeof MistralGestionPDF !== 'undefined') {
      MistralGestionPDF.generateContrat(id);
    } else {
      Toast.error('Module PDF non chargé');
    }
  }

  // Professeurs
  function approveTeacher(id) {
    const pending = Storage.get('mistral_pending_teachers', []);
    const teacher = pending.find(t => t.id === id);
    if (teacher) {
      const teachers = Storage.get('mistral_teachers', []);
      teachers.push(teacher);
      Storage.set('mistral_teachers', teachers);
      Storage.set('mistral_pending_teachers', pending.filter(t => t.id !== id));
      renderProfesseurs();
      refreshDashboard();
      Toast.success('Professeur approuvé');
    }
  }
  async function rejectTeacher(id) {
    const confirmed = await Confirm.show({
      title: 'Rejeter la demande',
      message: 'Cette demande sera supprimée.',
      confirmText: 'Rejeter',
      type: 'danger'
    });
    
    if (confirmed) {
      const pending = Storage.get('mistral_pending_teachers', []);
      Storage.set('mistral_pending_teachers', pending.filter(t => t.id !== id));
      renderProfesseurs();
      refreshDashboard();
      Toast.info('Demande rejetée');
    }
  }
  function editTeacher(id) {
    const teachers = Storage.get('mistral_teachers', []);
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) {
      Toast.error('Professeur non trouvé');
      return;
    }
    
    // Stocker l'ID du professeur en cours d'édition
    currentEditingTeacherId = id;
    
    // Ouvrir le modal
    showModal('professeur');
    
    // Générer le formulaire dans le modal
    const container = document.getElementById('edit-teacher-form-container');
    if (container && typeof TeacherForm !== 'undefined') {
      container.innerHTML = TeacherForm.generate({
        formId: 'edit-teacher-form',
        mode: 'edit',
        showPhoto: true,
        showRecaptcha: false
      });
      TeacherForm.init('edit-teacher-form');
      
      // Pré-remplir les champs
      setTimeout(() => {
        const form = document.getElementById('edit-teacher-form');
        if (form) {
          // Nom
          const nameInput = form.querySelector('[name="name"]') || form.querySelector('#edit-teacher-form-name');
          if (nameInput) nameInput.value = teacher.name || '';
          
          // Email
          const emailInput = form.querySelector('[name="email"]') || form.querySelector('#edit-teacher-form-email');
          if (emailInput) emailInput.value = teacher.email || '';
          
          // Téléphone
          const phoneInput = form.querySelector('[name="phone"]') || form.querySelector('#edit-teacher-form-phone');
          if (phoneInput) phoneInput.value = teacher.phone || '';
          
          // Site web
          const websiteInput = form.querySelector('[name="website"]') || form.querySelector('#edit-teacher-form-website');
          if (websiteInput) websiteInput.value = teacher.website || '';
          
          // Code postal
          const postalInput = form.querySelector('[name="postalcode"]') || form.querySelector('#edit-teacher-form-postalcode');
          if (postalInput) postalInput.value = teacher.postalcode || '';
          
          // Ville
          const cityInput = form.querySelector('[name="city"]') || form.querySelector('#edit-teacher-form-city');
          if (cityInput) cityInput.value = teacher.city || '';
          
          // Bio
          const bioInput = form.querySelector('[name="bio"]') || form.querySelector('#edit-teacher-form-bio');
          if (bioInput) bioInput.value = teacher.bio || '';
          
          // Photo preview
          if (teacher.photo) {
            const photoPreview = form.querySelector('.teacher-form__photo-preview img');
            if (photoPreview) {
              photoPreview.src = teacher.photo;
              photoPreview.style.display = 'block';
            }
          }
          
          // Types de cours (checkboxes)
          if (teacher.courseTypes) {
            teacher.courseTypes.forEach(type => {
              const checkbox = form.querySelector(`[name="courseTypes"][value="${type}"]`);
              if (checkbox) checkbox.checked = true;
            });
          }
          
          // Niveaux
          if (teacher.levels) {
            teacher.levels.forEach(level => {
              const checkbox = form.querySelector(`[name="levels"][value="${level}"]`);
              if (checkbox) checkbox.checked = true;
            });
          }
          
          // Modes d'enseignement
          if (teacher.modes) {
            teacher.modes.forEach(mode => {
              const checkbox = form.querySelector(`[name="modes"][value="${mode}"]`);
              if (checkbox) checkbox.checked = true;
            });
          }
        }
      }, 100);
    }
  }
  
  // Variable pour stocker l'ID du professeur en cours d'édition
  let currentEditingTeacherId = null;
  
  async function saveTeacher() {
    if (!currentEditingTeacherId) {
      Toast.error('Aucun professeur en cours d\'édition');
      return;
    }
    
    if (typeof TeacherForm === 'undefined') {
      Toast.error('Module TeacherForm non chargé');
      return;
    }
    
    // Valider le formulaire
    if (!TeacherForm.validate('edit-teacher-form')) {
      return;
    }

    // Collecter les données
    const data = TeacherForm.collect('edit-teacher-form');
    
    // Géocoder l'adresse si modifiée
    if (data.postalcode && data.city) {
      Toast.info('Géolocalisation en cours...');
      const coords = await TeacherForm.geocode(data.postalcode, data.city);
      data.lat = coords.lat;
      data.lng = coords.lng;
    }
    
    // Mettre à jour le professeur
    const teachers = Storage.get('mistral_teachers', []);
    const index = teachers.findIndex(t => t.id === currentEditingTeacherId);
    
    if (index !== -1) {
      teachers[index] = { 
        ...teachers[index], 
        ...data, 
        updated_at: new Date().toISOString() 
      };
      Storage.set('mistral_teachers', teachers);
      
      // Fermer le modal
      closeModal('professeur');
      
      // Rafraîchir l'affichage
      renderProfesseurs();
      
      // Reset
      currentEditingTeacherId = null;
      
      Toast.success(`${data.name} a été modifié(e)`);
    } else {
      Toast.error('Erreur lors de la sauvegarde');
    }
  }
  async function deleteTeacher(id) {
    const confirmed = await Confirm.show({
      title: 'Supprimer le professeur',
      message: 'Cette action est irréversible.',
      confirmText: 'Supprimer',
      type: 'danger'
    });
    
    if (confirmed) {
      const teachers = Storage.get('mistral_teachers', []);
      Storage.set('mistral_teachers', teachers.filter(t => t.id !== id));
      renderProfesseurs();
      Toast.success('Professeur supprimé');
    }
  }
  
  // Initialiser le formulaire d'ajout de professeur avec le composant TeacherForm
  function initAddTeacherForm() {
    const container = document.getElementById('add-teacher-form-container');
    if (container && typeof TeacherForm !== 'undefined') {
      container.innerHTML = TeacherForm.generate({
        formId: 'add-teacher-form',
        mode: 'add',
        showPhoto: true,
        showRecaptcha: false
      });
      TeacherForm.init('add-teacher-form');
    }
  }
  
  // Soumettre le formulaire d'ajout de professeur
  async function submitAddTeacherForm() {
    if (typeof TeacherForm === 'undefined') {
      Toast.error('Module TeacherForm non chargé');
      return;
    }
    
    // Valider le formulaire
    if (!TeacherForm.validate('add-teacher-form')) {
      return;
    }

    // Collecter les données
    const data = TeacherForm.collect('add-teacher-form');
    
    // Géocoder l'adresse
    if (data.postalcode && data.city) {
      Toast.info('Géolocalisation en cours...');
      const coords = await TeacherForm.geocode(data.postalcode, data.city);
      data.lat = coords.lat;
      data.lng = coords.lng;
    } else {
      // Coordonnées par défaut (Paris)
      data.lat = 48.8566;
      data.lng = 2.3522;
    }
    
    // Générer un ID unique
    data.id = 'teacher_' + Date.now();
    data.created_at = new Date().toISOString();
    
    // Ajouter aux professeurs actifs
    const teachers = Storage.get('mistral_teachers', []);
    teachers.push(data);
    Storage.set('mistral_teachers', teachers);
    
    // Reset le formulaire
    TeacherForm.reset('add-teacher-form');
    
    // Rafraîchir l'affichage
    renderProfesseurs();
    refreshDashboard();
    
    // Basculer vers l'onglet des professeurs actifs
    const activeTab = document.querySelector('[data-subtab="active"]');
    if (activeTab) activeTab.click();
    
    Toast.success(`${data.name} a été ajouté(e)`);
  }


  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    showModal,
    closeModal,
    editClient,
    saveClient,
    deleteClient,
    unarchiveClient,
    editInstrument,
    saveInstrument,
    deleteInstrument,
    updateInstrumentReference,
    parseHandpanerUrl,
    removeInstrumentImage,
    removeInstrumentVideo,
    editLocation,
    saveLocation,
    terminerLocation,
    downloadContrat,
    editCommande,
    saveCommande,
    editFacture,
    saveFacture,
    downloadFacture,
    envoyerFactureMail,
    marquerPayee,
    annulerFacture,
    addFactureLigne,
    addFactureLigneFromInstrument,
    updateFactureTotaux,
    approveTeacher,
    rejectTeacher,
    editTeacher,
    saveTeacher,
    deleteTeacher,
    submitAddTeacherForm
  });

  console.log('[admin-ui-modals] Module chargé');

})(window);
