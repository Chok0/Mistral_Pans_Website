/**
 * =============================================================================
 * MISTRAL PANS - Module de Donnees In-Memory + Supabase
 * =============================================================================
 *
 * Ce module remplace l'ancien systeme de synchronisation localStorage <-> Supabase.
 *
 * Nouvelle approche "Supabase-first":
 * - Les donnees sont stockees en memoire (Map), PAS dans localStorage
 * - Au chargement, on recupere les donnees depuis Supabase
 * - Les ecritures vont directement vers Supabase + memoire
 * - localStorage est reserve aux preferences utilisateur (consent, stats)
 *
 * API:
 * - MistralSync.getData(key)       -> Array depuis la memoire
 * - MistralSync.setData(key, data) -> Ecrit en memoire + Supabase
 * - MistralSync.hasKey(key)        -> Verifie si la cle est geree
 * - MistralSync.onReady(callback)  -> Appele quand les donnees sont chargees
 *
 * =============================================================================
 */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const SYNC_CONFIG = {
    // Mapping cle locale -> table Supabase
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

    // Tables necessaires par page publique
    publicPageTables: {
      'boutique':  ['instruments'],
      'apprendre': ['professeurs'],
      'galerie':   ['galerie'],
      'blog':      ['articles'],
      'article':   ['articles'],
      'location':  ['instruments'],
      'index':     ['instruments']
    }
  };

  // ============================================================================
  // IN-MEMORY STORE
  // ============================================================================

  // Stockage en memoire (remplace localStorage pour les donnees synchronisees)
  const dataStore = new Map();

  // Etat
  let isReady = false;
  let isSyncing = false;
  let lastSync = null;
  let isAdminPage = false;
  const readyCallbacks = [];

  // Initialiser le store vide pour chaque cle
  SYNC_CONFIG.tables.forEach(t => {
    dataStore.set(t.local, []);
  });

  // Set de cles gerees pour lookup rapide
  const managedKeys = new Set(SYNC_CONFIG.tables.map(t => t.local));

  // ============================================================================
  // HELPERS
  // ============================================================================

  function log(message, type = 'info') {
    const prefix = {
      'info': '[Sync]',
      'success': '[Sync]',
      'error': '[Sync ERR]',
      'warning': '[Sync WARN]'
    }[type] || '[Sync]';

    if (type === 'error') {
      console.error(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  function detectPageType() {
    const path = window.location.pathname.toLowerCase();
    isAdminPage = path.includes('admin');
    return isAdminPage;
  }

  function getTablesForCurrentPage() {
    if (isAdminPage) {
      return SYNC_CONFIG.tables;
    }

    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1).replace('.html', '') || 'index';
    const relevantRemoteTables = SYNC_CONFIG.publicPageTables[filename];

    if (!relevantRemoteTables) {
      return [];
    }

    return SYNC_CONFIG.tables.filter(t => relevantRemoteTables.includes(t.remote));
  }

  function getTableConfig(localKey) {
    return SYNC_CONFIG.tables.find(t => t.local === localKey) || null;
  }

  // ============================================================================
  // TRANSFORMATION DES DONNEES
  // ============================================================================

  /**
   * Transforme les donnees Supabase vers le format local
   */
  function transformFromSupabase(tableName, item) {
    const transformed = { ...item };

    if (transformed.created_at) {
      transformed.createdAt = transformed.created_at;
    }
    if (transformed.updated_at) {
      transformed.updatedAt = transformed.updated_at;
    }

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

  /**
   * Transforme les donnees locales vers le format Supabase
   */
  function transformToSupabase(tableName, item) {
    const transformed = { ...item };

    delete transformed.createdAt;
    delete transformed.updatedAt;

    switch (tableName) {
      case 'clients':
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

    if (!transformed.created_at) {
      transformed.created_at = new Date().toISOString();
    }
    transformed.updated_at = new Date().toISOString();

    return transformed;
  }

  // ============================================================================
  // DATA ACCESS (API PUBLIQUE)
  // ============================================================================

  /**
   * Recupere les donnees depuis le store en memoire
   * @param {string} key - Cle locale (ex: 'mistral_gestion_instruments')
   * @returns {Array} Donnees ou tableau vide
   */
  function getData(key) {
    if (!managedKeys.has(key)) {
      log(`Cle non geree: ${key}`, 'warning');
      return [];
    }
    return dataStore.get(key) || [];
  }

  /**
   * Ecrit les donnees en memoire et les synchronise vers Supabase
   * @param {string} key - Cle locale
   * @param {Array} data - Donnees a sauvegarder
   * @returns {boolean} Succes
   */
  function setData(key, data) {
    if (!managedKeys.has(key)) {
      log(`Cle non geree: ${key}`, 'warning');
      return false;
    }

    // Mettre a jour le store en memoire
    dataStore.set(key, data);

    // Pousser vers Supabase en arriere-plan (sans bloquer)
    const tableConfig = getTableConfig(key);
    if (tableConfig) {
      pushTableToSupabase(tableConfig, data).catch(err => {
        log(`Erreur push ${tableConfig.remote}: ${err.message}`, 'error');
      });
    }

    // Dispatcher un evenement pour que l'UI se rafraichisse
    window.dispatchEvent(new CustomEvent('mistral-data-change', {
      detail: { key, data }
    }));

    return true;
  }

  /**
   * Verifie si une cle est geree par ce module
   */
  function hasKey(key) {
    return managedKeys.has(key);
  }

  // ============================================================================
  // SUPABASE OPERATIONS
  // ============================================================================

  /**
   * Recupere les donnees d'une table depuis Supabase
   */
  async function fetchTable(tableConfig) {
    if (!window.MistralDB) return false;

    const client = window.MistralDB.getClient();
    if (!client) return false;

    try {
      const { data, error } = await client
        .from(tableConfig.remote)
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        log(`Erreur fetch ${tableConfig.remote}: ${error.message}`, 'error');
        return false;
      }

      if (data) {
        const localData = data.map(item => transformFromSupabase(tableConfig.remote, item));
        dataStore.set(tableConfig.local, localData);
        log(`Fetch ${tableConfig.remote}: ${data.length} enregistrements`, 'success');
      } else {
        dataStore.set(tableConfig.local, []);
      }

      return true;
    } catch (e) {
      log(`Exception fetch ${tableConfig.remote}: ${e.message}`, 'error');
      return false;
    }
  }

  /**
   * Pousse un tableau complet vers Supabase (upsert)
   */
  async function pushTableToSupabase(tableConfig, data) {
    if (!window.MistralDB) return false;

    const client = window.MistralDB.getClient();
    if (!client) return false;

    try {
      for (const item of data) {
        if (!item.id) continue;

        const transformed = transformToSupabase(tableConfig.remote, item);

        const { error } = await client
          .from(tableConfig.remote)
          .upsert(transformed, { onConflict: tableConfig.idField });

        if (error) {
          log(`Erreur push ${tableConfig.remote} (${item.id}): ${error.message}`, 'error');
        }
      }

      return true;
    } catch (e) {
      log(`Exception push ${tableConfig.remote}: ${e.message}`, 'error');
      return false;
    }
  }

  /**
   * Supprime un enregistrement dans Supabase
   */
  async function deleteFromSupabase(localKey, id) {
    if (!window.MistralDB) return false;

    const tableConfig = getTableConfig(localKey);
    if (!tableConfig) return false;

    const client = window.MistralDB.getClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from(tableConfig.remote)
        .delete()
        .eq(tableConfig.idField, id);

      if (error) {
        log(`Erreur delete ${tableConfig.remote} (${id}): ${error.message}`, 'error');
        return false;
      }

      return true;
    } catch (e) {
      log(`Exception delete ${tableConfig.remote}: ${e.message}`, 'error');
      return false;
    }
  }

  // ============================================================================
  // REFRESH / SYNC
  // ============================================================================

  /**
   * Rafraichit les donnees depuis Supabase
   */
  async function refresh(tables) {
    if (isSyncing) {
      log('Sync deja en cours...', 'warning');
      return;
    }

    isSyncing = true;
    const targetTables = tables || getTablesForCurrentPage();

    if (targetTables.length === 0) {
      log('Aucune table a synchroniser pour cette page');
      isSyncing = false;
      return;
    }

    log(`Fetch depuis Supabase (${targetTables.map(t => t.remote).join(', ')})...`);

    for (const tableConfig of targetTables) {
      await fetchTable(tableConfig);
    }

    lastSync = new Date().toISOString();
    isSyncing = false;

    log('Fetch termine', 'success');
    window.dispatchEvent(new CustomEvent('mistral-sync-complete'));
  }

  // ============================================================================
  // MIGRATION: NETTOYER localStorage
  // ============================================================================

  /**
   * Supprime les anciennes cles localStorage qui sont maintenant en memoire
   */
  function cleanupLocalStorage() {
    SYNC_CONFIG.tables.forEach(t => {
      try {
        localStorage.removeItem(t.local);
      } catch (e) {
        // Ignorer
      }
    });

    // Nettoyer aussi l'ancien etat de sync
    try {
      localStorage.removeItem('mistral_sync_state');
    } catch (e) {
      // Ignorer
    }

    log('Anciennes cles localStorage nettoyees');
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  async function init() {
    log('Initialisation du module de donnees...');

    detectPageType();

    // Nettoyer les anciennes cles localStorage (migration)
    cleanupLocalStorage();

    // Charger les donnees depuis Supabase
    await refresh();

    // Marquer comme pret
    isReady = true;

    // Appeler les callbacks en attente
    readyCallbacks.forEach(cb => {
      try { cb(); } catch (e) { log(`Erreur callback onReady: ${e.message}`, 'error'); }
    });
    readyCallbacks.length = 0;

    log('Module de donnees pret', 'success');
  }

  // Demarrer quand le DOM est pret
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================

  window.MistralSync = {
    // Acces aux donnees
    getData,
    setData,
    hasKey,

    // Suppression Supabase
    deleteFromSupabase,

    // Rafraichissement
    refresh: () => refresh(),
    refreshAll: () => refresh(SYNC_CONFIG.tables),

    // Etat
    isReady: () => isReady,
    onReady: (callback) => {
      if (isReady) {
        callback();
      } else {
        readyCallbacks.push(callback);
      }
    },
    getLastSync: () => lastSync,
    isSyncing: () => isSyncing,
    isAdmin: () => isAdminPage,

    // Config (pour usage interne par d'autres modules)
    getTableConfig,
    getManagedKeys: () => [...managedKeys]
  };

  console.log('[MistralSync] charge (in-memory mode)');

})(window);
