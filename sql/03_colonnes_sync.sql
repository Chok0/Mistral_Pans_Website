-- ============================================================================
-- MISTRAL PANS - Colonnes additionnelles pour sync localStorage
-- ============================================================================
-- 
-- Ce script ajoute les colonnes nécessaires pour synchroniser les données
-- existantes de localStorage vers Supabase.
-- 
-- Exécuter APRÈS 01_schema.sql si la sync échoue avec des erreurs de colonnes.
--
-- ============================================================================

-- CLIENTS
ALTER TABLE clients ADD COLUMN IF NOT EXISTS justificatif_domicile_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS piece_identite_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS credit_fidelite DECIMAL(10,2) DEFAULT 0;

-- INSTRUMENTS
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS boutique_annonce_id TEXT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS notes TEXT;

-- LOCATIONS
ALTER TABLE locations ADD COLUMN IF NOT EXISTS caution_mode TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS mode_location TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS frais_dossier_transport DECIMAL(10,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS date_fin_engagement DATE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS contrat_pdf_url TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS signature_date DATE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS signature_ip TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS paiements JSONB DEFAULT '[]';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS swikly_id TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS swikly_url TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS swikly_status TEXT;

-- FACTURES
ALTER TABLE factures ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS sous_total DECIMAL(10,2);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS statut TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_annulation DATE;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS total DECIMAL(10,2);

-- PROFESSEURS
ALTER TABLE professeurs ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE professeurs ADD COLUMN IF NOT EXISTS firstname TEXT;
ALTER TABLE professeurs ADD COLUMN IF NOT EXISTS lastname TEXT;
ALTER TABLE professeurs ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE professeurs ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE professeurs ADD COLUMN IF NOT EXISTS postalcode TEXT;
ALTER TABLE professeurs ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE professeurs ADD COLUMN IF NOT EXISTS photo TEXT;
ALTER TABLE professeurs ADD COLUMN IF NOT EXISTS status TEXT;

-- ARTICLES
ALTER TABLE articles ADD COLUMN IF NOT EXISTS "coverImage" TEXT;

-- ============================================================================
-- Supprimer les contraintes qui bloquent la sync
-- ============================================================================

-- Contraintes UNIQUE
ALTER TABLE instruments DROP CONSTRAINT IF EXISTS instruments_reference_key;
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_slug_key;
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_numero_key;

-- Contraintes FOREIGN KEY (peuvent bloquer l'insertion si ordre incorrect)
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_client_id_fkey;
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_commande_id_fkey;
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_location_id_fkey;
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_client_id_fkey;
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_instrument_id_fkey;
ALTER TABLE commandes DROP CONSTRAINT IF EXISTS commandes_client_id_fkey;

-- ============================================================================
-- Modifier le type d'ID pour certaines tables (supporter les anciens IDs)
-- ============================================================================

-- ARTICLES - Changer UUID vers TEXT
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_pkey CASCADE;
ALTER TABLE articles ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE articles ADD PRIMARY KEY (id);

-- PROFESSEURS - Changer UUID vers TEXT
ALTER TABLE professeurs DROP CONSTRAINT IF EXISTS professeurs_pkey CASCADE;
ALTER TABLE professeurs ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE professeurs ADD PRIMARY KEY (id);

-- ============================================================================
-- FIN
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Colonnes additionnelles ajoutées avec succès !';
END $$;
