/* ==========================================================================
 *  MISTRAL PANS - Module Principal (main.js)
 *  Version 2.1 - Avec chargement dynamique des partials et RGPD
 * ===========================================================================
 *
 *  Point d'entree principal du site Mistral Pans.
 *  Ce fichier orchestre le demarrage de l'application cote client :
 *
 *  1. Chargement dynamique de Supabase (IIFE auto-executee)
 *     config.js -> supabase.js (SDK) -> supabase-client.js -> supabase-sync.js
 *
 *  2. Chargement des partials HTML (header, footer, modale contact)
 *     via fetch() depuis le repertoire partials/
 *
 *  3. Initialisation des composants UI :
 *     - Effet de scroll sur le header (classe .scrolled)
 *     - Navigation mobile (hamburger menu)
 *     - Indicateur panier dans le header
 *     - Accordeons (ouverture/fermeture exclusive par section)
 *     - Animations au scroll (IntersectionObserver)
 *     - Defilement fluide pour les ancres internes
 *
 *  4. Modale de contact avec formulaire (envoi via Netlify Function)
 *
 *  Dependances :
 *  - js/core/config.js           : Cles Supabase (charge dynamiquement)
 *  - js/vendor/supabase.js       : SDK Supabase (charge dynamiquement)
 *  - js/services/supabase-client.js : Client Supabase (charge dynamiquement)
 *  - js/services/supabase-sync.js   : Synchronisation donnees (charge dynamiquement)
 *  - js/core/cookie-consent.js   : Banniere RGPD (charge dans le HTML)
 *  - partials/header.html        : En-tete du site
 *  - partials/footer.html        : Pied de page standard
 *  - partials/footer-minimal.html: Pied de page compact (page commande)
 *  - partials/contact-modal.html : Modale de contact
 *
 *  Flux d'execution :
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ 1. IIFE loadSupabaseSync()   → charge la chaine Supabase│
 *  │ 2. DOMContentLoaded          → loadPartials()           │
 *  │ 3. Partials charges          → initAfterPartialsLoaded()│
 *  │    ├─ initHeader()           → effet scroll header      │
 *  │    ├─ initMobileNav()        → menu hamburger           │
 *  │    └─ initCartIndicator()    → badge panier             │
 *  │ 4. Composants autonomes      → accordeons, animations   │
 *  │ 5. Ecouteurs globaux         → modale contact, clavier  │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  Note importante : Ce fichier necessite un serveur HTTP.
 *  Les appels fetch() ne fonctionnent pas avec le protocole file://.
 *
 * ========================================================================== */


/* ===========================================================================
 *  SECTION 1 : CHARGEMENT DYNAMIQUE DE SUPABASE
 *  ---------------------------------------------------------------------------
 *  Charge la pile Supabase en sequence (async/await) :
 *  config.js → SDK supabase.js → supabase-client.js → supabase-sync.js
 *
 *  Cette IIFE async s'execute immediatement au chargement du script,
 *  avant DOMContentLoaded, pour que les donnees Supabase soient
 *  disponibles le plus tot possible.
 *
 *  En cas d'echec a n'importe quelle etape (fichier absent, erreur
 *  reseau), le site continue en mode degrade sans acces base de donnees.
 *
 *  Note : cookie-consent.js est charge directement dans les pages HTML
 *  et ne fait pas partie de cette chaine de chargement.
 * =========================================================================== */

/**
 * Charge un script dynamiquement — delegue a MistralUtils.loadScript
 * qui inclut un cache pour eviter les doublons.
 *
 * @param {string} src - URL du script a charger
 * @returns {Promise<void>}
 */
function loadScript(src) {
  if (window.MistralUtils && MistralUtils.loadScript) {
    return MistralUtils.loadScript(src);
  }
  // Fallback si utils.js n'est pas encore charge (ne devrait pas arriver)
  return new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = function () { reject(new Error('Echec chargement : ' + src)); };
    document.head.appendChild(script);
  });
}

/**
 * Charge dynamiquement les modules Supabase en chaine sequentielle (async).
 *
 * Ordre :
 *   1. config.js       — Configuration (URL, cles API)
 *   2. supabase.js     — SDK officiel Supabase v2
 *   3. supabase-client.js — Initialisation du client Supabase
 *   4. supabase-sync.js   — Synchronisation des donnees en memoire
 *
 * Utilise un verrou (window.supabaseLoading) pour empecher les
 * chargements multiples, et verifie si MistralSync existe deja
 * (cas de admin.html qui charge ses propres scripts).
 *
 * En cas d'echec a n'importe quelle etape, le site continue en mode
 * degrade sans acces base de donnees.
 *
 * @function loadSupabaseSync
 * @returns {void}
 */
