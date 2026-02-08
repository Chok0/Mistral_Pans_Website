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
|   |-- admin.css            # Styles admin (FAB, modals, dashboard, gestion)
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
- **Hosting :** Netlify (site) + OVH (domaine)
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
- [x] Migrer uploads de PHP vers Supabase Storage
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

## Optimisation des images

> Les images du dossier `ressources/images/` totalisent ~26 MB. Une optimisation peut reduire ce poids a ~5 MB (80% de gain).

### Etat actuel

| Fichier | Taille | Dimensions | Priorite |
|---------|--------|-----------|----------|
| DAmara ember.png | 7.1 MB | 3024x3024 | CRITIQUE |
| AMARA.png | 5.9 MB | 2344x2328 | CRITIQUE |
| 20240225_112013.jpg | 4.9 MB | 4032x3024 | HAUTE |
| 20230801_1622372.jpg | 4.6 MB | 4032x3024 | HAUTE |
| 20240315_162320.jpg | 3.4 MB | 3984x1920 | HAUTE |
| Mistral_logov3_ball_black.png | 135 KB | 3119x3119 | MOYENNE |
| Autres (PNG/SVG) | < 80 KB | OK | BASSE |

### Actions recommandees

**Photos JPG (3 fichiers, 13 MB) :**
- Redimensionner a 2048px max (largeur)
- Re-encoder en JPEG qualite 75-80
- Supprimer metadonnees EXIF (contiennent potentiellement des coordonnees GPS)
- Resultat estime : ~1 MB par fichier

**Images produit PNG (2 fichiers, 13 MB) :**
- Convertir en WebP (lossy qualite 75-80)
- Reduire dimensions : 3024px -> 1500px, 2344px -> 1200px
- Resultat estime : ~800 KB par fichier

**Logo PNG (135 KB) :**
- Reduire a ~500px
- Convertir en WebP
- Resultat estime : ~30 KB

### Commandes d'optimisation

```bash
# Prerequis : installer ImageMagick et cwebp
# sudo apt install imagemagick webp

# Convertir PNG en WebP
cwebp -q 80 "AMARA.png" -o "AMARA.webp"
cwebp -q 80 "DAmara ember.png" -o "DAmara_ember.webp"

# Redimensionner et compresser JPG
convert "20240225_112013.jpg" -resize 2048x -quality 75 -strip "20240225_112013_opt.jpg"
convert "20230801_1622372.jpg" -resize 2048x -quality 75 -strip "20230801_1622372_opt.jpg"
convert "20240315_162320.jpg" -resize 2048x -quality 75 -strip "20240315_162320_opt.jpg"
```

### Fallback navigateur

Pour les formats WebP, utiliser l'element `<picture>` :
```html
<picture>
  <source srcset="ressources/images/AMARA.webp" type="image/webp">
  <img src="ressources/images/AMARA.png" alt="Handpan Amara">
</picture>
```

---

## Deploiement

### Hebergement
- OVH Mutualise (domaine + hebergement)
- Site statique avec uploads via Supabase Storage
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
- [x] Migrer uploads vers Supabase Storage (suppression PHP)
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

## Audit de securite

> Audit complet de l'integration paiement (PayPlug, Swikly) et de la securite generale du projet.
> Derniere revue : 6 fevrier 2026.

### Tableau de synthese

