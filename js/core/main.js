/* ==========================================================================
   MISTRAL PANS - Main JavaScript
   Version 2.1 - Avec chargement dynamique des partials et RGPD
   ========================================================================== */

/* --------------------------------------------------------------------------
   Supabase Sync - Chargement dynamique sur toutes les pages
   Note: cookie-consent.js est chargé directement dans les pages HTML
   -------------------------------------------------------------------------- */
(function loadSupabaseSync() {
  // Ne pas recharger si déjà présent (ex: admin.html)
  if (window.MistralSync || window.supabaseLoading) return;
  window.supabaseLoading = true;

  // Charger config.js d'abord
  const configScript = document.createElement('script');
  configScript.src = 'js/core/config.js';
  configScript.onload = function() {
    // Charger le SDK Supabase
    const supabaseSDK = document.createElement('script');
    supabaseSDK.src = 'js/vendor/supabase.js';
    supabaseSDK.onload = function() {
      // Charger supabase-client.js
      const clientScript = document.createElement('script');
      clientScript.src = 'js/services/supabase-client.js';
      clientScript.onload = function() {
        // Charger supabase-sync.js
        const syncScript = document.createElement('script');
        syncScript.src = 'js/services/supabase-sync.js';
        document.head.appendChild(syncScript);
      };
      document.head.appendChild(clientScript);
    };
    document.head.appendChild(supabaseSDK);
  };
  // Si config.js échoue, continuer quand même (mode dégradé)
  configScript.onerror = function() {
    console.warn('[Main] config.js non trouvé, Supabase désactivé');
  };
  document.head.appendChild(configScript);
})();


/* --------------------------------------------------------------------------
   Configuration
   -------------------------------------------------------------------------- */
const PARTIALS_PATH = 'partials/';

/* --------------------------------------------------------------------------
   Partials Loader - Charge header, footer et contact modal dynamiquement
   -------------------------------------------------------------------------- */
async function loadPartials() {
  const headerContainer = document.getElementById('site-header');
  const footerContainer = document.getElementById('site-footer');
  const modalContainer = document.getElementById('contact-modal-container');
  
  // Déterminer la page courante pour la navigation active
  const currentPage = getCurrentPageName();
  
  // Déterminer le type de footer (normal ou minimal)
  const footerType = document.body.dataset.footer || 'normal';
  const footerFile = footerType === 'minimal' ? 'footer-minimal.html' : 'footer.html';
  
  // Charger les partials en parallèle
  const loadPromises = [];
  
  if (headerContainer) {
    loadPromises.push(
      loadPartial('header.html')
        .then(html => {
          headerContainer.innerHTML = html;
          setActiveNavLink(currentPage);
        })
    );
  }
  
  if (footerContainer) {
    loadPromises.push(
      loadPartial(footerFile)
        .then(html => {
          footerContainer.innerHTML = html;
        })
    );
  }
  
  if (modalContainer) {
    loadPromises.push(
      loadPartial('contact-modal.html')
        .then(html => {
          modalContainer.innerHTML = html;
        })
    );
  }
  
  // Attendre que tous les partials soient chargés
  await Promise.all(loadPromises);
  
  // Réinitialiser les composants après chargement
  initAfterPartialsLoaded();
}

/**
 * Charge un fichier partial
 */
async function loadPartial(filename) {
  try {
    const response = await fetch(PARTIALS_PATH + filename);
    if (!response.ok) {
      console.warn(`Partial ${filename} not found`);
      return '';
    }
    return await response.text();
  } catch (error) {
    console.warn(`Error loading partial ${filename}:`, error);
    return '';
  }
}

/**
 * Détermine le nom de la page courante
 */
function getCurrentPageName() {
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  return filename.replace('.html', '');
}

/**
 * Définit le lien actif dans la navigation
 */
