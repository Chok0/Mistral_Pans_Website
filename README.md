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
12. [Configuration Supabase](#configuration-supabase)
13. [Roadmap](#roadmap)
14. [Scale Batch System (spec)](#scale-batch-system)
15. [Deploiement](#deploiement)
16. [Historique des versions](#historique-des-versions)

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
|   |-- style.css            # Styles globaux
|   |-- boutique.css         # Configurateur + stock
|   |-- admin.css            # Styles admin (FAB, modals)
|   |-- gestion.css          # Styles gestion (dashboard admin)
|   +-- teacher-form.css     # Formulaire professeur
|
|-- js/
|   |-- core/                # Bootstrap, navigation, configuration
|   |   |-- main.js          # Chargement partials, navigation
|   |   |-- config.js        # Cles Supabase (gitignore)
|   |   |-- config.example.js # Template de configuration
|   |   +-- cookie-consent.js # Banniere RGPD cookies
|   |
|   |-- admin/               # Systeme d'administration
|   |   |-- admin-core.js    # Auth, FAB, CRUD, sanitization
|   |   |-- admin-ui-core.js # Navigation, dashboard, todos
|   |   |-- admin-ui-gestion.js  # Clients, instruments, locations
|   |   |-- admin-ui-boutique.js # Stock boutique, accessoires
|   |   |-- admin-ui-content.js  # Professeurs, galerie, blog
|   |   |-- admin-ui-config.js   # Configuration, export/import
|   |   |-- admin-ui-modals.js   # Modals CRUD
|   |   |-- admin-ui-compta.js   # Comptabilite, URSSAF
|   |   |-- gestion.js       # Logique metier (clients, instruments, etc.)
|   |   |-- gestion-pdf.js   # Generation de factures PDF
|   |   |-- gestion-boutique.js  # Gestion stock
|   |   |-- apprendre-admin.js   # Admin professeurs (page)
|   |   |-- boutique-admin.js    # Admin boutique (page)
|   |   |-- galerie-admin.js     # Admin galerie (page)
|   |   +-- blog-admin.js        # Admin blog (page)
|   |
|   |-- services/            # Integrations externes
|   |   |-- supabase-client.js   # Client Supabase
|   |   |-- supabase-auth.js     # Authentification Supabase
|   |   |-- supabase-sync.js     # Synchronisation temps reel
|   |   |-- email-client.js      # Client email (Brevo)
|   |   |-- payplug-client.js    # Paiement Payplug
|   |   +-- swikly-client.js     # Cautions Swikly
|   |
|   |-- data/                # Donnees statiques
|   |   |-- scales-data.js   # 65+ gammes musicales
|   |   +-- materiaux-data.js # Materiaux et proprietes
|   |
|   |-- features/            # Modules metier
|   |   |-- handpan-player.js    # Player SVG + Web Audio
|   |   |-- feasibility-module.js # Validation configurations
|   |   |-- upload.js            # Upload fichiers
|   |   |-- teacher-form.js      # Formulaire inscription prof
|   |   |-- honeypot.js          # Anti-spam honeypot
|   |   +-- mistral-stats.js     # Analytics anonymes
|   |
|   +-- pages/               # Logique specifique par page
|       +-- commander.js     # Formulaire commande + paiement
|
|-- php/
|   |-- upload.php           # Upload fichiers
|   +-- delete.php           # Suppression fichiers
|
|-- ressources/
|   |-- images/              # Photos, logos, assets
|   +-- audio/               # Samples FLAC (56 notes)
|
|-- netlify/functions/
|   |-- send-email.js        # Email Brevo SMTP
|   |-- payplug-create-payment.js  # Creation paiement
|   |-- payplug-webhook.js   # Webhook paiement
|   |-- swikly-create-deposit.js   # Creation caution
|   +-- swikly-webhook.js    # Webhook caution
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

### Backend
- **Database :** Supabase PostgreSQL avec RLS
- **Email :** Brevo SMTP via Netlify Functions
- **Hosting :** OVH Mutualise (support PHP)
- **Serverless :** Netlify Functions

### Anti-Spam
- **Honeypot** - Champ invisible (pas de reCAPTCHA, RGPD-friendly)

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
| Article | `article.html` | Template article dynamique |
| Admin | `admin.html` | Dashboard centralise |
| CGV | `cgv.html` | Conditions generales de vente |
| Mentions legales | `mentions-legales.html` | Obligations legales |

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

Le module `js/features/feasibility-module.js` verifie automatiquement si une configuration est realisable.

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

**Plage disponible :** E2 a F5 (56 samples)

---

## Systeme d'administration

### Architecture modulaire (v3.1)

| Module | Dossier | Responsabilite |
|--------|---------|----------------|
| `admin-core.js` | `js/admin/` | Auth, FAB, Modal, Toast, Storage, sanitization |
| `admin-ui-core.js` | `js/admin/` | Navigation, dashboard, todos |
| `admin-ui-gestion.js` | `js/admin/` | Clients, instruments, locations, commandes, factures |
| `admin-ui-boutique.js` | `js/admin/` | Stock boutique, accessoires |
| `admin-ui-content.js` | `js/admin/` | Professeurs, galerie, blog, analytics |
| `admin-ui-config.js` | `js/admin/` | Configuration, export/import, materiaux |
| `admin-ui-modals.js` | `js/admin/` | Tous les modals CRUD |
| `admin-ui-compta.js` | `js/admin/` | Comptabilite, URSSAF |
| `[page]-admin.js` | `js/admin/` | Integrations specifiques par page |

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
| `mistral_leaflet_consent` | Consentement carte RGPD |

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
| `accessoires` | Accessoires (nom, prix, quantite_stock) |
| `configuration` | Parametres (key/value pairs) |

### Securite RLS
- **Lecture publique :** Professeurs actifs, articles publies, instruments en ligne
- **Insertion publique :** Candidatures professeurs (statut pending)
- **CRUD authentifie :** Operations admin completes

---

## Configuration Supabase

### 1. Creer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com) et creez un compte
2. Cliquez sur "New Project" (region EU recommandee pour RGPD)
3. Notez le mot de passe de la base de donnees

### 2. Recuperer les identifiants API

Dans **Settings > API**, copiez :
- **Project URL** : `https://xxxxx.supabase.co`
- **anon public key** : `eyJhbGciOiJIUzI1NiIs...`

> La cle `anon` est concue pour etre exposee cote client. La securite vient des politiques RLS.

### 3. Configurer le projet local

```bash
cp js/core/config.example.js js/core/config.js
```

Editer `js/core/config.js` :
```javascript
window.MISTRAL_CONFIG = {
  SUPABASE_URL: 'https://votre-projet.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIs...'
};
```

> **Important** : Ne commitez JAMAIS `js/core/config.js` (il est dans .gitignore)

### 4. Creer un utilisateur admin

Dans Supabase > **Authentication > Users** > "Add User" :
- Email : `admin@votre-domaine.fr`
- Password : (mot de passe fort)
- Cochez "Auto Confirm User"

### 5. Depannage

| Erreur | Solution |
|--------|----------|
| "supabaseUrl is required" | `js/core/config.js` n'existe pas ou n'est pas charge |
| "Invalid login credentials" | Verifier l'utilisateur dans Supabase > Authentication |
| "Service d'authentification non disponible" | Verifier l'ordre des scripts dans admin.html |
| Erreurs CORS | Ajouter votre domaine dans Supabase > Settings > API |

---

## Roadmap

### Phase 1 : Securite - COMPLETE

- [x] Externaliser les identifiants Supabase (`window.MISTRAL_CONFIG`)
- [x] Corriger injection email header
- [x] Corriger vulnerabilites XSS (sanitizeHtml, escapeHtml)
- [x] Restreindre CORS sur endpoints PHP
- [x] Securiser tokens upload/delete
- [x] Banniere consentement cookies
- [x] Google Fonts conditionnel
- [x] Refactoriser admin-ui.js en 7 modules

### Phase 2 : Paiement et Email - EN COURS

- [x] Configurer Brevo et templates email
- [x] Creer module Payplug (client + webhook)
- [x] Creer module Swikly (client + webhook)
- [x] Integration formulaire paiement dans commander.html
- [x] Paiement acompte (300 EUR), solde, 3x sans frais
- [x] Protection anti-spam honeypot (tous formulaires)
- [ ] Auto-generation de facture sur paiement confirme
- [ ] Tests sandbox Payplug/Swikly
- [ ] Passage en production

### Phase 3 : A faire

- [ ] Audit complet CRUD admin panel
- [ ] Faire de Supabase la source de verite (pattern localStorage-first)
- [ ] Audit securite RLS (politiques granulaires)
- [ ] Ameliorer UX swipe boutique mobile
- [ ] Scale Batch System (voir section dediee)
- [ ] Migration auth admin vers Supabase Auth
- [ ] Optimisations performance (lazy loading, code splitting)
- [ ] Echelle z-index unifiee
- [ ] Indicateurs `:focus-visible` complets

### Variables d'environnement requises

```env
# Supabase (existant)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx

# Brevo (email) - CONFIGURE
BREVO_API_KEY=xxx

# Payplug - A CONFIGURER
PAYPLUG_SECRET_KEY=xxx

# Swikly - Utilise permalien
# Permalien: https://v2.swik.link/DxkC1UD
```

---

## Scale Batch System

> Specification technique pour le systeme de gestion des gammes par batch (developpement futur).

### Objectifs

1. Organiser 65+ gammes en batches pour le configurateur
2. Simplifier l'UX avec des selections curatees
3. Permettre le controle admin sur les gammes visibles
4. Preserver la logique de theorie musicale (dieses/bemols)

### Cinq categories de batch

| Batch | Nom | Description |
|-------|-----|-------------|
| `debutant` | Debutant | Gammes accessibles (toujours visible) |
| `mineur` | Mineur | Gammes mineures (Kurd, Celtic...) |
| `majeur` | Majeur | Gammes majeures (Sabye, Oxalis...) |
| `modal` | Modal | Gammes modales (Dorian, Phrygian...) |
| `ethnic` | Ethnique | Gammes du monde (Hijaz, Akebono...) |

### Tables Supabase prevues

**`gammes`** : nom, slug, pattern, mode, batch, nb_notes, notes_octave2, has_bottoms, note_variants (JSONB), ordre, visible, featured

**`gammes_batches`** : id, nom, description, ordre, couleur, icone, visible

### Pattern notation

```
[Ding]/[Note1]-[Note2]-[Note3]-...-[NoteN]_
```
Exemple Kurd 9 : `D/-A-Bb-C-D-E-F-G-A_`

### Phases d'implementation

1. **Database** : Creer tables + RLS + seed data
2. **Migration** : Parser les 65 gammes de `scales-data.js` vers Supabase
3. **Admin** : Onglet "Gammes" dans admin (CRUD + batch manager)
4. **Configurateur** : Chips de batch + filtrage dans boutique.html
5. **Extended** : Note variants pour gammes >9 notes

---

## Deploiement

### Hebergement
- OVH Mutualise (domaine + hebergement)
- Site statique avec scripts PHP pour uploads
- SSL/TLS inclus

### Checklist pre-production

- [ ] Changer mot de passe admin par defaut
- [ ] Configurer cles Payplug (PAYPLUG_SECRET_KEY)
- [ ] Verifier encodage UTF-8
- [ ] Optimiser images (WebP)
- [ ] Tester sur vrais appareils mobiles
- [ ] Configurer email (contact@mistralpans.fr)
- [x] Creer pages legales (mentions, CGV)
- [x] Configurer banniere consentement cookies
- [x] Externaliser identifiants Supabase
- [x] Securiser endpoints PHP (CORS, tokens)
- [x] Anti-spam honeypot (tous formulaires)

### Services externes

| Service | Usage | RGPD |
|---------|-------|------|
| Supabase | Database, Auth | Hebergement EU disponible |
| Brevo | Email | Conforme RGPD |
| Nominatim | Geocodage | Pas de tracking |
| CartoDB | Tuiles carte | Consentement requis (banniere) |
| Google Fonts | Typographies | Chargement conditionnel |
| Swikly | Cautions location | Conforme RGPD |
| Payplug | Paiements | Fournisseur francais, conforme RGPD |

---

## Historique des versions

### v3.3 (6 Fevrier 2026)
- **Structure :** Reorganisation du dossier `js/` en sous-dossiers thematiques (core, admin, services, data, features, pages)
- **Documentation :** Consolidation de 7 fichiers markdown en 2 (README.md + CLAUDE.md)
- **Nettoyage :** Suppression image dupliquee

### v3.2 (4 Fevrier 2026)
- **Ventes :** Workflow de vente integre (instrument -> facture -> statut vendu)
- **Factures :** Ajout automatique d'instrument avec `addFactureLigneFromInstrument()`
- **Statuts :** Systeme de validation des transitions de statut instruments
- **Synchronisation :** Les instruments lies sont automatiquement marques "vendu" au paiement
- **Supabase :** Ajout sync des professeurs en attente

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

### v2.5 (Janvier 2025)
- Systeme de faisabilite des configurations
- Nouvelle tarification : 115 EUR/note + malus
- Navigation swipe mobile

### v2.4 (Janvier 2025)
- Suppression build Node.js
- Chargement dynamique des partials

### v2.3 (Janvier 2025)
- FAB admin sur toutes les pages
- Geocodage automatique (Nominatim)

### v2.2 (Janvier 2025)
- Systeme admin centralise
- Editeur WYSIWYG Quill.js

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

*Documentation mise a jour le 6 fevrier 2026 (v3.3)*
