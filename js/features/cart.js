/* ==========================================================================
   MISTRAL PANS - Module Panier (Cart)
   Gestion du panier d'achat via sessionStorage
   Supporte : instruments en stock, accessoires, configuration sur mesure
   ========================================================================== */

(function(window) {
  'use strict';

  var STORAGE_KEY = 'mistral_cart';
  var MAX_ITEMS = 20;

  // ============================================================================
  // STRUCTURE DU PANIER
  // ============================================================================
  //
  // Chaque item du panier suit cette structure :
  // {
  //   id:             string    - UUID unique de l'item dans le panier
  //   type:           string    - 'instrument' | 'accessoire' | 'custom'
  //   sourceId:       string    - ID Supabase (instrument ou accessoire) ou null pour custom
  //   nom:            string    - Nom affiché
  //   prix:           number    - Prix unitaire en EUR
  //   quantite:       number    - Quantité (toujours 1 pour instruments, variable pour accessoires)
  //   image:          string    - URL image ou null
  //   details:        object    - Détails spécifiques au type
  //   options:        array     - Options ajoutées (housse, livraison)
  //   addedAt:        string    - ISO date d'ajout
  // }
  //
  // details pour instrument :
  //   { gamme, tonalite, nombre_notes, accordage, taille, materiau, notes_layout }
  //
  // details pour accessoire :
  //   { categorie, description, tailles_compatibles }
  //
  // details pour custom :
  //   { gamme, tonalite, notes, accordage, taille, materiau }
  //
  // options[] :
  //   [{ type: 'housse', id, nom, prix }]

  // ============================================================================
  // ÉTAT INTERNE
  // ============================================================================

  var cart = [];

  // ============================================================================
  // PERSISTENCE (sessionStorage)
  // ============================================================================

  function save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.warn('[Cart] Erreur sauvegarde:', e);
    }
    dispatchUpdate();
  }

  function load() {
    try {
      var data = sessionStorage.getItem(STORAGE_KEY);
      if (data) {
        cart = JSON.parse(data);
        if (!Array.isArray(cart)) cart = [];
      }
    } catch (e) {
      console.warn('[Cart] Erreur chargement:', e);
      cart = [];
    }
  }

  // ============================================================================
  // GÉNÉRATION D'ID
  // ============================================================================

  function generateId() {
    return 'cart_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  }

  // ============================================================================
  // ÉVÉNEMENTS
  // ============================================================================

  function dispatchUpdate() {
    var event = new CustomEvent('cart-updated', {
      detail: {
        count: getItemCount(),
        total: getTotal(),
        items: getItems()
      }
    });
    window.dispatchEvent(event);
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================

  /**
   * Ajouter un instrument en stock au panier
   */
  function addInstrument(instrument, options) {
    if (!instrument || !instrument.id) return null;
    if (cart.length >= MAX_ITEMS) return null;

    // Vérifier si cet instrument est déjà dans le panier (unicité)
    var existing = cart.find(function(item) {
      return item.type === 'instrument' && item.sourceId === instrument.id;
    });
    if (existing) return existing.id;

    var item = {
      id: generateId(),
      type: 'instrument',
      sourceId: instrument.id,
      nom: instrument.nom || ((instrument.tonalite || '') + ' ' + (instrument.gamme || '')).trim() || 'Instrument',
      prix: instrument.prix_vente || 0,
      quantite: 1,
      image: (instrument.images && instrument.images.length > 0) ? instrument.images[0] : null,
      details: {
        gamme: instrument.gamme || null,
        tonalite: instrument.tonalite || null,
        nombre_notes: instrument.nombre_notes || null,
        accordage: instrument.accordage || null,
        taille: instrument.taille || null,
        materiau: instrument.materiau || null,
        notes_layout: instrument.notes_layout || null
      },
      options: [],
      addedAt: new Date().toISOString()
    };

    // Ajouter les options (housse)
    if (options) {
      if (options.housse) {
        item.options.push({
          type: 'housse',
          id: options.housse.id,
          nom: options.housse.nom,
          prix: options.housse.prix || 0
        });
      }
    }

    cart.push(item);
    save();
    return item.id;
  }

  /**
   * Ajouter un accessoire au panier
   */
  function addAccessoire(accessoire) {
    if (!accessoire || !accessoire.id) return null;
    if (cart.length >= MAX_ITEMS) return null;

    // Vérifier si cet accessoire est déjà dans le panier → incrémenter quantité
    var existing = cart.find(function(item) {
      return item.type === 'accessoire' && item.sourceId === accessoire.id;
    });
    if (existing) {
      existing.quantite = Math.min(existing.quantite + 1, 10);
      save();
      return existing.id;
    }

    var item = {
      id: generateId(),
      type: 'accessoire',
      sourceId: accessoire.id,
      nom: accessoire.nom || 'Accessoire',
      prix: accessoire.prix || 0,
      quantite: 1,
      image: accessoire.image || null,
      details: {
        categorie: accessoire.categorie || null,
        description: accessoire.description || null,
        tailles_compatibles: accessoire.tailles_compatibles || null
      },
      options: [],
      addedAt: new Date().toISOString()
    };

    cart.push(item);
    save();
    return item.id;
  }

  /**
   * Ajouter une configuration sur mesure au panier
   */
  function addCustom(config) {
    if (!config) return null;
    if (cart.length >= MAX_ITEMS) return null;

    var item = {
      id: generateId(),
      type: 'custom',
      sourceId: null,
      nom: config.name || 'Handpan sur mesure',
      prix: config.price || 0,
      quantite: 1,
      image: null,
      details: {
        gamme: config.gamme || config.scale || null,
        tonalite: config.tonalite || config.tonality || null,
        notes: config.notes || null,
        accordage: config.accordage || config.tuning || null,
        taille: config.taille || config.size || null,
        materiau: config.materiau || config.material || null
      },
      options: [],
      addedAt: new Date().toISOString()
    };

    // Housse
    if (config.housse) {
      item.options.push({
        type: 'housse',
        id: config.housse.id,
        nom: config.housse.nom,
        prix: config.housse.prix || 0
      });
    }

    cart.push(item);
    save();
    return item.id;
  }

  /**
   * Retirer un item du panier par son ID
   */
  function removeItem(itemId) {
    var index = cart.findIndex(function(item) { return item.id === itemId; });
    if (index === -1) return false;
    cart.splice(index, 1);
    save();
    return true;
  }

  /**
   * Modifier la quantité d'un item (accessoires uniquement)
   */
  function updateQuantity(itemId, quantity) {
    var item = cart.find(function(i) { return i.id === itemId; });
    if (!item) return false;
    if (item.type !== 'accessoire') return false;
    if (quantity < 1) {
      return removeItem(itemId);
    }
    item.quantite = Math.min(quantity, 10);
    save();
    return true;
  }

  /**
   * Ajouter/supprimer une option sur un item (housse, livraison)
   */
  function updateItemOption(itemId, option) {
    var item = cart.find(function(i) { return i.id === itemId; });
    if (!item) return false;

    // Supprimer l'option existante du même type
    item.options = item.options.filter(function(o) { return o.type !== option.type; });

    // Ajouter si valeur non nulle
    if (option.id || option.prix) {
      item.options.push(option);
    }

    save();
    return true;
  }

  /**
   * Vider le panier
   */
  function clear() {
    cart = [];
    save();
  }

  /**
   * Obtenir tous les items
   */
  function getItems() {
    return cart.slice(); // Copie
  }

  /**
   * Obtenir un item par ID
   */
  function getItem(itemId) {
    return cart.find(function(i) { return i.id === itemId; }) || null;
  }

  /**
   * Nombre total d'items
   */
  function getItemCount() {
    return cart.reduce(function(total, item) {
      return total + item.quantite;
    }, 0);
  }

  /**
   * Prix total d'un item (prix * quantité + options)
   */
  function getItemTotal(item) {
    var base = (item.prix || 0) * (item.quantite || 1);
    var optionsTotal = (item.options || []).reduce(function(sum, opt) {
      return sum + (opt.prix || 0);
    }, 0);
    return base + optionsTotal;
  }

  /**
   * Prix total du panier
   */
  function getTotal() {
    return cart.reduce(function(total, item) {
      return total + getItemTotal(item);
    }, 0);
  }

  /**
   * Le panier est-il vide ?
   */
  function isEmpty() {
    return cart.length === 0;
  }

  /**
   * Vérifier si un sourceId est déjà dans le panier
   */
  function hasItem(sourceId) {
    return cart.some(function(item) { return item.sourceId === sourceId; });
  }

  /**
   * Détermine la source globale du panier
   * 'stock' si que des instruments/accessoires en stock
   * 'custom' si que du sur-mesure
   * 'mixed' si les deux
   */
  function getSource() {
    var hasStock = cart.some(function(i) { return i.type === 'instrument' || i.type === 'accessoire'; });
    var hasCustom = cart.some(function(i) { return i.type === 'custom'; });
    if (hasStock && hasCustom) return 'mixed';
    if (hasCustom) return 'custom';
    return 'stock';
  }

  /**
   * Construit les données pour le checkout (compatible commander.js)
   * Retourne un objet avec items[] et les totaux
   */
  function getCheckoutData() {
    return {
      items: cart.map(function(item) {
        return {
          id: item.id,
          type: item.type,
          sourceId: item.sourceId,
          nom: item.nom,
          prix: item.prix,
          quantite: item.quantite,
          details: item.details,
          options: item.options,
          total: getItemTotal(item)
        };
      }),
      totalPrice: getTotal(),
      itemCount: getItemCount(),
      source: getSource()
    };
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  load();

  // Synchroniser entre onglets (si même session)
  window.addEventListener('storage', function(e) {
    if (e.key === STORAGE_KEY) {
      load();
      dispatchUpdate();
    }
  });

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.MistralCart = {
    addInstrument: addInstrument,
    addAccessoire: addAccessoire,
    addCustom: addCustom,
    removeItem: removeItem,
    updateQuantity: updateQuantity,
    updateItemOption: updateItemOption,
    clear: clear,
    getItems: getItems,
    getItem: getItem,
    getItemCount: getItemCount,
    getItemTotal: getItemTotal,
    getTotal: getTotal,
    isEmpty: isEmpty,
    hasItem: hasItem,
    getSource: getSource,
    getCheckoutData: getCheckoutData
  };

})(window);
