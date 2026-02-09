/* ==========================================================================
   MISTRAL PANS - Module de Gestion Administrative
   Facturation, Locations, Clients, Instruments
   Phase 1: Standalone avec localStorage
   ========================================================================== */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const CONFIG = {
    VERSION: '1.0.0',
    
    // Storage keys
    STORAGE_KEYS: {
      clients: 'mistral_gestion_clients',
      instruments: 'mistral_gestion_instruments',
      locations: 'mistral_gestion_locations',
      commandes: 'mistral_gestion_commandes',
      factures: 'mistral_gestion_factures',
      config: 'mistral_gestion_config'
    },
    
    // Configuration entreprise par défaut
    ENTREPRISE: {
      nom: 'Adrien Santamaria',
      marque: 'Mistral Pan',
      adresse: '105 rue du bas val Mary',
      codePostal: '95630',
      ville: 'Mériel',
      siret: '889 482 758 00014',
      email: 'adrien.santamaria@gmail.com',
      telephone: '07 62 76 65 30',
      iban: 'FR76 1751 5000 9208 0035 0475 637',
      bic: 'CEPAFRPP751',
      banque: 'Caisse d\'Épargne'
    },
    
    // Valeurs par défaut
    DEFAULTS: {
      loyerMensuel: 50,
      montantCaution: 1150,
      fraisDossierTransport: 100,
      fraisTransportRetour: 40,
      dureeEngagementMois: 3,
      // Tarification configurateur
      prixParNote: 115,
      bonusOctave2: 50,
      bonusBottoms: 25,
      malusDifficulteWarning: 5,
      malusDifficulteDifficile: 10
    },
    
    // Types de factures
    TYPES_FACTURE: {
      vente: 'Vente',
      acompte: 'Acompte',
      solde: 'Solde',
      location: 'Location',
      prestation: 'Prestation',
      avoir: 'Avoir'
    },
    
    // Statuts
    STATUTS: {
      location: {
        en_cours: 'En cours',
        terminee: 'Terminée',
        annulee: 'Annulée'
      },
      commande: {
        en_attente: 'En attente',
        en_fabrication: 'En fabrication',
        accordage: 'Accordage',
        pret: 'Prêt',
        expedie: 'Expédié',
        livre: 'Livré',
        annule: 'Annulé'
      },
      paiement: {
        en_attente: 'En attente',
        partiel: 'Partiel',
        paye: 'Payé'
      },
      caution: {
        en_attente: 'En attente',
        recue: 'Reçue',
        restituee: 'Restituée',
        encaissee: 'Encaissée'
      },
      instrument: {
        disponible: 'Disponible',
        en_location: 'En location',
        vendu: 'Vendu',
        en_fabrication: 'En fabrication'
      }
    }
  };

  // ============================================================================
  // UTILITAIRES
  // ============================================================================
  
  /**
   * Genere un UUID v4 (crypto-safe)
   */
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback navigateurs anciens
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Génère un ID court avec préfixe
   */
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Formate une date en français
   */
  function formatDate(dateString, options = {}) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const defaultOptions = { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    };
    return date.toLocaleDateString('fr-FR', { ...defaultOptions, ...options });
  }

  /**
   * Formate une date courte (JJ/MM/AAAA)
   */
  function formatDateShort(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  }

  /**
   * Formate un prix en euros
   */
  function formatPrice(price) {
    if (price === null || price === undefined) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price);
  }

  /**
   * Formate un prix sans symbole euro
   */
  function formatPriceRaw(price) {
    if (price === null || price === undefined) return '0,00';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  }

  /**
   * Parse un prix (string) en nombre
   */
  function parsePrice(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    return parseFloat(str.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidDate(str) {
    return /^\d{4}-\d{2}-\d{2}/.test(str) && !isNaN(new Date(str).getTime());
  }

  /**
   * Valide les donnees d'un client (champs requis + formats)
   * @throws {Error} si validation echoue
   */
  function validateClient(data) {
    if (!data.nom || !data.nom.trim()) {
      throw new Error('Le nom du client est requis');
    }
    if (data.email && data.email.trim() && !isValidEmail(data.email.trim())) {
      throw new Error('Format email invalide');
    }
  }

  /**
   * Valide les donnees d'un instrument
   * @throws {Error} si validation echoue
   */
  function validateInstrument(data) {
    if (!data.reference || !data.reference.trim()) {
      throw new Error('La reference de l\'instrument est requise');
    }
    if (data.prix_vente !== undefined && data.prix_vente !== null) {
      const prix = parsePrice(data.prix_vente);
      if (prix < 0) throw new Error('Le prix de vente ne peut pas etre negatif');
    }
  }

  /**
   * Valide les donnees d'une location
   * @throws {Error} si validation echoue
   */
  function validateLocation(data) {
    if (!data.client_id) throw new Error('Le client est requis');
    if (!data.instrument_id) throw new Error('L\'instrument est requis');
    if (data.loyer_mensuel !== undefined) {
      const loyer = parsePrice(data.loyer_mensuel);
      if (loyer < 0) throw new Error('Le loyer ne peut pas etre negatif');
    }
  }

  /**
   * Valide les donnees d'une commande
   * @throws {Error} si validation echoue
   */
  function validateCommande(data) {
    if (!data.client_id) throw new Error('Le client est requis');
    if (data.montant_total !== undefined) {
      const montant = parsePrice(data.montant_total);
      if (montant < 0) throw new Error('Le montant ne peut pas etre negatif');
    }
  }

  /**
   * Valide les donnees d'une facture
   * @throws {Error} si validation echoue
   */
  function validateFacture(data) {
    if (!data.client_id) throw new Error('Le client est requis');
    if (!data.lignes || !Array.isArray(data.lignes) || data.lignes.length === 0) {
      throw new Error('Au moins une ligne de facture est requise');
    }
    const validTypes = ['vente', 'acompte', 'solde', 'location', 'prestation', 'avoir'];
    if (data.type && !validTypes.includes(data.type)) {
      throw new Error('Type de facture invalide: ' + data.type);
    }
  }

  /**
   * Échappe le HTML pour éviter les injections XSS
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Deep clone un objet
   */
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Génère le prochain numéro de facture
   * Format: AAAA-MM-NNN
   */
  function generateNumeroFacture() {
    const config = getConfig();
    const dernierNumero = parseInt(config.dernier_numero_facture || '0');
    const nouveauNumero = dernierNumero + 1;
    
    const now = new Date();
    const annee = now.getFullYear();
    const mois = String(now.getMonth() + 1).padStart(2, '0');
    
    // Mettre à jour le dernier numéro
    setConfigValue('dernier_numero_facture', nouveauNumero.toString());
    
    return `${annee}-${mois}-${nouveauNumero}`;
  }

  // ============================================================================
  // STOCKAGE (via MistralSync in-memory store)
  // ============================================================================

  /**
   * Récupère les données depuis le store in-memory (MistralSync)
   */
  function getData(key) {
    const localKey = CONFIG.STORAGE_KEYS[key];
    if (window.MistralSync && MistralSync.hasKey(localKey)) {
      return MistralSync.getData(localKey);
    }
    return [];
  }

  /**
   * Sauvegarde les données via MistralSync (memoire + Supabase)
   */
  function setData(key, data) {
    const localKey = CONFIG.STORAGE_KEYS[key];
    if (window.MistralSync && MistralSync.hasKey(localKey)) {
      return MistralSync.setData(localKey, data);
    }
    return false;
  }

  /**
   * Supprime un enregistrement dans Supabase (apres suppression locale)
   */
  function deleteRemote(storageKey, id) {
    const localKey = CONFIG.STORAGE_KEYS[storageKey];
    if (window.MistralSync && MistralSync.deleteFromSupabase) {
      MistralSync.deleteFromSupabase(localKey, id).catch(err => {
        console.error(`[Gestion] Erreur suppression Supabase ${storageKey}/${id}:`, err);
      });
    }
  }

  /**
   * Récupère la configuration (MistralSync pour les cles gerees, fallback localStorage)
   */
  function getConfig() {
    const localKey = CONFIG.STORAGE_KEYS.config;
    let stored = {};

    // Essayer MistralSync d'abord (in-memory + Supabase backed)
    if (window.MistralSync && MistralSync.hasKey(localKey)) {
      stored = MistralSync.getData(localKey) || {};
    } else {
      // Fallback localStorage (avant que MistralSync soit pret)
      try {
        const data = localStorage.getItem(localKey);
        stored = data ? JSON.parse(data) : {};
      } catch (e) {
        console.error('Erreur lecture config:', e);
      }
    }

    // Fusionner avec les valeurs par défaut de l'entreprise
    return {
      ...CONFIG.ENTREPRISE,
      ...CONFIG.DEFAULTS,
      ...stored
    };
  }

  /**
   * Met à jour une valeur de configuration
   */
  function setConfigValue(key, value) {
    const localKey = CONFIG.STORAGE_KEYS.config;

    // Lire la config actuelle (sans les defaults pour ne sauvegarder que les overrides)
    let stored = {};
    if (window.MistralSync && MistralSync.hasKey(localKey)) {
      stored = MistralSync.getData(localKey) || {};
    } else {
      try {
        const data = localStorage.getItem(localKey);
        stored = data ? JSON.parse(data) : {};
      } catch (e) { /* ignorer */ }
    }

    stored[key] = value;

    // Ecrire via MistralSync (memoire + Supabase)
    if (window.MistralSync && MistralSync.hasKey(localKey)) {
      return MistralSync.setData(localKey, stored);
    }

    // Fallback localStorage
    try {
      localStorage.setItem(localKey, JSON.stringify(stored));
      return true;
    } catch (e) {
      console.error('Erreur écriture config:', e);
      return false;
    }
  }

  // ============================================================================
  // CRUD CLIENTS
  // ============================================================================
  
  const Clients = {
    /**
     * Liste tous les clients
     */
    list() {
      return getData('clients');
    },

    /**
     * Récupère un client par ID
     */
    get(id) {
      const clients = this.list();
      return clients.find(c => c.id === id);
    },

    /**
     * Recherche des clients
     */
    search(query) {
      if (!query) return this.list();
      const q = query.toLowerCase();
      return this.list().filter(c => 
        (c.nom && c.nom.toLowerCase().includes(q)) ||
        (c.prenom && c.prenom.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.telephone && c.telephone.includes(q))
      );
    },

    /**
     * Crée un nouveau client
     */
    create(data) {
      validateClient(data);
      const clients = this.list();
      const client = {
        id: generateUUID(),
        nom: data.nom.trim(),
        prenom: (data.prenom || '').trim(),
        email: data.email || '',
        telephone: data.telephone || '',
        adresse: data.adresse || '',
        piece_identite_url: data.piece_identite_url || '',
        justificatif_domicile_url: data.justificatif_domicile_url || '',
        notes: data.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      clients.push(client);
      setData('clients', clients);
      return client;
    },

    /**
     * Met à jour un client
     */
    update(id, data) {
      const clients = this.list();
      const index = clients.findIndex(c => c.id === id);
      if (index === -1) return null;
      
      clients[index] = {
        ...clients[index],
        ...data,
        id, // Préserver l'ID
        updated_at: new Date().toISOString()
      };
      setData('clients', clients);
      return clients[index];
    },

    /**
     * Supprime un client
     */
    delete(id) {
      const clients = this.list();
      const filtered = clients.filter(c => c.id !== id);
      if (filtered.length === clients.length) return false;
      setData('clients', filtered);
      deleteRemote('clients', id);
      return true;
    },

    /**
     * Récupère le nom complet du client
     */
    getNomComplet(id) {
      const client = this.get(id);
      if (!client) return 'Client inconnu';
      return `${client.prenom || ''} ${client.nom || ''}`.trim() || 'Sans nom';
    },

    /**
     * Récupère l'historique des locations d'un client
     */
    getLocations(id) {
      return Locations.list().filter(l => l.client_id === id);
    },

    /**
     * Récupère l'historique des factures d'un client
     */
    getFactures(id) {
      return Factures.list().filter(f => f.client_id === id);
    },

    /**
     * Ajoute du crédit fidélité à un client
     */
    ajouterCredit(id, montant) {
      const client = this.get(id);
      if (!client) return null;

      const creditActuel = parseFloat(client.credit_fidelite) || 0;
      const montantParse = parsePrice(montant);
      if (montantParse === 0 && montant !== 0) return null;
      const nouveauCredit = creditActuel + montantParse;
      
      return this.update(id, {
        credit_fidelite: nouveauCredit
      });
    },

    /**
     * Utilise du crédit fidélité
     */
    utiliserCredit(id, montant) {
      const client = this.get(id);
      if (!client) return null;
      
      const creditActuel = parseFloat(client.credit_fidelite) || 0;
      const montantUtilise = Math.min(montant, creditActuel);
      const nouveauCredit = creditActuel - montantUtilise;
      
      this.update(id, {
        credit_fidelite: nouveauCredit
      });
      
      return montantUtilise;
    },

    /**
     * Récupère le crédit fidélité d'un client
     */
    getCredit(id) {
      const client = this.get(id);
      return client ? (parseFloat(client.credit_fidelite) || 0) : 0;
    }
  };

  // ============================================================================
  // CRUD INSTRUMENTS
  // ============================================================================
  
  // ============================================================================
  // VALIDATION DES TRANSITIONS DE STATUT D'INSTRUMENT
  // ============================================================================

  /**
   * Définit les transitions de statut valides pour les instruments
   * Clé = statut actuel, Valeur = tableau des statuts autorisés
   */
  const VALID_STATUS_TRANSITIONS = {
    'en_fabrication': ['disponible', 'reserve'],
    'disponible': ['en_ligne', 'en_location', 'vendu', 'reserve', 'prete'],
    'en_ligne': ['disponible', 'en_location', 'vendu', 'reserve'],
    'reserve': ['disponible', 'en_ligne', 'vendu', 'en_location'],
    'en_location': ['disponible'],
    'prete': ['disponible'],
    'vendu': [] // Statut final, pas de transition possible
  };

  /**
   * Vérifie si une transition de statut est valide
   * @param {string} currentStatus - Statut actuel
   * @param {string} newStatus - Nouveau statut souhaité
   * @returns {{ valid: boolean, message?: string }}
   */
  function validateStatusTransition(currentStatus, newStatus) {
    // Même statut = toujours valide
    if (currentStatus === newStatus) {
      return { valid: true };
    }

    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

    if (!allowedTransitions) {
      return {
        valid: false,
        message: `Statut actuel "${currentStatus}" non reconnu`
      };
    }

    if (allowedTransitions.length === 0) {
      return {
        valid: false,
        message: `L'instrument est "${currentStatus}" et ne peut plus changer de statut`
      };
    }

    if (!allowedTransitions.includes(newStatus)) {
      return {
        valid: false,
        message: `Transition de "${currentStatus}" vers "${newStatus}" non autorisée. Transitions possibles: ${allowedTransitions.join(', ')}`
      };
    }

    return { valid: true };
  }

  const Instruments = {
    /**
     * Liste tous les instruments
     */
    list() {
      return getData('instruments');
    },

    /**
     * Récupère un instrument par ID
     */
    get(id) {
      const instruments = this.list();
      return instruments.find(i => i.id === id);
    },

    /**
     * Liste les instruments disponibles
     */
    listDisponibles() {
      return this.list().filter(i => i.statut === 'disponible');
    },

    /**
     * Recherche des instruments
     */
    search(query) {
      if (!query) return this.list();
      const q = query.toLowerCase();
      return this.list().filter(i => 
        (i.reference && i.reference.toLowerCase().includes(q)) ||
        (i.nom && i.nom.toLowerCase().includes(q)) ||
        (i.gamme && i.gamme.toLowerCase().includes(q))
      );
    },

    /**
     * Crée un nouvel instrument
     */
    create(data) {
      validateInstrument(data);
      const instruments = this.list();
      const instrument = {
        id: generateUUID(),
        reference: data.reference.trim(),
        nom: data.nom || '',
        gamme: data.gamme || '',
        notes: data.notes || '',
        taille: data.taille || null,
        accordage: data.accordage || 440,
        materiau: data.materiau || 'Acier nitruré',
        statut: data.statut || 'disponible',
        prix_vente: parsePrice(data.prix_vente) || 0,
        prix_location_mensuel: parsePrice(data.prix_location_mensuel) || CONFIG.DEFAULTS.loyerMensuel,
        montant_caution: parsePrice(data.montant_caution) || CONFIG.DEFAULTS.montantCaution,
        description: data.description || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      instruments.push(instrument);
      setData('instruments', instruments);
      return instrument;
    },

    /**
     * Met à jour un instrument
     */
    update(id, data) {
      const instruments = this.list();
      const index = instruments.findIndex(i => i.id === id);
      if (index === -1) return null;
      
      instruments[index] = {
        ...instruments[index],
        ...data,
        id,
        updated_at: new Date().toISOString()
      };
      setData('instruments', instruments);
      return instruments[index];
    },

    /**
     * Supprime un instrument
     */
    delete(id) {
      const instruments = this.list();
      const filtered = instruments.filter(i => i.id !== id);
      if (filtered.length === instruments.length) return false;
      setData('instruments', filtered);
      deleteRemote('instruments', id);
      return true;
    },

    /**
     * Change le statut d'un instrument avec validation
     * @param {string} id - ID de l'instrument
     * @param {string} statut - Nouveau statut
     * @param {boolean} force - Forcer le changement sans validation (défaut: false)
     * @returns {Object|null} - Instrument mis à jour ou null si erreur
     */
    setStatut(id, statut, force = false) {
      const instrument = this.get(id);
      if (!instrument) return null;

      // Validation de la transition (sauf si forcée)
      if (!force) {
        const validation = validateStatusTransition(instrument.statut, statut);
        if (!validation.valid) {
          if (window.MISTRAL_DEBUG) console.warn(`[Gestion] Transition de statut refusée: ${validation.message}`);
          // Dispatch un événement pour notifier l'UI
          window.dispatchEvent(new CustomEvent('mistral-status-error', {
            detail: {
              instrumentId: id,
              currentStatus: instrument.statut,
              requestedStatus: statut,
              message: validation.message
            }
          }));
          return null;
        }
      }

      return this.update(id, { statut });
    },

    /**
     * Vérifie si une transition de statut est valide
     */
    canTransitionTo(id, newStatus) {
      const instrument = this.get(id);
      if (!instrument) return false;
      return validateStatusTransition(instrument.statut, newStatus).valid;
    },

    /**
     * Retourne les transitions possibles pour un instrument
     */
    getPossibleTransitions(id) {
      const instrument = this.get(id);
      if (!instrument) return [];
      return VALID_STATUS_TRANSITIONS[instrument.statut] || [];
    }
  };

  // ============================================================================
  // CRUD LOCATIONS
  // ============================================================================
  
  const Locations = {
    /**
     * Liste toutes les locations
     */
    list() {
      return getData('locations');
    },

    /**
     * Récupère une location par ID
     */
    get(id) {
      const locations = this.list();
      return locations.find(l => l.id === id);
    },

    /**
     * Liste les locations en cours
     */
    listEnCours() {
      return this.list().filter(l => l.statut === 'en_cours');
    },

    /**
     * Crée une nouvelle location
     */
    create(data) {
      validateLocation(data);
      const locations = this.list();

      // Calculer la date de fin d'engagement
      const dateDebut = new Date(data.date_debut || new Date());
      const dateFinEngagement = new Date(dateDebut);
      dateFinEngagement.setMonth(dateFinEngagement.getMonth() + (data.duree_engagement || CONFIG.DEFAULTS.dureeEngagementMois));
      
      const location = {
        id: generateUUID(),
        client_id: data.client_id,
        instrument_id: data.instrument_id,
        mode_location: data.mode_location || 'local', // 'local' ou 'distance'
        date_debut: data.date_debut || new Date().toISOString().split('T')[0],
        date_fin_engagement: data.date_fin_engagement || dateFinEngagement.toISOString().split('T')[0],
        date_fin_effective: null,
        statut: 'en_cours',
        loyer_mensuel: parsePrice(data.loyer_mensuel) || CONFIG.DEFAULTS.loyerMensuel,
        montant_caution: parsePrice(data.montant_caution) || CONFIG.DEFAULTS.montantCaution,
        caution_mode: data.mode_location === 'distance' ? 'swikly' : 'cheque',
        caution_statut: 'en_attente',
        frais_dossier_transport: data.mode_location === 'distance' ? CONFIG.DEFAULTS.fraisDossierTransport : 0,
        swikly_id: data.swikly_id || null,
        accessoires: data.accessoires || '',
        contrat_pdf_url: null,
        signature_date: null,
        signature_ip: null,
        notes: data.notes || '',
        paiements: [], // Historique des paiements mensuels
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      locations.push(location);
      setData('locations', locations);
      
      // Mettre l'instrument en location
      Instruments.setStatut(data.instrument_id, 'en_location');
      
      return location;
    },

    /**
     * Met à jour une location
     */
    update(id, data) {
      const locations = this.list();
      const index = locations.findIndex(l => l.id === id);
      if (index === -1) return null;
      
      locations[index] = {
        ...locations[index],
        ...data,
        id,
        updated_at: new Date().toISOString()
      };
      setData('locations', locations);
      return locations[index];
    },

    /**
     * Termine une location
     */
    terminer(id, data = {}) {
      const location = this.get(id);
      if (!location) return null;
      
      this.update(id, {
        statut: 'terminee',
        date_fin_effective: data.date_fin || new Date().toISOString().split('T')[0],
        caution_statut: data.caution_encaissee ? 'encaissee' : 'restituee'
      });
      
      // Remettre l'instrument disponible
      Instruments.setStatut(location.instrument_id, 'disponible');
      
      // Calculer et ajouter le crédit fidélité au client
      const config = getConfig();
      const pourcent = config.creditFidelitePourcent || 50;
      
      if (pourcent > 0 && location.client_id) {
        // Calculer le nombre de mois de location
        const debut = new Date(location.date_debut);
        const fin = new Date(data.date_fin || new Date());
        const moisLocation = Math.max(1, Math.round((fin - debut) / (1000 * 60 * 60 * 24 * 30)));
        const loyerMensuel = location.loyer_mensuel || config.loyerMensuel || 50;
        const totalLoyers = moisLocation * loyerMensuel;
        const creditAjoute = Math.round(totalLoyers * pourcent / 100);
        
        if (creditAjoute > 0) {
          Clients.ajouterCredit(location.client_id, creditAjoute);
        }
      }
      
      return this.get(id);
    },

    /**
     * Annule une location
     */
    annuler(id) {
      const location = this.get(id);
      if (!location) return null;
      
      this.update(id, { statut: 'annulee' });
      
      // Remettre l'instrument disponible si nécessaire
      if (location.statut === 'en_cours') {
        Instruments.setStatut(location.instrument_id, 'disponible');
      }
      
      return this.get(id);
    },

    /**
     * Enregistre un paiement mensuel
     */
    enregistrerPaiement(id, paiement) {
      const location = this.get(id);
      if (!location) return null;
      
      const paiements = location.paiements || [];
      paiements.push({
        id: generateId('pmt'),
        mois: paiement.mois, // Format: 'AAAA-MM'
        montant: parsePrice(paiement.montant),
        date_paiement: paiement.date_paiement || new Date().toISOString().split('T')[0],
        mode: paiement.mode || 'virement',
        notes: paiement.notes || ''
      });
      
      return this.update(id, { paiements });
    },

    /**
     * Supprime une location
     */
    delete(id) {
      const locations = this.list();
      const location = this.get(id);
      const filtered = locations.filter(l => l.id !== id);
      if (filtered.length === locations.length) return false;

      // Remettre l'instrument disponible si la location était en cours
      if (location && location.statut === 'en_cours') {
        Instruments.setStatut(location.instrument_id, 'disponible');
      }

      setData('locations', filtered);
      deleteRemote('locations', id);
      return true;
    }
  };

  // ============================================================================
  // CRUD COMMANDES
  // ============================================================================
  
  const Commandes = {
    /**
     * Liste toutes les commandes
     */
    list() {
      return getData('commandes');
    },

    /**
     * Récupère une commande par ID
     */
    get(id) {
      const commandes = this.list();
      return commandes.find(c => c.id === id);
    },

    /**
     * Liste les commandes en cours
     */
    listEnCours() {
      return this.list().filter(c => 
        c.statut === 'en_attente' || 
        c.statut === 'en_fabrication' || 
        c.statut === 'pret'
      );
    },

    /**
     * Crée une nouvelle commande
     */
    create(data) {
      validateCommande(data);
      const commandes = this.list();
      const commande = {
        id: generateUUID(),
        client_id: data.client_id,
        instrument_id: data.instrument_id || null,
        description: data.description || '',
        montant_total: parsePrice(data.montant_total) || 0,
        montant_paye: 0,
        statut: 'en_attente',
        date_commande: data.date_commande || new Date().toISOString(),
        date_livraison_prevue: data.date_livraison_prevue || null,
        notes: data.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      commandes.push(commande);
      setData('commandes', commandes);
      return commande;
    },

    /**
     * Met à jour une commande
     */
    update(id, data) {
      const commandes = this.list();
      const index = commandes.findIndex(c => c.id === id);
      if (index === -1) return null;
      
      commandes[index] = {
        ...commandes[index],
        ...data,
        id,
        updated_at: new Date().toISOString()
      };
      setData('commandes', commandes);
      return commandes[index];
    },

    /**
     * Ajoute un acompte à la commande
     */
    ajouterAcompte(id, montant) {
      const commande = this.get(id);
      if (!commande) return null;
      
      const nouveauMontantPaye = (commande.montant_paye || 0) + parsePrice(montant);
      return this.update(id, { montant_paye: nouveauMontantPaye });
    },

    /**
     * Calcule le solde restant
     */
    getSoldeRestant(id) {
      const commande = this.get(id);
      if (!commande) return 0;
      return commande.montant_total - (commande.montant_paye || 0);
    },

    /**
     * Change le statut d'une commande
     */
    setStatut(id, statut) {
      return this.update(id, { statut });
    },

    /**
     * Supprime une commande
     */
    delete(id) {
      const commandes = this.list();
      const filtered = commandes.filter(c => c.id !== id);
      if (filtered.length === commandes.length) return false;
      setData('commandes', filtered);
      deleteRemote('commandes', id);
      return true;
    }
  };

  // ============================================================================
  // CRUD FACTURES
  // ============================================================================
  
  const Factures = {
    /**
     * Liste toutes les factures
     */
    list() {
      return getData('factures');
    },

    /**
     * Récupère une facture par ID
     */
    get(id) {
      const factures = this.list();
      return factures.find(f => f.id === id);
    },

    /**
     * Récupère une facture par numéro
     */
    getByNumero(numero) {
      const factures = this.list();
      return factures.find(f => f.numero === numero);
    },

    /**
     * Liste les factures en attente de paiement
     */
    listEnAttente() {
      return this.list().filter(f => f.statut_paiement === 'en_attente' && f.statut !== 'annulee');
    },

    /**
     * Crée une nouvelle facture
     * @param {Object} data - Données de la facture
     * @param {string} data.type - Type: vente, acompte, solde, location, prestation, avoir
     * @param {string} data.client_id - ID du client
     * @param {Array} data.lignes - Lignes de facture [{description, quantite, prix_unitaire}]
     */
    create(data) {
      validateFacture(data);
      const factures = this.list();

      // Calculer le sous-total
      const lignes = data.lignes || [];
      const sousTotal = lignes.reduce((sum, l) => sum + (l.quantite || 1) * (parsePrice(l.prix_unitaire) || 0), 0);
      
      // Déduire les acomptes si c'est une facture de solde
      const acomptesDeduits = parsePrice(data.acomptes_deduits) || 0;
      const total = sousTotal - acomptesDeduits;
      
      const facture = {
        id: generateUUID(),
        numero: generateNumeroFacture(),
        date: data.date || data.date_emission || new Date().toISOString().split('T')[0],
        date_emission: data.date_emission || data.date || new Date().toISOString().split('T')[0],
        client_id: data.client_id,
        type: data.type || 'vente',
        commande_id: data.commande_id || null,
        location_id: data.location_id || null,
        lignes: lignes.map(l => ({
          description: l.description || '',
          quantite: l.quantite || 1,
          prix_unitaire: parsePrice(l.prix_unitaire) || 0,
          total: (l.quantite || 1) * (parsePrice(l.prix_unitaire) || 0)
        })),
        sous_total: sousTotal,
        montant_ht: sousTotal,
        acomptes_deduits: acomptesDeduits,
        total: total,
        montant_ttc: total,
        factures_acompte_ids: data.factures_acompte_ids || [],
        statut_paiement: data.statut_paiement || 'en_attente',
        date_paiement: data.date_paiement || null,
        date_echeance: data.date_echeance || null,
        mode_paiement: data.mode_paiement || null,
        pdf_url: null,
        notes: data.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      factures.push(facture);
      setData('factures', factures);
      
      // Si c'est un acompte, mettre à jour la commande liée
      if (data.type === 'acompte' && data.commande_id) {
        Commandes.ajouterAcompte(data.commande_id, total);
      }
      
      return facture;
    },

    /**
     * Met à jour une facture
     */
    update(id, data) {
      const factures = this.list();
      const index = factures.findIndex(f => f.id === id);
      if (index === -1) return null;
      
      factures[index] = {
        ...factures[index],
        ...data,
        id,
        updated_at: new Date().toISOString()
      };
      setData('factures', factures);
      return factures[index];
    },

    /**
     * Marque une facture comme payée
     */
    marquerPayee(id, data = {}) {
      return this.update(id, {
        statut_paiement: 'paye',
        date_paiement: data.date_paiement || new Date().toISOString().split('T')[0],
        mode_paiement: data.mode_paiement || 'virement'
      });
    },

    /**
     * Annule une facture (soft-delete — suppression interdite, conformite legale)
     */
    annuler(id) {
      return this.update(id, {
        statut: 'annulee',
        date_annulation: new Date().toISOString().split('T')[0]
      });
    },

    /**
     * Récupère les factures d'acompte liées à une commande
     */
    getAcomptesCommande(commandeId) {
      return this.list().filter(f => 
        f.commande_id === commandeId && 
        f.type === 'acompte'
      );
    }
  };

  // ============================================================================
  // EXPORT / IMPORT
  // ============================================================================
  
  const DataManager = {
    /**
     * Exporte toutes les données en JSON
     */
    exportAll() {
      return {
        version: CONFIG.VERSION,
        exported_at: new Date().toISOString(),
        data: {
          clients: Clients.list(),
          instruments: Instruments.list(),
          locations: Locations.list(),
          commandes: Commandes.list(),
          factures: Factures.list(),
          config: getConfig()
        }
      };
    },

    /**
     * Importe des données depuis JSON
     */
    importAll(jsonData) {
      try {
        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

        if (data.data) {
          if (data.data.clients) setData('clients', data.data.clients);
          if (data.data.instruments) setData('instruments', data.data.instruments);
          if (data.data.locations) setData('locations', data.data.locations);
          if (data.data.commandes) setData('commandes', data.data.commandes);
          if (data.data.factures) setData('factures', data.data.factures);
          if (data.data.config) {
            const configKey = CONFIG.STORAGE_KEYS.config;
            if (window.MistralSync && MistralSync.hasKey(configKey)) {
              MistralSync.setData(configKey, data.data.config);
            } else {
              try {
                localStorage.setItem(configKey, JSON.stringify(data.data.config));
              } catch (e) {
                console.error('Erreur import config:', e);
              }
            }
          }
        }

        return { success: true };
      } catch (e) {
        console.error('Erreur import:', e);
        return { success: false, error: e.message };
      }
    },

    /**
     * Télécharge l'export en fichier JSON
     */
    downloadExport() {
      const data = this.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mistral-gestion-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    /**
     * Réinitialise toutes les données
     */
    resetAll() {
      // Vider les cles gerees par MistralSync
      Object.entries(CONFIG.STORAGE_KEYS).forEach(([name, key]) => {
        if (window.MistralSync && MistralSync.hasKey(key)) {
          const tableConfig = MistralSync.getTableConfig(key);
          MistralSync.setData(key, (tableConfig && tableConfig.isKeyValue) ? {} : []);
        } else {
          try { localStorage.removeItem(key); } catch (e) {}
        }
      });
    }
  };

  // ============================================================================
  // STATISTIQUES
  // ============================================================================
  
  const Stats = {
    /**
     * Revenus du mois en cours (factures payées non annulées)
     */
    getRevenusMois() {
      const now = new Date();
      const moisCourant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      return Factures.list()
        .filter(f => f.date && f.date.startsWith(moisCourant) && f.statut_paiement === 'paye' && f.statut !== 'annulee')
        .reduce((sum, f) => sum + (f.total || f.montant_ttc || 0), 0);
    },
    
    /**
     * Revenus de l'année en cours (factures payées non annulées)
     */
    getRevenusAnnee() {
      const anneeCourante = String(new Date().getFullYear());
      
      return Factures.list()
        .filter(f => f.date && f.date.startsWith(anneeCourante) && f.statut_paiement === 'paye' && f.statut !== 'annulee')
        .reduce((sum, f) => sum + (f.total || f.montant_ttc || 0), 0);
    },

    /**
     * Nombre de locations en cours
     */
    getLocationsEnCours() {
      return Locations.listEnCours().length;
    },

    /**
     * Nombre de factures en attente
     */
    getFacturesEnAttente() {
      return Factures.listEnAttente().length;
    },

    /**
     * Commandes en cours
     */
    getCommandesEnCours() {
      return Commandes.listEnCours().length;
    },

    /**
     * Alertes (paiements en retard, etc.)
     */
    getAlertes() {
      const alertes = [];
      const now = new Date();
      
      // Factures en attente depuis plus de 30 jours
      Factures.listEnAttente().forEach(f => {
        const dateFacture = new Date(f.date);
        const joursDepuis = Math.floor((now - dateFacture) / (1000 * 60 * 60 * 24));
        if (joursDepuis > 30) {
          alertes.push({
            type: 'warning',
            message: `Facture ${f.numero} en attente depuis ${joursDepuis} jours`,
            entity: 'facture',
            id: f.id
          });
        }
      });
      
      // Locations sans caution reçue
      Locations.listEnCours().forEach(l => {
        if (l.caution_statut === 'en_attente') {
          alertes.push({
            type: 'warning',
            message: `Location sans caution reçue`,
            entity: 'location',
            id: l.id
          });
        }
      });
      
      return alertes;
    }
  };

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================
  
  window.MistralGestion = {
    // Configuration
    CONFIG,
    getConfig,
    setConfigValue,

    // Utilitaires
    utils: {
      generateUUID,
      generateId,
      formatDate,
      formatDateShort,
      formatPrice,
      formatPriceRaw,
      parsePrice,
      escapeHtml,
      deepClone
    },

    // Validation des statuts d'instruments
    StatusValidation: {
      VALID_TRANSITIONS: VALID_STATUS_TRANSITIONS,
      validate: validateStatusTransition
    },

    // CRUD
    Clients,
    Instruments,
    Locations,
    Commandes,
    Factures,

    // Data management
    DataManager,

    // Stats
    Stats
  };

})(window);
