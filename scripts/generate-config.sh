#!/bin/bash
# =============================================================================
# Genere js/core/config.js a partir des variables d'environnement
# Utilise par Netlify au build (voir netlify.toml)
#
# Variables requises :
#   SUPABASE_URL      - URL du projet Supabase (ex: https://xxx.supabase.co)
#   SUPABASE_ANON_KEY - Cle anonyme publique (anon public)
#
# Usage :
#   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... ./scripts/generate-config.sh
# =============================================================================

set -e

CONFIG_FILE="js/core/config.js"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "⚠️  SUPABASE_URL et SUPABASE_ANON_KEY requis."
  echo "   Definissez-les dans Netlify > Site > Environment variables"
  exit 1
fi

cat > "$CONFIG_FILE" << EOF
// Auto-genere par scripts/generate-config.sh — ne pas modifier
window.MISTRAL_CONFIG = {
  SUPABASE_URL: '${SUPABASE_URL}',
  SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}'
};
EOF

echo "✅ $CONFIG_FILE genere"