(async function loadSupabaseSync() {
  // Ne pas recharger si deja present (ex: admin.html)
  if (window.MistralSync || window.supabaseLoading) return;
  window.supabaseLoading = true;

  try {
    // config.js et supabase.js sont independants : chargement parallele
    // Economise ~150-300ms de latence reseau
    await Promise.all([
      loadScript('js/core/config.js?v=3.5.3'),
      loadScript('js/vendor/supabase.js?v=3.5.3')
    ]);
    // supabase-client.js depend de config.js + supabase.js
    await loadScript('js/services/supabase-client.js?v=3.5.3');
    // supabase-sync.js depend de supabase-client.js
    await loadScript('js/services/supabase-sync.js?v=3.5.3');
  } catch (err) {
    console.warn('[Main] Supabase init echoue, mode degrade :', err.message);
    window.supabaseLoading = false;
  }
})();


/* ===========================================================================
 *  SECTION 2 : CONFIGURATION
 *  ---------------------------------------------------------------------------
 *  Constantes globales utilisees par le systeme de chargement des partials.
 * =========================================================================== */

/**
 * Chemin relatif vers le repertoire contenant les fichiers HTML partiels.
 * Utilise par loadPartial() pour construire les URLs de fetch.
 *
 * @constant {string}
 */
const PARTIALS_PATH = 'partials/';


/* ===========================================================================
 *  SECTION 3 : SYSTEME DE CHARGEMENT DES PARTIALS
 *  ---------------------------------------------------------------------------
 *  Charge les fragments HTML reutilisables (header, footer, modale)
 *  via fetch() et les injecte dans les conteneurs prevus dans chaque page.
 *
 *  Les conteneurs attendus dans le HTML :
 *    <div id="site-header"></div>
 *    <div id="site-footer"></div>
 *    <div id="contact-modal-container"></div>
 *
 *  Le type de footer est determine par l'attribut data-footer sur <body> :
 *    - data-footer="minimal" → footer-minimal.html (page commande)
 *    - absent ou "normal"    → footer.html (toutes les autres pages)
 *
 *  Apres injection du HTML, les composants dependant des partials
 *  (header, navigation, panier) sont reinitialises via
 *  initAfterPartialsLoaded().
 * =========================================================================== */

/**
 * Charge tous les partials HTML de la page en parallele.
 *
 * Detecte la page courante pour mettre en surbrillance le lien de
 * navigation actif, determine le type de footer a charger, puis
 * lance les requetes fetch() simultanement via Promise.all().
 *
 * Une fois tous les partials injectes dans le DOM, appelle
 * initAfterPartialsLoaded() pour initialiser les composants
 * qui dependent du contenu des partials (header scroll, menu mobile,
 * badge panier).
 *
 * @async
 * @function loadPartials
 * @returns {Promise<void>} Resolue quand tous les partials sont charges et les composants initialises
 */
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
 * Charge un fichier partial HTML depuis le serveur via fetch().
 *
 * En cas d'erreur reseau ou de fichier introuvable (status != 200),
 * retourne une chaine vide pour ne pas bloquer le rendu de la page.
 * Les erreurs sont consignees dans la console avec un niveau warn.
 *
 * @async
 * @function loadPartial
 * @param {string} filename - Nom du fichier partial a charger (ex: 'header.html')
 * @returns {Promise<string>} Contenu HTML du partial, ou chaine vide en cas d'erreur
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
 * Determine le nom de la page courante a partir de l'URL.
 *
 * Extrait le nom du fichier depuis window.location.pathname,
 * puis retire l'extension .html. Si le chemin se termine par '/'
 * (racine du site), retourne 'index' par defaut.
 *
 * Exemples :
 *   '/boutique.html'  → 'boutique'
 *   '/galerie.html'   → 'galerie'
 *   '/'               → 'index'
 *   '/admin.html'     → 'admin'
 *
 * @function getCurrentPageName
 * @returns {string} Nom de la page courante sans extension (ex: 'boutique', 'index')
 */
function getCurrentPageName() {
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  return filename.split('.html')[0] || 'index';
}

