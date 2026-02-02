# Mistral Pans - Site Web V3

Site web premium pour Mistral Pans, fabricant artisanal de handpans en Île-de-France.

---

## 🎯 Vision du projet

Un site vitrine haut de gamme qui reflète la qualité artisanale des instruments, avec :
- Une expérience utilisateur fluide sur desktop et mobile
- Un configurateur intelligent avec vérification de faisabilité
- Un système d'administration intégré pour gérer le contenu sans toucher au code
- Une approche RGPD-friendly (minimum de dépendances externes, données en Europe)

---

## 📂 Structure du projet

```
mistralpans-v2/
│
├── 📄 PAGES HTML (à la racine)
│   ├── index.html              # Page d'accueil
│   ├── boutique.html           # Configurateur + Stock
│   ├── commander.html          # Page de commande
│   ├── location.html           # Service de location
│   ├── apprendre.html          # Carte des professeurs IDF
│   ├── galerie.html            # Galerie photos/vidéos
│   ├── blog.html               # Articles SEO
│   ├── article.html            # Template article individuel
│   └── admin.html              # Dashboard administration
│
├── 📁 partials/                # Composants réutilisables (chargés dynamiquement)
│   ├── header.html             # Navigation principale
│   ├── footer.html             # Pied de page complet
│   ├── footer-minimal.html     # Pied de page simplifié
│   └── contact-modal.html      # Modal de contact
│
├── 📁 css/
│   ├── style.css               # Styles globaux
│   ├── boutique.css            # Styles configurateur + swipe navigation
│   ├── admin.css               # Styles admin (FAB, modals)
│   └── teacher-form.css        # Styles formulaire professeur
│
├── 📁 js/
│   ├── main.js                 # Navigation, modals, chargement partials
│   ├── handpan-player.js       # Player audio SVG interactif
│   ├── feasibility-module.js   # Système de faisabilité des configurations
│   ├── admin-core.js           # Système admin centralisé (Auth, FAB, Storage)
│   ├── apprendre-admin.js      # Admin page Professeurs
│   ├── boutique-admin.js       # Admin page Boutique (stock)
│   ├── galerie-admin.js        # Admin page Galerie
│   ├── blog-admin.js           # Admin page Blog (WYSIWYG)
│   ├── teacher-form.js         # Formulaire inscription professeur
│   ├── messages.js             # Gestion des messages/contacts
│   ├── upload.js               # Gestion des uploads
│   └── mistral-stats.js        # Statistiques admin
│
├── 📁 php/
│   ├── upload.php              # Backend upload fichiers
│   └── delete.php              # Backend suppression fichiers
│
├── 📁 ressources/
│   ├── images/
│   └── audio/                  # Samples FLAC
│
├── README.md
├── READMEv2.md
├── READMEv3.md                 # Ce fichier
└── ADMIN_SPEC.md               # Spécifications système admin (référence historique)
```

---

## 🚀 Lancer le site en local

⚠️ **Important** : Le site utilise `fetch()` pour charger les partials. Il **ne fonctionnera pas** en ouvrant directement les fichiers HTML (double-clic).

### Option 1 : Python (recommandé)
```bash
cd "chemin/vers/ton/projet"
python -m http.server 8000
```
Puis ouvre http://localhost:8000

### Option 2 : VS Code + Live Server
1. Installe l'extension "Live Server"
2. Clic droit sur `index.html` → "Open with Live Server"

### Option 3 : Node.js
```bash
npx serve .
```

---

## 🧩 Système de Partials

Les composants communs (header, footer, modal contact) sont chargés dynamiquement par JavaScript depuis le dossier `partials/`.

### Fonctionnement

1. Chaque page HTML contient des conteneurs vides :
```html
<div id="site-header"></div>
<!-- contenu de la page -->
<div id="site-footer"></div>
<div id="contact-modal-container"></div>
```

2. `main.js` charge automatiquement les fichiers depuis `partials/` au chargement de la page

3. La navigation active est gérée automatiquement via l'attribut `data-page` sur chaque lien du header

### Footer minimal

Pour les pages avec un footer simplifié (ex: commander.html), ajouter sur le body :
```html
<body data-footer="minimal">
```

### Pages avec modal spécifique

`location.html` a son propre modal de réservation intégré directement dans la page (pas de `contact-modal-container`).

### Configuration

Le chemin des partials est configurable dans `main.js` :
```javascript
const PARTIALS_PATH = 'partials/';
```

---

## 🎨 Design System

### Typographies
| Usage | Police | Fallback |
|-------|--------|----------|
| Titres | Fraunces | Georgia, serif |
| Corps | Inter | system-ui, sans-serif |
| Code/Notes | JetBrains Mono | monospace |

