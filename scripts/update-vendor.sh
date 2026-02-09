#!/usr/bin/env bash
# ==========================================================================
#  MISTRAL PANS - Vendor Library Update Script
#  Verifie et met a jour les librairies self-hosted dans js/vendor/
# ==========================================================================
set -euo pipefail

# Resolve project root (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VENDOR_DIR="$PROJECT_ROOT/js/vendor"
VERSIONS_FILE="$VENDOR_DIR/versions.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# --- Helpers ---

die() {
  echo -e "${RED}Erreur: $1${NC}" >&2
  exit 1
}

check_deps() {
  command -v node >/dev/null 2>&1 || die "Node.js est requis. Installez-le depuis https://nodejs.org"
  command -v npm >/dev/null 2>&1 || die "npm est requis."
}

# Read a field from versions.json using Node (portable, no jq dependency)
read_version() {
  local lib="$1"
  node -e "
    const v = require('$VERSIONS_FILE');
    const lib = v.libraries['$lib'];
    if (lib) console.log(lib.version);
    else process.exit(1);
  " 2>/dev/null || echo "?"
}

read_npm_package() {
  local lib="$1"
  node -e "
    const v = require('$VERSIONS_FILE');
    const lib = v.libraries['$lib'];
    if (lib) console.log(lib.npm_package);
    else process.exit(1);
  " 2>/dev/null || echo ""
}

get_all_libs() {
  node -e "
    const v = require('$VERSIONS_FILE');
    console.log(Object.keys(v.libraries).join(' '));
  " 2>/dev/null
}

# Get latest version from npm registry
get_latest_version() {
  local pkg="$1"
  # Special case: quill stays on 1.x (v2 is a breaking change)
  if [ "$pkg" = "quill" ]; then
    npm view "$pkg@1" version 2>/dev/null | tail -1 || echo "?"
  else
    npm view "$pkg" version 2>/dev/null || echo "?"
  fi
}

# Semver comparison: returns 0 if latest > current
is_newer() {
  local current="$1"
  local latest="$2"
  node -e "
    const c = '$current'.split('.').map(Number);
    const l = '$latest'.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((l[i]||0) > (c[i]||0)) { process.exit(0); }
      if ((l[i]||0) < (c[i]||0)) { process.exit(1); }
    }
    process.exit(1);
  " 2>/dev/null
}

# --- Library file mappings ---

copy_lib_files() {
  local lib="$1"
  local tmp_dir="$2"

  case "$lib" in
    supabase-js)
      cp "$tmp_dir/node_modules/@supabase/supabase-js/dist/umd/supabase.js" "$VENDOR_DIR/supabase.js"
      ;;
    leaflet)
      mkdir -p "$VENDOR_DIR/leaflet/images"
      cp "$tmp_dir/node_modules/leaflet/dist/leaflet.js" "$VENDOR_DIR/leaflet/leaflet.js"
      cp "$tmp_dir/node_modules/leaflet/dist/leaflet.css" "$VENDOR_DIR/leaflet/leaflet.css"
      cp "$tmp_dir/node_modules/leaflet/dist/images/"* "$VENDOR_DIR/leaflet/images/"
      ;;
    chart.js)
      cp "$tmp_dir/node_modules/chart.js/dist/chart.umd.js" "$VENDOR_DIR/chart.umd.js"
      ;;
    quill)
      cp "$tmp_dir/node_modules/quill/dist/quill.min.js" "$VENDOR_DIR/quill.min.js"
      cp "$tmp_dir/node_modules/quill/dist/quill.snow.css" "$VENDOR_DIR/quill.snow.css"
      ;;
  esac
}

# --- Update versions.json ---

update_versions_json() {
  local lib="$1"
  local new_version="$2"
  local today
  today=$(date +%Y-%m-%d)

  node -e "
    const fs = require('fs');
    const v = JSON.parse(fs.readFileSync('$VERSIONS_FILE', 'utf8'));
    v.libraries['$lib'].version = '$new_version';
    v.last_updated = '$today';
    fs.writeFileSync('$VERSIONS_FILE', JSON.stringify(v, null, 2) + '\n');
  "
}

# --- Main logic ---