/**
 * Met en surbrillance le lien de navigation correspondant a la page courante.
 *
 * Parcourt tous les elements <a> avec la classe .nav__link et un attribut
 * data-page. Compare la valeur de data-page avec le nom de la page courante
 * et ajoute/retire la classe CSS 'active' en consequence.
 *
 * @function setActiveNavLink
 * @param {string} currentPage - Nom de la page courante (ex: 'boutique', 'index')
 * @returns {void}
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
 * Initialise les composants qui dependent du contenu des partials.
 *
 * Appelee apres que tous les partials (header, footer, modale) ont ete
 * injectes dans le DOM. Lance l'initialisation de :
 *   - L'effet de scroll sur le header
 *   - Le menu hamburger pour la navigation mobile
 *   - Le badge indicateur de panier dans le header
 *
 * @function initAfterPartialsLoaded
 * @returns {void}
 */
function initAfterPartialsLoaded() {
  initHeader();
  initMobileNav();
  initCartIndicator();
}


/* ===========================================================================
 *  SECTION 4 : INDICATEUR PANIER (HEADER)
 *  ---------------------------------------------------------------------------
 *  Affiche un badge numerique sur l'icone panier dans le header.
 *  Le badge est masque quand le panier est vide (display: none)
 *  et visible avec le nombre d'articles quand il y en a (display: flex).
 *
 *  Ecoute l'evenement personnalise 'cart-updated' dispatche par le
 *  module MistralCart (js/pages/boutique.js) pour mettre a jour
 *  le compteur en temps reel.
 * =========================================================================== */

/**
 * Initialise l'indicateur de panier dans le header.
 *
 * Cree une fonction interne updateBadge() qui :
 *   1. Recupere les elements DOM du panier (#nav-cart et #nav-cart-count)
 *   2. Interroge MistralCart.getItemCount() si le module est disponible
 *   3. Affiche ou masque le badge selon le nombre d'articles
 *
 * L'indicateur est mis a jour immediatement a l'initialisation,
 * puis a chaque evenement 'cart-updated' sur window.
 *
 * @function initCartIndicator
 * @returns {void}
 */
function initCartIndicator() {
  /**
   * Met a jour le badge du panier dans le header.
   *
   * Verifie l'existence du module MistralCart (qui peut ne pas etre
   * charge sur toutes les pages) et met a jour l'affichage en consequence.
   *
   * @inner
   * @function updateBadge
   * @returns {void}
   */
  function updateBadge() {
    const cartEl = document.getElementById('nav-cart');
    const countEl = document.getElementById('nav-cart-count');
    if (!cartEl || !countEl) return;

    const count = (typeof MistralCart !== 'undefined') ? MistralCart.getItemCount() : 0;
    if (count > 0) {
      cartEl.style.display = 'flex';
      countEl.textContent = count;
    } else {
      cartEl.style.display = 'none';
    }
  }

  // Initial update
  updateBadge();

  // Listen for cart changes
  window.addEventListener('cart-updated', updateBadge);
}


/* ===========================================================================
 *  SECTION 5 : POINT D'ENTREE PRINCIPAL (DOMContentLoaded)
 *  ---------------------------------------------------------------------------
 *  Orchestrateur principal : attend que le DOM soit pret, charge les partials,
 *  puis initialise les composants autonomes (qui ne dependent pas des partials).
 *
 *  Ordre d'execution :
 *    1. loadPartials()        → header, footer, modale (+ composants dependants)
 *    2. initAccordions()      → composants accordeon sur la page
 *    3. initScrollAnimations()→ animations d'apparition au scroll
 *    4. initSmoothScroll()    → defilement fluide pour les liens ancres
 * =========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  // Charger les partials d'abord
  await loadPartials();

  // Puis initialiser les autres composants
  initAccordions();
  initScrollAnimations();
  initSmoothScroll();

  // WebP detection : remplace les background-image JPG/PNG par WebP si supporté
  (function() {
    const testWebP = new Image();
    testWebP.onload = function() {
      if (testWebP.width > 0) {
        document.querySelectorAll('[style*="background-image"]').forEach(function(el) {
          const style = el.getAttribute('style');
          if (style && /\.(jpg|jpeg|png)/.test(style)) {
            el.setAttribute('style', style.replace(/\.(jpg|jpeg|png)/gi, '.webp'));
          }
        });
      }
    };
    testWebP.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
  })();
});


/* ===========================================================================
 *  SECTION 6 : EFFET DE SCROLL SUR LE HEADER
 *  ---------------------------------------------------------------------------
 *  Ajoute la classe CSS 'scrolled' au header quand l'utilisateur
 *  fait defiler la page au-dela de 50 pixels. Cette classe permet
 *  d'appliquer un style visuel different (fond opaque, ombre, etc.)
 *  via CSS.
 *
 *  L'ecouteur utilise l'option { passive: true } pour optimiser les
 *  performances du scroll (indique au navigateur qu'on n'appellera
 *  pas preventDefault()).
 * =========================================================================== */

