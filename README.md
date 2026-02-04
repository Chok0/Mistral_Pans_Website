# Mistral Pans - Site Web

Site web premium pour Mistral Pans, fabricant artisanal de handpans en Ile-de-France.

---

## Table des matieres

1. [Vision du projet](#vision-du-projet)
2. [Quick Start](#quick-start)
3. [Structure du projet](#structure-du-projet)
4. [Stack technique](#stack-technique)
5. [Design System](#design-system)
6. [Pages et fonctionnalites](#pages-et-fonctionnalites)
7. [Systeme de tarification](#systeme-de-tarification)
8. [Systeme de faisabilite](#systeme-de-faisabilite)
9. [Systeme audio](#systeme-audio)
10. [Systeme d'administration](#systeme-dadministration)
11. [Base de donnees Supabase](#base-de-donnees-supabase)
12. [Diagnostic du projet](#diagnostic-du-projet)
13. [Plan d'action](#plan-daction)
14. [Deploiement](#deploiement)
15. [Historique des versions](#historique-des-versions)

---

## Vision du projet

Un site vitrine haut de gamme qui reflete la qualite artisanale des instruments, avec :
- Une experience utilisateur fluide sur desktop et mobile
- Un configurateur intelligent avec verification de faisabilite
- Un systeme d'administration integre pour gerer le contenu sans toucher au code
- Une approche RGPD-friendly (minimum de dependances externes, donnees en Europe)

---

## Quick Start

**Important** : Le site utilise `fetch()` pour charger les partials. Il **ne fonctionnera pas** en ouvrant directement les fichiers HTML (`file://`).

### Option 1 : Python (recommande)
```bash
cd /chemin/vers/le/projet
python -m http.server 8000
```
Puis ouvrir http://localhost:8000

### Option 2 : VS Code + Live Server
1. Installer l'extension "Live Server"
2. Clic droit sur `index.html` > "Open with Live Server"

### Option 3 : Node.js
```bash
npx serve .
```

---

## Structure du projet

```
/
|-- *.html                    # Pages principales (racine)
|-- partials/                 # Composants reutilisables (charges dynamiquement)
|   |-- header.html          # Navigation principale
|   |-- footer.html          # Pied de page complet
|   |-- footer-minimal.html  # Pied de page simplifie
|   +-- contact-modal.html   # Modal de contact
|
|-- css/
|   |-- style.css            # Styles globaux (1,761 lignes)
|   |-- boutique.css         # Configurateur + stock
|   |-- admin.css            # Styles admin (FAB, modals)
|   |-- gestion.css          # Legacy (deprecie)
|   +-- teacher-form.css     # Formulaire professeur
|
|-- js/
|   |-- main.js              # Core: partials, navigation
|   |-- admin-core.js        # Admin: auth, FAB, CRUD, sanitization
|   |-- admin-ui-core.js     # Admin UI: navigation, dashboard, todos
|   |-- admin-ui-gestion.js  # Admin UI: clients, instruments, locations
|   |-- admin-ui-boutique.js # Admin UI: boutique, accessoires
|   |-- admin-ui-content.js  # Admin UI: professeurs, galerie, blog
|   |-- admin-ui-config.js   # Admin UI: configuration, export/import
|   |-- admin-ui-modals.js   # Admin UI: tous les modals CRUD
|   |-- admin-ui-compta.js   # Admin UI: comptabilite, URSSAF
|   |-- cookie-consent.js    # RGPD: banniere consentement cookies
|   |-- handpan-player.js    # Player SVG interactif
|   |-- feasibility-module.js # Validation configurations
|   |-- supabase-client.js   # Client Supabase (config externalisee)
|   |-- supabase-auth.js     # Authentification
|   |-- supabase-sync.js     # Synchronisation temps reel
|   |-- *-admin.js           # Modules admin par page
|   +-- *.js                 # Autres modules
|
|-- php/
|   |-- upload.php           # Upload fichiers
|   +-- delete.php           # Suppression fichiers
|
|-- sql/                      # (Supprime du repo - conserve localement)
|   |-- 01_schema.sql        # Schema base de donnees
|   |-- 02_rls_policies.sql  # Politiques RLS
|   +-- 03_colonnes_sync.sql # Synchronisation colonnes
|
|-- ressources/
|   |-- images/              # Photos, logos, assets
|   +-- audio/               # Samples FLAC (50+ notes)
|
|-- netlify/functions/
|   +-- send-email.js        # Fonction email Brevo
|
|-- CLAUDE.md                # Guide pour assistants IA
+-- README.md                # Ce fichier
```

---

## Stack technique

### Frontend
- **Core :** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Styling :** CSS custom properties, mobile-first responsive
- **Typographies :** Fraunces (titres), Inter (corps), JetBrains Mono (code)

### Bibliotheques externes (CDN)
- **Supabase JS SDK 2.x** - Base de donnees / Auth
- **Leaflet 1.9.4** - Cartes interactives
- **Quill.js** - Editeur WYSIWYG (blog)
- **Google reCAPTCHA v3** - Protection formulaires

### Backend
- **Database :** Supabase PostgreSQL avec RLS
- **Email :** Brevo SMTP via Netlify Functions
- **Hosting :** OVH Mutualise (support PHP)
- **Serverless :** Netlify Functions

---

## Design System

### Couleurs principales

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--color-accent` | `#0D7377` | Accent principal (teal) |
| `--color-bg` | `#FDFBF7` | Fond clair |
| `--color-bg-dark` | `#1A1815` | Fond sombre |
| `--color-text` | `#2C2825` | Texte principal |
| `--color-success` | `#4A7C59` | Validation |
| `--color-warning` | `#F59E0B` | Avertissement |
| `--color-error` | `#EF4444` | Erreur |

### Breakpoints responsive

| Taille | Cible | Description |
|--------|-------|-------------|
| `> 1024px` | Desktop | Affichage complet, multi-colonnes |
| `768px - 1024px` | Tablette | Layout adapte |
| `500px - 768px` | Mobile large | Navigation hamburger |
| `< 500px` | Mobile | Affichage minimal, tout empile |

---

## Pages et fonctionnalites

| Page | Fichier | Description |
|------|---------|-------------|
| Accueil | `index.html` | Hero, cartes triangles, partenaires |
| Boutique | `boutique.html` | Configurateur + Stock (swipe mobile) |
| Commander | `commander.html` | Formulaire commande, options paiement |
| Location | `location.html` | Service location, FAQ accordeon |
| Apprendre | `apprendre.html` | Carte Leaflet, professeurs IDF |
| Galerie | `galerie.html` | Mosaique responsive, lightbox |
| Blog | `blog.html` | Articles, newsletter |
| Admin | `admin.html` | Dashboard centralise |

---

## Systeme de tarification

### Prix de base

| Element | Prix |
|---------|------|
| Note standard | 115 EUR |
| Note en octave 2 | +50 EUR par note |
| Instrument avec bottoms | +25 EUR (forfait) |

### Malus par taille

| Taille | Malus |
|--------|-------|
| 53 cm | 0% |
| 50 cm | +2.5% |
| 45 cm | +5% |

### Malus par difficulte

| Status | Malus |
|--------|-------|
| OK | 0% |
| Warning | +5% |
| Difficult | +10% |

**Arrondi :** Tous les prix sont arrondis a la tranche de 5 EUR inferieure.

---

## Systeme de faisabilite

Le module `feasibility-module.js` verifie automatiquement si une configuration est realisable.

### Seuils de faisabilite

| Status | % Surface | Effet UI | Effet prix |
|--------|-----------|----------|------------|
| OK | <= 45% | Normal | 0% |
| Warning | 45-50% | Hint "Config avancee" | +5% |
| Difficult | 50-59% | Bouton verification | +10% |
| Impossible | > 59% | Chip grisee, bloque | N/A |

### Notes interdites par taille

| Taille | Note interdite |
|--------|----------------|
| 53 cm | A#4 |
| 50 cm | B4 |
| 45 cm | C#5 |

---

## Systeme audio

- **Format :** FLAC
- **Dossier :** `ressources/audio/`
- **Nommage :** `[Note][s][Octave].flac` (s pour diese)
  - Exemple : C#4 > `Cs4.flac`, Bb3 > `As3.flac`

**Plage disponible :** E2 a F5 (50+ samples)

---

## Systeme d'administration

### Architecture modulaire (v3.1)

Le systeme admin a ete refactorise en modules independants pour une meilleure maintenabilite :

| Module | Taille | Responsabilite |
|--------|--------|----------------|
| `admin-core.js` | 32 KB | Auth, FAB, Modal, Toast, Storage, sanitization |
| `admin-ui-core.js` | 12 KB | Navigation, dashboard, todos |
| `admin-ui-gestion.js` | 20 KB | Clients, instruments, locations, commandes, factures |
| `admin-ui-boutique.js` | 18 KB | Stock boutique, accessoires |
| `admin-ui-content.js` | 30 KB | Professeurs, galerie, blog, analytics |
| `admin-ui-config.js` | 12 KB | Configuration, export/import, materiaux |
| `admin-ui-modals.js` | 62 KB | Tous les modals CRUD |
| `admin-ui-compta.js` | 14 KB | Comptabilite, URSSAF |
| `[page]-admin.js` | Variable | Integrations specifiques par page |

### Acces
- **URL :** `/admin.html`
- **Identifiants par defaut :** `admin` / `mistral2024`

### Stockage localStorage

| Cle | Usage |
|-----|-------|
| `mistral_admin_session` | Session admin (24h) |
| `mistral_flash_annonces` | Annonces boutique |
| `mistral_teachers` | Professeurs valides |
| `mistral_pending_teachers` | Demandes en attente |
| `mistral_gallery` | Medias galerie |
| `mistral_blog_articles` | Articles blog |

---

## Base de donnees Supabase

### Tables principales

| Table | Usage |
|-------|-------|
| `clients` | Clients (nom, email, telephone, adresse) |
| `instruments` | Inventaire (reference, gamme, tonalite, taille, prix) |
| `locations` | Locations (client, instrument, dates, caution) |
| `commandes` | Commandes (specifications JSON, montant, statut) |
| `factures` | Factures (numero auto, lignes JSON) |
| `professeurs` | Professeurs (nom, location, lat/lng, photo) |
| `galerie` | Medias (type, src, thumbnail, ordre) |
| `articles` | Blog (slug, title, content HTML, tags) |

### Securite RLS
- **Lecture publique :** Professeurs actifs, articles publies, instruments en ligne
- **Insertion publique :** Candidatures professeurs (statut pending)
- **CRUD authentifie :** Operations admin completes

---

## Diagnostic du projet

**Revue initiale :** 3 fevrier 2026
**Corrections appliquees :** 4 fevrier 2026

### Resume des corrections

| Categorie | Initial | Corrige | Restant |
|-----------|---------|---------|---------|
| Critique | 8 | 7 | 1 |
| Haute | 19 | 12 | 7 |
| Moyenne | 32 | 15 | 17 |
| Basse | 19 | 5 | 14 |
| **Total** | **78** | **39** | **39** |

---

### Corrections CRITIQUES appliquees

| ID | Probleme | Statut |
|----|----------|--------|
| CRIT-001 | Credentials Supabase exposees | Externalise via `window.MISTRAL_CONFIG` |
| CRIT-002 | Email header injection | Sanitisation ajoutee dans send-email.js |
| CRIT-003 | XSS dans emails | Fonction `escapeHtml()` appliquee |
| CRIT-004 | CORS wildcard PHP | Restreint aux domaines autorises |
| CRIT-005 | Tokens admin hardcodes | Hash externe + verification timing-safe |
| CRIT-008 | Pas de banniere cookies | `cookie-consent.js` implemente |
| CRIT-006/007 | RLS et config DB | *A traiter cote Supabase* |

### Corrections HAUTES appliquees

| ID | Probleme | Statut |
|----|----------|--------|
| HIGH-001 | XSS innerHTML admin | `sanitizeHtml()` ajoutee dans admin-core.js |
| HIGH-012 | Contraste couleurs insuffisant | `--color-text-muted` corrige |
| HIGH-013 | Google Fonts sans consentement | Chargement conditionnel via cookies |
| HIGH-017 | Formulaires sans consentement | Checkbox RGPD ajoutee |
| - | Fichier admin-ui.js monolithique | Refactorise en 7 modules |
| - | Fichiers orphelins | Supprimes (messages.js, etc.) |
| - | Skip link accessibilite | Ajoute dans header.html |

### Corrections MOYENNES appliquees

| Probleme | Statut |
|----------|--------|
| Meta Open Graph/Twitter | Ajoutees sur toutes les pages |
| Navigation clavier | `tabindex`, `role`, `onkeydown` ajoutes |
| Alt text manquants | Corriges sur index.html, galerie.html |
| Labels formulaires | Ameliores |
| Fichier CSS mal place (js/admin.css) | Supprime |

### Points positifs

- Structure HTML semantique propre
- Bonne base de CSS custom properties
- Design responsive mobile-first
- RLS activee sur Supabase
- Approche RGPD-first avec banniere consentement
- Player handpan interactif bien implemente
- Systeme de partials fonctionnel
- Architecture admin modulaire et maintenable

---

## Plan d'action

### Phase 1 : Securite - COMPLETE

- [x] Externaliser les identifiants Supabase (`window.MISTRAL_CONFIG`)
- [x] Corriger injection email header
- [x] Corriger vulnerabilites XSS (sanitizeHtml, escapeHtml)
- [x] Restreindre CORS sur endpoints PHP
- [x] Securiser tokens upload/delete
- [ ] Implementer hash bcrypt cote serveur (optionnel)

### Phase 2 : RGPD/Accessibilite - COMPLETE

- [x] Banniere consentement cookies
- [x] Google Fonts conditionnel
- [x] Checkbox consentement formulaires
- [x] Skip link accessibilite
- [x] Correction contraste couleurs
- [x] Meta Open Graph/Twitter
- [x] Navigation clavier amelioree

### Phase 3 : Dette technique - COMPLETE

- [x] Refactoriser admin-ui.js en 7 modules
- [x] Supprimer fichiers orphelins (messages.js, import-excel-data.js)
- [x] Supprimer gestion.html et gestion-ui.js deprecies
- [x] Supprimer fichiers SQL du repo (securite)
- [x] Corriger fichier CSS mal place (js/admin.css)

### Phase 4 : Restant a faire

- [ ] Faire de Supabase la source de verite (pattern localStorage-first)
- [ ] Implementer gestion erreurs avec notifications utilisateur
- [ ] Restaurer contraintes base de donnees
- [ ] Ajouter politiques RLS granulaires
- [ ] Consolider utilitaires dupliques restants
- [ ] Ajouter indicateurs `:focus-visible` complets
- [ ] Creer echelle z-index unifiee

---

## Deploiement

### Hebergement
- OVH Mutualise (domaine + hebergement)
- Site statique avec scripts PHP pour uploads
- SSL/TLS inclus

### Checklist pre-production

- [ ] Changer mot de passe admin par defaut
- [ ] Configurer cles reCAPTCHA
- [ ] Verifier encodage UTF-8
- [ ] Optimiser images (WebP)
- [ ] Tester sur vrais appareils mobiles
- [ ] Configurer Swikly pour depots location
- [ ] Configurer email (contact@mistralpans.fr)
- [x] Creer pages legales (mentions, CGV) - *existantes*
- [x] Configurer banniere consentement cookies
- [x] Externaliser identifiants Supabase (`window.MISTRAL_CONFIG`)
- [x] Securiser endpoints PHP (CORS, tokens)

### Services externes

| Service | Usage | RGPD |
|---------|-------|------|
| Supabase | Database, Auth | Hebergement EU disponible |
| Brevo | Email | Conforme RGPD |
| Nominatim | Geocodage | Pas de tracking |
| CartoDB | Tuiles carte | Consentement requis (banniere) |
| reCAPTCHA | Protection spam | Service Google |
| Google Fonts | Typographies | Chargement conditionnel (consentement) |

---

## Historique des versions

### v3.1 (4 Fevrier 2026)
- **Securite :** Correction 7 vulnerabilites critiques (XSS, CORS, injection)
- **RGPD :** Banniere consentement cookies, Google Fonts conditionnel
- **Accessibilite :** Skip link, contraste couleurs, navigation clavier
- **Architecture :** Refactorisation admin-ui.js en 7 modules
- **Nettoyage :** Suppression fichiers deprecies et orphelins
- **SEO :** Meta Open Graph/Twitter sur toutes les pages

### v3.0 (3 Fevrier 2026)
- Revue globale du projet (78 issues identifies)
- Documentation mise a jour avec diagnostic
- Plan d'action pour corrections

### v2.5 (Janvier 2025)
- Systeme de faisabilite des configurations
- Nouvelle tarification : 115 EUR/note + malus
- Navigation swipe mobile
- Bandeau teal sticky desktop

### v2.4 (Janvier 2025)
- Suppression build Node.js
- Chargement dynamique des partials
- Navigation active automatique

### v2.3 (Janvier 2025)
- FAB admin sur toutes les pages
- Geocodage automatique (Nominatim)
- Upload photo de profil

### v2.2 (Janvier 2025)
- Systeme admin centralise
- Admin galerie et blog
- Consentement RGPD Leaflet

### v2.0
- Refonte design complete
- Configurateur SVG interactif
- Audio samples FLAC

---

## Contact

- **Site :** mistralpans.fr
- **Email :** contact@mistralpans.fr
- **Localisation :** Ile-de-France, France

---

*Documentation mise a jour le 4 fevrier 2026*
