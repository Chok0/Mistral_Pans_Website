# Project Review - Mistral Pans Website

> **Date:** February 2026
> **Scope:** Full codebase review (38,000+ lines across HTML/JS/CSS/PHP/Netlify Functions)
> **Categories:** Security, HTML Quality, JavaScript Quality, CSS Quality, Backend

---

## Executive Summary

The Mistral Pans website is a well-structured static-first application with a clear separation of concerns. The codebase demonstrates solid architectural decisions (partial loading system, Supabase integration, RGPD-first approach) and good use of vanilla JavaScript. However, the review identified **9 critical issues**, **19 important issues**, and **17 minor issues** across security, accessibility, code quality, and consistency.

**Top 3 priorities:**
1. **Security:** Client-side-only authentication is fully bypassable; config.js with credentials is committed to git; Swikly webhook has no signature verification
2. **Reliability:** `sanitize()` function is undefined in `send-email.js`, crashing 3 email types at runtime
3. **Consistency:** 6 out of 12 pages bypass the dynamic partial system, causing stale headers/footers, missing spam protection, and RGPD compliance gaps

---

## CRITICAL Issues (9)

### SEC-1: Client-side authentication is fully bypassable
- **File:** `js/admin/admin-core.js:261-331`
- **Impact:** Any visitor can gain full admin access
- **Details:** The entire admin auth system is client-side only. An attacker can run `localStorage.setItem('mistral_admin_session', JSON.stringify({user:'admin', expiry:Date.now()+86400000, token:'x'}))` in the browser console. `window.MistralAdmin.CONFIG` exposes the password hash publicly.
- **Fix:** Migrate to Supabase Auth exclusively with server-side session validation. Remove localStorage-based auth entirely.

### SEC-2: Legacy session fallback keeps bypass alive even with Supabase
- **File:** `js/services/supabase-auth.js:126-147`
- **Impact:** Supabase Auth migration is ineffective
- **Details:** `isLoggedIn()` falls back to `checkLegacySession()` (the localStorage check) whenever Supabase is unavailable or throws. `isLoggedInSync()` at lines 152-158 always checks the legacy session. The old bypass vector remains active.
- **Fix:** Remove the legacy session fallback entirely. If Supabase is down, admin should be unavailable.

### SEC-3: config.js committed to git with live Supabase credentials
- **File:** `js/core/config.js:12-13`, `.gitignore`
- **Impact:** Credentials exposed in version history
- **Details:** `config.js` contains the live Supabase URL and anon key. `.gitignore` does NOT include `js/core/config.js` despite `config.example.js` existing. If the repository was ever shared, credentials are permanently in git history.
- **Fix:** Add `js/core/config.js` to `.gitignore`. Rotate the Supabase anon key. Consider using environment variables via Netlify.

### SEC-4: Swikly webhook signature verification not implemented
- **File:** `netlify/functions/swikly-webhook.js:63-65`
- **Impact:** Anyone can send forged deposit events
- **Details:** The signature header is extracted but marked `// TODO`. Forged events can set rental locations to `active` status and trigger confirmation emails. Unlike the PayPlug webhook (which re-fetches from API), Swikly's webhook has zero validation.
- **Fix:** Implement HMAC signature verification per Swikly documentation.

### SEC-5: Undefined `sanitize()` function crashes email delivery
- **File:** `netlify/functions/send-email.js:486,498,502,504,508,514,527,548,551,564,566,571,576,627,634-647`
- **Impact:** 3 email types fail with ReferenceError at runtime
- **Details:** `buildBalanceRequestEmail()`, `buildShippingNotificationEmail()`, and `buildNewOrderNotificationEmail()` call `sanitize()`, but only `escapeHtml()` and `sanitizeEmailHeader()` are defined. These email types crash when triggered.
- **Fix:** Add `const sanitize = escapeHtml;` at the top of the file, or replace all `sanitize()` calls with `escapeHtml()`.

### SEC-6: Price manipulation via URL parameters
- **File:** `js/pages/commander.js:99-108`
- **Impact:** Orders can be created with arbitrary prices
- **Details:** The order price is read from URL params with only a 1-20000 range check. An attacker can craft `commander.html?price=1` to create an order at 1 EUR. If the PayPlug webhook doesn't independently verify the expected price, the order succeeds.
- **Fix:** Server-side price validation in the PayPlug webhook. Look up the instrument/configuration price independently; never trust client-submitted amounts.

