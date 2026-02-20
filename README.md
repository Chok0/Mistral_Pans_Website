# Mistral Pans - Site Web

Site web premium pour Mistral Pans, fabricant artisanal de handpans en Ile-de-France.

> **Version :** 3.5 — Fevrier 2026
> **Stack :** Vanilla JS (ES6+) + HTML/CSS + Supabase + Netlify Functions
> **Pas de build system** — serveur statique avec chargement dynamique des composants

---

## Table des matieres

1. [Quick Start](#quick-start)
2. [Architecture generale](#architecture-generale)
3. [Structure du projet](#structure-du-projet)
4. [Stack technique](#stack-technique)
5. [Design System](#design-system)
6. [Pages du site](#pages-du-site)
7. [Systeme de donnees](#systeme-de-donnees)
8. [Systeme d'administration](#systeme-dadministration)
9. [Systeme de tarification](#systeme-de-tarification)
10. [Systeme de faisabilite](#systeme-de-faisabilite)
11. [Systeme audio](#systeme-audio)
12. [Base de donnees Supabase](#base-de-donnees-supabase)
13. [Configuration initiale](#configuration-initiale)
14. [Deploiement](#deploiement)
15. [Securite](#securite)
16. [Roadmap](#roadmap)
17. [Historique des versions](#historique-des-versions)

---

## Quick Start

**Important** : Le site utilise `fetch()` pour charger les partials. Il **ne fonctionnera pas** en ouvrant directement les fichiers HTML (`file://`).

```bash
# Option 1 : Python (recommande)
python -m http.server 8000

# Option 2 : Node.js
npx serve .

# Option 3 : VS Code + extension Live Server
# Clic droit sur index.html > "Open with Live Server"
```

Puis ouvrir http://localhost:8000

### Prerequis

- Un navigateur moderne (Chrome, Firefox, Safari, Edge)
- Python 3.x ou Node.js (pour le serveur local)
- Un projet Supabase (voir [Configuration initiale](#configuration-initiale))
- `js/core/config.js` avec les cles Supabase (copier depuis `config.example.js`)

---

## Architecture generale

### Principes

Le site est **statique-first, progressivement enrichi** :

1. **Pas de build system** — les fichiers sont servis directement, pas de webpack/vite/rollup
2. **Vanilla JS (ES6+)** — pas de React/Vue/Angular, tout est en JavaScript natif
3. **Modules IIFE** — chaque fichier JS s'encapsule dans `(function(window) { ... })(window)` et exporte sur `window.NomDuModule`
4. **Partials dynamiques** — header, footer et modal contact sont charges via `fetch()` au chargement de chaque page
5. **Supabase backend** — PostgreSQL + Auth + Storage, pas de serveur custom
6. **RGPD-first** — minimum de dependances externes, consentement explicite pour cartes et fonts

### Flux de donnees

```
Navigateur
  |
  |-- fetch() --> partials/ (header.html, footer.html, contact-modal.html)
  |-- fetch() --> Supabase (donnees metier via supabase-sync.js)
  |                   |
  |                   v
  |              MistralSync (Map en memoire = source de verite cote client)
  |
  |-- Netlify Functions --> Brevo (emails)
  |                     --> PayPlug (paiements)
  |                     --> Swikly (cautions)
```

### Chargement des scripts

`js/core/main.js` est le point d'entree de toutes les pages. Il :
1. Charge les partials (header, footer, contact modal)
2. Definit la page active via `data-page` sur `<body>`
3. Charge dynamiquement `config.js`, `supabase-client.js`, `supabase-sync.js`
4. Dispatch l'evenement `mistral-sync-complete` quand les donnees Supabase sont pretes

**Important** : Si tu reorganises les fichiers JS, mets a jour les chemins dans `main.js`.

---

## Structure du projet

```
/
|-- *.html                    # Pages principales (racine)
|-- partials/                 # Composants reutilisables (charges via fetch)
|   |-- header.html          # Navigation principale
|   |-- footer.html          # Pied de page complet
|   |-- footer-minimal.html  # Pied de page simplifie (commander.html)
|   +-- contact-modal.html   # Modal de contact reutilisable
|
|-- css/
|   |-- style.css            # Design system global (couleurs, typo, layout)
|   |-- boutique.css         # Configurateur + stock (scope: data-page="boutique")
|   |-- admin.css            # Styles admin (dashboard, nav, modals, tables)
|   +-- teacher-form.css     # Formulaire inscription professeur
|
|-- js/
|   |-- core/                # Bootstrap, navigation, configuration
|   |   |-- main.js          # Point d'entree : partials, nav, chargement Supabase
|   |   |-- config.js        # Cles Supabase (GITIGNORE — ne jamais commiter)
|   |   |-- config.example.js # Template a copier vers config.js
|   |   +-- cookie-consent.js # Banniere RGPD cookies
|   |
|   |-- admin/               # Systeme d'administration (admin.html)
|   |   |-- admin-core.js    # Auth, Modal, Toast, Confirm, Storage, CRUD helpers
|   |   |-- admin-ui-core.js # Navigation admin, dashboard, todos, helpers partages
|   |   |-- admin-ui-gestion.js  # Rendu : clients, instruments, locations, commandes, factures
|   |   |-- admin-ui-boutique.js # Rendu : stock vitrine, accessoires
|   |   |-- admin-ui-content.js  # Rendu : professeurs, galerie, blog, analytics
|   |   |-- admin-ui-config.js   # Rendu : config, materiaux, gammes, tailles, emails auto
|   |   |-- admin-ui-modals.js   # Tous les modals CRUD (client, instrument, facture, etc.)
|   |   |-- admin-ui-compta.js   # Comptabilite, rapports URSSAF
|   |   |-- gestion.js       # Logique metier (CRUD clients, instruments, commandes, etc.)
|   |   |-- gestion-pdf.js   # Generation de factures PDF (jsPDF)
|   |   |-- gestion-boutique.js  # Gestion stock en ligne
|   |   |-- apprendre-admin.js   # Admin professeurs (sur apprendre.html)
|   |   |-- boutique-admin.js    # Admin boutique (sur boutique.html)
|   |   |-- galerie-admin.js     # Admin galerie (sur galerie.html)
|   |   +-- blog-admin.js        # Admin blog (sur blog.html)
|   |
|   |-- services/            # Integrations externes
|   |   |-- supabase-client.js   # Initialisation client Supabase
|   |   |-- supabase-auth.js     # MistralAuth : login, logout, session Supabase
|   |   |-- supabase-sync.js     # MistralSync : sync Supabase <-> Map en memoire
|   |   |-- email-client.js      # Client email (Brevo via Netlify Functions)
|   |   |-- payplug-client.js    # Client paiement PayPlug
|   |   +-- swikly-client.js     # Client caution Swikly
|   |
|   |-- data/                # Donnees statiques / modules de configuration
|   |   |-- scales-data.js   # Theorie musicale (modes, intervalles, notes)
|   |   |-- gammes-data.js   # Gammes du configurateur (in-memory, CRUD admin)
|   |   |-- tailles-data.js  # Tailles et faisabilite (MistralSync/Supabase, CRUD admin)
|   |   +-- materiaux-data.js # Materiaux et proprietes (in-memory, CRUD admin)
|   |
|   |-- features/            # Modules metier reutilisables
|   |   |-- handpan-player.js    # Player SVG interactif + Web Audio API
|   |   |-- feasibility-module.js # Calcul de faisabilite des configurations
|   |   |-- upload.js            # Upload fichiers vers Supabase Storage
|   |   |-- teacher-form.js      # Formulaire inscription professeur
|   |   |-- honeypot.js          # Anti-spam : champ invisible (pas de reCAPTCHA)
|   |   +-- mistral-stats.js     # Analytics anonymes (localStorage, pas de tracking)
|   |
|   |-- pages/               # Logique specifique par page
|   |   |-- boutique.js      # Configurateur + stock + calcul prix
|   |   +-- commander.js     # Formulaire commande + integration PayPlug
|   |
|   +-- vendor/              # Librairies tierces auto-hebergees
|       |-- supabase/        # Supabase JS SDK v2.95.3
|       |-- leaflet/         # Leaflet v1.9.4 (cartes)
|       |-- chart/           # Chart.js v4.5.1 (graphiques admin)
|       |-- quill/           # Quill.js v1.3.7 (editeur WYSIWYG blog)
|       +-- versions.json    # Versions installees (utilise par update-vendor.sh)
|
|-- ressources/
|   |-- images/              # Photos produit, logos, assets visuels
|   +-- audio/               # Samples FLAC (56 notes, E2 a F5)
|
|-- netlify/functions/       # Fonctions serverless (Netlify)
|   |-- send-email.js        # Envoi email via Brevo SMTP
|   |-- teacher-signup.js    # Inscription professeur (rate-limit fail-closed, honeypot, validation)
|   |-- payplug-create-payment.js  # Creation paiement PayPlug
|   |-- payplug-webhook.js   # Webhook paiement (notification asynchrone)
|   |-- swikly-create-deposit.js   # Creation caution Swikly
|   |-- swikly-webhook.js    # Webhook caution
|   +-- order-status.js      # API suivi commande (reference + email)
|
|-- scripts/
|   +-- update-vendor.sh     # Verification et MAJ des librairies vendor
|
|-- netlify.toml              # Config Netlify (build, headers securite, CSP, cache)
|-- CLAUDE.md                 # Guide pour assistants IA (instructions codebase)
+-- README.md                 # Ce fichier (documentation complete du projet)
```

---

## Stack technique

### Frontend

| Technologie | Usage |
|-------------|-------|
| Vanilla JS (ES6+) | Toute la logique client |
| HTML5 | Pages semantiques, `data-*` attributes |
| CSS3 | Custom properties, mobile-first, BEM-like |
| Fraunces | Typographie titres (display serif) |
| Inter | Typographie corps (sans-serif) |
| JetBrains Mono | Typographie code (monospace) |

### Librairies (auto-hebergees dans `js/vendor/`)

| Librairie | Version | Usage |
|-----------|---------|-------|
| Supabase JS SDK | 2.95.3 | Base de donnees, authentification |
| Leaflet | 1.9.4 | Cartes interactives (page Apprendre) |
| Chart.js | 4.5.1 | Graphiques analytics (dashboard admin) |
| Quill.js | 1.3.7 | Editeur WYSIWYG (blog admin) |

> **Mise a jour** : Lancer `./scripts/update-vendor.sh` pour verifier les mises a jour.
> Lancer `./scripts/update-vendor.sh --install` pour installer.
> Le dashboard admin affiche aussi un indicateur quand des MAJ sont disponibles.

### Seule dependance CDN externe

| Librairie | Raison |
|-----------|--------|
| PayPlug SDK (`cdn.payplug.com`) | Obligation PCI-DSS : le SDK de paiement doit etre servi par le prestataire |

### Backend / Services

| Service | Usage | RGPD |
|---------|-------|------|
| Supabase | Database PostgreSQL, Auth, Storage | Hebergement EU disponible |
| Netlify | Hosting statique + Functions serverless | CDN global |
| OVH | Domaine `mistralpans.fr` | Francais |
| Brevo | Envoi email SMTP | Conforme RGPD |
| PayPlug | Paiements en ligne | Fournisseur francais |
| Swikly | Cautions locations | Conforme RGPD |
| Nominatim | Geocodage adresses (professeurs) | Pas de tracking |
| CartoDB Positron | Tuiles carte (Leaflet) | Consentement requis |

### Anti-Spam

Le site utilise un systeme **honeypot** (champ de formulaire invisible) au lieu de reCAPTCHA. Avantage : zero dependance externe, conforme RGPD, aucun cookie tiers.

---

## Design System

### Couleurs principales

| Variable CSS | Valeur | Usage |
|-------------|--------|-------|
| `--color-accent` | `#0D7377` | Accent principal (teal) |
| `--color-bg` | `#FDFBF7` | Fond clair (creme chaud) |
| `--color-bg-dark` | `#1A1815` | Fond sombre |
| `--color-text` | `#2C2825` | Texte principal (brun fonce) |
| `--color-success` | `#4A7C59` | Validation (vert sauge) |
| `--color-warning` | `#F59E0B` | Avertissement (ambre) |
| `--color-error` | `#EF4444` | Erreur (rouge) |

> **Boutique** : La page boutique surcharge `--color-bg` a `#FAFAFA` (gris clair) via `body[data-page="boutique"]`.

### Breakpoints responsive

| Taille | Cible | Description |
|--------|-------|-------------|
| `> 1024px` | Desktop | Layout multi-colonnes complet |
| `768px - 1024px` | Tablette | Layout adapte |
| `500px - 768px` | Mobile large | Colonne unique, nav hamburger |
| `< 500px` | Mobile | Affichage minimal, tout empile |

### Conventions CSS

- **Mobile-first** : les styles de base ciblent le mobile, les media queries ajoutent pour le desktop
- **BEM-like** : `.composant__element--modificateur` (ex: `.admin-btn--primary`)
- **Prefix admin** : toutes les classes admin commencent par `admin-` ou sont dans un scope admin
- **Custom properties** : utiliser les variables CSS pour les couleurs, jamais de valeurs hardcodees

---

## Pages du site

| Page | Fichier | Description | JS specifique |
|------|---------|-------------|---------------|
| Accueil | `index.html` | Hero, presentation, partenaires | — |
| Boutique | `boutique.html` | Configurateur SVG + stock en ligne | `js/pages/boutique.js` |
| Commander | `commander.html` | Formulaire commande + paiement PayPlug | `js/pages/commander.js` |
| Location | `location.html` | Service location, FAQ, caution Swikly | — |
| Apprendre | `apprendre.html` | Carte Leaflet + annuaire professeurs IDF | `js/features/teacher-form.js` |
| Galerie | `galerie.html` | Mosaique responsive + lightbox | — |
| Blog | `blog.html` | Liste des articles | — |
| Article | `article.html` | Template article dynamique (charge via slug) | — |
| Suivi | `suivi.html` | Suivi commande client (reference + email) | — |
| Admin | `admin.html` | Panneau d'administration complet | `js/admin/*` |
| CGV | `cgv.html` | Conditions generales de vente | — |
| Mentions | `mentions-legales.html` | Mentions legales | — |
| Credits | `credits.html` | Credits open source et remerciements | — |

### Template de page standard

Chaque page suit ce pattern :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Titre | Mistral Pans</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body data-page="nom-page">
  <div id="site-header"></div>

  <main id="main-content">
    <!-- Contenu de la page -->
  </main>

  <div id="site-footer"></div>
  <div id="contact-modal-container"></div>

  <script src="js/core/cookie-consent.js"></script>
  <script src="js/core/main.js"></script>
  <script src="js/features/mistral-stats.js"></script>
</body>
</html>
```

**Points cles :**
- `data-page="nom-page"` sur `<body>` permet de styler la page et d'activer le lien nav
- `<div id="site-header">` et `<div id="site-footer">` sont remplis dynamiquement par `main.js`
- Pour un footer minimal (ex: page de paiement) : `<body data-footer="minimal">`

---

## Systeme de donnees

### Architecture : MistralSync (in-memory)

**IMPORTANT** : Les donnees metier ne sont PAS dans `localStorage`. Elles sont dans une `Map` JavaScript en memoire, geree par `MistralSync` (`js/services/supabase-sync.js`).

Le flux est :
1. Au chargement, `supabase-sync.js` fetch les donnees depuis Supabase
2. Les donnees sont stockees dans une `Map` en memoire
3. Les modifications passent par `MistralSync.setData()` qui met a jour la Map ET push vers Supabase
4. L'evenement `mistral-sync-complete` est dispatch quand le premier fetch est termine
5. L'evenement `mistral-data-change` est dispatch a chaque modification

### Donnees MistralSync (Map en memoire + Supabase)

| Cle en memoire | Table Supabase | Type | Contenu |
|----------------|---------------|------|---------|
| `mistral_gestion_clients` | `clients` | Array | Fiches clients |
| `mistral_gestion_instruments` | `instruments` | Array | Inventaire instruments |
| `mistral_gestion_locations` | `locations` | Array | Contrats de location |
| `mistral_gestion_commandes` | `commandes` | Array | Commandes clients |
| `mistral_gestion_factures` | `factures` | Array | Factures (soft-delete, pas de suppression) |
| `mistral_teachers` | `professeurs` (statut='active') | Array | Professeurs valides |
| `mistral_pending_teachers` | `professeurs` (statut='pending') | Array | Demandes en attente |
| `mistral_gallery` | `galerie` | Array | Medias galerie |
| `mistral_blog_articles` | `articles` | Array | Articles blog |
| `mistral_accessoires` | `accessoires` | Array | Accessoires boutique |
| `mistral_tailles` | `tailles` | Array | Configurations tailles (45/50/53cm) avec donnees faisabilite |
| `mistral_gestion_config` | `configuration` (namespace='gestion') | Object | Config metier (tarifs, compteur factures) |
| `mistral_compta_config` | `configuration` (namespace='compta') | Object | Config comptabilite |
| `mistral_email_automations` | `configuration` (namespace='email_automations') | Object | Config emails automatiques |

### Donnees localStorage (preferences client uniquement)

| Cle | Usage |
|-----|-------|
| `mistral_cookie_consent` | Preferences consentement cookies RGPD |
| `mistral_leaflet_consent` | Consentement carte Leaflet |
| `mistral_stats_anonymous` | Compteurs de pages vues anonymes |

### Donnees in-memory uniquement (pas de persistence)

| Module | Contenu |
|--------|---------|
| `MistralMateriaux` | Specifications materiaux (NS, ES, SS) — defaults hardcodes |
| `MistralGammes` | Configurations des gammes musicales — defaults hardcodes |

### Suppression de donnees

Les suppressions appellent `MistralSync.deleteFromSupabase()` pour supprimer aussi cote serveur. **Exception** : les factures ne sont jamais supprimees (loi francaise, retention 10 ans). On utilise `Factures.annuler()` qui fait un soft-delete (statut = 'annulee').

---

## Systeme d'administration

### Acces

- **URL** : `/admin.html`
- **Auth** : Supabase Auth (email + mot de passe)
- **Gestion comptes** : Supabase Dashboard > Authentication > Users

### Navigation (v3.5)

Le panneau admin est organise en 3 groupes thematiques avec le **dashboard comme vue par defaut** :

```
[Tableau de bord]  ← vue par defaut, se masque quand on clique un onglet

GESTION    Commandes●  Instruments  Clients  Locations●  Factures
CONTENU    Vitrine  Galerie  Blog  Professeurs●
OUTILS     Comptabilite  Config
```

- **Tableau de bord** : stats business, actions en attente, todo list, analytics du site, librairies vendor
- **Commandes** : commandes clients, suivi statut et paiement
- **Instruments** : inventaire complet, statuts (disponible/en fabrication/vendu/loue)
- **Clients** : fiches clients, credit fidelite
- **Locations** : contrats de location actifs et termines
- **Factures** : facturation, generation PDF (soft-delete uniquement)
- **Vitrine** : instruments publies en ligne + accessoires + annonces flash
- **Galerie** : medias (photos/videos), classement, featured
- **Blog** : articles, editeur WYSIWYG Quill.js
- **Professeurs** : demandes en attente + professeurs valides
- **Comptabilite** : rapports URSSAF mensuels, CA BIC/BNC
- **Config** : infos entreprise, tarifs location, tarification configurateur, materiaux, gammes, tailles, emails automatiques, export/import

> **Note** : "Vitrine" dans l'admin = gestion du stock en ligne. C'est le meme contenu que la page publique `boutique.html`, mais le nom "Vitrine" evite la confusion.

### Modules admin

| Module | Fichier | Role |
|--------|---------|------|
| `MistralAdmin` | `admin-core.js` | Auth, Modal, Toast, Confirm, Storage, Teachers/Gallery/Blog CRUD |
| `AdminUI` | `admin-ui-core.js` | Navigation, dashboard, todos, helpers partages (`AdminUIHelpers`) |
| `AdminUI.*` | `admin-ui-gestion.js` | Rendu tables : clients, instruments, locations, commandes, factures |
| `AdminUI.*` | `admin-ui-boutique.js` | Rendu stock en ligne, accessoires |
| `AdminUI.*` | `admin-ui-content.js` | Rendu professeurs, galerie, blog, analytics |
| `AdminUI.*` | `admin-ui-config.js` | Rendu config, materiaux, gammes, tailles, emails automatiques |
| `AdminUI.*` | `admin-ui-modals.js` | Tous les modals CRUD (formulaires edition/creation) |
| `AdminUI.*` | `admin-ui-compta.js` | Comptabilite, rapports URSSAF |
| `MistralGestion` | `gestion.js` | Logique metier : CRUD, validation, transitions de statut |

### Helpers partages (AdminUIHelpers)

Tous les modules admin-ui-*.js importent leurs helpers depuis `window.AdminUIHelpers` (exporte par `admin-ui-core.js`) :

```javascript
const { $, $$, escapeHtml, formatPrice, formatDate, isValidEmail, Toast, Confirm, Modal, Storage } = window.AdminUIHelpers;
```

**Ne jamais dupliquer ces helpers** dans les modules. Toujours les importer via destructuring.

### Validation des donnees

Les fonctions `create()` dans `gestion.js` valident les donnees avant insertion :
- `validateClient()` : nom requis, format email
- `validateInstrument()` : reference + gamme requises, prix positif
- `validateLocation()` : client_id + instrument_id requis
- `validateCommande()` : client_id requis, montant positif
- `validateFacture()` : client_id requis, au moins une ligne

Les erreurs de validation remontent via `Toast.error()` dans les modals.

---

## Systeme de tarification

### Fonctionnement

Le prix d'un instrument est calcule dynamiquement dans `js/pages/boutique.js` en fonction de la configuration choisie. **Tous les parametres sont configurables depuis l'admin** (Config > Tarification configurateur).

### Prix de base (configurables)

| Parametre | Defaut | Cle config |
|-----------|--------|------------|
| Prix par note | 115 EUR | `prixParNote` |
| Bonus note octave 2 | +50 EUR/note | `bonusOctave2` |
| Bonus bottoms | +25 EUR forfait | `bonusBottoms` |

### Malus taille (montant fixe en EUR, configurable par taille)

| Taille | Malus defaut | Raison |
|--------|-------------|--------|
| 53 cm | 0 EUR | Standard |
| 50 cm | +100 EUR | Modification du shell (2h de travail) |
| 45 cm | +100 EUR | Modification du shell (2h de travail) |

> Le malus taille est editable dans Config > Tailles > bouton modifier sur chaque taille.

### Malus difficulte (pourcentage, configurable)

| Statut faisabilite | Malus defaut | Cle config |
|-------------------|-------------|------------|
| OK | 0% | — |
| Warning | +5% | `malusDifficulteWarning` |
| Difficile | +10% | `malusDifficulteDifficile` |
| Impossible | Bloque | — |

### Formule de calcul

```
prix = (nb_notes × prixParNote)
     + (nb_notes_octave2 × bonusOctave2)
     + (hasBottoms ? bonusBottoms : 0)
     + malusTaille(size)                        ← montant fixe EUR
prix = prix × (1 + malusDifficulte(status)/100) ← pourcentage
prix = arrondi_inferieur_tranche_5(prix)
```

### Ou modifier les tarifs

- **Admin > Config > Tarification configurateur** : prix par note, bonus octave 2, bonus bottoms, malus difficulte
- **Admin > Config > Tailles** : malus taille en EUR par taille (bouton modifier)
- **Code** : `js/pages/boutique.js` fonction `calculatePrice()`, defaults dans `PRICING_DEFAULTS`

---

## Systeme de faisabilite

Le module `js/features/feasibility-module.js` verifie si une configuration de notes est physiquement realisable sur un shell de taille donnee.

### Seuils (configures dans `tailles-data.js` par taille)

| Statut | % Surface occupee | Effet UI | Effet prix |
|--------|-------------------|----------|------------|
| OK | <= 45% | Normal | 0% |
| Warning | 45-50% | Indication "configuration avancee" | +5% (configurable) |
| Difficile | 50-59% | Bouton de verification | +10% (configurable) |
| Impossible | > 59% | Note grisee, selection bloquee | N/A |

### Notes interdites par taille

| Taille | Note interdite | Raison |
|--------|----------------|--------|
| 53 cm | A#4 | Conflit avec la cavite du shell |
| 50 cm | B4 | Conflit avec la cavite du shell |
| 45 cm | C#5 | Conflit avec la cavite du shell |

### Donnees de faisabilite

Chaque taille dans `tailles-data.js` contient un objet `feasibility` avec :
- `shell` : surface totale du shell (mm²)
- `comfortPct`, `warningPct`, `maxPct` : seuils en %
- `forbiddenNotes` : notes physiquement impossibles
- `noteSize`, `bottomSize` : surface par note/bottom

---

## Systeme audio

Le configurateur joue les notes en temps reel via Web Audio API.

- **Formats** : FLAC (principal) + MP3 192kbps (fallback Safari/iOS)
- **Detection** : `canPlayType('audio/flac')` au constructeur, bascule automatique
- **Dossier** : `ressources/audio/`
- **Nommage** : `[Note][s][Octave].flac` et `.mp3` (s = diese/sharp)
  - Exemples : `Cs4.flac`/`Cs4.mp3` = C#4, `As3.flac`/`As3.mp3` = A#3/Bb3
- **Plage** : E2 a F5 (56 samples x 2 formats = 112 fichiers)
- **Module** : `js/features/handpan-player.js` (classe `HandpanPlayer`)

Pour ajouter un sample : convertir en FLAC + MP3, nommer selon la convention, placer dans `ressources/audio/`.

---

## Base de donnees Supabase

### Tables principales

| Table | Champs cles | RLS lecture publique |
|-------|-------------|---------------------|
| `clients` | nom, email, telephone, adresse, credit_fidelite | Non |
| `instruments` | reference, gamme, tonalite, taille, prix_vente, statut | Oui (statut='en_ligne') |
| `locations` | client_id, instrument_id, date_debut, loyer, caution, statut | Non |
| `commandes` | client_id, specifications (JSON), montant, statut, statut_paiement | Non |
| `factures` | numero (auto), client_id, lignes (JSON), montant_ttc, statut | Non |
| `professeurs` | nom, email, lat, lng, photo, types_cours, statut | Oui (statut='active') |
| `galerie` | type, src, thumbnail, ordre, featured | Oui |
| `articles` | slug, title, content (HTML), status, tags | Oui (status='published') |
| `accessoires` | nom, categorie, prix, stock, visible_configurateur, tailles_compatibles | Oui (statut='actif') |
| `configuration` | key, value (JSON), namespace | Non |

### Securite RLS (Row-Level Security)

- **Lecture publique** : professeurs actifs, articles publies, instruments en ligne, galerie, accessoires actifs
- **Insertion publique** : candidatures professeurs (statut='pending' force)
- **CRUD authentifie** : toutes les operations admin necessitent un JWT Supabase valide
- **Storage** : bucket `galerie` — ecriture admin-only, lecture publique

---

## Configuration initiale

### 1. Creer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com), creer un compte
2. "New Project" (region EU recommandee pour RGPD)
3. Noter le mot de passe de la base

### 2. Recuperer les identifiants API

Dans **Settings > API** :
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

> **IMPORTANT** : Ne jamais commiter `config.js` — il est dans `.gitignore`.

### 4. Creer un utilisateur admin

Dans Supabase > **Authentication > Users** > "Add User" :
- Email : `admin@votre-domaine.fr`
- Password : (mot de passe fort)
- Cochez "Auto Confirm User"

### 5. Variables d'environnement (Netlify)

Configurer dans Netlify > Site Settings > Environment Variables :

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx          # Cle service (webhooks, functions serveur)
BREVO_API_KEY=xxx                 # Email Brevo SMTP
PAYPLUG_SECRET_KEY=xxx            # Paiement PayPlug
SWIKLY_SECRET_KEY=xxx             # Verification HMAC webhook Swikly
```

### 6. Depannage

| Erreur | Cause probable | Solution |
|--------|----------------|----------|
| "supabaseUrl is required" | `config.js` absent ou non charge | Copier `config.example.js` vers `config.js` |
| "Invalid login credentials" | Utilisateur admin incorrect | Verifier dans Supabase > Authentication |
| "Service d'authentification non disponible" | Scripts charges dans le mauvais ordre | Verifier l'ordre dans admin.html |
| Erreurs CORS | Domaine non autorise | Ajouter dans Supabase > Settings > API |
| Partials ne chargent pas | Ouverture en `file://` | Utiliser un serveur HTTP local |
| Config admin ne se charge pas | Bug historique corrige en v3.5 | Verifier que `refreshSection` a bien `case 'config':` |

---

## Deploiement

### Hebergement

- **Site** : Netlify (statique + Functions)
- **Domaine** : OVH (`mistralpans.fr`)
- **Stockage media** : Supabase Storage (bucket `galerie`)
- **SSL** : Inclus Netlify

### Configuration Netlify (`netlify.toml`)

Le fichier configure :
- Headers de securite (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Cache statique (1 semaine pour ressources, 1 heure pour CSS/JS)
- Redirects et rewrites
- Build settings (publish: `.`, functions: `netlify/functions`)

### Checklist pre-production

**Fait :**
- [x] config.js dans .gitignore
- [x] Auth admin via Supabase Auth (JWT)
- [x] CORS whitelist sur toutes les Netlify Functions
- [x] Verification HMAC webhook Swikly
- [x] XSS corrigee (escapeHtml partout)
- [x] Rate limiting sur creation paiement et email
- [x] Idempotence webhook PayPlug (upsert)
- [x] Pages legales (CGV, mentions)
- [x] Banniere consentement cookies
- [x] Anti-spam honeypot
- [x] Supabase Storage pour les uploads

**A faire :**
- [ ] Tester flux complet sandbox PayPlug et Swikly
- [ ] Passer cles PayPlug de test a live
- [x] Optimiser images (26 Mo -> 1.4 Mo)
- [x] Ajouter un favicon
- [ ] Tester sur vrais appareils mobiles

---

## Securite

### Audit de securite (dernier : fevrier 2026)

| # | Severite | Description | Statut |
|---|----------|-------------|--------|
| 1 | ~~CRITIQUE~~ | CORS whitelist sur Netlify Functions | Resolu |
| 2 | ~~CRITIQUE~~ | Verification HMAC webhook Swikly | Resolu |
| 3 | ~~HAUTE~~ | XSS dans showPaymentSuccess() | Resolu |
| 4 | ~~HAUTE~~ | Rate limiting creation paiement/caution | Resolu |
| 5 | ~~HAUTE~~ | Idempotence webhook PayPlug | Resolu |
| 6 | ~~HAUTE~~ | Validation donnees webhook Swikly | Resolu |
| 7 | MOYENNE | Rate limiting connexion admin | Supabase gere cote serveur |
| 12 | FAIBLE | CSP meta sur commander.html | Defini dans netlify.toml (prod) |
| 13 | FAIBLE | Securite partagee PayPlug Integrated Payment | Risque accepte |

### Points positifs

- Webhook PayPlug : re-fetch API cote serveur (ne fait pas confiance au payload)
- Supabase RLS : acces public vs admin au niveau des lignes
- Honeypot : zero cookie tiers, zero dependance externe
- PayPlug cle secrete : jamais exposee au client
- Metadata Swikly : whitelist de cles avant stockage

---

## Roadmap

### Termine (v3.5)

- [x] Migration auth vers Supabase Auth
- [x] MistralSync : donnees in-memory + Supabase (plus de localStorage pour les donnees metier)
- [x] Validation des donnees dans toutes les fonctions `create()`
- [x] Bulk upsert Supabase (au lieu de item par item)
- [x] Suppression sync vers Supabase (deleteFromSupabase)
- [x] ~~FAB centralise~~ → supprime en v3.5 (admin accede directement via URL)
- [x] Tarification configurable depuis l'admin
- [x] Malus taille en montant fixe EUR (au lieu de pourcentage)
- [x] Reorganisation navigation admin (groupes, labels, dashboard toggleable)
- [x] Analytics integre au dashboard
- [x] Bug fix : onglet Config qui ne se chargeait pas
- [x] Librairies vendor auto-hebergees (plus de CDN sauf PayPlug)
- [x] Systeme de gammes/materiaux/tailles dans l'admin
- [x] Optimisation images (26 Mo -> 1.4 Mo)
- [x] Suppression CSP unsafe-inline/unsafe-eval (scripts externalises)
- [x] JSON-LD structured data, @media print, sitemap dynamique
- [x] Correction securite webhooks (fail-closed, idempotence, escapeHtml)
- [x] Config admin : dropdown/collapse pour sections longues (gammes, materiaux, tailles)
- [x] Fix icone hint qui masquait le bouton "ecouter" sur mobile (padding player-visual)
- [x] Boutique desktop : suppression du scroll gate JS, scroll 100% natif + bandeau teal cliquable sticky
- [x] Favicon (ico + png + apple-touch-icon + webmanifest) sur les 14 pages
- [x] Acces tarification admin : verifie OK (5 champs editables dans Config > Tarification configurateur)
- [x] Fallback MP3 pour Safari/iOS (56 fichiers MP3 + detection canPlayType dans handpan-player.js)
- [x] Migration tailles-data.js de localStorage vers MistralSync/Supabase (table `tailles`)
- [x] RLS Supabase granulaire : policies role-based par table (admin-only, filtre public, insert public professeurs)
- [x] Securisation IBAN/BIC : table `configuration` en admin-only (RLS bloque les lectures anonymes)
- [x] PayPlug/Swikly en production (test en cours)
- [x] Auto-generation facture sur paiement confirme (webhook payplug → findOrCreateClient + generateInvoice)
- [x] Batch de gammes : collections nommees dans Config admin, activation publie les codes dans namespace=configurateur (lecture publique RLS), configurateur boutique re-render dynamiquement
- [x] Logo et mise en page des factures PDF (`gestion-pdf.js`) : logo Base64, blocs emetteur/destinataire cartes, tableau arrondi, layout professionnel
- [x] Integration Calendly pour prise de RDV : iframe integre sur `location.html` (step 4 modal) et `commander.html` (retrait atelier), consentement RGPD (`cookie-consent.js` v1.1), CSP mise a jour, fallback lien direct
- [x] Elimination des variables globales mutables dans les modals admin : 18 `let` top-level migrees vers `_modalState` scope par modal dans `admin-ui-modals.js`, `admin-ui-boutique.js`, `admin-ui-content.js`
- [x] Titres SEO enrichis : `<title>`, `og:title`, `twitter:title` ameliores sur 5 pages (commander, article, annonce, suivi, galerie) + meta description article.html corrigee
- [x] Hardcoded colors → custom properties : ~100 couleurs en dur migrees vers des CSS variables dans `boutique.css` et `admin.css`, nouvelles variables ajoutees dans `style.css` (overlays, notes SVG, warning/error) et `admin.css` (error-dark, error-hover), fallbacks inutiles supprimes
- [x] Validation prix panier cote serveur : prix custom recalcules par les Netlify Functions (`payplug-create-payment.js` + `payplug-webhook.js`) avec formule identique au client, prix accessoires/housses verifies contre la table `accessoires` en DB, double couche (pre-paiement + webhook), strategie fail-closed
- [x] Suppression du FAB (Floating Action Button) : composant retire de `admin-core.js`, `admin.css`, `boutique.css`, `style.css` — l'admin accede directement via `admin.html`
- [x] Page de credits (`credits.html`) : remerciements Shellopan (samples audio), listing de toutes les bibliotheques open source (Supabase, Leaflet, Chart.js, Quill, jsPDF), typographies (Fraunces, Inter, JetBrains Mono) et services cartographiques (OpenStreetMap, CARTO, Nominatim) avec licences et liens
- [x] Notes interdites parametrables par taille : champ `forbiddenNotes` editable dans le formulaire admin (Config > Tailles), parsing comma-separated, pipeline complet taille → feasibility-module → configurateur (notes grisees automatiquement)
- [x] Lots de gammes multi-publiables comme preselection configurateur : systeme publish/unpublish par lot (remplace activation unique), selecteur avec fleches dans la boutique pour naviguer entre les lots publies (debutant, modal, etc.), chips des gammes filtrees par lot, backward compat legacy `active_gammes`, champ ordre pour tri
- [x] Fix page annonce cassee (clean URL routing) : les serveurs de dev avec clean URLs supprimaient les query params (`?ref=UUID`), liens migres vers hash params (`#ref=UUID`), `getIdFromURL()` lit query params puis fallback hash — compatible dev local et production Netlify
- [x] Editeur de patterns gammes dans l'admin : champs baseNotes + 9 inputs patterns (9-17 notes) dans le modal gamme, validation temps reel (compteur notes T/B/M), bouton import depuis scales-data.js, badge "Patterns" dans la liste, persistance Supabase (table `gammes` + MistralSync), `getScaleDataForConfigurateur()` merge custom_layouts > SCALES_DATA, boutique.js utilise `getScaleDataUnified()` au lieu de SCALES_DATA direct
- [x] Focus-visible sur tout le site : reset global `:focus-visible` + `:focus:not(:focus-visible)`, variables CSS (`--focus-ring`, `--focus-shadow`), ~30 selecteurs interactifs couverts (boutons, nav, chips, radio-cards, tabs, modals), fix `outline: none` dans admin.css/boutique.css/admin.html, focus specifiques cookie banner (fond sombre)
- [x] Echelle z-index unifiee : 9 variables CSS (`--z-base` a `--z-skip`), remplacement de tous les z-index hardcodes dans 4 CSS + 5 JS + 4 HTML, resolution conflits (header/dropdown/modal/toast sur memes valeurs), echelle : base(1) → sticky(100) → dropdown(200) → player(500) → modal(1000) → toast(2000) → skip(9999)
- [x] Audit code mort : suppression de 4 fonctions mortes dans main.js (initContactModal, initScaleSelector, _buildScalesForSelector, validateForm), CSS orphelin .scale-btn, nettoyage des appels. Doublons evalues (escapeHtml, toasts inline, formatPrice) — conserves car contextes differents
- [x] Literate coding / commentaires exhaustifs : JSDoc complet (@param, @returns, @throws) + section dividers + file headers sur 7 fichiers prioritaires — location.js, commander.js, admin-ui-config.js, handpan-player.js, gammes-data.js, main.js, cookie-consent.js. Style : banniere fichier, sections ===, langue francaise, algorithmes documentes
- [x] Auth state listener Supabase : ajout `destroy()` + `beforeunload` pour unsubscribe la subscription `onAuthStateChange` (fuite memoire)
- [x] Rate limiting persistant Netlify Functions : table Supabase `rate_limits` + RPC atomique `check_rate_limit()`, module partage `utils/rate-limit.js`, 5 fonctions migrees (payplug 5/min, send-email 5/min, swikly 3/min, order-status 10/min, teacher-signup 5/h fail-closed), option `failClosed` par fonction
- [x] Validation de longueur champs admin : `maxlength` HTML sur ~40 inputs/textareas dans 12 modals (admin.html + contact-modal.html), helper `validateStringLengths()` dans gestion.js pour validation serveur-side dans les 5 fonctions validate (client, instrument, location, commande, facture)
- [x] Redirects www→non-www + cache-bust CSS/JS : redirect 301 `www.mistralpans.fr` → `mistralpans.fr` dans netlify.toml, query string `?v=3.5` sur 128 refs CSS/JS dans 15 HTML + 4 scripts dynamiques dans main.js, cache headers CSS/JS augmentes de 1h a 7 jours (604800s)
- [x] Audit SEO : meta description index.html raccourcie (179→120 car), titles raccourcis (commander/apprendre/suivi), hierarchie Hn corrigee (H3→H2 sur commander et suivi), JSON-LD ajoute sur 7 pages (commander Product, location Service, apprendre WebPage, galerie CollectionPage, blog CollectionPage, suivi WebPage+BreadcrumbList, article Article dynamique), OG/Twitter completes sur article.html, canonical dynamique sur article.html
- [x] Audit complet du projet (8 dimensions) : rapport PROJECT-REVIEW.md — Performance (5/10), SEO (9/10), Accessibilite (7/10), Securite (7.5/10), Code (5.5/10), RGPD (7/10), UX (6.5/10), Compatibilite (7.5/10)
- [x] Sprint 1 conformite legale + securite : checkbox RGPD sur les 4 formulaires commande (commander.html + validation commander.js), analytics `default: false` dans cookie-consent.js (CNIL), section droits des personnes enrichie dans mentions-legales.html (art. 15-21 RGPD, durees conservation, sous-traitants, CNIL), sanitisation XSS article.content via sanitizeHtml() dans article.js (whitelist balises/attributs, supprime scripts/handlers), renforcement webhook PayPlug (validation body + format ID, documentation securite), couleurs erreur/warning/success WCAG AA sur tout le projet (56 remplacements dans 12 fichiers : #EF4444→#DC2626, #F59E0B→#D97706, #4A7C59→#3D6B4A)
- [x] Sprint 2 performance + UX critiques : (1) images WebP avec `<picture>` fallback + detection JS background-image (10 images, -30 a -67%), (2) fix 100vh iOS Safari via `dvh` fallback sur 18 occurrences dans 10 fichiers, (3) focus trap WCAG 2.4.3 (`MistralFocusTrap` dans main.js) sur modale contact + modals admin + lightbox galerie + modals professeurs + Escape key, (4) validation formulaires temps reel onblur (`MistralValidation` dans main.js) avec CSS `.is-invalid`/`.is-valid`/`.form-error` sur contact, commander et teacher-form, (5) toast notifications global (`MistralToast` dans main.js) avec CSS `.toast` remplacant les 3 implementations inline (commander showMessage, teacher-form showNotice, feasibility showNotice), (6) spinner + disable submit pendant paiement (`.btn--loading` CSS + `setButtonLoading()`/`resetButton()` dans commander.js sur 5 handlers), (7) page 404 personnalisee (`404.html` compatible Netlify), (8) `aria-live="polite"` sur zones dynamiques (panier header, prix boutique, player-info, cart-items, suivi-result, contact-status, toast-container)
- [x] Sprint 3 dette technique + qualite : (1) `.catch()` ajoute sur tous les fetch/async non proteges (17 fichiers), (2) extraction `js/core/utils.js` module partage (`MistralUtils` — escapeHtml, formatPrice, formatDate, sanitizeHtml, debounce, generateId, hasValue, loadScript, loadStylesheet) remplacant les doublons dans 14 fichiers, (3) split `admin-ui-modals.js` (2283→7 modules par entite : core 250 lignes + clients/instruments/locations/commandes/factures/teachers), (4) async-ification chaine Supabase init (callback pyramid→async/await avec `loadScript` Promise), (5) modernisation ES6 : 570 `var`→`const`/`let` dans 18 fichiers (reste 1 seul var dans vendor), (6) lazy-load Chart.js (~204 KB) et Quill.js (~238 KB) — charges dynamiquement a la demande au lieu du chargement initial admin.html

### Developpement futur

- [ ] API La Poste Colissimo : bordereau retour pour clients location a distance
- [ ] API La Poste Colissimo cote admin : bordereau envoi pour instruments stock
- [ ] Pagination dans les listes admin (perf DOM 1000+ enregistrements)
- [ ] Integration avec plateforme agreee pour facturation numerique en accord avec les nouvelles reglementations FR (Dolibarr ?)
- [ ] Alts d'images generiques `boutique.html` → remplacer par photos

### A faire

- [x] Page Service : page dediee pour presenter les services Mistral Pans (accordage, reparation, entretien, etc.)
- [x] Delai de fabrication dynamique : calcul automatique base sur les commandes en cours (`max(4, commandes_en_cours + 2)` semaines), publie dans config Supabase (namespace=configurateur), affiche dynamiquement sur commander.html
- [ ] Gestion des mails automatiques : clarifier l'architecture (templates hardcodes dans send-email.js vs config Supabase vs admin editable), documenter le pipeline d'envoi, evaluer si les templates doivent etre editables depuis l'admin

### Mode fermeture atelier (a developper)

Systeme activable/desactivable depuis l'admin permettant de suspendre temporairement l'activite commerciale du site (conges, deplacement, surcharge). Pas de mention explicite de "vacances" cote public (adresse perso = securite).

**Phase 1 — Backend config + toggle admin**
- [ ] Ajouter cle `mode_fermeture` dans `configuration` (namespace=`configurateur`, RLS publique) — structure : `{ actif: bool, message: string, date_retour: string|null, waitlist_enabled: bool }`
- [ ] Creer table Supabase `waitlist` — champs : `id`, `email`, `created_at`, `notified_at` (null = pas encore notifie). RLS : insert public, select/delete admin-only
- [ ] Section dans admin.html (Config ou Dashboard) : toggle ON/OFF, champ message personnalise (defaut : "L'atelier est temporairement ferme"), champ date de retour estimee (optionnel), checkbox "Activer la liste d'attente"
- [ ] Fonction `saveFermeture()` dans `admin-ui-config.js` : publie la config vers Supabase namespace=configurateur (meme pattern que `publishToSupabase` dans gammes-data.js)

**Phase 2 — Bandeau public + blocage commandes**
- [ ] Lire `mode_fermeture` depuis Supabase dans `main.js` (apres sync complete) — si actif, injecter un bandeau sous le header sur toutes les pages
- [ ] CSS bandeau `.atelier-closed-banner` : fond warning doux, texte "L'atelier est temporairement ferme. Retour prevu le [date].", lien vers inscription waitlist, fermeture au clic (sessionStorage pour ne pas reapparaitre)
- [ ] Page `commander.html` : si mode fermeture actif, masquer les options de paiement, afficher un message explicatif + formulaire waitlist a la place
- [ ] Page `boutique.html` : si mode fermeture actif, desactiver le bouton "Commander" sur le configurateur, le transformer en "Me prevenir a la reouverture" → scroll vers formulaire waitlist
- [ ] Page `location.html` : si mode fermeture actif, desactiver le bouton de demande de location

**Phase 3 — Formulaire waitlist (inscription)**
- [ ] Composant HTML/JS reutilisable `waitlist-form` (email + bouton "Me prevenir") injectable dans commander.html, boutique.html, et bandeau
- [ ] Honeypot anti-spam (meme pattern que teacher-form)
- [ ] Insert direct Supabase (table `waitlist`, RLS insert public) — ou Netlify Function si rate limiting necessaire
- [ ] Validation email + feedback toast ("Vous serez prevenu(e) des la reouverture")
- [ ] Deduplication : `ON CONFLICT (email) DO NOTHING` pour eviter les doublons
- [ ] Mention RGPD sous le formulaire : "Votre email sera utilise uniquement pour vous informer de la reouverture, puis supprime."

**Phase 4 — Auto-reply formulaire contact**
- [ ] Si mode fermeture actif et qu'un visiteur utilise le formulaire contact (contact-modal.html), ajouter un auto-reply via la Netlify Function `send-email.js` : "Merci pour votre message. L'atelier est actuellement ferme, je vous repondrai des mon retour [date si renseignee]."
- [ ] Le message d'auto-reply est personnalisable depuis l'admin (champ texte dans la config fermeture)

**Phase 5 — Relance a la reouverture**
- [ ] Bouton dans l'admin "Envoyer la relance de reouverture" (visible uniquement quand mode fermeture est desactive ET waitlist non vide)
- [ ] Netlify Function `send-waitlist-notification.js` : recupere tous les emails de la waitlist (via SERVICE_KEY), envoie un email Brevo a chacun ("L'atelier Mistral Pans est de nouveau ouvert ! [CTA vers boutique]"), marque `notified_at = now()`
- [ ] Apres envoi confirme, proposer de vider la waitlist (bouton "Purger la liste" avec confirmation)
- [ ] Afficher dans l'admin le nombre d'inscrits en attente + date derniere relance

**Notes techniques :**
- La config `mode_fermeture` dans namespace=configurateur est lisible publiquement (meme pattern que `delai_fabrication` et `published_lots`)
- Le bandeau public est injecte par `main.js` pour etre present sur toutes les pages sans modifier chaque HTML
- La waitlist est RGPD-friendly : consentement explicite, usage unique, suppression apres notification
- L'auto-reply sur le formulaire contact necessite une modification de `send-email.js` (ajout d'un 2e envoi conditionnel)

**Priorite basse :**
- [ ] Audit licences open source : verifier si les licences des dependances (BSD, MIT, ODbL, SIL OFL) imposent des obligations (attribution, copyleft) pouvant necessiter de rendre le projet open source
- [x] ~~Passer en philosophie literate coding / commentaires exhaustifs~~ → voir "Termine v3.5"
- [x] ~~Rate limiting persistant sur Netlify Functions~~ → voir "Termine v3.5"
- [x] ~~Validation de longueur sur les champs admin (nom, email, telephone, adresse)~~ → voir "Termine v3.5"
- [x] ~~Redirects www -> non-www + cache-bust fichiers CSS/JS~~ → voir "Termine v3.5"
- [x] ~~Auth state listener Supabase jamais unsubscribed~~ → voir "Termine v3.5"

### Mettre a jour les librairies

```bash
# Verifier les mises a jour disponibles
./scripts/update-vendor.sh

# Installer les mises a jour
./scripts/update-vendor.sh --install
```

Le dashboard admin affiche aussi un indicateur quand des MAJ sont disponibles.

---

## Historique des versions

### v3.5 (15 Fevrier 2026)
- **Admin** : Reorganisation complete de la navigation (groupes Gestion/Contenu/Outils, labels, dashboard toggleable)
- **Admin** : Suppression onglet Analytics, integre au dashboard
- **Admin** : Renommage "Boutique" → "Vitrine" dans l'admin
- **Admin** : Fix bug onglet Config qui ne rendait pas (case 'configuration' → 'config')
- **Admin** : Dropdown/collapse pour sections longues en Config (gammes, materiaux, tailles)
- **Tarification** : Prix configurables depuis l'admin (prix/note, bonus octave 2, bonus bottoms, malus difficulte)
- **Tarification** : Malus taille change de pourcentage a montant fixe EUR (ex: +100 EUR pour 45/50 cm)
- **Data** : Validation des donnees dans tous les `create()` (gestion.js)
- **Data** : Bulk upsert Supabase (plus de boucle item par item)
- **Data** : Suppression sync vers Supabase (deleteFromSupabase dans toutes les fonctions delete)
- **Data** : `ajouterCredit()` protege contre NaN
- **UI** : isValidEmail unifie dans AdminUIHelpers
- **UI** : Modal memory leaks corriges (reset upload state on close)
- **UI** : `Confirm.show()` supporte `isHtml` option
- **UI** : Erreurs transition statut instrument affichees via Toast
- **UI** : blog-admin.js ecoute `mistral-data-change` au lieu de `storage`
- **FAB** : ~~Refactore en raccourci global~~ → supprime (admin accede directement via URL)
- **Boutique** : Fix hint mobile qui masquait le bouton "Ecouter" (padding-bottom sur player-visual)
- **Boutique** : Suppression du scroll gate JS desktop (~200 lignes) — scroll 100% natif + bandeau teal sticky cliquable
- **SEO** : Favicon complet (ico, png 16/32, apple-touch-icon 180, android-chrome 192/512, site.webmanifest)
- **Audio** : Fallback MP3 pour Safari/iOS (56 fichiers MP3 192kbps + detection canPlayType)
- **Data** : Migration tailles-data.js de localStorage vers MistralSync/Supabase (table `tailles`, fallback DEFAULT_TAILLES)
- **Securite** : RLS granulaire — policies role-based par table (admin-only pour clients/commandes/factures/locations/configuration, filtre public pour instruments/articles/accessoires/professeurs, lecture publique pour galerie/tailles)
- **Securite** : IBAN/BIC protege — table `configuration` en admin-only (plus de lecture anonyme)
- **Facturation** : Auto-generation facture sur paiement confirme (webhook PayPlug → findOrCreateClient + generateInvoice, idempotent)
- **Configurateur** : Lots de gammes multi-publiables — collections nommees (CRUD admin), publish/unpublish par lot (plusieurs lots simultanement), publication `published_lots` + legacy `active_gammes` via namespace=configurateur (RLS publique), selecteur lots avec fleches dans boutique.js, re-render sur `gammesUpdated`
- **Configurateur** : Notes interdites par taille — champ `forbiddenNotes` editable dans admin (Config > Tailles), pipeline taille → feasibility-module → configurateur
- **Annonces** : Fix page annonce cassee par clean URL routing — liens migres de `?ref=` vers `#ref=` (hash params), `getIdFromURL()` avec double lecture (query params + hash fallback), compatible serveurs de dev et production Netlify
- **Configurateur** : Editeur de patterns gammes dans l'admin — champs baseNotes + patterns (9-17 notes) dans le modal gamme, validation temps reel, import depuis scales-data.js, persistance Supabase (table `gammes`), `getScaleDataForConfigurateur()` unifie custom_layouts et SCALES_DATA, boutique.js decouple de SCALES_DATA via `getScaleDataUnified()`
- **Accessibilite** : Focus-visible sur tout le site — reset global `:focus-visible`, variables CSS (`--focus-ring`, `--focus-shadow`), ~30 selecteurs interactifs (boutons, chips, tabs, modals, nav, cookie), fix `outline: none` dans admin
- **CSS** : Echelle z-index unifiee — 9 variables (`--z-base` a `--z-skip`), tous z-index hardcodes remplaces (4 CSS, 5 JS, 4 HTML), resolution conflits, echelle semantique base→sticky→dropdown→player→modal→toast→skip
- **Nettoyage** : Audit code mort — suppression 4 fonctions mortes (main.js), CSS orphelin (.scale-btn), doublons evalues et documentes
- **Documentation** : Literate coding / commentaires exhaustifs sur 7 fichiers prioritaires — JSDoc complet (@param/@returns/@throws), section dividers, file headers, algorithmes documentes (location.js, commander.js, admin-ui-config.js, handpan-player.js, gammes-data.js, main.js, cookie-consent.js)
- **Fix** : Auth state listener Supabase — ajout `destroy()` avec `authSubscription.unsubscribe()`, appel automatique sur `beforeunload` (fuite memoire sur sessions longues)
- **Securite** : Rate limiting persistant Netlify Functions — remplacement `Map()` in-memory par table Supabase + RPC atomique (`check_rate_limit`), module partage `utils/rate-limit.js`, fail-open si Supabase down, ajout rate limit sur order-status.js (10/min), politique : payplug 5/min, send-email 5/min, swikly 3/min
- **Sprint 1 conformite** : Checkbox RGPD formulaires, analytics default:false, section droits enrichie mentions-legales, sanitisation XSS article.content, renforcement webhooks, couleurs WCAG AA (56 remplacements)
- **Sprint 2 perf+UX** : Images WebP (-30 a -67%), fix dvh iOS, focus trap WCAG, validation temps reel, toast global, spinner paiement, page 404, aria-live
- **Sprint 3 dette technique** : `.catch()` async (17 fichiers), extraction `utils.js` (14 fichiers dedupliques), split `admin-ui-modals.js` (2283→7 modules), async Supabase init, modernisation ES6 (570 var→const/let), lazy-load Chart.js + Quill.js (~442 KB differes)
- **Sprint 4.1 images responsive** : `<picture>` srcset sur 3 heros (index, location, apprendre) avec variantes 480w/768w/1200w WebP+JPG, `fetchpriority="high"` sur LCP, ~90% reduction poids mobile
- **Sprint 4.2 preconnect** : hints DNS+TLS sur 15 pages (Supabase, Google Fonts, PayPlug), fix CSP `connect-src` (api-adresse.data.gouv.fr, api.swikly.com)
- **Sprint 4.3 DOMPurify** : migration sanitisation HTML vers DOMPurify 3.3.1 (23 KB), `sanitizeHtml()` dans utils.js utilise DOMPurify si disponible avec fallback DOMParser, charge sur article.html + admin.html, meme whitelist ALLOWED_TAGS/ALLOWED_ATTR
- **Sprint 4.4 securite inscription** : Netlify Function `teacher-signup.js` remplace l'insert direct client→Supabase, rate limiting fail-closed (5 req/h par IP), honeypot serveur, validation/sanitisation serveur, option `failClosed` ajoutee au module rate-limit
- **Sprint 4.5 prix detaille** : decomposition prix configurateur (base notes × prix, bonus octave 2, bottom notes, malus taille, malus difficulte, housse), lignes conditionnelles masquees si 0, `calculatePrice()` retourne aussi `state._priceBreakdown`, CSS `.price-line--malus` en warning
- **Sprint 4.6 wizard mobile** : formulaire enseignant en 3 etapes sur mobile (≤768px) — Etape 1 : photo + infos perso, Etape 2 : modalites de cours, Etape 3 : reseaux sociaux + envoi. Stepper avec dots + barres de progression, validation par etape avant avancement, retour libre sans validation, animation fadeIn, reset automatique a la fermeture du modal. Desktop : toutes les etapes visibles sans wizard.
- **Sprint 4.7 accessibilite** : Touch targets 44px minimum sur ~15 elements (nav toggle, modal close, footer social, toast close, admin boutons, lot-nav, counter, dots), technique `::after` pseudo-element pour boutons positionnes
- **Sprint 4.8 compatibilite** : `-webkit-backdrop-filter` prefix ajoute sur 6 occurrences dans 5 fichiers (Safari support)
- **Sprint 4.9 tests unitaires** : infrastructure Vitest + jsdom, 147 tests couvrant `utils.js` (96 tests : formatage, escaping, sanitizeHtml, validation, debounce, generateId, loadScript/Stylesheet), `feasibility-module.js` (23 tests : surfaces, seuils, notes interdites, transitions ok→warning→difficult→impossible), `scales-data.js` (28 tests : constantes, notation, theorie musicale, configurateur). Script `npm test`. Setup custom `loadModule()` pour charger les patterns IIFE et const.
- **Sprint 4.10 retention RGPD** : section admin « Retention des donnees » dans Config avec scan automatique des donnees expirees (clients 3 ans, commandes 3 ans, factures 10 ans archive, professeurs en attente 2 ans), bouton purge avec confirmation danger, export RGPD par email (droit d'acces Art. 15) en JSON avec masquage IBAN/BIC.

### v3.4 (8 Fevrier 2026)
- **Vendor** : Toutes les librairies JS auto-hebergees dans `js/vendor/` (plus de CDN sauf PayPlug)
- **Scripts** : `update-vendor.sh` pour verification et MAJ des librairies
- **Admin** : Widget vendor check dans le dashboard

### v3.3 (6 Fevrier 2026)
- **Structure** : Reorganisation du dossier `js/` en sous-dossiers (core, admin, services, data, features, pages)
- **Documentation** : Consolidation en 2 fichiers (README.md + CLAUDE.md)

### v3.2 (4 Fevrier 2026)
- **Ventes** : Workflow de vente integre (instrument → facture → statut vendu)
- **Factures** : Ajout automatique d'instrument avec `addFactureLigneFromInstrument()`
- **Statuts** : Systeme de validation des transitions de statut instruments
- **Supabase** : Sync des professeurs en attente

### v3.1 (4 Fevrier 2026)
- **Securite** : Correction 7 vulnerabilites critiques (XSS, CORS, injection)
- **RGPD** : Banniere consentement cookies, Google Fonts conditionnel
- **Accessibilite** : Skip link, contraste, navigation clavier
- **Architecture** : Refactorisation admin-ui.js en 7 modules

### v3.0 (3 Fevrier 2026)
- Revue globale du projet (78 issues identifies)

### v2.5 (Janvier 2025)
- Systeme de faisabilite
- Tarification 115 EUR/note + malus
- Navigation swipe mobile

### v2.0
- Refonte design complete
- Configurateur SVG interactif
- Audio samples FLAC

---

## Contact

- **Site** : mistralpans.fr
- **Email** : contact@mistralpans.fr
- **Localisation** : Ile-de-France, France

---

*Documentation mise a jour le 15 fevrier 2026 (v3.5)*
