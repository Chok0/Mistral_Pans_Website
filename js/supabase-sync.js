/**
 * =============================================================================
 * MISTRAL PANS - Module de Synchronisation localStorage ↔ Supabase
 * =============================================================================
 * 
 * Ce module synchronise automatiquement les données entre localStorage et Supabase.
 * 
 * Approche "offline-first":
 * - Les opérations CRUD restent sur localStorage (rapide, réactif)
 * - Les changements sont synchronisés vers Supabase en arrière-plan
 * - Au chargement, on récupère les dernières données de Supabase
 * 
 * Installation:
 * 1. Ajouter ce script APRÈS supabase-client.js et APRÈS gestion.js
 * 2. C'est tout ! La sync est automatique.
 * 
 * =============================================================================
 */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const SYNC_CONFIG = {
    // Intervalle de sync auto (en ms) - 0 = désactivé
    autoSyncInterval: 30000, // 30 secondes
    
    // Tables à synchroniser
    tables: [
      { local: 'mistral_gestion_clients', remote: 'clients', idField: 'id' },
      { local: 'mistral_gestion_instruments', remote: 'instruments', idField: 'id' },
      { local: 'mistral_gestion_locations', remote: 'locations', idField: 'id' },
      { local: 'mistral_gestion_commandes', remote: 'commandes', idField: 'id' },
      { local: 'mistral_gestion_factures', remote: 'factures', idField: 'id' },
      { local: 'mistral_teachers', remote: 'professeurs', idField: 'id' },
      { local: 'mistral_gallery', remote: 'galerie', idField: 'id' },
      { local: 'mistral_blog_articles', remote: 'articles', idField: 'id' }
    ],
    
    // Clé pour stocker l'état de sync
    syncStateKey: 'mistral_sync_state'
  };

  // État de la synchronisation
  let syncState = {
    lastSync: null,
    pendingChanges: [],
    isSyncing: false
  };

  // ============================================================================
  // HELPERS
  // ============================================================================
  
  function log(message, type = 'info') {
    const prefix = {
      'info': '🔄',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️'
    }[type] || '🔄';
    
    console.log(`[Sync] ${prefix} ${message}`);
  }

  function getLocalData(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function setLocalData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadSyncState() {
    try {
      const stored = localStorage.getItem(SYNC_CONFIG.syncStateKey);
      if (stored) {
        syncState = { ...syncState, ...JSON.parse(stored) };
      }
    } catch (e) {
      // Ignorer
    }
  }

  function saveSyncState() {
    try {
      localStorage.setItem(SYNC_CONFIG.syncStateKey, JSON.stringify({
        lastSync: syncState.lastSync,
        pendingChanges: syncState.pendingChanges
      }));
    } catch (e) {
      // Ignorer
    }
  }

  // ============================================================================
  // TRANSFORMATION DES DONNÉES
  // ============================================================================
  
  /**
   * Transforme les données locales vers le format Supabase
   */
  function transformToSupabase(tableName, item) {
    // Copie de l'objet
    const transformed = { ...item };
    
    // Supprimer les champs qui ne sont pas dans Supabase
    delete transformed.createdAt;
    delete transformed.updatedAt;
    
    // Renommer les champs si nécessaire selon la table
    switch (tableName) {
      case 'clients':
        // Champs déjà compatibles
        break;
        
      case 'instruments':
        if (transformed.notes && !transformed.nombre_notes) {
          transformed.nombre_notes = parseInt(transformed.notes) || 9;
        }
        break;
        
      case 'professeurs':
        if (transformed.name && !transformed.nom) {
          transformed.nom = transformed.name;
        }
        if (transformed.courseTypes) {
          transformed.course_types = transformed.courseTypes;
          delete transformed.courseTypes;
        }
        if (transformed.courseFormats) {
          transformed.course_formats = transformed.courseFormats;
          delete transformed.courseFormats;
        }
        if (transformed.instrumentAvailable !== undefined) {
          transformed.instrument_available = transformed.instrumentAvailable;
          delete transformed.instrumentAvailable;
        }
        if (transformed.photo) {
          transformed.photo_url = transformed.photo;
          delete transformed.photo;
        }
        break;
        
      case 'articles':
        if (transformed.coverImage) {
          transformed.cover_image = transformed.coverImage;
          delete transformed.coverImage;
        }
        if (transformed.publishedAt) {
          transformed.published_at = transformed.publishedAt;
          delete transformed.publishedAt;
        }
        if (transformed.seo) {
          transformed.meta_title = transformed.seo.metaTitle;
          transformed.meta_description = transformed.seo.metaDescription;
          delete transformed.seo;
        }
        break;
    }
    
    // Ajouter les timestamps
    if (!transformed.created_at) {
      transformed.created_at = new Date().toISOString();
    }
    transformed.updated_at = new Date().toISOString();
    
    return transformed;
  }

  /**
   * Transforme les données Supabase vers le format local
   */
  function transformFromSupabase(tableName, item) {
    const transformed = { ...item };
    
    // Convertir les timestamps
    if (transformed.created_at) {
      transformed.createdAt = transformed.created_at;
    }
    if (transformed.updated_at) {
      transformed.updatedAt = transformed.updated_at;
    }
    
    // Transformations spécifiques par table
    switch (tableName) {
      case 'professeurs':
        if (transformed.nom && !transformed.name) {
          transformed.name = transformed.nom;
        }
        if (transformed.course_types) {
          transformed.courseTypes = transformed.course_types;
        }
        if (transformed.course_formats) {
          transformed.courseFormats = transformed.course_formats;
        }
        if (transformed.instrument_available !== undefined) {
          transformed.instrumentAvailable = transformed.instrument_available;
        }
        if (transformed.photo_url) {
          transformed.photo = transformed.photo_url;
        }
        break;
        
      case 'articles':
        if (transformed.cover_image) {
          transformed.coverImage = transformed.cover_image;
        }
        if (transformed.published_at) {
          transformed.publishedAt = transformed.published_at;
        }
        break;
    }
    
    return transformed;
  }

  // ============================================================================
  // SYNCHRONISATION
  // ============================================================================
  
  /**
   * Récupère les données de Supabase et met à jour localStorage
   */
  async function pullFromSupabase(tableConfig) {
    if (!window.MistralDB) {
      log('MistralDB non disponible', 'warning');
      return false;
    }
    
    const client = window.MistralDB.getClient();
    if (!client) return false;
    
    try {
      const { data, error } = await client
        .from(tableConfig.remote)
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) {
        log(`Erreur pull ${tableConfig.remote}: ${error.message}`, 'error');
        return false;
      }
      
      if (data && data.length > 0) {
        // Transformer les données
        const localData = data.map(item => transformFromSupabase(tableConfig.remote, item));
        
        // Fusionner avec les données locales (garder les plus récentes)
        const existingData = getLocalData(tableConfig.local);
        const mergedData = mergeData(existingData, localData, tableConfig.idField);
        
        setLocalData(tableConfig.local, mergedData);
        log(`Pull ${tableConfig.remote}: ${data.length} enregistrements`, 'success');
      }
      
      return true;
    } catch (e) {
      log(`Exception pull ${tableConfig.remote}: ${e.message}`, 'error');
      return false;
    }
  }

  /**
   * Envoie les données locales vers Supabase
   */
  async function pushToSupabase(tableConfig) {
    if (!window.MistralDB) {
      log('MistralDB non disponible', 'warning');
      return false;
    }
    
    const client = window.MistralDB.getClient();
    if (!client) return false;
    
    const localData = getLocalData(tableConfig.local);
    if (!localData || localData.length === 0) {
      return true; // Rien à synchroniser
    }
    
    try {
      for (const item of localData) {
        const transformed = transformToSupabase(tableConfig.remote, item);
        
        // Upsert (insert ou update)
        const { error } = await client
          .from(tableConfig.remote)
          .upsert(transformed, { onConflict: tableConfig.idField });
        
        if (error) {
          log(`Erreur push ${tableConfig.remote} (${item.id}): ${error.message}`, 'error');
        }
      }
      
      log(`Push ${tableConfig.remote}: ${localData.length} enregistrements`, 'success');
      return true;
    } catch (e) {
      log(`Exception push ${tableConfig.remote}: ${e.message}`, 'error');
      return false;
    }
  }

  /**
   * Fusionne deux tableaux de données en gardant les plus récents
   */
  function mergeData(localData, remoteData, idField) {
    const merged = new Map();
    
    // Ajouter les données locales
    localData.forEach(item => {
      if (item[idField]) {
        merged.set(item[idField], item);
      }
    });
    
    // Fusionner avec les données distantes (priorité à la plus récente)
    remoteData.forEach(item => {
      if (!item[idField]) return;
      
      const existing = merged.get(item[idField]);
      if (!existing) {
        merged.set(item[idField], item);
      } else {
        // Comparer les dates de mise à jour
        const localDate = new Date(existing.updated_at || existing.updatedAt || 0);
        const remoteDate = new Date(item.updated_at || item.updatedAt || 0);
        
        if (remoteDate > localDate) {
          merged.set(item[idField], item);
        }
      }
    });
    
    return Array.from(merged.values());
  }

  /**
   * Synchronisation complète (pull puis push)
   */
  async function fullSync() {
    if (syncState.isSyncing) {
      log('Sync déjà en cours...', 'warning');
      return;
    }
    
    syncState.isSyncing = true;
    log('Début synchronisation complète...');
    
    try {
      // D'abord récupérer les données distantes
      for (const tableConfig of SYNC_CONFIG.tables) {
        await pullFromSupabase(tableConfig);
      }
      
      // Puis envoyer les données locales
      for (const tableConfig of SYNC_CONFIG.tables) {
        await pushToSupabase(tableConfig);
      }
      
      syncState.lastSync = new Date().toISOString();
      saveSyncState();
      
      log('Synchronisation terminée', 'success');
      
      // Dispatch un événement pour que l'UI se rafraîchisse
      window.dispatchEvent(new CustomEvent('mistral-sync-complete'));
      
    } catch (e) {
      log(`Erreur sync: ${e.message}`, 'error');
    } finally {
      syncState.isSyncing = false;
    }
  }

  /**
   * Synchronise uniquement depuis Supabase (pull)
   */
  async function pullAll() {
    log('Pull depuis Supabase...');
    
    for (const tableConfig of SYNC_CONFIG.tables) {
      await pullFromSupabase(tableConfig);
    }
    
    syncState.lastSync = new Date().toISOString();
    saveSyncState();
    
    log('Pull terminé', 'success');
    window.dispatchEvent(new CustomEvent('mistral-sync-complete'));
  }

  /**
   * Synchronise uniquement vers Supabase (push)
   */
  async function pushAll() {
    log('Push vers Supabase...');
    
    for (const tableConfig of SYNC_CONFIG.tables) {
      await pushToSupabase(tableConfig);
    }
    
    log('Push terminé', 'success');
  }

  // ============================================================================
  // INTERCEPTION DES MODIFICATIONS localStorage
  // ============================================================================
  
  /**
   * Intercepte les modifications localStorage pour déclencher une sync
   */
  function setupStorageListener() {
    // Écouter les changements localStorage (depuis d'autres onglets)
    window.addEventListener('storage', (e) => {
      const isTrackedKey = SYNC_CONFIG.tables.some(t => t.local === e.key);
      if (isTrackedKey) {
        log(`Changement détecté: ${e.key}`);
        // Déclencher un push après un délai (debounce)
        debouncedPush();
      }
    });
    
    // Intercepter les appels directs à setItem
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      originalSetItem(key, value);
      
      const isTrackedKey = SYNC_CONFIG.tables.some(t => t.local === key);
      if (isTrackedKey) {
        log(`Modification locale: ${key}`);
        debouncedPush();
      }
    };
  }

  // Debounce pour le push
  let pushTimeout = null;
  function debouncedPush() {
    if (pushTimeout) {
      clearTimeout(pushTimeout);
    }
    pushTimeout = setTimeout(() => {
      pushAll();
    }, 2000); // Attendre 2 secondes d'inactivité
  }

  // ============================================================================
  // SYNCHRONISATION AUTOMATIQUE
  // ============================================================================
  
  let autoSyncIntervalId = null;
  
  function startAutoSync() {
    if (SYNC_CONFIG.autoSyncInterval > 0 && !autoSyncIntervalId) {
      autoSyncIntervalId = setInterval(() => {
        fullSync();
      }, SYNC_CONFIG.autoSyncInterval);
      
      log(`Auto-sync activé (${SYNC_CONFIG.autoSyncInterval / 1000}s)`);
    }
  }

  function stopAutoSync() {
    if (autoSyncIntervalId) {
      clearInterval(autoSyncIntervalId);
      autoSyncIntervalId = null;
      log('Auto-sync désactivé');
    }
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================
  
  async function init() {
    log('Initialisation du module de synchronisation...');
    
    // Charger l'état de sync
    loadSyncState();
    
    // Setup des listeners
    setupStorageListener();
    
    // Sync initiale (récupérer les données de Supabase)
    await pullAll();
    
    // Démarrer l'auto-sync
    startAutoSync();
    
    log('Module de synchronisation prêt', 'success');
  }

  // Démarrer quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Attendre un peu que les autres scripts soient chargés
    setTimeout(init, 500);
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================
  
  window.MistralSync = {
    // Sync manuelle
    fullSync,
    pullAll,
    pushAll,
    
    // Auto-sync
    startAutoSync,
    stopAutoSync,
    
    // État
    getState: () => ({ ...syncState }),
    getLastSync: () => syncState.lastSync,
    isSyncing: () => syncState.isSyncing,
    
    // Config
    setAutoSyncInterval: (ms) => {
      SYNC_CONFIG.autoSyncInterval = ms;
      stopAutoSync();
      if (ms > 0) startAutoSync();
    }
  };

  console.log('✅ MistralSync chargé');

})(window);
