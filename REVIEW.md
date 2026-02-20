# Full Project Review — Mistral Pans Website

> **Date:** 2026-02-20
> **Version reviewed:** v3.5.x
> **Scope:** Architecture, security, accessibility, performance, code quality, tests

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture](#architecture)
3. [Security](#security)
4. [Accessibility](#accessibility)
5. [Performance](#performance)
6. [Code Quality](#code-quality)
7. [Test Coverage](#test-coverage)
8. [CSS & Design System](#css--design-system)
9. [Netlify Functions (Backend)](#netlify-functions-backend)
10. [Data Architecture](#data-architecture)
11. [Prioritized Recommendations](#prioritized-recommendations)

---

## Executive Summary

Mistral Pans is a well-crafted, static-first website for an artisanal handpan manufacturer. The codebase demonstrates solid fundamentals: semantic HTML, IIFE-based module isolation, CSS custom properties, and a progressive enhancement philosophy with no build system. The admin panel is comprehensive, and the configurator (boutique) with SVG player and Web Audio integration is technically impressive.

**Overall: Functional and well-organized for a small-team project, with specific areas needing hardening before scaling.**

### Scorecard

| Area | Grade | Summary |
|------|-------|---------|
| Architecture | **B+** | Clean module separation; implicit dependency ordering is fragile |
| Security | **B** | Good XSS prevention; gaps in input validation and CSRF |
| Accessibility | **B-** | Skip links, ARIA live regions present; tab/focus gaps in custom widgets |
| Performance | **B** | Lazy loading, passive listeners; no debounce on search, full-table fetches |
| Code Quality | **B-** | IIFE pattern consistent; heavy duplication in admin modals, 1000+ line files |
| Test Coverage | **C+** | 147 tests on utils/feasibility/scales; admin system untested |
| CSS/Design System | **B+** | Excellent variable system; breakpoint inconsistencies, no dark mode |
| Netlify Functions | **B** | Rate limiting, CORS, escaping; email injection risk, blocking webhook calls |
| Data Architecture | **B** | In-memory sync with Supabase; race conditions possible, materiaux in localStorage |

---

## Architecture

### Strengths

- **No build system** — direct file serving keeps things simple and debuggable
- **IIFE module pattern** — consistent `(function(window) { ... })(window)` encapsulation across all modules prevents global namespace pollution
- **Progressive enhancement** — pages work without JS for basic content; Supabase/admin layer loads conditionally
- **Partial loading system** — `main.js` fetches `partials/header.html`, `partials/footer.html`, `partials/contact-modal.html` in parallel with graceful error handling
- **MistralSync in-memory store** — business data fetched from Supabase into a `Map`, no localStorage for sensitive data
- **Event-driven data flow** — `mistral-sync-complete`, `mistral-data-change`, `gammesUpdated`, `taillesUpdated` custom events for cross-module communication

### Issues

1. **Implicit dependency ordering** — Modules rely on `<script>` tag order in HTML. No dependency graph, no initialization framework. If `admin-ui-gestion.js` loads before `admin-core.js`, functions are undefined.

2. **No centralized state store** — State scattered across `MistralGestion`, `MistralSync`, `AdminUI.getModalState()`, and `Storage` objects. Hard to reason about data flow.

3. **Module export via Object.assign to window** — `Object.assign(window.AdminUI, { ... })` from multiple files. Race conditions if modules load out of order.

4. **Mixed concerns in large files** — `boutique.js` (1,550 lines), `gestion.js` (1,492 lines), `admin-ui-modals-instruments.js` (1,074 lines) each handle multiple responsibilities.

---

## Security

### CSP Headers (netlify.toml)

The Content-Security-Policy is well-configured:
- `script-src 'self'` — no `unsafe-inline` or `unsafe-eval` (migrated to event delegation in v3.5.3)
- `object-src 'none'` — blocks Flash/Java plugins
- `base-uri 'self'` — prevents `<base>` tag injection
- `frame-src` limited to Calendly and PayPlug
- HSTS enabled with 1-year max-age

**Remaining CSP concern:** `style-src 'unsafe-inline'` is still present (required for dynamic styles and libraries). This is a common trade-off.

### XSS Prevention

- `escapeHtml()` in `utils.js` used consistently in render functions
- `sanitizeHtml()` with DOMPurify primary, custom DOMParser fallback
- Article content sanitized before loading into Quill editor

**Gaps:**
- Blog article HTML stored as raw Quill output — if DOMPurify is bypassed on save, XSS possible on article.html
- Error messages from Toast may contain unsanitized API responses (`supabase-client.js:79`)
- HTML sanitization fallback (custom DOMParser) doesn't handle all attack vectors (e.g., `behavior: url()` in style attributes)

### Input Validation

- Netlify functions validate email format, string lengths, and use `escapeHtml()` for all user-supplied text
- Honeypot fields on contact and teacher-signup forms
- PayPlug webhook recalculates prices server-side (fail-closed on mismatch)

**Gaps:**
- No CSRF tokens on Netlify Function calls (relies on SameSite cookies + CORS)
- Email validation regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) too permissive — accepts `a@b.c`
- `send-email.js` accepts base64 PDF attachments with no size limit — memory exhaustion risk
- `order-status.js` leaks email existence (returns 404 vs generic error)
- No rate limiting on admin-triggered emails (only contact forms)

### Authentication

- Supabase Auth (email + password) with in-memory session (no localStorage)
- `isLoggedInSync()` for immediate UI checks; `isLoggedIn()` for network-verified checks
- Legacy localStorage keys cleaned on logout

**Gaps:**
- No brute-force protection on login (no rate limiting at auth level)
- No per-resource authorization — any authenticated admin can modify any record
- Token returned by `getAccessTokenSync()` could be stale if refresh happens externally

---

## Accessibility

### Strengths

- Skip link in `header.html` (`<a class="skip-link" href="#main-content">`)
- `aria-live="polite"` on price display and cart badge
- `aria-expanded` on accordions, mobile nav toggle
- `role="dialog"` and `aria-modal="true"` on modals
- `aria-label` on icon-only buttons (cart, close, menu)
- Focus trap (`MistralFocusTrap`) for modals (WCAG 2.4.3)
- `prefers-reduced-motion` respected in CSS

### Critical Gaps

1. **Tab interface (boutique.html)** — Buttons at lines 88-97 are missing `role="tab"`, `aria-selected`, `aria-controls`. Keyboard users cannot navigate the configurator tabs properly.

2. **Focus indicators inconsistent** — `focus-visible` defined in `style.css` but missing on many interactive elements: gallery items, partner logos, notation toggle buttons, admin tabs.

3. **File input accessibility** — Teacher form photo upload uses `display: none` on file input. Should use `.visually-hidden` to remain in accessibility tree.

4. **Payment options (commander.html)** — Lines 729-785 use `<div role="button">` instead of proper radio inputs or button semantics.

5. **Admin panel** — No skip-to-content link, tables lack `<caption>`, search inputs lack `aria-describedby`, notification badges use `aria-hidden="true"` with visual-only content.

6. **Color contrast unverified** — Footer links at `rgba(255,255,255,0.7)` on dark background, `.button--ghost:hover` with `--color-text-light` may not meet WCAG AA 4.5:1.

---

## Performance

### Strengths

- `rel="preload"` and `rel="preconnect"` for critical resources
- Version query parameters on stylesheets for cache busting
- `IntersectionObserver` for scroll animations (no scroll event listener)
- Passive scroll event listener for header
- Audio cloning strategy (pre-load once, clone for polyphony)
- Chart.js and Quill.js lazy-loaded on demand
- Vendor libraries self-hosted (no CDN dependency except PayPlug PCI-DSS)
- 1-week cache headers on static assets (CSS, JS, resources)

### Issues

1. **No search debouncing** — Admin search inputs rebuild entire table on every keystroke. `renderClients()` rebuilds 100+ rows per character typed.

2. **Full-table fetches on every sync** — `MistralSync` fetches complete tables with no delta/incremental sync. No pagination for large datasets.

3. **main.js loaded without `defer`** — Blocks DOM parsing on index.html (line 246). Should add `defer` attribute.

4. **Audio format limitation** — FLAC-only audio samples. Safari has limited FLAC support. No MP3/OGG fallback.

5. **commander.html inline styles** — 638 lines of `<style>` block (lines 40-678) should be extracted to external CSS file.

6. **Canvas image compression is synchronous** — Blocks main thread during file upload. Could use OffscreenCanvas or Web Worker.

7. **Unbounded in-memory data** — `MistralSync` Map has no size limits or LRU eviction. Large datasets could cause memory issues.

---

## Code Quality

### Strengths

- Consistent IIFE module pattern across all files
- French comments and variable names (consistent with French-speaking team)
- `'use strict'` in utility modules
- JSDoc documentation in data modules (gammes-data.js, tailles-data.js)
- Clear file organization by domain (core, admin, services, features, data, pages)

### Issues

1. **Large monolithic files** — 5 files exceed 1,000 lines:
   - `boutique.js` (1,550 lines) — configurator + stock + cart + audio + pricing
   - `gestion.js` (1,492 lines) — all business logic (clients, instruments, locations, commandes, factures)
   - `send-email.js` (1,347 lines) — 11 email templates inline
   - `payplug-webhook.js` (1,320 lines) — payment processing + invoicing + stock + email
   - `admin-ui-modals-instruments.js` (1,074 lines) — CRUD + uploads + pricing + reference generation

2. **Duplication in admin modals** — Each entity modal (clients, instruments, locations, commandes, factures, teachers) repeats nearly identical edit/save/delete patterns. A generic `bindForm(formId, data, fieldMap)` helper would eliminate ~500 lines.

3. **`formatPrice()` defined in 3 places** — `utils.js`, `gestion.js`, and `admin-ui-compta.js`.

4. **Magic numbers throughout** — 50px scroll threshold, 2000ms modal close timeout, 100ms form init delay, 300ms CSS transition sync, 150ms touch debounce. No named constants.

5. **`generateId()` weak collision resistance** — Uses `Date.now()` + `Math.random()`, not cryptographically safe. Two IDs generated in the same millisecond could collide. `substr()` is deprecated (use `substring()`).

6. **Invoice numbering race condition** — `generateNumeroFacture()` reads counter, increments, writes. Two simultaneous admin sessions could get the same invoice number. Should use Supabase atomic increment (SQL sequence or RPC).

7. **Inconsistent error handling patterns** — Some modules throw errors, others return null, others log and continue silently. Network failures in Supabase deletes are logged but not retried — local state deleted while remote persists.

---

## Test Coverage

### Current State: 147 tests across 3 modules

| Module | Tests | Coverage Focus |
|--------|-------|----------------|
| `utils.js` | 96 | Formatting, escaping, sanitization, validation, debounce, generateId |
| `feasibility-module.js` | 23 | Surface calculations, threshold transitions, forbidden notes |
| `scales-data.js` | 28 | Constants, notation conversion, music theory |

### Strengths

- Good edge case testing (null, undefined, empty strings, spaces)
- Security focus: XSS vector testing in `sanitizeHtml`
- French locale testing for price/date formatting
- Non-regression tests with known values

### Critical Gaps

1. **Admin system entirely untested** — 15+ admin modules with ~10,000 lines of code have zero tests.

2. **No integration tests** — Boutique configurator → commander checkout flow untested.

3. **No Netlify function tests** — Rate limiting, price validation, email sending, webhook processing untested.

4. **No error path tests** — Network failures, invalid inputs, malformed data not tested.

5. **sanitizeHtml only tests fallback** — DOMPurify not loaded in jsdom; real production behavior with DOMPurify untested.

6. **formatPrice tests too lenient** — Uses `.toContain()` instead of exact match due to Intl locale variability. Could mask bugs.

---

## CSS & Design System

### Strengths

- Comprehensive CSS custom properties (colors, spacing, z-index, transitions)
- Mobile-first responsive approach with `clamp()` for fluid typography
- Print styles present (header/footer hidden, color reset, orphan/widow control)
- `prefers-reduced-motion` support
- Well-organized `style.css` with clear section dividers
- Teacher-form.css has excellent self-contained theming with `--tf-*` variables

### Issues

1. **Breakpoint inconsistency** — Uses 768px, 769px, 500px, 480px, 600px across files. No shared breakpoint variables.

2. **No system-wide dark mode** — Only admin has dark theme. No `@media (prefers-color-scheme: dark)` in style.css.

3. **Selector repetition in admin.css** — Date/time input styling (lines 1413-1431) repeats 8 selectors that could use `:is()`.

4. **Hardcoded SVG note colors** — Lines 39-45 in style.css use hex values instead of CSS custom properties.

5. **admin.css organization poor** — 2,224 lines with no clear section breaks. Form styles, table styles, and modal styles are scattered.

6. **Dead CSS selectors** — `.partner-card`, `.hero__badge-icon` in style.css appear unused. Flash card `::after` pseudo-element duplicates an existing button.

---

## Netlify Functions (Backend)

### Summary

| Function | Risk | Key Concern |
|----------|------|-------------|
| `send-email.js` | MEDIUM | PDF attachment no size limit, 11 inline templates |
| `teacher-signup.js` | LOW | GPS defaults silently to Paris if invalid |
| `payplug-create-payment.js` | MEDIUM | Price validation fail-open on DB error |
| `payplug-webhook.js` | HIGH | Email function blocks webhook, flagged payments not segregated |
| `swikly-create-deposit.js` | LOW | Response fields not validated |
| `swikly-webhook.js` | MEDIUM | Email injection risk in customer name |
| `order-status.js` | MEDIUM | Email enumeration via distinct 404 |
| `sitemap.js` | LOW | Fetches all items every request |
| `rate-limit.js` | LOW | Unknown IP shares single rate-limit bucket |

### Critical Issues

1. **Blocking email calls in payplug-webhook.js** — If `send-email` hangs, the entire webhook handler blocks. Should use `Promise.allSettled()` for non-critical operations.

2. **No HMAC signature on PayPlug webhooks** — Verifies via API call instead (acceptable but not ideal). Swikly webhooks correctly use `crypto.timingSafeEqual()`.

3. **Email enumeration in order-status.js** — Returns 404 for "not found" vs "email mismatch", allowing attackers to discover which emails have placed orders. Should return generic "Order not found" for both.

4. **Rate-limit fail-open by default** — If Supabase is down, requests are allowed through. Only `teacher-signup.js` uses fail-closed mode.

---

## Data Architecture

### Strengths

- In-memory data via `MistralSync` — no localStorage for business data (RGPD compliant)
- Selective table sync per page (only loads what the current page needs)
- Two-phase transform (`transformFromSupabase()` / `transformToSupabase()`) handles schema mapping
- Key-value config tables with namespace filtering

### Issues

1. **Materiaux stored in localStorage, not Supabase** — Unlike tailles and gammes which sync via MistralSync, materiaux uses localStorage. Admin changes don't propagate to other users. Inconsistent with the rest of the data architecture.

2. **Feasibility data type mismatch** — `tailles-data.js` stores thresholds as percentages (`comfortPct`, `warningPct`, `maxPct`), but `feasibility-module.js` expects absolute mm² values (`COMFORT`, `WARNING`, `MAX`). No conversion layer.

3. **Race conditions in sync** — `setData()` updates in-memory immediately AND queues Supabase writes async. If two rapid updates occur, the second may overwrite the first's Supabase write.

4. **No delta/incremental sync** — Full table fetch on every page load. No change tracking or cursor-based pagination.

5. **Custom layout overrides are silent** — `gammes-data.js` custom_layouts overwrite `SCALES_DATA` patterns with no admin notification or audit trail.

---

## Prioritized Recommendations

### P0 — Security Fixes

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 1 | PDF attachment size not validated | `send-email.js` | Add 5MB base64 size limit before processing |
| 2 | Email enumeration | `order-status.js` | Return generic "Order not found" for all lookup failures |
| 3 | Blocking webhook operations | `payplug-webhook.js` | Use `Promise.allSettled()` for email/stock/invoice updates |
| 4 | Invoice number race condition | `gestion.js` | Use Supabase atomic increment (RPC or SQL sequence) |
| 5 | Blog article HTML not sanitized on save | `admin-ui-content.js` | Call `sanitizeHtml()` on Quill output before `setData()` |

### P1 — Accessibility Fixes

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 6 | Tab interface missing ARIA | `boutique.html` | Add `role="tab"`, `aria-selected`, `aria-controls` to configurator tabs |
| 7 | Payment options not semantic | `commander.html` | Replace `div[role="button"]` with proper radio inputs |
| 8 | Focus indicators missing | `boutique.css`, `style.css` | Add `:focus-visible` to all interactive elements |
| 9 | File input hidden with display:none | `apprendre.html` | Use `.visually-hidden` class instead |
| 10 | Color contrast unverified | Global | Audit with axe-core or Lighthouse, fix failing elements |

### P2 — Performance Improvements

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 11 | main.js blocks DOM | `index.html` | Add `defer` attribute |
| 12 | No search debouncing | `admin-ui-*.js` | Wrap search handlers with `debounce(300)` |
| 13 | Inline styles in commander.html | `commander.html` | Extract to `css/commander.css` |
| 14 | FLAC-only audio | `handpan-player.js` | Add MP3/OGG fallback for Safari compatibility |
| 15 | Full-table sync | `supabase-sync.js` | Implement `modified_at` cursor for delta sync |

### P3 — Code Quality

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 16 | Repeated modal patterns | `admin-ui-modals-*.js` | Create generic `bindForm(formId, data, fieldMap)` helper |
| 17 | formatPrice defined 3x | `utils.js`, `gestion.js`, `compta.js` | Use `MistralUtils.formatPrice()` everywhere |
| 18 | Magic numbers | Multiple files | Extract to named constants in each module |
| 19 | generateId collision risk | `utils.js` | Use `crypto.randomUUID()` with fallback |
| 20 | Large monolithic files | `boutique.js`, `gestion.js` | Split by responsibility (pricing, audio, cart, etc.) |

### P4 — Testing

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 21 | Admin system untested | `tests/` | Add tests for gestion.js CRUD and validation functions |
| 22 | No integration tests | `tests/` | Add boutique → commander workflow test |
| 23 | No Netlify function tests | `tests/` | Add price validation and rate-limiting tests |
| 24 | Error path coverage | `tests/` | Add tests for network failures, invalid inputs |

### P5 — Data Architecture

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 25 | Materiaux in localStorage | `materiaux-data.js` | Migrate to Supabase + MistralSync like tailles/gammes |
| 26 | Feasibility data type mismatch | `tailles-data.js` / `feasibility-module.js` | Add conversion layer or unify units |
| 27 | Breakpoint inconsistency | CSS files | Define shared breakpoint system |
| 28 | No dark mode for public pages | `style.css` | Add `prefers-color-scheme: dark` media query |

---

## Detailed Findings by Module

### Core JavaScript (`js/core/`)

**main.js:**
- `getCurrentPageName()` fails with query parameters (e.g., `/boutique.html?ref=1`)
- Accordion logic uses `parentElement` only — breaks for nested structures
- Modal focus trap uses arbitrary 50ms timeout — use `requestAnimationFrame` instead
- Contact form double-init check via `dataset` can be bypassed if form is cloned

**utils.js:**
- `parsePrice()` locale-ambiguous: `"1.250,50"` (EU) and `"1,250.50"` (US) both parse to same value
- `sanitizeHtml()` fallback doesn't handle all attack vectors (CSS `behavior:` property)
- `isValidEmail()` too permissive (accepts `a@b.c`)
- `loadScript()` / `loadStylesheet()` don't distinguish CSP blocks from network errors

**cookie-consent.js:**
- No graceful fallback if localStorage disabled (banner reshows on every page)
- Service names duplicated between `SERVICES` constant and hardcoded form choices
- CSS transition duration hardcoded in JS (300ms must match CSS)
- No consent version migration path — version bump forces complete re-consent

### Services (`js/services/`)

**supabase-client.js:**
- Generic CRUD factory is well-designed
- XSS risk in Toast error messages (API error strings displayed without escaping)
- No bulk operations — individual upserts for batch changes (N+1 queries)
- Search function does SQL LIKE escaping but no input length validation

**supabase-auth.js:**
- In-memory session management prevents localStorage-based session hijacking
- `isLoggedInSync()` could return stale state if token refreshes externally
- No brute-force protection on login endpoint

**supabase-sync.js:**
- Transform functions assume column names match without validation
- `onReady()` callbacks not error-handled — one failing callback blocks others
- No retry logic for failed table fetches

**email-client.js:**
- No input sanitization before sending to Netlify function
- No retry on transient network errors
- No size limit on PDF data URL attachments

**payplug-client.js:**
- Return URL constructed from `window.location.origin` without validation
- Customer data (email, phone) not validated before passing to PayPlug
- Integrated payment SDK initialized per call instead of singleton

### Features (`js/features/`)

**handpan-player.js:**
- Audio path option directly interpolated in `Audio.src` — XSS if path is user-controlled
- Complex 150-line pattern parser (`parseLayout`) with no formal grammar
- Good memory management: `destroy()` method comprehensively cleans event listeners and audio

**feasibility-module.js:**
- Hardcoded surface calculation formula for unknown notes is unexplained
- UI hint links assume modal system exists (`data-modal="contact"`)
- DOM updates rebatch all chips on every change (no diffing)

**upload.js:**
- Good hybrid approach: IndexedDB for localhost, Supabase Storage for production
- Canvas compression is synchronous (blocks main thread)
- `getPublicUrl()` may not be awaited properly (async in Supabase v2)
- `createUploadInput()` at 200 lines is too large for a single function

**teacher-form.js:**
- Geocoding with AbortController cancellation is well-done
- Image compression duplicated from upload.js — code reuse opportunity
- No sanitization of collected form data before return

### Pages (`js/pages/`)

**boutique.js:**
- Price rounding always rounds DOWN (`Math.floor(rawPrice / 5) * 5`) — documented in CLAUDE.md but could surprise users
- Accessoire selection disappears silently when size changes (if new size has no compatible housse)
- Event listeners accumulate on `gammesUpdated`/`taillesUpdated` — no cleanup on navigation
- Notation mode stored internally as sharp but URL params could contain flat notation

**commander.js:**
- Deposit rate conversion bug: if config sends "0.30" instead of "30", result is 0.003 (double division)
- `parseInt()` used for price parsing — `parseInt("1abc")` returns 1 silently
- Single-item cart doesn't validate item type (could be accessoire, not instrument)

### Admin System (`js/admin/`)

- 17 files, ~15,000+ lines, **zero test coverage**
- Invoice counter non-atomic — race condition with concurrent admins
- Network errors on Supabase DELETE silently log — data inconsistency between local and remote
- Modal state leaks if modal destroyed unexpectedly (no cleanup)
- `withSaveGuard()` silently returns on double-click — user gets no feedback
- File upload handlers have no size validation — could crash browser with large files
- Quill editor output not sanitized before persistence

---

*Generated by automated code review. Items should be verified in context before implementing fixes.*
