(function() {
  'use strict';
  if (typeof MistralAdmin === 'undefined') { console.error('[Admin] MistralAdmin non chargé'); return; }

  const { Auth, Toast } = MistralAdmin;
  const HASH_MAP = { 'stock': 'boutique', 'teachers': 'professeurs', 'gallery': 'galerie', 'stats': 'analytics' };

  const loginView = document.getElementById('login-view');
  const adminView = document.getElementById('admin-view');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  async function updateView() {
    // Verifier la session Supabase (async, source de verite)
    let loggedIn = false;
    try {
      if (typeof MistralAuth !== 'undefined') {
        loggedIn = await MistralAuth.isLoggedIn();
      }
    } catch (err) {
      console.error('[Admin] Erreur verification auth:', err);
    }
    if (loggedIn) {
      loginView.style.display = 'none';
      adminView.style.display = 'block';
      initAdmin();
    } else {
      loginView.style.display = 'flex';
      adminView.style.display = 'none';
    }
  }

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Vérifier que c'est un email valide
    if (!email.includes('@')) {
      loginError.textContent = 'Veuillez entrer une adresse email valide';
      loginError.classList.add('show');
      return;
    }

    // Vérifier que MistralAuth est disponible
    if (typeof MistralAuth === 'undefined') {
      loginError.textContent = 'Service d\'authentification non disponible';
      loginError.classList.add('show');
      return;
    }

    const btn = loginForm.querySelector('button[type="submit"]');
    btn.textContent = 'Connexion...';
    btn.disabled = true;

    try {
      const result = await MistralAuth.login(email, password);

      if (result.success) {
        loginError.classList.remove('show');
        updateView();
      } else {
        loginError.textContent = result.error || 'Identifiants incorrects';
        loginError.classList.add('show');
        document.getElementById('password').value = '';
      }
    } catch (err) {
      console.error('[Admin] Erreur login:', err);
      loginError.textContent = 'Erreur de connexion. Réessayez.';
      loginError.classList.add('show');
    }

    btn.textContent = 'Connexion';
    btn.disabled = false;
  });

  document.getElementById('btn-logout').addEventListener('click', async function() {
    try {
      if (typeof MistralAuth !== 'undefined') {
        // MistralAuth.logout() redirige vers index.html
        await MistralAuth.logout();
      } else {
        Auth.logout();
        updateView();
      }
    } catch (err) {
      console.error('[Admin] Erreur logout:', err);
      // Forcer le retour à la vue login malgré l'erreur
      updateView();
    }
  });

  function initAdmin() {
    if (typeof AdminUI !== 'undefined') {
      AdminUI.init();
      let hash = window.location.hash.replace('#', '');
      if (HASH_MAP[hash]) hash = HASH_MAP[hash];
      if (hash) AdminUI.navigateTo(hash);
    }
    initSubtabs();
  }

  function initSubtabs() {
    document.querySelectorAll('[data-subtab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const subtab = btn.dataset.subtab;
        const container = btn.closest('.gestion-section');
        btn.closest('.admin-tabs').querySelectorAll('[data-subtab]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (container) {
          container.querySelectorAll('[id^="subtab-"]').forEach(function(el) { el.style.display = 'none'; });
          const subtabEl = container.querySelector('#subtab-' + subtab);
          if (subtabEl) subtabEl.style.display = 'block';
        }
      });
    });
  }

  window.syncFromGestion = function() {
    if (typeof GestionBoutique !== 'undefined') {
      const result = GestionBoutique.synchroniserTout();
      Toast.success(result.added > 0 ? result.added + ' instrument(s) publié(s)' : 'Aucun nouvel instrument');
    }
  };

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.admin-modal-overlay.open');
      if (openModal && typeof AdminUI !== 'undefined') AdminUI.closeModal(openModal.id.replace('modal-', ''));
      closeContactModal();
    }
  });

  document.querySelectorAll('.admin-modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay && typeof AdminUI !== 'undefined') AdminUI.closeModal(overlay.id.replace('modal-', ''));
    });
  });

  // Navigation mobile toggle
  const navToggle = document.querySelector('.nav__toggle');
  const navList = document.querySelector('.nav__list');
  if (navToggle && navList) {
    navToggle.addEventListener('click', function() {
      navList.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', navList.classList.contains('open'));
    });
  }

  // Contact modal
  function openContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }
  function closeContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }
  function submitContactForm(e) {
    e.preventDefault();
    const f = e.target;
    const firstname = f.querySelector('[name="firstname"]').value.trim();
    const lastname = f.querySelector('[name="lastname"]').value.trim();
    const email = f.querySelector('[name="email"]').value.trim();
    const phone = f.querySelector('[name="phone"]').value.trim() || 'Non renseigné';
    const message = f.querySelector('[name="message"]').value.trim();
    const subject = '[Mistral Pans] Message de ' + firstname + ' ' + lastname;
    const body = 'Nom: ' + firstname + ' ' + lastname + '\nEmail: ' + email + '\nTéléphone: ' + phone + '\n\nMessage:\n' + message;
    window.location.href = 'mailto:contact@mistralpans.fr?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    setTimeout(function() { closeContactModal(); f.reset(); }, 300);
  }
  document.querySelectorAll('[data-modal="contact"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      openContactModal();
    });
  });
  // Fermer contact modal au clic overlay
  const contactOverlay = document.getElementById('contact-modal');
  if (contactOverlay) {
    contactOverlay.addEventListener('click', function(e) {
      if (e.target === contactOverlay) closeContactModal();
    });
  }

  // Attendre DOMContentLoaded pour que les scripts defer (AdminUI, etc.) soient charges
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateView);
  } else {
    updateView();
  }
})();