### Couleurs principales
| Variable | Valeur | Usage |
|----------|--------|-------|
| `--color-accent` | `#0D7377` | Accent principal (teal) |
| `--color-bg` | `#FDFBF7` | Fond clair |
| `--color-bg-dark` | `#1A1815` | Fond sombre |
| `--color-text` | `#2C2825` | Texte principal |
| `--color-success` | `#4A7C59` | Validation |

### Couleurs Boutique (override)
| Variable | Valeur | Usage |
|----------|--------|-------|
| `--color-bg` | `#FAFAFA` | Fond configurateur |
| `--color-bg-warm` | `#F5F5F5` | Fond section stock |

### Breakpoints responsive
Les breakpoints définissent les seuils où le design s'adapte à la taille d'écran :

| Taille | Cible | Description |
|--------|-------|-------------|
| `> 1024px` | Desktop | Affichage complet, multi-colonnes |
| `768px - 1024px` | Tablette | Layout adapté, certains éléments empilés |
| `500px - 768px` | Mobile large | Navigation hamburger, colonnes simples |
| `< 500px` | Mobile | Affichage minimal, tout empilé |

---

## 📄 Description des pages

### 🏠 index.html - Accueil
- Hero avec image de fond
- 3 cartes "triangle" (Apprendre, Location, Boutique)
- Section atelier avec statistiques
- Logos partenaires

### 🛒 boutique.html - Configurateur + Stock

**Structure double panneau :**
- **Panel 1 : Configurateur** - Configuration sur mesure
- **Panel 2 : Stock** - Instruments disponibles immédiatement

**Navigation :**
- **Mobile (≤768px)** : Swipe horizontal entre les deux panels + tabs en haut
- **Desktop (>768px)** : Scroll vertical + bandeau teal sticky intelligent

**Bandeau de navigation (desktop)** :
- Position sticky sous le header
- Change de texte selon la position de scroll :
  - En haut : "Instruments en stock ↓" avec badge compteur
  - Collé : "Créer sur mesure ↑"

**Admin** : Gestion des annonces stock

### 📦 commander.html - Commande
- Résumé du produit configuré
- Options : Acompte (300€) ou RDV
- Formulaires de contact
- Footer minimal

### 🎵 location.html - Location
- Présentation du service (60€/mois, caution 1150€)
- Conditions et FAQ accordéon
- Modal de réservation

### 👨‍🏫 apprendre.html - Professeurs
- Carte Leaflet interactive (avec consentement RGPD)
- Fiches professeurs avec boutons contact
- Formulaire "Rejoindre le réseau" (avec reCAPTCHA)
- **Admin** : CRUD professeurs, gestion demandes

### 🖼️ galerie.html - Galerie
- Mosaïque responsive photos/vidéos
- Lightbox fullscreen
- **Admin** : gestion des médias

### 📝 blog.html - Blog
- Grille d'articles
- Section newsletter
- **Admin** : éditeur WYSIWYG Quill.js

### 🔐 admin.html - Dashboard
- Interface centralisée de gestion
- Onglets : Stock, Professeurs, Galerie, Blog, Messages, Stats

---

## 💰 Système de Tarification

### Prix de base
| Élément | Prix |
|---------|------|
| Note standard | 115€ |
| Note en octave 2 | +50€ par note |
| Instrument avec bottoms | +25€ (forfait) |

### Malus par taille
| Taille | Malus |
|--------|-------|
| 53 cm | 0% |
| 50 cm | +2.5% |
| 45 cm | +5% |

### Malus par difficulté
| Status | Malus |
|--------|-------|
| OK | 0% |
| Warning | +5% |
| Difficult | +10% |

### Arrondi
Tous les prix sont arrondis à la **tranche de 5€ inférieure**.

### Exemples de calcul

**D Kurd 9 notes en D3 (53cm, OK)**
- 9 × 115€ = 1 035€
- Arrondi → **1 035€**

**F2 Amara 9 notes (53cm, Difficult)**
- 9 × 115€ + 50€ (F2) = 1 085€
- × 1.10 (difficult) = 1 193,50€
- Arrondi → **1 190€**

---

## 🔧 Système de Faisabilité

Le module `feasibility-module.js` vérifie automatiquement si une configuration est réalisable.

### Critères de vérification
1. **Surface des notes** sur la tôle supérieure (les bottoms ne comptent pas)
2. **Notes en conflit avec la cavité** selon la taille

### Notes interdites par taille
| Taille | Note interdite | Raison |
|--------|----------------|--------|
| 53 cm | A#4 | Conflit géométrique avec la cavité |
| 50 cm | B4 | Conflit géométrique avec la cavité |
| 45 cm | C#5 | Conflit géométrique avec la cavité |

⚠️ Ces interdictions ne sont **pas cumulatives**. Un A#4 est possible sur 50cm et 45cm.