function setActiveNavLink(currentPage) {
  const navLinks = document.querySelectorAll('.nav__link[data-page]');
  navLinks.forEach(link => {
    if (link.dataset.page === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/**
 * Initialise les composants après le chargement des partials
 */
function initAfterPartialsLoaded() {
  initHeader();
  initMobileNav();
  initContactModal();
}

/* --------------------------------------------------------------------------
   DOMContentLoaded - Point d'entrée principal
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  // Charger les partials d'abord
  await loadPartials();
  
  // Puis initialiser les autres composants
  initAccordions();
  initScaleSelector();
  initScrollAnimations();
  initSmoothScroll();
});

/* --------------------------------------------------------------------------
   Header Scroll Effect
   -------------------------------------------------------------------------- */
function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
}

/* --------------------------------------------------------------------------
   Mobile Navigation
   -------------------------------------------------------------------------- */
function initMobileNav() {
  const toggle = document.querySelector('.nav__toggle');
  const navList = document.querySelector('.nav__list');
  
  if (!toggle || !navList) return;
  
  toggle.addEventListener('click', () => {
    navList.classList.toggle('open');
    toggle.setAttribute('aria-expanded', navList.classList.contains('open'));
  });
  
  // Close menu when clicking a link
  navList.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
      navList.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !navList.contains(e.target)) {
      navList.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

/* --------------------------------------------------------------------------
   Accordions
   -------------------------------------------------------------------------- */
function initAccordions() {
  const accordions = document.querySelectorAll('.accordion');
  
  accordions.forEach(accordion => {
    const header = accordion.querySelector('.accordion__header');
    const content = accordion.querySelector('.accordion__content');
    
    if (!header || !content) return;
    
    header.addEventListener('click', () => {
      const isOpen = accordion.classList.contains('open');
      
      // Close all other accordions in the same section
      const parent = accordion.parentElement;
      if (parent) {
        parent.querySelectorAll('.accordion.open').forEach(openAcc => {
          if (openAcc !== accordion) {
            openAcc.classList.remove('open');
          }
        });
      }
      
      // Toggle current
      accordion.classList.toggle('open');
      header.setAttribute('aria-expanded', !isOpen);
    });
  });
}

/* --------------------------------------------------------------------------
   Contact Modal - Les modals sont maintenant inline dans chaque page
   -------------------------------------------------------------------------- */
function initContactModal() {
  // Le modal et ses handlers sont maintenant définis directement dans chaque page HTML
  // Cette fonction est conservée pour compatibilité mais ne fait plus rien
}

/* --------------------------------------------------------------------------
   Scale Selector (for boutique page)
   -------------------------------------------------------------------------- */

// Build scales object from MistralScales (unified source) or use fallback
function _buildScalesForSelector() {
  // Use MistralScales if available (from scales-data.js)
  if (typeof MistralScales !== 'undefined' && MistralScales.SCALES_DATA) {
    const scales = {};
    for (const [key, data] of Object.entries(MistralScales.SCALES_DATA)) {
      if (data.baseNotes && data.baseNotes.length > 0) {
        // Use proper music theory to determine sharp/flat for base tonality
        const baseTonality = data.baseRoot + data.baseOctave;
        const useFlats = MistralScales.shouldUseFlats(baseTonality, data);
        const notesArray = data.baseNotes.map(n => MistralScales.toDisplayNotation(n, useFlats));
        scales[key] = {
          name: `${MistralScales.toDisplayNotation(data.baseRoot, useFlats)} ${data.name}`,
          notes: notesArray.join(' '),
          description: data.description || '',
          mood: data.mood || ''
        };
      }
    }
    return scales;
  }

  // Fallback if MistralScales not loaded
  return {
    'kurd': { name: 'D Kurd', notes: 'D3 A3 Bb3 C4 D4 E4 F4 G4 A4', description: 'La gamme la plus populaire.', mood: 'Melancolique, introspectif' },
    'amara': { name: 'D Amara', notes: 'D3 A3 C4 D4 E4 F4 A4 C5', description: 'Variante douce.', mood: 'Doux, apaisant' },
    'hijaz': { name: 'D Hijaz', notes: 'D3 A3 Bb3 C#4 D4 E4 F4 G4 A4', description: 'Orientale.', mood: 'Oriental, mystique' },
    'equinox': { name: 'F Equinox', notes: 'F3 Ab3 C4 Db4 Eb4 F4 G4 Ab4 C5', description: 'Grave et profonde.', mood: 'Profond, meditatif' }
  };
}

function initScaleSelector() {
  const scaleButtons = document.querySelectorAll('.scale-btn');
  const scaleInfo = document.querySelector('.scale-info');

  if (scaleButtons.length === 0) return;

  // Scale data - use MistralScales if available, otherwise fallback
  const scales = _buildScalesForSelector();

  scaleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      scaleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update info display
      const scaleKey = btn.dataset.scale;
      const scale = scales[scaleKey];
      
      if (scale && scaleInfo) {
        scaleInfo.innerHTML = `
          <h4>${scale.name}</h4>
          <p class="scale-notes">${scale.notes}</p>
          <p class="scale-description">${scale.description}</p>
          <p class="scale-mood"><strong>Ambiance :</strong> ${scale.mood}</p>
        `;
      }
    });
  });
}

