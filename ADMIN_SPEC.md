# Système d'Administration - Spécifications

Document de cadrage pour le développement du système de gestion admin Mistral Pans.

---

## 🎯 Objectifs

### Vision
Permettre la gestion complète du contenu du site sans intervention technique, directement depuis l'interface web en mode connecté.

### Principes directeurs
1. **Édition en contexte** : modifications visibles immédiatement sur la page
2. **Actions rapides accessibles** : roue dentée sur chaque page concernée
3. **Fonctions avancées centralisées** : dashboard admin pour l'édition complète
4. **Code maintenable** : logique admin mutualisée dans un fichier JS unique

---

## 🏗️ Architecture

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                        admin-core.js                            │
│  (authentification, composants UI, CRUD générique, utilitaires) │
└─────────────────────────────────────────────────────────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Boutique │   │ Apprendre│   │ Galerie  │   │   Blog   │
    │   🔧     │   │    🔧    │   │    🔧    │   │    🔧    │
    └──────────┘   └──────────┘   └──────────┘   └──────────┘
           │              │              │              │
           └──────────────┴──────────────┴──────────────┘
                                  │
                                  ▼
                         ┌──────────────┐
                         │  admin.html  │
                         │  (Dashboard) │
                         │              │
                         │ ┌──────────┐ │
                         │ │  Stock   │ │
                         │ ├──────────┤ │
                         │ │  Profs   │ │
                         │ ├──────────┤ │
                         │ │ Galerie  │ │
                         │ ├──────────┤ │
                         │ │   Blog   │ │
                         │ └──────────┘ │
                         └──────────────┘
```

### Fichiers impliqués

| Fichier | Rôle |
|---------|------|
| `js/admin-core.js` | Logique partagée (auth, UI, CRUD) |
| `admin.html` | Dashboard central avec onglets |
| `boutique.html` | Intègre admin stock (existant + améliorations) |
| `apprendre.html` | Intègre admin professeurs |
| `galerie.html` | Intègre admin médias |
| `blog.html` | Intègre admin articles |

---

## 🔐 Authentification

### Mécanisme actuel (localStorage)
```javascript
// Connexion
localStorage.setItem('mistral_admin_session', JSON.stringify({
  user: 'admin',
  expiry: Date.now() + 86400000  // 24h
}));

// Vérification
function isAdminLoggedIn() {
  const session = JSON.parse(localStorage.getItem('mistral_admin_session'));
  return session && session.expiry > Date.now();
}
```

### Migration Supabase (future)
```javascript
// À implémenter
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@mistralpans.fr',
  password: '***'
});
```

### Interface de connexion
- Page : `admin.html`
- Champs : utilisateur + mot de passe
- Redirection post-connexion : dashboard ou page d'origine

---

## 🔧 Composant Roue Dentée

### Apparence
```
Position : fixed, bottom-right (24px margin)
Taille : 48px
Style : cercle, fond accent, icône engrenage blanche
Animation : rotation légère au hover
Visibilité : uniquement si admin connecté
```

### Comportement
```javascript
// Injection automatique si admin connecté
if (isAdminLoggedIn()) {
  injectAdminFAB({
    actions: [...],           // Actions rapides
    advancedLink: '/admin.html#onglet'  // Lien vers gestion complète
  });
}
```

### Structure HTML générée
```html
<div class="admin-fab" id="admin-fab">
  <button class="admin-fab__trigger" aria-label="Administration">
    <svg><!-- icône engrenage --></svg>
  </button>
  <div class="admin-fab__menu">
    <button data-action="action1">Action 1</button>
    <button data-action="action2">Action 2</button>
    <a href="/admin.html#stock">Gestion complète →</a>
  </div>
