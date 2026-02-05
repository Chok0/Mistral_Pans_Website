# ROADMAP - Mistral Pans Website

> **Version:** 1.0
> **Date:** 5 Février 2026
> **Status:** Active Development

---

## Vue d'ensemble

Ce document définit les tâches prioritaires pour le développement du site Mistral Pans. Les fonctionnalités sont classées par priorité et regroupées par domaine fonctionnel.

---

## Légende des statuts

| Icône | Statut |
|-------|--------|
| ⬜ | Non commencé |
| 🔄 | En cours |
| ✅ | Terminé |
| ⏸️ | En pause |
| 🚫 | Bloqué |

---

## 🔴 PRIORITÉ CRITIQUE

### 1. Intégration Payplug (Paiement)

**Objectif:** Permettre le paiement en ligne des commandes et acomptes

**Fichiers concernés:**
- `commander.html` - Formulaires de commande
- `js/commander.js` (à créer) - Logique de paiement
- `netlify/functions/payplug-*.js` (à créer) - API backend
- `js/admin-ui-compta.js` - Liaison avec factures

**Tâches:**
- ⬜ Créer compte Payplug et obtenir clés API (test + production)
- ⬜ Créer `js/payplug-client.js` - Module de paiement côté client
- ⬜ Créer `netlify/functions/payplug-create-payment.js` - Création de paiement
- ⬜ Créer `netlify/functions/payplug-webhook.js` - Réception des confirmations
- ⬜ Intégrer le formulaire de paiement dans `commander.html`
- ⬜ Implémenter le paiement de l'acompte (300€)
- ⬜ Implémenter le paiement du solde
- ⬜ Implémenter le paiement en 3x sans frais
- ⬜ Auto-génération de facture sur paiement confirmé
- ⬜ Email de confirmation automatique post-paiement
- ⬜ Page de confirmation/échec de paiement
- ⬜ Tests en environnement sandbox
- ⬜ Passage en production

**Dépendances:**
- Email API (Brevo) doit être fonctionnel pour les confirmations

