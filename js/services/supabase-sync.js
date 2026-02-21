/**
 * =============================================================================
 * MISTRAL PANS - Module de Donnees In-Memory + Supabase
 * =============================================================================
 *
 * Ce module remplace l'ancien systeme de synchronisation localStorage <-> Supabase.
 *
 * Approche "Supabase-first" avec cache stale-while-revalidate :
 * - Les donnees sont stockees en memoire (Map) + cache sessionStorage
 * - Au chargement : cache sessionStorage → render immediat → fetch Supabase → MAJ
 * - Les ecritures vont vers Supabase + memoire + cache
 * - sessionStorage se vide a la fermeture de l'onglet (zero souci RGPD)
 * - localStorage est reserve aux preferences utilisateur (consent, stats)
 * - Prefetch en idle : les tables des autres pages publiques sont prefetchees
 *   en arriere-plan pour une navigation instantanee
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
      { local: 'mistral_teachers', remote: 'professeurs', idField: 'id', fetchFilter: { column: 'statut', value: 'active' } },
      { local: 'mistral_pending_teachers', remote: 'professeurs', idField: 'id', fetchFilter: { column: 'statut', value: 'pending' } },
      { local: 'mistral_gallery', remote: 'galerie', idField: 'id' },
      { local: 'mistral_blog_articles', remote: 'articles', idField: 'id' },
      { local: 'mistral_accessoires', remote: 'accessoires', idField: 'id' },
      { local: 'mistral_tailles', remote: 'tailles', idField: 'id' },
      { local: 'mistral_gammes_data', remote: 'gammes', idField: 'id' },
      { local: 'mistral_initiations', remote: 'initiations', idField: 'id' },
      { local: 'mistral_initiations_reservations', remote: 'initiations_reservations', idField: 'id' },
      { local: 'mistral_gestion_config', remote: 'configuration', idField: 'id', isKeyValue: true },
      { local: 'mistral_compta_config', remote: 'configuration', idField: 'id', isKeyValue: true, configNamespace: 'compta' },
      { local: 'mistral_email_automations', remote: 'configuration', idField: 'id', isKeyValue: true, configNamespace: 'email_automations' },
      { local: 'mistral_tarifs_publics', remote: 'configuration', idField: 'id', isKeyValue: true, configNamespace: 'configurateur' },
      { local: 'mistral_location_waitlist', remote: 'configuration', idField: 'id', isKeyValue: true, configNamespace: 'location_waitlist' }
    ],

    // Tables necessaires par page publique
    // Note: une meme table Supabase peut etre mappee a plusieurs cles locales
    // via des filtres differents (ex: professeurs -> teachers + pending_teachers)
    publicPageTables: {
      'boutique':  ['instruments', 'accessoires', 'tailles', 'gammes', 'configuration'],
      'annonce':   ['instruments', 'accessoires', 'tailles'],
      'apprendre': ['professeurs', 'initiations', 'configuration'],
      'galerie':   ['galerie'],
      'blog':      ['articles'],
      'article':   ['articles'],
      'location':  ['instruments', 'configuration', 'configuration:location_waitlist'],
      'commander': ['configuration'],
      'cgv':       ['configuration'],
      'index':     ['instruments', 'configuration']
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
    dataStore.set(t.local, t.isKeyValue ? {} : []);
  });

  // Set de cles gerees pour lookup rapide
  const managedKeys = new Set(SYNC_CONFIG.tables.map(t => t.local));

  // ============================================================================
  // CACHE SESSIONSTORE (stale-while-revalidate)
  // ============================================================================
  //
  // Les donnees publiques sont cachees dans sessionStorage pour permettre
  // un affichage instantane au rechargement de page. Le cache est :
  // - Ecrit apres chaque fetch Supabase reussi
  // - Lu au demarrage pour un render immediat (avant le fetch reseau)
  // - Vide automatiquement a la fermeture de l'onglet (sessionStorage)
  // - Reserve aux donnees publiques (pas de donnees admin/sensibles)

  const CACHE_PREFIX = 'mistral_cache_';

  const CACHEABLE_KEYS = new Set([
    'mistral_gestion_instruments',
    'mistral_accessoires',
    'mistral_tailles',
    'mistral_gammes_data',
    'mistral_tarifs_publics',
    'mistral_location_waitlist',
    'mistral_teachers',
    'mistral_pending_teachers',
    'mistral_gallery',
    'mistral_blog_articles',
    'mistral_initiations'
  ]);

  function writeCache(key, data) {
    if (!CACHEABLE_KEYS.has(key)) return;
    try {
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
    } catch (e) {
      // QuotaExceeded ou sessionStorage indisponible — on ignore silencieusement
    }
  }

  function readCache(key) {
    if (!CACHEABLE_KEYS.has(key)) return null;
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Restaure les donnees depuis le cache sessionStorage vers le dataStore
   * @returns {boolean} true si au moins une table a ete restauree
   */
  function restoreFromCache(targetTables) {
    let restored = false;
    for (const tc of targetTables) {
      const cached = readCache(tc.local);
      if (cached !== null) {
        dataStore.set(tc.local, cached);
        restored = true;
      }
    }
    return restored;
  }

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

    // Extraire les namespaces de configuration explicitement demandes
    // Format: 'configuration:namespace' (ex: 'configuration:location_waitlist')
    const explicitConfigNamespaces = relevantRemoteTables
      .filter(name => name.startsWith('configuration:'))
      .map(name => name.split(':')[1]);

    return SYNC_CONFIG.tables.filter(t => {
      if (!relevantRemoteTables.includes(t.remote)) return false;
      // Pages publiques : charger la config publique (configurateur)
      // + les namespaces explicitement demandes
      if (t.remote === 'configuration') {
        return t.configNamespace === 'configurateur' ||
               explicitConfigNamespaces.includes(t.configNamespace);
      }
      return true;
    });
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
        // statut -> status for local code compatibility
        if (transformed.statut && !transformed.status) {
          transformed.status = transformed.statut;
        }
        if (transformed.submitted_at) {
          transformed.submittedAt = transformed.submitted_at;
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

      case 'accessoires':
        // tailles_compatibles peut etre stocke comme JSON string ou array
        if (typeof transformed.tailles_compatibles === 'string') {
          try { transformed.tailles_compatibles = JSON.parse(transformed.tailles_compatibles); } catch { /* garder la valeur */ }
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
        // Normalize status -> statut for Supabase column
        if (transformed.status && !transformed.statut) {
          transformed.statut = transformed.status;
        }
        delete transformed.status;
        if (transformed.submittedAt) {
          transformed.submitted_at = transformed.submittedAt;
          delete transformed.submittedAt;
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

      case 'accessoires':
        // tailles_compatibles is a jsonb column - Supabase accepts arrays natively
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
   * @returns {Array|Object} Donnees (tableau pour les tables, objet pour les configs)
   */
  function getData(key) {
    if (!managedKeys.has(key)) {
      log(`Cle non geree: ${key}`, 'warning');
      return [];
    }
    const tableConfig = getTableConfig(key);
    const defaultValue = (tableConfig && tableConfig.isKeyValue) ? {} : [];
    return dataStore.get(key) || defaultValue;
  }

  /**
   * Ecrit les donnees en memoire SANS synchroniser vers Supabase
   * Utile pour les suppressions (on ne veut pas UPSERT avant DELETE)
   */
  function setDataLocal(key, data) {
    if (!managedKeys.has(key)) return false;
    dataStore.set(key, data);
    writeCache(key, data);
    window.dispatchEvent(new CustomEvent('mistral-data-change', {
      detail: { key, data }
    }));
    return true;
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

    // Mettre a jour le store en memoire + cache
    dataStore.set(key, data);
    writeCache(key, data);

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
   * Recupere les donnees d'une table depuis Supabase (requete individuelle)
   */
  async function fetchTable(tableConfig) {
    if (!window.MistralDB) return false;

    const client = window.MistralDB.getClient();
    if (!client) return false;

    try {
      // Tables key-value (configuration)
      if (tableConfig.isKeyValue) {
        return await fetchKeyValueTable(tableConfig, client);
      }

      let query = client
        .from(tableConfig.remote)
        .select('*');

      // Appliquer un filtre si defini (ex: statut = 'active' pour professeurs)
      if (tableConfig.fetchFilter) {
        query = query.eq(tableConfig.fetchFilter.column, tableConfig.fetchFilter.value);
      }

      query = query.order('updated_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        log(`Erreur fetch ${tableConfig.remote} (${tableConfig.local}): ${error.message}`, 'error');
        return false;
      }

      if (data) {
        const localData = data.map(item => transformFromSupabase(tableConfig.remote, item));
        dataStore.set(tableConfig.local, localData);
        log(`Fetch ${tableConfig.remote} -> ${tableConfig.local}: ${data.length} enregistrements`, 'success');
      } else {
        dataStore.set(tableConfig.local, []);
      }

      return true;
    } catch (e) {
      log(`Exception fetch ${tableConfig.remote} (${tableConfig.local}): ${e.message}`, 'error');
      return false;
    }
  }

  /**
   * Recupere une configuration key-value depuis la table configuration
   * La table configuration a des colonnes: id, key, value (JSON), namespace
   */
  async function fetchKeyValueTable(tableConfig, client) {
    try {
      const namespace = tableConfig.configNamespace || 'gestion';

      const { data, error } = await client
        .from(tableConfig.remote)
        .select('*')
        .eq('namespace', namespace);

      if (error) {
        log(`Erreur fetch config ${namespace}: ${error.message}`, 'error');
        return false;
      }

      if (data && data.length > 0) {
        // Reconstituer l'objet config depuis les paires key/value
        const configObj = {};
        data.forEach(row => {
          try {
            configObj[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          } catch {
            configObj[row.key] = row.value;
          }
        });
        // Stocker comme objet unique (pas un tableau)
        dataStore.set(tableConfig.local, configObj);
        log(`Fetch config ${namespace}: ${data.length} cles`, 'success');
      } else {
        dataStore.set(tableConfig.local, {});
      }

      return true;
    } catch (e) {
      log(`Exception fetch config ${tableConfig.configNamespace || 'gestion'}: ${e.message}`, 'error');
      return false;
    }
  }

  // ============================================================================
  // BATCHED FETCH (regroupe les requetes vers la meme table Supabase)
  // ============================================================================

  /**
   * Fetch batche pour les tables key-value (configuration)
   * Au lieu de N requetes (1 par namespace), fait 1 requete avec .in()
   * et distribue les resultats cote client.
   *
   * Ex: 5 namespaces (gestion, compta, email_automations, configurateur, location_waitlist)
   *     -> 1 seule requete HTTP au lieu de 5
   */
  async function fetchBatchedKeyValue(configs) {
    if (!window.MistralDB) return false;

    const client = window.MistralDB.getClient();
    if (!client) return false;

    try {
      const namespaces = configs.map(c => c.configNamespace || 'gestion');

      const { data, error } = await client
        .from(configs[0].remote)
        .select('*')
        .in('namespace', namespaces);

      if (error) {
        log(`Erreur fetch batched config (${namespaces.join(',')}): ${error.message}`, 'error');
        return false;
      }

      // Distribuer les resultats par namespace
      for (const config of configs) {
        const ns = config.configNamespace || 'gestion';
        const nsRows = (data || []).filter(row => row.namespace === ns);

        const configObj = {};
        nsRows.forEach(row => {
          try {
            configObj[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          } catch {
            configObj[row.key] = row.value;
          }
        });

        dataStore.set(config.local, configObj);
        log(`Fetch config ${ns}: ${nsRows.length} cles`, 'success');
      }

      return true;
    } catch (e) {
      log(`Exception fetch batched config: ${e.message}`, 'error');
      return false;
    }
  }

  /**
   * Fetch batche pour les tables avec filtres differents (ex: professeurs)
   * Au lieu de N requetes (1 par filtre), fait 1 requete sans filtre
   * et distribue les resultats cote client.
   *
   * Ex: professeurs active + pending -> 1 requete au lieu de 2
   * Note: RLS filtre deja cote serveur pour les pages publiques
   */
  async function fetchBatchedTable(configs) {
    if (!window.MistralDB) return false;

    const client = window.MistralDB.getClient();
    if (!client) return false;

    try {
      const { data, error } = await client
        .from(configs[0].remote)
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        log(`Erreur fetch batched ${configs[0].remote}: ${error.message}`, 'error');
        return false;
      }

      // Distribuer les resultats par filtre
      for (const config of configs) {
        let filtered = data || [];
        if (config.fetchFilter) {
          filtered = filtered.filter(item =>
            item[config.fetchFilter.column] === config.fetchFilter.value
          );
        }

        const localData = filtered.map(item =>
          transformFromSupabase(config.remote, item)
        );
        dataStore.set(config.local, localData);
        log(`Fetch ${config.remote} -> ${config.local}: ${localData.length} enregistrements`, 'success');
      }

      return true;
    } catch (e) {
      log(`Exception fetch batched ${configs[0].remote}: ${e.message}`, 'error');
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

    // Tables key-value (configuration)
    if (tableConfig.isKeyValue) {
      return await pushKeyValueToSupabase(tableConfig, data, client);
    }

    try {
      // data doit etre un tableau pour les tables normales
      if (!Array.isArray(data)) return false;

      const rows = data
        .filter(item => item.id)
        .map(item => transformToSupabase(tableConfig.remote, item));

      if (rows.length === 0) return true;

      const { error } = await client
        .from(tableConfig.remote)
        .upsert(rows, { onConflict: tableConfig.idField });

      if (error) {
        log(`Erreur push ${tableConfig.remote}: ${error.message}`, 'error');
        return false;
      }

      return true;
    } catch (e) {
      log(`Exception push ${tableConfig.remote}: ${e.message}`, 'error');
      return false;
    }
  }

  /**
   * Pousse une configuration key-value vers Supabase
   */
  async function pushKeyValueToSupabase(tableConfig, data, client) {
    try {
      const namespace = tableConfig.configNamespace || 'gestion';

      // data est un objet {key: value, ...}
      if (!data || typeof data !== 'object') return false;

      const now = new Date().toISOString();
      const rows = Object.entries(data).map(([key, value]) => ({
        key,
        value: JSON.stringify(value),
        namespace,
        updated_at: now
      }));

      if (rows.length === 0) return true;

      const { error } = await client
        .from(tableConfig.remote)
        .upsert(rows, { onConflict: 'key,namespace' });

      if (error) {
        log(`Erreur push config ${namespace}: ${error.message}`, 'error');
        return false;
      }

      return true;
    } catch (e) {
      log(`Exception push config ${tableConfig.configNamespace || 'gestion'}: ${e.message}`, 'error');
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
   *
   * Optimisation : regroupe les requetes vers la meme table Supabase.
   * Ex: 5 configs "configuration" (namespace different) -> 1 seule requete .in()
   *     2 configs "professeurs" (filtre different)      -> 1 seule requete
   * Resultat admin : 17 sources chargees en ~12 requetes HTTP au lieu de 17
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

    // Regrouper par table Supabase distante pour batching
    const groups = new Map();
    for (const tc of targetTables) {
      if (!groups.has(tc.remote)) groups.set(tc.remote, []);
      groups.get(tc.remote).push(tc);
    }

    log(`Fetch depuis Supabase (${targetTables.length} sources via ${groups.size} requetes)...`);

    const promises = [];
    for (const [, configs] of groups) {
      if (configs.length === 1) {
        // Table unique -> requete individuelle (pas de gain a batche)
        promises.push(fetchTable(configs[0]));
      } else if (configs[0].isKeyValue) {
        // Plusieurs namespaces de configuration -> 1 requete .in()
        promises.push(fetchBatchedKeyValue(configs));
      } else {
        // Plusieurs filtres sur la meme table -> 1 requete + split client
        promises.push(fetchBatchedTable(configs));
      }
    }

    await Promise.all(promises);

    // Mettre a jour le cache sessionStorage (pages publiques uniquement)
    if (!isAdminPage) {
      for (const tc of targetTables) {
        writeCache(tc.local, dataStore.get(tc.local));
      }
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

    // Nettoyer aussi l'ancien etat de sync et les anciennes cles orphelines
    const legacyKeys = ['mistral_sync_state', 'mistral_compta_config', 'mistral_email_automations'];
    legacyKeys.forEach(key => {
      try { localStorage.removeItem(key); } catch (e) { /* Ignorer */ }
    });

    log('Anciennes cles localStorage nettoyees');
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  function flushReadyCallbacks() {
    readyCallbacks.forEach(cb => {
      try { cb(); } catch (e) { log(`Erreur callback onReady: ${e.message}`, 'error'); }
    });
    readyCallbacks.length = 0;
  }

  async function init() {
    log('Initialisation du module de donnees...');

    detectPageType();

    // Nettoyer les anciennes cles localStorage (migration)
    cleanupLocalStorage();

    // Phase 1 : Restaurer le cache sessionStorage pour un render immediat
    // (pages publiques uniquement — admin charge toujours depuis Supabase)
    if (!isAdminPage) {
      const targetTables = getTablesForCurrentPage();
      const restored = restoreFromCache(targetTables);
      if (restored) {
        isReady = true;
        flushReadyCallbacks();
        window.dispatchEvent(new CustomEvent('mistral-sync-complete'));
        log('Cache sessionStorage restaure → render immediat', 'success');
      }
    }

    // Phase 2 : Charger les donnees fraiches depuis Supabase
    await refresh();

    // Marquer comme pret (si le cache n'a pas deja declenche)
    if (!isReady) {
      isReady = true;
      flushReadyCallbacks();
    }

    log('Module de donnees pret', 'success');

    // Phase 3 : Prefetch des tables pour les autres pages publiques
    if (!isAdminPage) {
      schedulePrefetch();
    }
  }

  // Demarrer quand le DOM est pret
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============================================================================
  // PREFETCH (precharge les autres pages publiques en idle)
  // ============================================================================

  function schedulePrefetch() {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => prefetchOtherPages(), { timeout: 5000 });
    } else {
      setTimeout(prefetchOtherPages, 2000);
    }
  }

  /**
   * Prefetch les tables publiques non encore cachees.
   * Stocke les resultats dans dataStore + sessionStorage.
   * Ainsi, la navigation vers une autre page chargera instantanement depuis le cache.
   */
  async function prefetchOtherPages() {
    if (!window.MistralDB) return;
    const client = window.MistralDB.getClient();
    if (!client) return;

    // Toutes les tables publiques mentionnees dans publicPageTables
    const allPublicRemotes = new Set();
    Object.values(SYNC_CONFIG.publicPageTables).forEach(tables => {
      tables.forEach(name => {
        allPublicRemotes.add(name.includes(':') ? name.split(':')[0] : name);
      });
    });

    // Filtrer : seulement les tables cachables pas encore en cache
    const toPrefetch = SYNC_CONFIG.tables.filter(tc => {
      if (!allPublicRemotes.has(tc.remote)) return false;
      if (!CACHEABLE_KEYS.has(tc.local)) return false;
      if (readCache(tc.local) !== null) return false;
      return true;
    });

    if (toPrefetch.length === 0) {
      log('Prefetch: cache deja complet');
      return;
    }

    log(`Prefetch: ${toPrefetch.length} sources pour les autres pages...`);

    // Regrouper par table distante (meme logique de batching que refresh)
    const groups = new Map();
    for (const tc of toPrefetch) {
      if (!groups.has(tc.remote)) groups.set(tc.remote, []);
      groups.get(tc.remote).push(tc);
    }

    const promises = [];
    for (const [, configs] of groups) {
      if (configs.length === 1) {
        promises.push(fetchTable(configs[0]));
      } else if (configs[0].isKeyValue) {
        promises.push(fetchBatchedKeyValue(configs));
      } else {
        promises.push(fetchBatchedTable(configs));
      }
    }

    await Promise.all(promises);

    // Ecrire en cache sessionStorage
    for (const tc of toPrefetch) {
      writeCache(tc.local, dataStore.get(tc.local));
    }

    log('Prefetch termine → cache global pret', 'success');
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================

  window.MistralSync = {
    // Acces aux donnees
    getData,
    setData,
    setDataLocal,
    hasKey,
    getTableConfig,

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
