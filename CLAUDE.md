# CLAUDE.md - AI Assistant Guide for Mistral Pans Website

> **Last Updated:** February 2026 (v3.5)
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

This is a **static-first, progressively-enhanced** website for Mistral Pans, an artisanal handpan manufacturer in Ile-de-France, France.

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
│   ├── style.css            # Global design system
│   ├── boutique.css         # Configurator + stock styles
│   ├── admin.css            # Admin styles (FAB, modals, dashboard, gestion)
│   └── teacher-form.css     # Teacher signup form
├── js/
│   ├── core/                # Bootstrap, navigation, configuration
│   │   ├── main.js          # Partial loading, navigation, Supabase init
│   │   ├── config.js        # Supabase keys (gitignored)
│   │   ├── config.example.js # Config template
│   │   └── cookie-consent.js # RGPD cookie consent banner
│   │
│   ├── admin/               # Administration system
│   │   ├── admin-core.js    # Auth, FAB, CRUD, sanitization
│   │   ├── admin-ui-core.js # Navigation, dashboard, todos
│   │   ├── admin-ui-gestion.js  # Clients, instruments, locations
│   │   ├── admin-ui-boutique.js # Shop stock, accessories
│   │   ├── admin-ui-content.js  # Teachers, gallery, blog
│   │   ├── admin-ui-config.js   # Config, export/import
│   │   ├── admin-ui-modals.js   # All CRUD modals
│   │   ├── admin-ui-compta.js   # Accounting, URSSAF
│   │   ├── gestion.js       # Business logic (clients, instruments, etc.)
│   │   ├── gestion-pdf.js   # Invoice PDF generation
│   │   ├── gestion-boutique.js  # Stock management
│   │   ├── apprendre-admin.js   # Teacher admin (page-specific)
│   │   ├── boutique-admin.js    # Shop admin (page-specific)
│   │   ├── galerie-admin.js     # Gallery admin (page-specific)
│   │   └── blog-admin.js        # Blog admin (page-specific)
│   │
│   ├── services/            # External integrations
│   │   ├── supabase-client.js   # Supabase client init
│   │   ├── supabase-auth.js     # Supabase authentication
│   │   ├── supabase-sync.js     # Real-time data sync
│   │   ├── email-client.js      # Brevo email client
│   │   ├── payplug-client.js    # Payplug payments
│   │   └── swikly-client.js     # Swikly deposits
│   │
│   ├── data/                # Static data files
│   │   ├── scales-data.js   # Musical scales + music theory
│   │   ├── gammes-data.js   # Configurator gammes (12 gammes)
│   │   ├── tailles-data.js  # Sizes and dimensions
│   │   └── materiaux-data.js # Materials and properties
│   │
│   ├── features/            # Business modules
│   │   ├── handpan-player.js    # SVG interactive player + Web Audio
│   │   ├── feasibility-module.js # Configuration validation
│   │   ├── upload.js            # File upload processing
│   │   ├── teacher-form.js      # Teacher signup form
│   │   ├── honeypot.js          # Anti-spam honeypot
│   │   └── mistral-stats.js     # Anonymous analytics
│   │
│   └── pages/               # Page-specific logic
│       ├── boutique.js      # Configurator + stock logic
│       └── commander.js     # Order form + payment
│
├── ressources/
│   ├── images/              # Product photos, logos, brand assets
│   └── audio/               # FLAC audio samples (56 notes)
├── netlify/functions/
│   ├── send-email.js        # Brevo SMTP email function
│   ├── payplug-create-payment.js  # Payment creation
│   ├── payplug-webhook.js   # Payment webhooks
│   ├── swikly-create-deposit.js   # Deposit creation
│   ├── swikly-webhook.js    # Deposit webhooks
│   └── order-status.js      # Order tracking endpoint
├── netlify.toml              # Netlify config (headers, redirects, CSP)
├── CLAUDE.md                # This file (AI assistant guide)
└── README.md                # Full project documentation (French)
```

---

## Key Files Reference

### HTML Pages

| Page | Purpose | Key Features |
|------|---------|--------------|
| `index.html` | Homepage | Hero, features, partners |
| `boutique.html` | Shop/Configurator | SVG handpan player, pricing calculator, stock grid |
| `commander.html` | Order page | Order form, payment options (Payplug) |
| `location.html` | Rental service | Rental terms, deposit info (Swikly) |
| `apprendre.html` | Teacher directory | Leaflet map with RGPD consent, teacher cards |
| `galerie.html` | Gallery | Responsive mosaic, lightbox |
| `blog.html` | Blog | Article grid |
| `article.html` | Article template | Dynamic content loading |
| `suivi.html` | Order tracking | Reference + email lookup |
| `admin.html` | Admin dashboard | Groups: Gestion (Commandes, Instruments, Clients, Locations, Factures), Contenu (Vitrine, Galerie, Blog, Professeurs), Outils (Comptabilité, Config) |

### Core JavaScript Files

| File | Location | Key Exports/Functions |
|------|----------|----------------------|
| `main.js` | `js/core/` | `loadPartials()`, `setActivePage()`, dynamic Supabase init |
| `admin-core.js` | `js/admin/` | `Auth.isLoggedIn()`, `FAB.create()`, CRUD helpers |
| `handpan-player.js` | `js/features/` | `HandpanPlayer` class, Web Audio API |
| `feasibility-module.js` | `js/features/` | `checkFeasibility()`, surface calculations |
| `supabase-sync.js` | `js/services/` | `MistralSync.getData()`, `MistralSync.setData()`, in-memory store |

---

## Technology Stack

### Frontend
- **Core:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Styling:** CSS custom properties, mobile-first responsive
- **Typography:** Fraunces (display), Inter (body), JetBrains Mono (code)

### External Libraries (self-hosted in js/vendor/)
- **Supabase JS SDK 2.x** - Database/Auth
- **Leaflet 1.9.4** - Maps
- **Chart.js 4.x** - Admin charts
- **Quill.js 1.3.7** - WYSIWYG editor (blog)

Versions tracked in `js/vendor/versions.json`. Update via `./scripts/update-vendor.sh`.

### External CDN (not self-hostable)
- **PayPlug SDK** - Payment (PCI-DSS requirement, commander.html only)

### Anti-Spam
- **Honeypot** - Invisible form field (no external dependency, RGPD friendly)

### Backend Services
- **Database:** Supabase PostgreSQL with RLS
- **Email:** Brevo SMTP via Netlify Functions
- **Hosting:** Netlify (site) + OVH (domaine)
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
</head>
<body data-page="page-name">
  <div id="site-header"></div>

  <main>
    <!-- Page content -->
  </main>

  <div id="site-footer"></div>
  <div id="contact-modal-container"></div>

  <!-- Scripts -->
  <script src="js/core/cookie-consent.js"></script>
  <script src="js/core/main.js"></script>
  <script src="js/features/mistral-stats.js"></script>
</body>
</html>
```

