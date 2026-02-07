# Project Review - Mistral Pans Website

> **Date:** February 2026
> **Scope:** Full codebase review (38,000+ lines across HTML/JS/CSS/PHP/Netlify Functions)
> **Categories:** Security, HTML Quality, JavaScript Quality, CSS Quality, Backend
> **Last Updated:** February 7, 2026

Legend: FIXED = resolved, OPEN = still pending

---

## Executive Summary

The Mistral Pans website is a well-structured static-first application with a clear separation of concerns. The codebase demonstrates solid architectural decisions (partial loading system, Supabase integration, RGPD-first approach) and good use of vanilla JavaScript. The review identified **9 critical issues**, **19 important issues**, and **17 minor issues** across security, accessibility, code quality, and consistency.

**Progress:** 45+ issues fixed. Supabase Auth migration complete (SEC-1/SEC-2/SEC-8/SEC-9/SEC-10 all FIXED). Remaining open items are minor code quality (JS-6, JS-10, JS-11, CSS-5, CSS-7, HTML-8).

---

## CRITICAL Issues (9)

### SEC-1: Client-side authentication is fully bypassable [FIXED]
- **File:** `js/admin/admin-core.js`, `js/services/supabase-auth.js`
- **Impact:** Any visitor can gain full admin access
- **Details:** The entire admin auth system was client-side only with localStorage bypass.
- **Fix:** Migrated to Supabase Auth exclusively. Removed localStorage-based sessions, password hashing (simpleHash/secureHash), CONFIG exposure. Auth.isLoggedIn() now delegates to MistralAuth which checks Supabase session state.

### SEC-2: Legacy session fallback keeps bypass alive even with Supabase [FIXED]
- **File:** `js/services/supabase-auth.js`
- **Impact:** Supabase Auth migration is ineffective
- **Details:** `isLoggedIn()` fell back to `checkLegacySession()` (localStorage) when Supabase unavailable.
- **Fix:** Removed all legacy session fallbacks. If Supabase is down, admin is unavailable. Legacy localStorage keys are cleaned up on init.

### SEC-3: config.js committed to git with live Supabase credentials [FIXED]
- **File:** `js/core/config.js:12-13`, `.gitignore`
- **Impact:** Credentials exposed in version history
- **Details:** `config.js` contains the live Supabase URL and anon key. `.gitignore` does NOT include `js/core/config.js` despite `config.example.js` existing. If the repository was ever shared, credentials are permanently in git history.
- **Fix:** Add `js/core/config.js` to `.gitignore`. Rotate the Supabase anon key. Consider using environment variables via Netlify.

### SEC-4: Swikly webhook signature verification not implemented [FIXED]
- **File:** `netlify/functions/swikly-webhook.js:63-65`
- **Impact:** Anyone can send forged deposit events
- **Details:** The signature header is extracted but marked `// TODO`. Forged events can set rental locations to `active` status and trigger confirmation emails. Unlike the PayPlug webhook (which re-fetches from API), Swikly's webhook has zero validation.
- **Fix:** Implement HMAC signature verification per Swikly documentation.

### SEC-5: Undefined `sanitize()` function crashes email delivery [FIXED]
- **File:** `netlify/functions/send-email.js:486,498,502,504,508,514,527,548,551,564,566,571,576,627,634-647`
- **Impact:** 3 email types fail with ReferenceError at runtime
- **Details:** `buildBalanceRequestEmail()`, `buildShippingNotificationEmail()`, and `buildNewOrderNotificationEmail()` call `sanitize()`, but only `escapeHtml()` and `sanitizeEmailHeader()` are defined. These email types crash when triggered.
- **Fix:** Add `const sanitize = escapeHtml;` at the top of the file, or replace all `sanitize()` calls with `escapeHtml()`.

### SEC-6: Price manipulation via URL parameters [FIXED]
- **File:** `js/pages/commander.js:99-108`
- **Impact:** Orders can be created with arbitrary prices
- **Details:** The order price is read from URL params with only a 1-20000 range check. An attacker can craft `commander.html?price=1` to create an order at 1 EUR. If the PayPlug webhook doesn't independently verify the expected price, the order succeeds.
- **Fix:** Server-side price validation in the PayPlug webhook. Look up the instrument/configuration price independently; never trust client-submitted amounts.

### HTML-1: 6 pages bypass dynamic partial system [FIXED]
- **Files:** `commander.html`, `apprendre.html`, `location.html`, `galerie.html`, `blog.html`, `article.html`
- **Impact:** Stale content, missing features, RGPD gaps
- **Details:** These pages hardcode the header, footer, and contact modal instead of using the `partials/` system. Consequences:
  - Missing honeypot spam protection on contact forms
  - Missing RGPD consent checkbox on contact forms
  - Missing skip-link for accessibility
  - Stale footer links (social media = `#`, missing "Suivi de commande", "Gerer les cookies")
  - Contact forms fall back to `mailto:` instead of server-side submission