### Seuils de faisabilité
| Status | % Surface | Effet UI | Effet prix |
|--------|-----------|----------|------------|
| OK | ≤ 45% | Normal | 0% |
| Warning | 45-50% | Hint "Configuration avancée" | +5% |
| Difficult | 50-59% | Bouton "Vérifier la faisabilité" | +10% |
| Impossible | > 59% | Chip grisée, bouton bloqué | N/A |

### Comportement des chips tonalité
- **Blanc** : Configuration OK ou Warning
- **Grisé** : Configuration impossible (non cliquable)

### Bouton Commander
| Status | Texte | Action |
|--------|-------|--------|
| OK / Warning | "Commander cet instrument" | Lien vers commander.html |
| Difficult | "Vérifier la faisabilité" | Ouvre modale contact pré-remplie |
| Impossible | "Configuration non réalisable" | Bloqué + alerte |

### Message pré-rempli (Difficult)
```
Bonjour,

Je serais intéressé par un D Kurd 11 notes (53cm).

Pouvez-vous me renseigner sur la faisabilité de cette configuration ?

Merci !
```

---

## 🎹 Système Audio

### Format et emplacement
- Format : FLAC
- Dossier : `ressources/audio/`
- Nommage : `[Note][s][Octave].flac` (s pour dièse)
  - Exemple : C#4 → `Cs4.flac`, Bb3 → `As3.flac`

### Notes disponibles
```
Octave 2 : E2, F2, Fs2, G2, Gs2, A2, As2, B2
Octave 3 : C3, Cs3, D3, Ds3, E3, F3, Fs3, G3, Gs3, A3, As3, B3
Octave 4 : C4, Cs4, D4, Ds4, E4, F4, Fs4, G4, Gs4, A4, As4, B4
Octave 5 : C5, Cs5, D5, Ds5, E5, F5
```

---

## 🔐 Système d'Administration

### Architecture
- **admin-core.js** : Module centralisé (Auth, FAB, Modal, Toast, Storage)
- **[page]-admin.js** : Intégrations spécifiques par page

### FAB (Floating Action Button)
Chaque page affiche un FAB flottant en bas à droite quand l'admin est connecté :
- Menu d'actions contextuel
- Badge avec nombre de demandes en attente
- Lien vers le panneau admin complet

### Accès
- **URL** : `/admin.html` ou via le FAB sur chaque page
- **Identifiants par défaut** : `admin` / `mistral2024`

### Modifier le mot de passe
Dans `admin-core.js`, modifier :
```javascript
CONFIG.ADMIN_PASS_HASH = simpleHash('nouveau-mot-de-passe');
```

### Stockage localStorage
| Clé localStorage | Usage |
|------------------|-------|
| `mistral_admin_session` | Session admin (expire 24h) |
| `mistral_flash_annonces` | Annonces boutique |
| `mistral_teachers` | Professeurs validés |
| `mistral_pending_teachers` | Demandes en attente |
| `mistral_gallery` | Médias galerie |
| `mistral_blog_articles` | Articles blog |
| `mistral_leaflet_consent` | Consentement carte RGPD |

---

## 👨‍🏫 Gestion des Professeurs

### Structure des données
```javascript
{
  id: 1,
  name: "Prénom Nom",
  location: "Paris (75011)",
  lat: 48.8566,
  lng: 2.3522,
  bio: "Description...",
  email: "email@example.com",
  phone: "06 12 34 56 78",
  photo: "data:image/jpeg;base64,...",
  courseTypes: ["domicile", "studio", "distance"],
  courseFormats: ["solo", "groupe"],
  instrumentAvailable: true,
  website: "https://...",
  instagram: "@compte",
  facebook: "url",
  youtube: "url",
  tiktok: "@compte"
}
```

### Géocodage automatique
L'API Nominatim (OpenStreetMap) convertit le code postal + ville en coordonnées GPS.

### Workflow des demandes
1. Visiteur remplit le formulaire "Rejoindre le réseau"
2. Validation reCAPTCHA
3. Demande stockée dans `mistral_pending_teachers`
4. Admin voit le badge sur le FAB
5. Admin approuve → transfert vers `mistral_teachers`
6. Admin rejette → suppression

---

## 🗺️ Carte Leaflet (RGPD)

La carte des professeurs utilise Leaflet + tuiles CartoDB Positron. Pour respecter le RGPD :
- Affichage initial : overlay de consentement
- Message explicatif sur les données transmises (IP)
- Chargement de la carte uniquement après validation
- Consentement mémorisé en localStorage

---

## ⚠️ Notes importantes

### Serveur local obligatoire
Le site utilise `fetch()` pour charger les partials. **Ne fonctionne pas** en `file://`.

### Cloudflare Email Protection
Si le site est hébergé derrière Cloudflare, désactiver "Email Address Obfuscation" (Security → Settings).