### Partial Loading System

Partials are loaded dynamically via `js/core/main.js`:
```javascript
// main.js handles:
// 1. Loading partials from partials/ directory
// 2. Setting active navigation via data-page attribute
// 3. Dynamically loading config.js, supabase-client.js, supabase-sync.js
```

For minimal footer (e.g., checkout page):
```html
<body data-footer="minimal">
```

### Admin System Pattern

```javascript
// Check admin status (synchrone, fiable apres init)
if (window.MistralAdmin && MistralAdmin.Auth.isLoggedIn()) {
  // Show admin UI
}

// FAB auto-injects on all pages except admin.html when logged in.
// Only 2 actions: admin panel link + logout. No page-specific FAB code needed.
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
| `accessoires` | Accessories | nom, categorie, prix, stock, statut, visible_configurateur, tailles_compatibles |
| `tailles` | Sizes | code, label, description, prix_malus, feasibility (JSON), ordre, disponible, visible_configurateur |
| `configuration` | Settings (key-value) | key, value (JSON), namespace (gestion/compta/email_automations) |

### Row-Level Security

- **Public read:** Active teachers, published articles, online instruments, gallery, active accessories
- **Public insert:** Teacher applications (pending status)
- **Authenticated:** Full CRUD access for admin operations (all tables including configuration)

---

## Pricing System

All pricing values are **configurable via Admin > Config > Tarification configurateur**. Defaults below.

### Base Pricing (configurable)
- **Standard note:** 115 EUR (`prixParNote`)
- **Octave 2 note:** +50 EUR per note (`bonusOctave2`)
- **Bottoms (bass notes):** +25 EUR flat (`bonusBottoms`)

### Size Malus (flat EUR, configurable per taille)
| Size | Malus | Reason |
|------|-------|--------|
| 53 cm | 0 EUR | Standard shell |
| 50 cm | +100 EUR | Shell modification (~2h work) |
| 45 cm | +100 EUR | Shell modification (~2h work) |

### Difficulty Malus (percentage, configurable)
| Status | Surface % | Malus |
|--------|-----------|-------|
| OK | <= 45% | 0% |
| Warning | 45-50% | +5% (`malusDifficulteWarning`) |
| Difficult | 50-59% | +10% (`malusDifficulteDifficile`) |
| Impossible | > 59% | N/A (blocked) |

**Rounding:** All prices rounded down to nearest 5 EUR.

**Code:** `boutique.js` reads pricing from `MistralGestion.getConfig()` via `getPricingConfig()` with fallback to `PRICING_DEFAULTS`.

---

## Audio System

- **Format:** FLAC
- **Location:** `ressources/audio/`
- **Naming:** `[Note][s][Octave].flac` (s for sharp)
  - Example: `Cs4.flac` for C#4, `As3.flac` for A#3/Bb3

**Available range:** E2 to F5 (56 samples)

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
- JS organized by concern: `js/core/`, `js/admin/`, `js/services/`, `js/data/`, `js/features/`, `js/pages/`

---

## Common Tasks

### Adding a New Page
1. Create `pagename.html` at root with standard template
2. Add `data-page="pagename"` to body
3. Add navigation link to `partials/header.html`
4. Create `js/pages/pagename.js` if needed (or `js/features/` for reusable modules)
5. Create `css/pagename.css` if needed

### Modifying Admin Functionality
1. Core logic goes in `js/admin/admin-core.js`
2. UI components in `js/admin/admin-ui-*.js` (split by domain)
3. Page-specific admin in `js/admin/pagename-admin.js`
4. Admin styles in `css/admin.css`

### Working with Supabase
```javascript
// Client is initialized in js/services/supabase-client.js
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value);
```

### Adding Audio Samples
1. Convert to FLAC format
2. Name as `[Note][s][Octave].flac`
3. Place in `ressources/audio/`
4. Update `js/features/handpan-player.js` if adding new note range

---

## Important Notes

### Server Required
The site uses `fetch()` for partials. **Will not work with `file://` protocol.**

