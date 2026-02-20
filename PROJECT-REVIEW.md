# Audit Complet du Projet Mistral Pans

> **Date :** 16 fevrier 2026
> **Version auditee :** 3.5
> **Perimetre :** 8 dimensions — Performance, SEO, Accessibilite, Securite, Code, RGPD, UX, Compatibilite

---

## Tableau de synthese

| Dimension | Score | Priorite | Resume |
|-----------|-------|----------|--------|
| **Performance** | 5/10 | CRITIQUE | Images non-WebP, CSS/JS bloquants, chaine Supabase synchrone |
| **SEO technique** | 9/10 | FAIBLE | Excellent — canonicals, meta, JSON-LD. Manque page 404 |
| **Accessibilite WCAG** | 7/10 | HAUTE | Bons fondamentaux, mais focus trap modals + contrastes erreur/warning |
| **Securite** | 7.5/10 | HAUTE | Bonnes pratiques globales, XSS article.js + webhook PayPlug non signe |
| **Qualite du code** | 5.5/10 | MOYENNE | 30K LOC, duplication ~500 lignes, 530 var, 891 == |
| **RGPD** | 7/10 | CRITIQUE | Mentions/CGV complets, mais droits des personnes absents + consent commander |
| **UX / Ergonomie** | 6.5/10 | HAUTE | Design premium, mais validation formulaires + etats de chargement faibles |
| **Compatibilite** | 7.5/10 | MOYENNE | Bon sur navigateurs modernes, probleme 100vh iOS critique |

---

## 1. Performance (5/10)

### Constat

| Metrique | Valeur | Objectif |
|----------|--------|----------|
| Images totales | 1.7 Mo (12 fichiers JPEG/PNG) | < 500 Ko en WebP |
| Formats modernes (WebP/AVIF) | 0 | 100% |
| CSS render-blocking | 48-80 Ko par page | < 14 Ko critique |
| JS synchrone bloquant | cookie-consent + main.js + chaine Supabase | 0 bloquant |
| Lazy loading images | 5/12 | 100% below-fold |
| Resource hints (preconnect) | 0 | 2-3 minimum |
| Cache CSS/JS | 7 jours + ?v=3.5 | OK |
| Audio (FLAC+MP3) | 5.1 Mo, 112 fichiers, lazy | OK |

### Issues critiques

1. **Aucune image WebP** — Les 3 JPEG hero (443-487 Ko chacun) pourraient etre reduits de 30-40%
2. **CSS entierement render-blocking** — style.css (48 Ko) + boutique.css (32 Ko) charges en synchrone
3. **Chaine de chargement Supabase synchrone** — config.js → supabase.js (160 Ko) → client → sync, sequentiel
4. **Admin page charge 24 scripts** dont Chart.js (204 Ko) et Quill.js (212 Ko) pour toutes les sections
5. **Pas de srcset/responsive images** — images servies en taille originale sur mobile
6. **Pas de width/height sur les images** — provoque du CLS (Cumulative Layout Shift)

### Recommandations

| Priorite | Action | Impact estime |
|----------|--------|---------------|
| P0 | Convertir images en WebP avec fallback JPEG | LCP -30% |
| P0 | Async-ifier la chaine Supabase (Promise.all) | FCP -200ms |
| P1 | Extraire CSS critique inline pour le hero | FCP -300ms |
| P1 | Ajouter lazy loading + width/height a toutes les images | CLS ~0 |
| P2 | Ajouter preconnect vers Supabase + Google Fonts | DNS -100ms |
| P2 | Lazy-load Chart.js et Quill.js uniquement sur admin | TTI admin -400ms |
| P3 | Ajouter `immutable` aux headers CSS/JS (deja versionnes) | Cache optimal |

---

## 2. SEO Technique (9/10)

### Constat