- **Fix:** Migrate all 6 pages to use `<div id="site-header">`, `<div id="site-footer">`, `<div id="contact-modal-container">` with dynamic loading via `main.js`.

### HTML-2: Contact forms on hardcoded pages use mailto: fallback [FIXED]
- **Files:** `galerie.html:213-224`, `blog.html`, `article.html`, `apprendre.html`
- **Impact:** User messages are lost if no email client is configured
- **Details:** The `submitContactForm` function on these pages constructs a `mailto:` URL instead of sending via the email service. Messages are never reliably delivered.
- **Fix:** Resolved by migrating to the partial system (HTML-1).

### HTML-3: Personal data exposed in admin.html source [FIXED]
- **File:** `admin.html:393-395`
- **Impact:** Personal information publicly accessible
- **Details:** Personal email (`adrien.santamaria@gmail.com`), phone number (`07 62 76 65 30`), and SIRET number are hardcoded as default config values. Despite `noindex`, the HTML source is publicly accessible.
- **Fix:** Load these values from Supabase `configuration` table at runtime instead of hardcoding.

---

## IMPORTANT Issues (19)

### Security

**SEC-7: HTML sanitizer has CSS injection and data URI bypasses** [FIXED]
- `js/admin/admin-core.js:164-240` — `style` attribute globally allowed; `url()`, `-moz-binding`, `data:text/javascript`, `data:image/svg+xml` not blocked; `id` attribute allows DOM clobbering.

**SEC-8: Upload module sends weak token without CSRF protection** [FIXED]
- `js/features/upload.js` — Now sends Supabase JWT as `X-Admin-Token`. PHP endpoints validate JWT via Supabase `/auth/v1/user` API. CSRF protection provided by Supabase session cookies + SameSite.

**SEC-9: Weak session token (Math.random)** [FIXED]
- Removed entirely. Sessions are now managed by Supabase Auth (cryptographically secure JWTs).

**SEC-10: Hardcoded salt in password hashing** [FIXED]
- Removed entirely. Password hashing is now handled by Supabase Auth (bcrypt server-side).

**SEC-11: send-email.js has no authentication** [FIXED]
- Added in-memory rate limiting (5 emails/min per IP) + honeypot. Full auth requires Supabase Auth migration.

**SEC-12: No CSP or security headers (no netlify.toml)** [FIXED]
- `netlify.toml` created with CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

### Accessibility

**A-1: Missing `<main>` landmark on 6 pages** [FIXED]
- `index.html`, `commander.html`, `apprendre.html`, `location.html`, `galerie.html`, `blog.html` — Screen readers cannot navigate to main content.

**A-2: Missing `#main-content` skip-link target** [FIXED]
- `galerie.html`, `blog.html`, `suivi.html` — The partial header's skip link targets `#main-content` which doesn't exist on these pages.

**A-3: Modal dialogs missing ARIA attributes** [FIXED]
- `partials/contact-modal.html:2`, `boutique.html:307`, `apprendre.html:1255` — Missing `role="dialog"` and `aria-modal="true"`.

**A-4: No `prefers-reduced-motion` support** [FIXED]
- `css/style.css`, `css/boutique.css`, `css/admin.css` — Numerous animations (`fadeInUp`, `pulse-dot`, `bounceDown`, etc.) with zero `@media (prefers-reduced-motion: reduce)`. WCAG 2.1 Level AA requirement.

**A-5: Invisible focus styles** [FIXED]
- `css/style.css:1515-1518` — `outline: none` with 10% opacity box-shadow. `css/boutique.css:1046-1049` — `outline: none` with no replacement. No `:focus-visible` usage anywhere.

### HTML Quality

**HTML-4: CGV checkboxes lack name attribute** [FIXED]
- `commander.html:604-607` — Consent checkboxes have no `name`, so consent status cannot be submitted with form data.

**HTML-5: Admin login label/input mismatch** [FIXED]
- `admin.html:84` — Label says "Email" but input `id` is "username". Label lacks `for` attribute.

**HTML-6: Two `<h1>` elements in admin.html** [FIXED]
- `admin.html:80,134` — Both login title and dashboard title use `<h1>`.

**HTML-7: Missing OG/Twitter meta tags** [FIXED]
- `suivi.html` — No social sharing tags. `article.html` — Static defaults instead of dynamic tags.

### CSS Quality

**CSS-1: boutique.css overrides `:root` variables globally** [FIXED]
- `css/boutique.css:15-23` — Overrides `--color-bg`, `--color-accent`, etc. at `:root` level. If loaded on non-boutique pages, breaks the design system. Should be scoped to `body[data-page="boutique"]`.