### Dynamic Script Loading
`js/core/main.js` dynamically loads `js/core/config.js`, `js/services/supabase-client.js`, and `js/services/supabase-sync.js` at runtime. Keep these paths in sync if reorganizing. The sync module fetches data from Supabase into an in-memory store (no localStorage) and dispatches `mistral-sync-complete` when ready.

### Vendor Libraries
- All third-party JS/CSS is in `js/vendor/` (no CDN dependency)
- Run `./scripts/update-vendor.sh` to check for updates
- `js/vendor/versions.json` tracks installed versions
- PayPlug SDK is the only external CDN (PCI-DSS requirement)

### Cloudflare Consideration
If hosted behind Cloudflare, disable "Email Address Obfuscation" in Security settings.

### Data Architecture

**In-memory data (via MistralSync):** Business data and configuration are fetched from Supabase at page load and stored in a JavaScript `Map` in memory. No localStorage is used for this data. Tables with `isKeyValue: true` store config objects (not arrays). Tables with `fetchFilter` fetch a filtered subset of a shared Supabase table (e.g., `professeurs` filtered by `statut`).

| Key (in-memory) | Supabase Table | Type | Purpose |
|-----|---------|------|---------|
| `mistral_gestion_clients` | `clients` | Array | Customer records |
| `mistral_gestion_instruments` | `instruments` | Array | Instrument inventory |
| `mistral_gestion_locations` | `locations` | Array | Rental records |
| `mistral_gestion_commandes` | `commandes` | Array | Customer orders |
| `mistral_gestion_factures` | `factures` | Array | Invoices |
| `mistral_teachers` | `professeurs` (statut='active') | Array | Validated teachers |
| `mistral_pending_teachers` | `professeurs` (statut='pending') | Array | Pending teacher applications |
| `mistral_gallery` | `galerie` | Array | Gallery media |
| `mistral_blog_articles` | `articles` | Array | Blog articles |
| `mistral_accessoires` | `accessoires` | Array | Shop accessories (cases, oils, etc.) |
| `mistral_tailles` | `tailles` | Array | Size configurations (45/50/53cm) with feasibility data |
| `mistral_gestion_config` | `configuration` (namespace='gestion') | Object | Admin business config (rates, invoice counter) |
| `mistral_compta_config` | `configuration` (namespace='compta') | Object | Accounting settings (email dest, report prefs) |
| `mistral_email_automations` | `configuration` (namespace='email_automations') | Object | Email automation rules |

