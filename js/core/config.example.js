/**
 * =============================================================================
 * MISTRAL PANS - Configuration Supabase (template)
 * =============================================================================
 *
 * INSTRUCTIONS:
 * 1. Copiez ce fichier vers js/core/config.js
 * 2. Remplacez les valeurs par vos identifiants Supabase
 *
 * Pour obtenir vos identifiants:
 * 1. Connectez-vous à https://supabase.com/dashboard
 * 2. Sélectionnez votre projet
 * 3. Allez dans Settings > API
 * 4. Copiez "Project URL" et "anon public" key
 *
 * Note: La clé anon est conçue pour être exposée côté client.
 * La sécurité repose sur les politiques RLS, pas sur le secret de cette clé.
 *
 * =============================================================================
 */

window.MISTRAL_CONFIG = {
  // URL de votre projet Supabase (Settings > API > Project URL)
  SUPABASE_URL: 'https://votre-projet.supabase.co',

  // Clé anonyme publique (Settings > API > anon public)
  // Cette clé est conçue pour être exposée côté client
  // La sécurité vient des politiques RLS, pas du secret de cette clé
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