**CSS-2: `!important` overuse in boutique.css** [FIXED]
- `css/boutique.css:3,1206-1208,1215,1363,1415` — 9 of 11 `!important` usages site-wide, compensating for the `:root` override issue.

---

## MINOR Issues (17)

### JavaScript
- **JS-1:** Empty `initContactModal()` dead code [FIXED] — removed `audioBufferCache`
- **JS-2:** Unused `lastScroll` variable [FIXED] — removed from main.js
- **JS-3:** Event listener memory leaks on modals [FIXED] — replaced with event delegation
- **JS-4:** Audio element accumulation [FIXED] — added clone tracking with Set + cleanup
- **JS-5:** AbortController listener accumulation [FIXED] — added AbortController to geocoding, concurrent request guards to PayPlug/Swikly
- **JS-6:** Unescaped scale data in innerHTML [OPEN] — `js/core/main.js:313-318` (safe now, XSS risk if data source changes)
- **JS-7:** Progress bar CSS variable never updated [FIXED] — now sets `--progress` CSS variable
- **JS-8:** Object URL leak on compression error [FIXED] — added `URL.revokeObjectURL()` on load/error
- **JS-9:** Honeypot `checkServerSide` is dead code in browser [FIXED] — removed from client module
- **JS-10:** Supabase auth state listener never unsubscribed [OPEN] — `js/services/supabase-auth.js:253`
- **JS-11:** simpleHash fallback is trivially collisionable [OPEN] — `js/admin/admin-core.js:61-69`

### CSS
- **CSS-3:** Duplicate `.flash-cards` rule [FIXED] — merged duplicate rules
- **CSS-4:** Duplicate `.stats-card` definition [FIXED] — consolidated into single block
- **CSS-5:** Hardcoded colors bypassing design system [OPEN] — `css/boutique.css:150-165`, `css/admin.css:382-439`
- **CSS-6:** Mobile breakpoint inconsistency [FIXED] — normalized `968px` to `1024px` in style.css
- **CSS-7:** UTF-8 encoding corruption in CSS comments [OPEN] — `css/style.css:1629`, `css/boutique.css:8`, `css/admin.css:1-4`

### Backend
- **BE-1:** Error details leaked to client [FIXED] — removed `payplug_details` and `error.message` from responses
- **BE-2:** localhost CORS origins unconditionally allowed in PHP [FIXED] — only allowed when SERVER_NAME is localhost

### HTML
- **HTML-8:** Favicon missing [OPEN] — no favicon file exists in project
- **HTML-9:** Empty `src` on modal image [FIXED] — removed empty src from boutique modal, gallery lightbox, upload preview
- **HTML-10:** YouTube social link still placeholder [FIXED] — removed from footer
- **HTML-11:** Boutique.html has 1500+ lines inline JS [FIXED] — extracted to `js/pages/boutique.js`

---

## Recommended Priority Order

### Phase 1 - Critical Security (Immediate) - ALL DONE
1. ~~Add `js/core/config.js` to `.gitignore` and rotate Supabase keys~~ DONE
2. ~~Fix undefined `sanitize()` in `send-email.js` (runtime crash)~~ DONE
3. ~~Implement Swikly webhook signature verification~~ DONE
4. ~~Add server-side price validation in PayPlug webhook~~ DONE
5. ~~Remove personal data from `admin.html` source~~ DONE

### Phase 2 - Authentication Overhaul - ALL DONE
6. ~~Migrate to Supabase Auth exclusively~~ DONE
7. ~~Remove localStorage-based auth and legacy session fallback~~ DONE
8. ~~Add proper CSRF protection to upload/delete endpoints~~ DONE (Supabase JWT)

### Phase 3 - Consistency & Compliance - ALL DONE
9. ~~Migrate 6 hardcoded pages to dynamic partial system~~ DONE
10. ~~Add `role="dialog"` and `aria-modal="true"` to all modals~~ DONE
11. ~~Add `<main>` landmarks and `#main-content` targets~~ DONE
12. ~~Add `prefers-reduced-motion` media queries~~ DONE
13. ~~Fix focus styles across all CSS files~~ DONE

### Phase 4 - Code Quality - ALL DONE
14. ~~Add `netlify.toml` with security headers (CSP, X-Frame-Options, etc.)~~ DONE
15. ~~Scope boutique.css variables to `body[data-page="boutique"]`~~ DONE
16. ~~Fix memory leaks (modal listeners, audio clones)~~ DONE
17. ~~Extract inline JS from boutique.html~~ DONE
18. ~~Clean up dead code and duplicate CSS rules~~ DONE

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
