/**
 * =============================================================================
 * MISTRAL PANS - Configuration Supabase (template)
 * =============================================================================
 *
 * PRODUCTION (Netlify) :
 *   config.js est genere automatiquement au build par scripts/generate-config.sh
 *   Definir les variables d'environnement dans Netlify > Site > Environment variables :
 *     - SUPABASE_URL
 *     - SUPABASE_ANON_KEY
 *
 * DEVELOPPEMENT LOCAL :
 *   1. Copiez ce fichier vers js/core/config.js
 *   2. Remplacez les valeurs par vos identifiants Supabase
 *
 * Pour obtenir vos identifiants:
 *   1. Connectez-vous a https://supabase.com/dashboard
 *   2. Selectionnez votre projet
 *   3. Allez dans Settings > API
 *   4. Copiez "Project URL" et "anon public" key
 *
 * Note: La cle anon est concue pour etre exposee cote client.
 * La securite repose sur les politiques RLS, pas sur le secret de cette cle.
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
