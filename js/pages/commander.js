/**
 * =============================================================================
 * MISTRAL PANS - Page Commander (Commande & Paiement)
 * =============================================================================
 *
 * Module principal de la page commander.html.
 * Gere l'ensemble du parcours de commande : du recapitulatif produit au paiement.
 *
 * Deux parcours d'achat :
 *   1. Instrument sur mesure (custom) : l'utilisateur configure un handpan via
 *      le configurateur (boutique.html), puis arrive ici avec les parametres URL.
 *      -> Seul le mode acompte 30% est propose.
 *   2. Instrument en stock : l'utilisateur choisit un instrument disponible
 *      dans la vitrine stock, arrive ici avec type=stock.
 *      -> Paiement integral, acompte, ou Oney 3x/4x.
 *
 * Modes de paiement supportes :
 *   - Acompte 30% (sur mesure) : via PayPlug (integre ou heberge)
 *   - Paiement integral (stock) : via PayPlug redirection
 *   - Oney 3x/4x (stock, 100-3000 EUR) : via PayPlug redirection
 *   - Rendez-vous a l'atelier : formulaire de contact (email Brevo)
 *   - Fallback email : si PayPlug est indisponible, envoi par email
 *
 * Systeme de panier :
 *   - Mode legacy : un seul article via parametres URL
 *   - Mode panier : multi-articles via MistralCart (auto-detecte si panier non-vide)
 *
 * Livraison :
 *   - Colissimo (+50 EUR) : expedition postale
 *   - Retrait atelier (gratuit) : rendez-vous Calendly integre
 *
 * Dependances :
 *   - MistralPayplug  (js/services/payplug-client.js) - Paiement en ligne
 *   - MistralEmail     (js/services/email-client.js)   - Envoi d'emails
 *   - MistralCart       (js/features/cart.js)           - Panier multi-articles
 *   - MistralCookies    (js/core/cookie-consent.js)     - Consentement RGPD
 *
 * Flux principal :
 *   1. DOMContentLoaded -> initCart() -> parseUrlParams() ou renderCartItems()
 *   2. adaptUIForSource() -> affiche les options de paiement selon stock/custom
 *   3. L'utilisateur choisit livraison (colissimo/retrait)
 *   4. L'utilisateur choisit un mode de paiement et remplit le formulaire
 *   5. Soumission -> validation -> creation paiement PayPlug -> redirection
 *   6. Retour de paiement -> checkPaymentReturn() -> affichage resultat
 *
 * =============================================================================
 */

