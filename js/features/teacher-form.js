/* ==========================================================================
   MISTRAL PANS - Teacher Form Component
   Composant de formulaire rÃ©utilisable pour la gestion des professeurs
   ========================================================================== */

(function(window) {
  'use strict';

  /**
   * GÃ©nÃ¨re le HTML du formulaire de professeur complet
   * @param {Object} options - Options de configuration
   * @param {Object} options.teacher - DonnÃ©es du professeur (pour Ã©dition)
   * @param {string} options.formId - ID du formulaire
   * @param {string} options.mode - 'add', 'edit', ou 'signup' (demande d'adhÃ©sion)
   * @param {boolean} options.showPhoto - Afficher le champ photo
   * @param {boolean} options.showHoneypot - Ajouter champ honeypot anti-spam
   * @returns {string} HTML du formulaire
   */
  function generateTeacherForm(options = {}) {
    const {
      teacher = null,
      formId = 'teacher-form',
      mode = 'add',
      showPhoto = true,
      showHoneypot = true
    } = options;

    const isEdit = mode === 'edit' && teacher;
    const isSignup = mode === 'signup';
    
    // Helper pour rÃ©cupÃ©rer les valeurs
    const val = (field, defaultVal = '') => {
      if (!teacher) return defaultVal;
      return teacher[field] || defaultVal;
    };
    
    // Helper pour vÃ©rifier les checkboxes
    const isChecked = (field, value) => {
      if (!teacher || !teacher[field]) return false;
      return Array.isArray(teacher[field]) 
        ? teacher[field].includes(value)
        : teacher[field] === value;
    };

    // Helper pour escape HTML
    const escape = (str) => {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };

    return `
      <form id="${formId}" class="teacher-form">
        ${showPhoto ? `
        <!-- Photo de profil -->
        <div class="teacher-form__section">
          <p class="teacher-form__section-title">Photo de profil</p>
          <div class="teacher-form__photo-upload">
            <div class="teacher-form__photo-preview" id="${formId}-photo-preview">
              ${teacher && teacher.photo 
                ? `<img src="${escape(teacher.photo)}" alt="Photo de profil">`
                : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>`
              }
            </div>
            <div class="teacher-form__photo-actions">
              <button type="button" class="btn btn--secondary btn--sm" onclick="TeacherForm.triggerPhotoUpload('${formId}')">
                ${teacher && teacher.photo ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              <span class="teacher-form__photo-hint">RecommandÃ© : 300Ã—300px, format carrÃ©</span>
            </div>
            <input type="file" id="${formId}-photo-input" name="photo" accept="image/*" style="display:none;">
            <input type="hidden" id="${formId}-photo-data" name="photoData" value="${teacher && teacher.photo ? escape(teacher.photo) : ''}">
          </div>
        </div>
        ` : ''}

        <!-- Informations personnelles -->
        <div class="teacher-form__section">
          <p class="teacher-form__section-title">Informations personnelles</p>
          
          <div class="teacher-form__row">
            <div class="teacher-form__group">
              <label class="teacher-form__label" for="${formId}-firstname">PrÃ©nom *</label>
              <input type="text" id="${formId}-firstname" name="firstname" 
                     class="teacher-form__input" required
                     value="${escape(val('firstname'))}">
            </div>
            <div class="teacher-form__group">
              <label class="teacher-form__label" for="${formId}-lastname">Nom *</label>
              <input type="text" id="${formId}-lastname" name="lastname" 
                     class="teacher-form__input" required
                     value="${escape(val('lastname'))}">
            </div>
          </div>

          <div class="teacher-form__row">
            <div class="teacher-form__group">
              <label class="teacher-form__label" for="${formId}-email">Email *</label>
              <input type="email" id="${formId}-email" name="email" 
                     class="teacher-form__input" required
                     value="${escape(val('email'))}">
            </div>
            <div class="teacher-form__group">
              <label class="teacher-form__label" for="${formId}-phone">TÃ©lÃ©phone</label>
              <input type="tel" id="${formId}-phone" name="phone" 
                     class="teacher-form__input" placeholder="06 12 34 56 78"
                     value="${escape(val('phone'))}">
            </div>
          </div>

          <div class="teacher-form__row">
            <div class="teacher-form__group" style="flex: 0 0 120px;">
              <label class="teacher-form__label" for="${formId}-postalcode">Code postal *</label>
              <input type="text" id="${formId}-postalcode" name="postalcode" 
                     class="teacher-form__input" 
                     placeholder="75011" required
                     pattern="[0-9]{5}"
                     maxlength="5"
                     value="${escape(val('postalcode'))}">
            </div>
            <div class="teacher-form__group" style="flex: 1;">
              <label class="teacher-form__label" for="${formId}-city">Ville *</label>
              <input type="text" id="${formId}-city" name="city" 
                     class="teacher-form__input" 
                     placeholder="Paris" required
                     value="${escape(val('city') || val('location'))}">
            </div>
          </div>

          <div class="teacher-form__group">
            <label class="teacher-form__label" for="${formId}-bio">
              ${isSignup ? 'PrÃ©sentez-vous *' : 'Biographie'}
            </label>
            <textarea id="${formId}-bio" name="bio" 
                      class="teacher-form__textarea" rows="4"
                      placeholder="Votre parcours, votre expÃ©rience avec le handpan, votre approche pÃ©dagogique..."
                      ${isSignup ? 'required' : ''}>${escape(val('bio'))}</textarea>
          </div>
        </div>

        <!-- ModalitÃ©s de cours -->
        <div class="teacher-form__section">
          <p class="teacher-form__section-title">ModalitÃ©s de cours</p>

          <div class="teacher-form__group">
            <label class="teacher-form__label">Type de cours proposÃ©s ${isSignup ? '*' : ''}</label>
            <div class="teacher-form__checkbox-group">
              <label class="teacher-form__checkbox-item">
                <input type="checkbox" name="courseTypes" value="domicile"
                       ${isChecked('courseTypes', 'domicile') ? 'checked' : ''}>
                <span>Ã€ domicile</span>
              </label>
              <label class="teacher-form__checkbox-item">
                <input type="checkbox" name="courseTypes" value="studio"
                       ${isChecked('courseTypes', 'studio') ? 'checked' : ''}>
                <span>En studio</span>
              </label>
              <label class="teacher-form__checkbox-item">
                <input type="checkbox" name="courseTypes" value="distance"
                       ${isChecked('courseTypes', 'distance') ? 'checked' : ''}>
                <span>Ã€ distance</span>
              </label>
            </div>
          </div>

          <div class="teacher-form__group">
            <label class="teacher-form__label">Format des cours ${isSignup ? '*' : ''}</label>
            <div class="teacher-form__checkbox-group">
              <label class="teacher-form__checkbox-item">
                <input type="checkbox" name="courseFormats" value="solo"
                       ${isChecked('courseFormats', 'solo') ? 'checked' : ''}>
                <span>Cours individuels</span>
              </label>
              <label class="teacher-form__checkbox-item">
                <input type="checkbox" name="courseFormats" value="groupe"
                       ${isChecked('courseFormats', 'groupe') ? 'checked' : ''}>
                <span>Cours collectifs</span>
              </label>
            </div>
          </div>

          <div class="teacher-form__group">
            <label class="teacher-form__checkbox-item teacher-form__checkbox-item--standalone">
              <input type="checkbox" name="instrumentAvailable" value="1"
                     ${(teacher && teacher.instrumentAvailable) ? 'checked' : ''}>
              <span>Je peux mettre un instrument ÃƒÂ  disposition pour les cours</span>
            </label>
          </div>
        </div>

        <!-- PrÃ©sence en ligne -->
        <div class="teacher-form__section">
          <p class="teacher-form__section-title">PrÃ©sence en ligne (optionnel)</p>

          <div class="teacher-form__group">
            <label class="teacher-form__label" for="${formId}-website">Site web</label>
            <input type="url" id="${formId}-website" name="website" 
                   class="teacher-form__input" placeholder="https://monsite.fr"
                   value="${escape(val('website'))}">
          </div>

          <div class="teacher-form__group">
            <label class="teacher-form__label">RÃ©seaux sociaux</label>
            
            <div class="teacher-form__social-row">
              <span class="teacher-form__social-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </span>
              <input type="text" name="instagram" class="teacher-form__input" 
                     placeholder="@votre_compte"
                     value="${escape(val('instagram'))}">
            </div>

            <div class="teacher-form__social-row">
              <span class="teacher-form__social-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </span>
              <input type="text" name="facebook" class="teacher-form__input" 
                     placeholder="URL ou nom de page"
                     value="${escape(val('facebook'))}">
            </div>

            <div class="teacher-form__social-row">
              <span class="teacher-form__social-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </span>
              <input type="text" name="youtube" class="teacher-form__input" 
                     placeholder="URL de chaÃ®ne"
                     value="${escape(val('youtube'))}">
            </div>

            <div class="teacher-form__social-row">
              <span class="teacher-form__social-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
              </span>
              <input type="text" name="tiktok" class="teacher-form__input" 
                     placeholder="@votre_compte"
                     value="${escape(val('tiktok'))}">
            </div>
          </div>
        </div>

        ${showHoneypot ? `
        <!-- Honeypot anti-spam -->
        <div class="form-group" style="position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden;" aria-hidden="true" tabindex="-1">
          <label for="hp-${formId}-website">Site web</label>
          <input type="text" name="website" id="hp-${formId}-website" autocomplete="off" tabindex="-1">
        </div>
        ` : ''}
      </form>
    `;
  }

  /**
   * Collecte les donnÃ©es du formulaire
   * @param {string} formId - ID du formulaire
   * @returns {Object} DonnÃ©es du formulaire
   */
  function collectFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return null;

    const formData = new FormData(form);
    
    // RÃ©cupÃ©rer les checkboxes multiples
    const courseTypes = [];
    const courseFormats = [];
    
    form.querySelectorAll('input[name="courseTypes"]:checked').forEach(cb => {
      courseTypes.push(cb.value);
    });
    
    form.querySelectorAll('input[name="courseFormats"]:checked').forEach(cb => {
      courseFormats.push(cb.value);
    });

    const postalcode = formData.get('postalcode')?.trim() || '';
    const city = formData.get('city')?.trim() || '';
    const location = city + (postalcode ? ` (${postalcode})` : '');

    return {
      firstname: formData.get('firstname')?.trim() || '',
      lastname: formData.get('lastname')?.trim() || '',
      name: `${formData.get('firstname')?.trim() || ''} ${formData.get('lastname')?.trim() || ''}`.trim(),
      email: formData.get('email')?.trim() || '',
      phone: formData.get('phone')?.trim() || '',
      postalcode: postalcode,
      city: city,
      location: location,
      bio: formData.get('bio')?.trim() || '',
      photo: formData.get('photoData') || null,
      courseTypes: courseTypes,
      courseFormats: courseFormats,
      instrumentAvailable: form.querySelector('input[name="instrumentAvailable"]')?.checked || false,
      website: formData.get('website')?.trim() || '',
      instagram: formData.get('instagram')?.trim() || '',
      facebook: formData.get('facebook')?.trim() || '',
      youtube: formData.get('youtube')?.trim() || '',
      tiktok: formData.get('tiktok')?.trim() || ''
    };
  }

  /**
   * GÃ©ocode une adresse via l'API adresse.data.gouv.fr (plus fiable pour la France)
   * @param {string} postalcode - Code postal
   * @param {string} city - Ville
   * @returns {Promise<{lat: number, lng: number}>} CoordonnÃ©es
   */
  let _geocodeController = null;

  async function geocodeAddress(postalcode, city) {
    // Cancel any in-flight geocoding request
    if (_geocodeController) _geocodeController.abort();
    _geocodeController = new AbortController();

    try {
      const query = encodeURIComponent(`${postalcode} ${city}`);
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${query}&limit=1`,
        {
          headers: { 'Accept': 'application/json' },
          signal: _geocodeController.signal
        }
      );
      
      if (!response.ok) {
        throw new Error('Erreur rÃ©seau API adresse');
      }
      
      const data = await response.json();
      
      if (data && data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates;
        const label = data.features[0].properties.label;
        console.log(`GÃ©ocodage: ${postalcode} ${city} Ã¢â€ â€™ ${coords[1]}, ${coords[0]} (${label})`);
        return {
          lat: coords[1],  // L'API retourne [lng, lat]
          lng: coords[0]
        };
      }
      
      // Fallback: essayer Nominatim avec une query simple
      console.warn('API adresse sans rÃ©sultat, essai Nominatim...');
      const nominatimQuery = encodeURIComponent(`${postalcode}, ${city}, France`);
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${nominatimQuery}&format=json&limit=1&countrycodes=fr`,
        {
          headers: { 'User-Agent': 'MistralPans/1.0' },
          signal: _geocodeController.signal
        }
      );
      
      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json();
        if (nominatimData && nominatimData.length > 0) {
          console.log(`GÃ©ocodage Nominatim: ${postalcode} ${city} Ã¢â€ â€™ ${nominatimData[0].lat}, ${nominatimData[0].lon}`);
          return {
            lat: parseFloat(nominatimData[0].lat),
            lng: parseFloat(nominatimData[0].lon)
          };
        }
      }
      
      // Fallback final: centre de l'ÃŽle-de-France
      console.warn('GÃ©ocodage Ã©chouÃ©, utilisation des coordonnÃ©es par dÃ©faut');
      return { lat: 48.8566, lng: 2.3522 };
      
    } catch (error) {
      if (error.name === 'AbortError') return null; // Cancelled, ignore
      console.error('Erreur géocodage:', error);
      return { lat: 48.8566, lng: 2.3522 };
    }
  }

  /**
   * Compresse une image via canvas
   * @param {string} base64 - Image en base64
   * @param {number} maxWidth - Largeur max
   * @param {number} maxHeight - Hauteur max
   * @param {number} quality - QualitÃ© JPEG (0-1)
   * @returns {Promise<string>} Image compressÃ©e en base64
   */
  function compressImage(base64, maxWidth = 600, maxHeight = 600, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        
        // Calculer les nouvelles dimensions en gardant le ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // CrÃ©er le canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Exporter en JPEG compressÃ©
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = () => reject(new Error('Erreur de chargement image'));
      img.src = base64;
    });
  }

  /**
   * DÃ©clenche l'upload de photo
   * @param {string} formId - ID du formulaire
   */
  function triggerPhotoUpload(formId) {
    const input = document.getElementById(`${formId}-photo-input`);
    if (input) {
      input.click();
    }
  }

  /**
   * Initialise les Ã©vÃ©nements du formulaire
   * @param {string} formId - ID du formulaire
   * @param {Function} onPhotoChange - Callback aprÃ¨s changement de photo
   */
  function initFormEvents(formId, onPhotoChange = null) {
    const photoInput = document.getElementById(`${formId}-photo-input`);
    const photoPreview = document.getElementById(`${formId}-photo-preview`);
    const photoData = document.getElementById(`${formId}-photo-data`);

    if (photoInput && photoPreview && photoData) {
      photoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // VÃ©rifier le type
        if (!file.type.startsWith('image/')) {
          alert('Veuillez sÃ©lectionner une image');
          return;
        }

        // VÃ©rifier la taille (max 5MB avant compression)
        if (file.size > 5 * 1024 * 1024) {
          alert('L\'image est trop volumineuse (max 5Mo)');
          return;
        }

        // Afficher un indicateur de chargement
        photoPreview.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            <span style="font-size:0.75rem;">Compression...</span>
          </div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `;

        try {
          // Lire le fichier
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = () => reject(new Error('Erreur de lecture'));
            reader.readAsDataURL(file);
          });

          // Compresser l'image (600x600 max, qualitÃ© 80%)
          const compressed = await compressImage(base64, 600, 600, 0.8);
          
          // Mettre ÃƒÂ  jour le formulaire
          photoData.value = compressed;
          photoPreview.innerHTML = `<img src="${compressed}" alt="Photo de profil">`;
          
          // Afficher la taille originale vs compressÃ©e
          const originalSize = (file.size / 1024).toFixed(0);
          const compressedSize = (compressed.length * 0.75 / 1024).toFixed(0); // Base64 ~33% plus grand
          console.log(`Photo: ${originalSize}Ko Ã¢â€ â€™ ${compressedSize}Ko`);
          
          if (onPhotoChange) {
            onPhotoChange(compressed);
          }
        } catch (error) {
          console.error('Erreur compression:', error);
          photoPreview.innerHTML = `
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          `;
          alert('Erreur lors du traitement de l\'image. Veuillez rÃ©essayer.');
        }
      });
    }
  }

  /**
   * Valide le formulaire
   * @param {string} formId - ID du formulaire
   * @param {boolean} isSignup - Mode inscription (validation plus stricte)
   * @returns {boolean} Formulaire valide
   */
  function validateForm(formId, isSignup = false) {
    const form = document.getElementById(formId);
    if (!form) return false;

    // Validation HTML5 native
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }

    // Validation des checkboxes pour les inscriptions
    if (isSignup) {
      const courseTypes = form.querySelectorAll('input[name="courseTypes"]:checked');
      const courseFormats = form.querySelectorAll('input[name="courseFormats"]:checked');

      if (courseTypes.length === 0) {
        alert('Veuillez sÃ©lectionner au moins un type de cours');
        return false;
      }

      if (courseFormats.length === 0) {
        alert('Veuillez sÃ©lectionner au moins un format de cours');
        return false;
      }
    }

    return true;
  }

  /**
   * RÃ©initialise le formulaire
   * @param {string} formId - ID du formulaire
   */
  function resetForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.reset();

    // RÃ©initialiser la photo
    const photoPreview = document.getElementById(`${formId}-photo-preview`);
    const photoData = document.getElementById(`${formId}-photo-data`);
    
    if (photoPreview) {
      photoPreview.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      `;
    }
    
    if (photoData) {
      photoData.value = '';
    }
  }

  // Exposer l'API publique
  window.TeacherForm = {
    generate: generateTeacherForm,
    collect: collectFormData,
    init: initFormEvents,
    validate: validateForm,
    reset: resetForm,
    triggerPhotoUpload: triggerPhotoUpload,
    geocode: geocodeAddress
  };

})(window);