| # | Severite | Zone | Probleme | Statut |
|---|----------|------|----------|--------|
| 1 | **CRITIQUE** | Netlify Functions | CORS `Access-Control-Allow-Origin: *` sur endpoints paiement et email | A corriger |
| 2 | **CRITIQUE** | Swikly webhook | Verification de signature non implementee (TODO dans le code) | A corriger |
| 3 | **HAUTE** | commander.js | XSS via `innerHTML` dans `showPaymentSuccess()` avec donnees URL/localStorage | A corriger |
| 4 | **HAUTE** | Netlify Functions | Pas de rate limiting sur creation de paiement | A corriger |
| 5 | **HAUTE** | PayPlug webhook | Pas de protection contre les doublons (idempotence) | A corriger |
| 6 | **HAUTE** | Swikly webhook | Donnees non verifiees utilisees pour mettre a jour Supabase | A corriger |
| 7 | **MOYENNE** | Admin auth | Pas de rate limiting sur les tentatives de connexion | A corriger |
| 8 | **MOYENNE** | Admin auth | Token de session genere avec `Math.random()` (non cryptographique) | A corriger |
| 9 | ~~MOYENNE~~ | ~~PHP endpoints~~ | ~~Hash admin par defaut~~ — **OBSOLETE** : endpoints PHP supprimes, uploads via Supabase Storage | Resolu |
| 10 | **MOYENNE** | Netlify Functions | Messages d'erreur internes exposes au client (`error.message`) | A corriger |
| 11 | **MOYENNE** | Swikly create | Spread `...metadata` non filtre dans le payload | A corriger |
| 12 | **FAIBLE** | commander.html | Pas de Content-Security-Policy (CSP) header | Recommande |
| 13 | **FAIBLE** | Integrated Payment | Securite partagee avec PayPlug (integrite de la page requise) | Risque accepte |
| 14 | **INFO** | Admin auth | Credentials stockes en localStorage (pas de session serveur) | Architecture |
| 15 | **INFO** | Admin auth | Fallback `simpleHash()` faible (DJB hash) si SubtleCrypto absent | Architecture |

---

### #1 CRITIQUE — CORS ouvert sur Netlify Functions

**Fichiers :** `payplug-create-payment.js`, `send-email.js`, `swikly-create-deposit.js`

**Probleme :** Les endpoints utilisent `Access-Control-Allow-Origin: *`, ce qui permet a n'importe quel site web d'appeler ces fonctions. Un attaquant pourrait :
- Creer des paiements PayPlug depuis un site tiers
- Envoyer des emails via Brevo en usurpant le formulaire de contact
- Declencher des cautions Swikly avec des donnees forgees

**Note :** Les anciens fichiers PHP d'upload ont ete remplaces par Supabase Storage (authentification via Supabase Auth).

**Correction recommandee :**
```javascript
// Remplacer Access-Control-Allow-Origin: * par :
const allowedOrigins = [
  'https://mistralpans.fr',
  'https://www.mistralpans.fr'
];
const origin = event.headers.origin || event.headers.Origin;
const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': corsOrigin,
  'Access-Control-Allow-Headers': 'Content-Type'
};
```

---

### #2 CRITIQUE — Swikly webhook sans verification de signature

**Fichier :** `swikly-webhook.js:63-65`

**Probleme :** Le code lit le header `x-swikly-signature` mais ne le verifie jamais (`TODO` dans le code). N'importe qui peut envoyer un POST a l'endpoint et declencher :
- Des mises a jour en base de donnees (cautions, locations)
- Des envois d'emails de confirmation
- Des changements de statut de location vers "active"

**Impact :** Un attaquant connaissant l'URL du webhook pourrait activer des locations sans caution reelle.

**Correction :** Implementer la verification HMAC selon la documentation Swikly, ou a minima, faire un GET de verification aupres de l'API Swikly (meme approche que PayPlug).

---

### #3 HAUTE — XSS dans showPaymentSuccess()

**Fichier :** `commander.js:498`

**Probleme :** La fonction utilise `container.innerHTML` avec des variables interpolees :
```javascript
container.innerHTML = `
  <p><strong>Référence :</strong> ${reference || 'N/A'}</p>
  <p><strong>Instrument :</strong> ${pendingOrder.product?.productName || '...'}</p>
`;
```

Les variables `reference` (depuis `urlParams.get('ref')`) et `productName` (depuis `localStorage`) ne sont pas echappees. Un attaquant peut :
- Crafter une URL avec `?status=success&ref=<script>alert(1)</script>`
- Manipuler `localStorage` pour injecter du HTML malveillant