(function(window) {
  'use strict';

  // ===========================================================================
  // CONSTANTES (valeurs par defaut, surchargees par config admin apres sync)
  // ===========================================================================

  /** @type {number} Taux d'acompte pour les commandes sur mesure (ex: 0.30 = 30%) */
  let DEPOSIT_RATE = 0.30;

  /** @const {number} Montant minimum eligible au paiement Oney (en euros) */
  const ONEY_MIN = 100;

  /** @const {number} Montant maximum eligible au paiement Oney (en euros) */
  const ONEY_MAX = 3000;

  /** @type {number} Frais de livraison Colissimo (en euros) */
  let SHIPPING_COST = 50;

  /**
   * Lit les tarifs dynamiques depuis la config admin (Supabase).
   * Appele au chargement et apres mistral-sync-complete.
   */
  function loadPricingConfig() {
    var config = MistralUtils.getTarifsPublics();
    SHIPPING_COST = parseFloat(config.fraisExpeditionColissimo) || 50;
    DEPOSIT_RATE = (parseFloat(config.tauxAcompte) || 30) / 100;

    // Mettre a jour l'affichage du prix Colissimo
    var elShip = document.getElementById('shipping-colissimo-price');
    if (elShip) elShip.textContent = '+ ' + SHIPPING_COST + ' \u20AC';
  }

  // ===========================================================================
  // ETAT DE LA PAGE
  // ===========================================================================

  /**
   * Donnees de la commande en cours.
   * Initialise avec des valeurs par defaut, puis mis a jour par initCart()
   * ou parseUrlParams() selon le mode d'arrivee sur la page.
   *
   * @type {Object}
   * @property {string}      productName     - Nom affiche du produit
   * @property {number}      price           - Prix total des articles (sans livraison)
   * @property {number}      instrumentPrice - Prix de l'instrument seul (sans accessoires)
   * @property {string}      notes           - Description des notes de l'instrument
   * @property {string}      gamme           - Nom de la gamme selectionnee
   * @property {string}      taille          - Taille du handpan (ex: '53 cm')
   * @property {string}      tonalite        - Tonalite de base (ex: 'D')
   * @property {string}      materiau        - Materiau choisi (ex: 'Acier nitride')
   * @property {string}      accordage       - Frequence d'accordage (ex: '440 Hz')
   * @property {string}      source          - Provenance : 'stock' ou 'custom'
   * @property {string|null} instrumentId    - ID Supabase de l'instrument (stock uniquement)
   * @property {Object|null} housse          - Housse selectionnee { id, nom, prix } ou null
   * @property {string|null} shippingMethod  - Mode livraison : 'colissimo', 'retrait', ou null
   */
  let orderData = {
    productName: 'D Kurd 9 notes',
    price: 1400,           // Prix articles (sans livraison)
    instrumentPrice: 1400, // Prix instrument seul
    notes: '',
    gamme: '',
    taille: '53 cm',
    tonalite: '',
    materiau: '',
    accordage: '',
    source: 'custom',      // 'stock' ou 'custom'
    instrumentId: null,    // ID Supabase (stock uniquement)
    housse: null,          // { id, nom, prix } ou null
    shippingMethod: null   // 'colissimo' ou 'retrait' (obligatoire)
  };

  /**
   * Indicateur du mode panier (multi-items depuis MistralCart).
   * Active quand l'URL contient from=cart et que le panier n'est pas vide.
   * @type {boolean}
   */
  let cartMode = false;

  /**
   * Donnees du panier en mode multi-articles.
   * Structure fournie par MistralCart.getCheckoutData().
   * @type {Object|null}
   * @property {Array}  items      - Liste des articles du panier
   * @property {number} totalPrice - Prix total de tous les articles
   * @property {number} itemCount  - Nombre d'articles
   * @property {string} source     - Source du panier ('stock', 'custom', 'mixed')
   */
  let cartData = null;  // { items[], totalPrice, itemCount, source }

  /**
   * Indique si le formulaire de paiement integre PayPlug (iFrame CB) est pret.
   * Passe a true apres initIntegratedPaymentForm() si le SDK PayPlug est charge.
   * @type {boolean}
   */
  let integratedFormReady = false;

  /**
   * ID du paiement en attente pour le mode integre (evite de recreer un paiement
   * si l'utilisateur soumet a nouveau apres une erreur de carte).
   * @type {string|null}
   */
  let pendingPaymentId = null;

  /**
   * Nombre d'echeances Oney selectionne (3 ou 4).
   * Mis a jour par le selecteur radio dans le formulaire Oney.
   * @type {number}
   */
  let selectedInstallments = 3;

  // ============================================================================
  // CALCULS
  // ============================================================================

  /**
   * Calcule les frais de livraison selon le mode choisi.
   *
   * @returns {number} Frais de livraison en euros (50 pour Colissimo, 0 sinon)
   */
  function getShippingCost() {
    return orderData.shippingMethod === 'colissimo' ? SHIPPING_COST : 0;
  }

  /**
   * Calcule le montant total TTC incluant la livraison.
   *
   * @returns {number} Prix total = prix articles + frais de livraison
   */
  function getTotalWithShipping() {
    return orderData.price + getShippingCost();
  }

  /**
   * Calcule le montant de l'acompte (30% du total TTC).
   * Arrondi a l'entier le plus proche via Math.round().
   *
   * @returns {number} Montant de l'acompte en euros
   */
  function getDepositAmount() {
    return Math.round(getTotalWithShipping() * DEPOSIT_RATE);
  }

  /**
   * Convertit le montant de l'acompte en centimes pour l'API PayPlug.
   * PayPlug attend les montants en centimes d'euros (ex: 420 EUR = 42000 centimes).
   *
   * @returns {number} Montant de l'acompte en centimes
   */
  function getDepositAmountCents() {
    return getDepositAmount() * 100;
  }

  /**
   * Verifie si le montant total est eligible au paiement Oney.
   * Oney requiert un montant entre 100 EUR et 3000 EUR inclus.
   *
   * @returns {boolean} true si le total est dans la plage Oney
   */
  function isOneyEligible() {
    const total = getTotalWithShipping();
    return total >= ONEY_MIN && total <= ONEY_MAX;
  }

  /**
   * Calcule la repartition des echeances Oney (3x ou 4x).
   *
   * Algorithme :
   *   - Divise le total par le nombre d'echeances (arrondi vers le bas)
   *   - Le reste (centimes d'arrondi) est ajoute a la premiere echeance
   *   - Garantit que la somme des echeances = total exact
   *
   * Exemple pour 1450 EUR en 3x :
   *   base = floor(1450/3) = 483
   *   reste = 1450 - 483*3 = 1
   *   -> [484, 483, 483]
   *
   * @param {number} total - Montant total en euros
   * @param {number} n     - Nombre d'echeances (3 ou 4)
   * @returns {number[]} Tableau des montants par echeance (premiere echeance inclut le reste)
   */
  function computeInstallments(total, n) {
    const base = Math.floor(total / n);
    const remainder = total - base * n;
    const installments = [base + remainder];
    for (let i = 1; i < n; i++) {
      installments.push(base);
    }
    return installments;
  }

  /**
   * Verifie si la commande concerne un instrument en stock.
   *
   * @returns {boolean} true si source === 'stock'
   */
  function isStock() {
    return orderData.source === 'stock';
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  /**
   * Point d'entree principal.
   * Initialise tous les sous-systemes de la page dans l'ordre :
   *   1. Panier / parametres URL
   *   2. Formulaires de commande
   *   3. Selecteur Oney 3x/4x
   *   4. Formulaire de paiement integre (iFrame CB)
   *   5. Adaptation UI selon stock/custom
   *   6. Detection du retour de paiement PayPlug
   */
  document.addEventListener('DOMContentLoaded', function() {
    initCart();
    initForms();
    initOneySelector();
    initIntegratedPaymentForm();
    adaptUIForSource();
    checkPaymentReturn();
    loadDelaiFabrication();
    loadPricingConfig();
    bindInlineHandlers();
  });

  // Recharger les tarifs quand la config admin arrive de Supabase
  window.addEventListener('mistral-sync-complete', loadPricingConfig);

  /**
   * Remplace les onclick/onkeydown inline par des addEventListener (CSP-safe).
   * Couvre : options de paiement, options de livraison, lien fallback deposit.
   */
  function bindInlineHandlers() {
    // Options de paiement
    document.querySelectorAll('.order-option[data-option]').forEach(function(el) {
      var option = el.dataset.option;
      el.addEventListener('click', function() { window.selectOption(option); });
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.selectOption(option);
        }
      });
    });

    // Options de livraison
    document.querySelectorAll('.shipping-option[data-shipping]').forEach(function(el) {
      var method = el.dataset.shipping;
      el.addEventListener('click', function() { window.selectShipping(method); });
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.selectShipping(method);
        }
      });
    });

    // Lien fallback deposit (oney ineligible)
    var fallbackLink = document.getElementById('link-fallback-deposit');
    if (fallbackLink) {
      fallbackLink.addEventListener('click', function(e) {
        e.preventDefault();
        window.selectOption('deposit');
      });
    }
  }

  /**
   * Detecte le mode d'arrivee sur la page et initialise les donnees de commande.
   *
   * Trois cas :
   *   1. Panier non-vide (sessionStorage) : active le mode panier, peu importe l'URL
   *   2. Panier vide + from=cart : redirige vers la boutique
   *   3. Panier vide + pas from=cart : mode legacy (parametres URL du configurateur)
   *
   * En mode panier avec un seul article, les details sont copies dans orderData
   * pour la retrocompatibilite avec l'affichage single-product.
   */
  function initCart() {
    const params = new URLSearchParams(window.location.search);
    const hasCartItems = typeof MistralCart !== 'undefined' && !MistralCart.isEmpty();

    // Mode panier : si le panier contient des articles (sessionStorage fait foi)
    if (hasCartItems) {
      cartMode = true;
      cartData = MistralCart.getCheckoutData();

      // Synchroniser orderData avec le panier pour la compatibilité
      orderData.price = cartData.totalPrice;
      orderData.source = cartData.source;
      orderData.productName = cartData.items.map(function(i) { return i.nom; }).join(', ');

      // Si un seul instrument, remplir les détails
      if (cartData.items.length === 1) {
        const single = cartData.items[0];
        orderData.instrumentId = single.sourceId;
        orderData.instrumentPrice = single.prix;
        orderData.gamme = single.details.gamme || '';
        orderData.taille = single.details.taille || '';
        orderData.tonalite = single.details.tonalite || '';
        orderData.materiau = single.details.materiau || '';
        orderData.accordage = single.details.accordage || '';
      }

      renderCartItems();
      updateOrderDisplay();
    } else if (params.get('from') === 'cart') {
      // Arrivée depuis le lien panier mais panier vide → rediriger vers la boutique
      window.location.href = 'boutique.html';
    } else {
      // Mode legacy URL params
      parseUrlParams();
    }
  }

  /**
   * Parse les parametres URL pour initialiser orderData (mode legacy).
   *
   * Parametres supportes :
   *   - type          : 'stock' ou absent (-> 'custom')
   *   - instrument_id : ID Supabase de l'instrument
   *   - name/product  : Nom du produit ('name' prioritaire, 'product' legacy)
   *   - price         : Prix total (valide entre 1 et 20000 EUR)
   *   - instrument_price : Prix instrument seul
   *   - notes         : Description des notes
   *   - gamme/scale   : Gamme musicale
   *   - taille/size   : Taille du shell
   *   - tonalite/tonality : Tonalite de base
   *   - materiau/material : Materiau
   *   - accordage/tuning  : Frequence d'accordage
   *   - housse_id, housse_nom, housse_prix : Housse optionnelle
   *
   * Les noms anglais (scale, size, tonality, material, tuning) sont des aliases
   * legacy pour retrocompatibilite avec d'anciennes versions du configurateur.
   */
  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);

    // Source : stock ou custom
    orderData.source = params.get('type') === 'stock' ? 'stock' : 'custom';
    orderData.instrumentId = params.get('instrument_id') || null;

    // Nom produit (configurateur envoie 'name', anciennes URLs 'product')
    orderData.productName = params.get('name') || params.get('product') || orderData.productName;

    // Prix validé (1-20000€)
    const rawPrice = parseInt(params.get('price'));
    if (rawPrice && rawPrice >= 1 && rawPrice <= 20000) {
      orderData.price = rawPrice;
    }
    const rawInstrumentPrice = parseInt(params.get('instrument_price'));
    if (rawInstrumentPrice && rawInstrumentPrice >= 1 && rawInstrumentPrice <= 20000) {
      orderData.instrumentPrice = rawInstrumentPrice;
    } else {
      orderData.instrumentPrice = orderData.price;
    }

    // Config détaillée
    orderData.notes = params.get('notes') || '';
    orderData.gamme = params.get('gamme') || params.get('scale') || '';
    orderData.taille = params.get('taille') || params.get('size') || orderData.taille;
    orderData.tonalite = params.get('tonalite') || params.get('tonality') || '';
    orderData.materiau = params.get('materiau') || params.get('material') || '';
    orderData.accordage = params.get('accordage') || params.get('tuning') || '';

    // Housse
    if (params.get('housse_id')) {
      orderData.housse = {
        id: params.get('housse_id'),
        nom: params.get('housse_nom') || 'Housse',
        prix: parseInt(params.get('housse_prix')) || 0
      };
    }

    updateOrderDisplay();
  }

  // ============================================================================
  // PANIER - AFFICHAGE ET GESTION
  // ============================================================================

  /**
   * Genere le HTML du recapitulatif panier dans la zone #cart-items-summary.
   *
   * Affiche chaque item du panier avec :
   *   - Image ou icone par defaut
   *   - Nom, quantite, details (gamme, taille, categorie)
   *   - Options associees (housse, etc.)
   *   - Prix unitaire
   *   - Bouton de suppression
   *
   * Masque le recapitulatif single-product et affiche le recapitulatif panier.
   * Si le panier est vide, affiche un message avec lien vers la boutique.
   */
  function renderCartItems() {
    const cartSummary = document.getElementById('cart-items-summary');
    const singleSummary = document.getElementById('single-product-summary');
    const accessoriesSummary = document.getElementById('order-accessories');

    if (!cartSummary || !cartData) return;

    // Masquer le résumé single, afficher le résumé panier
    if (singleSummary) singleSummary.style.display = 'none';
    if (accessoriesSummary) accessoriesSummary.style.display = 'none';
    cartSummary.style.display = '';

    const listEl = document.getElementById('cart-items-list');
    if (!listEl) return;

    if (cartData.items.length === 0) {
      listEl.innerHTML = '<div class="cart-empty"><p>Votre panier est vide.</p><p><a href="boutique.html">Retourner à la boutique</a></p></div>';
      return;
    }

    // Construction du HTML pour chaque item du panier
    let html = '';
    cartData.items.forEach(function(item) {
      const typeLabels = { instrument: 'Instrument', accessoire: 'Accessoire', custom: 'Sur mesure' };
      let typeLabel = typeLabels[item.type] || '';

      // Assemblage des details selon le type d'article
      const detailParts = [];
      if (item.type === 'custom' || item.type === 'instrument') {
        // Nombre de notes (custom: details.notes, instrument: details.nombre_notes)
        var nbNotes = item.details.notes || item.details.nombre_notes;
        if (nbNotes) detailParts.push(nbNotes + ' notes');
        // Taille
        if (item.details.taille) detailParts.push(item.details.taille + ' cm');
        // Materiau (label lisible si MistralMateriaux dispo, sinon code)
        if (item.details.materiau) {
          var matLabel = (typeof MistralMateriaux !== 'undefined' && MistralMateriaux.getLabel)
            ? MistralMateriaux.getLabel(item.details.materiau)
            : item.details.materiau;
          detailParts.push(matLabel);
        }
        // Accordage (affiché seulement si non-standard)
        if (item.details.accordage && item.details.accordage !== '440') {
          detailParts.push(item.details.accordage + ' Hz');
        }
      } else {
        // Accessoire : categorie + taille
        if (item.details.categorie) detailParts.push(item.details.categorie);
        if (item.details.taille) detailParts.push(item.details.taille + ' cm');
      }
      const detailStr = detailParts.join(' · ');

      // Assemblage des options (housse, etc.)
      const optionsParts = [];
      if (item.options && item.options.length > 0) {
        item.options.forEach(function(opt) {
          if (opt.type === 'housse') optionsParts.push('+ ' + opt.nom + ' (' + formatPrice(opt.prix) + ')');
        });
      }
      const optionsStr = optionsParts.join(', ');

      // Image ou icone par defaut selon le type d'article
      const imageHtml = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.nom) + '">'
        : '<span style="font-size:1.5rem;opacity:0.3;">' + (item.type === 'accessoire' ? '🎒' : '🎵') + '</span>';

      // Indicateur de quantite si > 1
      const qtyHtml = item.quantite > 1 ? ' <span style="color:var(--color-text-muted);">x' + item.quantite + '</span>' : '';

      html += '<div class="cart-item" data-cart-id="' + escapeHtml(item.id) + '">' +
        '<div class="cart-item__image">' + imageHtml + '</div>' +
        '<div class="cart-item__info">' +
          '<div class="cart-item__name">' + escapeHtml(item.nom) + qtyHtml + '</div>' +
          (detailStr ? '<div class="cart-item__details">' + escapeHtml(typeLabel + (detailStr ? ' · ' + detailStr : '')) + '</div>' : '') +
          (optionsStr ? '<div class="cart-item__options">' + escapeHtml(optionsStr) + '</div>' : '') +
        '</div>' +
        '<div class="cart-item__price">' + formatPrice(item.total) + '</div>' +
        '<button class="cart-item__remove" onclick="removeCartItem(\'' + escapeHtml(item.id) + '\')" title="Retirer">&times;</button>' +
      '</div>';
    });

    listEl.innerHTML = html;

    const totalEl = document.getElementById('cart-items-total-price');
    if (totalEl) totalEl.textContent = formatPrice(getTotalWithShipping());
  }

  /**
   * Retire un article du panier et met a jour l'affichage.
   * Redirige vers la boutique si le panier devient vide.
   * Expose globalement pour les attributs onclick dans le HTML genere.
   *
   * @param {string} itemId - Identifiant unique de l'article a retirer
   */
  window.removeCartItem = function(itemId) {
    if (typeof MistralCart === 'undefined') return;
    MistralCart.removeItem(itemId);
    cartData = MistralCart.getCheckoutData();
    orderData.price = cartData.totalPrice;
    orderData.productName = cartData.items.map(function(i) { return i.nom; }).join(', ');

    if (cartData.items.length === 0) {
      // Panier vide : rediriger vers la boutique
      window.location.href = 'boutique.html';
      return;
    }

    renderCartItems();
    updateOrderDisplay();
  };

  // ============================================================================
  // ADAPTATION UI STOCK / SUR-MESURE
  // ============================================================================

  /**
   * Adapte l'interface selon le type de commande (stock vs sur-mesure).
   *
   * Differences entre les deux parcours :
   *   - Stock  : paiement integral + Oney + RDV (3 options en grille)
   *   - Custom : acompte 30% + RDV (2 options en grille)
   *
   * Adapte egalement :
   *   - Les badges ("Recommande" pour stock, "Populaire" pour acompte custom)
   *   - La description des options de paiement
   *   - Le texte du header ("Paiement" vs "Etape 1 sur 2")
   *   - La grille CSS (2, 3 ou 4 colonnes selon les options visibles)
   *   - La pre-selection de l'option par defaut
   */
  function adaptUIForSource() {
    const stock = isStock();
    const grid = document.getElementById('order-options-grid');

    // Afficher/masquer l'option paiement intégral (stock uniquement)
    const fullOption = document.querySelector('[data-option="full"]');
    if (fullOption) {
      fullOption.style.display = stock ? '' : 'none';
    }

    // Afficher/masquer l'option acompte (sur-mesure uniquement)
    const depositOption = document.querySelector('[data-option="deposit"]');
    if (depositOption) {
      depositOption.style.display = stock ? 'none' : '';
    }

    // Afficher/masquer l'option Oney (stock uniquement)
    const oneyOption = document.querySelector('[data-option="oney"]');
    if (oneyOption) {
      oneyOption.style.display = stock ? '' : 'none';
    }

    // Adapter les badges
    const badgeFull = document.getElementById('badge-full');
    const badgeDeposit = document.getElementById('badge-deposit');
    if (stock) {
      if (badgeFull) badgeFull.textContent = 'Recommandé';
      if (badgeDeposit) badgeDeposit.textContent = '';
    } else {
      if (badgeDeposit) badgeDeposit.textContent = 'Populaire';
    }

    // Adapter la grille selon le nombre d'options visibles
    if (grid) {
      if (stock) {
        // Stock: full + oney + rdv = 3 options
        grid.classList.remove('order-options--four');
        grid.classList.add('order-options--three');
      } else {
        // Sur-mesure: deposit + rdv = 2 options
        grid.classList.remove('order-options--four', 'order-options--three');
        grid.classList.add('order-options--two');
      }
    }

    // Adapter le texte de l'acompte pour stock
    const depositDesc = document.querySelector('[data-option="deposit"] .order-option__description');
    if (depositDesc && stock) {
      depositDesc.textContent = 'Versez 30 % maintenant, le solde avant expédition.';
    }

    // Adapter la description livraison
    const fullDetails = document.querySelector('[data-option="full"] .order-option__details');
    if (fullDetails && !stock) {
      // Pour custom, changer le texte livraison
      const liExpedition = fullDetails.querySelector('li:nth-child(2)');
      if (liExpedition) liExpedition.textContent = 'Délai : 8-12 semaines';
    }

    // Étape header
    const eyebrow = document.querySelector('.order-header .eyebrow');
    if (eyebrow) {
      eyebrow.textContent = stock ? 'Paiement' : 'Étape 1 sur 2';
    }

    // Auto-sélectionner la bonne option
    selectOption(stock ? 'full' : 'deposit');
  }

  // ============================================================================
  // AFFICHAGE - MISE A JOUR DU RECAPITULATIF
  // ============================================================================

  /**
   * Met a jour tous les elements d'affichage de la page avec les donnees courantes.
   *
   * Actualise :
   *   - Les champs caches des formulaires (produit, montants)
   *   - Le bloc produit en haut (nom, notes, prix)
   *   - Le detail des accessoires (housse, livraison)
   *   - Les cartes d'options (montant acompte, montant integral)
   *   - Le resume du formulaire acompte (detail, total, reste a payer)
   *   - Le resume du formulaire integral (detail, total)
   *   - L'affichage Oney (echeancier, eligibilite)
   */
  function updateOrderDisplay() {
    const totalWithShipping = getTotalWithShipping();
    const deposit = getDepositAmount();
    const remaining = totalWithShipping - deposit;

    // --- Champs cachés ---
    setVal('form-product', orderData.productName);
    setVal('form-product-full', orderData.productName);
    setVal('form-product-rdv', orderData.productName);
    setVal('form-product-oney', orderData.productName);
    setVal('form-deposit-amount', deposit);
    setVal('form-full-amount', totalWithShipping);

    // --- Produit en haut ---
    setText('product-name', orderData.productName);
    if (orderData.notes) setText('product-notes', orderData.notes);
    setText('product-price', formatPrice(orderData.price));

    // --- Accessoires ---
    displayAccessories();

    // --- Option cards ---
    setText('option-deposit-amount', '30 % (' + formatPrice(deposit) + ')');
    setText('option-full-amount', formatPrice(totalWithShipping));

    // --- Résumé deposit ---
    setText('summary-product', orderData.productName);
    updateShippingRow('summary-deposit-shipping-row', 'summary-deposit-shipping');
    setText('summary-total', formatPrice(totalWithShipping));
    setText('summary-deposit', formatPrice(deposit));
    setText('summary-remaining', formatPrice(remaining));
    setText('deposit-btn-amount', formatPrice(deposit));

    // --- Résumé full ---
    setText('summary-full-product', orderData.productName);
    if (orderData.housse) {
      const housseRow = document.getElementById('summary-full-housse-row');
      if (housseRow) housseRow.style.display = '';
      setText('summary-full-housse', orderData.housse.nom + ' (' + formatPrice(orderData.housse.prix) + ')');
    }
    updateShippingRow('summary-full-shipping-row', 'summary-full-shipping');
    setText('summary-full-total', formatPrice(totalWithShipping));
    setText('full-btn-amount', formatPrice(totalWithShipping));

    // --- Oney ---
    updateOneyDisplay();
  }

  /**
   * Affiche le detail des accessoires et frais dans le bloc #order-accessories.
   *
   * Genere dynamiquement les lignes :
   *   1. Ligne instrument (prix de base)
   *   2. Housse (si selectionnee)
   *   3. Livraison Colissimo ou retrait atelier
   *   4. Ligne total (avec separateur visuel)
   *
   * Masque le bloc si aucun accessoire ni frais supplementaire.
   */
  function displayAccessories() {
    const container = document.getElementById('order-accessories');
    const list = document.getElementById('accessories-list');
    if (!container || !list) return;

    const items = [];

    if (orderData.housse) {
      items.push({ label: orderData.housse.nom, price: orderData.housse.prix });
    }
    if (orderData.shippingMethod === 'colissimo') {
      items.push({ label: 'Livraison Colissimo', price: SHIPPING_COST });
    } else if (orderData.shippingMethod === 'retrait') {
      items.push({ label: 'Retrait atelier', price: 0 });
    }

    if (items.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = '';
    list.innerHTML = '';

    // Ligne instrument (prix de base)
    const instrItem = document.createElement('div');
    instrItem.className = 'order-accessories__item';
    instrItem.innerHTML = '<span>Instrument</span><span>' + escapeHtml(formatPrice(orderData.instrumentPrice)) + '</span>';
    list.appendChild(instrItem);

    // Lignes accessoires et livraison
    items.forEach(function(item) {
      const el = document.createElement('div');
      el.className = 'order-accessories__item';
      if (item.price > 0) {
        el.innerHTML = '<span>' + escapeHtml(item.label) + '</span><span>+ ' + escapeHtml(formatPrice(item.price)) + '</span>';
      } else {
        el.innerHTML = '<span>' + escapeHtml(item.label) + '</span><span>gratuit</span>';
      }
      list.appendChild(el);
    });

    // Ligne total avec separateur
    const totalItem = document.createElement('div');
    totalItem.className = 'order-accessories__item';
    totalItem.style.fontWeight = '600';
    totalItem.style.borderTop = '1px solid var(--color-border)';
    totalItem.style.paddingTop = 'var(--space-sm)';
    totalItem.style.marginTop = 'var(--space-xs)';
    totalItem.innerHTML = '<span>Total</span><span>' + escapeHtml(formatPrice(getTotalWithShipping())) + '</span>';
    list.appendChild(totalItem);
  }

  /**
   * Met a jour l'affichage de la section Oney (eligibilite + echeancier).
   *
   * Gere deux etats :
   *   - Eligible : affiche le detail des echeances 3x et 4x
   *   - Non eligible : affiche un message expliquant la plage de montants
   */
  function updateOneyDisplay() {
    const eligible = isOneyEligible();

    const eligibleEl = document.getElementById('oney-eligible');
    const ineligibleEl = document.getElementById('oney-ineligible');
    if (eligibleEl) eligibleEl.style.display = eligible ? '' : 'none';
    if (ineligibleEl) ineligibleEl.style.display = eligible ? 'none' : '';

    if (!eligible) return;

    const total = getTotalWithShipping();

    setText('oney-product', orderData.productName);
    setText('oney-total', formatPrice(total));

    // Calcul et affichage du detail 3x
    const inst3 = computeInstallments(total, 3);
    setText('oney-3x-detail', '3 × ' + formatPrice(inst3[1]));

    // Calcul et affichage du detail 4x
    const inst4 = computeInstallments(total, 4);
    setText('oney-4x-detail', '4 × ' + formatPrice(inst4[1]));

    updateOneySchedule(selectedInstallments);
  }

  /**
   * Met a jour l'echeancier Oney affiche (lignes de dates + montants).
   *
   * Affiche n lignes d'echeances et masque les autres (max 4 lignes).
   * Met aussi a jour le bouton de soumission avec le nombre d'echeances
   * et le montant total.
   *
   * @param {number} n - Nombre d'echeances (3 ou 4)
   */
  function updateOneySchedule(n) {
    const installments = computeInstallments(getTotalWithShipping(), n);

    // Afficher/masquer les lignes d'echeances (4 lignes max dans le DOM)
    for (let i = 0; i < 4; i++) {
      const row = document.getElementById('oney-schedule-' + (i + 1));
      const amount = document.getElementById('oney-amount-' + (i + 1));
      if (row) row.style.display = (i < n) ? '' : 'none';
      if (amount && i < n) amount.textContent = formatPrice(installments[i]);
    }

    // Mise a jour du bouton de soumission
    setText('oney-btn-installments', n);
    setText('oney-btn-total', formatPrice(getTotalWithShipping()));

    // Champ cache pour le serveur
    setVal('form-installments', n);
  }

  // ============================================================================
  // HELPERS - FONCTIONS UTILITAIRES
  // ============================================================================

  /**
   * Formate un montant en euros selon les conventions francaises.
   * Utilise Intl.NumberFormat pour un affichage localise (ex: "1 400 EUR").
   *
   * @param {number} amount - Montant en euros
   * @returns {string} Montant formate (ex: "1 400 EUR")
   */
  const formatPrice = MistralUtils.formatPrice;

  /**
   * Definit le textContent d'un element par son ID.
   * Ne fait rien si l'element n'existe pas dans le DOM.
   *
   * @param {string} id   - ID de l'element HTML
   * @param {string} text - Texte a afficher
   */
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /**
   * Definit la valeur d'un champ de formulaire par son ID.
   * Ne fait rien si l'element n'existe pas dans le DOM.
   *
   * @param {string} id  - ID de l'element input/select
   * @param {*}      val - Valeur a affecter
   */
  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  /**
   * Charge l'iframe Calendly dans un conteneur, avec fallback RGPD.
   *
   * Si les cookies Calendly sont acceptes (via MistralCookies), charge
   * l'iframe directement. Sinon, affiche un lien externe avec un message
   * invitant l'utilisateur a accepter les cookies.
   *
   * Le flag dataset.loaded empeche le rechargement multiple.
   *
   * @param {string} containerId - ID du conteneur HTML pour l'embed Calendly
   */
  function loadCalendlyEmbed(containerId) {
    const container = document.getElementById(containerId);
    if (!container || container.dataset.loaded) return;

    const calendlyUrl = 'https://calendly.com/adrien-santamaria/30min';
    const allowed = typeof MistralCookies !== 'undefined' && MistralCookies.isServiceAllowed('calendly');

    if (allowed) {
      container.innerHTML =
        '<iframe src="' + calendlyUrl + '" ' +
        'width="100%" height="650" frameborder="0" ' +
        'title="Calendrier de rendez-vous" loading="lazy" ' +
        'style="border:0;border-radius:var(--radius-md);min-height:650px;"></iframe>';
    } else {
      container.innerHTML =
        '<div class="calendly-fallback">' +
        '<p>Pour planifier votre rendez-vous :</p>' +
        '<a href="' + calendlyUrl + '" target="_blank" rel="noopener" class="btn btn--primary">' +
        'Ouvrir le calendrier' +
        '</a>' +
        '<p class="text-sm text-muted" style="margin-top:var(--space-sm);">' +
        'Activez les cookies &laquo; Rendez-vous &raquo; pour afficher le calendrier ici.' +
        '</p>' +
        '</div>';
    }
    container.dataset.loaded = '1';
  }

  /**
   * Met a jour l'affichage d'une ligne de livraison dans un resume de commande.
   * Affiche la ligne si un mode de livraison est selectionne, la masque sinon.
   *
   * @param {string} rowId  - ID de l'element <tr> ou <div> de la ligne livraison
   * @param {string} textId - ID de l'element texte a remplir avec le label
   */
  function updateShippingRow(rowId, textId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    if (orderData.shippingMethod) {
      row.style.display = '';
      const label = orderData.shippingMethod === 'colissimo'
        ? 'Colissimo (' + formatPrice(SHIPPING_COST) + ')'
        : 'Retrait atelier (gratuit)';
      setText(textId, label);
    } else {
      row.style.display = 'none';
    }
  }

  /**
   * Echappe les caracteres HTML speciaux pour prevenir les injections XSS.
   * Utilise dans tout le HTML genere dynamiquement (panier, recapitulatifs).
   *
   * @param {string} str - Chaine a echapper
   * @returns {string} Chaine avec &, <, >, " remplaces par leurs entites HTML
   */
  const escapeHtml = MistralUtils.escapeHtml;

  /**
   * Construit l'objet metadata envoye a PayPlug avec les details de la commande.
   *
   * PayPlug stocke ces metadonnees avec le paiement. Elles sont renvoyees
   * dans le webhook de confirmation et permettent de reconstituer la commande
   * cote serveur (netlify/functions/payplug-webhook.js).
   *
   * Deux formats selon le mode :
   *   - Mode panier : tableau d'items avec details et options
   *   - Mode legacy : objet plat avec les proprietes de orderData
   *
   * @returns {Object} Metadonnees de la commande pour PayPlug
   */
  function buildOrderMetadata() {
    if (cartMode && cartData && cartData.items.length > 0) {
      // Mode panier : envoyer les items dans le metadata
      const items = cartData.items.map(function(item) {
        return {
          type: item.type,
          sourceId: item.sourceId,
          nom: item.nom,
          prix: item.prix,
          quantite: item.quantite,
          total: item.total,
          details: {
            gamme: item.details.gamme || null,
            taille: item.details.taille || null,
            tonalite: item.details.tonalite || null,
            materiau: item.details.materiau || null,
            notes: item.details.notes || item.details.nombre_notes || null
          },
          options: item.options || []
        };
      });

      return {
        source: cartData.source,
        cartMode: true,
        items: items,
        productName: cartData.items.length === 1
          ? cartData.items[0].nom
          : cartData.items.length + ' articles',
        totalPrice: getTotalWithShipping(),
        shippingMethod: orderData.shippingMethod,
        shippingCost: getShippingCost(),
        // Premier instrument pour rétrocompatibilité
        instrumentId: cartData.items[0]?.sourceId || null,
        gamme: cartData.items[0]?.details?.gamme || null,
        taille: cartData.items[0]?.details?.taille || null
      };
    }

    // Mode legacy (single item via URL)
    return {
      source: orderData.source,
      instrumentId: orderData.instrumentId,
      gamme: orderData.gamme,
      taille: orderData.taille,
      tonalite: orderData.tonalite,
      materiau: orderData.materiau,
      notes: orderData.notes || null,
      productName: orderData.productName,
      totalPrice: getTotalWithShipping(),
      instrumentPrice: orderData.instrumentPrice,
      housseId: orderData.housse?.id || null,
      housseNom: orderData.housse?.nom || null,
      houssePrix: orderData.housse?.prix || null,
      shippingMethod: orderData.shippingMethod,
      shippingCost: getShippingCost()
    };
  }

  /**
   * Construit l'objet order simplifie pour le module payplug-client.
   * Cet objet est passe a MistralPayplug.createDeposit() et createFullPayment()
   * pour generer la reference de commande et les parametres PayPlug.
   *
   * @returns {Object} Objet commande simplifie
   * @returns {null}   return.reference     - Sera genere par le serveur
   * @returns {string} return.gamme         - Gamme ou nom du produit
   * @returns {string} return.taille        - Taille du handpan
   * @returns {number} return.prixTotal     - Montant total TTC
   * @returns {string|null} return.instrumentId - ID Supabase (stock)
   * @returns {string} return.source        - 'stock' ou 'custom'
   * @returns {string|null} return.shippingMethod - Mode livraison
   * @returns {number} return.shippingCost  - Frais de livraison
   */
  function buildOrderObject() {
    return {
      reference: null,
      gamme: orderData.gamme || orderData.productName,
      taille: orderData.taille,
      prixTotal: getTotalWithShipping(),
      instrumentId: orderData.instrumentId,
      source: orderData.source,
      shippingMethod: orderData.shippingMethod,
      shippingCost: getShippingCost()
    };
  }

  // ============================================================================
  // ONEY - SELECTEUR 3x / 4x
  // ============================================================================

  /**
   * Initialise le selecteur radio Oney (3x ou 4x echeances).
   *
   * Ecoute les clics sur les options du selecteur #oney-selector.
   * Quand une option est cliquee, met a jour la classe CSS 'selected',
   * le radio button correspondant, et recalcule l'echeancier affiche.
   */
  function initOneySelector() {
    const selector = document.getElementById('oney-selector');
    if (!selector) return;

    selector.addEventListener('click', function(e) {
      const option = e.target.closest('.oney-selector__option');
      if (!option) return;

      const radio = option.querySelector('input[type="radio"]');
      if (!radio) return;

      // Desactiver toutes les options
      selector.querySelectorAll('.oney-selector__option').forEach(function(el) {
        el.classList.remove('selected');
      });

      // Activer l'option cliquee
      option.classList.add('selected');
      radio.checked = true;

      selectedInstallments = parseInt(radio.value);
      updateOneySchedule(selectedInstallments);
    });
  }

  // ============================================================================
  // PAIEMENT INTEGRE (iFrame PayPlug)
  // ============================================================================

  /**
   * Initialise le formulaire de paiement integre PayPlug (iFrame CB).
   *
   * Le mode integre permet a l'utilisateur de saisir ses informations
   * de carte bancaire directement dans la page (sans redirection).
   * Utilise le SDK PayPlug pour generer des champs securises (iFrames PCI-DSS).
   *
   * Prerequis :
   *   - MistralPayplug doit etre charge et disponible
   *   - Les conteneurs HTML pour chaque champ doivent exister :
   *     #cardholder-container, #cardnumber-container,
   *     #expiration-container, #cvv-container
   *   - Le bloc #card-form doit exister
   *
   * Affiche aussi les logos des reseaux de cartes supportes (Visa, Mastercard, etc.)
   * dans le conteneur #card-schemes.
   *
   * En cas d'erreur d'initialisation, le formulaire integre reste masque
   * et le mode heberge (redirection) sera utilise comme fallback.
   */
  function initIntegratedPaymentForm() {
    if (typeof MistralPayplug === 'undefined' || !MistralPayplug.isIntegratedAvailable()) {
      return;
    }

    const cardForm = document.getElementById('card-form');
    const containers = {
      cardHolder: document.getElementById('cardholder-container'),
      cardNumber: document.getElementById('cardnumber-container'),
      expiration: document.getElementById('expiration-container'),
      cvv: document.getElementById('cvv-container')
    };

    if (!cardForm || !containers.cardHolder || !containers.cardNumber || !containers.expiration || !containers.cvv) {
      return;
    }

    try {
      MistralPayplug.initIntegratedForm(containers, { testMode: false });

      // Afficher les logos des reseaux de cartes supportes
      const schemesContainer = document.getElementById('card-schemes');
      if (schemesContainer) {
        const schemes = MistralPayplug.getSupportedSchemes();
        if (schemes) {
          schemes.forEach(function(scheme) {
            if (scheme.name !== 'DEFAULT' && scheme.iconUrl) {
              const img = document.createElement('img');
              img.src = scheme.iconUrl;
              img.alt = scheme.title;
              img.title = scheme.title;
              schemesContainer.appendChild(img);
            }
          });
        }
      }

      cardForm.style.display = '';
      integratedFormReady = true;
    } catch (error) {
      console.warn('[Commander] Erreur init Integrated Payment:', error.message);
    }
  }

  // ============================================================================
  // FORMULAIRES - INITIALISATION ET BINDING
  // ============================================================================

  /**
   * Attache les gestionnaires de soumission aux quatre formulaires de la page.
   *
   * Formulaires :
   *   - 'order'       -> handleDepositSubmit (acompte 30%)
   *   - 'full'        -> handleFullSubmit (paiement integral)
   *   - 'oney'        -> handleOneySubmit (paiement en 3x/4x)
   *   - 'appointment' -> handleAppointmentSubmit (demande de RDV)
   */
  function initForms() {
    bindForm('order', handleDepositSubmit);
    bindForm('full', handleFullSubmit);
    bindForm('oney', handleOneySubmit);
    bindForm('appointment', handleAppointmentSubmit);

    // Validation en temps reel (onblur) sur tous les formulaires
    if (window.MistralValidation) {
      document.querySelectorAll('form[data-form]').forEach(function(form) {
        MistralValidation.attach(form);
      });
    }
  }

  /**
   * Attache un gestionnaire de soumission a un formulaire identifie par data-form.
   *
   * @param {string}   name    - Valeur de l'attribut data-form
   * @param {Function} handler - Fonction de gestion de la soumission (recoit l'Event)
   */
  function bindForm(name, handler) {
    const form = document.querySelector('form[data-form="' + name + '"]');
    if (form) form.addEventListener('submit', handler);
  }

  /**
   * Met un bouton en etat de chargement (spinner + desactive).
   * @param {HTMLButtonElement} btn
   * @param {string} text - Texte a afficher pendant le chargement
   */
  function setButtonLoading(btn, text) {
    if (!btn) return;
    btn._originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('btn--loading');
    btn.textContent = text;
  }

  /**
   * Restaure un bouton a son etat initial.
   * @param {HTMLButtonElement} btn
   */
  function resetButton(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove('btn--loading');
    if (btn._originalHTML) {
      btn.innerHTML = btn._originalHTML;
      delete btn._originalHTML;
    }
  }

  /**
   * Valide les champs client communs a tous les formulaires de paiement.
   *
   * Verifie :
   *   1. Le honeypot anti-spam (champ invisible 'website' doit etre vide)
   *   2. Les champs obligatoires (prenom, nom, email, telephone)
   *   3. Le format de l'email (regex basique)
   *   4. L'acceptation des CGV (checkbox required)
   *
   * @param {HTMLFormElement} form - Element formulaire a valider
   * @returns {Object|null} Objet customer {firstName, lastName, email, phone, address}
   *                        ou null si la validation echoue
   */
  function validateCustomerForm(form) {
    const formData = new FormData(form);

    // Honeypot
    const honeypotField = form.querySelector('[name="website"]');
    if (honeypotField && honeypotField.value) {
      return null;
    }

    const customer = {
      firstName: (formData.get('firstname') || '').trim(),
      lastName: (formData.get('lastname') || '').trim(),
      email: (formData.get('email') || '').trim(),
      phone: (formData.get('phone') || '').trim(),
      address: {
        line1: (formData.get('address') || '').trim()
      }
    };

    if (!customer.firstName || !customer.lastName || !customer.email || !customer.phone) {
      showMessage('Veuillez remplir tous les champs obligatoires', 'error');
      return null;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      showMessage('Veuillez entrer une adresse email valide', 'error');
      return null;
    }

    const cgvCheckbox = form.querySelector('input[name="cgv"]');
    if (cgvCheckbox && !cgvCheckbox.checked) {
      showMessage('Veuillez accepter les conditions générales de vente', 'error');
      return null;
    }

    const rgpdCheckbox = form.querySelector('input[name="rgpd-consent"]');
    if (rgpdCheckbox && !rgpdCheckbox.checked) {
      showMessage('Veuillez accepter la politique de confidentialité', 'error');
      return null;
    }

    return customer;
  }

  // ============================================================================
  // PAIEMENT INTEGRAL (stock uniquement)
  // ============================================================================

  /**
   * Gere la soumission du formulaire de paiement integral.
   *
   * Flux :
   *   1. Validation du mode de livraison
   *   2. Validation des champs client
   *   3. Creation du paiement via MistralPayplug.createFullPayment()
   *   4. Sauvegarde de la commande en attente (localStorage)
   *   5. Redirection vers la page de paiement PayPlug
   *
   * En cas d'erreur PayPlug ou si le SDK n'est pas charge,
   * bascule sur l'envoi par email (fallback).
   *
   * @param {Event} e - Evenement submit du formulaire
   * @returns {Promise<void>}
   */
  async function handleFullSubmit(e) {
    e.preventDefault();

    if (!validateShipping()) return;

    const form = e.target;
    const submitBtn = document.getElementById('full-submit-btn') || form.querySelector('button[type="submit"]');

    const customer = validateCustomerForm(form);
    if (!customer) return;

    setButtonLoading(submitBtn, 'Préparation du paiement...');

    try {
      if (typeof MistralPayplug === 'undefined') {
        await sendOrderByEmail(customer, new FormData(form), 'full');
        return;
      }

      const totalCents = getTotalWithShipping() * 100;
      const order = buildOrderObject();
      const metadata = buildOrderMetadata();

      const result = await MistralPayplug.createFullPayment(customer, order, totalCents, {
        metadata: metadata
      });

      if (result.success && result.paymentUrl) {
        savePendingOrder(result.reference, customer, 'full', getTotalWithShipping());

        showMessage('Redirection vers la page de paiement...', 'info');
        setTimeout(function() {
          MistralPayplug.redirectToPayment(result.paymentUrl);
        }, 1000);
      } else {
        throw new Error(result.error || 'Impossible de créer le paiement');
      }

    } catch (error) {
      console.error('Erreur paiement:', error);
      showMessage('Erreur: ' + error.message + '. Nous allons vous envoyer un email de confirmation.', 'warning');
      await sendOrderByEmail(customer, new FormData(form), 'full');
    } finally {
      resetButton(submitBtn);
    }
  }

  // ============================================================================
  // ACOMPTE 30% (sur mesure ou stock)
  // ============================================================================

  /**
   * Gere la soumission du formulaire d'acompte (30%).
   *
   * Flux :
   *   1. Validation du mode de livraison
   *   2. Validation des champs client
   *   3. Si le formulaire integre CB est pret -> handleIntegratedPayment()
   *      Sinon -> handleHostedPayment() (redirection PayPlug)
   *
   * En cas d'erreur, bascule sur l'envoi par email (fallback).
   *
   * @param {Event} e - Evenement submit du formulaire
   * @returns {Promise<void>}
   */
  async function handleDepositSubmit(e) {
    e.preventDefault();

    if (!validateShipping()) return;

    const form = e.target;
    const submitBtn = document.getElementById('deposit-submit-btn') || form.querySelector('button[type="submit"]');

    const customer = validateCustomerForm(form);
    if (!customer) return;

    setButtonLoading(submitBtn, 'Préparation du paiement...');

    try {
      if (typeof MistralPayplug === 'undefined') {
        await sendOrderByEmail(customer, new FormData(form), 'acompte');
        return;
      }

      if (integratedFormReady) {
        await handleIntegratedPayment(customer, submitBtn);
      } else {
        await handleHostedPayment(customer);
      }

    } catch (error) {
      console.error('Erreur commande:', error);
      showMessage('Erreur: ' + error.message + '. Nous allons vous envoyer un email de confirmation.', 'warning');
      await sendOrderByEmail(customer, new FormData(form), 'acompte');
    } finally {
      resetButton(submitBtn);
    }
  }

  /**
   * Gere le paiement en mode integre (iFrame CB dans la page).
   *
   * Flux detaille :
   *   1. Si aucun paiement n'est en attente, cree un paiement via PayPlug
   *      (MistralPayplug.createDeposit avec integrated: true)
   *   2. Sauvegarde la reference en localStorage
   *   3. Declenche le paiement via l'iFrame (MistralPayplug.payIntegrated)
   *   4. En cas de succes, affiche l'ecran de confirmation
   *
   * Le pendingPaymentId est conserve entre les tentatives pour eviter de
   * recreer un paiement si l'utilisateur corrige sa carte et reessaie.
   *
   * @param {Object}          customer     - Donnees client validees
   * @param {HTMLButtonElement} submitBtn   - Bouton de soumission (pour l'etat visuel)
   * @returns {Promise<void>}
   * @throws {Error} Si la creation du paiement echoue
   */
  async function handleIntegratedPayment(customer, submitBtn) {
    const depositCents = getDepositAmountCents();
    const metadata = buildOrderMetadata();

    // Etape 1 : Creer le paiement si pas encore fait
    if (!pendingPaymentId) {
      setButtonLoading(submitBtn, 'Création du paiement...');

      const result = await MistralPayplug.createDeposit(customer, buildOrderObject(), {
        integrated: true,
        amount: depositCents,
        metadata: metadata
      });

      if (!result.success || !result.paymentId) {
        throw new Error(result.error || 'Impossible de créer le paiement');
      }

      pendingPaymentId = result.paymentId;
      savePendingOrder(result.reference, customer, 'acompte', getDepositAmount());
    }

    // Etape 2 : Declencher le paiement CB via l'iFrame
    setButtonLoading(submitBtn, 'Paiement en cours...');

    const loading = document.getElementById('card-form-loading');
    if (loading) loading.classList.add('active');

    try {
      const payResult = await MistralPayplug.payIntegrated(pendingPaymentId);

      if (payResult.success) {
        const pendingOrder = JSON.parse(localStorage.getItem('mistral_pending_order') || 'null');
        const reference = pendingOrder?.reference || '';

        showPaymentSuccess(reference, pendingOrder);
        localStorage.removeItem('mistral_pending_order');
        pendingPaymentId = null;
      }
    } catch (payError) {
      showMessage(payError.message || 'Erreur de paiement. Veuillez réessayer.', 'error');
      resetButton(submitBtn);
    } finally {
      if (loading) loading.classList.remove('active');
    }
  }

  /**
   * Gere le paiement en mode heberge (redirection vers la page PayPlug).
   *
   * Flux :
   *   1. Cree un paiement acompte via MistralPayplug.createDeposit()
   *   2. Sauvegarde la commande en attente dans localStorage
   *   3. Redirige l'utilisateur vers la page de paiement PayPlug
   *
   * Utilise comme fallback quand le formulaire integre n'est pas disponible.
   *
   * @param {Object} customer - Donnees client validees
   * @returns {Promise<void>}
   * @throws {Error} Si la creation du paiement echoue
   */
  async function handleHostedPayment(customer) {
    const depositCents = getDepositAmountCents();
    const metadata = buildOrderMetadata();

    const result = await MistralPayplug.createDeposit(customer, buildOrderObject(), {
      amount: depositCents,
      metadata: metadata
    });

    if (result.success && result.paymentUrl) {
      savePendingOrder(result.reference, customer, 'acompte', getDepositAmount());

      showMessage('Redirection vers la page de paiement...', 'info');
      setTimeout(function() {
        MistralPayplug.redirectToPayment(result.paymentUrl);
      }, 1000);
    } else {
      throw new Error(result.error || 'Impossible de créer le paiement');
    }
  }

  // ============================================================================
  // ONEY 3x/4x (stock uniquement, 100-3000 EUR)
  // ============================================================================

  /**
   * Gere la soumission du formulaire Oney (paiement en 3x ou 4x).
   *
   * Particularites Oney :
   *   - L'adresse complete est obligatoire (line1 + code postal + ville)
   *   - Le pays est fixe a 'FR' (Oney France uniquement)
   *   - Le montant doit etre entre 100 EUR et 3000 EUR
   *   - La validation des champs est faite ici (pas via validateCustomerForm)
   *     car Oney requiert des champs supplementaires
   *
   * Flux :
   *   1. Validation livraison + champs client + eligibilite Oney
   *   2. Creation du paiement via MistralPayplug.createInstallmentPayment()
   *   3. Sauvegarde commande + redirection vers Oney
   *
   * @param {Event} e - Evenement submit du formulaire
   * @returns {Promise<void>}
   */
  async function handleOneySubmit(e) {
    e.preventDefault();

    if (!validateShipping()) return;

    const form = e.target;
    const submitBtn = document.getElementById('oney-submit-btn') || form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    // Honeypot
    const honeypotField = form.querySelector('[name="website"]');
    if (honeypotField && honeypotField.value) return;

    // Construction de l'objet client avec adresse complete (requis par Oney)
    const customer = {
      firstName: (formData.get('firstname') || '').trim(),
      lastName: (formData.get('lastname') || '').trim(),
      email: (formData.get('email') || '').trim(),
      phone: (formData.get('phone') || '').trim(),
      address: {
        line1: (formData.get('address') || '').trim(),
        postalCode: (formData.get('postcode') || '').trim(),
        city: (formData.get('city') || '').trim(),
        country: 'FR'
      }
    };

    // Validation des champs obligatoires
    if (!customer.firstName || !customer.lastName || !customer.email || !customer.phone) {
      showMessage('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      showMessage('Veuillez entrer une adresse email valide', 'error');
      return;
    }

    // Oney exige l'adresse complete
    if (!customer.address.line1 || !customer.address.postalCode || !customer.address.city) {
      showMessage('Adresse complète requise pour le paiement Oney', 'error');
      return;
    }

    const cgvCheckbox = form.querySelector('input[type="checkbox"][required]');
    if (cgvCheckbox && !cgvCheckbox.checked) {
      showMessage('Veuillez accepter les conditions générales de vente', 'error');
      return;
    }

    // Verification de l'eligibilite Oney (plage de montants)
    if (!isOneyEligible()) {
      showMessage('Le paiement Oney est disponible pour les montants entre 100 € et 3 000 €', 'error');
      return;
    }

    setButtonLoading(submitBtn, 'Préparation du paiement...');

    try {
      if (typeof MistralPayplug === 'undefined') {
        await sendOrderByEmail(customer, formData, 'oney');
        return;
      }

      const totalCents = getTotalWithShipping() * 100;
      const order = buildOrderObject();
      order.metadata = buildOrderMetadata();

      const result = await MistralPayplug.createInstallmentPayment(
        customer, order, totalCents, selectedInstallments
      );

      if (result.success && result.paymentUrl) {
        savePendingOrder(result.reference, customer, 'oney_' + selectedInstallments + 'x', getTotalWithShipping());

        showMessage('Redirection vers Oney...', 'info');
        setTimeout(function() {
          MistralPayplug.redirectToPayment(result.paymentUrl);
        }, 1000);
      } else {
        throw new Error(result.error || 'Impossible de créer le paiement Oney');
      }

    } catch (error) {
      console.error('Erreur Oney:', error);
      showMessage('Erreur: ' + error.message, 'error');
    } finally {
      resetButton(submitBtn);
    }
  }

  // ============================================================================
  // COMMANDE EN ATTENTE (localStorage)
  // ============================================================================

  /**
   * Sauvegarde les donnees de la commande en attente dans localStorage.
   *
   * Appellee juste avant la redirection vers PayPlug. Les donnees sont
   * recuperees au retour de paiement (checkPaymentReturn) pour afficher
   * le recapitulatif de confirmation.
   *
   * Cle localStorage : 'mistral_pending_order'
   *
   * En mode panier, les items sont copies et le panier est vide
   * (MistralCart.clear()) pour eviter les doubles commandes.
   *
   * @param {string} reference   - Reference de commande generee par PayPlug
   * @param {Object} customer    - Donnees client
   * @param {string} paymentType - Type de paiement ('full', 'acompte', 'oney_3x', 'oney_4x')
   * @param {number} paidAmount  - Montant paye (ou a payer) en euros
   */
  function savePendingOrder(reference, customer, paymentType, paidAmount) {
    const data = {
      reference: reference,
      customer: customer,
      product: orderData,
      paymentType: paymentType,
      paidAmount: paidAmount,
      shippingMethod: orderData.shippingMethod,
      shippingCost: getShippingCost(),
      createdAt: new Date().toISOString()
    };

    // Sauvegarder les items du panier si en mode panier
    if (cartMode && cartData) {
      data.cartItems = cartData.items;
      data.cartMode = true;
    }

    localStorage.setItem('mistral_pending_order', JSON.stringify(data));

    // Vider le panier après commande
    if (cartMode && typeof MistralCart !== 'undefined') {
      MistralCart.clear();
    }
  }

  // ============================================================================
  // FALLBACK EMAIL
  // ============================================================================

  /**
   * Envoie la commande par email en cas d'indisponibilite de PayPlug.
   *
   * Sert de filet de securite : si le SDK PayPlug n'est pas charge ou si
   * la creation du paiement echoue, la commande est envoyee par email
   * a contact@mistralpans.fr pour traitement manuel.
   *
   * Deux mecanismes d'envoi :
   *   1. MistralEmail (Brevo via Netlify Function) si disponible
   *   2. mailto: (ouverture du client email) en dernier recours
   *
   * Le corps de l'email contient :
   *   - Type de commande (integral, acompte, Oney)
   *   - Detail des prix, livraison, total
   *   - Articles du panier (mode panier) ou details instrument (mode legacy)
   *   - Housse si selectionnee
   *   - Adresse et message du client
   *
   * @param {Object}   customer    - Donnees client validees
   * @param {FormData} formData    - Donnees brutes du formulaire
   * @param {string}   paymentType - Type de paiement ('full', 'acompte', 'oney')
   * @returns {Promise<void>}
   */
  async function sendOrderByEmail(customer, formData, paymentType) {
    const deposit = getDepositAmount();

    // Determiner le libelle du type de commande
    let typeLabel;
    if (paymentType === 'full') {
      typeLabel = 'Commande paiement intégral';
    } else if (paymentType === 'oney') {
      typeLabel = 'Commande Oney ' + selectedInstallments + 'x';
    } else {
      typeLabel = 'Commande avec acompte';
    }

    // Libelle de la livraison
    const shippingLabel = orderData.shippingMethod === 'colissimo'
      ? 'Livraison Colissimo (+' + formatPrice(SHIPPING_COST) + ')'
      : 'Retrait à l\'atelier';

    // Construction du corps de l'email ligne par ligne
    const lines = [
      typeLabel + ' - ' + orderData.productName,
      '',
      'Prix articles: ' + formatPrice(orderData.price),
      'Livraison: ' + shippingLabel,
      'Total: ' + formatPrice(getTotalWithShipping()),
    ];

    // Detail selon le type de paiement
    if (paymentType === 'full') {
      lines.push('Paiement intégral');
    } else if (paymentType === 'oney') {
      lines.push('Paiement en ' + selectedInstallments + 'x');
    } else {
      lines.push('Acompte (30%): ' + formatPrice(deposit));
      lines.push('Reste à payer: ' + formatPrice(getTotalWithShipping() - deposit));
    }

    // Mode panier : lister les items
    if (cartMode && cartData && cartData.items.length > 0) {
      lines.push('', '--- Articles du panier ---');
      cartData.items.forEach(function(item, idx) {
        lines.push((idx + 1) + '. ' + item.nom + (item.quantite > 1 ? ' x' + item.quantite : '') + ' - ' + formatPrice(item.total));
        if (item.options && item.options.length > 0) {
          item.options.forEach(function(opt) {
            lines.push('   + ' + (opt.nom || opt.type) + (opt.prix ? ' (' + formatPrice(opt.prix) + ')' : ''));
          });
        }
      });
    } else {
      if (orderData.source === 'stock') {
        lines.push('', 'Type: Instrument en stock');
        if (orderData.instrumentId) lines.push('ID instrument: ' + orderData.instrumentId);
      }

      if (orderData.housse) {
        lines.push('Housse: ' + orderData.housse.nom + ' (' + formatPrice(orderData.housse.prix) + ')');
      }
    }

    // Adresse et message
    lines.push(
      '',
      'Adresse: ' + (formData.get('address') || 'Non renseignée'),
      formData.get('postcode') ? 'Code postal: ' + formData.get('postcode') : '',
      formData.get('city') ? 'Ville: ' + formData.get('city') : '',
      'Message: ' + (formData.get('message') || 'Aucun')
    );

    const message = lines.filter(Boolean).join('\n').trim();

    try {
      // Tentative d'envoi via Brevo (Netlify Function)
      if (typeof MistralEmail !== 'undefined') {
        const result = await MistralEmail.sendContact({
          firstname: customer.firstName,
          lastname: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          message: message,
          type: typeLabel
        });

        if (result.success) {
          showMessage('Votre demande a été envoyée. Nous vous contacterons avec le lien de paiement.', 'success');
        } else {
          throw new Error(result.error);
        }
      } else {
        // Dernier recours : ouverture du client email natif
        const subject = encodeURIComponent('[Mistral Pans] ' + typeLabel + ' - ' + customer.firstName + ' ' + customer.lastName);
        const body = encodeURIComponent(
          'Nom: ' + customer.firstName + ' ' + customer.lastName + '\n' +
          'Email: ' + customer.email + '\n' +
          'Téléphone: ' + customer.phone + '\n\n' + message
        );
        window.location.href = 'mailto:contact@mistralpans.fr?subject=' + subject + '&body=' + body;
        showMessage('Votre client email va s\'ouvrir.', 'info');
      }
    } catch (error) {
      console.error('Erreur envoi email:', error);
      showMessage('Une erreur est survenue. Contactez-nous directement: contact@mistralpans.fr', 'error');
    }
  }

  // ============================================================================
  // RENDEZ-VOUS A L'ATELIER
  // ============================================================================

  /**
   * Gere la soumission du formulaire de demande de rendez-vous.
   *
   * Envoie un email contenant :
   *   - La preference de contact (telephone, email, etc.)
   *   - Le nom de l'instrument d'interet
   *   - Le type (stock ou sur mesure)
   *   - Un message libre du client
   *
   * Utilise MistralEmail (Brevo) si disponible, sinon ouvre le client
   * email natif via mailto:.
   *
   * @param {Event} e - Evenement submit du formulaire
   * @returns {Promise<void>}
   */
  async function handleAppointmentSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    setButtonLoading(submitBtn, 'Envoi en cours...');

    try {
      const message = [
        'Demande de rendez-vous',
        '',
        'Préférence de contact: ' + formData.get('contact_preference'),
        'Instrument d\'intérêt: ' + orderData.productName,
        isStock() ? '(Instrument en stock)' : '(Configuration sur mesure)',
        '',
        formData.get('message')
      ].join('\n').trim();

      if (typeof MistralEmail !== 'undefined') {
        const result = await MistralEmail.sendContact({
          firstname: (formData.get('firstname') || '').trim(),
          lastname: (formData.get('lastname') || '').trim(),
          email: (formData.get('email') || '').trim(),
          phone: (formData.get('phone') || '').trim(),
          message: message,
          type: 'Demande de RDV'
        });

        if (result.success) {
          showMessage('Votre demande a été envoyée ! Nous vous recontacterons sous 48h.', 'success');
          form.reset();
        } else {
          throw new Error(result.error);
        }
      } else {
        const subject = encodeURIComponent('[Mistral Pans] Demande RDV - ' + formData.get('firstname') + ' ' + formData.get('lastname'));
        const body = encodeURIComponent(
          'Nom: ' + formData.get('firstname') + ' ' + formData.get('lastname') + '\n' +
          'Email: ' + formData.get('email') + '\n' +
          'Téléphone: ' + formData.get('phone') + '\n\n' + message
        );
        window.location.href = 'mailto:contact@mistralpans.fr?subject=' + subject + '&body=' + body;
        showMessage('Votre client email va s\'ouvrir.', 'info');
      }

    } catch (error) {
      console.error('Erreur envoi RDV:', error);
      showMessage('Une erreur est survenue. Contactez-nous directement: contact@mistralpans.fr', 'error');
    } finally {
      resetButton(submitBtn);
    }
  }

  // ============================================================================
  // RETOUR DE PAIEMENT (apres redirection PayPlug)
  // ============================================================================

  /**
   * Detecte et traite le retour de paiement PayPlug.
   *
   * Appelee au chargement de la page. Verifie si l'URL contient des
   * parametres de retour PayPlug (status, reference, failure).
   *
   * Trois cas possibles :
   *   - success   -> showPaymentSuccess() : ecran de confirmation
   *   - cancelled -> showPaymentCancelled() : message d'annulation
   *   - error     -> showPaymentError() : message d'erreur detaille
   *
   * Nettoie les parametres URL et le localStorage apres traitement.
   */
  function checkPaymentReturn() {
    if (typeof MistralPayplug === 'undefined') return;

    const paymentStatus = MistralPayplug.checkPaymentStatus();
    if (!paymentStatus) return;

    const status = paymentStatus.status;
    const reference = paymentStatus.reference;
    const pendingOrder = JSON.parse(localStorage.getItem('mistral_pending_order') || 'null');

    switch (status) {
      case 'success':
        showPaymentSuccess(reference, pendingOrder);
        localStorage.removeItem('mistral_pending_order');
        break;
      case 'cancelled':
        showPaymentCancelled();
        break;
      case 'error':
        showPaymentError();
        break;
    }

    MistralPayplug.clearPaymentParams();
  }

  /**
   * Affiche l'ecran de confirmation de paiement reussi.
   *
   * Remplace tout le contenu de la page par un ecran de succes contenant :
   *   - L'icone de validation (checkmark vert)
   *   - La reference de commande
   *   - Le detail des articles (panier ou single)
   *   - Le montant paye et le mode de paiement
   *   - Les prochaines etapes selon le type de paiement
   *   - Un lien de retour a l'accueil
   *
   * Injecte aussi les styles CSS necessaires via addPaymentResultStyles().
   *
   * @param {string}      reference    - Reference de commande PayPlug
   * @param {Object|null} pendingOrder - Donnees de la commande sauvegardees en localStorage
   */
  function showPaymentSuccess(reference, pendingOrder) {
    const container = document.querySelector('.order-page .container') || document.querySelector('main');
    if (!container) return;

    const safeRef = escapeHtml(reference || 'N/A');
    const paymentType = pendingOrder?.paymentType || 'acompte';
    const isOney = paymentType.startsWith('oney');
    const isFull = paymentType === 'full';

    // Construire la liste d'articles
    let productHtml = '';
    if (pendingOrder?.cartMode && pendingOrder?.cartItems) {
      // Mode panier : liste a puces des articles
      productHtml = '<p><strong>Articles :</strong></p><ul style="text-align:left;margin:0.5rem 0;">';
      pendingOrder.cartItems.forEach(function(item) {
        productHtml += '<li>' + escapeHtml(item.nom);
        if (item.quantite > 1) productHtml += ' x' + item.quantite;
        productHtml += '</li>';
      });
      productHtml += '</ul>';
    } else {
      // Mode single : une seule ligne instrument
      const safeProduct = escapeHtml(pendingOrder?.product?.productName || 'Handpan sur mesure');
      productHtml = '<p><strong>Instrument :</strong> ' + safeProduct + '</p>';
    }

    // Detail du montant selon le type de paiement
    let amountDetail = '';
    if (isOney) {
      amountDetail = '<p><strong>Mode :</strong> Paiement en ' + escapeHtml(paymentType.replace('oney_', '')) + '</p>';
    } else if (isFull) {
      amountDetail = '<p><strong>Montant payé :</strong> ' + escapeHtml(formatPrice(pendingOrder?.paidAmount || 0)) + '</p>';
    } else if (pendingOrder?.paidAmount) {
      amountDetail = '<p><strong>Acompte versé :</strong> ' + escapeHtml(formatPrice(pendingOrder.paidAmount)) + '</p>';
    }

    // Message des prochaines etapes selon le type de paiement
    let nextSteps = '';
    if (isFull) {
      nextSteps = '<p>Nous préparons votre commande. Vous recevrez un email avec le suivi.</p>';
    } else if (isOney) {
      nextSteps = '<p>Votre paiement sera prélevé selon l\'échéancier Oney. Nous lançons la fabrication.</p>';
    } else {
      nextSteps = '<p>Votre acompte a bien été enregistré. Nous vous contacterons pour le solde quand votre instrument sera prêt.</p>';
    }

    // Remplacement complet du contenu de la page
    container.innerHTML =
      '<div class="payment-result payment-result--success">' +
        '<div class="payment-result__icon">✓</div>' +
        '<h2>Paiement confirmé !</h2>' +
        '<p>Merci pour votre commande.</p>' +
        '<div class="payment-result__details">' +
          '<p><strong>Référence :</strong> ' + safeRef + '</p>' +
          productHtml +
          amountDetail +
        '</div>' +
        nextSteps +
        '<p>Un email de confirmation vous a été envoyé.</p>' +
        '<div class="payment-result__actions">' +
          '<a href="index.html" class="btn btn--primary">Retour à l\'accueil</a>' +
        '</div>' +
      '</div>';

    addPaymentResultStyles();
  }

  /**
   * Affiche un message d'annulation de paiement (toast warning).
   * L'utilisateur peut reessayer en soumettant a nouveau le formulaire.
   */
  function showPaymentCancelled() {
    showMessage(
      'Paiement annulé. Votre commande n\'a pas été validée. Vous pouvez réessayer ci-dessous.',
      'warning'
    );
  }

  /**
   * Affiche un message d'erreur de paiement detaille selon le code d'echec.
   *
   * Lit le parametre URL 'failure' pour determiner le code d'erreur PayPlug
   * et affiche un message adapte en francais.
   *
   * Codes d'erreur supportes :
   *   - processing_error  : erreur de traitement
   *   - card_declined     : carte refusee
   *   - insufficient_funds : fonds insuffisants
   *   - 3ds_declined      : authentification 3DS refusee
   *   - incorrect_number  : numero de carte incorrect
   *   - fraud_suspected   : suspicion de fraude
   *   - method_unsupported : methode non supportee
   *   - timeout           : delai expire
   *   - aborted           : paiement annule
   */
  function showPaymentError() {
    const urlParams = new URLSearchParams(window.location.search);
    const failureCode = urlParams.get('failure');

    const failureMessages = {
      processing_error: 'Erreur de traitement de la carte. Veuillez réessayer.',
      card_declined: 'Carte refusée. Vérifiez vos informations ou essayez une autre carte.',
      insufficient_funds: 'Fonds insuffisants sur la carte.',
      '3ds_declined': 'Authentification 3D Secure refusée.',
      incorrect_number: 'Numéro de carte incorrect.',
      fraud_suspected: 'Paiement refusé (suspicion de fraude).',
      method_unsupported: 'Méthode de paiement non supportée.',
      timeout: 'Le délai de paiement a expiré. Veuillez réessayer.',
      aborted: 'Le paiement a été annulé.'
    };

    const message = failureMessages[failureCode]
      || 'Une erreur est survenue lors du paiement. Contactez-nous si le problème persiste.';

    showMessage(message, 'error');
  }

  // ============================================================================
  // UTILITAIRES UI - NOTIFICATIONS ET STYLES
  // ============================================================================

  /**
   * Affiche un message toast en haut de la page.
   *
   * Delegue au systeme global MistralToast (defini dans main.js).
   * Fallback inline si MistralToast n'est pas disponible.
   *
   * @param {string} text - Message a afficher
   * @param {string} [type='info'] - Type de message : 'success', 'error', 'warning', 'info'
   */
  function showMessage(text, type) {
    type = type || 'info';

    // Utiliser le systeme global si disponible
    if (window.MistralToast) {
      MistralToast.show(text, type, 5000);
      return;
    }

    // Fallback inline (ne devrait pas arriver)
    const existing = document.querySelector('.order-message');
    if (existing) existing.remove();

    const colors = { success: '#3D6B4A', error: '#DC2626', warning: '#D97706', info: '#0D7377' };
    const message = document.createElement('div');
    message.className = 'order-message';
    message.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'padding:16px 24px;background:' + (colors[type] || colors.info) + ';' +
      'color:white;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);' +
      'z-index:2000;max-width:90%;text-align:center;';
    message.textContent = text;
    document.body.appendChild(message);
    setTimeout(function() { message.remove(); }, 5000);
  }

  /**
   * Injecte les styles CSS pour les ecrans de resultat de paiement.
   *
   * Ajoute un element <style> dans le <head> avec les regles pour :
   *   - .payment-result : conteneur centre avec padding
   *   - .payment-result__icon : cercle vert avec checkmark
   *   - .payment-result__details : bloc gris avec les details
   *   - Animations slideDown/slideUp pour les toasts
   *
   * Ne s'execute qu'une fois grace a l'ID 'payment-result-styles'.
   */
  function addPaymentResultStyles() {
    if (document.getElementById('payment-result-styles')) return;

    const style = document.createElement('style');
    style.id = 'payment-result-styles';
    style.textContent =
      '.payment-result{text-align:center;padding:60px 20px;max-width:500px;margin:0 auto}' +
      '.payment-result--success .payment-result__icon{width:80px;height:80px;background:#3D6B4A;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 24px}' +
      '.payment-result h2{color:#3D6B4A;margin-bottom:16px}' +
      '.payment-result__details{background:#f5f5f5;padding:20px;border-radius:8px;margin:24px 0;text-align:left}' +
      '.payment-result__details p{margin:8px 0}' +
      '.payment-result__actions{margin-top:32px}' +
      '@keyframes slideDown{from{transform:translateX(-50%) translateY(-100%);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}' +
      '@keyframes slideUp{from{transform:translateX(-50%) translateY(0);opacity:1}to{transform:translateX(-50%) translateY(-100%);opacity:0}}';
    document.head.appendChild(style);
  }

  // ============================================================================
  // SELECTION DU MODE DE LIVRAISON (expose globalement pour onclick)
  // ============================================================================

  /**
   * Selectionne un mode de livraison et met a jour toute l'interface.
   *
   * Expose globalement (window.selectShipping) pour etre appelee depuis
   * les attributs onclick dans le HTML de commander.html.
   *
   * Actions effectuees :
   *   1. Met a jour orderData.shippingMethod
   *   2. Active visuellement l'option selectionnee (.selected)
   *   3. Masque le message d'erreur de livraison
   *   4. Affiche/masque le bloc Calendly (retrait atelier)
   *   5. Adapte les champs d'adresse (readonly si retrait)
   *   6. Recalcule tous les affichages (prix, totaux, echeancier)
   *
   * @param {string} method - Mode de livraison : 'colissimo' ou 'retrait'
   */
  window.selectShipping = function(method) {
    orderData.shippingMethod = method;

    // Mise à jour visuelle
    document.querySelectorAll('.shipping-option').forEach(function(el) {
      el.classList.remove('selected');
    });
    const selected = document.querySelector('[data-shipping="' + method + '"]');
    if (selected) selected.classList.add('selected');

    // Masquer l'erreur
    const error = document.getElementById('shipping-error');
    if (error) error.style.display = 'none';

    // Afficher/masquer le bloc Calendly retrait
    const calendlyBlock = document.getElementById('calendly-retrait');
    if (calendlyBlock) {
      if (method === 'retrait') {
        calendlyBlock.style.display = '';
        loadCalendlyEmbed('calendly-commander-container');
      } else {
        calendlyBlock.style.display = 'none';
      }
    }

    // Adapter les champs adresse
    updateAddressFields();

    // Recalculer tous les affichages
    updateOrderDisplay();
  };

  /**
   * Valide qu'un mode de livraison a ete selectionne.
   * Affiche un message d'erreur et scrolle vers le selecteur si non selectionne.
   *
   * @returns {boolean} true si un mode de livraison est selectionne, false sinon
   */
  function validateShipping() {
    if (!orderData.shippingMethod) {
      const error = document.getElementById('shipping-error');
      if (error) error.style.display = 'block';
      const selector = document.getElementById('shipping-selector');
      if (selector) selector.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  /**
   * Adapte les champs d'adresse des formulaires selon le mode de livraison.
   *
   * En mode retrait atelier :
   *   - Pre-remplit le champ avec "Retrait a l'atelier"
   *   - Passe le champ en lecture seule avec opacite reduite
   *
   * En mode Colissimo :
   *   - Efface le texte de retrait si present
   *   - Reactive le champ en ecriture normale
   *
   * Applique aux formulaires deposit et full (identifies par prefix-address).
   */
  function updateAddressFields() {
    const isRetrait = orderData.shippingMethod === 'retrait';

    // Formulaires deposit et full : adapter le champ adresse
    ['deposit', 'full'].forEach(function(prefix) {
      const addressField = document.getElementById(prefix + '-address');
      if (!addressField) return;

      if (isRetrait) {
        addressField.value = 'Retrait à l\'atelier';
        addressField.readOnly = true;
        addressField.style.opacity = '0.6';
      } else {
        if (addressField.value === 'Retrait à l\'atelier') {
          addressField.value = '';
        }
        addressField.readOnly = false;
        addressField.style.opacity = '';
      }
    });
  }

  // ============================================================================
  // SELECTION D'OPTION DE PAIEMENT (expose globalement pour onclick)
  // ============================================================================

  /**
   * Selectionne une option de paiement et affiche le formulaire correspondant.
   *
   * Expose globalement (window.selectOption) pour etre appelee depuis
   * les attributs onclick dans le HTML de commander.html.
   *
   * Actions effectuees :
   *   1. Desactive visuellement toutes les options (retire .selected, aria-selected)
   *   2. Active l'option selectionnee
   *   3. Masque tous les formulaires (.order-form)
   *   4. Affiche le formulaire correspondant (#form-{option})
   *   5. Focus sur le premier champ visible (apres 100ms pour l'animation)
   *
   * @param {string} option - Identifiant de l'option : 'deposit', 'full', 'oney', 'rdv'
   */
  window.selectOption = function(option) {
    // Desactiver toutes les options
    document.querySelectorAll('.order-option').forEach(function(el) {
      el.classList.remove('selected');
      el.setAttribute('aria-selected', 'false');
    });

    // Activer l'option selectionnee
    const selectedEl = document.querySelector('[data-option="' + option + '"]');
    if (selectedEl) {
      selectedEl.classList.add('selected');
      selectedEl.setAttribute('aria-selected', 'true');
    }

    // Masquer tous les formulaires
    document.querySelectorAll('.order-form').forEach(function(el) {
      el.classList.remove('active');
    });

    // Afficher le formulaire correspondant et focus sur le premier champ
    const targetForm = document.getElementById('form-' + option);
    if (targetForm) {
      targetForm.classList.add('active');
      const firstInput = targetForm.querySelector('input:not([type="hidden"])');
      if (firstInput) {
        setTimeout(function() { firstInput.focus(); }, 100);
      }
    }
  };

  // ============================================================================
  // DÉLAI DE FABRICATION DYNAMIQUE
  // ============================================================================

  /**
   * Charge le delai de fabrication estime depuis Supabase (namespace=configurateur)
   * et met a jour l'element #delay-estimate sur la page.
   *
   * Le delai est calcule cote admin (formule : max(4, commandesEnCours + 2) semaines)
   * et publie dans la table `configuration`. Fallback : "4 à 6 semaines".
   */
  function loadDelaiFabrication() {
    var el = document.getElementById('delay-estimate');
    if (!el) return;

    // Attendre que Supabase soit disponible
    function fetchDelai() {
      if (!window.MistralDB) {
        el.textContent = 'Délai : 4 à 6 semaines';
        return;
      }
      var client = MistralDB.getClient();
      if (!client) {
        el.textContent = 'Délai : 4 à 6 semaines';
        return;
      }

      client
        .from('configuration')
        .select('value')
        .eq('namespace', 'configurateur')
        .eq('key', 'delai_fabrication')
        .maybeSingle()
        .then(function(result) {
          if (result.data && result.data.value != null) {
            var semaines = parseInt(typeof result.data.value === 'string'
              ? JSON.parse(result.data.value) : result.data.value, 10);
            if (semaines && semaines > 0) {
              el.textContent = 'Délai : environ ' + semaines + ' semaines';
              return;
            }
          }
          el.textContent = 'Délai : 4 à 6 semaines';
        })
        .catch(function() {
          el.textContent = 'Délai : 4 à 6 semaines';
        });
    }

    // MistralDB peut ne pas etre encore charge (dynamique via main.js)
    if (window.MistralDB) {
      fetchDelai();
    } else {
      window.addEventListener('mistral-sync-complete', fetchDelai, { once: true });
      // Fallback si sync ne se declenche pas (timeout 5s)
      setTimeout(function() {
        if (el.textContent.indexOf('en cours') !== -1) {
          fetchDelai();
        }
      }, 5000);
    }
  }

})(window);