### HTML-1: 6 pages bypass dynamic partial system
- **Files:** `commander.html`, `apprendre.html`, `location.html`, `galerie.html`, `blog.html`, `article.html`
- **Impact:** Stale content, missing features, RGPD gaps
- **Details:** These pages hardcode the header, footer, and contact modal instead of using the `partials/` system. Consequences:
  - Missing honeypot spam protection on contact forms
  - Missing RGPD consent checkbox on contact forms
  - Missing skip-link for accessibility
  - Stale footer links (social media = `#`, missing "Suivi de commande", "Gerer les cookies")
  - Contact forms fall back to `mailto:` instead of server-side submission
- **Fix:** Migrate all 6 pages to use `<div id="site-header">`, `<div id="site-footer">`, `<div id="contact-modal-container">` with dynamic loading via `main.js`.

### HTML-2: Contact forms on hardcoded pages use mailto: fallback
- **Files:** `galerie.html:213-224`, `blog.html`, `article.html`, `apprendre.html`
- **Impact:** User messages are lost if no email client is configured
- **Details:** The `submitContactForm` function on these pages constructs a `mailto:` URL instead of sending via the email service. Messages are never reliably delivered.
- **Fix:** Resolved by migrating to the partial system (HTML-1).

### HTML-3: Personal data exposed in admin.html source
- **File:** `admin.html:393-395`
- **Impact:** Personal information publicly accessible
- **Details:** Personal email (`adrien.santamaria@gmail.com`), phone number (`07 62 76 65 30`), and SIRET number are hardcoded as default config values. Despite `noindex`, the HTML source is publicly accessible.
- **Fix:** Load these values from Supabase `configuration` table at runtime instead of hardcoding.

---

## IMPORTANT Issues (19)

### Security

**SEC-7: HTML sanitizer has CSS injection and data URI bypasses**
- `js/admin/admin-core.js:164-240` — `style` attribute globally allowed; `url()`, `-moz-binding`, `data:text/javascript`, `data:image/svg+xml` not blocked; `id` attribute allows DOM clobbering.

**SEC-8: Upload module sends weak token without CSRF protection**
- `js/features/upload.js:466-502` — Admin token from localStorage sent as header; no CSRF token on upload/delete requests.

**SEC-9: Weak session token (Math.random)**
- `js/admin/admin-core.js:297` — `Math.random().toString(36)` is not cryptographically secure.

**SEC-10: Hardcoded salt in password hashing**
- `js/admin/admin-core.js:49` — Static salt `_mistral_salt_2024` for all users.

**SEC-11: send-email.js has no authentication**
- `netlify/functions/send-email.js:691-948` — Accepts POST from allowed origins with only honeypot check. Any origin-spoofing attacker can trigger emails.

**SEC-12: No CSP or security headers (no netlify.toml)**
- No `netlify.toml` exists. No Content-Security-Policy, X-Frame-Options, or X-Content-Type-Options headers are set.

### Accessibility

**A-1: Missing `<main>` landmark on 6 pages**
- `index.html`, `commander.html`, `apprendre.html`, `location.html`, `galerie.html`, `blog.html` — Screen readers cannot navigate to main content.

**A-2: Missing `#main-content` skip-link target**
- `galerie.html`, `blog.html`, `suivi.html` — The partial header's skip link targets `#main-content` which doesn't exist on these pages.

**A-3: Modal dialogs missing ARIA attributes**
- `partials/contact-modal.html:2`, `boutique.html:307`, `apprendre.html:1255` — Missing `role="dialog"` and `aria-modal="true"`.

**A-4: No `prefers-reduced-motion` support**
- `css/style.css`, `css/boutique.css`, `css/admin.css` — Numerous animations (`fadeInUp`, `pulse-dot`, `bounceDown`, etc.) with zero `@media (prefers-reduced-motion: reduce)`. WCAG 2.1 Level AA requirement.

**A-5: Invisible focus styles**
- `css/style.css:1515-1518` — `outline: none` with 10% opacity box-shadow. `css/boutique.css:1046-1049` — `outline: none` with no replacement. No `:focus-visible` usage anywhere.

### HTML Quality

**HTML-4: CGV checkboxes lack name attribute**
- `commander.html:604-607` — Consent checkboxes have no `name`, so consent status cannot be submitted with form data.

**HTML-5: Admin login label/input mismatch**
- `admin.html:84` — Label says "Email" but input `id` is "username". Label lacks `for` attribute.

**HTML-6: Two `<h1>` elements in admin.html**
- `admin.html:80,134` — Both login title and dashboard title use `<h1>`.

**HTML-7: Missing OG/Twitter meta tags**
- `suivi.html` — No social sharing tags. `article.html` — Static defaults instead of dynamic tags.

### CSS Quality

**CSS-1: boutique.css overrides `:root` variables globally**
- `css/boutique.css:15-23` — Overrides `--color-bg`, `--color-accent`, etc. at `:root` level. If loaded on non-boutique pages, breaks the design system. Should be scoped to `body[data-page="boutique"]`.

