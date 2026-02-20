/* ==========================================================================
   MISTRAL PANS - Module Upload Images
   Solution hybride : IndexedDB en local, Supabase Storage en production
   ========================================================================== */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CONFIG = {
    // Images
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10 Mo
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

    // Profils de compression
    PROFILES: {
      hero: {
        maxWidth: 1920,
        quality: 0.88,
        thumbWidth: 600
      },
      standard: {
        maxWidth: 1400,
        quality: 0.82,
        thumbWidth: 400
      },
      thumbnail: {
        maxWidth: 800,
        quality: 0.75,
        thumbWidth: 300
      },
      avatar: {
        maxWidth: 400,
        quality: 0.80,
        thumbWidth: 150
      }
    },

    // Profil par defaut
    DEFAULT_PROFILE: 'standard',

    // Legacy (retrocompatibilite)
    MAX_WIDTH: 1400,
    THUMB_WIDTH: 400,
    WEBP_QUALITY: 0.82,
    JPEG_QUALITY: 0.88,

    // Videos (local uniquement — production via YouTube)
    MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100 Mo
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],

    // Supabase Storage
    STORAGE_BUCKET: 'galerie',

    // IndexedDB
    IDB_NAME: 'MistralGallery',
    IDB_VERSION: 2,
    IDB_STORE: 'images',
    IDB_VIDEO_STORE: 'videos',

    // Format de sortie prefere
    OUTPUT_FORMAT: 'webp' // 'webp' ou 'jpeg'
  };

  // Tous les types acceptes
  const ALL_ALLOWED_TYPES = [...CONFIG.ALLOWED_IMAGE_TYPES, ...CONFIG.ALLOWED_VIDEO_TYPES];

  // ============================================================================
  // DETECTION ENVIRONNEMENT
  // ============================================================================

  function isLocalhost() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
  }

  // ============================================================================
  // COMPRESSION D'IMAGE (Canvas API)
  // ============================================================================

  /**
   * Charge une image depuis un fichier
   */
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Impossible de charger l\'image'));
      };
      img.src = objectUrl;
    });
  }

  /**
   * Redimensionne une image avec Canvas
   */
  function resizeImage(img, maxWidth) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let width = img.width;
    let height = img.height;

    if (width > maxWidth) {
      height = Math.round(height * (maxWidth / width));
      width = maxWidth;
    }

    canvas.width = width;
    canvas.height = height;

    // Fond blanc pour les PNG avec transparence
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(img, 0, 0, width, height);

    return canvas;
  }

  /**
   * Detecte si le navigateur supporte WebP
   */
  let webpSupported = null;
  function supportsWebP() {
    if (webpSupported !== null) return webpSupported;

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    if (window.MISTRAL_DEBUG) console.log('[Upload] Support WebP:', webpSupported);
    return webpSupported;
  }

  /**
   * Obtient le format et la qualite optimaux
   */
  function getOptimalFormat() {
    if (CONFIG.OUTPUT_FORMAT === 'webp' && supportsWebP()) {
      return { mimeType: 'image/webp', quality: CONFIG.WEBP_QUALITY, ext: 'webp' };
    }
    return { mimeType: 'image/jpeg', quality: CONFIG.JPEG_QUALITY, ext: 'jpg' };
  }

  /**
   * Convertit un canvas en Blob (WebP si supporte, sinon JPEG)
   */
  function canvasToBlob(canvas, quality = null) {
    const format = getOptimalFormat();
    const q = quality || format.quality;

    return new Promise((resolve) => {
      canvas.toBlob(resolve, format.mimeType, q);
    });
  }

  /**
   * Convertit un canvas en Data URL (WebP si supporte, sinon JPEG)
   */
  function canvasToDataURL(canvas, quality = null) {
    const format = getOptimalFormat();
    const q = quality || format.quality;

    return canvas.toDataURL(format.mimeType, q);
  }

  /**
   * Compresse une image avec options avancees
   * @param {File} file - Fichier image
   * @param {Object|string} options - Options ou nom de profil ('hero', 'standard', 'thumbnail', 'avatar')
   * @returns {Promise<Object>} - Images compressees
   */
  async function compressImageAdvanced(file, options = {}) {
    if (typeof options === 'string') {
      options = { profile: options };
    }

    const profileName = options.profile || CONFIG.DEFAULT_PROFILE;
    const profile = CONFIG.PROFILES[profileName] || CONFIG.PROFILES.standard;

    const {
      maxWidth = profile.maxWidth,
      thumbWidth = profile.thumbWidth,
      quality = profile.quality,
      forceWebP = true
    } = options;

    if (!CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Format image non supporte. Utilisez JPG, PNG, WebP ou GIF.');
    }

    if (file.size > CONFIG.MAX_IMAGE_SIZE) {
      throw new Error('Image trop volumineuse (max 10 Mo).');
    }

    const img = await loadImage(file);

    const format = getOptimalFormat();
    const q = quality;


    const mainCanvas = resizeImage(img, maxWidth);
    const mainBlob = await canvasToBlob(mainCanvas, q);
    const mainDataURL = canvasToDataURL(mainCanvas, q);

    const thumbCanvas = resizeImage(img, thumbWidth);
    const thumbBlob = await canvasToBlob(thumbCanvas, q);
    const thumbDataURL = canvasToDataURL(thumbCanvas, q);

    URL.revokeObjectURL(img.src);

    const compressionRatio = ((1 - mainBlob.size / file.size) * 100).toFixed(1);

    return {
      main: {
        blob: mainBlob,
        dataURL: mainDataURL,
        width: mainCanvas.width,
        height: mainCanvas.height,
        size: mainBlob.size
      },
      thumb: {
        blob: thumbBlob,
        dataURL: thumbDataURL,
        width: thumbCanvas.width,
        height: thumbCanvas.height,
        size: thumbBlob.size
      },
      format: format.ext,
      profile: profileName,
      originalSize: file.size,
      compressedSize: mainBlob.size,
      compressionRatio: parseFloat(compressionRatio)
    };
  }

  /**
   * Compresse une image (wrapper retrocompatibilite)
   */
  async function compressImage(file) {
    return compressImageAdvanced(file);
  }


  /**
   * Genere une miniature a partir d'une video
   */
  async function generateVideoThumbnail(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        const scale = CONFIG.THUMB_WIDTH / video.videoWidth;
        canvas.width = CONFIG.THUMB_WIDTH;
        canvas.height = video.videoHeight * scale;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const thumbnailDataURL = canvas.toDataURL('image/jpeg', 0.8);

        URL.revokeObjectURL(video.src);

        resolve({
          dataURL: thumbnailDataURL,
          width: canvas.width,
          height: canvas.height,
          duration: video.duration
        });
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Impossible de lire la video'));
      };

      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Prepare une video pour l'upload
   */
  async function prepareVideo(file) {
    if (!CONFIG.ALLOWED_VIDEO_TYPES.includes(file.type)) {
      throw new Error('Format video non supporte. Utilisez MP4 ou WebM.');
    }

    if (file.size > CONFIG.MAX_VIDEO_SIZE) {
      throw new Error('Video trop volumineuse (max 100 Mo).');
    }

    const thumbnail = await generateVideoThumbnail(file);

    return {
      file: file,
      thumbnail: thumbnail,
      originalName: file.name
    };
  }

  /**
   * Detecte le type de fichier
   */
  function getFileType(file) {
    if (CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) return 'image';
    if (CONFIG.ALLOWED_VIDEO_TYPES.includes(file.type)) return 'video';
    return null;
  }

  // ============================================================================
  // INDEXEDDB (STOCKAGE LOCAL)
  // ============================================================================

  let dbInstance = null;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }

      const request = indexedDB.open(CONFIG.IDB_NAME, CONFIG.IDB_VERSION);

      request.onerror = () => reject(new Error('Erreur IndexedDB'));

      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(CONFIG.IDB_STORE)) {
          db.createObjectStore(CONFIG.IDB_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(CONFIG.IDB_VIDEO_STORE)) {
          db.createObjectStore(CONFIG.IDB_VIDEO_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  async function saveToIndexedDB(id, mainDataURL, thumbDataURL) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFIG.IDB_STORE], 'readwrite');
      const store = transaction.objectStore(CONFIG.IDB_STORE);

      const data = {
        id: id,
        main: mainDataURL,
        thumb: thumbDataURL,
        createdAt: new Date().toISOString()
      };

      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(new Error('Erreur sauvegarde IndexedDB'));
    });
  }

  async function saveVideoToIndexedDB(id, videoBlob, thumbDataURL, duration) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFIG.IDB_VIDEO_STORE], 'readwrite');
      const store = transaction.objectStore(CONFIG.IDB_VIDEO_STORE);

      const data = {
        id: id,
        video: videoBlob,
        thumb: thumbDataURL,
        duration: duration,
        createdAt: new Date().toISOString()
      };

      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(new Error('Erreur sauvegarde video IndexedDB'));
    });
  }

  async function getFromIndexedDB(id) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFIG.IDB_STORE], 'readonly');
      const store = transaction.objectStore(CONFIG.IDB_STORE);

      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Erreur lecture IndexedDB'));
    });
  }

  async function deleteFromIndexedDB(id) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFIG.IDB_STORE], 'readwrite');
      const store = transaction.objectStore(CONFIG.IDB_STORE);

      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Erreur suppression IndexedDB'));
    });
  }

  // ============================================================================
  // UPLOAD SUPABASE STORAGE
  // ============================================================================

  /**
   * Recupere le client Supabase initialise
   */
  function getSupabaseClient() {
    if (window.MistralDB && window.MistralDB.getClient) {
      return window.MistralDB.getClient();
    }
    return null;
  }

  /**
   * Genere un chemin unique pour le Storage
   * Format: handpan-2026-02-07T18-30-00-abc12345.webp
   */
  function generateStoragePath(prefix, ext) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const random = Math.random().toString(36).substr(2, 8);
    return `${prefix}-${timestamp}-${random}.${ext}`;
  }

  /**
   * Upload un blob vers Supabase Storage
   * @param {Blob} blob - Le fichier a uploader
   * @param {string} filePath - Chemin dans le bucket
   * @param {string} contentType - MIME type
   * @returns {Promise<{ path: string, publicUrl: string }>}
   */
  async function uploadToStorage(blob, filePath, contentType) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase non disponible. Verifiez votre connexion admin.');
    }

    const { data, error } = await client.storage
      .from(CONFIG.STORAGE_BUCKET)
      .upload(filePath, blob, {
        contentType: contentType,
        cacheControl: '31536000', // 1 an
        upsert: false
      });

    if (error) {
      console.error('[Upload] Erreur Supabase Storage:', error);
      throw new Error('Erreur upload: ' + error.message);
    }

    // Recuperer l'URL publique
    const { data: urlData } = client.storage
      .from(CONFIG.STORAGE_BUCKET)
      .getPublicUrl(data.path);

    if (!urlData || !urlData.publicUrl) {
      throw new Error('Impossible de generer l\'URL publique pour ' + data.path);
    }

    return {
      path: data.path,
      publicUrl: urlData.publicUrl
    };
  }

  /**
   * Upload image principale + miniature vers Supabase Storage
   *
   * @param {Blob} mainBlob - Image compressee principale
   * @param {Blob} thumbBlob - Miniature compressee
   * @returns {Promise<{ src: string, thumbnail: string, storagePath: string }>}
   */
  async function uploadToServer(mainBlob, thumbBlob) {
    const format = getOptimalFormat();
    const mainPath = generateStoragePath('handpan', format.ext);
    const thumbPath = 'thumbs/' + mainPath;

    // Upload image principale
    const mainResult = await uploadToStorage(mainBlob, mainPath, format.mimeType);

    // Upload miniature (fallback sur image principale si echec)
    let thumbUrl = mainResult.publicUrl;
    try {
      const thumbResult = await uploadToStorage(thumbBlob, thumbPath, format.mimeType);
      thumbUrl = thumbResult.publicUrl;
    } catch (e) {
      if (window.MISTRAL_DEBUG) console.warn('[Upload] Miniature non uploadee, fallback sur image principale:', e.message);
    }

    return {
      src: mainResult.publicUrl,
      thumbnail: thumbUrl,
      storagePath: mainResult.path
    };
  }

  /**
   * Supprime un fichier de Supabase Storage
   * Accepte un path relatif ou une URL publique complete
   *
   * @param {string} srcOrPath - URL publique ou chemin relatif dans le bucket
   */
  async function deleteFromServer(srcOrPath) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase non disponible');
    }

    // Extraire le path relatif depuis l'URL publique si necessaire
    // URL type: https://xxx.supabase.co/storage/v1/object/public/galerie/handpan-2026-...webp
    let storagePath = srcOrPath;
    const bucketMarker = '/object/public/' + CONFIG.STORAGE_BUCKET + '/';
    if (srcOrPath.includes(bucketMarker)) {
      storagePath = srcOrPath.split(bucketMarker).pop();
    }

    // Supprimer l'image principale
    const { error } = await client.storage
      .from(CONFIG.STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error('[Upload] Erreur suppression:', error);
      throw new Error('Erreur suppression: ' + error.message);
    }

    // Essayer aussi de supprimer la miniature (thumbs/...)
    try {
      await client.storage
        .from(CONFIG.STORAGE_BUCKET)
        .remove(['thumbs/' + storagePath]);
    } catch (e) {
      // Pas grave si la miniature n'existe pas
    }

    return true;
  }

  // ============================================================================
  // API PUBLIQUE (HYBRIDE)
  // ============================================================================

  /**
   * Upload une image (auto-detecte local/production)
   */
  async function uploadImage(file, onProgress = null) {
    // Compresser cote client d'abord
    if (onProgress) onProgress(10, 'Compression...');
    const compressed = await compressImage(file);

    if (isLocalhost()) {
      // MODE LOCAL : IndexedDB
      if (onProgress) onProgress(50, 'Sauvegarde locale...');

      const id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await saveToIndexedDB(id, compressed.main.dataURL, compressed.thumb.dataURL);

      if (onProgress) onProgress(100, 'Termine');

      return {
        id: id,
        type: 'image',
        src: compressed.main.dataURL,
        thumbnail: compressed.thumb.dataURL,
        width: compressed.main.width,
        height: compressed.main.height,
        isLocal: true
      };
    } else {
      // MODE PRODUCTION : Supabase Storage
      if (onProgress) onProgress(30, 'Envoi vers Supabase...');

      const result = await uploadToServer(compressed.main.blob, compressed.thumb.blob);

      if (onProgress) onProgress(100, 'Termine');

      return {
        id: null, // L'ID sera genere par Galerie.create()
        type: 'image',
        src: result.src,
        thumbnail: result.thumbnail,
        width: compressed.main.width,
        height: compressed.main.height,
        isLocal: false,
        storagePath: result.storagePath
      };
    }
  }

  /**
   * Upload une video (local uniquement — en production, utiliser YouTube)
   */
  async function uploadVideo(file, onProgress = null) {
    if (onProgress) onProgress(10, 'Preparation video...');
    const prepared = await prepareVideo(file);

    if (isLocalhost()) {
      // MODE LOCAL : IndexedDB
      if (onProgress) onProgress(50, 'Sauvegarde locale...');

      const id = 'local_video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      const videoBlob = new Blob([file], { type: file.type });
      await saveVideoToIndexedDB(id, videoBlob, prepared.thumbnail.dataURL, prepared.thumbnail.duration);

      const videoURL = URL.createObjectURL(videoBlob);

      if (onProgress) onProgress(100, 'Termine');

      return {
        id: id,
        type: 'video',
        src: videoURL,
        thumbnail: prepared.thumbnail.dataURL,
        duration: prepared.thumbnail.duration,
        isLocal: true,
        localBlob: videoBlob
      };
    } else {
      // MODE PRODUCTION : Les videos passent par YouTube
      throw new Error('Upload video non disponible en production. Utilisez YouTube et ajoutez le lien dans la galerie.');
    }
  }

  /**
   * Upload un media (detecte automatiquement image ou video)
   */
  async function uploadMedia(file, onProgress = null) {
    const fileType = getFileType(file);

    if (fileType === 'image') {
      return uploadImage(file, onProgress);
    } else if (fileType === 'video') {
      return uploadVideo(file, onProgress);
    } else {
      throw new Error('Format de fichier non supporte');
    }
  }

  /**
   * Supprime une image (IndexedDB ou Supabase Storage)
   */
  async function deleteImage(mediaItem) {
    if (mediaItem.isLocal || (mediaItem.src && mediaItem.src.startsWith('data:'))) {
      // Suppression IndexedDB
      if (mediaItem.id) {
        await deleteFromIndexedDB(mediaItem.id);
      }
    } else if (mediaItem.src) {
      // Suppression Supabase Storage (accepte storagePath ou URL publique)
      await deleteFromServer(mediaItem.storagePath || mediaItem.src);
    }
    return true;
  }

  /**
   * Recupere l'URL d'une image (resout les DataURL locales)
   */
  async function getImageURL(mediaItem) {
    if (mediaItem.src && mediaItem.src.startsWith('data:')) {
      return mediaItem.src;
    }

    if (mediaItem.isLocal && mediaItem.id) {
      const stored = await getFromIndexedDB(mediaItem.id);
      if (stored) {
        return stored.main;
      }
    }

    return mediaItem.src;
  }

  /**
   * Recupere l'URL de la miniature
   */
  async function getThumbnailURL(mediaItem) {
    if (mediaItem.thumbnail && mediaItem.thumbnail.startsWith('data:')) {
      return mediaItem.thumbnail;
    }

    if (mediaItem.isLocal && mediaItem.id) {
      const stored = await getFromIndexedDB(mediaItem.id);
      if (stored) {
        return stored.thumb;
      }
    }

    return mediaItem.thumbnail || mediaItem.src;
  }

  // ============================================================================
  // HELPER: SAVE VIDEO FROM FILE (pour usage direct hors pipeline upload)
  // ============================================================================

  /**
   * Sauvegarde un fichier video dans IndexedDB avec generation auto de thumbnail.
   * Utilisé par le modal instrument pour l'upload vidéo local.
   *
   * @param {File} file - Fichier video (mp4, webm)
   * @param {string} key - Clé de stockage IndexedDB
   * @returns {Promise<{key: string, thumbnail: string, duration: number}>}
   */
  async function saveVideoFromFile(file, key) {
    if (!CONFIG.ALLOWED_VIDEO_TYPES.includes(file.type)) {
      throw new Error('Format video non supporté. Utilisez MP4 ou WebM.');
    }
    if (file.size > CONFIG.MAX_VIDEO_SIZE) {
      throw new Error('Video trop volumineuse (max 100 Mo).');
    }

    // Générer thumbnail + durée
    const thumbInfo = await generateVideoThumbnail(file);

    // Sauvegarder dans IndexedDB
    const videoBlob = new Blob([file], { type: file.type });
    await saveVideoToIndexedDB(key, videoBlob, thumbInfo.dataURL, thumbInfo.duration);

    return {
      key: key,
      thumbnail: thumbInfo.dataURL,
      duration: thumbInfo.duration
    };
  }

  // ============================================================================
  // COMPOSANT UI : INPUT FILE AMELIORE
  // ============================================================================

  function createUploadInput(options = {}) {
    const {
      id = 'media-upload',
      accept = 'image/jpeg,image/png,image/webp,video/mp4,video/webm',
      acceptType = 'all', // 'all', 'image', 'video'
      multiple = false,
      onSelect = null,
      onUpload = null,
      onError = null
    } = options;

    let acceptAttr = accept;
    let helpText = 'JPG, PNG, WebP, MP4, WebM';
    let maxSizeText = '10 Mo images / 100 Mo videos';

    if (acceptType === 'image') {
      acceptAttr = 'image/jpeg,image/png,image/webp';
      helpText = 'JPG, PNG ou WebP';
      maxSizeText = 'max 10 Mo';
    } else if (acceptType === 'video') {
      acceptAttr = 'video/mp4,video/webm';
      helpText = 'MP4 ou WebM';
      maxSizeText = 'max 100 Mo';
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'upload-input';
    wrapper.innerHTML = `
      <input type="file" id="${id}" accept="${acceptAttr}" ${multiple ? 'multiple' : ''} class="upload-input__file">
      <label for="${id}" class="upload-input__label">
        <div class="upload-input__icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div class="upload-input__text">
          <strong>Cliquer pour selectionner</strong>
          <span>${helpText} (${maxSizeText})</span>
        </div>
      </label>
      <div class="upload-input__preview" style="display:none;">
        <img alt="Preview" class="upload-input__preview-img" style="display:none;">
        <video class="upload-input__preview-video" style="display:none;" muted></video>
        <div class="upload-input__preview-play" style="display:none;">&#9654;</div>
        <button type="button" class="upload-input__remove" title="Supprimer">&times;</button>
      </div>
      <div class="upload-input__progress" style="display:none;">
        <div class="upload-input__progress-bar"></div>
        <span class="upload-input__progress-text">0%</span>
      </div>
    `;

    const fileInput = wrapper.querySelector('input[type="file"]');
    const label = wrapper.querySelector('.upload-input__label');
    const preview = wrapper.querySelector('.upload-input__preview');
    const previewImg = wrapper.querySelector('.upload-input__preview-img');
    const previewVideo = wrapper.querySelector('.upload-input__preview-video');
    const previewPlay = wrapper.querySelector('.upload-input__preview-play');
    const removeBtn = wrapper.querySelector('.upload-input__remove');
    const progressWrap = wrapper.querySelector('.upload-input__progress');
    const progressBar = wrapper.querySelector('.upload-input__progress-bar');
    const progressText = wrapper.querySelector('.upload-input__progress-text');

    let selectedFile = null;
    let selectedType = null;

    fileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Multiple mode: pass all files to onSelect, skip built-in preview
      if (multiple && files.length >= 1) {
        // Validate all files first
        for (const file of files) {
          const fileType = getFileType(file);
          if (!fileType) {
            if (onError) onError('Format non supporte: ' + file.name);
            return;
          }
          if (fileType === 'image' && file.size > CONFIG.MAX_IMAGE_SIZE) {
            if (onError) onError('Image trop volumineuse (max 10 Mo): ' + file.name);
            return;
          }
          if (fileType === 'video' && file.size > CONFIG.MAX_VIDEO_SIZE) {
            if (onError) onError('Video trop volumineuse (max 100 Mo): ' + file.name);
            return;
          }
        }
        if (onSelect) onSelect(files);
        fileInput.value = '';
        return;
      }

      // Single file mode (original behavior)
      const file = files[0];
      const fileType = getFileType(file);

      if (!fileType) {
        if (onError) onError('Format non supporte');
        return;
      }

      if (fileType === 'image' && file.size > CONFIG.MAX_IMAGE_SIZE) {
        if (onError) onError('Image trop volumineuse (max 10 Mo)');
        return;
      }

      if (fileType === 'video' && file.size > CONFIG.MAX_VIDEO_SIZE) {
        if (onError) onError('Video trop volumineuse (max 100 Mo)');
        return;
      }

      selectedFile = file;
      selectedType = fileType;

      label.style.display = 'none';
      preview.style.display = 'block';

      if (fileType === 'image') {
        previewImg.style.display = 'block';
        previewVideo.style.display = 'none';
        previewPlay.style.display = 'none';

        const reader = new FileReader();
        reader.onload = (ev) => {
          previewImg.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        previewImg.style.display = 'none';
        previewVideo.style.display = 'block';
        previewPlay.style.display = 'flex';

        previewVideo.src = URL.createObjectURL(file);
        previewVideo.onloadedmetadata = () => {
          previewVideo.currentTime = Math.min(1, previewVideo.duration / 2);
        };
      }

      if (onSelect) onSelect(file, fileType);
    });

    removeBtn.addEventListener('click', () => {
      reset();
    });

    function reset() {
      if (previewVideo.src) {
        URL.revokeObjectURL(previewVideo.src);
      }
      selectedFile = null;
      selectedType = null;
      fileInput.value = '';
      preview.style.display = 'none';
      progressWrap.style.display = 'none';
      label.style.display = 'flex';
      previewImg.src = '';
      previewVideo.src = '';
    }

    wrapper.getFile = () => selectedFile;
    wrapper.getType = () => selectedType;

    wrapper.upload = async () => {
      if (!selectedFile) {
        throw new Error('Aucun fichier selectionne');
      }

      label.style.display = 'none';
      preview.style.display = 'none';
      progressWrap.style.display = 'flex';

      try {
        const result = await uploadMedia(selectedFile, (percent, text) => {
          progressBar.style.setProperty('--progress', percent + '%');
          progressText.textContent = text || (percent + '%');
        });

        if (onUpload) onUpload(result);

        reset();

        return result;
      } catch (error) {
        progressWrap.style.display = 'none';
        preview.style.display = 'block';
        if (onError) onError(error.message);
        throw error;
      }
    };

    wrapper.reset = reset;

    return wrapper;
  }

  // ============================================================================
  // STYLES
  // ============================================================================

  function injectStyles() {
    if (document.getElementById('upload-input-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'upload-input-styles';
    styles.textContent = `
      .upload-input {
        position: relative;
      }

      .upload-input__file {
        position: absolute;
        width: 0;
        height: 0;
        opacity: 0;
        pointer-events: none;
      }

      .upload-input__label {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 2rem;
        border: 2px dashed var(--admin-border, #3a3735);
        border-radius: var(--admin-radius-md, 8px);
        background: var(--admin-surface, #1a1815);
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
      }

      .upload-input__label:hover {
        border-color: var(--admin-accent, #0D7377);
        background: var(--admin-surface-hover, #242220);
      }

      .upload-input__icon {
        color: var(--admin-text-muted, #a8a5a0);
      }

      .upload-input__text {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .upload-input__text strong {
        color: var(--admin-text, #f5f3ef);
        font-size: 0.9375rem;
      }

      .upload-input__text span {
        color: var(--admin-text-muted, #a8a5a0);
        font-size: 0.8125rem;
      }

      .upload-input__preview {
        position: relative;
        border-radius: var(--admin-radius-md, 8px);
        overflow: hidden;
        background: var(--admin-bg, #0f0e0d);
      }

      .upload-input__preview img,
      .upload-input__preview video {
        display: block;
        width: 100%;
        max-height: 200px;
        object-fit: contain;
      }

      .upload-input__preview-play {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 48px;
        height: 48px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.25rem;
        pointer-events: none;
      }

      .upload-input__remove {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 1.25rem;
        line-height: 1;
        cursor: pointer;
        transition: background 0.2s;
      }

      /* Touch target 44px via pseudo-element (WCAG 2.5.5) */
      .upload-input__remove::after {
        content: '';
        position: absolute;
        inset: -8px;
      }

      .upload-input__remove:hover {
        background: var(--admin-error, #e74c3c);
      }

      .upload-input__progress {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: var(--admin-surface, #1a1815);
        border-radius: var(--admin-radius-md, 8px);
      }

      .upload-input__progress-bar {
        flex: 1;
        height: 6px;
        background: var(--admin-border, #3a3735);
        border-radius: 3px;
        overflow: hidden;
        position: relative;
      }

      .upload-input__progress-bar::after {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        width: var(--progress, 0%);
        background: var(--admin-accent, #0D7377);
        transition: width 0.3s;
      }

      .upload-input__progress-text {
        color: var(--admin-text-muted, #a8a5a0);
        font-size: 0.8125rem;
        min-width: 80px;
        text-align: right;
      }
    `;
    document.head.appendChild(styles);
  }

  // Injecter les styles au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles);
  } else {
    injectStyles();
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.MistralUpload = {
    // Configuration
    CONFIG,

    // Detection
    isLocalhost,
    getFileType,
    supportsWebP,

    // Compression / Preparation
    compressImage,
    compressImageAdvanced,
    prepareVideo,
    generateVideoThumbnail,

    // Upload/Delete
    uploadImage,
    uploadVideo,
    uploadMedia,
    deleteImage,
    saveVideoFromFile,

    // URLs
    getImageURL,
    getThumbnailURL,

    // UI
    createUploadInput,

    // IndexedDB (pour debug)
    _idb: {
      open: openDatabase,
      save: saveToIndexedDB,
      saveVideo: saveVideoToIndexedDB,
      get: getFromIndexedDB,
      delete: deleteFromIndexedDB
    }
  };

})(window);