**Documentation:**
- [Payplug API](https://docs.payplug.com/)
- [Payplug JS SDK](https://docs.payplug.com/api/lightbox.html)

---

### 2. Intégration Email API (Brevo SMTP)

**Objectif:** Envoyer des emails transactionnels (confirmations, factures, rapports)

**Fichiers concernés:**
- `netlify/functions/send-email.js` - Fonction existante à améliorer
- `js/admin-ui-modals.js:1538-1612` - Envoi de factures
- `js/admin-ui-compta.js:279-296` - Rapports automatiques

**Tâches:**
- ⬜ Configurer compte Brevo et clés API
- ⬜ Améliorer `send-email.js` avec templates HTML
- ⬜ Implémenter l'envoi de factures PDF en pièce jointe
- ⬜ Implémenter l'envoi de confirmation de commande
- ⬜ Implémenter l'envoi de confirmation de réservation location
- ⬜ Créer templates email (confirmation, facture, rappel)
- ⬜ Implémenter rapports mensuels automatiques (optionnel: CRON)
- ⬜ Ajouter logging des envois d'emails
- ⬜ Tests d'envoi avec différents clients mail

**Templates à créer:**
1. `email-order-confirmation.html` - Confirmation de commande
2. `email-invoice.html` - Envoi de facture
3. `email-rental-confirmation.html` - Confirmation de location
4. `email-monthly-report.html` - Rapport mensuel admin

---

## 🟠 PRIORITÉ HAUTE

### 3. Intégration Swikly (Cautions Locations)

**Objectif:** Gérer les cautions de location sans encaisser de chèques

**Fichiers concernés:**
- `location.html` - Page de location
- `js/location.js` (à créer) - Logique de réservation
- `netlify/functions/swikly-*.js` (à créer) - API backend
- `js/admin-ui-modals.js` - Gestion admin des locations

**Tâches:**
- ⬜ Créer compte Swikly Pro et obtenir clés API
- ⬜ Créer `js/swikly-client.js` - Module caution côté client
- ⬜ Créer `netlify/functions/swikly-create-deposit.js` - Création caution
- ⬜ Créer `netlify/functions/swikly-webhook.js` - Notifications Swikly
- ⬜ Modifier formulaire location.html avec intégration Swikly
- ⬜ Implémenter le blocage de caution (valeur instrument)
- ⬜ Implémenter la libération de caution (retour instrument)
- ⬜ Implémenter le prélèvement partiel (dommages)
- ⬜ Dashboard admin pour suivre les cautions actives
- ⬜ Notifications automatiques (renouvellement, expiration)
- ⬜ Tests en environnement sandbox

**Flux de location:**
1. Client remplit formulaire → Swikly bloque la caution
2. Admin valide → Création location + facture mensuelle
3. Fin location → Admin libère caution via Swikly
4. Si dommages → Prélèvement partiel sur caution

**Documentation:**
- [Swikly API](https://www.swikly.com/fr/api)

---

### 4. Correction Admin Panel

**Objectif:** Corriger les bugs et compléter les fonctionnalités CRUD

**Fichiers concernés:**
- `js/admin-ui-modals.js` - Modales de création/édition
- `js/admin-ui-core.js` - Navigation et dashboard
- `js/admin-ui-boutique.js` - Gestion stock
- `js/admin-ui-compta.js` - Comptabilité
- `js/gestion.js` - Logique métier

**Problèmes identifiés:**
- ⬜ Audit complet des opérations CRUD (Create, Read, Update, Delete)
- ⬜ Vérifier la synchronisation localStorage ↔ Supabase
- ⬜ Corriger les erreurs de validation de formulaires
- ⬜ Ajouter confirmations de suppression manquantes
- ⬜ Corriger le système de TODO admin (localStorage)
- ⬜ Améliorer la gestion d'erreurs réseau
- ⬜ Ajouter audit log des actions admin
- ⬜ Tester tous les formulaires de création
- ⬜ Tester toutes les modifications
- ⬜ Tester toutes les suppressions
- ⬜ Vérifier les calculs comptables

**Tests à effectuer par entité:**

| Entité | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| Instruments | ⬜ | ⬜ | ⬜ | ⬜ |
| Clients | ⬜ | ⬜ | ⬜ | ⬜ |
| Commandes | ⬜ | ⬜ | ⬜ | ⬜ |
| Locations | ⬜ | ⬜ | ⬜ | ⬜ |
| Factures | ⬜ | ⬜ | ⬜ | ⬜ |
| Professeurs | ⬜ | ⬜ | ⬜ | ⬜ |
| Articles | ⬜ | ⬜ | ⬜ | ⬜ |
| Galerie | ⬜ | ⬜ | ⬜ | ⬜ |
| Accessoires | ⬜ | ⬜ | ⬜ | ⬜ |

---

### 5. Audit Sécurité RLS (Row-Level Security)

**Objectif:** Sécuriser l'accès aux données Supabase

**Fichiers concernés:**
- `sql/02_rls_policies.sql` - Politiques actuelles
- `sql/` - Nouvelles migrations si nécessaire

**Tâches:**
- ⬜ Auditer les politiques RLS existantes
- ⬜ Identifier les règles trop permissives (`USING (true)`)
- ⬜ Implémenter des politiques granulaires par table
- ⬜ Tester l'accès anonyme vs authentifié
- ⬜ Documenter les politiques appliquées

---

## 🟡 PRIORITÉ MOYENNE

### 6. Intégration reCAPTCHA v3

**Objectif:** Protéger les formulaires contre le spam

**Fichiers concernés:**
- `apprendre.html:1419` - Placeholder existant
- `js/teacher-form.js` - Formulaire professeur
- `commander.html` - Formulaires commande
- `partials/contact-modal.html` - Formulaire contact
- `netlify/functions/send-email.js` - Validation serveur

**Tâches:**
- ⬜ Créer projet Google reCAPTCHA v3
- ⬜ Obtenir clés site + secret
- ⬜ Créer `js/recaptcha.js` - Module de gestion reCAPTCHA
- ⬜ Remplacer placeholder par vraie clé dans `apprendre.html`
- ⬜ Intégrer reCAPTCHA dans formulaire professeur
- ⬜ Intégrer reCAPTCHA dans formulaire contact
- ⬜ Intégrer reCAPTCHA dans formulaires commande
- ⬜ Intégrer reCAPTCHA dans formulaire location
- ⬜ Validation serveur dans `send-email.js`
- ⬜ Créer `netlify/functions/verify-recaptcha.js` (optionnel)
- ⬜ Définir seuil de score (recommandé: 0.5)
- ⬜ Fallback si reCAPTCHA échoue

**Formulaires à protéger:**
1. Inscription professeur (`apprendre.html`)
2. Contact général (`contact-modal.html`)
3. Commande instrument (`commander.html`)
4. Demande de location (`location.html`)

---

### 7. Amélioration Swipe Boutique

**Objectif:** Améliorer l'UX mobile avec gestures explicites

**Fichiers concernés:**
- `boutique.html:1340-1530` - Navigation actuelle
- `js/boutique.js` ou inline script
- `css/boutique.css` - Styles swipe

**État actuel:**
- ✅ Navigation par tabs/dots sur mobile
- ✅ Scroll horizontal natif
- ✅ Toggle desktop configurateur/stock

**Améliorations:**
- ⬜ Ajouter indicateurs visuels de swipe (flèches, hints)
- ⬜ Implémenter détection de gestes explicite (Hammer.js ou vanilla)
- ⬜ Ajouter feedback haptique sur mobile (vibration API)
- ⬜ Snap-to-section sur fin de swipe
- ⬜ Animation de transition entre sections
- ⬜ Indicateur de progression (dots animés)
- ⬜ Tests sur iOS Safari et Chrome Android

---

### 8. Scale Batch System

**Objectif:** Moderniser la gestion des gammes musicales

**Spécification:** Voir `SCALE_BATCH_SPEC.md`

**Tâches Phase 1 (Database):**
- ⬜ Créer table `gammes` dans Supabase
- ⬜ Créer table `gammes_batches` dans Supabase
- ⬜ Migrer les 65 gammes de `scales-data.js`
- ⬜ Configurer RLS pour les nouvelles tables

**Tâches Phase 2 (Admin):**
- ⬜ Ajouter onglet "Gammes" dans admin
- ⬜ CRUD gammes individuelles
- ⬜ CRUD batches de gammes
- ⬜ Interface de rotation des batches

**Tâches Phase 3 (Configurateur):**
- ⬜ Modifier `scales-data.js` pour fetch Supabase
- ⬜ Afficher chips de batch dans boutique
- ⬜ Filtrage par batch actif

---

## 🟢 PRIORITÉ BASSE

### 9. Accessibilité (WCAG)

**Tâches:**
- ⬜ Audit contraste des couleurs
- ⬜ Ajouter attributs ARIA manquants
- ⬜ Améliorer navigation clavier
- ⬜ Tester avec lecteur d'écran
- ⬜ Ajouter skip-links

---

### 10. Migration Auth Admin vers Supabase

**Objectif:** Remplacer localStorage par Supabase Auth

**Tâches:**
- ⬜ Configurer Supabase Auth
- ⬜ Créer table `admin_users`
- ⬜ Migrer `admin-core.js` vers Supabase Auth
- ⬜ Implémenter gestion des rôles
- ⬜ Ajouter récupération mot de passe

---

### 11. Optimisations Performance

**Tâches:**
- ⬜ Audit innerHTML pour XSS (46 usages)
- ⬜ Lazy loading images
- ⬜ Code splitting JS
- ⬜ Minification CSS/JS pour production
- ⬜ Headers Content-Security-Policy

---

## Calendrier Prévisionnel

```
Février 2026
├── Semaine 1-2: Email API (Brevo) + Admin Panel Audit
├── Semaine 3-4: Payplug Integration

Mars 2026
├── Semaine 1-2: Swikly Integration
├── Semaine 3-4: reCAPTCHA + Tests complets

Avril 2026
├── Semaine 1-2: Scale Batch System (Phases 1-2)
├── Semaine 3-4: Swipe UX + Accessibilité

Mai 2026
├── Semaine 1-2: Scale Batch System (Phase 3)
├── Semaine 3-4: Auth Migration + Optimisations
```

---

## Notes Techniques

### Variables d'environnement requises

```env
# Supabase (existant)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx

# Brevo (email)
BREVO_API_KEY=xxx
BREVO_SENDER_EMAIL=contact@mistralpans.fr

# Payplug
PAYPLUG_SECRET_KEY=xxx
PAYPLUG_PUBLIC_KEY=xxx

# Swikly
SWIKLY_API_KEY=xxx
SWIKLY_SECRET=xxx

# reCAPTCHA
RECAPTCHA_SITE_KEY=xxx
RECAPTCHA_SECRET_KEY=xxx
```

### Structure des Netlify Functions

```
netlify/functions/
├── send-email.js          # Existant - À améliorer
├── payplug-create-payment.js   # À créer
├── payplug-webhook.js          # À créer
├── swikly-create-deposit.js    # À créer
├── swikly-webhook.js           # À créer
└── verify-recaptcha.js         # Optionnel
```

---

## Changelog

| Date | Version | Modifications |
|------|---------|---------------|
| 2026-02-05 | 1.0 | Création initiale du roadmap |

---

## Contacts & Ressources

- **Site:** [mistralpans.fr](https://mistralpans.fr)
- **Email:** contact@mistralpans.fr
- **Documentation:** `CLAUDE.md`, `ADMIN_SPEC.md`, `SCALE_BATCH_SPEC.md`
