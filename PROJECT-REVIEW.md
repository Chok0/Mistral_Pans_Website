# Revue de Production - Mistral Pans Website

> **Date :** 9 février 2026
> **Version :** v3.5
> **Scope :** Audit complet pre-production (structure, sécurité, performance, SEO, accessibilité, qualité de code)

---

## Résumé Exécutif

Le projet est **globalement solide** avec une architecture bien pensée (vanilla JS, Supabase, Netlify). Le code est propre, bien organisé et la séparation des responsabilités est correcte.

**Cependant, plusieurs problèmes doivent être adressés avant la mise en production :**

| Catégorie | Critique | Haute | Moyenne | Basse |
|-----------|:--------:|:-----:|:-------:|:-----:|
| Sécurité | 2 | 3 | 4 | 2 |
| Performance | 2 | 2 | 3 | 1 |
| SEO / Contenu | 3 | 4 | 3 | 2 |
| Qualité de code | 1 | 4 | 6 | 3 |
| **Total** | **8** | **13** | **16** | **8** |

**Score global : 7/10 — Prêt avec corrections prioritaires**

---

## Table des Matières

1. [Bloqueurs de Production (CRITIQUE)](#1-bloqueurs-de-production-critique)
2. [Sécurité](#2-sécurité)
3. [Performance](#3-performance)
4. [SEO et Contenu](#4-seo-et-contenu)
5. [Qualité de Code](#5-qualité-de-code)
6. [Configuration Netlify](#6-configuration-netlify)
7. [Ce qui est bien fait](#7-ce-qui-est-bien-fait)
8. [Plan d'action recommandé](#8-plan-daction-recommandé)

---

## 1. Bloqueurs de Production (CRITIQUE)

### 1.1 `config.js` traqué par Git

**Fichier :** `js/core/config.js`
**Problème :** Le fichier contient les clés Supabase (URL + anon key) et est versionné dans Git malgré la présence dans `.gitignore`.

```bash
$ git ls-files --error-unmatch js/core/config.js
js/core/config.js  # ← Confirmé : traqué
```

**Impact :** La clé anon est conçue pour être publique (sécurisée par RLS), mais le fichier ne devrait pas être traqué pour de bonnes pratiques.

**Correction :**
```bash
git rm --cached js/core/config.js
# Vérifier que .gitignore contient bien js/core/config.js
```

### 1.2 Images non optimisées (~26 Mo pour 5 images)

| Fichier | Taille | Usage |
|---------|--------|-------|
| `DAmara ember.png` | **7.1 Mo** | Galerie/boutique |
| `AMARA.png` | **5.9 Mo** | Index (affichée à 60×60px !) |
| `20240225_112013.jpg` | **4.9 Mo** | Galerie |
| `20230801_1622372.jpg` | **4.6 Mo** | Hero background |
| `20240315_162320.jpg` | **3.4 Mo** | Galerie |

**Impact :** Temps de chargement catastrophique. L'image hero seule fait 4.6 Mo. `AMARA.png` (5.9 Mo) est affichée 3 fois à 60×60 pixels.

**Correction :**
- Compresser toutes les images (WebP/AVIF avec fallback JPG)
- Redimensionner `AMARA.png` à 120×120px max (pour retina)
- Hero : fournir des versions responsive (480w, 768w, 1200w, 1920w)
- Ajouter `loading="lazy"` sur toutes les images below-the-fold
- Ajouter `width` et `height` HTML pour éviter le CLS

### 1.3 Accents manquants dans les CGV

**Fichier :** `cgv.html`
**Problème :** Tous les accents sont absents sur cette page légale.

```
Ligne 62: "Conditions Generales de Vente" → "Conditions Générales de Vente"
Ligne 66: "regissent" → "régissent", "realises" → "réalisées"
Ligne 73: "fabriques" → "fabriqués", "caracteristiques" → "caractéristiques"
Ligne 78: "etre" → "être"
Ligne 83: "specifiques" → "spécifiques", "detaillees" → "détaillées"
... (page entière affectée)
```

**Impact :** Page légale non professionnelle. Potentiellement invalide juridiquement si les accents changent le sens des mots.

### 1.4 Typo sur page légale

**Fichier :** `mentions-legales.html:91`
```
"SANTAMARIA ADRIE]" → "SANTAMARIA ADRIEN"
```

**Impact :** Nom du directeur de publication incorrect sur une page à valeur légale.

### 1.5 Validation de prix "fail-open"

**Fichier :** `netlify/functions/payplug-create-payment.js:56-57`
```javascript
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  return { valid: true }; // ← Accepte TOUT si les vars d'env manquent
}
```

Et aussi à la ligne 113 :
```javascript
} catch (error) {
  return { valid: true }; // ← Accepte TOUT en cas d'erreur
}
```

**Impact :** Si les variables d'environnement Supabase ne sont pas configurées sur Netlify, ou en cas d'erreur réseau vers Supabase, la validation de prix est contournée — n'importe quel montant est accepté.

**Correction :** Changer en `{ valid: false, reason: 'Validation indisponible' }` (fail-closed).

---

## 2. Sécurité

### 2.1 CSP avec `unsafe-inline` et `unsafe-eval` (HAUTE)

**Fichier :** `netlify.toml:16`
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.payplug.com
```

**Problème :** `unsafe-inline` réduit considérablement l'efficacité du CSP contre les XSS. `unsafe-eval` permet `eval()`.

**Contexte :** Nécessaire actuellement pour :
- Scripts inline dans location.html, suivi.html, article.html, index.html
- Quill.js (éditeur WYSIWYG) utilise `eval()`

**Correction progressive :**
1. Externaliser les scripts inline dans des fichiers `.js` séparés
2. Utiliser des nonces CSP pour les scripts restants
3. Vérifier si Quill.js v2 est compatible sans `unsafe-eval`

### 2.2 Header HSTS manquant (HAUTE)

**Fichier :** `netlify.toml`
**Manquant :**
```toml
Strict-Transport-Security = "max-age=31536000; includeSubDomains"
```

**Impact :** Sans HSTS, les premières connexions peuvent être interceptées via HTTP avant redirection HTTPS.

### 2.3 Sanitisation URL incomplète (MOYENNE)

**Fichier :** `js/admin/admin-core.js:126-134`
```javascript
if (attrName === 'href' || attrName === 'src') {
  const value = attr.value.toLowerCase().replace(/\s+/g, '').trim();
  if (value.startsWith('javascript:') || ...)
```

**Problème :** Ne décode pas les entités HTML ni les encodages URL avant la vérification. Des contournements via `&#106;avascript:` ou `jav%61script:` sont théoriquement possibles.

**Contexte atténuant :** Cette fonction ne traite que du contenu admin (déjà authentifié). Le risque est limité au self-XSS admin.

**Correction :**
```javascript
const decoded = decodeURIComponent(attr.value);
const normalized = decoded.replace(/[\s\x00-\x1f]/g, '').toLowerCase();
if (/^(javascript|data|vbscript|blob):/.test(normalized)) { ... }
```

### 2.4 Rate limiting in-memory sur Netlify Functions (MOYENNE)

**Fichiers :** `send-email.js:695`, `payplug-create-payment.js:120`, `swikly-create-deposit.js:38`

**Problème :** Les `Map()` de rate limiting sont perdues à chaque cold start de la fonction serverless (~15 min d'inactivité).

**Impact :** Protection partielle. Un attaquant patient peut contourner en espaçant ses requêtes.

**Correction à terme :** Utiliser un rate limiter persistant (table Supabase, ou Netlify Edge avec KV store).

### 2.5 `console.log` en production (MOYENNE)

**Constat :** 165+ `console.log/warn/error` dans le code frontend (hors vendor).

| Module | Nombre |
|--------|--------|
| Admin | 77 |
| Pages | 43 |
| Features | 24 |
| Services | 21 |
| Netlify Functions | 66 (OK pour serverless) |

**Impact :** Fuite d'information en console (noms de tables, structure de données, flux de navigation). Les `console.log` des Netlify Functions sont OK (logs serveur).

**Correction :** Remplacer par un logger conditionnel :
```javascript
const log = (msg, ...args) => { if (window.MISTRAL_DEBUG) console.log(msg, ...args); };
```

### 2.6 SIRET/IBAN dans le code client (BASSE)

**Fichier :** `js/admin/gestion.js:28-40`

**Contexte :** Ces infos sont nécessaires pour la génération de factures PDF côté admin. Le SIRET est une information publique (registre du commerce). L'IBAN est requis sur les factures françaises.

**Observation :** Le fichier n'est chargé que dans le contexte admin (après authentification). Risque acceptable, mais idéalement ces données devraient venir de la config Supabase.

### 2.7 Vérification webhook PayPlug — OK

**Fichier :** `netlify/functions/payplug-webhook.js:491-493`
```javascript
// Vérifier le paiement via l'API Payplug (sécurité)
const payment = await getPaymentDetails(paymentId, secretKey);
```

**Constat positif :** Le webhook utilise le pattern "fetch-back" recommandé par PayPlug : au lieu de vérifier une signature, il re-récupère le paiement via l'API avec la clé secrète. Si l'ID est invalide ou n'appartient pas au compte, l'appel échoue. C'est la méthode de vérification documentée par PayPlug.

---

## 3. Performance

### 3.1 Scripts bloquants sur boutique.html (HAUTE)

**Fichier :** `boutique.html:449-475`

10+ balises `<script>` chargées séquentiellement sans `defer` ni `async` :
- scales-data.js, gammes-data.js, tailles-data.js, materiaux-data.js
- feasibility-module.js, boutique.js
- cookie-consent.js, main.js
- handpan-player.js, admin-core.js, boutique-admin.js

**Impact :** Chaque script bloque le parsing HTML. Sur mobile avec connexion 3G, le temps de chargement est significativement impacté.

**Correction :** Ajouter `defer` aux scripts de données et modules admin. Seuls `cookie-consent.js` et `main.js` doivent rester synchrones.

### 3.2 Aucun lazy loading d'images (HAUTE)

**Fichiers :** Toutes les pages HTML

Aucune image n'utilise `loading="lazy"`. Aucune n'a d'attributs `width`/`height` HTML (utilisation de CSS inline à la place).

**Impact :** Toutes les images chargent immédiatement, même hors viewport. Cumulative Layout Shift (CLS) élevé.

### 3.3 Audio FLAC sans fallback (MOYENNE)

**Fichier :** `js/features/handpan-player.js`

56 échantillons FLAC (~2.1 Mo total). FLAC n'est pas universellement supporté (Safari/iOS a un support limité selon les versions).

**Correction :** Fournir un fallback MP3 ou OGG :
```javascript
const audio = new Audio();
const src = audio.canPlayType('audio/flac') ? `${note}.flac` : `${note}.mp3`;
```

### 3.4 Pas de styles d'impression (BASSE)

**Fichiers :** Aucun CSS

Aucune règle `@media print` définie. Les pages légales (CGV, mentions légales) et les factures ne s'imprimeront pas correctement.

---

## 4. SEO et Contenu

### 4.1 JSON-LD / Schema.org absent (CRITIQUE)

**Fichiers :** Toutes les pages publiques

Aucun balisage structured data. Impact direct sur les rich snippets Google.

**Pages prioritaires :**
- `index.html` : `Organization` + `LocalBusiness`
- `boutique.html` : `Product`
- `article.html` : `Article` (dynamique)
- `apprendre.html` : `EducationalOrganization`

### 4.2 URLs canoniques manquantes (HAUTE)

**Fichiers :** Toutes les pages

Aucune balise `<link rel="canonical">`. Risque de contenu dupliqué si le site est accessible via www et non-www.

### 4.3 Titres de pages courts (HAUTE)

| Page | Titre actuel | Longueur |
|------|-------------|----------|
| `commander.html` | "Commander - Mistral Pans" | 24 chars |
| `article.html` | "Article — Mistral Pans" | 22 chars |

**Recommandé :** 50-60 caractères pour un SEO optimal.

### 4.4 OG/Twitter Cards manquants sur pages légales (HAUTE)

**Fichiers :** `cgv.html`, `mentions-legales.html`

Pas de balises Open Graph ni Twitter Card.

### 4.5 `og:image` manquant sur suivi.html (MOYENNE)

**Fichier :** `suivi.html:7-10`

Balises OG présentes mais `og:image` et `og:locale` manquants.

### 4.6 Alts d'images génériques (MOYENNE)

**Fichier :** `boutique.html:70, 82, 94`

Les 3 images de cartes utilisent le même alt : "Handpan Mistral Pans". Devrait être descriptif et unique pour chaque carte.

### 4.7 `alert()` au lieu de Toast (MOYENNE)

**Fichiers :** `feasibility-module.js` (2 instances), `teacher-form.js` (4 instances)

6 `alert()` bloquants au lieu d'utiliser le système Toast déjà en place.

---

## 5. Qualité de Code

### 5.1 Fuites mémoire - event listeners non nettoyés (CRITIQUE)

Plusieurs listeners globaux (`document.addEventListener`) ajoutés sans être retirés :

| Fichier | Ligne(s) | Listener |
|---------|----------|----------|
| `admin-core.js` | 430-441 | FAB click outside + Escape (dans `FAB.create()`, non retiré dans `FAB.destroy()`) |
| `admin-core.js` | 538 | Modal Escape key (1 listener par modal, jamais retiré) |
| `main.js` | 172 | Scroll listener (window) |
| `main.js` | 204 | Click outside mobile nav (ajouté à chaque `initMobileNav()`) |

**Impact :** Sur des sessions admin longues avec ouverture/fermeture de modals, les listeners s'accumulent. Impact mémoire progressif.

**Correction :** Utiliser `AbortController` ou stocker les références pour cleanup :
```javascript
// Dans FAB.create()
this._abortController = new AbortController();
document.addEventListener('click', handler, { signal: this._abortController.signal });
// Dans FAB.destroy()
this._abortController.abort();
```

### 5.2 Race condition sur le flag `supabaseLoading` (HAUTE)

**Fichier :** `js/core/main.js:10-13`
```javascript
if (window.MistralSync || window.supabaseLoading) return;
window.supabaseLoading = true;
```

Si `config.js` échoue en chargement (onerror), le flag n'est jamais remis à `false`. Toute tentative de rechargement ultérieure est bloquée silencieusement.

**Correction :** Ajouter `window.supabaseLoading = false;` dans le handler `onerror`.

### 5.3 Variables globales mutables pour l'état des modals (HAUTE)

**Fichiers :** `admin-ui-modals.js`, `admin-ui-boutique.js`

Exemples : `instrumentEnVente`, `selectedInstrumentForBoutique`, `currentEditingTeacherId`, `accessoireUploadedImage`.

**Problème :** Si un admin ouvre le modal A puis clique rapidement sur le modal B, la variable globale est écrasée. Le premier modal opère sur les mauvaises données.

**Correction :** Passer l'état par le contexte du modal (data-attributes ou closure), pas par des variables globales.

### 5.4 Pas de debounce sur les boutons de sauvegarde (HAUTE)

**Fichiers :** `admin-ui-modals.js` (saveClient, saveInstrument, saveFacture, etc.)

Un clic rapide multiple sur "Sauvegarder" déclenche plusieurs appels Supabase en parallèle.

**Correction :** Désactiver le bouton pendant l'opération :
```javascript
btn.disabled = true;
try { await save(); } finally { btn.disabled = false; }
```

### 5.5 CSS/JS inline massif dans certaines pages (HAUTE)

| Page | Lignes inline | Type |
|------|:------------:|------|
| `apprendre.html` | ~940 lignes | CSS admin |
| `suivi.html` | ~135 lignes | JS + ~280 lignes CSS |
| `article.html` | ~135 lignes | JS |
| `location.html` | ~59 lignes | JS |
| `index.html` | ~34 lignes | JS |

**Impact :** Empêche la mise en cache séparée, gonfle le HTML, et nécessite `unsafe-inline` dans le CSP.

### 5.6 Absence de validation de longueur sur les champs admin (MOYENNE)

**Fichier :** `js/admin/gestion.js:200-207`

`validateClient()` vérifie la présence du nom et le format email, mais pas :
- La longueur maximale des champs
- Le format du téléphone
- La validité de l'adresse

### 5.7 Pas de pagination dans les listes admin (MOYENNE)

**Fichier :** `admin-ui-gestion.js`

`renderClients()`, `renderInstruments()`, etc. affichent tous les enregistrements dans le DOM sans pagination ni virtualisation.

**Impact :** Avec 1000+ clients, le rendu sera lent et la mémoire DOM importante.

### 5.8 Emails de webhook potentiellement envoyés en double (MOYENNE)

**Fichier :** `netlify/functions/payplug-webhook.js:538`

```javascript
await Promise.all([
  recordPayment(payment, metadata),
  createOrUpdateOrder(payment, metadata),
  updateInstrumentStatus(metadata),
  sendPaymentConfirmationEmail(...),
  sendArtisanNotification(...)
]);
```

Si PayPlug renvoie le webhook (retry après timeout), l'upsert sur la commande est idempotent (OK), mais les emails sont renvoyés.

**Correction :** Ajouter un flag `notification_sent` sur la commande et vérifier avant d'envoyer.

---

## 6. Configuration Netlify

### 6.1 Ce qui est bien configuré

- Headers de sécurité : `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- Cache resources (images/audio) : 7 jours avec `immutable`
- Cache CSS/JS : 1 heure (bon pour les itérations)
- Functions directory correctement configuré
- CORS dans les fonctions avec whitelist d'origines

### 6.2 À ajouter

```toml
# HSTS (à ajouter dans [[headers]])
Strict-Transport-Security = "max-age=31536000; includeSubDomains"
```

### 6.3 À améliorer à terme

- Remplacer `unsafe-inline`/`unsafe-eval` par des nonces CSP
- Ajouter des redirects 301 pour www → non-www (ou l'inverse)
- Ajouter un cache-bust sur les fichiers CSS/JS (hash dans le nom de fichier)

---

## 7. Ce qui est bien fait

### Architecture
- **Separation of concerns excellente** : core/, admin/, services/, features/, data/, pages/
- **Pas de framework lourd** : vanilla JS, rapide, maintenable
- **Vendor self-hosted** avec tracking de versions (`js/vendor/versions.json`)
- **Partial loading system** propre via fetch()

### Sécurité
- **Vérification webhook PayPlug** via fetch-back API (pattern recommandé)
- **Vérification webhook Swikly** via HMAC-SHA256 avec `timingSafeEqual`
- **Validation de prix côté serveur** (payplug-create-payment.js + payplug-webhook.js)
- **Honeypot anti-spam** (pas de dépendance externe, RGPD friendly)
- **Pas de secrets hardcodés** dans le frontend (sauf anon key publique by design)
- **CORS whitelist** sur toutes les Netlify Functions
- **RLS Supabase** pour la protection des données

### RGPD
- **Cookie consent** avec granularité (nécessaires, statistiques, réseaux sociaux)
- **Fonts conditionnels** (Google Fonts chargé uniquement après consentement)
- **Leaflet consent** séparé pour les cartes
- **Honeypot > reCAPTCHA** (pas de transfert de données vers Google)
- **Analytics maison** (`mistral-stats.js`) avec données anonymisées en localStorage
- **Pas de localStorage** pour les données business (in-memory via MistralSync)

### Qualité de code
- **Commentaires riches** en français et anglais
- **escapeHtml()** utilisé systématiquement dans le code admin
- **Gestion d'erreurs try/catch** dans toutes les Netlify Functions
- **Pas de stack traces renvoyées** aux clients
- **Supabase Auth** (pas de session custom fragile)
- **Upload sécurisé** : validation type MIME, taille max, noms de fichiers générés

### UX
- **Design system cohérent** avec CSS custom properties
- **Responsive mobile-first** avec breakpoints bien définis
- **Toast notifications** pour le feedback utilisateur
- **Système de modals** avec support Escape et click-outside
- **Motion preferences** respectées (`prefers-reduced-motion`)
- **Skip navigation link** pour l'accessibilité

---

## 8. Plan d'action recommandé

### Phase 1 — Avant mise en prod (BLOQUANT)

| # | Action | Fichier(s) | Effort |
|---|--------|-----------|--------|
| 1 | Corriger les accents dans cgv.html | `cgv.html` | 30 min |
| 2 | Corriger le typo mentions-legales.html | `mentions-legales.html:91` | 2 min |
| 3 | Optimiser les 5 images lourdes (compression + resize) | `ressources/images/` | 1h |
| 4 | Retirer config.js du suivi Git | `js/core/config.js` | 5 min |
| 5 | Changer fail-open en fail-closed pour la validation de prix | `payplug-create-payment.js:57,113` | 10 min |
| 6 | Ajouter HSTS header | `netlify.toml` | 5 min |

### Phase 2 — Première semaine post-launch

| # | Action | Fichier(s) | Effort |
|---|--------|-----------|--------|
| 7 | Ajouter `loading="lazy"` + `width/height` sur les images | Toutes pages HTML | 1h |
| 8 | Ajouter `defer` aux scripts non-critiques | `boutique.html`, autres | 30 min |
| 9 | Remplacer les 6 `alert()` par des Toast | `feasibility-module.js`, `teacher-form.js` | 30 min |
| 10 | Ajouter les URLs canoniques | Toutes pages HTML | 30 min |
| 11 | Compléter les OG/Twitter tags manquants | `cgv.html`, `mentions-legales.html`, `suivi.html` | 30 min |
| 12 | Corriger le flag `supabaseLoading` en cas d'erreur | `main.js:37` | 5 min |
| 13 | Ajouter debounce sur boutons de sauvegarde admin | `admin-ui-modals.js` | 30 min |

### Phase 3 — Mois suivant

| # | Action | Effort |
|---|--------|--------|
| 14 | Externaliser les scripts/CSS inline | 2-3h |
| 15 | Nettoyer les console.log (logger conditionnel) | 1h |
| 16 | Ajouter JSON-LD structured data | 2h |
| 17 | Corriger les fuites mémoire (event listeners) | 2h |
| 18 | Éliminer les variables globales mutables dans les modals | 3h |
| 19 | Ajouter la protection contre les emails webhook en double | 1h |
| 20 | Ajouter un fallback MP3 pour l'audio | 1h |
| 21 | Ajouter pagination dans les listes admin | 3h |

### Phase 4 — Améliorations continues

| # | Action |
|---|--------|
| 22 | Supprimer `unsafe-inline`/`unsafe-eval` du CSP (externaliser tout le JS inline) |
| 23 | Implémenter un rate limiting persistant (Supabase ou KV store) |
| 24 | Ajouter `@media print` pour les pages légales et factures |
| 25 | Décoder les URL dans sanitizeHtml() (protection XSS renforcée) |
| 26 | Ajouter validation de longueur sur les champs admin |

---

## Métriques du Projet

| Métrique | Valeur |
|----------|--------|
| Pages HTML | 12 |
| Partials | 4 |
| Fichiers CSS | 4 (130 Ko) |
| Fichiers JS (hors vendor) | 37 (~470 Ko) |
| Vendor JS | 4 libs (611 Ko) |
| Netlify Functions | 6 (~70 Ko) |
| Lignes de code (estimation) | ~15 000 |
| Tables Supabase | 10 |
| Images | ~10 fichiers (~26 Mo non optimisé) |
| Audio | 56 échantillons FLAC (2.1 Mo) |

---

*Rapport généré le 9 février 2026. Prochain audit recommandé : 1 mois après mise en production.*