| Element | Statut |
|---------|--------|
| sitemap.xml | OK — 11 pages, reference dans robots.txt |
| robots.txt | OK — bloque admin.html + seo-diagnostic.html |
| Canonical URLs | OK — 13/13 pages avec canonical correct |
| Meta title (longueur) | OK — toutes entre 22-90 caracteres |
| Meta description | OK — toutes entre 85-130 caracteres |
| OpenGraph complet | OK — titre, description, image, locale sur toutes les pages |
| Twitter Cards | OK — summary_large_image partout |
| Hierarchie Hn | OK — H1 unique, pas de saut de niveau |
| JSON-LD | 8/13 pages (index, boutique, commander, location, galerie, blog, suivi, article dynamique) |
| Liens internes | OK — toutes les pages accessibles depuis header/footer |
| Alt images | OK — alt descriptif present |
| lang="fr" | OK — sur toutes les pages |
| Page 404 | **MANQUANTE** |

### Recommandations

| Priorite | Action |
|----------|--------|
| P1 | Creer 404.html personnalisee avec navigation |
| P2 | Ajouter JSON-LD Article aux articles de blog (dynamique dans article.js — deja fait) |
| P3 | Considerer navigation breadcrumb pour le SEO |

---

## 3. Accessibilite WCAG 2.1 AA (7/10)

### Constat

| Critere WCAG | Statut | Detail |
|--------------|--------|--------|
| 2.4.1 Skip link | OK | "Aller au contenu principal" |
| 1.3.1 Landmarks | PARTIEL | `<main>`, `<nav>`, `<header>` OK, mais `<article>` manquant sur blog |
| 4.1.2 ARIA | BON | aria-label, aria-expanded, aria-modal corrects |
| 2.4.7 Focus visible | BON | :focus-visible avec outline teal 2px |
| **2.4.3 Focus trap modals** | **NOK** | **Aucun focus trap — on peut tabber hors des modals** |
| 1.3.1 Formulaires | BON | Labels associes, required, types corrects |
| **1.4.3 Contraste erreur** | **NOK** | **#EF4444 sur #FDFBF7 = 4.2:1 (< 4.5:1 requis)** |
| **1.4.3 Contraste warning** | **NOK** | **#F59E0B sur #FDFBF7 = 3.8:1 (< 4.5:1 requis)** |
| 1.1.1 Alt images | BON | Alt descriptifs presents |
| **2.1.1 Clavier shipping** | **PARTIEL** | **Div role="button" au lieu de `<button>` natif** |
| 2.3.3 Reduced motion | OK | prefers-reduced-motion implemente globalement |
| **4.1.3 aria-live** | **NOK** | **Aucun aria-live pour prix, panier, validation** |
| 3.1.1 Langue | OK | lang="fr" sur toutes les pages |
| Touch targets | PARTIEL | Boutons OK (44px), mais icones cart/counter trop petits (22px) |

### Issues critiques

