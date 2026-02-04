/* ==========================================================================
   MISTRAL PANS - Module Matériaux Centralisé
   Version 1.0

   Source unique pour les données des matériaux.
   Utilisé par: configurateur, admin, boutique, formulaires
   ========================================================================== */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const STORAGE_KEY = 'mistral_materiaux';

  // Matériaux par défaut (utilisés si localStorage vide ou pour initialisation)
  // Note: tous les matériaux sont au même prix (pas de malus)
  const DEFAULT_MATERIAUX = [
    {
      id: 'mat-ns',
      code: 'NS',
      nom: 'Acier Nitruré',
      nom_court: 'Nitrure',
      description: 'Acier traité par nitruration pour une protection optimale contre la corrosion. Ton d\'or caractéristique.',
      prix_malus: 0,
      ordre: 1,
      couleur: '#C9A227',
      disponible: true,
      visible_configurateur: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'mat-es',
      code: 'ES',
      nom: 'Ember Steel',
      nom_court: 'Ember Steel',
      description: 'Acier avec finition cuivrée unique. Chaleur du son et esthétique distinctive.',
      prix_malus: 0,
      ordre: 2,
      couleur: '#CD853F',
      disponible: true,
      visible_configurateur: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'mat-ss',
      code: 'SS',
      nom: 'Acier Inoxydable',
      nom_court: 'Inox',
      description: 'Acier inoxydable pour une durabilité maximale. Finition brillante argentée.',
      prix_malus: 0,
      ordre: 3,
      couleur: '#C0C0C0',
      disponible: true,
      visible_configurateur: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  // ============================================================================
  // FONCTIONS UTILITAIRES
  // ============================================================================

  function generateId() {
    return 'mat-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // ============================================================================
  // GESTION DU STOCKAGE
  // ============================================================================

  /**
   * Initialise les matériaux si nécessaire
   */
  function initMateriaux() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MATERIAUX));
      console.log('[Materiaux] Données initialisées avec les valeurs par défaut');
    }
  }

  /**
   * Récupère tous les matériaux
   * @returns {Array} Liste des matériaux
   */
  function getAll() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      }
    } catch (e) {
      console.error('[Materiaux] Erreur lecture:', e);
    }
    return [...DEFAULT_MATERIAUX];
  }

  /**
   * Récupère les matériaux disponibles
   * @returns {Array} Liste des matériaux disponibles
   */
  function getDisponibles() {
    return getAll().filter(m => m.disponible);
  }

  /**
   * Récupère les matériaux visibles dans le configurateur
   * @returns {Array} Liste des matériaux pour le configurateur
   */
  function getForConfigurateur() {
    return getAll().filter(m => m.disponible && m.visible_configurateur);
  }

  /**
   * Récupère un matériau par son code
   * @param {string} code - Code du matériau (NS, ES, SS, etc.)
   * @returns {Object|null} Matériau ou null si non trouvé
   */
  function getByCode(code) {
    const materiaux = getAll();
    return materiaux.find(m => m.code === code) || null;
  }

  /**
   * Récupère un matériau par son ID
   * @param {string} id - ID du matériau
   * @returns {Object|null} Matériau ou null si non trouvé
   */
  function getById(id) {
    const materiaux = getAll();
    return materiaux.find(m => m.id === id) || null;
  }

  /**
   * Obtient le label d'affichage pour un code matériau
   * @param {string} code - Code du matériau
   * @param {string} format - Format: 'full', 'short', 'code'
   * @returns {string} Label du matériau
   */
  function getLabel(code, format = 'short') {
    const materiau = getByCode(code);
    if (!materiau) return code;

    switch (format) {
      case 'full':
        return materiau.nom;
      case 'short':
        return materiau.nom_court || materiau.nom;
      case 'code':
        return materiau.code;
      default:
        return materiau.nom_court || materiau.nom;
    }
  }

  /**
   * Obtient le malus de prix pour un matériau
   * @param {string} code - Code du matériau
   * @returns {number} Malus en pourcentage (0-100)
   */
  function getPrixMalus(code) {
    const materiau = getByCode(code);
    return materiau ? (materiau.prix_malus || 0) : 0;
  }

  /**
   * Génère les options HTML pour un select
   * @param {string} selected - Code du matériau sélectionné
   * @param {boolean} configurateurOnly - N'inclure que ceux visibles dans le configurateur
   * @returns {string} HTML des options
   */
  function toSelectOptions(selected = '', configurateurOnly = false) {
    const materiaux = configurateurOnly ? getForConfigurateur() : getDisponibles();
    return materiaux.map(m => {
      const isSelected = m.code === selected ? ' selected' : '';
      const prixInfo = m.prix_malus > 0 ? ` (+${m.prix_malus}%)` : '';
      return `<option value="${m.code}"${isSelected}>${m.nom}${prixInfo}</option>`;
    }).join('');
  }

  // ============================================================================
  // FONCTIONS ADMIN (CRUD)
  // ============================================================================

  /**
   * Sauvegarde un matériau (création ou mise à jour)
   * @param {Object} materiau - Données du matériau
   * @returns {Object} Matériau sauvegardé
   */
  function save(materiau) {
    const materiaux = getAll();
    const now = new Date().toISOString();

    if (materiau.id) {
      // Mise à jour
      const index = materiaux.findIndex(m => m.id === materiau.id);
      if (index !== -1) {
        materiaux[index] = {
          ...materiaux[index],
          ...materiau,
          updated_at: now
        };
      }
    } else {
      // Création
      materiau.id = generateId();
      materiau.created_at = now;
      materiau.updated_at = now;
      materiaux.push(materiau);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(materiaux));
    dispatchUpdate();
    return materiau;
  }

  /**
   * Supprime un matériau
   * @param {string} id - ID du matériau à supprimer
   * @returns {boolean} Succès
   */
  function remove(id) {
    const materiaux = getAll();
    const filtered = materiaux.filter(m => m.id !== id);

    if (filtered.length !== materiaux.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      dispatchUpdate();
      return true;
    }
    return false;
  }

  /**
   * Met à jour la disponibilité d'un matériau
   * @param {string} id - ID du matériau
   * @param {boolean} disponible - Nouvelle disponibilité
   * @returns {boolean} Succès
   */
  function setDisponible(id, disponible) {
    const materiau = getById(id);
    if (materiau) {
      materiau.disponible = disponible;
      return save(materiau) !== null;
    }
    return false;
  }

  /**
   * Met à jour la visibilité dans le configurateur
   * @param {string} id - ID du matériau
   * @param {boolean} visible - Nouvelle visibilité
   * @returns {boolean} Succès
   */
  function setVisibleConfigurateur(id, visible) {
    const materiau = getById(id);
    if (materiau) {
      materiau.visible_configurateur = visible;
      return save(materiau) !== null;
    }
    return false;
  }

  /**
   * Réordonne les matériaux
   * @param {Array} orderedIds - Liste des IDs dans l'ordre souhaité
   */
  function reorder(orderedIds) {
    const materiaux = getAll();
    orderedIds.forEach((id, index) => {
      const materiau = materiaux.find(m => m.id === id);
      if (materiau) {
        materiau.ordre = index + 1;
        materiau.updated_at = new Date().toISOString();
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(materiaux));
    dispatchUpdate();
  }

  /**
   * Réinitialise les matériaux aux valeurs par défaut
   */
  function reset() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MATERIAUX));
    dispatchUpdate();
  }

  // ============================================================================
  // ÉVÉNEMENTS
  // ============================================================================

  function dispatchUpdate() {
    window.dispatchEvent(new CustomEvent('materiauxUpdated', {
      detail: { materiaux: getAll() }
    }));
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  // Initialiser au chargement
  initMateriaux();

  // ============================================================================
  // EXPORTS
  // ============================================================================

  window.MistralMateriaux = {
    // Lecture
    getAll,
    getDisponibles,
    getForConfigurateur,
    getByCode,
    getById,
    getLabel,
    getPrixMalus,
    toSelectOptions,

    // Admin
    save,
    remove,
    setDisponible,
    setVisibleConfigurateur,
    reorder,
    reset,

    // Constantes
    STORAGE_KEY,
    DEFAULT_MATERIAUX
  };

  console.log('[Materiaux] Module initialisé');

})();