**CSS-2: `!important` overuse in boutique.css**
- `css/boutique.css:3,1206-1208,1215,1363,1415` — 9 of 11 `!important` usages site-wide, compensating for the `:root` override issue.

---

## MINOR Issues (17)

### JavaScript
- **JS-1:** Empty `initContactModal()` dead code — `js/core/main.js:253-256`
- **JS-2:** Unused `lastScroll` variable — `js/core/main.js:172`
- **JS-3:** Event listener memory leaks on modals — `js/admin/admin-core.js:662-666` (keydown listeners never removed)
- **JS-4:** Audio element accumulation — `js/features/handpan-player.js:686` (cloneNode never cleaned up)
- **JS-5:** AbortController listener accumulation — `js/features/handpan-player.js:779-784`
- **JS-6:** Unescaped scale data in innerHTML — `js/core/main.js:313-318` (safe now, XSS risk if data source changes)
- **JS-7:** Progress bar CSS variable never updated — `js/features/upload.js:887` (sets `style.width` but CSS uses `var(--progress)`)
- **JS-8:** Object URL leak on compression error — `js/features/upload.js:92-99`
- **JS-9:** Honeypot `checkServerSide` is dead code in browser — `js/features/honeypot.js:139-141`
- **JS-10:** Supabase auth state listener never unsubscribed — `js/services/supabase-auth.js:253`
- **JS-11:** simpleHash fallback is trivially collisionable — `js/admin/admin-core.js:61-69`

### CSS
- **CSS-3:** Duplicate `.flash-cards` rule — `css/boutique.css:738` vs `css/boutique.css:1335`
- **CSS-4:** Duplicate `.stats-card` definition — `css/admin.css:1013` vs `css/admin.css:1186`
- **CSS-5:** Hardcoded colors bypassing design system — `css/boutique.css:150-165`, `css/admin.css:382-439`
- **CSS-6:** Mobile breakpoint inconsistency — `css/style.css:853` uses undocumented `968px`; `css/boutique.css:1328` uses `769px` (off-by-one)
- **CSS-7:** UTF-8 encoding corruption in CSS comments — `css/style.css:1629`, `css/boutique.css:8`, `css/admin.css:1-4`

### Backend
- **BE-1:** Error details leaked to client — `send-email.js:924`, `payplug-create-payment.js:293-297`, `swikly-webhook.js:190`
- **BE-2:** localhost CORS origins unconditionally allowed in PHP — `php/upload.php:25-27`, `php/delete.php:15-17`

### HTML
- **HTML-8:** Favicon missing on `boutique.html`, `admin.html`, `suivi.html`
- **HTML-9:** Empty `src` on modal image — `boutique.html:326`
- **HTML-10:** YouTube social link still placeholder — `partials/footer.html:54`
- **HTML-11:** Boutique.html has 1500+ lines inline JS — should be extracted to `js/pages/boutique.js`

---

## Recommended Priority Order

### Phase 1 - Critical Security (Immediate)
1. Add `js/core/config.js` to `.gitignore` and rotate Supabase keys
2. Fix undefined `sanitize()` in `send-email.js` (runtime crash)
3. Implement Swikly webhook signature verification
4. Add server-side price validation in PayPlug webhook
5. Remove personal data from `admin.html` source

### Phase 2 - Authentication Overhaul
6. Migrate to Supabase Auth exclusively
7. Remove localStorage-based auth and legacy session fallback
8. Add proper CSRF protection to upload/delete endpoints

### Phase 3 - Consistency & Compliance
9. Migrate 6 hardcoded pages to dynamic partial system
10. Add `role="dialog"` and `aria-modal="true"` to all modals
11. Add `<main>` landmarks and `#main-content` targets
12. Add `prefers-reduced-motion` media queries
13. Fix focus styles across all CSS files

### Phase 4 - Code Quality
14. Add `netlify.toml` with security headers (CSP, X-Frame-Options, etc.)
15. Scope boutique.css variables to `body[data-page="boutique"]`
16. Fix memory leaks (modal listeners, audio clones)
17. Extract inline JS from boutique.html
18. Clean up dead code and duplicate CSS rules

---

## Strengths

The project has several notable strengths worth preserving:
- **Clean architecture:** Clear separation into core/admin/services/features/pages
- **RGPD-first approach:** Cookie consent, map consent, honeypot over reCAPTCHA
- **No build system:** Simplicity of direct file serving with progressive enhancement
- **Comprehensive CLAUDE.md:** Excellent documentation for AI-assisted development
- **PayPlug webhook pattern:** Server-side API re-fetch is the correct approach
- **Supabase RLS:** Row-level security for public vs authenticated access
- **French-first:** Consistent localization throughout