/**
 * Initialise l'effet visuel du header au scroll.
 *
 * Attache un ecouteur passif sur l'evenement 'scroll' de window.
 * Quand le defilement vertical depasse 50px, ajoute la classe 'scrolled'
 * a l'element .header ; la retire quand on revient en haut.
 *
 * @function initHeader
 * @returns {void}
 */
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


/* ===========================================================================
 *  SECTION 7 : NAVIGATION MOBILE (MENU HAMBURGER)
 *  ---------------------------------------------------------------------------
 *  Gere l'ouverture et la fermeture du menu de navigation sur mobile.
 *
 *  Trois mecanismes de fermeture :
 *    1. Clic sur le bouton hamburger (toggle)
 *    2. Clic sur un lien de navigation (fermeture automatique)
 *    3. Clic en dehors du menu et du bouton (fermeture par defaut)
 *
 *  L'attribut aria-expanded est mis a jour pour l'accessibilite.
 * =========================================================================== */

/**
 * Initialise la navigation mobile (menu hamburger).
 *
 * Configure les ecouteurs d'evenements pour :
 *   - Le bouton toggle (.nav__toggle) : ouvre/ferme le menu
 *   - Les liens de navigation (.nav__link) : ferment le menu au clic
 *   - Le document entier : ferme le menu quand on clique en dehors
 *
 * Met a jour l'attribut aria-expanded sur le bouton toggle pour
 * communiquer l'etat du menu aux technologies d'assistance.
 *
 * @function initMobileNav
 * @returns {void}
 */
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


/* ===========================================================================
 *  SECTION 8 : COMPOSANTS ACCORDEON
 *  ---------------------------------------------------------------------------
 *  Gere les accordeons (FAQ, sections repliables) avec un comportement
 *  exclusif : au sein d'un meme parent, un seul accordeon peut etre
 *  ouvert a la fois. L'ouverture d'un accordeon ferme automatiquement
 *  les autres du meme groupe.
 *
 *  Structure HTML attendue :
 *    <div class="accordion">
 *      <div class="accordion__header" aria-expanded="false">Titre</div>
 *      <div class="accordion__content">Contenu</div>
 *    </div>
 *
 *  La classe CSS 'open' sur .accordion controle la visibilite du contenu.
 * =========================================================================== */

/**
 * Initialise tous les composants accordeon de la page.
 *
 * Pour chaque element .accordion trouve dans le DOM :
 *   1. Recupere le header (.accordion__header) et le contenu (.accordion__content)
 *   2. Attache un ecouteur de clic sur le header
 *   3. Au clic : ferme tous les autres accordeons ouverts dans le meme parent,
 *      puis bascule l'etat ouvert/ferme de l'accordeon clique
 *   4. Met a jour l'attribut aria-expanded pour l'accessibilite
 *
 * Algorithme de fermeture exclusive :
 *   - On recupere le parentElement de l'accordeon clique
 *   - On cherche tous les .accordion.open dans ce parent
 *   - On ferme ceux qui ne sont pas l'accordeon clique
 *   - Puis on bascule l'accordeon clique
 *
 * @function initAccordions
 * @returns {void}
 */
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


/* ===========================================================================
 *  SECTION 9 : DEFILEMENT FLUIDE (SMOOTH SCROLL)
 *  ---------------------------------------------------------------------------
 *  Intercepte les clics sur les liens ancres (href="#...") et remplace
 *  le comportement par defaut du navigateur par un defilement anime
 *  via scrollIntoView({ behavior: 'smooth' }).
 *
 *  Les liens avec href="#" seul (souvent utilises comme placeholders)
 *  sont ignores pour eviter un scroll vers le haut de page involontaire.
 * =========================================================================== */

