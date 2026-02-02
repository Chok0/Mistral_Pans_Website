/**
 * =============================================================================
 * MISTRAL PANS - Client Supabase
 * =============================================================================
 * 
 * Remplace le système localStorage par Supabase
 * 
 * Installation:
 * 1. Ajouter dans le <head> de tes pages HTML:
 *    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *    <script src="js/supabase-client.js"></script>
 * 
 * 2. Remplacer les appels à MistralGestion par MistralDB
 * 
 * =============================================================================
 */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION SUPABASE
  // ============================================================================
  
  const SUPABASE_URL = 'https://qnkyzhccudtaduqduoxn.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFua3l6aGNjdWR0YWR1cWR1b3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4OTg4NjAsImV4cCI6MjA4NTQ3NDg2MH0.c4tH7OMAeDf8FmeezZPJUhF_-8jBOUru2gRBrGi5Gds';
  
  // Initialiser le client Supabase
  let supabase = null;
  
  function initSupabase() {
    if (!window.supabase) {
      console.error('❌ Supabase JS non chargé. Ajoute le script dans ton HTML.');
      return null;
    }
    
    if (!supabase) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase client initialisé');
    }
    
    return supabase;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================
  
  /**
   * Gère les erreurs Supabase de manière uniforme
   */
  function handleError(error, operation) {
    console.error(`❌ Erreur ${operation}:`, error);
    
    // Notification utilisateur si Toast existe
    if (window.Toast) {
      Toast.error(`Erreur: ${error.message || operation}`);
    }
    
    return null;
  }

  /**
   * Formate une date pour affichage
   */
  function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR');
  }

  /**
   * Formate un prix
   */
  function formatPrice(price) {
    if (price === null || price === undefined) return '0 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(price);
  }

  // ============================================================================
  // AUTHENTIFICATION
  // ============================================================================
  
  const Auth = {
    /**
     * Connexion avec email/mot de passe
     */
    async login(email, password) {
      const client = initSupabase();
      if (!client) return null;
      
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        return handleError(error, 'connexion');
      }
      
      console.log('✅ Connecté:', data.user.email);
      return data.user;
    },
    
    /**
     * Déconnexion
     */
    async logout() {
      const client = initSupabase();
      if (!client) return;
      
      const { error } = await client.auth.signOut();
      
      if (error) {
        return handleError(error, 'déconnexion');
      }
      
      console.log('✅ Déconnecté');
      
      // Aussi supprimer l'ancienne session localStorage si elle existe
      localStorage.removeItem('mistral_admin_session');
      
      return true;
    },
    
    /**
     * Vérifie si l'utilisateur est connecté
     */
    async isLoggedIn() {
      const client = initSupabase();
      if (!client) return false;
      
      const { data: { session } } = await client.auth.getSession();
      return !!session;
    },
    
    /**
     * Récupère l'utilisateur courant
     */
    async getUser() {
      const client = initSupabase();
      if (!client) return null;
      
      const { data: { user } } = await client.auth.getUser();
      return user;
    },
    
    /**
     * Écoute les changements d'authentification
     */
    onAuthStateChange(callback) {
      const client = initSupabase();
      if (!client) return;
      
      client.auth.onAuthStateChange((event, session) => {
        callback(event, session);
      });
    }
  };

  // ============================================================================
  // CRUD GÉNÉRIQUE
  // ============================================================================
  
  /**
   * Crée un module CRUD pour une table
   */
  function createCRUD(tableName) {
    return {
      /**
       * Liste tous les enregistrements
       */
      async list(options = {}) {
        const client = initSupabase();
        if (!client) return [];
        
        let query = client.from(tableName).select('*');
        
        // Filtres
        if (options.filter) {
          Object.entries(options.filter).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        
        // Tri
        if (options.orderBy) {
          query = query.order(options.orderBy, { 
            ascending: options.ascending ?? false 
          });
        } else {
          query = query.order('created_at', { ascending: false });
        }
        
        // Limite
        if (options.limit) {
          query = query.limit(options.limit);
        }
        
        const { data, error } = await query;
        
        if (error) {
          return handleError(error, `list ${tableName}`) || [];
        }
        
        return data || [];
      },
      
      /**
       * Récupère un enregistrement par ID
       */
      async get(id) {
        const client = initSupabase();
        if (!client) return null;
        
        const { data, error } = await client
          .from(tableName)
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          return handleError(error, `get ${tableName}`);
        }
        
        return data;
      },
      
      /**
       * Crée un nouvel enregistrement
       */
      async create(item) {
        const client = initSupabase();
        if (!client) return null;
        
        // Nettoyer l'objet (supprimer id si vide)
        const cleanItem = { ...item };
        if (!cleanItem.id) delete cleanItem.id;
        
        const { data, error } = await client
          .from(tableName)
          .insert(cleanItem)
          .select()
          .single();
        
        if (error) {
          return handleError(error, `create ${tableName}`);
        }
        
        console.log(`✅ ${tableName} créé:`, data.id);
        return data;
      },
      
      /**
       * Met à jour un enregistrement
       */
      async update(id, updates) {
        const client = initSupabase();
        if (!client) return null;
        
        const { data, error } = await client
          .from(tableName)
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (error) {
          return handleError(error, `update ${tableName}`);
        }
        
        console.log(`✅ ${tableName} mis à jour:`, id);
        return data;
      },
      
      /**
       * Supprime un enregistrement
       */
      async delete(id) {
        const client = initSupabase();
        if (!client) return false;
        
        const { error } = await client
          .from(tableName)
          .delete()
          .eq('id', id);
        
        if (error) {
          return handleError(error, `delete ${tableName}`) || false;
        }
        
        console.log(`✅ ${tableName} supprimé:`, id);
        return true;
      },
      
      /**
       * Recherche par texte
       */
      async search(query, fields = ['nom']) {
        const client = initSupabase();
        if (!client) return [];
        
        // Construire la requête OR pour chercher dans plusieurs champs
        const orConditions = fields
          .map(field => `${field}.ilike.%${query}%`)
          .join(',');
        
        const { data, error } = await client
          .from(tableName)
          .select('*')
          .or(orConditions);
        
        if (error) {
          return handleError(error, `search ${tableName}`) || [];
        }
        
        return data || [];
      },
      
      /**
       * Compte les enregistrements
       */
      async count(filter = {}) {
        const client = initSupabase();
        if (!client) return 0;
        
        let query = client
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        Object.entries(filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
        
        const { count, error } = await query;
        
        if (error) {
          return handleError(error, `count ${tableName}`) || 0;
        }
        
        return count || 0;
      }
    };
  }

  // ============================================================================
  // MODULES MÉTIER
  // ============================================================================
  
  const Clients = {
    ...createCRUD('clients'),
    
    /**
     * Recherche un client par nom ou email
     */
    async search(query) {
      return createCRUD('clients').search(query, ['nom', 'prenom', 'email']);
    },
    
    /**
     * Récupère les clients avec leurs stats
     */
    async listWithStats() {
      const clients = await this.list();
      
      // Pour chaque client, compter ses locations et factures
      // (optimisation: faire ça côté serveur avec une view)
      return clients;
    }
  };

  const Instruments = {
    ...createCRUD('instruments'),
    
    /**
     * Liste les instruments disponibles pour location
     */
    async listDisponibles() {
      return this.list({ filter: { statut: 'disponible' } });
    },
    
    /**
     * Liste les instruments en ligne (boutique)
     */
    async listEnLigne() {
      return this.list({ filter: { statut: 'en_ligne' } });
    },
    
    /**
     * Change le statut d'un instrument
     */
    async setStatut(id, statut) {
      return this.update(id, { statut });
    }
  };

  const Locations = {
    ...createCRUD('locations'),
    
    /**
     * Liste les locations en cours
     */
    async listEnCours() {
      return this.list({ filter: { statut: 'en_cours' } });
    },
    
    /**
     * Démarre une nouvelle location
     */
    async demarrer(data) {
      const location = await this.create({
        ...data,
        statut: 'en_cours',
        caution_statut: 'en_attente'
      });
      
      // Mettre l'instrument en location
      if (location && data.instrument_id) {
        await Instruments.setStatut(data.instrument_id, 'en_location');
      }
      
      return location;
    },
    
    /**
     * Termine une location
     */
    async terminer(id) {
      const location = await this.get(id);
      if (!location) return null;
      
      // Mettre à jour la location
      const updated = await this.update(id, {
        statut: 'terminee',
        date_fin_effective: new Date().toISOString().split('T')[0],
        caution_statut: 'restituee'
      });
      
      // Remettre l'instrument en disponible
      if (location.instrument_id) {
        await Instruments.setStatut(location.instrument_id, 'disponible');
      }
      
      return updated;
    }
  };

  const Commandes = {
    ...createCRUD('commandes'),
    
    /**
     * Calcule le solde restant d'une commande
     */
    async getSoldeRestant(id) {
      const commande = await this.get(id);
      if (!commande) return 0;
      
      return (commande.montant_total || 0) - (commande.montant_acomptes || 0);
    },
    
    /**
     * Ajoute un acompte à une commande
     */
    async ajouterAcompte(id, montant) {
      const commande = await this.get(id);
      if (!commande) return null;
      
      const nouveauMontant = (commande.montant_acomptes || 0) + montant;
      
      return this.update(id, {
        montant_acomptes: nouveauMontant
      });
    }
  };

  const Factures = {
    ...createCRUD('factures'),
    
    /**
     * Crée une facture avec calcul automatique des totaux
     */
    async create(data) {
      const lignes = data.lignes || [];
      
      // Calculer les totaux
      const montant_ht = lignes.reduce((sum, l) => {
        return sum + (l.quantite || 1) * (parseFloat(l.prix_unitaire) || 0);
      }, 0);
      
      const acomptes_deduits = parseFloat(data.acomptes_deduits) || 0;
      const montant_ttc = montant_ht - acomptes_deduits;
      
      // Préparer les lignes avec totaux
      const lignesAvecTotaux = lignes.map(l => ({
        description: l.description || '',
        quantite: l.quantite || 1,
        prix_unitaire: parseFloat(l.prix_unitaire) || 0,
        total: (l.quantite || 1) * (parseFloat(l.prix_unitaire) || 0)
      }));
      
      return createCRUD('factures').create({
        ...data,
        lignes: lignesAvecTotaux,
        montant_ht,
        montant_ttc,
        acomptes_deduits
      });
    },
    
    /**
     * Marque une facture comme payée
     */
    async marquerPayee(id, mode_paiement = null) {
      return this.update(id, {
        statut_paiement: 'paye',
        date_paiement: new Date().toISOString().split('T')[0],
        mode_paiement
      });
    }
  };

  const Professeurs = {
    ...createCRUD('professeurs'),
    
    /**
     * Liste les professeurs actifs (pour le site public)
     */
    async listActifs() {
      return this.list({ filter: { statut: 'active' } });
    },
    
    /**
     * Liste les demandes en attente
     */
    async listPending() {
      return this.list({ filter: { statut: 'pending' } });
    },
    
    /**
     * Approuve une demande de professeur
     */
    async approuver(id) {
      return this.update(id, {
        statut: 'active',
        approved_at: new Date().toISOString()
      });
    },
    
    /**
     * Rejette une demande
     */
    async rejeter(id) {
      return this.delete(id);
    },
    
    /**
     * Soumet une nouvelle demande (depuis le formulaire public)
     */
    async soumettreDemande(data) {
      return this.create({
        ...data,
        statut: 'pending',
        submitted_at: new Date().toISOString()
      });
    }
  };

  const Galerie = {
    ...createCRUD('galerie'),
    
    /**
     * Liste les médias triés par ordre
     */
    async listOrdered() {
      return this.list({ orderBy: 'ordre', ascending: true });
    },
    
    /**
     * Réordonne les médias
     */
    async reorder(orderedIds) {
      const client = initSupabase();
      if (!client) return false;
      
      // Mettre à jour l'ordre de chaque média
      for (let i = 0; i < orderedIds.length; i++) {
        await this.update(orderedIds[i], { ordre: i });
      }
      
      return true;
    }
  };

  const Articles = {
    ...createCRUD('articles'),
    
    /**
     * Liste les articles publiés
     */
    async listPublished() {
      return this.list({ 
        filter: { status: 'published' },
        orderBy: 'published_at'
      });
    },
    
    /**
     * Récupère un article par son slug
     */
    async getBySlug(slug) {
      const client = initSupabase();
      if (!client) return null;
      
      const { data, error } = await client
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .single();
      
      if (error) {
        return handleError(error, 'get article by slug');
      }
      
      return data;
    },
    
    /**
     * Publie un article
     */
    async publier(id) {
      return this.update(id, {
        status: 'published',
        published_at: new Date().toISOString()
      });
    },
    
    /**
     * Dépublie un article
     */
    async depublier(id) {
      return this.update(id, {
        status: 'draft',
        published_at: null
      });
    }
  };

  const Accessoires = {
    ...createCRUD('accessoires'),
    
    /**
     * Liste les accessoires en ligne
     */
    async listEnLigne() {
      return this.list({ filter: { statut: 'en_ligne' } });
    }
  };

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const Config = {
    /**
     * Récupère toute la configuration
     */
    async getAll() {
      const client = initSupabase();
      if (!client) return {};
      
      const { data, error } = await client
        .from('configuration')
        .select('*');
      
      if (error) {
        return handleError(error, 'get config') || {};
      }
      
      // Transformer en objet clé-valeur
      const config = {};
      (data || []).forEach(row => {
        config[row.key] = row.value;
      });
      
      // Fusionner entreprise et defaults
      return {
        ...(config.entreprise || {}),
        ...(config.defaults || {})
      };
    },
    
    /**
     * Met à jour une valeur de configuration
     */
    async set(key, value) {
      const client = initSupabase();
      if (!client) return false;
      
      const { error } = await client
        .from('configuration')
        .upsert({ key, value, updated_at: new Date().toISOString() });
      
      if (error) {
        return handleError(error, 'set config') || false;
      }
      
      return true;
    }
  };

  // ============================================================================
  // STATISTIQUES
  // ============================================================================
  
  const Stats = {
    /**
     * Récupère les statistiques du dashboard
     */
    async getDashboard() {
      const [
        clientsCount,
        instrumentsCount,
        locationsEnCours,
        facturesImpayees
      ] = await Promise.all([
        Clients.count(),
        Instruments.count(),
        Locations.count({ statut: 'en_cours' }),
        Factures.count({ statut_paiement: 'en_attente' })
      ]);
      
      return {
        clients: clientsCount,
        instruments: instrumentsCount,
        locationsEnCours,
        facturesImpayees
      };
    }
  };

  // ============================================================================
  // EXPORT
  // ============================================================================
  
  window.MistralDB = {
    // Client Supabase direct (pour cas avancés)
    getClient: initSupabase,
    
    // Authentification
    Auth,
    
    // Modules métier
    Clients,
    Instruments,
    Locations,
    Commandes,
    Factures,
    Professeurs,
    Galerie,
    Articles,
    Accessoires,
    
    // Configuration
    Config,
    getConfig: Config.getAll,
    
    // Statistiques
    Stats,
    
    // Utilitaires
    utils: {
      formatDate,
      formatPrice
    }
  };

  // Alias pour compatibilité avec l'ancien code
  window.MistralGestion = window.MistralDB;

  console.log('✅ MistralDB (Supabase) chargé');

})(window);
