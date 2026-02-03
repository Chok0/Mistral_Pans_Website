# CLAUDE.md - AI Assistant Guide for Mistral Pans Website

> **Last Updated:** February 2026
> **Project:** Mistral Pans - Premium Handpan Artisan Website
> **Stack:** Vanilla JS + HTML/CSS + Supabase + Netlify Functions

---

## Quick Start

```bash
# Run local development server (required - fetch() won't work on file://)
python -m http.server 8000

# Alternative: VS Code Live Server extension or npx serve .
```

---

## Project Overview

This is a **static-first, progressively-enhanced** website for Mistral Pans, an artisanal handpan manufacturer in Île-de-France, France.

**Key characteristics:**
- No build system - direct file serving with dynamic component loading
- Vanilla JavaScript (ES6+) - no heavy frameworks
- Supabase backend for data persistence (PostgreSQL + Auth)
- RGPD-first approach (GDPR compliance, minimal external dependencies)
- French language throughout the codebase and UI

---

## Directory Structure

```
/
├── *.html                    # Main pages (root level)
├── partials/                 # Reusable HTML components (loaded via fetch)
│   ├── header.html          # Navigation header
│   ├── footer.html          # Main footer
│   ├── footer-minimal.html  # Compact footer (checkout page)
│   └── contact-modal.html   # Reusable contact modal
├── css/
│   ├── style.css            # Global design system (1,761 lines)
│   ├── boutique.css         # Configurator + stock styles
│   ├── admin.css            # Admin dashboard styles
│   ├── gestion.css          # Legacy management (deprecated)
│   └── teacher-form.css     # Teacher signup form
├── js/
│   ├── main.js              # Core: partial loading, navigation
│   ├── admin-core.js        # Admin: auth, FAB, CRUD utilities
│   ├── admin-ui.js          # Admin UI components (4,711 lines)
│   ├── handpan-player.js    # SVG interactive handpan + audio
│   ├── feasibility-module.js # Configuration validation
│   ├── supabase-client.js   # Supabase initialization
│   ├── supabase-auth.js     # Authentication module
│   ├── supabase-sync.js     # Real-time data sync
│   ├── *-admin.js           # Page-specific admin modules
│   └── *.js                 # Other page-specific modules
├── php/
│   ├── upload.php           # File upload processing
│   └── delete.php           # File deletion
├── sql/
│   ├── 01_schema.sql        # Supabase database schema
│   ├── 02_rls_policies.sql  # Row-level security policies
│   └── 03_colonnes_sync.sql # Column synchronization
├── ressources/
│   ├── images/              # Product photos, logos, brand assets
│   └── audio/               # FLAC audio samples (50+ notes)
├── netlify/functions/
│   └── send-email.js        # Brevo SMTP email function
├── READMEv3.md              # Main documentation (French)
└── ADMIN_SPEC.md            # Admin system specifications
```

---

## Key Files Reference

### HTML Pages

| Page | Purpose | Key Features |
|------|---------|--------------|
| `index.html` | Homepage | Hero, features, partners |
| `boutique.html` | Shop/Configurator | SVG handpan player, pricing calculator, stock grid |
| `commander.html` | Order page | Order form, payment options |
| `location.html` | Rental service | Rental terms, deposit info (Swikly) |
| `apprendre.html` | Teacher directory | Leaflet map with RGPD consent, teacher cards |
| `galerie.html` | Gallery | Responsive mosaic, lightbox |
| `blog.html` | Blog | Article grid, newsletter signup |
| `article.html` | Article template | Dynamic content loading |
| `admin.html` | Admin dashboard | Tabs: Stock, Teachers, Gallery, Blog, Messages, Stats |

### Core JavaScript Files

| File | Purpose | Key Exports/Functions |
|------|---------|----------------------|
| `main.js` | App bootstrap | `loadPartials()`, `setActivePage()`, `initSupabaseSync()` |
| `admin-core.js` | Admin system | `isAdminLoggedIn()`, `injectAdminFAB()`, CRUD helpers |
| `handpan-player.js` | Instrument UI | `HandpanPlayer` class, Web Audio API |
| `feasibility-module.js` | Config validation | `checkFeasibility()`, surface calculations |
| `supabase-sync.js` | Data sync | `syncFromSupabase()`, real-time updates |

---

## Technology Stack

### Frontend
- **Core:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Styling:** CSS custom properties, mobile-first responsive
- **Typography:** Fraunces (display), Inter (body), JetBrains Mono (code)

### External Libraries (CDN)
- **Supabase JS SDK 2.x** - Database/Auth
- **Leaflet 1.9.4** - Maps
- **Quill.js** - WYSIWYG editor (blog)
- **Google reCAPTCHA v3** - Form protection