/**
 * Initialise le defilement fluide pour les liens ancres internes.
 *
 * Parcourt tous les liens <a> dont le href commence par '#',
 * et attache un ecouteur de clic qui :
 *   1. Ignore les liens avec href="#" seul (pas de cible)
 *   2. Cherche l'element cible dans le DOM via querySelector
 *   3. Si trouve, empeche le comportement par defaut et declenche
 *      un scrollIntoView avec animation fluide
 *
 * @function initSmoothScroll
 * @returns {void}
 */
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


/* ===========================================================================
 *  SECTION 10 : ANIMATIONS AU SCROLL (INTERSECTION OBSERVER)
 *  ---------------------------------------------------------------------------
 *  Utilise l'API IntersectionObserver pour declencher des animations
 *  CSS quand les elements entrent dans la zone visible (viewport).
 *
 *  Fonctionnement :
 *    1. On observe tous les elements avec la classe .animate-on-scroll
 *    2. Quand un element entre a 10% dans le viewport (threshold: 0.1),
 *       on lui ajoute la classe .animate-in
 *    3. L'element est immediatement desobserve (animation unique, pas de replay)
 *
 *  Le rootMargin '-50px' en bas cree un offset : l'animation se declenche
 *  50px avant que l'element n'atteigne le bord inferieur du viewport,
 *  ce qui donne un effet plus naturel (l'element est deja partiellement
 *  visible quand l'animation demarre).
 * =========================================================================== */

/**
 * Initialise les animations d'apparition au scroll via IntersectionObserver.
 *
 * Cree un observateur avec :
 *   - threshold: 0.1  → se declenche quand 10% de l'element est visible
 *   - rootMargin: '0px 0px -50px 0px' → offset de 50px depuis le bas
 *
 * Pour chaque element .animate-on-scroll observe :
 *   - Quand il entre dans le viewport : ajoute la classe .animate-in
 *   - Desinscrit immediatement l'element (animation one-shot)
 *
 * Les transitions CSS associees a .animate-in sont definies dans
 * css/style.css (opacity, transform, etc.).
 *
 * @function initScrollAnimations
 * @returns {void}
 */
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


/* ===========================================================================
 *  SECTION 11 : FORMULAIRE DE CONTACT
 *  ---------------------------------------------------------------------------
 *  Gere l'envoi du formulaire de contact via la Netlify Function
 *  /.netlify/functions/send-email (Brevo SMTP).
 *
 *  Le formulaire inclut un champ honeypot ('website') pour la protection
 *  anti-spam sans dependance externe (pas de reCAPTCHA).
 *
 *  Flux d'envoi :
 *    1. L'utilisateur remplit le formulaire dans la modale
 *    2. Au submit : le bouton est desactive, texte "Envoi en cours..."
 *    3. Les donnees sont envoyees en POST JSON a la Netlify Function
 *    4. Succes : message de confirmation, reset du formulaire,
 *       fermeture automatique de la modale apres 2 secondes
 *    5. Erreur : message d'erreur avec suggestion de contact direct
 *    6. Dans tous les cas : le bouton est reactive
 *
 *  L'attribut data-initialized empeche l'initialisation multiple
 *  du formulaire (la modale peut etre ouverte/fermee plusieurs fois).
 * =========================================================================== */

/**
 * Initialise le formulaire de contact avec gestion de l'envoi asynchrone.
 *
 * Verifie que le formulaire existe et n'a pas deja ete initialise
 * (via data-initialized). Attache un ecouteur 'submit' qui :
 *   1. Empeche la soumission HTML native (e.preventDefault)
 *   2. Desactive le bouton d'envoi et affiche un indicateur de chargement
 *   3. Collecte les donnees du formulaire (prenom, nom, email, tel, message, honeypot)
 *   4. Envoie les donnees en POST JSON a la Netlify Function send-email
 *   5. Gere le succes (message, reset, fermeture auto) ou l'erreur (message d'erreur)
 *   6. Reactive le bouton d'envoi dans tous les cas
 *
 * @function initContactForm
 * @returns {void}
 */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form || form.dataset.initialized) return;
  form.dataset.initialized = 'true';

  // Validation en temps reel (onblur)
  MistralValidation.attach(form);

  const submitBtn = document.getElementById('contact-submit');
  const statusDiv = document.getElementById('contact-status');
  const modal = document.getElementById('contact-modal');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Désactiver le bouton
    submitBtn.disabled = true;
    submitBtn.classList.add('btn--loading');
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
    submitBtn.classList.remove('btn--loading');
    submitBtn.textContent = 'Envoyer';
  });
}


