/* MISTRAL PANS - Admin UI - Modals Instruments */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-modals-instruments] AdminUI non disponible, module différé');
    return;
  }

  const { $, $$, escapeHtml, formatPrice, formatDate, isValidEmail, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers;
  const { getModalState, clearModalState, showModal, closeModal, showModalWithData, withSaveGuard } = window.AdminUI;

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
    AdminUI.populateMateriauxSelect(instrument.materiau || 'NS');
    if (AdminUI.populateGammesSelect) AdminUI.populateGammesSelect(instrument.gamme || '');
    if (AdminUI.populateTaillesSelect) AdminUI.populateTaillesSelect(instrument.taille || '53');
    $('#instrument-accordage').value = instrument.accordage || '440';
    $('#instrument-prix').value = instrument.prix_vente || '';
    if ($('#instrument-prix-detail')) $('#instrument-prix-detail').style.display = 'none';
    if ($('#instrument-promo')) $('#instrument-promo').value = instrument.promo_percent || '';
    $('#instrument-statut').value = instrument.statut || 'disponible';
    if ($('#instrument-disponible-location')) $('#instrument-disponible-location').checked = !!instrument.disponible_location;
    $('#instrument-layout').value = instrument.notes_layout || '';
    $('#instrument-description').value = instrument.description || '';
    $('#instrument-handpaner').value = instrument.handpaner_url || '';
    $('#instrument-commentaires').value = instrument.commentaires || '';

    showModal('instrument');

    // Régénérer la référence si absente
    if (!instrument.reference && AdminUI.updateInstrumentReference) {
      AdminUI.updateInstrumentReference();
    }

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
      // Supprimer l'instrument (et sa ligne Supabase)
      MistralGestion.Instruments.delete(id);
      AdminUI.renderInstruments();
      AdminUI.refreshDashboard();
      Toast.success('Instrument supprimé');
    }
  }

  /**
   * Lance le processus de vente d'un instrument
   * Ouvre le modal de facture pré-rempli avec l'instrument
   * @param {string} id - ID de l'instrument à vendre
   */
  async function vendreInstrument(id) {
    if (typeof MistralGestion === 'undefined') return;

    const instrument = MistralGestion.Instruments.get(id);
    if (!instrument) {
      Toast.error('Instrument non trouvé');
      return;
    }

    // Vérifier que l'instrument peut être vendu
    const statutsVendables = ['disponible', 'en_ligne', 'reserve'];
    if (!statutsVendables.includes(instrument.statut)) {
      Toast.error(`Impossible de vendre : statut actuel "${instrument.statut}"`);
      return;
    }

    // Vérifier qu'il n'est pas en location
    const locations = MistralGestion.Locations.list();
    const locationEnCours = locations.find(l => l.instrument_id === id && l.statut === 'en_cours');
    if (locationEnCours) {
      Toast.error('Impossible de vendre : cet instrument est actuellement en location');
      return;
    }

    // Stocker l'instrument pour la vente (scopé au modal facture)
    getModalState('facture').instrumentEnVente = instrument;

    // Ouvrir le modal de facture
    showModal('facture');

    // Configurer le modal pour la vente
    $('#modal-facture-title').textContent = 'Facturer la vente';
    $('#facture-type').value = 'vente';

    // Pré-remplir avec l'instrument
    setTimeout(() => {
      // Vider les lignes existantes
      if (AdminUI.renderFactureLignes) AdminUI.renderFactureLignes([]);

      // Ajouter l'instrument comme ligne
      if (AdminUI.addFactureLigneFromInstrument) AdminUI.addFactureLigneFromInstrument(id);

      Toast.info('Sélectionnez le client pour finaliser la vente');
    }, 100);
  }

  /**
   * Finalise la vente après paiement de la facture
   * Met à jour le statut de l'instrument à 'vendu'
   * @param {string} instrumentId - ID de l'instrument vendu
   */
  function finaliserVenteInstrument(instrumentId) {
    if (typeof MistralGestion === 'undefined') return;

    const instrument = MistralGestion.Instruments.get(instrumentId);
    if (!instrument) return;

    // Mettre à jour le statut
    MistralGestion.Instruments.update(instrumentId, {
      statut: 'vendu',
      date_vente: new Date().toISOString().split('T')[0]
    });

    // Rafraîchir les affichages
    if (AdminUI.renderInstruments) AdminUI.renderInstruments();
    if (AdminUI.renderBoutique) AdminUI.renderBoutique();
    if (AdminUI.refreshDashboard) AdminUI.refreshDashboard();

    Toast.success('Instrument marqué comme vendu');
  }

  // ============================================================================
  // UPLOADS D'INSTRUMENT
  // ============================================================================

  function initInstrumentUploads() {
    if (typeof MistralUpload === 'undefined') {
      return;
    }

    // Reset les données (scopé au modal instrument)
    const instState = getModalState('instrument');
    instState.uploadedImages = [];
    instState.uploadedVideo = null;
    instState.imageInputs = [];
    instState.videoInput = null;
    instState.images = [];
    instState.video = null;

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

      instState.videoInput = MistralUpload.createUploadInput({
        id: 'instrument-video-file',
        acceptType: 'video',
        onSelect: async (file) => {
          try {
            // Sauvegarder en IndexedDB via saveVideoFromFile
            const result = await MistralUpload.saveVideoFromFile(file, `instrument_video_${Date.now()}`);
            getModalState('instrument').uploadedVideo = {
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

      videoContainer.appendChild(instState.videoInput);
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

          const instImages = getModalState('instrument').uploadedImages;
          instImages.push(imageData);

          // Afficher preview
          addImagePreview(base64, instImages.length - 1);

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
    const instInputs = getModalState('instrument').imageInputs;
    if (instInputs) instInputs.push(input);
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
        return result.main.dataURL;
      } catch (e) {
        if (window.MISTRAL_DEBUG) console.warn('[fileToBase64] Compression échouée, fallback:', e);
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
      <button type="button" class="upload-preview-remove" data-action="remove-instrument-image" data-param="${index}">×</button>
    `;
    container.appendChild(preview);
  }

  function removeInstrumentImage(index) {
    const uploadedImages = getModalState('instrument').uploadedImages || [];
    uploadedImages.splice(index, 1);

    // Re-render les previews
    const container = $('#instrument-images-preview');
    if (container) {
      container.innerHTML = '';
      uploadedImages.forEach((img, i) => {
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
          <button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" data-action="remove-instrument-video" style="margin-left: auto;">Supprimer</button>
        </div>
      </div>
    `;
  }

  function removeInstrumentVideo() {
    getModalState('instrument').uploadedVideo = null;
    const container = $('#instrument-video-preview');
    if (container) container.innerHTML = '';
  }

  function clearInstrumentMediaPreviews() {
    const instState = getModalState('instrument');
    instState.uploadedImages = [];
    instState.uploadedVideo = null;

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
    const instState = getModalState('instrument');
    if (instrument.images && instrument.images.length > 0) {
      instrument.images.forEach((url, index) => {
        instState.uploadedImages.push({
          type: 'url',
          url: url
        });
        addImagePreview(url, index);
      });
    }

    // Charger la vidéo existante
    const existingVideo = instrument.video_url || instrument.video;
    if (existingVideo) {
      instState.uploadedVideo = {
        type: 'url',
        url: existingVideo
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
                <div style="font-size: 0.8rem; color: var(--admin-text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(existingVideo)}</div>
              </div>
              <button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" data-action="remove-instrument-video" style="margin-left: auto;">Supprimer</button>
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
    const instState = getModalState('instrument');

    // Ajouter les images uploadées
    (instState.uploadedImages || []).forEach(img => {
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

    if (instState.uploadedVideo) {
      if (instState.uploadedVideo.type === 'indexeddb') {
        // Pour IndexedDB, on stocke la clé (à gérer différemment si besoin)
        video = `indexeddb:${instState.uploadedVideo.key}`;
      } else if (instState.uploadedVideo.type === 'url') {
        video = instState.uploadedVideo.url;
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
      promo_percent: parseInt($('#instrument-promo')?.value) || null,
      statut: $('#instrument-statut')?.value || 'disponible',
      disponible_location: $('#instrument-disponible-location')?.checked || false,
      notes_layout: $('#instrument-layout')?.value.trim(),
      description: $('#instrument-description')?.value.trim(),
      images: media.images,
      video_url: media.video,
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
    try {
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
    } catch (e) {
      Toast.error(e.message);
      return;
    }

    closeModal('instrument');
    AdminUI.renderInstruments();
    AdminUI.refreshDashboard();

    // Reset
    $('#instrument-id').value = '';
    $('#modal-instrument-title').textContent = 'Nouvel instrument';
    $('#form-instrument').reset();
    $('#instrument-reference').value = '';
    if ($('#instrument-prix-detail')) $('#instrument-prix-detail').style.display = 'none';

    // Si un callback est en attente (création depuis facture)
    const instState = getModalState('instrument');
    if (instState.pendingCallback && instrument && !id) {
      // Récupérer l'instrument complet avec l'ID
      const createdInstrument = MistralGestion.Instruments.list().find(i => i.reference === data.reference) || instrument;
      instState.pendingCallback({
        id: createdInstrument.id,
        nom: createdInstrument.nom || data.nom,
        reference: createdInstrument.reference || data.reference,
        prix_vente: createdInstrument.prix_vente || data.prix_vente || 0
      });

      // Rouvrir le modal d'origine
      if (instState.pendingSource) {
        showModalWithData(instState.pendingSource);
        Toast.info(`Instrument ajouté à la facture`);
      }

      // Reset
      instState.pendingCallback = null;
      instState.pendingSource = null;
    }

    // Si on doit publier l'instrument après création (depuis boutique)
    if (AdminUI.shouldPublishAfterCreation && AdminUI.shouldPublishAfterCreation() && instrument && !id) {
      // Récupérer l'instrument complet avec l'ID
      const createdInstrument = MistralGestion.Instruments.list().find(i => i.reference === data.reference) || instrument;

      // Vérifier qu'il a un prix
      if (createdInstrument.prix_vente && createdInstrument.prix_vente > 0) {
        MistralGestion.Instruments.update(createdInstrument.id, { statut: 'en_ligne' });
        AdminUI.renderBoutique();
        Toast.success('Instrument créé et publié dans la boutique');
      } else {
        Toast.info('Instrument créé. Ajoutez un prix pour le publier.');
      }

      AdminUI.resetPublishAfterCreation();
    }
  }

  // ============================================================================
  // CALCUL AUTOMATIQUE DU PRIX
  // ============================================================================

  // Constantes pour le parsing des notes (meme logique que boutique.js)
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLATS_MAP = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };

  function normalizeNoteStr(noteStr) {
    for (const [flat, sharp] of Object.entries(FLATS_MAP)) {
      if (noteStr.startsWith(flat)) return noteStr.replace(flat, sharp);
    }
    return noteStr;
  }

  function parseNoteToken(noteStr) {
    noteStr = normalizeNoteStr(noteStr);
    const match = noteStr.match(/^([A-G]#?)(\d)?$/);
    if (!match) return null;
    return { note: match[1], octave: match[2] ? parseInt(match[2]) : null };
  }

  /**
   * Parse un layout d'instrument au format Handpaner/Mistral
   * Ex: "D3/ (G3) A3 Bb3 C4 D4 E4 F4 G4 A4"
   * Ex: "D/(G)-A-Bb-C-D-E-F-G-A_"
   * Retourne un tableau d'objets { note, octave, type }
   */
  function parseLayoutForPricing(layout) {
    if (!layout || !layout.trim()) return null;

    layout = layout.replace(/_$/, '').replace(/\s+/g, ' ').trim();

    // Detecter le format : avec "/" (ding explicite) ou sans
    const slashIndex = layout.indexOf('/');
    if (slashIndex === -1) {
      // Format simple: "D3 A3 Bb3 C4 D4 E4 F4 G4 A4" (toutes notes avec octave)
      return parseSimpleLayout(layout);
    }

    // Format Handpaner: "D3/..notes.." ou "D/..notes.."
    return parseHandpanerLayout(layout, slashIndex);
  }

  /** Parse un layout simple ou toutes les notes ont leur octave explicite */
  function parseSimpleLayout(layout) {
    const tokens = layout.split(/[\s\-]+/).filter(t => t.length > 0);
    const notes = [];

    tokens.forEach((token, i) => {
      let type = 'tonal';
      let noteStr = token;

      if (token.startsWith('(') && token.endsWith(')')) {
        type = 'bottom';
        noteStr = token.slice(1, -1);
      } else if (token.startsWith('[') && token.endsWith(']')) {
        type = 'mutant';
        noteStr = token.slice(1, -1);
      }

      // Premier token = ding
      if (i === 0) type = 'ding';

      const parsed = parseNoteToken(noteStr);
      if (parsed) {
        notes.push({ note: parsed.note, octave: parsed.octave || 3, type });
      }
    });

    return notes.length > 0 ? notes : null;
  }

  /** Parse un layout format Handpaner avec Ding/ et auto-increment des octaves */
  function parseHandpanerLayout(layout, slashIndex) {
    const notes = [];

    // Extraire le ding
    const dingStr = layout.substring(0, slashIndex).trim();
    const dingParsed = parseNoteToken(dingStr);
    if (!dingParsed) return null;

    const rootNote = dingParsed.note;
    const rootOctave = dingParsed.octave || 3;

    notes.push({ note: rootNote, octave: rootOctave, type: 'ding' });

    // Tokeniser la partie notes
    const notesPart = layout.substring(slashIndex + 1).trim();
    const tokens = [];
    let current = '';
    let inParens = false;
    let inBrackets = false;

    for (let i = 0; i < notesPart.length; i++) {
      const char = notesPart[i];
      if (char === '(') {
        if (current.trim()) tokens.push(current.trim());
        current = '('; inParens = true;
      } else if (char === ')') {
        current += ')'; tokens.push(current.trim()); current = ''; inParens = false;
      } else if (char === '[') {
        if (current.trim()) tokens.push(current.trim());
        current = '['; inBrackets = true;
      } else if (char === ']') {
        current += ']'; tokens.push(current.trim()); current = ''; inBrackets = false;
      } else if ((char === '-' || char === ' ') && !inParens && !inBrackets) {
        if (current.trim()) tokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    const rootIndex = NOTE_NAMES.indexOf(rootNote);
    let tonalOctave = rootOctave;
    let lastTonalIndex = rootIndex;
    let isFirstTonal = true;
    let bottomOctave = rootOctave;

    tokens.filter(t => t.length > 0).forEach(token => {
      let type = 'tonal';
      let noteStr = token;

      if (token.startsWith('(') && token.endsWith(')')) {
        type = 'bottom'; noteStr = token.slice(1, -1);
      } else if (token.startsWith('[') && token.endsWith(']')) {
        type = 'mutant'; noteStr = token.slice(1, -1);
      }

      const parsed = parseNoteToken(noteStr);
      if (!parsed) return;

      let noteOctave = parsed.octave;
      const noteIndex = NOTE_NAMES.indexOf(parsed.note);

      if (noteOctave === null) {
        if (type === 'tonal' || type === 'mutant') {
          if (isFirstTonal) { isFirstTonal = false; }
          else if (noteIndex <= lastTonalIndex) { tonalOctave++; }
          noteOctave = tonalOctave;
          lastTonalIndex = noteIndex;
        } else {
          noteOctave = bottomOctave;
        }
      } else {
        if (type === 'tonal' || type === 'mutant') {
          tonalOctave = noteOctave; lastTonalIndex = noteIndex; isFirstTonal = false;
        } else { bottomOctave = noteOctave; }
      }

      notes.push({ note: parsed.note, octave: noteOctave, type });
    });

    return notes.length > 1 ? notes : null;
  }

  /**
   * Calcule le prix automatique d'un instrument a partir du layout + taille
   * Meme formule que le configurateur public (boutique.js)
   */
  function autoPriceInstrument() {
    const layout = $('#instrument-layout')?.value?.trim();
    const size = $('#instrument-taille')?.value || '53';

    if (!layout) {
      Toast.error('Remplissez le champ Layout pour calculer le prix');
      return;
    }

    // 1. Parser le layout
    const notes = parseLayoutForPricing(layout);
    if (!notes || notes.length === 0) {
      Toast.error('Layout invalide — verifiez le format des notes');
      return;
    }

    // 2. Recuperer la config de tarification
    const pricing = typeof MistralUtils !== 'undefined' && MistralUtils.getTarifsPublics
      ? MistralUtils.getTarifsPublics()
      : { prixParNote: 115, bonusOctave2: 50, bonusBottoms: 25, malusDifficulteWarning: 5, malusDifficulteDifficile: 10 };

    // 3. Calculer les composantes du prix
    let basePrice = 0;
    let octave2Bonus = 0;
    let octave2Count = 0;
    let hasBottom = false;

    notes.forEach(n => {
      basePrice += pricing.prixParNote;
      if (n.octave === 2) { octave2Bonus += pricing.bonusOctave2; octave2Count++; }
      if (n.type === 'bottom') hasBottom = true;
    });

    const bottomsBonus = hasBottom ? pricing.bonusBottoms : 0;

    // 4. Malus taille
    const sizeMalus = typeof MistralTailles !== 'undefined' && MistralTailles.getSizeMalusEur
      ? MistralTailles.getSizeMalusEur(size) : 0;

    // 5. Faisabilite → malus difficulte
    let feasStatus = 'ok';
    if (typeof FeasibilityModule !== 'undefined' && FeasibilityModule.checkFeasibility) {
      const result = FeasibilityModule.checkFeasibility(notes, size);
      feasStatus = result.status;
    }

    let difficultyPercent = 0;
    if (feasStatus === 'warning') difficultyPercent = pricing.malusDifficulteWarning;
    else if (feasStatus === 'difficult') difficultyPercent = pricing.malusDifficulteDifficile;

    const subtotal = basePrice + octave2Bonus + bottomsBonus + sizeMalus;
    const difficultyAmount = subtotal * (difficultyPercent / 100);
    const rawPrice = subtotal + difficultyAmount;
    const finalPrice = Math.floor(rawPrice / 5) * 5;

    // 6. Remplir le champ prix
    $('#instrument-prix').value = finalPrice;

    // 7. Afficher le detail
    const detail = $('#instrument-prix-detail');
    if (detail) {
      const parts = [];
      parts.push(`${notes.length} notes × ${pricing.prixParNote}€ = ${basePrice}€`);
      if (octave2Count > 0) parts.push(`octave 2 : +${octave2Bonus}€ (${octave2Count}×${pricing.bonusOctave2}€)`);
      if (hasBottom) parts.push(`bottoms : +${bottomsBonus}€`);
      if (sizeMalus > 0) parts.push(`taille ${size}cm : +${sizeMalus}€`);
      if (difficultyPercent > 0) parts.push(`difficulté (${feasStatus}) : +${difficultyPercent}%`);
      detail.textContent = parts.join(' · ');
      detail.style.display = 'block';
    }

    Toast.success(`Prix calculé : ${formatPrice(finalPrice)}`);
  }

  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    editInstrument,
    saveInstrument: withSaveGuard('instrument', saveInstrument),
    deleteInstrument,
    vendreInstrument,
    finaliserVenteInstrument,
    updateInstrumentReference,
    parseHandpanerUrl,
    autoPriceInstrument,
    initInstrumentUploads,
    clearInstrumentMediaPreviews,
    removeInstrumentImage,
    removeInstrumentVideo,
    fileToBase64,
    isCompressionEnabled
  });

})(window);