### Backend Services
- **Database:** Supabase PostgreSQL with RLS
- **Email:** Brevo SMTP via Netlify Functions
- **Hosting:** OVH Mutualisé (supports PHP)
- **Serverless:** Netlify Functions

---

## Design System

### CSS Custom Properties

```css
/* Colors */
--color-accent: #0D7377;      /* Primary teal */
--color-bg: #FDFBF7;          /* Warm cream background */
--color-bg-dark: #1A1815;     /* Near black */
--color-text: #2C2825;        /* Dark brown text */
--color-success: #4A7C59;     /* Sage green */
--color-warning: #F59E0B;     /* Amber */
--color-error: #EF4444;       /* Red */

/* Boutique overrides */
--color-bg: #FAFAFA;          /* Light gray */
--color-bg-warm: #F5F5F5;     /* Stock section */
```

### Responsive Breakpoints

| Breakpoint | Target | Description |
|------------|--------|-------------|
| `> 1024px` | Desktop | Full multi-column layout |
| `768-1024px` | Tablet | Adapted layout |
| `500-768px` | Mobile large | Single column, hamburger nav |
| `< 500px` | Mobile | Minimal, all stacked |

---

## Development Patterns

### Page Template Structure

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title | Mistral Pans</title>
  <link rel="stylesheet" href="css/style.css">
  <!-- page-specific CSS if needed -->
</head>
<body data-page="page-name">
  <!-- Dynamic header -->
  <div id="site-header"></div>

  <main>
    <!-- Page content -->
  </main>

  <!-- Dynamic footer -->
  <div id="site-footer"></div>

  <!-- Contact modal container -->
  <div id="contact-modal-container"></div>

  <!-- Scripts -->
  <script src="js/main.js"></script>
  <script src="js/page-specific.js"></script>
</body>
</html>
```

### Partial Loading System

Partials are loaded dynamically via `main.js`:
```javascript
// main.js handles:
// 1. Loading partials from partials/ directory
// 2. Setting active navigation via data-page attribute
// 3. Initializing Supabase sync
```

For minimal footer (e.g., checkout page):
```html
<body data-footer="minimal">
```

### Admin System Pattern

```javascript
// Check admin status
if (window.MistralAdmin && MistralAdmin.isLoggedIn()) {
  // Show admin UI
}

// FAB injection on admin pages
MistralAdmin.injectFAB({
  actions: [...],
  advancedLink: '/admin.html#section'
});
```

---

## Database Schema (Supabase)

### Main Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `clients` | Customers | nom, email, telephone, adresse |
| `instruments` | Inventory | reference, gamme, tonalite, taille, prix_vente, statut |
| `locations` | Rentals | client_id, instrument_id, dates, loyer, caution |
| `commandes` | Orders | client_id, specifications (JSON), montant, statut |
| `factures` | Invoices | numero (auto), lignes (JSON), montant_ttc |
| `professeurs` | Teachers | nom, location, lat/lng, email, photo, course_types |
| `galerie` | Media | type, src, thumbnail, ordre, featured |
| `articles` | Blog posts | slug, title, content (HTML), status, tags |
| `accessoires` | Accessories | nom, prix, quantite_stock |
| `configuration` | Settings | key/value pairs |

### Row-Level Security

- **Public read:** Active teachers, published articles, online instruments, gallery
- **Public insert:** Teacher applications (pending status)
- **Authenticated:** Full CRUD access for admin operations

---

## Pricing System

### Base Pricing
- **Standard note:** 115€
- **Octave 2 note:** +50€ per note
- **Bottoms (bass notes):** +25€ flat

### Size Malus
| Size | Malus |
|------|-------|
| 53 cm | 0% |
| 50 cm | +2.5% |
| 45 cm | +5% |

### Difficulty Malus (Feasibility)
| Status | Surface % | Malus |
|--------|-----------|-------|
| OK | ≤ 45% | 0% |
| Warning | 45-50% | +5% |
| Difficult | 50-59% | +10% |
| Impossible | > 59% | N/A (blocked) |

**Rounding:** All prices rounded down to nearest 5€.

---

## Audio System

- **Format:** FLAC
- **Location:** `ressources/audio/`
- **Naming:** `[Note][s][Octave].flac` (s for sharp)
  - Example: `Cs4.flac` for C#4, `As3.flac` for A#3/Bb3

**Available range:** E2 to F5 (50+ samples)

---

## Coding Conventions

### JavaScript
- ES6+ syntax (arrow functions, const/let, template literals)
- Module pattern with IIFE or explicit namespace (`window.ModuleName`)
- Async/await for asynchronous operations
- Comments in French or English (codebase is mixed)

### CSS
- Use CSS custom properties for theming
- Mobile-first responsive approach
- BEM-like naming for component classes
- Prefix admin classes with `admin-`

### HTML
- Semantic HTML5 elements
- `data-*` attributes for JavaScript hooks
- French for user-facing content

### File Naming
- Lowercase with hyphens: `page-name.html`, `module-name.js`
- Admin modules: `*-admin.js`
- Supabase modules: `supabase-*.js`

---

## Common Tasks

### Adding a New Page
1. Create `pagename.html` at root with standard template
2. Add `data-page="pagename"` to body
3. Add navigation link to `partials/header.html`
4. Create `js/pagename.js` if needed
5. Create `css/pagename.css` if needed

### Modifying Admin Functionality
1. Core logic goes in `js/admin-core.js`
2. UI components in `js/admin-ui.js`
3. Page-specific admin in `js/pagename-admin.js`
4. Admin styles in `css/admin.css`

### Working with Supabase
```javascript
// Client is initialized in supabase-client.js
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value);
```

### Adding Audio Samples
1. Convert to FLAC format
2. Name as `[Note][s][Octave].flac`
3. Place in `ressources/audio/`
4. Update `handpan-player.js` if adding new note range

---

## Important Notes

### Server Required
The site uses `fetch()` for partials. **Will not work with `file://` protocol.**