### Dépendances externes
| Ressource | Usage | CDN |
|-----------|-------|-----|
| Leaflet 1.9.4 | Carte interactive | unpkg.com |
| Quill.js | Éditeur WYSIWYG | cdn.quilljs.com |
| Google Fonts | Typographies | fonts.googleapis.com |
| reCAPTCHA | Protection spam formulaires | google.com/recaptcha |

---

## 🚀 Déploiement

### Hébergement
- OVH (nom de domaine + hébergement mutualisé)
- Site statique avec quelques scripts PHP pour les uploads

### Checklist pré-production
- [ ] Vérifier l'encodage UTF-8 de tous les fichiers
- [ ] Ajouter les images dans `ressources/images/`
- [ ] Ajouter les samples audio dans `ressources/audio/`
- [ ] Changer le mot de passe admin
- [ ] Configurer reCAPTCHA (clé site)
- [ ] Optimiser les images (WebP)
- [ ] Tester responsive sur vrais appareils
- [ ] Configurer Swikly pour les dépôts de location à distance

### 📧 Configuration Email
- [ ] Créer l'adresse email pro via l'hébergeur OVH (contact@mistralpans.fr)
- [ ] Configurer le transfert/import vers Gmail personnel (centralisation)
- [ ] Configurer "Envoyer en tant que" dans Gmail (réponses pro)
- [ ] Créer les filtres/libellés Gmail pour séparer pro/perso
- [ ] (Optionnel) Créer une adresse noreply@mistralpans.fr pour les envois automatiques
- [ ] (Futur) Intégrer EmailJS ou service similaire pour envoi automatique (factures, confirmations)

### Services externes
| Service | Usage | Impact RGPD |
|---------|-------|-------------|
| Google Fonts | Typographies | ⚠️ À self-hoster idéalement |
| Leaflet + CartoDB | Carte | ⚠️ Consentement contextuel |
| Nominatim | Géocodage | ✅ Pas de tracking |
| Swikly | Dépôts location | ✅ Service français |
| OVH Mail | Email professionnel | ✅ Hébergement français |
| reCAPTCHA | Anti-spam | ⚠️ Service Google |
| EmailJS | Envoi emails auto (futur) | ⚠️ Vérifier politique données |

---

## 📜 Historique des versions

### v2.5 (Janvier 2025 - actuel)
- ✅ Système de faisabilité des configurations (feasibility-module.js)
- ✅ Nouvelle tarification : 115€/note + malus taille/difficulté
- ✅ Arrondi des prix à la tranche de 5€
- ✅ Bouton "Vérifier la faisabilité" pour configs difficiles
- ✅ Navigation swipe mobile entre Configurateur et Stock
- ✅ Bandeau teal sticky intelligent sur desktop
- ✅ Grille mosaïque pour les annonces stock

### v2.4 (Janvier 2025)
- ✅ Suppression du système de build Node.js
- ✅ Chargement dynamique des partials
- ✅ Navigation active automatique
- ✅ Support footer minimal via data-attribute

### v2.3 (Janvier 2025)
- ✅ FAB admin avec menu d'actions sur toutes les pages
- ✅ Géocodage automatique des professeurs (Nominatim)
- ✅ Upload photo de profil (base64)
- ✅ Formulaires complets (code postal, ville, réseaux sociaux)

### v2.2 (Janvier 2025)
- ✅ Système admin centralisé (admin-core.js)
- ✅ Admin galerie (gestion médias)
- ✅ Admin blog (éditeur WYSIWYG Quill.js)
- ✅ Consentement RGPD Leaflet

### v2.1 (Janvier 2025)
- ✅ Système admin page Apprendre
- ✅ Gestion demandes professeurs
- ✅ CRUD professeurs localStorage

### v2.0
- ✅ Refonte design complète
- ✅ Configurateur SVG interactif
- ✅ Système de gammes musicales
- ✅ Audio samples FLAC

---

## 🔮 Roadmap

### Court terme
- [ ] 📧 Setup email professionnel (contact@mistralpans.fr)
- [ ] 📧 Centralisation Gmail avec identité pro
- [ ] 🔒 Intégration reCAPTCHA sur formulaire professeurs
- [ ] 🔒 reCAPTCHA sur formulaire de contact (optionnel)

### Moyen terme
- [ ] 📧 Envoi automatique de factures (EmailJS ou similaire)
- [ ] 📧 Notifications email pour nouvelles demandes (professeurs, locations)
- [ ] 📊 Analytics basiques (respectueux RGPD)

### Long terme
- [ ] 💾 Migration localStorage → base de données (si nécessaire)
- [ ] 🔔 Système de notifications admin

---

## 📞 Contact

- **Site** : mistralpans.fr
- **Email** : contact@mistralpans.fr
- **Localisation** : Île-de-France

---

*Créé avec ❤️ pour Mistral Pans*