</div>
```

---

## 📦 Module : Stock (Boutique)

### Fonctionnalités

| Fonction | Roue dentée (boutique.html) | Dashboard (admin.html) |
|----------|----------------------------|------------------------|
| Voir annonces actives | ✅ | ✅ |
| Activer/désactiver annonce | ✅ | ✅ |
| Modifier prix/description | ✅ | ✅ |
| Créer nouvelle annonce | ✅ | ✅ |
| Supprimer annonce | ✅ | ✅ |
| Utiliser un template | ❌ | ✅ |
| Dupliquer une annonce | ❌ | ✅ |

### Structure de données
```javascript
{
  id: 'annonce_001',
  active: true,
  title: 'D Kurd 9 notes - Disponible',
  gamme: 'kurd',
  tonalite: 'D3',
  notes: 9,
  taille: 53,
  prix: 1380,
  description: 'Prêt à partir...',
  images: ['url1.jpg', 'url2.jpg'],
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-20T14:30:00Z'
}
```

### Clé localStorage
`mistral_flash_annonces` → Array d'annonces

---

## 👨‍🏫 Module : Professeurs (Apprendre)

### Fonctionnalités

| Fonction | Roue dentée (apprendre.html) | Dashboard (admin.html) |
|----------|------------------------------|------------------------|
| Voir demandes en attente | ✅ | ✅ |
| Approuver demande (1 clic) | ✅ | ✅ |
| Rejeter demande (1 clic) | ✅ | ✅ |
| Voir liste professeurs | ✅ | ✅ |
| Éditer fiche professeur | ❌ (lien vers admin) | ✅ |
| Supprimer professeur | ❌ (lien vers admin) | ✅ |
| Ajouter manuellement | ❌ | ✅ |

### Structure de données
```javascript
// Professeur validé
{
  id: 'prof_001',
  name: 'Jean Dupont',
  location: 'Paris 11e',
  lat: 48.8566,
  lng: 2.3522,
  bio: 'Passionné de handpan depuis...',
  email: 'jean@example.com',
  phone: '06 12 34 56 78',
  photo: '/ressources/images/profs/jean.jpg',
  courseTypes: ['domicile', 'studio', 'distance'],
  courseFormats: ['solo', 'groupe'],
  instrumentAvailable: true,
  socials: {
    website: 'https://...',
    instagram: '@jean_handpan',
    youtube: null,
    facebook: null
  },
  createdAt: '2025-01-10T09:00:00Z',
  status: 'active'
}

// Demande en attente
{
  ...mêmes champs,
  status: 'pending',
  submittedAt: '2025-01-20T16:45:00Z'
}
```

### Clés localStorage
- `mistral_teachers` → Professeurs validés
- `mistral_pending_teachers` → Demandes en attente

---

## 🖼️ Module : Galerie

### Fonctionnalités

| Fonction | Roue dentée (galerie.html) | Dashboard (admin.html) |
|----------|---------------------------|------------------------|
| Réordonner (drag & drop) | ✅ | ✅ |
| Supprimer média | ✅ | ✅ |
| Modifier légende/infos | ✅ | ✅ |
| Uploader nouveau média | ❌ | ✅ |
| Configurer source vidéo | ❌ | ✅ |

### Structure de données
```javascript
{
  id: 'media_001',
  type: 'image',  // 'image' | 'video'
  src: '/ressources/images/galerie/handpan-001.jpg',
  thumbnail: '/ressources/images/galerie/thumbs/handpan-001.jpg',
  title: 'D Kurd - Finition cuivre',
  description: 'Handpan 9 notes, gamme Kurd en Ré',
  gamme: 'kurd',
  ordre: 1,
  featured: false,  // Pour section "Pan Concert"
  createdAt: '2025-01-05T11:00:00Z'
}