### Cloudflare Consideration
If hosted behind Cloudflare, disable "Email Address Obfuscation" in Security settings.

### localStorage Keys
| Key | Purpose |
|-----|---------|
| `mistral_admin_session` | Admin session (24h expiry) |
| `mistral_flash_annonces` | Stock announcements |
| `mistral_teachers` | Validated teachers |
| `mistral_pending_teachers` | Pending teacher requests |
| `mistral_gallery` | Gallery media |
| `mistral_blog_articles` | Blog articles |
| `mistral_leaflet_consent` | Map RGPD consent |

### Default Admin Credentials
- Username: `admin`
- Password: `mistral2024`
- Change in `admin-core.js`: `CONFIG.ADMIN_PASS_HASH = simpleHash('new-password')`

---

## External Services & APIs

| Service | Usage | RGPD Impact |
|---------|-------|-------------|
| Supabase | Database, Auth | EU hosting available |
| Brevo | Email delivery | GDPR compliant |
| Nominatim | Geocoding | No tracking |
| CartoDB Positron | Map tiles | Consent required |
| Google reCAPTCHA | Bot protection | Google service |
| Google Fonts | Typography | Consider self-hosting |

---

## Deployment

### Hosting: OVH Mutualisé
- PHP support for upload/delete scripts
- Static file serving
- SSL/TLS included

### Pre-deployment Checklist
- [ ] Change default admin password
- [ ] Configure reCAPTCHA keys
- [ ] Verify UTF-8 encoding
- [ ] Optimize images (WebP)
- [ ] Test on real mobile devices
- [ ] Configure Swikly for rental deposits
- [ ] Set up email forwarding (contact@mistralpans.fr)

---

## Git Workflow

The project uses feature branches prefixed with `claude/` for AI-assisted development.

```bash
# Current branch pattern
claude/claude-md-{session-id}

# Commit messages should be in French or English, descriptive
git commit -m "Add feasibility module for configuration validation"
```

---

## Troubleshooting

### Partials not loading
- Ensure running via HTTP server, not `file://`
- Check browser console for fetch errors
- Verify `partials/` directory exists

### Admin FAB not showing
- Check `isAdminLoggedIn()` returns true
- Verify `admin-core.js` is loaded
- Check localStorage for valid session

### Supabase sync issues
- Verify Supabase URL and anon key in `supabase-client.js`
- Check browser network tab for failed requests
- Verify RLS policies allow the operation

### Audio not playing
- Check file exists in `ressources/audio/`
- Verify FLAC format and correct naming
- Check browser console for Web Audio API errors

---

## Version History

- **v2.5** (Jan 2025): Feasibility module, new pricing, mobile swipe navigation
- **v2.4**: Removed Node build, dynamic partials
- **v2.3**: Admin FAB, Nominatim geocoding, photo uploads
- **v2.2**: Centralized admin, Quill.js blog editor
- **v2.1**: Teacher admin system
- **v2.0**: Complete redesign, SVG handpan player

---

## Contact

- **Website:** mistralpans.fr
- **Email:** contact@mistralpans.fr
- **Location:** Île-de-France, France
