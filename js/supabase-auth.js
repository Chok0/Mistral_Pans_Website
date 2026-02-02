/**
 * =============================================================================
 * MISTRAL PANS - Authentification Supabase
 * =============================================================================
 * 
 * Remplace le système d'authentification localStorage par Supabase Auth.
 * 
 * Installation:
 * 1. Ajouter ce script APRÈS supabase-client.js
 * 2. Remplacer les appels à MistralAdmin.Auth par MistralAuth
 * 
 * =============================================================================
 */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const AUTH_CONFIG = {
    // Redirection après login/logout
    loginRedirect: 'admin.html',
    logoutRedirect: 'index.html',
    
    // Clé localStorage pour compatibilité avec l'ancien système
    legacySessionKey: 'mistral_admin_session'
  };

  // État de l'authentification
  let currentUser = null;
  let isInitialized = false;

  // ============================================================================
  // HELPERS
  // ============================================================================
  
  function log(message, type = 'info') {
    const prefix = {
      'info': '🔐',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️'
    }[type] || '🔐';
    
    console.log(`[Auth] ${prefix} ${message}`);
  }

  function getSupabaseClient() {
    if (window.MistralDB && window.MistralDB.getClient) {
      return window.MistralDB.getClient();
    }
    return null;
  }

  // ============================================================================
  // AUTHENTIFICATION
  // ============================================================================
  
  /**
   * Connexion avec email et mot de passe
   */
  async function login(email, password) {
    const client = getSupabaseClient();
    if (!client) {
      log('Supabase client non disponible', 'error');
      return { success: false, error: 'Service non disponible' };
    }
    
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      
      if (error) {
        log(`Échec connexion: ${error.message}`, 'error');
        return { success: false, error: translateError(error.message) };
      }
      
      currentUser = data.user;
      
      // Créer une session compatible avec l'ancien système
      // pour que le reste du code continue à fonctionner
      createLegacySession(data.user);
      
      log(`Connecté: ${data.user.email}`, 'success');
      return { success: true, user: data.user };
      
    } catch (e) {
      log(`Exception: ${e.message}`, 'error');
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  /**
   * Déconnexion
   */
  async function logout() {
    const client = getSupabaseClient();
    if (!client) return;
    
    try {
      await client.auth.signOut();
      currentUser = null;
      
      // Supprimer la session legacy
      localStorage.removeItem(AUTH_CONFIG.legacySessionKey);
      
      log('Déconnecté', 'success');
      
      // Rediriger si configuré
      if (AUTH_CONFIG.logoutRedirect) {
        window.location.href = AUTH_CONFIG.logoutRedirect;
      }
      
    } catch (e) {
      log(`Erreur déconnexion: ${e.message}`, 'error');
    }
  }

  /**
   * Vérifie si l'utilisateur est connecté
   */
  async function isLoggedIn() {
    const client = getSupabaseClient();
    if (!client) {
      // Fallback sur l'ancien système
      return checkLegacySession();
    }
    
    try {
      const { data: { session } } = await client.auth.getSession();
      
      if (session) {
        currentUser = session.user;
        return true;
      }
      
      // Vérifier aussi l'ancienne session (période de transition)
      return checkLegacySession();
      
    } catch (e) {
      return checkLegacySession();
    }
  }

  /**
   * Version synchrone de isLoggedIn (pour compatibilité)
   */
  function isLoggedInSync() {
    // D'abord vérifier si on a un user en mémoire
    if (currentUser) return true;
    
    // Sinon vérifier la session legacy
    return checkLegacySession();
  }

  /**
   * Récupère l'utilisateur courant
   */
  async function getUser() {
    const client = getSupabaseClient();
    if (!client) return null;
    
    try {
      const { data: { user } } = await client.auth.getUser();
      currentUser = user;
      return user;
    } catch (e) {
      return null;
    }
  }

  /**
   * Récupère l'utilisateur courant (synchrone)
   */
  function getUserSync() {
    return currentUser;
  }

  // ============================================================================
  // COMPATIBILITÉ AVEC L'ANCIEN SYSTÈME
  // ============================================================================
  
  /**
   * Crée une session compatible avec l'ancien code
   */
  function createLegacySession(user) {
    const session = {
      user: user.email,
      expiry: Date.now() + (24 * 60 * 60 * 1000), // 24h
      supabase: true
    };
    localStorage.setItem(AUTH_CONFIG.legacySessionKey, JSON.stringify(session));
  }

  /**
   * Vérifie la session de l'ancien système
   */
  function checkLegacySession() {
    try {
      const stored = localStorage.getItem(AUTH_CONFIG.legacySessionKey);
      if (!stored) return false;
      
      const session = JSON.parse(stored);
      if (session.expiry && session.expiry > Date.now()) {
        return true;
      }
      
      // Session expirée
      localStorage.removeItem(AUTH_CONFIG.legacySessionKey);
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Login avec l'ancien système (fallback)
   * Pour compatibilité avec le code existant qui utilise username/password
   */
  function legacyLogin(username, password) {
    // L'ancien système utilisait un hash simple
    // On le garde en fallback mais on encourage l'utilisation de Supabase
    const LEGACY_HASH = 1632636498; // Hash de 'mistral2024'
    
    function simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash;
    }
    
    if (username === 'admin' && simpleHash(password) === LEGACY_HASH) {
      const session = {
        user: 'admin',
        expiry: Date.now() + (24 * 60 * 60 * 1000),
        legacy: true
      };
      localStorage.setItem(AUTH_CONFIG.legacySessionKey, JSON.stringify(session));
      return true;
    }
    
    return false;
  }

  // ============================================================================
  // TRADUCTION DES ERREURS
  // ============================================================================
  
  function translateError(message) {
    const translations = {
      'Invalid login credentials': 'Email ou mot de passe incorrect',
      'Email not confirmed': 'Email non confirmé',
      'User not found': 'Utilisateur non trouvé',
      'Invalid email': 'Email invalide',
      'Password should be at least 6 characters': 'Le mot de passe doit faire au moins 6 caractères'
    };
    
    return translations[message] || message;
  }

  // ============================================================================
  // ÉCOUTE DES CHANGEMENTS D'AUTH
  // ============================================================================
  
  function setupAuthListener() {
    const client = getSupabaseClient();
    if (!client) return;
    
    client.auth.onAuthStateChange((event, session) => {
      log(`Auth event: ${event}`);
      
      if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        createLegacySession(session.user);
        
        // Dispatch un événement custom
        window.dispatchEvent(new CustomEvent('mistral-auth-change', {
          detail: { event: 'login', user: session.user }
        }));
        
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        localStorage.removeItem(AUTH_CONFIG.legacySessionKey);
        
        window.dispatchEvent(new CustomEvent('mistral-auth-change', {
          detail: { event: 'logout', user: null }
        }));
      }
    });
  }

  // ============================================================================
  // PROTECTION DES PAGES
  // ============================================================================
  
  /**
   * Protège une page (redirige si non connecté)
   */
  async function requireAuth(redirectTo = 'admin.html') {
    const loggedIn = await isLoggedIn();
    
    if (!loggedIn) {
      log('Accès non autorisé, redirection...', 'warning');
      window.location.href = redirectTo;
      return false;
    }
    
    return true;
  }

  /**
   * Version synchrone de requireAuth
   */
  function requireAuthSync(redirectTo = 'admin.html') {
    if (!isLoggedInSync()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================
  
  async function init() {
    log('Initialisation...');
    
    // Vérifier la session existante
    await isLoggedIn();
    
    // Setup listener
    setupAuthListener();
    
    isInitialized = true;
    log('Prêt', 'success');
  }

  // Initialiser quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================
  
  window.MistralAuth = {
    // Authentification
    login,
    logout,
    isLoggedIn,
    isLoggedInSync,
    getUser,
    getUserSync,
    
    // Protection
    requireAuth,
    requireAuthSync,
    
    // Compatibilité
    legacyLogin,
    
    // État
    isInitialized: () => isInitialized
  };

  // Alias pour compatibilité avec l'ancien code MistralAdmin.Auth
  if (window.MistralAdmin) {
    window.MistralAdmin.Auth = {
      login: function(username, password) {
        // Si c'est un email, utiliser Supabase
        if (username.includes('@')) {
          login(username, password).then(result => {
            if (result.success) {
              window.location.reload();
            }
          });
          return false; // Retourne false immédiatement car async
        }
        // Sinon, fallback sur l'ancien système
        return legacyLogin(username, password);
      },
      logout: logout,
      isLoggedIn: isLoggedInSync
    };
  }

  console.log('✅ MistralAuth chargé');

})(window);