**Correction :** Utiliser `textContent` ou une fonction d'echappement HTML.

---

### #4 HAUTE — Pas de rate limiting sur creation de paiement

**Fichier :** `payplug-create-payment.js`

**Probleme :** Aucune protection contre l'abus. Un attaquant peut :
- Creer des centaines de paiements PayPlug (consommation API, risque de blocage du compte)
- Surcharger la Netlify Function (limites du plan)
- Generer du spam si combine avec l'endpoint email

**Correction recommandee :**
- Activer le rate limiting Netlify (si disponible sur le plan)
- Implementer un token CSRF ou un token jetable cote client
- Ajouter un delai minimum entre deux creations (ex: via Supabase)

---

### #5 HAUTE — Pas d'idempotence sur le webhook PayPlug

**Fichier :** `payplug-webhook.js`

**Probleme :** Si PayPlug envoie la meme notification deux fois (retry reseau), le paiement est enregistre deux fois dans Supabase et deux emails de confirmation sont envoyes.

**Correction :** Verifier si `payplug_id` existe deja dans la table `paiements` avant d'inserer. Utiliser un `upsert` avec `payplug_id` comme cle unique.

---

### #6 HAUTE — Swikly webhook : donnees non verifiees en base

**Fichier :** `swikly-webhook.js:242-256`

