# Revue de Production - Mistral Pans Website

> **Date :** 15 février 2026 (mise à jour v2)
> **Version :** v3.5
> **Scope :** Audit complet pre-production + revue des évolutions post-audit (structure, sécurité, performance, SEO, accessibilité, qualité de code)

---

## Résumé Exécutif

Le projet est **globalement solide** avec une architecture bien pensée (vanilla JS, Supabase, Netlify). Le code est propre, bien organisé et la séparation des responsabilités est correcte.

**Après 4 phases de corrections, le site est prêt pour la production.** Depuis l'audit initial (9 février), ~20 commits ont ajouté de nouvelles fonctionnalités (panier multi-articles, page annonce, système de notation FR/US, instrument virtuel, promotions). Cette mise à jour couvre les **nouveaux problèmes introduits** par ces évolutions.

| Catégorie | Critique | Haute | Moyenne | Basse | Statut |
|-----------|:--------:|:-----:|:-------:|:-----:|:------:|
| Sécurité | ~~2~~ 0 + **1 nouveau** | ~~3~~ 1 | ~~4~~ 2 + ~~1 nouveau~~ | 2 | 6 corrigés (dont §2.1 CSP, §7.3 escapeHtml) |
| Performance | ~~2~~ 0 | ~~2~~ 0 + **1 nouveau** | ~~3~~ 2 | ~~1~~ 0 | 5 corrigés |
| SEO / Contenu | ~~3~~ 0 | ~~4~~ 1 | ~~3~~ 1 | 2 | 6 corrigés, sitemap+robots ajoutés |
| Qualité de code | ~~1~~ 0 | ~~4~~ 2 + ~~1 nouveau~~ | ~~6~~ 4 + **2 nouveaux** | 3 | 9 corrigés (dont §5.5, §7.4 inline JS, items 14/22) |
| **Total** | **1** | **4** | **11** | **7** | **26 corrigés** |

**Score global : 8/10 — Prêt pour la production avec réserves (validation panier)**

### Corrections effectuées (6 commits, audit initial)

| Phase | Commit | Corrections |
|-------|--------|-------------|
| 1 | `5bca2a2` | Accents CGV, typo mentions légales, fail-closed paiement, HSTS, flag supabaseLoading |
| 1 | `b0f7802` | config.js retiré du suivi Git |
| 1 | `ddf0218` | Images optimisées : 26 Mo → 1.4 Mo (-95%) |
| 2 | `f4f238c` | `defer` scripts, `loading="lazy"`, canonical URLs, OG/Twitter tags, Toast, debounce saves |
| 3 | `a7f332a` | 37 console.log supprimés, 14 conditionnels, memory leaks (AbortController), webhook idempotence |
| 4 | `e767158` | JSON-LD structured data, @media print, sanitizeHtml URL decoding fix |

### Évolutions post-audit (9-15 février, ~20 commits)

| Fonctionnalité | Fichiers principaux | Statut |
|----------------|--------------------|---------:|
| Panier multi-articles | `cart.js`, `commander.js`, `boutique.js` | **Nouveau** |
| Page annonce (détail produit) | `annonce.html` | **Nouveau** |
| Système de notation FR/US | `scales-data.js`, `boutique.js`, `handpan-player.js` | **Nouveau** |
| Instrument virtuel (galerie) | `handpan-player.js`, `annonce.html` | **Nouveau** |
| Badges promotionnels | `boutique.js`, `boutique-admin.js` | **Nouveau** |
| SEO : sitemap.xml + robots.txt | `sitemap.xml`, `robots.txt` | **Nouveau** |
| SEO diagnostic (admin) | `seo-diagnostic.js`, `seo-diagnostic.html` | **Nouveau** |
| Location refonte UX | `location.html` | **Refactorisé** |

---

## Table des Matières