**localStorage keys (client-side preferences only):**

| Key | Purpose |
|-----|---------|
| `mistral_cookie_consent` | RGPD cookie consent preferences |
| `mistral_leaflet_consent` | Map RGPD consent |
| `mistral_stats_anonymous` | Anonymous page view aggregates |

**In-memory only (no persistence):**

| Module | Purpose |
|--------|---------|
| `MistralMateriaux` | Material specifications (hardcoded defaults) |
| `MistralGammes` | Scale configurations (hardcoded defaults) |

### Admin Authentication
- Authentication is handled via **Supabase Auth** (email + password)
- Manage admin users in the Supabase dashboard (Authentication > Users)
- `js/services/supabase-auth.js` provides `MistralAuth` API
- `js/admin/admin-core.js` Auth object delegates to MistralAuth
- Image uploads use Supabase Storage (bucket `galerie`, admin-only write, public read)

---

## External Services & APIs

| Service | Usage | RGPD Impact |
|---------|-------|-------------|
| Supabase | Database, Auth | EU hosting available |
| Brevo | Email delivery | GDPR compliant |
| Nominatim | Geocoding | No tracking |
| CartoDB Positron | Map tiles | Consent required |
| Honeypot | Bot protection | No external data transfer |
| Google Fonts | Typography | Conditional loading (consent) |
| Swikly | Rental deposits | GDPR compliant (permalien) |
| Payplug | Payments | French provider, GDPR compliant |

---

## Troubleshooting

### Partials not loading
- Ensure running via HTTP server, not `file://`
- Check browser console for fetch errors
- Verify `partials/` directory exists

### Admin FAB not showing
- Check `MistralAdmin.Auth.isLoggedIn()` returns true
- Verify `js/admin/admin-core.js` is loaded
- Verify Supabase auth session is active (no localStorage session)

### Supabase sync issues
- Verify Supabase URL and anon key in `js/core/config.js`
- Check browser network tab for failed requests
- Verify RLS policies allow the operation
- Data is in-memory only (not localStorage) -- check `MistralSync.getData(key)` in console
- Check `MistralSync.isReady()` and `MistralSync.getLastSync()` for sync status

### Audio not playing
- Check file exists in `ressources/audio/`
- Verify FLAC format and correct naming
- Check browser console for Web Audio API errors

---

## Contact

- **Website:** mistralpans.fr
- **Email:** contact@mistralpans.fr
- **Location:** Ile-de-France, France