// Pour les vidéos
{
  id: 'media_002',
  type: 'video',
  src: '/ressources/videos/demo-amara.mp4',
  thumbnail: '/ressources/images/galerie/thumbs/demo-amara.jpg',
  title: 'Démonstration Amara',
  duration: '2:34',
  ...
}
```

### Clé localStorage
`mistral_gallery` → Array de médias ordonnés

### Upload des fichiers
- **Phase 1 (localStorage)** : stockage du chemin, fichier uploadé manuellement via FTP
- **Phase 2 (Supabase)** : upload direct via Supabase Storage

---

## 📝 Module : Blog

### Fonctionnalités

| Fonction | Roue dentée (blog.html) | Dashboard (admin.html) |
|----------|------------------------|------------------------|
| Voir articles | ✅ | ✅ |
| Publier/dépublier | ✅ | ✅ |
| Rédiger nouvel article | Lien → admin | ✅ (éditeur WYSIWYG) |
| Éditer article existant | Lien → admin | ✅ (éditeur WYSIWYG) |
| Supprimer article | ❌ | ✅ |
| Gérer catégories/tags | ❌ | ✅ |

### Structure de données
```javascript
{
  id: 'article_001',
  slug: 'choisir-sa-premiere-gamme',
  title: 'Comment choisir sa première gamme de handpan',
  excerpt: 'Guide complet pour les débutants...',
  content: '<p>Le contenu HTML généré par l\'éditeur WYSIWYG...</p>',
  coverImage: '/ressources/images/blog/gammes-cover.jpg',
  author: 'Mistral Pans',
  category: 'guide',
  tags: ['débutant', 'gammes', 'conseil'],
  status: 'published',  // 'draft' | 'published'
  publishedAt: '2025-01-18T10:00:00Z',
  updatedAt: '2025-01-19T15:30:00Z',
  seo: {
    metaTitle: 'Choisir sa gamme de handpan | Guide Mistral Pans',
    metaDescription: 'Découvrez comment choisir...'
  }
}
```

### Clé localStorage
`mistral_blog_articles` → Array d'articles

### Éditeur WYSIWYG
- **Librairie** : Quill.js (~40KB)
- **Fonctionnalités** :
  - Formatage : gras, italique, titres (H2, H3)
  - Listes : à puces, numérotées
  - Liens
  - Images (insertion inline)
  - Citations
- **Pas de** : tableaux, vidéos embed, code

---

## 🎨 Interface Dashboard (admin.html)

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  HEADER : Logo + "Administration" + Bouton déconnexion      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┬─────────┬─────────┬─────────┐                 │
│  │  Stock  │  Profs  │ Galerie │  Blog   │  ← Onglets      │
│  └─────────┴─────────┴─────────┴─────────┘                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │              CONTENU DE L'ONGLET ACTIF              │   │
│  │                                                     │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Navigation par hash
```
/admin.html          → Onglet Stock (défaut)
/admin.html#stock    → Onglet Stock
/admin.html#profs    → Onglet Professeurs
/admin.html#galerie  → Onglet Galerie
/admin.html#blog     → Onglet Blog
```

### Responsive
- Desktop : onglets horizontaux, contenu large
- Tablette : onglets horizontaux, contenu adapté
- Mobile : onglets en dropdown ou scrollables, contenu empilé

---

## 🔄 Flux de données

### Lecture
```
localStorage → Parse JSON → Affichage UI
```

### Écriture
```
Action utilisateur → Validation → Update state → Stringify → localStorage → Re-render UI
```

### Synchronisation inter-pages
```javascript
// Écouter les changements d'autres onglets
window.addEventListener('storage', (e) => {
  if (e.key === 'mistral_teachers') {
    refreshTeachersList();
  }
});
```

---

## 📋 Plan d'implémentation

### Phase 1 : Fondations
1. ✅ Créer `js/admin-core.js` avec :
   - Système d'authentification
   - Composant FAB (roue dentée)
   - Helpers CRUD localStorage
   - Composants UI réutilisables (modales, formulaires)

2. ✅ Refactoriser `admin.html` :
   - Layout avec onglets
   - Navigation par hash
   - Intégration admin-core.js

### Phase 2 : Modules existants
3. ✅ Finaliser module Stock :
   - Migrer code existant vers admin-core
   - Ajouter templates dans dashboard

4. ✅ Finaliser module Professeurs :
   - Compléter les actions rapides
   - Interface d'édition complète dans dashboard

### Phase 3 : Nouveaux modules
5. ✅ Implémenter module Galerie :
   - Structure de données
   - Upload/gestion médias
   - Réorganisation drag & drop

6. ✅ Implémenter module Blog :
   - Structure de données
   - Intégration Quill.js
   - Liste articles + éditeur

### Phase 4 : Finitions
7. ✅ Tests et ajustements responsive
8. ✅ Documentation utilisateur
9. 🔄 Migration Supabase (post-livraison)

---

## ⚠️ Points d'attention

### Performance
- Lazy loading des onglets admin (charger le contenu au clic)
- Pas de chargement de Quill.js sauf si onglet Blog actif
- Images galerie : pagination ou infinite scroll si > 50 items

### UX
- Feedback visuel sur toutes les actions (loading, succès, erreur)
- Confirmation avant suppression
- Auto-save pour l'éditeur blog (brouillon localStorage)

### Sécurité (temporaire)
- Hash mot de passe côté client = faible mais acceptable en attendant Supabase
- Pas de données sensibles stockées (juste contenu éditorial)

### Compatibilité
- Tester sur Chrome, Firefox, Safari, Edge
- Tester sur iOS Safari et Chrome Android

---

## 📚 Ressources

- **Quill.js** : https://quilljs.com/
- **Supabase** : https://supabase.com/docs
- **Sortable.js** (drag & drop) : https://sortablejs.github.io/Sortable/

---

*Document de référence pour le développement - Mistral Pans v2.2*