/* ===========================================================================
 *  SECTION 12 : MODALE DE CONTACT (OUVERTURE / FERMETURE)
 *  ---------------------------------------------------------------------------
 *  Ecouteurs globaux (attaches au document) pour gerer la modale de contact.
 *
 *  Ouverture :
 *    - Tout element avec l'attribut data-modal="contact" ouvre la modale
 *    - Le formulaire est initialise avec un leger delai (setTimeout 100ms)
 *      pour s'assurer que le DOM de la modale est visible
 *    - Le scroll du body est verrouille (overflow: hidden)
 *
 *  Fermeture (3 mecanismes) :
 *    1. Clic sur le fond semi-transparent de la modale (overlay)
 *    2. Clic sur le bouton de fermeture (.modal__close)
 *    3. Touche Echap (Escape) au clavier
 *
 *  A la fermeture, le scroll du body est retabli (overflow: '').
 * =========================================================================== */

/**
 * Ecouteur global de clic pour l'ouverture et la fermeture de la modale de contact.
 *
 * Gere deux cas dans le meme ecouteur :
 *   1. Clic sur un declencheur [data-modal="contact"] → ouvre la modale
 *   2. Clic sur le fond de la modale ou le bouton .modal__close → ferme la modale
 *
 * L'utilisation d'un ecouteur global sur le document (delegation d'evenements)
 * permet de gerer les elements dynamiquement ajoutes au DOM (partials charges
 * via fetch), sans avoir a rattacher les ecouteurs apres chaque chargement.
 *
 * @listens document#click
 */
/**
 * Focus Trap — Piege le focus clavier a l'interieur d'un element (modale, lightbox).
 *
 * Conforme WCAG 2.4.3 (Focus Order). Quand une modale est ouverte, le focus
 * ne peut pas sortir du conteneur via Tab/Shift+Tab. Le focus revient au
 * premier element focusable apres le dernier, et inversement.
 *
 * @namespace MistralFocusTrap
 */