1. **Focus trap absent dans les modals** — contact, location, teacher signup
2. **Contraste insuffisant** — couleurs erreur (#EF4444 → darkener a #DC2626) et warning (#F59E0B → #D97706)
3. **Pas d'aria-live** — mises a jour de prix, panier, statut formulaire non annoncees
4. **Divs role="button"** au lieu de `<button>` natif sur commander.html (shipping/payment options)

### Recommandations

| Priorite | Action |
|----------|--------|
| P0 | Implementer focus trap dans les modals + touche Echap |
| P0 | Darkener --color-error a #DC2626 et --color-warning a #D97706 |
| P1 | Ajouter aria-live="polite" aux zones dynamiques (prix, panier, statut form) |
| P1 | Remplacer les div role="button" par des `<button>` natifs |
| P2 | Augmenter padding des icones boutons a 44x44px minimum |
| P2 | Ajouter aria-describedby reliant les erreurs aux champs |

---

## 4. Securite (7.5/10)

### Constat

| Element | Statut |
|---------|--------|
| CSP (Content-Security-Policy) | BON — script-src, style-src, connect-src restrictifs |
| HSTS | OK — max-age=31536000 |
| X-Frame-Options | OK — SAMEORIGIN |
| X-Content-Type-Options | OK — nosniff |
| Referrer-Policy | OK — strict-origin-when-cross-origin |
| Permissions-Policy | OK — camera/micro/geo desactives |
| Supabase RLS | BON — granulaire par table |
| Webhook Swikly signature | OK — HMAC-SHA256 + timing-safe |
| **Webhook PayPlug signature** | **NOK** | **Pas de verification HMAC** |
| **XSS article.js** | **HAUTE** | **article.content injecte via innerHTML sans sanitisation** |
| **XSS boutique.js** | **MOYENNE** | **innerHTML pour SVG/legend depuis donnees Supabase** |
| Sanitisation admin WYSIWYG | PARTIEL — custom, devrait etre DOMPurify |
| Rate limiting | BON — Supabase RPC, mais fail-open si Supabase down |
| Validation prix serveur | OK — payplug-create-payment verifie prix vs BDD |
| Honeypot anti-spam | OK — RGPD friendly, pas de dependance externe |
| Config/secrets | OK — config.js gitignore, SERVICE_KEY serveur uniquement |
| CSRF | PARTIEL — SameSite + CORS, mais pas de token explicite |
| Dependencies | OK — versions a jour, pas de CVE connues |

### Issues critiques

1. **XSS dans article.js:129** — `article.content` rendu par innerHTML sans sanitisation. Un contenu malveillant en BDD pourrait injecter du JS.
2. **Webhook PayPlug sans verification de signature** — L'API call subsequent compense partiellement, mais pas de HMAC. Swikly le fait correctement — repliquer le pattern.
3. **Rate limiting fail-open** — Si Supabase est down, les limites disparaissent.

### Recommandations

| Priorite | Action |
|----------|--------|
| P0 | Sanitiser article.content avant innerHTML (DOMPurify ou escapeHtml) |
| P0 | Implementer verification signature HMAC PayPlug (X-Payplug-Signature) |
| P1 | Migrer sanitisation admin vers DOMPurify |
| P1 | Changer rate-limit en fail-closed pour fonctions critiques (paiement, email) |
| P2 | Ajouter tokens CSRF aux formulaires contact/teacher |
| P2 | Retirer `https://cdnjs.cloudflare.com` du CSP si inutilise |
| P3 | Ajouter Subresource Integrity (SRI) pour PayPlug et Calendly |

---

## 5. Qualite du Code (5.5/10)

### Metriques

| Metrique | Valeur | Objectif | Statut |
|----------|--------|----------|--------|
| Total JS LOC | 30 804 | < 20K | Depasse |
| Fichiers > 1000 lignes | 6 | 0-2 | Depasse |
| Fonctions > 50 lignes | 14+ | < 5 | Depasse |
| Duplication estimee | ~500-600 lignes | < 50 | Critique |
| Usage de `var` | 530 (22%) | 0% | Elevee |
| Egalite lache `==` | 891 (75%) | 0% | Elevee |
| Concatenation strings | 559 (73%) | 0% | Elevee |
| window.* globals | 43 | < 15 | Elevee |
| try/catch couverture | 0.36% | > 10% | Critique |
| .catch() sur promesses | 16 | > 100 | Critique |
| Couverture JSDoc | 73% global, 18% sur gros fichiers | 100% | Variable |
| Tests automatises | 0 | Unitaires + integration | Absents |
| CSS !important | 19 (justifies pour print/a11y) | 0 | Acceptable |

### Fichiers les plus complexes

| Fichier | Lignes | Probleme |
|---------|--------|----------|
| admin-ui-modals.js | 2 276 | God file — 15+ modals melanges |
| commander.js | 2 163 | Paiement + commande + shipping melange |
| admin-ui-config.js | 2 095 | Config + gammes + tailles dans un fichier |
| handpan-player.js | 1 959 | Web Audio + SVG rendu |
| gestion.js | 1 478 | Logique metier monolithique |
| boutique.js | 1 451 | Configurateur + UI melange |

### Duplication identifiee

- **escapeHtml()** — 3 implementations (admin-ui-core, send-email, payplug-create-payment)
- **formatPrice()** — 3 implementations
- **formatDate()** — 2 implementations
- **isValidEmail()** — 3 implementations
- **Pattern modal** — ~250 lignes de code copie-colle dans admin-ui-modals.js
- **Pattern table rendering** — ~400 lignes repetees dans admin-ui-gestion/content

### Recommandations

| Priorite | Action | Effort |
|----------|--------|--------|
| P0 | Ajouter .catch() aux fetch() (30 instances) et try/catch aux async (40) | 16h |
| P1 | Extraire js/core/utils.js (escapeHtml, formatPrice, formatDate, isValidEmail) | 8h |
| P1 | Splitter admin-ui-modals.js en 3-4 fichiers par domaine | 20h |
| P2 | Remplacer var par const/let (530 instances — ESLint auto-fix) | 4h |
| P2 | Remplacer == par === (891 instances — ESLint auto-fix) | 3h |
| P2 | Convertir concatenations en template literals (559 instances) | 4h |
| P3 | Ajouter JSDoc aux gros fichiers sous-documentes | 24h |
| P3 | Ajouter tests unitaires pour les utilitaires | 60h+ |

---

## 6. RGPD & Conformite (7/10)

### Constat

| Obligation | Statut | Detail |
|------------|--------|--------|
| Banniere cookies granulaire | OK | 5 categories, accept/reject/personnaliser |
| Consentement timestamp + version | OK | ISO 8601 + CONSENT_VERSION 1.1 |
| Retrait du consentement | OK | openSettings() pour rouvrir la banniere |
| Mentions legales completes | OK | SIREN, hebergeur, DPO, mediation |
| CGV completes | OK | 12 articles, droit de retractation, litiges |
| Formulaire contact — consentement | OK | Checkbox RGPD + lien mentions legales |
| **Formulaire commande — consentement** | **NOK** | **Pas de checkbox RGPD pour le traitement des donnees** |
| Formulaire professeur | OK | Insert public restreint (status=pending), admin valide |
| Stockage localStorage | OK | Uniquement preferences, aucune PII |
| Stockage in-memory | OK | Donnees business en Map JS, pas de persistence |
| Supabase RLS | OK | Admin-only pour clients, commandes, factures, config |
| Google Fonts conditionnel | OK | Bloque jusqu'a consentement explicite |
| Carte Leaflet conditionnelle | OK | Consent requis avant chargement des tuiles |
| Calendly conditionnel | OK | Consent requis |
| Analytique anonyme | OK | mistral-stats.js — agrege par date/page/device, pas d'IP |
| **Analytique default actif** | **NOK** | **analytics: default: true — devrait etre false (CNIL)** |
| Brevo (email) | PARTIEL | GDPR compliant mais non mentionne dans les formulaires |
| PayPlug PCI-DSS | OK | iFrame, aucune donnee carte ne touche le serveur |
| Swikly | OK | Permalien GDPR compliant |
| **Droits des personnes** | **NOK** | **Aucun mecanisme d'acces, suppression, portabilite** |
| **Politique de retention** | **NOK** | **Aucune duree de conservation definie** |

### Issues critiques

1. **Aucun mecanisme pour les droits des personnes** (Art. 12-22 RGPD) — acces, suppression, rectification, portabilite. Seul recours : email manuel.
2. **Formulaire commande sans checkbox RGPD** (Art. 7) — collecte nom, email, adresse sans consentement explicite au traitement.
3. **Analytics actif par defaut** (recommandation CNIL) — mistral-stats.js s'active avant consentement affirmatif.
4. **Pas de politique de retention** — combien de temps sont conserves les clients, commandes, factures ?

### Recommandations

| Priorite | Action |
|----------|--------|
| P0 | Ajouter checkbox RGPD sur le formulaire commande (commander.html) |
| P0 | Changer analytics default a `false` dans cookie-consent.js |
| P0 | Creer page droits des personnes (/data-rights.html ou section mentions legales) |
| P1 | Documenter politique de retention (ex: commandes 3 ans, contacts 1 an) |
| P1 | Mentionner Brevo comme sous-traitant dans les formulaires |
| P2 | Implementer processus admin d'export/suppression des donnees client |
| P2 | Verifier DPA (Data Processing Agreement) avec Brevo, PayPlug, Swikly, Supabase |
| P3 | Re-afficher la banniere cookies tous les 12 mois |

---

## 7. UX & Ergonomie (6.5/10)

### Heuristiques de Nielsen

| # | Heuristique | Score | Probleme principal |
|---|-------------|-------|--------------------|
| 1 | Visibilite du systeme | 7/10 | Panier cache si vide, liens externes non signales |
| 2 | Correspondance monde reel | 8/10 | Bonne, notation musicale, vocabulaire artisan |
| 3 | Controle utilisateur | 6/10 | Tabs mobile perdent scroll, pas d'undo panier |
| 4 | Consistance | 6/10 | Champs differents entre options de paiement |
| 5 | Prevention des erreurs | 5/10 | Pas de confirmation, double-submit possible |
| 6 | **Gestion des erreurs** | **5/10** | **Messages generiques, pas de retry, pas de guide** |
| 7 | Flexibilite | 7/10 | Bon configurateur, choix paiement |
| 8 | Esthetique | 8/10 | Design premium, hierarchie visuelle soignee |
| 9 | Aide et documentation | 7/10 | FAQ correcte, aide inline manquante |
| 10 | Accessibilite | 6/10 | Voir section 3 ci-dessus |

### Parcours critiques — problemes identifies

**Configurateur (boutique.html) :**
- Tabs mobile perdent la position de scroll au changement
- Options avancees cachees sans indication visuelle de leur existence
- Decomposition du prix insuffisante (pas de detail malus taille, difficulte)
- Difference "Ajouter au panier" vs "Commander directement" pas claire

**Commande (commander.html) :**
- 4 options de paiement avec poids visuel egal — pas de recommandation claire
- Aucun etat de chargement pendant le traitement du paiement
- Bouton submit non desactive pendant le traitement (double-submit possible)
- Messages d'erreur generiques ("Erreur lors de l'envoi")

**Location (location.html) :**
- Pas de confirmation quand l'utilisateur rejoint la liste d'attente
- Champs requis non marques avec asterisque (*)
- Periode de reservation 72h non mentionnee dans la confirmation

**Formulaires globaux :**
- **Aucune validation en temps reel** — erreurs uniquement a la soumission
- Pas d'indication du champ en erreur (message generique en bas)
- Pas de compteur de caracteres sur les textareas
- Pas de toast de confirmation apres soumission reussie

### Recommandations

| Priorite | Action | Impact |
|----------|--------|--------|
| P0 | Validation temps reel des champs (onblur) | Taux completion +15% |
| P0 | Spinner + desactivation bouton pendant paiement | Prevention double-submit |
| P0 | Toast notifications (succes, erreur, info) | Feedback utilisateur |
| P1 | Restaurer position scroll des tabs mobile | UX mobile |
| P1 | Montrer toujours l'icone panier (grise si vide) | Decouverte fonctionnalite |
| P1 | Messages d'erreur specifiques par type (reseau, validation, paiement) | Recuperation erreur |
| P2 | Decomposition prix detaillee (base + malus taille + malus difficulte) | Transparence |
| P2 | Formulaire enseignant en wizard multi-etapes (mobile) | Completion formulaire |
| P2 | Indicateurs requis (*) sur tous les labels | Prevention erreur |

---

## 8. Compatibilite Cross-Browser (7.5/10)

### Matrice de support

| Navigateur | Support | Notes |
|------------|---------|-------|
| Chrome 90+ | COMPLET | Experience optimale |
| Firefox 90+ | COMPLET | backdrop-filter mineur |
| Safari Mac 14+ | BON | aspect-ratio 14.1+, smooth scroll 15.3+ |
| **Safari iOS 14+** | **PARTIEL** | **100vh critique, Web Audio restrictions** |
| Edge Chromium 90+ | COMPLET | Identique Chrome |
| IE 11 | NON SUPPORTE | Intentionnel (fetch, CSS vars, ES6) |

### Issues critiques

1. **100vh sur Safari iOS** (HAUTE) — Le hero et les modals debordent a cause de la barre d'adresse Safari. Utiliser `100dvh` avec fallback `100vh`.
2. **Web Audio API Safari** (MOYENNE) — Necessite interaction utilisateur avant lecture audio. Deja gere dans handpan-player.js.
3. **backdrop-filter Firefox < 103** (BASSE) — Header/modals perdent l'effet de flou. Fallback acceptable.
4. **Date parsing Safari < 10** (BASSE) — Dates ISO 8601 sans timezone peuvent echouer.

### Recommandations

| Priorite | Action |
|----------|--------|
| P0 | Remplacer 100vh par min(100vh, 100dvh) dans style.css et boutique.css |
| P2 | Ajouter @supports pour backdrop-filter avec fallback background solide |
| P3 | Ajouter -webkit-appearance: none explicite sur les selects custom |

---

## Plan d'action priorise — Vue d'ensemble

### Sprint 1 — Bloquants legaux et securite (1-2 semaines)

| # | Action | Dimension | Effort |
|---|--------|-----------|--------|
| 1 | Checkbox RGPD formulaire commande | RGPD | 2h |
| 2 | Analytics default: false | RGPD | 1h |
| 3 | Page/section droits des personnes | RGPD | 8h |
| 4 | Sanitiser article.content (DOMPurify ou escapeHtml) | Securite | 4h |
| 5 | Signature HMAC webhook PayPlug | Securite | 8h |
| 6 | Darkener couleurs erreur/warning pour contraste AA | A11y | 1h |

### Sprint 2 — Performance et UX critiques (2-3 semaines)

| # | Action | Dimension | Effort |
|---|--------|-----------|--------|
| 7 | Convertir images en WebP avec `<picture>` fallback | Perf | 8h |
| 8 | Fix 100vh iOS (dvh) | Compat | 2h |
| 9 | Focus trap modals + Echap | A11y | 8h |
| 10 | Validation formulaires en temps reel | UX | 16h |
| 11 | Toast notifications globales | UX | 8h |
| 12 | Spinner + disable submit pendant paiement | UX | 4h |
| 13 | Creer page 404 personnalisee | SEO | 2h |
| 14 | aria-live sur zones dynamiques (prix, panier) | A11y | 4h |

### Sprint 3 — Dette technique et qualite (3-4 semaines)

| # | Action | Dimension | Effort |
|---|--------|-----------|--------|
| 15 | Ajouter .catch() aux fetch/async (70 instances) | Code | 16h |
| 16 | Extraire js/core/utils.js (helpers partages) | Code | 8h |
| 17 | Splitter admin-ui-modals.js (2276 lignes) | Code | 20h |
| 18 | Async-ifier chaine Supabase | Perf | 8h |
| 19 | Remplacer var/==/concat (ESLint auto-fix) | Code | 11h |
| 20 | Lazy-load Chart.js et Quill.js | Perf | 4h |

### Sprint 4 — Polish et optimisation (continu)

| # | Action | Dimension | Effort |
|---|--------|-----------|--------|
| 21 | Srcset responsive images | Perf | 8h |
| 22 | Preconnect Supabase + Google Fonts | Perf | 1h |
| 23 | Migrer sanitisation admin vers DOMPurify | Securite | 4h |
| 24 | Rate-limit fail-closed + teacher signup | Securite | 4h |
| 25 | Decomposition prix detaillee configurateur | UX | 8h |
| 26 | Wizard multi-etapes formulaire enseignant (mobile) | UX | 16h |
| 27 | Touch targets 44px minimum (icones) | A11y | 4h |
| 28 | @supports backdrop-filter fallback | Compat | 2h |
| 29 | Tests unitaires utilitaires | Code | 60h+ |
| 30 | Politique de retention des donnees | RGPD | 8h |

---

## Points forts du projet

- **Architecture RGPD-first** — consentement granulaire, Google Fonts conditionnel, analytics anonyme, in-memory only
- **SEO technique excellent** — canonicals, meta, OG, JSON-LD, sitemap, robots.txt tout en place
- **Design premium** — typographie soignee, palette coherente, responsive mobile-first
- **Securite serveur solide** — RLS Supabase, validation prix server-side, rate limiting, honeypot
- **Audio system bien concu** — lazy loading, fallback FLAC→MP3, cache memoire
- **Self-hosted vendors** — Leaflet, Chart.js, Quill, Supabase SDK en local (pas de CDN sauf PayPlug PCI-DSS)
- **Reduced motion** — prefers-reduced-motion implemente globalement

---

*Rapport genere le 16 fevrier 2026 — Version codebase 3.5*
