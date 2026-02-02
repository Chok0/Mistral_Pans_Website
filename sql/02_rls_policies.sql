-- =============================================================================
-- MISTRAL PANS - Policies RLS (Row Level Security)
-- =============================================================================
-- 
-- Ce script configure la sécurité des tables.
-- Exécute-le dans Supabase SQL Editor.
--
-- Règles:
-- - Les utilisateurs authentifiés (admin) ont accès complet
-- - Les visiteurs anonymes peuvent voir certaines données publiques
-- =============================================================================

-- =============================================================================
-- ACTIVER RLS SUR TOUTES LES TABLES
-- =============================================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE professeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE galerie ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessoires ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SUPPRIMER LES ANCIENNES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Admin full access clients" ON clients;
DROP POLICY IF EXISTS "Admin full access instruments" ON instruments;
DROP POLICY IF EXISTS "Admin full access locations" ON locations;
DROP POLICY IF EXISTS "Admin full access commandes" ON commandes;
DROP POLICY IF EXISTS "Admin full access factures" ON factures;
DROP POLICY IF EXISTS "Admin full access professeurs" ON professeurs;
DROP POLICY IF EXISTS "Admin full access galerie" ON galerie;
DROP POLICY IF EXISTS "Admin full access articles" ON articles;
DROP POLICY IF EXISTS "Admin full access accessoires" ON accessoires;
DROP POLICY IF EXISTS "Admin full access configuration" ON configuration;

DROP POLICY IF EXISTS "Public read professeurs actifs" ON professeurs;
DROP POLICY IF EXISTS "Public read galerie" ON galerie;
DROP POLICY IF EXISTS "Public read articles publiés" ON articles;
DROP POLICY IF EXISTS "Public read instruments en ligne" ON instruments;
DROP POLICY IF EXISTS "Public read accessoires en ligne" ON accessoires;
DROP POLICY IF EXISTS "Public insert professeurs pending" ON professeurs;

-- =============================================================================
-- TABLES PRIVÉES (Admin uniquement)
-- =============================================================================

-- CLIENTS - Accès admin uniquement
CREATE POLICY "clients_admin_all" ON clients
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- LOCATIONS - Accès admin uniquement  
CREATE POLICY "locations_admin_all" ON locations
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- COMMANDES - Accès admin uniquement
CREATE POLICY "commandes_admin_all" ON commandes
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- FACTURES - Accès admin uniquement
CREATE POLICY "factures_admin_all" ON factures
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- CONFIGURATION - Accès admin uniquement
CREATE POLICY "configuration_admin_all" ON configuration
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- TABLES MIXTES (Lecture publique + Écriture admin)
-- =============================================================================

-- INSTRUMENTS
-- Public: lecture des instruments "en_ligne" uniquement
CREATE POLICY "instruments_public_read" ON instruments
    FOR SELECT
    TO anon
    USING (statut = 'en_ligne');

-- Admin: accès complet
CREATE POLICY "instruments_admin_all" ON instruments
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- PROFESSEURS
-- Public: lecture des professeurs actifs
CREATE POLICY "professeurs_public_read" ON professeurs
    FOR SELECT
    TO anon
    USING (statut = 'active');

-- Public: peut soumettre une demande (insert avec statut pending)
CREATE POLICY "professeurs_public_insert" ON professeurs
    FOR INSERT
    TO anon
    WITH CHECK (statut = 'pending');

-- Admin: accès complet
CREATE POLICY "professeurs_admin_all" ON professeurs
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- GALERIE
-- Public: lecture de toute la galerie
CREATE POLICY "galerie_public_read" ON galerie
    FOR SELECT
    TO anon
    USING (true);

-- Admin: accès complet
CREATE POLICY "galerie_admin_all" ON galerie
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ARTICLES
-- Public: lecture des articles publiés
CREATE POLICY "articles_public_read" ON articles
    FOR SELECT
    TO anon
    USING (status = 'published');

-- Admin: accès complet
CREATE POLICY "articles_admin_all" ON articles
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ACCESSOIRES
-- Public: lecture des accessoires en ligne
CREATE POLICY "accessoires_public_read" ON accessoires
    FOR SELECT
    TO anon
    USING (statut = 'en_ligne');

-- Admin: accès complet
CREATE POLICY "accessoires_admin_all" ON accessoires
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- FIN DES POLICIES
-- =============================================================================

-- Vérification
DO $$
BEGIN
    RAISE NOTICE '✅ Policies RLS configurées avec succès !';
    RAISE NOTICE '';
    RAISE NOTICE 'Résumé:';
    RAISE NOTICE '- clients, locations, commandes, factures, configuration: Admin uniquement';
    RAISE NOTICE '- instruments, professeurs, galerie, articles, accessoires: Lecture publique + Admin complet';
END $$;
