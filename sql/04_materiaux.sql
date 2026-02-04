-- ============================================================================
-- MISTRAL PANS - Table des Matériaux
-- ============================================================================
--
-- Cette table permet de gérer dynamiquement les matériaux disponibles
-- pour les instruments, avec contrôle admin sur la disponibilité.
--
-- ============================================================================

-- ============================================================================
-- TABLE: MATERIAUX
-- ============================================================================
CREATE TABLE IF NOT EXISTS materiaux (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identification
  code TEXT UNIQUE NOT NULL,      -- NS, ES, SS (code court pour référence)
  nom TEXT NOT NULL,              -- Nom complet affiché
  nom_court TEXT,                 -- Nom court pour les specs (optionnel)

  -- Description
  description TEXT,               -- Description du matériau

  -- Prix
  prix_malus DECIMAL(5,2) DEFAULT 0,  -- Malus de prix en % (0 = pas de surcoût)

  -- Affichage
  ordre INTEGER DEFAULT 0,        -- Ordre d'affichage
  couleur TEXT,                   -- Couleur hex pour l'UI (optionnel)

  -- Disponibilité
  disponible BOOLEAN DEFAULT true,     -- Disponible à la vente
  visible_configurateur BOOLEAN DEFAULT true,  -- Visible dans le configurateur

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_materiaux_code ON materiaux(code);
CREATE INDEX IF NOT EXISTS idx_materiaux_disponible ON materiaux(disponible);
CREATE INDEX IF NOT EXISTS idx_materiaux_ordre ON materiaux(ordre);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_materiaux_updated_at ON materiaux;
CREATE TRIGGER update_materiaux_updated_at
BEFORE UPDATE ON materiaux
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE materiaux ENABLE ROW LEVEL SECURITY;

-- Lecture publique des matériaux disponibles
CREATE POLICY "Public read materiaux disponibles" ON materiaux
    FOR SELECT USING (disponible = true);

-- Accès complet pour admin
CREATE POLICY "Admin full access materiaux" ON materiaux
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- DONNÉES INITIALES
-- ============================================================================
INSERT INTO materiaux (code, nom, nom_court, description, prix_malus, ordre, disponible, visible_configurateur) VALUES
  ('NS', 'Acier Nitruré', 'Nitrure', 'Acier traité par nitruration pour une protection optimale contre la corrosion. Son d''or caractéristique.', 0, 1, true, true),
  ('ES', 'Ember Steel', 'Ember Steel', 'Acier avec finition cuivrée unique. Chaleur du son et esthétique distinctive.', 5, 2, true, true),
  ('SS', 'Acier Inoxydable', 'Inox', 'Acier inoxydable pour une durabilité maximale. Finition brillante argentée.', 10, 3, true, true)
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  nom_court = EXCLUDED.nom_court,
  description = EXCLUDED.description,
  prix_malus = EXCLUDED.prix_malus,
  ordre = EXCLUDED.ordre;

-- ============================================================================
-- FIN
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Table materiaux créée avec succès !';
END $$;
