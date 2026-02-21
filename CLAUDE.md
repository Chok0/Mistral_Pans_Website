# CLAUDE.md - AI Assistant Guide for Mistral Pans Website

> **Last Updated:** February 2026 (v3.5.4)
> **Project:** Mistral Pans - Premium Handpan Artisan Website
> **Stack:** Vanilla JS + HTML/CSS + Supabase + Netlify Functions

---

## Quick Start

```bash
# Run local development server (required - fetch() won't work on file://)
python -m http.server 8000

# Alternative: VS Code Live Server extension or npx serve .

# Run unit tests (requires npm install first)
npm test              # Single run
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
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
│   ├── admin.css            # Admin styles (modals, dashboard, gestion)
│   └── teacher-form.css     # Teacher signup form
├── js/
│   ├── core/                # Bootstrap, navigation, configuration
│   │   ├── main.js          # Partial loading, navigation, Supabase init
│   │   ├── utils.js         # Shared helpers (escapeHtml, formatPrice, formatDate, debounce, loadScript…)
│   │   ├── config.js        # Supabase keys (gitignored)
│   │   ├── config.example.js # Config template
│   │   └── cookie-consent.js # RGPD cookie consent banner
│   │
│   ├── admin/               # Administration system
│   │   ├── admin-core.js    # Auth, CRUD, sanitization
│   │   ├── admin-ui-core.js # Navigation, dashboard, todos
│   │   ├── admin-ui-gestion.js  # Clients, instruments, locations
│   │   ├── admin-ui-boutique.js # Shop stock, accessories
│   │   ├── admin-ui-content.js  # Teachers, gallery, blog
│   │   ├── admin-ui-config.js   # Config, export/import
│   │   ├── admin-ui-modals.js   # Modal core (showModal, closeModal, state)
│   │   ├── admin-ui-modals-clients.js     # Client CRUD modals
│   │   ├── admin-ui-modals-instruments.js # Instrument CRUD + uploads
│   │   ├── admin-ui-modals-locations.js   # Location CRUD modals
│   │   ├── admin-ui-modals-commandes.js   # Commande CRUD + email automation
│   │   ├── admin-ui-modals-factures.js    # Facture CRUD + PDF/email
│   │   ├── admin-ui-modals-teachers.js    # Teacher CRUD modals
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
│   │   ├── gammes-data.js   # Configurator gammes (MistralSync/Supabase, 12 default)
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
│   ├── teacher-signup.js    # Teacher signup (rate-limit fail-closed, honeypot, validation)
│   ├── payplug-create-payment.js  # Payment creation
│   ├── payplug-webhook.js   # Payment webhooks
│   ├── swikly-create-deposit.js   # Deposit creation
│   ├── swikly-webhook.js    # Deposit webhooks
│   └── order-status.js      # Order tracking endpoint
├── tests/
│   ├── setup.js             # Test setup (loads IIFE modules into jsdom)
│   ├── utils.test.js        # Unit tests for js/core/utils.js
│   ├── feasibility.test.js  # Unit tests for feasibility-module.js
│   └── scales-data.test.js  # Unit tests for scales-data.js
├── netlify.toml              # Netlify config (headers, redirects, CSP)
├── vitest.config.js          # Vitest configuration (jsdom environment)
├── package.json              # Dev dependencies (vitest, jsdom)
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
| `credits.html` | Open source credits | Shellopan audio, vendor libraries, fonts, map services |

### Core JavaScript Files

| File | Location | Key Exports/Functions |
|------|----------|----------------------|
| `utils.js` | `js/core/` | `MistralUtils.*` — shared helpers (escapeHtml, formatPrice, formatDate, sanitizeHtml, debounce, generateId, hasValue, loadScript, loadStylesheet…) |
| `main.js` | `js/core/` | `loadPartials()`, `setActivePage()`, dynamic Supabase init |
| `admin-core.js` | `js/admin/` | `Auth.isLoggedIn()`, CRUD helpers (delegates to MistralUtils) |
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
- **DOMPurify 3.3.1** - XSS sanitizer (article.html, admin.html), fallback custom DOMParser
- **Chart.js 4.x** - Admin charts (lazy-loaded on dashboard)
- **Quill.js 1.3.7** - WYSIWYG editor (lazy-loaded on blog section)

Versions tracked in `js/vendor/versions.json`. Update via `./scripts/update-vendor.sh`.

### External CDN (not self-hostable)
- **PayPlug SDK** - Payment (PCI-DSS requirement, commander.html only). Requires relaxed CSP (`'unsafe-inline'` in `script-src`, PayPlug domains in `connect-src`) — see `netlify.toml` page-specific headers.

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
--color-success: #3D6B4A;     /* Sage green (WCAG AA 5.2:1) */
--color-warning: #D97706;     /* Amber (WCAG AA 4.6:1) */
--color-error: #DC2626;       /* Red (WCAG AA 5.0:1) */

/* Boutique overrides */
--color-bg: #FAFAFA;          /* Light gray */
--color-bg-warm: #F5F5F5;     /* Stock section */

/* Focus Indicators (Accessibility) */
--focus-ring: 2px solid var(--color-accent);
--focus-ring-offset: 2px;
--focus-shadow: 0 0 0 4px var(--color-accent-20);

/* Z-index Scale */
--z-base: 1;        /* Hero overlay, player-info, badges */
--z-content: 2;     /* Hero content */
--z-sticky: 100;    /* Header, boutique tabs, admin header */
--z-dropdown: 200;  /* Searchable dropdown, autocomplete */
--z-player-overlay: 499;  /* Handpan overlay backdrop */
--z-player-enlarged: 500; /* Handpan enlarged */
--z-modal: 1000;    /* Contact modal, admin modals, lightbox */
--z-toast: 2000;    /* Toasts, notifications, cookie banner */
--z-skip: 9999;     /* Accessibility skip link */
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

// Admin panel is accessed directly via admin.html URL (no FAB on user pages).
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
| `gammes` | Scales | code, nom, categorie, mode, baseRoot, baseOctave, baseNotes (JSONB), custom_layouts (JSONB), ordre, disponible, visible_configurateur |
| `configuration` | Settings (key-value) | key, value (JSON), namespace (gestion/compta/email_automations/configurateur) |

### Row-Level Security (granulaire)

- **Admin-only:** `clients`, `locations`, `commandes`, `factures`, `configuration` (protege IBAN/BIC)
- **Public read (filtre config):** `configuration` (namespace='configurateur' — lots de gammes actifs)
- **Public read (tout):** `galerie`, `tailles`, `gammes`
- **Public read (filtre):** `instruments` (statut IN en_ligne/disponible), `articles` (status=published), `accessoires` (statut=en_ligne), `professeurs` (statut=active)
- **Public insert:** `professeurs` (statut=pending uniquement)
- **Authenticated:** Full CRUD access sur toutes les tables
- **Netlify Functions:** Utilisent `SERVICE_KEY` (bypass RLS)

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

### CSP (Content Security Policy)

- **Global CSP** (`/*`): Strict — no `'unsafe-inline'` in `script-src`. Applied to all pages.
- **commander.html CSP** (page-specific override): Adds `'unsafe-inline'` to `script-src` and PayPlug domains (`secure.payplug.com`, `api.payplug.com`) to `connect-src`. Required by the PayPlug Integrated Payment SDK which injects inline handlers for card form validation and 3DS lightbox.
- Both rules are in `netlify.toml`. Netlify applies the most specific match, so `commander.html` gets its own CSP.
- **Do not remove `'unsafe-inline'` from commander.html** unless PayPlug releases a CSP-compatible SDK version.

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
| `mistral_gammes_data` | `gammes` | Array | Scale configurations (patterns, baseNotes, metadata) |
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

> **Note:** `MistralGammes` was migrated from in-memory to MistralSync/Supabase (table `gammes`). See `mistral_gammes_data` in the sync table above. Published lots are loaded from Supabase namespace=configurateur key `published_lots`, fallback legacy `active_gammes`. Custom patterns (`custom_layouts`) override hardcoded `SCALES_DATA` patterns.

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

## Testing

### Framework
- **Vitest 3.x** with **jsdom** environment
- Tests in `tests/` directory
- Setup loads IIFE/const modules into jsdom `window` via `tests/setup.js`

### Running Tests
```bash
npm install        # First time only
npm test           # Single run (vitest run)
npm run test:watch # Watch mode
```

### Adding Tests for a New Module
1. Add `loadModule('js/path/to/module.js')` in `tests/setup.js`
2. Create `tests/module-name.test.js`
3. Access the module via `window.ModuleName` (both IIFE and const patterns supported)

### Current Coverage (147 tests)
| Module | Tests | Focus |
|--------|-------|-------|
| `utils.js` | 96 | Formatting, escaping, sanitization, validation, debounce, generateId |
| `feasibility-module.js` | 23 | Surface calculations, threshold transitions, forbidden notes |
| `scales-data.js` | 28 | Constants, notation conversion, music theory, configurator support |

---

## Troubleshooting

### Partials not loading
- Ensure running via HTTP server, not `file://`
- Check browser console for fetch errors
- Verify `partials/` directory exists

### Admin panel access
- Navigate directly to `admin.html` (no FAB on user pages)
- Check `MistralAdmin.Auth.isLoggedIn()` returns true after login
- Verify Supabase auth session is active (no localStorage session)

### Supabase sync issues
- Verify Supabase URL and anon key in `js/core/config.js`
- Check browser network tab for failed requests
- Verify RLS policies allow the operation
- Data is in-memory only (not localStorage) -- check `MistralSync.getData(key)` in console
- Check `MistralSync.isReady()` and `MistralSync.getLastSync()` for sync status

### Payment issues (PayPlug)
- **CSP violations on commander.html**: The PayPlug Integrated Payment SDK requires `'unsafe-inline'` in `script-src`. Verify the page-specific CSP in `netlify.toml` is present.
- **PayPlug 400 errors**: Check the Netlify function logs (`payplug-create-payment`). Common causes: missing `billing.address1`/`postcode`/`city`, invalid amount, or metadata values not strings.
- **Integrated form not showing**: Falls back to hosted (redirect) mode silently. Check `MistralPayplug.isIntegratedAvailable()` in console. SDK may fail to load if CSP blocks it.
- **delivery_type**: Set dynamically from `metadata.shippingMethod` — `CARRIER` for Colissimo, `SHIP_TO_STORE` for retrait. Important for PSD2 compliance.
- **Oney 3x/4x**: Code is present but option is hidden in UI (pending PayPlug validation). To re-enable, remove `style="display:none;"` from the Oney `.order-option` in `commander.html` and uncomment any visibility logic in `adaptUIForSource()`.

### Audio not playing
- Check file exists in `ressources/audio/`
- Verify FLAC format and correct naming
- Check browser console for Web Audio API errors

---

## Contact

- **Website:** mistralpans.fr
- **Email:** contact@mistralpans.fr
- **Location:** Ile-de-France, France