show_status() {
  echo ""
  echo -e "${BOLD}  MISTRAL PANS - Librairies vendor${NC}"
  echo -e "  ─────────────────────────────────────────────"
  echo ""

  local libs
  libs=$(get_all_libs)
  local has_updates=0

  printf "  ${BOLD}%-16s %-12s %-12s %s${NC}\n" "Librairie" "Locale" "Derniere" "Statut"
  echo "  ────────────────────────────────────────────────────"

  for lib in $libs; do
    local current
    current=$(read_version "$lib")
    local pkg
    pkg=$(read_npm_package "$lib")
    local latest
    latest=$(get_latest_version "$pkg")

    if [ "$latest" = "?" ]; then
      printf "  %-16s %-12s %-12s ${YELLOW}?${NC}\n" "$lib" "$current" "erreur"
    elif is_newer "$current" "$latest"; then
      printf "  %-16s %-12s ${CYAN}%-12s${NC} ${YELLOW}⬆ mise a jour${NC}\n" "$lib" "$current" "$latest"
      has_updates=1
    else
      printf "  %-16s %-12s %-12s ${GREEN}✓${NC}\n" "$lib" "$current" "$latest"
    fi
  done

  echo ""

  if [ "$has_updates" -eq 1 ]; then
    echo -e "  ${YELLOW}Des mises a jour sont disponibles.${NC}"
    echo -e "  Lance ${CYAN}./scripts/update-vendor.sh --install${NC} pour les installer."
  else
    echo -e "  ${GREEN}Tout est a jour.${NC}"
  fi

  echo ""
}

do_install() {
  local force="${1:-false}"
  local libs
  libs=$(get_all_libs)
  local tmp_dir

  tmp_dir=$(mktemp -d)
  trap "rm -rf '$tmp_dir'" EXIT

  cd "$tmp_dir"
  npm init -y >/dev/null 2>&1

  for lib in $libs; do
    local current
    current=$(read_version "$lib")
    local pkg
    pkg=$(read_npm_package "$lib")
    local latest
    latest=$(get_latest_version "$pkg")

    if [ "$latest" = "?" ]; then
      echo -e "  ${YELLOW}⚠ $lib: impossible de verifier la version${NC}"
      continue
    fi

    local should_update=false
    if [ "$force" = "true" ]; then
      should_update=true
    elif is_newer "$current" "$latest"; then
      should_update=true
    fi

    if [ "$should_update" = "true" ]; then
      echo -e "  ${CYAN}⬆ $lib: $current → $latest${NC}"

      # Install specific version (quill stays on 1.x)
      if [ "$lib" = "quill" ]; then
        npm install "quill@$latest" --save --silent 2>/dev/null
      else
        npm install "$pkg@$latest" --save --silent 2>/dev/null
      fi

      copy_lib_files "$lib" "$tmp_dir"
      update_versions_json "$lib" "$latest"

      echo -e "  ${GREEN}✓ $lib mis a jour en $latest${NC}"
    else
      echo -e "  ${GREEN}✓ $lib: $current (a jour)${NC}"
    fi
  done

  echo ""
  echo -e "  ${GREEN}Termine.${NC} Fichiers mis a jour dans js/vendor/"
  echo ""
}

# --- Entry point ---

main() {
  check_deps

  if [ ! -f "$VERSIONS_FILE" ]; then
    die "Fichier $VERSIONS_FILE introuvable. Le dossier vendor est-il initialise ?"
  fi

  case "${1:-}" in
    --install)
      echo ""
      echo -e "${BOLD}  Installation des mises a jour...${NC}"
      echo ""
      do_install false
      ;;
    --force)
      echo ""
      echo -e "${BOLD}  Reinstallation forcee de toutes les librairies...${NC}"
      echo ""
      do_install true
      ;;
    --help|-h)
      echo ""
      echo -e "${BOLD}Usage:${NC} ./scripts/update-vendor.sh [OPTIONS]"
      echo ""
      echo "  (sans option)   Affiche les versions et mises a jour disponibles"
      echo "  --install       Installe uniquement les mises a jour disponibles"
      echo "  --force         Reinstalle toutes les librairies (meme si a jour)"
      echo "  --help          Affiche cette aide"
      echo ""
      ;;
    "")
      show_status
      ;;
    *)
      die "Option inconnue: $1. Lance avec --help pour l'aide."
      ;;
  esac
}

main "$@"