const MistralFocusTrap = (function() {
  /** @type {HTMLElement|null} Element ou le focus etait avant l'ouverture */
  let _previousFocus = null;

  /** @type {HTMLElement|null} Conteneur actif du piege */
  let _trapContainer = null;

  /** Selecteur CSS des elements focusables */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * Retourne les elements focusables visibles dans un conteneur.
   * @param {HTMLElement} container
   * @returns {HTMLElement[]}
   */
  function getFocusable(container) {
    const els = Array.from(container.querySelectorAll(FOCUSABLE));
    return els.filter(function(el) {
      return el.offsetParent !== null && !el.closest('[aria-hidden="true"]');
    });
  }

  /**
   * Gestionnaire keydown pour pieger Tab/Shift+Tab.
   * @param {KeyboardEvent} e
   */
  function handleKeydown(e) {
    if (e.key !== 'Tab' || !_trapContainer) return;

    const focusable = getFocusable(_trapContainer);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab : du premier element → revenir au dernier
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab : du dernier element → revenir au premier
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /**
   * Active le piege de focus sur un conteneur.
   * Sauvegarde le focus actuel et deplace le focus dans la modale.
   *
   * @param {HTMLElement} container - Element contenant la modale/lightbox
   */
  function activate(container) {
    if (!container) return;

    _previousFocus = document.activeElement;
    _trapContainer = container;

    document.addEventListener('keydown', handleKeydown);

    // Deplacer le focus vers le premier element focusable (apres le rendu)
    setTimeout(function() {
      const focusable = getFocusable(container);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }, 50);
  }

  /**
   * Desactive le piege de focus et restaure le focus precedent.
   */
  function deactivate() {
    document.removeEventListener('keydown', handleKeydown);
    _trapContainer = null;

    // Restaurer le focus sur l'element qui a ouvert la modale
    if (_previousFocus && typeof _previousFocus.focus === 'function') {
      _previousFocus.focus();
    }
    _previousFocus = null;
  }

  return { activate: activate, deactivate: deactivate };
})();

// Exposer globalement pour admin-ui-modals.js et galerie-admin.js
window.MistralFocusTrap = MistralFocusTrap;

/**
 * Validation en temps reel des formulaires (onblur).
 *
 * Ajoute un feedback visuel immediat quand l'utilisateur quitte un champ :
 * - Champ invalide : bordure rouge + message d'erreur sous le champ
 * - Champ valide : bordure verte (succes)
 * - Champ vide non-required : pas de feedback
 *
 * Utilise les attributs HTML5 natifs (required, type, pattern, minlength, maxlength)
 * pour la validation. Pas de regex custom — on s'appuie sur le navigateur.
 *
 * @example
 * // Activer sur un formulaire
 * MistralValidation.attach(document.getElementById('contact-form'));
 *
 * @namespace MistralValidation
 */
const MistralValidation = (function() {
  /**
   * Messages d'erreur personnalises par type de validation.
   * @type {Object<string, string>}
   */
  const MESSAGES = {
    valueMissing: 'Ce champ est obligatoire.',
    typeMismatch_email: 'Veuillez saisir une adresse email valide.',
    typeMismatch_tel: 'Veuillez saisir un numéro de téléphone valide.',
    typeMismatch_url: 'Veuillez saisir une URL valide.',
    typeMismatch: 'Le format saisi est incorrect.',
    tooShort: 'Ce champ est trop court (minimum {min} caractères).',
    tooLong: 'Ce champ est trop long (maximum {max} caractères).',
    patternMismatch: 'Le format saisi est incorrect.'
  };

  /**
   * Retourne le message d'erreur pour un champ invalide.
   * @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} field
   * @returns {string}
   */
  function getMessage(field) {
    const v = field.validity;
    if (!v || v.valid) return '';

    if (v.valueMissing) return MESSAGES.valueMissing;
    if (v.typeMismatch) {
      const typeKey = 'typeMismatch_' + field.type;
      return MESSAGES[typeKey] || MESSAGES.typeMismatch;
    }
    if (v.tooShort) return MESSAGES.tooShort.replace('{min}', field.minLength);
    if (v.tooLong) return MESSAGES.tooLong.replace('{max}', field.maxLength);
    if (v.patternMismatch) return MESSAGES.patternMismatch;
    return field.validationMessage || MESSAGES.typeMismatch;
  }

  /**
   * Valide un champ et affiche/masque le feedback visuel.
   * @param {HTMLElement} field
   */
  function validateField(field) {
    // Ignorer les champs caches (honeypot, hidden)
    if (field.type === 'hidden' || field.tabIndex === -1) return;
    if (field.offsetParent === null) return;

    // Pas de feedback si le champ est vide et non-required
    const value = field.value.trim();
    if (!value && !field.required) {
      clearFeedback(field);
      return;
    }

    const group = field.closest('.form-group');
    let errorEl = group ? group.querySelector('.form-error') : null;

    if (!field.checkValidity()) {
      // Invalide
      field.classList.add('is-invalid');
      field.classList.remove('is-valid');
      field.setAttribute('aria-invalid', 'true');

      // Creer ou afficher le message d'erreur
      const msg = getMessage(field);
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.add('visible');
      } else if (group) {
        errorEl = document.createElement('p');
        errorEl.className = 'form-error visible';
        errorEl.setAttribute('role', 'alert');
        errorEl.textContent = msg;
        group.appendChild(errorEl);
      }

      // aria-describedby pour accessibilite
      if (errorEl && errorEl.id) {
        field.setAttribute('aria-describedby', errorEl.id);
      }
    } else {
      // Valide
      field.classList.remove('is-invalid');
      field.classList.add('is-valid');
      field.removeAttribute('aria-invalid');

      if (errorEl) {
        errorEl.classList.remove('visible');
        errorEl.textContent = '';
      }
    }
  }

  /**
   * Supprime tout feedback visuel d'un champ.
   * @param {HTMLElement} field
   */
  function clearFeedback(field) {
    field.classList.remove('is-invalid', 'is-valid');
    field.removeAttribute('aria-invalid');

    const group = field.closest('.form-group');
    if (group) {
      const errorEl = group.querySelector('.form-error');
      if (errorEl) {
        errorEl.classList.remove('visible');
        errorEl.textContent = '';
      }
    }
  }

  /**
   * Attache la validation onblur a tous les champs d'un formulaire.
   * Ajoute aussi une re-validation sur input pour effacer les erreurs rapidement.
   *
   * @param {HTMLFormElement} form
   */
  function attach(form) {
    if (!form || form._mistralValidation) return;

    const fields = form.querySelectorAll('input, textarea, select');
    fields.forEach(function(field) {
      // Valider quand l'utilisateur quitte le champ
      field.addEventListener('blur', function() {
        validateField(field);
      });

      // Re-valider en saisissant (apres premiere erreur seulement)
      field.addEventListener('input', function() {
        if (field.classList.contains('is-invalid')) {
          validateField(field);
        }
      });
    });

    // Empecher la soumission par defaut si invalide (renforcement)
    form.setAttribute('novalidate', '');
    form._mistralValidation = true;
  }

  return { attach: attach, validateField: validateField, clearFeedback: clearFeedback };
})();

