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
|   |-- admin-core.js        # Admin: auth, FAB, CRUD
|   |-- admin-ui.js          # Admin UI (4,711 lignes)
|   |-- handpan-player.js    # Player SVG interactif
|   |-- feasibility-module.js # Validation configurations
|   |-- supabase-client.js   # Client Supabase
|   |-- supabase-auth.js     # Authentification
|   |-- supabase-sync.js     # Synchronisation temps reel
|   |-- *-admin.js           # Modules admin par page
|   +-- *.js                 # Autres modules
|
|-- php/
|   |-- upload.php           # Upload fichiers
|   +-- delete.php           # Suppression fichiers
|
|-- sql/
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

### Architecture
- **admin-core.js** : Module centralise (Auth, FAB, Modal, Toast, Storage)
- **admin-ui.js** : Composants UI admin
- **[page]-admin.js** : Integrations specifiques par page

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

**Revue effectuee le 3 fevrier 2026**

### Resume

| Categorie | Total | Critique | Haute | Moyenne | Basse |
|-----------|-------|----------|-------|---------|-------|
| Securite | 8 | 4 | 2 | 2 | 0 |
| JavaScript | 15 | 0 | 6 | 6 | 3 |
| CSS | 18 | 1 | 8 | 6 | 3 |
| HTML | 23 | 2 | 3 | 5 | 13 |
| Database | 10 | 2 | 3 | 4 | 1 |
| **Total** | **74** | **9** | **22** | **23** | **20** |

---

### Problemes critiques

#### 1. Securite : Identifiants en dur

| Probleme | Fichier | Ligne |
|----------|---------|-------|
| Cle Supabase exposee | `js/supabase-client.js` | 25-26 |
| Mot de passe par defaut `mistral2024` | `js/admin-core.js` | 34 |
| Fonction hash non cryptographique | `js/admin-core.js` | 43-50 |
| Auth legacy dupliquee | `js/supabase-auth.js` | 224-250 |

**Risque :** Toute personne peut voir le code source et acceder au panneau admin.

#### 2. Erreur de syntaxe

| Fichier | Ligne | Probleme |
|---------|-------|----------|
| `location.html` | 406 | Parenthese fermante en trop dans le JS |

#### 3. Pages legales manquantes

Le footer contient des liens vers `mentions-legales.html` et `cgv.html` qui **n'existent pas** - violation RGPD.

---

### Problemes haute priorite

#### JavaScript

| Probleme | Fichiers |
|----------|----------|
| Systemes admin dupliques | `admin-core.js` + `gestion.js` charges ensemble |
| Fichier de 4,711 lignes | `admin-ui.js` - difficile a maintenir |
| XSS via innerHTML | 13 fichiers (`messages.js:217`, `admin-ui.js:360+`) |
| Utilitaires dupliques 4x | `escapeHtml()`, `formatDate()`, `formatPrice()` |
| 25 intervals, 2 cleanups | Fuites memoire potentielles |

#### CSS

| Probleme | Fichiers |
|----------|----------|
| Pas d'indicateurs focus (WCAG) | Tous les fichiers CSS |
| Definitions `:root` multiples | `style.css`, `admin.css`, `boutique.css` |
| 24+ flags `!important` | `boutique.css` |
| Styles boutons dupliques | ~400 lignes en double |
| z-index chaotique (1 a 10001) | Pas de systeme |

#### HTML

| Probleme | Fichier | Ligne |
|----------|---------|-------|
| `</div>` en trop | `apprendre.html` | 1041 |
| Alt vides sur images | `index.html` | 58, 70, 82 |
| Encodage UTF-8 corrompu | `boutique.html` | Multiple |
| Annee copyright incoherente | `article.html` | 2025 vs 2026 |

#### Database

| Probleme | Fichier |
|----------|---------|
| localStorage comme source de verite | `supabase-sync.js` |
| RLS trop permissive | `02_rls_policies.sql:54-87` |
| Contraintes DB supprimees | `03_colonnes_sync.sql:63-74` |
| Gestion erreurs silencieuse | `supabase-client.js:52-61` |

---

### Points positifs

- Structure HTML semantique propre
- Bonne base de CSS custom properties
- Design responsive mobile-first
- RLS activee sur Supabase
- Approche RGPD-first
- Player handpan interactif bien implemente
- Systeme de partials fonctionnel

---

## Plan d'action

### Phase 1 : Securite (Semaine 1)

1. Deplacer les identifiants Supabase vers variables d'environnement
2. Implementer hash de mot de passe cote serveur (bcrypt via Netlify Function)
3. Supprimer les identifiants par defaut du code source
4. Ajouter validation des entrees pour les requetes de recherche
5. Corriger les vulnerabilites XSS (audit de tous les `innerHTML`)

### Phase 2 : Corrections bugs (Semaine 2)

1. Corriger erreur syntaxe `location.html:406`
2. Creer `mentions-legales.html` et `cgv.html`
3. Corriger imbrication HTML `apprendre.html:1041`
4. Corriger encodage UTF-8 dans `boutique.html`
5. Ajouter alt text a toutes les images

### Phase 3 : Dette technique (Semaines 3-4)

1. Supprimer systeme admin legacy (`gestion*.js`)
2. Decouper `admin-ui.js` en modules plus petits
3. Consolider utilitaires dupliques
4. Ajouter indicateurs focus (`:focus-visible`) a tous les CSS
5. Creer echelle z-index unifiee

### Phase 4 : Architecture (Semaines 5-6)

1. Faire de Supabase la source de verite (supprimer pattern localStorage-first)
2. Implementer gestion erreurs avec notifications utilisateur
3. Restaurer contraintes base de donnees
4. Ajouter politiques RLS par utilisateur
5. Completer integration email ou supprimer TODOs

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
- [ ] Creer pages legales (mentions, CGV)
- [ ] Deplacer identifiants vers variables environnement

### Services externes

| Service | Usage | RGPD |
|---------|-------|------|
| Supabase | Database, Auth | Hebergement EU disponible |
| Brevo | Email | Conforme RGPD |
| Nominatim | Geocodage | Pas de tracking |
| CartoDB | Tuiles carte | Consentement requis |
| reCAPTCHA | Protection spam | Service Google |
| Google Fonts | Typographies | A self-hoster idealement |

---

## Historique des versions

### v3.0 (Fevrier 2026)
- Revue globale du projet
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

*Documentation mise a jour le 3 fevrier 2026*