/* --------------------------------------------------------------------------
   Smooth Scroll for Anchor Links
   -------------------------------------------------------------------------- */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/* --------------------------------------------------------------------------
   Form Validation Helper
   -------------------------------------------------------------------------- */
function validateForm(form) {
  let isValid = true;
  const requiredFields = form.querySelectorAll('[required]');
  
  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      isValid = false;
      field.classList.add('error');
    } else {
      field.classList.remove('error');
    }
  });
  
  // Email validation
  const emailField = form.querySelector('[type="email"]');
  if (emailField && emailField.value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailField.value)) {
      isValid = false;
      emailField.classList.add('error');
    }
  }
  
  return isValid;
}

/* --------------------------------------------------------------------------
   Intersection Observer for Animations
   -------------------------------------------------------------------------- */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });
}
/* --------------------------------------------------------------------------
   Contact Form - Envoi via Netlify Function
   -------------------------------------------------------------------------- */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form || form.dataset.initialized) return;
  form.dataset.initialized = 'true';
  
  const submitBtn = document.getElementById('contact-submit');
  const statusDiv = document.getElementById('contact-status');
  const modal = document.getElementById('contact-modal');
  
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Désactiver le bouton
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';
    if (statusDiv) statusDiv.style.display = 'none';
    
    // Récupérer les données
    const formData = new FormData(form);
    const data = {
      firstname: formData.get('firstname'),
      lastname: formData.get('lastname'),
      email: formData.get('email'),
      phone: formData.get('phone') || '',
      message: formData.get('message'),
      website: formData.get('website') // honeypot
    };
    
    try {
      const response = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        if (statusDiv) {
          statusDiv.textContent = '✅ Message envoyé ! Je vous réponds rapidement.';
          statusDiv.className = 'form-status form-status--success';
          statusDiv.style.display = 'block';
        }
        form.reset();
        
        // Fermer la modale après 2 secondes
        setTimeout(function() {
          if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
          }
          if (statusDiv) statusDiv.style.display = 'none';
        }, 2000);
        
      } else {
        throw new Error(result.error || 'Erreur lors de l\'envoi');
      }
      
    } catch (error) {
      console.error('Erreur envoi:', error);
      if (statusDiv) {
        statusDiv.textContent = '❌ Erreur lors de l\'envoi. Réessayez ou contactez-moi directement par email.';
        statusDiv.className = 'form-status form-status--error';
        statusDiv.style.display = 'block';
      }
    }
    
    // Réactiver le bouton
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer';
  });
}

/* --------------------------------------------------------------------------
   Contact Modal - Ouverture/Fermeture
   -------------------------------------------------------------------------- */
document.addEventListener('click', function(e) {
  const trigger = e.target.closest('[data-modal="contact"]');
  if (trigger) {
    e.preventDefault();
    const modal = document.getElementById('contact-modal');
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      // Initialiser le formulaire à l'ouverture
      setTimeout(initContactForm, 100);
    }
  }
  
  // Fermer au clic sur le fond ou le bouton fermer
  const modal = document.getElementById('contact-modal');
  if (modal && modal.classList.contains('open')) {
    if (e.target === modal || e.target.closest('.modal__close')) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('contact-modal');
    if (modal && modal.classList.contains('open')) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }
});