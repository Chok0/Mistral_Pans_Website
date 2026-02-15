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
|   |-- admin.css            # Styles admin (dashboard, nav, modals, tables, FAB)
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
|   |   |-- admin-core.js    # Auth, FAB, Modal, Toast, Confirm, Storage, CRUD helpers
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
|   |   |-- tailles-data.js  # Tailles et faisabilite (localStorage, CRUD admin)
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
| `mistral_gestion_config` | `configuration` (namespace='gestion') | Object | Config metier (tarifs, compteur factures) |
| `mistral_compta_config` | `configuration` (namespace='compta') | Object | Config comptabilite |
| `mistral_email_automations` | `configuration` (namespace='email_automations') | Object | Config emails automatiques |

### Donnees localStorage (preferences client uniquement)

| Cle | Usage |
|-----|-------|
| `mistral_cookie_consent` | Preferences consentement cookies RGPD |
| `mistral_leaflet_consent` | Consentement carte Leaflet |
| `mistral_stats_anonymous` | Compteurs de pages vues anonymes |
| `mistral_tailles` | Configuration des tailles (a migrer vers MistralSync) |

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
| `MistralAdmin` | `admin-core.js` | Auth, FAB, Modal, Toast, Confirm, Storage, Teachers/Gallery/Blog CRUD |
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

### FAB (Floating Action Button)

Le FAB apparait sur **toutes les pages sauf admin.html** quand l'utilisateur est connecte. Il propose 2 actions : lien vers le panneau admin + deconnexion. Le FAB est gere centralement par `admin-core.js` et se cree/detruit automatiquement sur les evenements `mistral-auth-change`.

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

- **Format** : FLAC
- **Dossier** : `ressources/audio/`
- **Nommage** : `[Note][s][Octave].flac` (s = diese/sharp)
  - Exemples : `Cs4.flac` = C#4, `As3.flac` = A#3/Bb3, `D3.flac` = D3
- **Plage** : E2 a F5 (56 samples)
- **Module** : `js/features/handpan-player.js` (classe `HandpanPlayer`)

Pour ajouter un sample : convertir en FLAC, nommer selon la convention, placer dans `ressources/audio/`.

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
- [ ] Optimiser images (WebP, ~26 Mo -> ~5 Mo)
- [ ] Ajouter un favicon
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
- [x] FAB centralise (2 actions, toutes pages sauf admin)
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

### A faire

**Priorite critique (securite) :**
- [ ] **RLS Supabase : politiques granulaires par table** — Actuellement toutes les policies utilisent `USING (true)`, ce qui signifie que tout utilisateur authentifie peut acceder a TOUTES les donnees. Implementer des policies basees sur les roles (ex: `auth.jwt() ->> 'role' = 'admin'`). Action dans Supabase Dashboard > SQL Editor
- [ ] **Donnees bancaires (IBAN/BIC) dans la table `configuration`** — Table accessible en lecture publique. Risque de fraude financiere. Soit chiffrer les donnees, soit les deplacer dans une table avec RLS restreint. Action dans Supabase Dashboard

**Priorite haute :**
- [ ] Tester et passer PayPlug/Swikly en production
- [ ] Auto-generation de facture sur paiement confirme
- [ ] API La Poste Colissimo : generation bordereau retour pour clients location a distance
- [ ] API La Poste Colissimo cote admin : bordereau envoi pour clients achetant un instrument en stock (option generation + impression pour preparer l'envoi)

**Priorite moyenne :**
- [ ] **Batch de gammes** — Concept non implemente pour l'instant. Le systeme actuel gere chaque gamme individuellement (CRUD unitaire dans `admin-ui-config.js`, dropdown selection simple dans le modal instrument). Objectif : pouvoir gerer des lots/batches de gammes dans Config (admin panel) avec effet dans le configurateur d'instrument virtuel (boutique.html). La recherche de gamme dans le champ instrument est deja fonctionnelle
- [ ] **Acces aux valeurs de tarification cote admin en Config** (prix par note, surcharge octave 2, malus selon espace disponible, surcharge bottom notes) — verifier l'accessibilite actuelle dans Config > Tarification configurateur
- [ ] Logo et mise en page des factures PDF a travailler (`gestion-pdf.js`)
- [ ] Mise en place de Calendly pour la prise de RDV (recuperation instruments a l'atelier, recuperation location)
- [ ] Migrer `tailles-data.js` de localStorage vers MistralSync
- [ ] Eliminer les variables globales mutables dans les modals admin (risque de race condition entre modals)
- [ ] Fallback MP3 pour l'audio (compatibilite Safari/iOS, actuellement FLAC uniquement)
- [ ] Pagination dans les listes admin (probleme de performance DOM avec 1000+ enregistrements)
- [ ] Validation de prix panier cote client (`cart.js` utilise sessionStorage modifiable)
- [ ] Ameliorer indicateurs `:focus-visible` sur tout le site
- [ ] Unifier l'echelle z-index (actuellement ad hoc)

**Priorite basse :**
- [ ] Audit code mort, code inutile et doublons — refactorisation et propositions d'optimisation
- [ ] Passer en philosophie literate coding / commentaires exhaustifs (permettre la maintenance par un dev junior)
- [ ] Rate limiting persistant sur Netlify Functions (actuellement `Map()` in-memory, perdu au cold start ~15 min)
- [ ] Validation de longueur sur les champs admin (nom, email, telephone, adresse)
- [ ] Titres de pages SEO trop courts (`commander.html` 24 chars, `article.html` 22 chars — recommande 50-60)
- [ ] Alts d'images generiques dans `boutique.html` (meme alt pour 3 cartes differentes)
- [ ] Hardcoded colors dans boutique.css et admin.css (devraient utiliser les custom properties)
- [ ] Redirects www -> non-www + cache-bust fichiers CSS/JS (hash dans le nom de fichier)
- [ ] Auth state listener Supabase jamais unsubscribed (`supabase-auth.js`)

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
- **FAB** : Refactore en raccourci global (admin + deconnexion), auto-injecte sur toutes les pages sauf admin
- **Boutique** : Fix hint mobile qui masquait le bouton "Ecouter" (padding-bottom sur player-visual)
- **Boutique** : Suppression du scroll gate JS desktop (~200 lignes) — scroll 100% natif + bandeau teal sticky cliquable
- **SEO** : Favicon complet (ico, png 16/32, apple-touch-icon 180, android-chrome 192/512, site.webmanifest)

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