window.MistralValidation = MistralValidation;

/**
 * Systeme de toast notifications global.
 *
 * Affiche des messages temporaires en haut de page pour informer
 * l'utilisateur du resultat d'une action (succes, erreur, alerte, info).
 *
 * @example
 * MistralToast.success('Votre message a été envoyé !');
 * MistralToast.error('Une erreur est survenue.');
 * MistralToast.warning('Attention, stock limité.');
 * MistralToast.info('Redirection en cours...');
 *
 * @namespace MistralToast
 */
const MistralToast = (function() {
  /** @type {HTMLElement|null} */
  let container = null;

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  /** Echappe les caracteres HTML pour eviter XSS */
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function ensureContainer() {
    if (container) return;
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  /**
   * Affiche un toast.
   * @param {string} message - Texte du message
   * @param {'success'|'error'|'warning'|'info'} type - Type de notification
   * @param {number} [duration=4000] - Duree d'affichage en ms (0 = pas d'auto-fermeture)
   * @returns {HTMLElement} Element toast cree
   */
  function show(message, type, duration) {
    ensureContainer();
    if (typeof duration === 'undefined') duration = 4000;

    const toast = document.createElement('div');
    toast.className = 'toast toast--' + (type || 'info');
    toast.setAttribute('role', 'alert');

    toast.innerHTML =
      '<span class="toast__icon">' + (ICONS[type] || ICONS.info) + '</span>' +
      '<span class="toast__message">' + esc(message) + '</span>' +
      '<button class="toast__close" aria-label="Fermer">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
        '</svg>' +
      '</button>';

    container.appendChild(toast);

    // Animation d'entree
    requestAnimationFrame(function() {
      toast.classList.add('show');
    });

    // Fermer au clic
    toast.querySelector('.toast__close').addEventListener('click', function() {
      hide(toast);
    });

    // Auto-fermeture
    if (duration > 0) {
      setTimeout(function() { hide(toast); }, duration);
    }

    return toast;
  }

  function hide(toast) {
    toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 300);
  }

  return {
    show: show,
    success: function(msg, d) { return show(msg, 'success', d); },
    error: function(msg, d) { return show(msg, 'error', d); },
    warning: function(msg, d) { return show(msg, 'warning', d); },
    info: function(msg, d) { return show(msg, 'info', d); }
  };
})();

window.MistralToast = MistralToast;

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
      // Activer le piege de focus (WCAG 2.4.3)
      MistralFocusTrap.activate(modal);

      // Pré-remplir le message si demande de suppression RGPD
      var rgpdNotice = document.getElementById('contact-rgpd-notice');
      if (trigger.hasAttribute('data-rgpd-delete')) {
        var modalTitle = modal.querySelector('.modal__title');
        if (modalTitle) modalTitle.textContent = 'Suppression de données';
        if (rgpdNotice) rgpdNotice.style.display = '';
        setTimeout(function() {
          var messageField = document.getElementById('contact-message');
          if (messageField) {
            messageField.value = 'Bonjour,\n\nJe souhaite exercer mon droit à l\'effacement de mes données personnelles conformément à l\'article 17 du RGPD.\n\nMerci de bien vouloir supprimer l\'ensemble des données me concernant.\n\nCordialement';
          }
        }, 150);
      } else {
        var modalTitle = modal.querySelector('.modal__title');
        if (modalTitle) modalTitle.textContent = 'Contact';
        if (rgpdNotice) rgpdNotice.style.display = 'none';
      }
    }
  }

  // Fermer au clic sur le fond ou le bouton fermer
  const modal = document.getElementById('contact-modal');
  if (modal && modal.classList.contains('open')) {
    if (e.target === modal || e.target.closest('.modal__close')) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      MistralFocusTrap.deactivate();
    }
  }
});

/**
 * Ecouteur global de clavier pour la fermeture de la modale via la touche Echap.
 *
 * Verifie si la modale de contact est ouverte et la ferme quand
 * l'utilisateur appuie sur la touche Escape. Retablit le scroll du body.
 *
 * @listens document#keydown
 */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('contact-modal');
    if (modal && modal.classList.contains('open')) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      MistralFocusTrap.deactivate();
    }
  }
});