**Probleme :** Sans verification de signature (#2), les donnees du webhook sont directement utilisees pour mettre a jour Supabase :
```javascript
// metadata.rental_id vient du payload non verifie
await fetch(`${SUPABASE_URL}/rest/v1/locations?id=eq.${metadata.rental_id}`, {
  method: 'PATCH', ...
});
```

Un attaquant pourrait envoyer un payload forge avec un `rental_id` arbitraire pour changer le statut de n'importe quelle location en "active".

**Correction :** Implementer la verification de signature (#2) ET valider les donnees via un GET a l'API Swikly.

---

### #7 MOYENNE — Pas de rate limiting sur connexion admin

**Fichier :** `admin-core.js` (fonction `Auth.login()`)

**Probleme :** Aucune limite sur les tentatives de connexion. Un attaquant peut bruteforcer le mot de passe admin.

**Correction :**
- Compteur d'echecs avec verrouillage temporaire (ex: 5 tentatives → blocage 5 min)
- Stocker le compteur dans `localStorage` ou `sessionStorage`

---

### #8 MOYENNE — Token de session non cryptographique

**Fichier :** `admin-core.js`

**Probleme :** Le token de session est genere avec `Math.random().toString(36)` qui n'est pas cryptographiquement sur.

**Correction :** Utiliser `crypto.getRandomValues()` :
```javascript
const array = new Uint8Array(32);
crypto.getRandomValues(array);
const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
```

---

### #9 ~~MOYENNE~~ OBSOLETE — Hash admin par defaut dans le code source

**Fichiers :** ~~`php/upload.php`, `php/delete.php`~~ — **supprimes**

**Resolution :** Les endpoints PHP d'upload/delete ont ete entierement remplaces par Supabase Storage. L'authentification passe desormais par Supabase Auth (JWT). Ce point de securite n'est plus applicable.

---

### #10 MOYENNE — Messages d'erreur internes exposes

**Fichiers :** `payplug-create-payment.js:305`, `payplug-webhook.js:225`, `swikly-webhook.js:187`

**Probleme :** `error.message` est retourne au client dans les reponses d'erreur. Cela peut reveler des details d'implementation (noms de tables, URLs internes, stack traces).

**Correction :** Retourner un message generique au client et logger les details cote serveur uniquement.

---

### #11 MOYENNE — Spread de metadata non filtre

**Fichier :** `swikly-create-deposit.js:139`

**Probleme :**
```javascript
metadata: {
  rental_reference: reference,
  instrument_name: instrumentName,
  ...metadata  // <-- untrusted user input
}
```

L'operateur spread peut ecraser les champs `rental_reference` et `instrument_name` si l'utilisateur envoie des metadata avec les memes cles.

**Correction :** Placer le spread AVANT les champs explicites, ou filtrer les cles autorisees.

---

### #12 FAIBLE — Pas de Content-Security-Policy

**Fichier :** `commander.html`

**Probleme :** Aucun header CSP n'est defini. Le SDK PayPlug charge des iframes depuis `cdn.payplug.com`. Sans CSP, des scripts tiers injectes (via XSS ou extension malveillante) pourraient intercepter les interactions de paiement.

**Recommandation :** Ajouter un meta tag ou header CSP :
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://cdn.payplug.com 'unsafe-inline';
  frame-src https://*.payplug.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://*.payplug.com data:;
  connect-src 'self' https://*.supabase.co https://api.brevo.com;
">
```

---

### #13 FAIBLE — Securite partagee (Integrated Payment)

**Probleme :** En mode Integrated Payment, PayPlug documente que la securite est "partagee" :
- Les champs de carte sont des iframes PayPlug (card data isolee)
- Mais l'integrite de la page hote est de la responsabilite du marchand
- Si la page est compromise (XSS), un attaquant pourrait superposer de faux champs

**Mitigation en place :** Fallback automatique vers le mode hosted si le SDK ne charge pas.

**Recommandation :** Resoudre #3 (XSS) et #12 (CSP) pour reduire ce risque.

---

### Ce qui est bien fait (points positifs)

| Element | Detail |
|---------|--------|
| Webhook PayPlug : GET de verification | Le webhook ne fait pas confiance au payload, il GET les details aupres de l'API PayPlug |
| Sanitization des inputs PayPlug | `sanitize()`, `cleanObject()`, validation email, limites de longueur |
| Email : echappement HTML | `escapeHtml()` et `sanitizeEmailHeader()` dans `send-email.js` |
| Supabase Storage : auth RLS | Les uploads passent par Supabase Auth avec policies admin-only |
| Anti-spam : honeypot | Pas de reCAPTCHA (RGPD-friendly), champ invisible |
| PayPlug : cle secrete cote serveur | La cle `PAYPLUG_SECRET_KEY` n'est jamais exposee au client |
| Admin : SHA-256 avec sel | Hash de mot de passe via `SubtleCrypto` avec sel |
| Admin : expiration de session | Session de 24h avec verification a chaque acces |
| Integrated Payment : mode test configurable | `testMode: false` avec commentaire pour basculer |
| Integrated Payment : fallback hosted | Si le SDK ne charge pas, retour transparent au mode heberge |

---

### Checklist de correction (par priorite)

**Avant mise en production :**

- [ ] #1 Restreindre CORS sur toutes les Netlify Functions (whitelist de domaines)
- [ ] #2 Implementer la verification de signature Swikly (ou GET de verification)
- [ ] #3 Corriger le XSS dans `showPaymentSuccess()` (echapper les variables)
- [ ] #4 Ajouter un rate limiting ou token CSRF sur la creation de paiement
- [ ] #5 Ajouter l'idempotence sur le webhook PayPlug (upsert sur `payplug_id`)
- [ ] #6 Valider les donnees Swikly webhook avant mise a jour en base
- [x] #9 ~~Supprimer le hash admin par defaut dans le code PHP~~ — OBSOLETE (PHP supprime, uploads via Supabase Storage)

**Ameliorations recommandees :**

- [ ] #7 Rate limiting sur la connexion admin
- [ ] #8 Token de session cryptographique
- [ ] #10 Masquer les messages d'erreur internes
- [ ] #11 Filtrer le spread de metadata Swikly
- [ ] #12 Ajouter un header Content-Security-Policy

---

*Documentation mise a jour le 6 fevrier 2026 (v3.3)*
