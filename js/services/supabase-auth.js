/**
 * =============================================================================
 * MISTRAL PANS - Authentification Supabase
 * =============================================================================
 *
 * Authentification via Supabase Auth exclusivement.
 * Aucun fallback localStorage — si Supabase est indisponible, l'admin
 * est inaccessible (comportement voulu pour la securite).
 *
 * API publique : window.MistralAuth
 * Alias compat : window.MistralAdmin.Auth (set apres chargement admin-core)
 *
 * =============================================================================
 */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const AUTH_CONFIG = {
    logoutRedirect: 'index.html',
    // Cle legacy a nettoyer (migration)
    legacySessionKey: 'mistral_admin_session',
    legacyCredentialsKey: 'mistral_admin_credentials'
  };

  // Etat de l'authentification (en memoire uniquement)
  let currentUser = null;
  let currentSession = null;
  let isInitialized = false;
  let authSubscription = null;

  // ============================================================================
  // HELPERS
  // ============================================================================

  function log(message, type = 'info') {
    const prefix = { 'info': '[Auth]', 'success': '[Auth]', 'error': '[Auth ERR]', 'warning': '[Auth WARN]' }[type] || '[Auth]';
    if (type === 'error') {
      console.error(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
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
   * Connexion avec email et mot de passe via Supabase Auth
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
        log('Echec connexion: ' + error.message, 'error');
        return { success: false, error: translateError(error.message) };
      }

      currentUser = data.user;
      currentSession = data.session;

      log('Connecte: ' + data.user.email, 'success');
      return { success: true, user: data.user };

    } catch (e) {
      log('Exception: ' + e.message, 'error');
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  /**
   * Deconnexion via Supabase Auth
   */
  async function logout() {
    const client = getSupabaseClient();

    try {
      if (client) {
        await client.auth.signOut();
      }
    } catch (e) {
      log('Erreur deconnexion: ' + e.message, 'error');
    }

    currentUser = null;
    currentSession = null;

    // Nettoyer les anciennes cles localStorage (migration)
    cleanupLegacyStorage();

    log('Deconnecte', 'success');

    if (AUTH_CONFIG.logoutRedirect) {
      window.location.href = AUTH_CONFIG.logoutRedirect;
    }
  }

  /**
   * Verifie si l'utilisateur est connecte (async, source de verite)
   */
  async function isLoggedIn() {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { data: { session } } = await client.auth.getSession();

      if (session) {
        currentUser = session.user;
        currentSession = session;
        return true;
      }

      currentUser = null;
      currentSession = null;
      return false;

    } catch (e) {
      log('Erreur verification session: ' + e.message, 'error');
      return false;
    }
  }

  /**
   * Verification synchrone via l'etat en memoire.
   * Fiable apres init() ou apres un login/logout.
   * Ne fait PAS d'appel reseau.
   */
  function isLoggedInSync() {
    return currentUser !== null && currentSession !== null;
  }

  /**
   * Recupere l'utilisateur courant (async, depuis Supabase)
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
   * Recupere l'utilisateur courant (synchrone, depuis memoire)
   */
  function getUserSync() {
    return currentUser;
  }

  /**
   * Recupere le JWT access token pour les requetes authentifiees
   * (upload PHP, API calls, etc.)
   */
  async function getAccessToken() {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data: { session } } = await client.auth.getSession();
      if (session) {
        currentSession = session;
        return session.access_token;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Version synchrone — renvoie le token en memoire
   */
  function getAccessTokenSync() {
    return currentSession?.access_token || null;
  }

  // ============================================================================
  // TRADUCTION DES ERREURS
  // ============================================================================

  function translateError(message) {
    const translations = {
      'Invalid login credentials': 'Email ou mot de passe incorrect',
      'Email not confirmed': 'Email non confirme',
      'User not found': 'Utilisateur non trouve',
      'Invalid email': 'Email invalide',
      'Password should be at least 6 characters': 'Le mot de passe doit faire au moins 6 caracteres'
    };

    return translations[message] || message;
  }

  // ============================================================================
  // ECOUTE DES CHANGEMENTS D'AUTH
  // ============================================================================

  function setupAuthListener() {
    const client = getSupabaseClient();
    if (!client) return;

    const { data } = client.auth.onAuthStateChange((event, session) => {
      log('Auth event: ' + event);

      if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        currentSession = session;

        window.dispatchEvent(new CustomEvent('mistral-auth-change', {
          detail: { event: 'login', user: session.user }
        }));

      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentSession = null;

        window.dispatchEvent(new CustomEvent('mistral-auth-change', {
          detail: { event: 'logout', user: null }
        }));

      } else if (event === 'TOKEN_REFRESHED' && session) {
        currentSession = session;
        currentUser = session.user;
      }
    });

    // Stocker la subscription pour pouvoir la nettoyer
    authSubscription = data?.subscription || null;
  }

  // ============================================================================
  // NETTOYAGE LEGACY
  // ============================================================================

  /**
   * Supprime les anciennes cles localStorage de l'ancien systeme d'auth
   */
  function cleanupLegacyStorage() {
    try {
      localStorage.removeItem(AUTH_CONFIG.legacySessionKey);
      localStorage.removeItem(AUTH_CONFIG.legacyCredentialsKey);
    } catch (e) {
      // Ignorer les erreurs localStorage
    }
  }

  // ============================================================================
  // PROTECTION DES PAGES
  // ============================================================================

  /**
   * Protege une page (redirige si non connecte)
   */
  async function requireAuth(redirectTo = 'admin.html') {
    const loggedIn = await isLoggedIn();

    if (!loggedIn) {
      log('Acces non autorise, redirection...', 'warning');
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

    // Nettoyer les anciennes cles localStorage (one-time migration)
    cleanupLegacyStorage();

    // Verifier la session Supabase existante
    await isLoggedIn();

    // Ecouter les changements d'auth
    setupAuthListener();

    isInitialized = true;
    log('Pret (user: ' + (currentUser ? currentUser.email : 'none') + ')');
  }

  // Initialiser quand le DOM est pret
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

    // Token JWT
    getAccessToken,
    getAccessTokenSync,

    // Protection
    requireAuth,

    // Etat
    isInitialized: () => isInitialized
  };

  // Note: MistralAdmin.Auth est defini dans admin-core.js et delegue
  // deja vers MistralAuth. Pas besoin d'alias ici.

  console.log('[MistralAuth] charge');

})(window);
