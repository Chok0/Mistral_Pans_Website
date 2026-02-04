# Configuration Supabase pour Mistral Pans

Ce guide explique comment configurer Supabase pour l'authentification et la base de données.

---

## 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com) et créez un compte
2. Cliquez sur "New Project"
3. Choisissez un nom et une région (EU recommandé pour RGPD)
4. Notez le mot de passe de la base de données (vous en aurez besoin plus tard)
5. Attendez que le projet soit créé (~2 minutes)

---

## 2. Récupérer les identifiants API

1. Dans votre projet Supabase, allez dans **Settings > API**
2. Copiez :
   - **Project URL** : `https://xxxxx.supabase.co`
   - **anon public key** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

> **Note sécurité** : La clé `anon` est conçue pour être exposée côté client.
> La sécurité vient des politiques RLS (Row Level Security), pas du secret de cette clé.

---

## 3. Configurer le projet local

### Créer le fichier de configuration

```bash
# Depuis la racine du projet
cp js/config.example.js js/config.js
```

### Éditer js/config.js

```javascript
window.MISTRAL_CONFIG = {
  SUPABASE_URL: 'https://votre-projet.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

> **Important** : Ne commitez JAMAIS `js/config.js` dans git (il est dans .gitignore)

---

## 4. Créer un utilisateur admin

### Option A : Via le dashboard Supabase

1. Dans Supabase, allez dans **Authentication > Users**
2. Cliquez sur "Add User" > "Create new user"
3. Entrez :
   - Email : `admin@votre-domaine.fr`
   - Password : (un mot de passe fort)
   - Cochez "Auto Confirm User"
4. Cliquez sur "Create User"

### Option B : Via SQL (pour plusieurs utilisateurs)

1. Allez dans **SQL Editor**
2. Exécutez :

```sql
-- Créer un utilisateur admin
INSERT INTO auth.users (
  email,
  encrypted_password,
  email_confirmed_at,
  role
) VALUES (
  'admin@votre-domaine.fr',
  crypt('votre-mot-de-passe', gen_salt('bf')),
  now(),
  'authenticated'
);
```

---

## 5. Configurer les politiques RLS

Les politiques Row Level Security contrôlent qui peut accéder aux données.

### Activer RLS sur les tables

```sql
-- Activer RLS sur toutes les tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE professeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE galerie ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
```

### Politiques pour les utilisateurs authentifiés (admin)

```sql
-- Accès complet pour les utilisateurs authentifiés
CREATE POLICY "Admin full access" ON clients
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access" ON instruments
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access" ON factures
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access" ON locations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access" ON commandes
  FOR ALL USING (auth.role() = 'authenticated');
```

### Politiques de lecture publique (site vitrine)

```sql
-- Instruments en ligne visibles publiquement
CREATE POLICY "Public read online instruments" ON instruments
  FOR SELECT USING (statut = 'en_ligne');

-- Professeurs actifs visibles publiquement
CREATE POLICY "Public read active teachers" ON professeurs
  FOR SELECT USING (statut = 'actif');

-- Articles publiés visibles publiquement
CREATE POLICY "Public read published articles" ON articles
  FOR SELECT USING (statut = 'publie');

-- Galerie visible publiquement
CREATE POLICY "Public read gallery" ON galerie
  FOR SELECT USING (true);
```

---

## 6. Déploiement en production

### Sur OVH / serveur classique

1. Connectez-vous en FTP/SSH à votre serveur
2. Créez le fichier `js/config.js` manuellement avec vos identifiants
3. Vérifiez que `js/config.js` n'est pas accessible publiquement (ou acceptez que la clé anon soit publique)

### Sur Netlify

1. Dans **Site settings > Build & deploy > Environment**
2. Ajoutez les variables :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Créez un script de build qui génère `js/config.js` :

```bash
# netlify.toml
[build]
  command = "echo \"window.MISTRAL_CONFIG = { SUPABASE_URL: '$SUPABASE_URL', SUPABASE_ANON_KEY: '$SUPABASE_ANON_KEY' };\" > js/config.js"
```

### Sur Vercel

Similaire à Netlify, utilisez les Environment Variables et un build script.

---

## 7. Tester la configuration

1. Lancez le serveur local :
   ```bash
   python -m http.server 8000
   ```

2. Allez sur `http://localhost:8000/admin.html`

3. Connectez-vous avec l'email et mot de passe créés à l'étape 4

4. Vérifiez dans la console qu'il n'y a pas d'erreur Supabase

---

## Dépannage

### "supabaseUrl is required"

Le fichier `js/config.js` n'existe pas ou n'est pas chargé avant les autres scripts.

### "Invalid login credentials"

- Vérifiez que l'utilisateur existe dans Supabase > Authentication > Users
- Vérifiez que l'email est confirmé (email_confirmed_at non null)
- Vérifiez le mot de passe

### "Service d'authentification non disponible"

MistralAuth n'est pas chargé. Vérifiez l'ordre des scripts dans admin.html :
1. config.js
2. supabase SDK
3. supabase-client.js
4. supabase-auth.js

### Erreurs CORS

Ajoutez votre domaine dans Supabase > Settings > API > Additional URLs.

---

## Sécurité

- **La clé anon est publique** : C'est normal et prévu par Supabase
- **RLS est obligatoire** : Sans politiques RLS, tout est accessible
- **Utilisez des mots de passe forts** : Minimum 12 caractères
- **HTTPS obligatoire** : Supabase refuse les connexions non sécurisées en production
