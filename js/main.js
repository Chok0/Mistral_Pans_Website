/* ==========================================================================
   MISTRAL PANS - Main JavaScript
   Version 2.0 - Avec chargement dynamique des partials
   ========================================================================== */

/* --------------------------------------------------------------------------
   Supabase Sync - Chargement dynamique sur toutes les pages
   -------------------------------------------------------------------------- */
(function loadSupabaseSync() {
  // Ne pas recharger si déjà présent (ex: admin.html)
  if (window.MistralSync || window.supabaseLoading) return;
  window.supabaseLoading = true;
  
  // Charger le SDK Supabase
  const supabaseSDK = document.createElement('script');
  supabaseSDK.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  supabaseSDK.onload = function() {
    // Charger supabase-client.js
    const clientScript = document.createElement('script');
    clientScript.src = 'js/supabase-client.js';
    clientScript.onload = function() {
      // Charger supabase-sync.js
      const syncScript = document.createElement('script');
      syncScript.src = 'js/supabase-sync.js';
      document.head.appendChild(syncScript);
    };
    document.head.appendChild(clientScript);
  };
  document.head.appendChild(supabaseSDK);
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
  
  let lastScroll = 0;
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
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
function initScaleSelector() {
  const scaleButtons = document.querySelectorAll('.scale-btn');
  const scaleInfo = document.querySelector('.scale-info');
  
  if (scaleButtons.length === 0) return;
  
  // Scale data
  const scales = {
    'kurd': {
      name: 'D Kurd',
      notes: 'D3 A3 Bb3 C4 D4 E4 F4 G4 A4',
      description: 'La gamme la plus populaire. Douce, méditative, accessible à tous.',
      mood: 'Mélancolique, introspectif'
    },
    'celtic': {
      name: 'D Celtic Minor',
      notes: 'D3 A3 C4 D4 E4 F4 G4 A4 C5',
      description: 'Sonorités celtiques et médiévales. Très mélodique.',
      mood: 'Mystique, nostalgique'
    },
    'pygmy': {
      name: 'D Pygmy',
      notes: 'D3 A3 Bb3 C4 D4 F4 G4 A4',
      description: 'Gamme pentatonique africaine. Joyeuse et entraînante.',
      mood: 'Joyeux, tribal'
    },
    'hijaz': {
      name: 'D Hijaz',
      notes: 'D3 A3 Bb3 C#4 D4 E4 F4 G4 A4',
      description: 'Sonorités orientales. Mystérieuse et envoûtante.',
      mood: 'Oriental, mystique'
    },
    'amara': {
      name: 'D Amara',
      notes: 'D3 A3 C4 D4 E4 F4 A4 C5',
      description: 'Variante du Celtic, plus douce. Idéale pour débuter.',
      mood: 'Doux, apaisant'
    },
    'equinox': {
      name: 'F Equinox',
      notes: 'F3 Ab3 C4 Db4 Eb4 F4 G4 Ab4 C5',
      description: 'Gamme grave et profonde. Sonorités riches.',
      mood: 'Profond, méditatif'
    }
  };
  
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
