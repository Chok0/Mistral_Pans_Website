/* MISTRAL PANS - Admin UI - Modals Teachers */

(function(window) {
  'use strict';

  if (typeof window.AdminUI === 'undefined') {
    console.warn('[admin-ui-modals-teachers] AdminUI non disponible, module différé');
    return;
  }

  const { $, escapeHtml, formatPrice, formatDate, isValidEmail, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers;
  const { getModalState, clearModalState, showModal, closeModal, withSaveGuard } = window.AdminUI;

  // Professeurs
  function approveTeacher(id) {
    const pending = Storage.get('mistral_pending_teachers', []);
    const teacher = pending.find(t => t.id === id);
    if (teacher) {
      teacher.statut = 'active';
      const teachers = Storage.get('mistral_teachers', []);
      teachers.push(teacher);
      Storage.set('mistral_teachers', teachers);
      Storage.set('mistral_pending_teachers', pending.filter(t => t.id !== id));
      AdminUI.renderProfesseurs();
      AdminUI.refreshDashboard();
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
      AdminUI.renderProfesseurs();
      AdminUI.refreshDashboard();
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

    // Stocker l'ID du professeur en cours d'édition (scopé au modal)
    getModalState('professeur').editingId = id;

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
          // Prénom et Nom (séparés dans le formulaire)
          // Le formulaire TeacherForm a des champs firstname + lastname
          // tandis que la DB stocke name = "Prénom Nom"
          const parts = (teacher.name || '').split(' ');
          const firstName = teacher.firstname || parts[0] || '';
          const lastName = teacher.lastname || parts.slice(1).join(' ') || '';

          const firstnameInput = form.querySelector('[name="firstname"]');
          if (firstnameInput) firstnameInput.value = firstName;

          const lastnameInput = form.querySelector('[name="lastname"]');
          if (lastnameInput) lastnameInput.value = lastName;

          // Email
          const emailInput = form.querySelector('[name="email"]');
          if (emailInput) emailInput.value = teacher.email || '';

          // Téléphone
          const phoneInput = form.querySelector('[name="phone"]');
          if (phoneInput) phoneInput.value = teacher.phone || '';

          // Site web
          const websiteInput = form.querySelector('[name="website"]');
          if (websiteInput) websiteInput.value = teacher.website || '';

          // Code postal
          const postalInput = form.querySelector('[name="postalcode"]');
          if (postalInput) postalInput.value = teacher.postalcode || '';

          // Ville
          const cityInput = form.querySelector('[name="city"]');
          if (cityInput) cityInput.value = teacher.city || '';

          // Bio
          const bioInput = form.querySelector('[name="bio"]');
          if (bioInput) bioInput.value = teacher.bio || '';

          // Réseaux sociaux
          const igInput = form.querySelector('[name="instagram"]');
          if (igInput) igInput.value = teacher.instagram || '';
          const fbInput = form.querySelector('[name="facebook"]');
          if (fbInput) fbInput.value = teacher.facebook || '';
          const ytInput = form.querySelector('[name="youtube"]');
          if (ytInput) ytInput.value = teacher.youtube || '';
          const tkInput = form.querySelector('[name="tiktok"]');
          if (tkInput) tkInput.value = teacher.tiktok || '';

          // Photo preview
          if (teacher.photo) {
            const photoPreview = form.querySelector('.teacher-form__photo-preview img');
            if (photoPreview) {
              photoPreview.src = teacher.photo;
              photoPreview.style.display = 'block';
            }
            // Stocker dans le champ caché pour re-soumission
            const photoData = form.querySelector('[name="photoData"]');
            if (photoData) photoData.value = teacher.photo;
          }

          // Types de cours (checkboxes : domicile, studio, distance)
          if (teacher.courseTypes) {
            teacher.courseTypes.forEach(type => {
              const checkbox = form.querySelector(`[name="courseTypes"][value="${type}"]`);
              if (checkbox) checkbox.checked = true;
            });
          }

          // Format de cours (checkboxes : solo, groupe)
          if (teacher.courseFormats) {
            teacher.courseFormats.forEach(fmt => {
              const checkbox = form.querySelector(`[name="courseFormats"][value="${fmt}"]`);
              if (checkbox) checkbox.checked = true;
            });
          }

          // Instrument à disposition
          if (teacher.instrumentAvailable) {
            const instCheckbox = form.querySelector('[name="instrumentAvailable"]');
            if (instCheckbox) instCheckbox.checked = true;
          }
        }
      }, 100);
    }
  }

  async function saveTeacher() {
    const teacherState = getModalState('professeur');
    if (!teacherState.editingId) {
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
    const index = teachers.findIndex(t => t.id === teacherState.editingId);

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
      AdminUI.renderProfesseurs();

      // Reset
      teacherState.editingId = null;

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
      AdminUI.renderProfesseurs();
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
    data.id = crypto.randomUUID();
    data.created_at = new Date().toISOString();

    // Ajouter aux professeurs actifs
    const teachers = Storage.get('mistral_teachers', []);
    teachers.push(data);
    Storage.set('mistral_teachers', teachers);

    // Reset le formulaire
    TeacherForm.reset('add-teacher-form');

    // Rafraîchir l'affichage
    AdminUI.renderProfesseurs();
    AdminUI.refreshDashboard();

    // Basculer vers l'onglet des professeurs actifs
    const activeTab = document.querySelector('[data-subtab="active"]');
    if (activeTab) activeTab.click();

    Toast.success(`${data.name} a été ajouté(e)`);
  }

  // Export functions to AdminUI
  Object.assign(window.AdminUI, {
    approveTeacher,
    rejectTeacher,
    editTeacher,
    saveTeacher: withSaveGuard('teacher', saveTeacher),
    deleteTeacher,
    initAddTeacherForm,
    submitAddTeacherForm
  });

})(window);