1. [Bloqueurs de Production (CRITIQUE)](#1-bloqueurs-de-production-critique)
2. [Sécurité](#2-sécurité)
3. [Performance](#3-performance)
4. [SEO et Contenu](#4-seo-et-contenu)
5. [Qualité de Code](#5-qualité-de-code)
6. [Configuration Netlify](#6-configuration-netlify)
7. [Nouveaux Problèmes (post-audit, février 2026)](#7-nouveaux-problèmes-post-audit-février-2026)
8. [Ce qui est bien fait](#8-ce-qui-est-bien-fait)
9. [Plan d'action recommandé](#9-plan-daction-recommandé)

---

## 1. Bloqueurs de Production (CRITIQUE)

### 1.1 ~~`config.js` traqué par Git~~ ✅ CORRIGÉ (commit b0f7802)

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

### 1.2 ~~Images non optimisées~~ ✅ CORRIGÉ (commit ddf0218)

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

### 1.3 ~~Accents manquants dans les CGV~~ ✅ CORRIGÉ (commit 5bca2a2)

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

### 1.4 ~~Typo sur page légale~~ ✅ CORRIGÉ (commit 5bca2a2)

**Fichier :** `mentions-legales.html:91`
```
"SANTAMARIA ADRIE]" → "SANTAMARIA ADRIEN"
```

**Impact :** Nom du directeur de publication incorrect sur une page à valeur légale.

### 1.5 ~~Validation de prix "fail-open"~~ ✅ CORRIGÉ (commit 5bca2a2)

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

### 2.1 ~~CSP avec `unsafe-inline` et `unsafe-eval`~~ ✅ CORRIGÉ

**Fichier :** `netlify.toml:17`

**Avant :**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.payplug.com
```

**Après :**
```
script-src 'self' https://cdn.payplug.com https://cdnjs.cloudflare.com
```

**Corrections appliquées :**
1. Tous les scripts inline externalisés dans `js/pages/` (6 fichiers : annonce.js, location.js, suivi.js, article.js, index.js, admin-init.js)
2. `'unsafe-inline'` supprimé de `script-src` (conservé dans `style-src` pour les styles inline)
3. `'unsafe-eval'` supprimé — ni le code applicatif ni les vendor libs (Quill.js inclus) n'utilisent `eval()`
4. `https://cdnjs.cloudflare.com` ajouté pour jspdf CDN (admin)

### 2.2 ~~Header HSTS manquant~~ ✅ CORRIGÉ (commit 5bca2a2)

**Fichier :** `netlify.toml`
**Manquant :**
```toml
Strict-Transport-Security = "max-age=31536000; includeSubDomains"
```

**Impact :** Sans HSTS, les premières connexions peuvent être interceptées via HTTP avant redirection HTTPS.

### 2.3 ~~Sanitisation URL incomplète~~ ✅ CORRIGÉ (commit e767158)

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

### 2.5 ~~`console.log` en production~~ ✅ CORRIGÉ (commit a7f332a)

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

### 3.1 ~~Scripts bloquants sur boutique.html~~ ✅ CORRIGÉ (commit f4f238c)

**Fichier :** `boutique.html:449-475`

10+ balises `<script>` chargées séquentiellement sans `defer` ni `async` :
- scales-data.js, gammes-data.js, tailles-data.js, materiaux-data.js
- feasibility-module.js, boutique.js
- cookie-consent.js, main.js
- handpan-player.js, admin-core.js, boutique-admin.js

**Impact :** Chaque script bloque le parsing HTML. Sur mobile avec connexion 3G, le temps de chargement est significativement impacté.

**Correction :** Ajouter `defer` aux scripts de données et modules admin. Seuls `cookie-consent.js` et `main.js` doivent rester synchrones.

### 3.2 ~~Aucun lazy loading d'images~~ ✅ CORRIGÉ (commit f4f238c)

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

### 3.4 ~~Pas de styles d'impression~~ ✅ CORRIGÉ (commit e767158)

**Fichiers :** Aucun CSS

Aucune règle `@media print` définie. Les pages légales (CGV, mentions légales) et les factures ne s'imprimeront pas correctement.

---

## 4. SEO et Contenu

### 4.1 ~~JSON-LD / Schema.org absent~~ ✅ CORRIGÉ (commit e767158)

**Fichiers :** Toutes les pages publiques

Aucun balisage structured data. Impact direct sur les rich snippets Google.

**Pages prioritaires :**
- `index.html` : `Organization` + `LocalBusiness`
- `boutique.html` : `Product`
- `article.html` : `Article` (dynamique)
- `apprendre.html` : `EducationalOrganization`

### 4.2 ~~URLs canoniques manquantes~~ ✅ CORRIGÉ (commit f4f238c)

**Fichiers :** Toutes les pages

Aucune balise `<link rel="canonical">`. Risque de contenu dupliqué si le site est accessible via www et non-www.

### 4.3 Titres de pages courts (HAUTE)

| Page | Titre actuel | Longueur |
|------|-------------|----------|
| `commander.html` | "Commander - Mistral Pans" | 24 chars |
| `article.html` | "Article — Mistral Pans" | 22 chars |

**Recommandé :** 50-60 caractères pour un SEO optimal.

### 4.4 ~~OG/Twitter Cards manquants sur pages légales~~ ✅ CORRIGÉ (commit f4f238c)

**Fichiers :** `cgv.html`, `mentions-legales.html`

Pas de balises Open Graph ni Twitter Card.

### 4.5 ~~`og:image` manquant sur suivi.html~~ ✅ CORRIGÉ (commit f4f238c)

**Fichier :** `suivi.html:7-10`

Balises OG présentes mais `og:image` et `og:locale` manquants.

### 4.6 Alts d'images génériques (MOYENNE)

**Fichier :** `boutique.html:70, 82, 94`

Les 3 images de cartes utilisent le même alt : "Handpan Mistral Pans". Devrait être descriptif et unique pour chaque carte.

### 4.7 ~~`alert()` au lieu de Toast~~ ✅ CORRIGÉ (commit f4f238c)

**Fichiers :** `feasibility-module.js` (2 instances), `teacher-form.js` (4 instances)

6 `alert()` bloquants au lieu d'utiliser le système Toast déjà en place.

---

## 5. Qualité de Code

### 5.1 ~~Fuites mémoire - event listeners non nettoyés~~ ✅ CORRIGÉ (commit a7f332a)

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

### 5.2 ~~Race condition sur le flag `supabaseLoading`~~ ✅ CORRIGÉ (commit 5bca2a2)

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

### 5.4 ~~Pas de debounce sur les boutons de sauvegarde~~ ✅ CORRIGÉ (commit f4f238c)

**Fichiers :** `admin-ui-modals.js` (saveClient, saveInstrument, saveFacture, etc.)

Un clic rapide multiple sur "Sauvegarder" déclenche plusieurs appels Supabase en parallèle.

**Correction :** Désactiver le bouton pendant l'opération :
```javascript
btn.disabled = true;
try { await save(); } finally { btn.disabled = false; }
```

### 5.5 ~~CSS/JS inline massif dans certaines pages~~ ✅ CORRIGÉ (JS externalisé)

**JS externalisé (6 pages) :**

| Page | Lignes inline | Fichier externe |
|------|:------------:|-----------------|
| `annonce.html` | ~877 lignes | `js/pages/annonce.js` |
| `location.html` | ~247 lignes | `js/pages/location.js` |
| `suivi.html` | ~135 lignes | `js/pages/suivi.js` |
| `article.html` | ~135 lignes | `js/pages/article.js` |
| `index.html` | ~34 lignes | `js/pages/index.js` |
| `admin.html` | ~183 lignes | `js/pages/admin-init.js` |

**Restant (CSS inline, non bloquant) :** `apprendre.html` (~940 lignes CSS admin), `suivi.html` (~280 lignes CSS). Le CSS inline nécessite `'unsafe-inline'` dans `style-src` uniquement.

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

### 5.8 ~~Emails de webhook potentiellement envoyés en double~~ ✅ CORRIGÉ (commit a7f332a)

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

### 6.2 ~~À ajouter~~ ✅ CORRIGÉ (commit 5bca2a2)

```toml
# HSTS - AJOUTÉ
Strict-Transport-Security = "max-age=31536000; includeSubDomains"
```

### 6.3 À améliorer à terme

- Remplacer `unsafe-inline`/`unsafe-eval` par des nonces CSP
- Ajouter des redirects 301 pour www → non-www (ou l'inverse)
- Ajouter un cache-bust sur les fichiers CSS/JS (hash dans le nom de fichier)

---

## 7. Nouveaux Problèmes (post-audit, février 2026)

Les évolutions suivantes ont été ajoutées depuis l'audit initial du 9 février. Cette section couvre les **nouveaux problèmes identifiés**.

### 7.1 Validation de prix panier incomplète (CRITIQUE)

**Fichier :** `netlify/functions/payplug-webhook.js:480-498`

```javascript
if (isCart && metadata.items) {
  let items;
  try {
    items = typeof metadata.items === 'string' ? JSON.parse(metadata.items) : metadata.items;
  } catch (e) {
    return { valid: true }; // ← Fail open sur erreur JSON
  }

  for (const item of items) {
    if (item.type === 'instrument' && item.sourceId) {
      // Code de validation commenté/incomplet
    }
  }
  return { valid: true }; // ← Toujours vrai, validation non implémentée
}
```

**Problème :** La validation de prix en mode panier (multi-articles) est un **no-op**. La boucle `for` itère sur les items mais n'effectue aucune vérification. Le `return { valid: true }` final signifie que n'importe quel montant est accepté pour un paiement panier.

**Impact :** Un utilisateur pourrait modifier le montant côté client et payer moins que le prix réel pour un panier multi-articles.

**Correction :** Implémenter la validation pour chaque item du panier :
```javascript
for (const item of items) {
  if (item.type === 'instrument' && item.sourceId) {
    const fakeMetadata = { source: 'stock', instrument_id: item.sourceId, payment_type: paymentType };
    const fakePmt = { amount: (item.total || item.prix) * 100 };
    const result = await validateSingleInstrumentPrice(fakePmt, fakeMetadata, sb);
    if (!result.valid) return result;
  }
}
```

### 7.2 Webhook "fail-open" persistant (CRITIQUE lié)

**Fichier :** `netlify/functions/payplug-webhook.js:473, 486, 519, 525, 529, 562`

Le webhook contient **9 occurrences** de `return { valid: true }` dans `validatePriceWithDatabase()`. Plusieurs sont des "fail-open" (accepter le paiement si la validation échoue), notamment :

| Ligne | Condition | Risque |
|-------|-----------|--------|
| 473 | Pas de config Supabase | Aucune validation si env vars manquantes |
| 486 | JSON.parse échoue sur items | Panier corrompu accepté |
| 498 | Fin de la boucle panier | Validation jamais exécutée |
| 519 | DB indisponible | Tout montant accepté |
| 562 | Exception catch-all | Tout montant accepté |

**Contexte atténuant :** L'audit initial (§1.5) avait corrigé le fail-open dans `payplug-create-payment.js`, mais le pattern persiste dans le webhook et a été amplifié par l'ajout du mode panier.

**Correction recommandée :** Adopter une stratégie fail-closed cohérente : si la validation est impossible, rejeter le paiement et alerter l'admin.

### 7.3 ~~Location.html — rendu HTML sans échappement~~ ✅ CORRIGÉ

**Fichier :** `js/pages/location.js` (externalisé depuis `location.html`)

**Correction appliquée :** `escapeHtml()` ajouté sur tous les champs dynamiques dans `renderInstrumentCard()` (`gamme`, `taille`, `tonalite`, `materiau`, `img`, `id`).

### 7.4 ~~Annonce.html — script inline massif~~ ✅ CORRIGÉ

**Fichier :** `js/pages/annonce.js` (877 lignes externalisées depuis `annonce.html`)

**Correction appliquée :** Script extrait dans `js/pages/annonce.js` avec `defer`. JSON-LD converti en `document.createElement('script')` pour compatibilité CSP strict.

### 7.5 Cart.js — pas de validation de prix (MOYENNE)

**Fichier :** `js/features/cart.js`

Le module panier stocke les prix côté client (sessionStorage) sans validation. Un utilisateur peut modifier `sessionStorage` pour changer les prix des articles.

**Contexte atténuant :** Les prix doivent être revalidés côté serveur au moment du paiement (via `payplug-create-payment.js`). Mais voir §7.1 — la validation panier n'est pas implémentée dans le webhook.

### 7.6 Commander.js — données localStorage affichées sans vérification serveur (MOYENNE)

**Fichier :** `js/pages/commander.js:1001-1025, 1219-1279`

Après un paiement réussi, les informations affichées (produit, montant, référence) proviennent de `localStorage` (`mistral_pending_order`) et non du serveur.

**Impact :** Un utilisateur pourrait voir des informations erronées s'il manipule le localStorage. Risque faible car c'est un affichage post-paiement sans conséquence financière.

### 7.7 SEO diagnostic sans contrôle d'accès (BASSE)

**Fichier :** `seo-diagnostic.html`

La page a `noindex, nofollow` et est dans `robots.txt` Disallow, mais **aucun contrôle d'authentification JS**. N'importe qui connaissant l'URL peut lancer un diagnostic SEO.

**Impact :** Faible — l'outil analyse uniquement les pages publiques. Mais il pourrait être utilisé pour du scraping ou de la reconnaissance.

### 7.8 Sitemap.xml — pages dynamiques manquantes (BASSE)

**Fichier :** `sitemap.xml`

Le sitemap liste les pages statiques mais pas les pages dynamiques (articles de blog, fiches instruments). Les moteurs de recherche ne découvriront pas ces pages via le sitemap.

**Correction à terme :** Générer le sitemap dynamiquement via une Netlify Function qui requête les articles et instruments publiés.

### 7.9 Nouvelles fonctionnalités bien implémentées

**Cart.js (js/features/cart.js)** — Architecture propre :
- Module IIFE avec namespace `window.MistralCart`
- Événement `cart-updated` pour la communication inter-composants
- Synchronisation cross-tab via `storage` event
- Quantité plafonnée à 10 par accessoire

**Notation toggle (scales-data.js)** — Bonne implémentation :
- Persistance du choix via `sessionStorage`
- Fallback gracieux si `MistralScales` non défini
- Icônes drapeaux (US/FR) au lieu de texte

**Instrument virtuel (handpan-player.js)** — Enrichissement majeur :
- Intégration en tant que slide galerie
- Support clavier + souris + touch
- Animation pulse et wave ripple

---

## 8. Ce qui est bien fait

### Nouvelles fonctionnalités (post-audit)
- **Système de panier** (`cart.js`) : module propre, event-driven, sessionStorage
- **Notation FR/US** : toggle accessible, persistance session, fallback gracieux
- **Instrument virtuel** : intégration galerie, multi-input (clavier/souris/touch)
- **SEO outillé** : sitemap.xml, robots.txt, diagnostic admin

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

## 9. Plan d'action recommandé

### Phase 1 — Avant mise en prod (BLOQUANT) ✅ TERMINÉE

| # | Action | Statut |
|---|--------|:------:|
| 1 | Corriger les accents dans cgv.html | ✅ |
| 2 | Corriger le typo mentions-legales.html | ✅ |
| 3 | Optimiser les 5 images lourdes (26 Mo → 1.4 Mo) | ✅ |
| 4 | Retirer config.js du suivi Git | ✅ |
| 5 | Changer fail-open en fail-closed pour la validation de prix | ✅ |
| 6 | Ajouter HSTS header | ✅ |

### Phase 2 — Performance, SEO, UX ✅ TERMINÉE

| # | Action | Statut |
|---|--------|:------:|
| 7 | Ajouter `loading="lazy"` + `width/height` sur les images | ✅ |
| 8 | Ajouter `defer` aux scripts non-critiques (~40 scripts, 10 pages) | ✅ |
| 9 | Remplacer les 6 `alert()` par des Toast/notices | ✅ |
| 10 | Ajouter les URLs canoniques (11 pages) | ✅ |
| 11 | Compléter les OG/Twitter tags manquants | ✅ |
| 12 | Corriger le flag `supabaseLoading` en cas d'erreur | ✅ |
| 13 | Ajouter debounce (`withSaveGuard`) sur 6 boutons de sauvegarde admin | ✅ |

### Phase 3 — Code Quality ✅ TERMINÉE

| # | Action | Statut |
|---|--------|:------:|
| 15 | Nettoyer les console.log (37 supprimés, 14 conditionnels) | ✅ |
| 17 | Corriger les fuites mémoire (AbortController sur FAB + Modal) | ✅ |
| 19 | Protection webhook idempotence (emails en double) | ✅ |

### Phase 4 — SEO avancé, Print, Sécurité ✅ TERMINÉE

| # | Action | Statut |
|---|--------|:------:|
| 16 | Ajouter JSON-LD structured data (index.html + boutique.html) | ✅ |
| 24 | Ajouter `@media print` pour les pages légales et factures | ✅ |
| 25 | Décoder les URL dans sanitizeHtml() (protection XSS renforcée) | ✅ |

### Phase 5 — Nouveaux problèmes post-audit (RECOMMANDÉ)

| # | Action | Priorité | Réf. |
|---|--------|----------|------|
| 27 | **Implémenter la validation de prix panier dans le webhook** | **CRITIQUE** | §7.1 |
| 28 | Convertir les fail-open restants en fail-closed dans le webhook | Haute | §7.2 |
| 29 | ~~Ajouter `escapeHtml()` dans `location.html` renderInstrumentCard~~ | ✅ | §7.3 |
| 30 | ~~Extraire le script inline de `annonce.html` dans `js/pages/annonce.js`~~ | ✅ | §7.4 |
| 31 | Ajouter contrôle d'accès admin sur `seo-diagnostic.html` | Basse | §7.7 |
| 32 | Générer le sitemap dynamiquement (articles, instruments) | Basse | §7.8 |

### Améliorations restantes (post-launch, non bloquantes)

| # | Action | Priorité |
|---|--------|----------|
| 14 | ~~Externaliser les scripts/CSS inline (suppression unsafe-inline)~~ | ✅ |
| 18 | Éliminer les variables globales mutables dans les modals | Moyenne |
| 20 | Ajouter un fallback MP3 pour l'audio (Safari/iOS) | Moyenne |
| 21 | Ajouter pagination dans les listes admin | Moyenne |
| 22 | ~~Supprimer `unsafe-inline`/`unsafe-eval` du CSP~~ | ✅ |
| 23 | Implémenter un rate limiting persistant | Basse |
| 26 | Ajouter validation de longueur sur les champs admin | Basse |

---

## Métriques du Projet

| Métrique | Valeur |
|----------|--------|
| Pages HTML | 14 (+2 : annonce.html, seo-diagnostic.html) |
| Partials | 4 |
| Fichiers CSS | 4 (130 Ko) |
| Fichiers JS (hors vendor) | 46 (~650 Ko, +9 : cart.js, seo-diagnostic.js, 6 pages externalisées + admin-init) |
| Vendor JS | 4 libs (611 Ko) |
| Netlify Functions | 6 (~75 Ko) |
| Lignes de code (estimation) | ~20 000 (+5 000 depuis l'audit) |
| Tables Supabase | 10 |
| Images | ~10 fichiers (~1.4 Mo optimisé, était 26 Mo) |
| Audio | 56 échantillons FLAC (2.1 Mo) |
| SEO | sitemap.xml (11 URLs) + robots.txt |

---

*Rapport généré le 9 février 2026. Mise à jour v2 le 15 février 2026.*
*26 items corrigés sur 45 (audit initial + post-audit). 6 nouveaux items identifiés (post-audit), dont 1 critique (§7.1), 4 déjà corrigés (§2.1, §5.5, §7.3, §7.4 + items 14, 22).*
*Prochain audit recommandé : 1 mois après mise en production.*
