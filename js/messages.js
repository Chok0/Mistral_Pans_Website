/* ==========================================================================
   MISTRAL PANS - Messages System
   Gestion locale des formulaires (remplace Formspree)
   ========================================================================== */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const CONFIG = {
    STORAGE_KEYS: {
      contacts: 'mistral_messages_contacts',
      orders: 'mistral_messages_orders',
      appointments: 'mistral_messages_appointments'
    },
    EMAIL: 'contact@mistralpans.fr',
    BUSINESS_NAME: 'Mistral Pans'
  };

  // ============================================================================
  // UTILITAIRES
  // ============================================================================

  function generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function formatDate(date = new Date()) {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================================
  // STORAGE
  // ============================================================================

  function getMessages(type) {
    const key = CONFIG.STORAGE_KEYS[type];
    if (!key) return [];
    
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('[Messages] Erreur lecture:', e);
      return [];
    }
  }

  function saveMessage(type, data) {
    const key = CONFIG.STORAGE_KEYS[type];
    if (!key) return null;

    const messages = getMessages(type);
    const message = {
      id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
      read: false
    };
    
    messages.unshift(message); // Ajouter en premier
    
    try {
      localStorage.setItem(key, JSON.stringify(messages));
      return message;
    } catch (e) {
      console.error('[Messages] Erreur sauvegarde:', e);
      return null;
    }
  }

  function markAsRead(type, id) {
    const key = CONFIG.STORAGE_KEYS[type];
    if (!key) return;

    const messages = getMessages(type);
    const index = messages.findIndex(m => m.id === id);
    if (index !== -1) {
      messages[index].read = true;
      localStorage.setItem(key, JSON.stringify(messages));
    }
  }

  function deleteMessage(type, id) {
    const key = CONFIG.STORAGE_KEYS[type];
    if (!key) return;

    const messages = getMessages(type).filter(m => m.id !== id);
    localStorage.setItem(key, JSON.stringify(messages));
  }

  function getUnreadCount(type) {
    if (type) {
      return getMessages(type).filter(m => !m.read).length;
    }
    // Total de tous les types
    return Object.keys(CONFIG.STORAGE_KEYS).reduce((total, key) => {
      return total + getMessages(key).filter(m => !m.read).length;
    }, 0);
  }

  // ============================================================================
  // MAILTO FALLBACK
  // ============================================================================

  function buildMailtoLink(data, type = 'contact') {
    const subjects = {
      contact: `[Mistral Pans] Message de ${data.firstname} ${data.lastname}`,
      order: `[Mistral Pans] Commande - ${data.product}`,
      appointment: `[Mistral Pans] Demande de RDV - ${data.firstname} ${data.lastname}`
    };

    let body = '';
    
    if (type === 'contact') {
      body = `Nom: ${data.firstname} ${data.lastname}
Email: ${data.email}
Téléphone: ${data.phone || 'Non renseigné'}

Message:
${data.message}`;
    } else if (type === 'order') {
      body = `COMMANDE AVEC ACOMPTE

Produit: ${data.product}
Montant acompte: 300€

Client:
- Nom: ${data.firstname} ${data.lastname}
- Email: ${data.email}
- Téléphone: ${data.phone}
- Adresse: ${data.address}

Message: ${data.message || 'Aucun'}`;
    } else if (type === 'appointment') {
      body = `DEMANDE DE RENDEZ-VOUS

Produit d'intérêt: ${data.product}

Contact:
- Nom: ${data.firstname} ${data.lastname}
- Email: ${data.email}
- Téléphone: ${data.phone}
- Préférence: ${data.contactPreference}

Disponibilités: ${data.availability || 'Non précisées'}
Message: ${data.message || 'Aucun'}`;
    }

    return `mailto:${CONFIG.EMAIL}?subject=${encodeURIComponent(subjects[type])}&body=${encodeURIComponent(body)}`;
  }

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  /**
   * Gère la soumission du formulaire de contact
   */
  function handleContactForm(form, options = {}) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(form);
      const data = {
        firstname: formData.get('firstname'),
        lastname: formData.get('lastname'),
        email: formData.get('email'),
        phone: formData.get('phone') || '',
        message: formData.get('message'),
        source: options.source || window.location.pathname
      };

      // Validation basique
      if (!data.firstname || !data.lastname || !data.email || !data.message) {
        showFormError(form, 'Veuillez remplir tous les champs obligatoires.');
        return;
      }

      // Sauvegarder le message
      const saved = saveMessage('contacts', data);
      
      if (saved) {
        showFormSuccess(form, 'Message envoyé ! Nous vous répondrons rapidement.');
        form.reset();
        
        // Fermer le modal si présent
        if (options.closeModal) {
          setTimeout(() => {
            const modal = form.closest('.modal-overlay');
            if (modal) modal.classList.remove('open');
            document.body.style.overflow = '';
          }, 1500);
        }

        // Callback optionnel
        if (options.onSuccess) options.onSuccess(saved);
      } else {
        // Fallback mailto
        const mailtoLink = buildMailtoLink(data, 'contact');
        showFormError(form, 'Erreur de sauvegarde. <a href="' + mailtoLink + '">Envoyer par email</a>');
      }
    });
  }

  /**
   * Gère la soumission du formulaire de commande (acompte)
   */
  function handleOrderForm(form, options = {}) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(form);
      const data = {
        type: 'acompte',
        product: formData.get('product') || options.product || 'Non spécifié',
        firstname: formData.get('firstname'),
        lastname: formData.get('lastname'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        message: formData.get('message') || '',
        amount: 300,
        status: 'pending'
      };

      const saved = saveMessage('orders', data);
      
      if (saved) {
        showFormSuccess(form, `
          <strong>Commande enregistrée !</strong><br>
          Vous recevrez un email avec le lien de paiement PayPal sous 24h.
        `);
        form.reset();
        if (options.onSuccess) options.onSuccess(saved);
      } else {
        const mailtoLink = buildMailtoLink(data, 'order');
        showFormError(form, 'Erreur. <a href="' + mailtoLink + '">Envoyer par email</a>');
      }
    });
  }

  /**
   * Gère la soumission du formulaire de RDV
   */
  function handleAppointmentForm(form, options = {}) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(form);
      const data = {
        product: formData.get('product_interest') || options.product || 'Non spécifié',
        firstname: formData.get('firstname'),
        lastname: formData.get('lastname'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        contactPreference: formData.get('contact_preference') || 'email',
        availability: formData.get('availability') || '',
        message: formData.get('message') || '',
        status: 'pending'
      };

      const saved = saveMessage('appointments', data);
      
      if (saved) {
        showFormSuccess(form, `
          <strong>Demande envoyée !</strong><br>
          Je vous recontacte sous 48h pour convenir d'un créneau.
        `);
        form.reset();
        if (options.onSuccess) options.onSuccess(saved);
      } else {
        const mailtoLink = buildMailtoLink(data, 'appointment');
        showFormError(form, 'Erreur. <a href="' + mailtoLink + '">Envoyer par email</a>');
      }
    });
  }

  // ============================================================================
  // UI FEEDBACK
  // ============================================================================

  function showFormSuccess(form, message) {
    removeFormFeedback(form);
    
    const feedback = document.createElement('div');
    feedback.className = 'form-feedback form-feedback--success';
    feedback.innerHTML = message;
    feedback.style.cssText = `
      background: #ecfdf5;
      border: 1px solid #10b981;
      color: #065f46;
      padding: 1rem;
      border-radius: 8px;
      margin-top: 1rem;
      text-align: center;
    `;
    
    form.appendChild(feedback);
    
    // Auto-remove après 5s
    setTimeout(() => feedback.remove(), 5000);
  }

  function showFormError(form, message) {
    removeFormFeedback(form);
    
    const feedback = document.createElement('div');
    feedback.className = 'form-feedback form-feedback--error';
    feedback.innerHTML = message;
    feedback.style.cssText = `
      background: #fef2f2;
      border: 1px solid #ef4444;
      color: #991b1b;
      padding: 1rem;
      border-radius: 8px;
      margin-top: 1rem;
      text-align: center;
    `;
    feedback.querySelector('a')?.style.setProperty('color', '#991b1b');
    
    form.appendChild(feedback);
  }

  function removeFormFeedback(form) {
    form.querySelectorAll('.form-feedback').forEach(el => el.remove());
  }

  // ============================================================================
  // AUTO-INIT
  // ============================================================================

  function initForms() {
    // Contact forms
    document.querySelectorAll('form[data-form="contact"]').forEach(form => {
      handleContactForm(form, { closeModal: true });
    });

    // Order forms
    document.querySelectorAll('form[data-form="order"]').forEach(form => {
      handleOrderForm(form);
    });

    // Appointment forms
    document.querySelectorAll('form[data-form="appointment"]').forEach(form => {
      handleAppointmentForm(form);
    });

    // Legacy: formulaire contact par ID
    const contactForm = document.getElementById('contact-form');
    if (contactForm && !contactForm.dataset.form) {
      handleContactForm(contactForm, { closeModal: true });
    }
  }

  // Init au chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForms);
  } else {
    // DOM déjà chargé (cas des partials chargés dynamiquement)
    initForms();
  }

  // Re-init après chargement des partials (appelé par main.js)
  window.initMessageForms = initForms;

  // ============================================================================
  // EXPORT PUBLIC API
  // ============================================================================

  window.MistralMessages = {
    // CRUD
    getMessages,
    saveMessage,
    markAsRead,
    deleteMessage,
    getUnreadCount,
    
    // Handlers (pour usage manuel)
    handleContactForm,
    handleOrderForm,
    handleAppointmentForm,
    
    // Utils
    buildMailtoLink,
    formatDate,
    
    // Config
    CONFIG
  };

  console.log('[Messages] Module initialisé');

})(window);
