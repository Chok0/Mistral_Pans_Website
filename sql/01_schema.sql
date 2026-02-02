-- ============================================================================
-- MISTRAL PANS - Schéma de Base de Données Supabase
-- ============================================================================
-- 
-- À exécuter dans : Supabase Dashboard > SQL Editor > New Query
-- Copie-colle tout ce fichier et clique sur "Run"
--
-- ============================================================================

-- ============================================================================
-- EXTENSION UUID
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: CLIENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identité
  civilite TEXT CHECK (civilite IN ('M.', 'Mme', 'Autre')),
  nom TEXT NOT NULL,
  prenom TEXT,
  
  -- Contact
  email TEXT,
  telephone TEXT,
  
  -- Adresse
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  pays TEXT DEFAULT 'France',
  
  -- Informations complémentaires
  date_naissance DATE,
  lieu_naissance TEXT,
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- ============================================================================
-- TABLE: INSTRUMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS instruments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  reference TEXT UNIQUE,  -- Ex: MP-HP-NS-D-KURD-00123
  numero TEXT,            -- Numéro de série court
  
  -- Caractéristiques
  nom TEXT NOT NULL,      -- Ex: "D Kurd 9 notes"
  gamme TEXT,             -- kurd, amara, celtic, etc.
  tonalite TEXT,          -- D3, C#3, etc.
  nombre_notes INTEGER DEFAULT 9,
  taille INTEGER DEFAULT 53,  -- 45, 50, 53 cm
  materiau TEXT DEFAULT 'NS', -- NS (nitruré), ES (ember), SS (inox)
  accordage TEXT DEFAULT '440', -- 440 ou 432 Hz
  
  -- Notes layout
  notes_layout TEXT,      -- "D3 A3 Bb3 C4 D4 E4 F4 G4 A4"
  
  -- Prix
  prix_vente DECIMAL(10,2),
  prix_location_mensuel DECIMAL(10,2) DEFAULT 50,
  montant_caution DECIMAL(10,2) DEFAULT 1150,
  
  -- Statut
  statut TEXT DEFAULT 'disponible' CHECK (statut IN (
    'disponible',
    'en_ligne',      -- Visible sur la boutique
    'en_location',
    'vendu',
    'reserve',
    'prete',
    'en_fabrication'
  )),
  
  -- Médias
  images JSONB DEFAULT '[]',  -- Array d'URLs ou base64
  video_url TEXT,
  handpaner_url TEXT,         -- Lien vers fiche Handpaner
  
  -- Description
  description TEXT,
  commentaires TEXT,          -- Notes internes
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_instruments_statut ON instruments(statut);
CREATE INDEX IF NOT EXISTS idx_instruments_gamme ON instruments(gamme);

-- ============================================================================
-- TABLE: LOCATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relations
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  instrument_id UUID REFERENCES instruments(id) ON DELETE SET NULL,
  
  -- Dates
  date_debut DATE NOT NULL,
  date_fin_prevue DATE,
  date_fin_effective DATE,
  duree_engagement_mois INTEGER DEFAULT 3,
  
  -- Financier
  loyer_mensuel DECIMAL(10,2) DEFAULT 50,
  montant_caution DECIMAL(10,2) DEFAULT 1150,
  frais_dossier DECIMAL(10,2) DEFAULT 0,
  frais_transport_aller DECIMAL(10,2) DEFAULT 0,
  frais_transport_retour DECIMAL(10,2) DEFAULT 0,
  
  -- Caution
  caution_type TEXT DEFAULT 'cheque' CHECK (caution_type IN ('cheque', 'swikly', 'virement', 'especes')),
  caution_statut TEXT DEFAULT 'en_attente' CHECK (caution_statut IN (
    'en_attente',
    'recue',
    'restituee',
    'encaissee'  -- Si dégâts
  )),
  caution_reference TEXT,  -- Numéro de chèque ou ID Swikly
  
  -- Statut
  statut TEXT DEFAULT 'en_cours' CHECK (statut IN (
    'en_cours',
    'terminee',
    'annulee'
  )),
  
  -- Livraison
  mode_livraison TEXT CHECK (mode_livraison IN ('main_propre', 'expedition', 'retrait_atelier')),
  adresse_livraison TEXT,
  
  -- Accessoires
  accessoires TEXT DEFAULT 'Housse de transport',
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_locations_client ON locations(client_id);
CREATE INDEX IF NOT EXISTS idx_locations_instrument ON locations(instrument_id);
CREATE INDEX IF NOT EXISTS idx_locations_statut ON locations(statut);

-- ============================================================================
-- TABLE: COMMANDES
-- ============================================================================
CREATE TABLE IF NOT EXISTS commandes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relations
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  -- Détails
  description TEXT,
  specifications JSONB,  -- Détails de la config custom
  
  -- Financier
  montant_total DECIMAL(10,2),
  montant_acomptes DECIMAL(10,2) DEFAULT 0,
  
  -- Statut
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN (
    'en_attente',
    'en_fabrication',
    'pret',
    'livre',
    'annule'
  )),
  
  -- Dates
  date_commande DATE DEFAULT CURRENT_DATE,
  date_livraison_prevue DATE,
  date_livraison_effective DATE,
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes(client_id);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes(statut);

-- ============================================================================
-- TABLE: FACTURES
-- ============================================================================
CREATE TABLE IF NOT EXISTS factures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Numérotation
  numero TEXT UNIQUE NOT NULL,  -- Format: FA-2025-0001
  
  -- Relations
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  commande_id UUID REFERENCES commandes(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  
  -- Type
  type TEXT DEFAULT 'vente' CHECK (type IN (
    'vente',
    'acompte',
    'solde',
    'location',
    'prestation',
    'avoir'
  )),
  
  -- Dates
  date_emission DATE DEFAULT CURRENT_DATE,
  date_echeance DATE,
  date_paiement DATE,
  
  -- Lignes de facture (stockées en JSON)
  lignes JSONB DEFAULT '[]',
  -- Format: [{description, quantite, prix_unitaire, total}]
  
  -- Montants
  montant_ht DECIMAL(10,2),
  taux_tva DECIMAL(5,2) DEFAULT 0,  -- 0 car auto-entrepreneur
  montant_tva DECIMAL(10,2) DEFAULT 0,
  montant_ttc DECIMAL(10,2),
  
  -- Pour les factures de solde
  acomptes_deduits DECIMAL(10,2) DEFAULT 0,
  factures_acompte_ids UUID[] DEFAULT '{}',
  
  -- Paiement
  statut_paiement TEXT DEFAULT 'en_attente' CHECK (statut_paiement IN (
    'en_attente',
    'partiel',
    'paye',
    'annule'
  )),
  mode_paiement TEXT CHECK (mode_paiement IN (
    'virement',
    'cheque',
    'especes',
    'carte',
    'paypal'
  )),
  
  -- Notes
  notes TEXT,
  conditions TEXT,  -- Conditions de paiement
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(client_id);
CREATE INDEX IF NOT EXISTS idx_factures_numero ON factures(numero);
CREATE INDEX IF NOT EXISTS idx_factures_date ON factures(date_emission);

-- ============================================================================
-- TABLE: PROFESSEURS (pour page Apprendre)
-- ============================================================================
CREATE TABLE IF NOT EXISTS professeurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identité
  nom TEXT NOT NULL,
  
  -- Localisation
  location_text TEXT,  -- "Paris (75011)"
  code_postal TEXT,
  ville TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  
  -- Contact
  email TEXT,
  telephone TEXT,
  
  -- Profil
  bio TEXT,
  photo_url TEXT,  -- URL ou base64
  
  -- Cours
  course_types TEXT[] DEFAULT '{}',   -- ['domicile', 'studio', 'distance']
  course_formats TEXT[] DEFAULT '{}', -- ['solo', 'groupe']
  instrument_available BOOLEAN DEFAULT false,
  
  -- Réseaux sociaux
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  youtube TEXT,
  tiktok TEXT,
  
  -- Statut
  statut TEXT DEFAULT 'pending' CHECK (statut IN ('pending', 'active', 'inactive')),
  
  -- Métadonnées
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_professeurs_statut ON professeurs(statut);
CREATE INDEX IF NOT EXISTS idx_professeurs_ville ON professeurs(ville);

-- ============================================================================
-- TABLE: GALERIE
-- ============================================================================
CREATE TABLE IF NOT EXISTS galerie (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Type
  type TEXT DEFAULT 'image' CHECK (type IN ('image', 'video')),
  
  -- Média
  src TEXT NOT NULL,        -- URL du fichier
  thumbnail TEXT,           -- URL de la miniature
  
  -- Métadonnées média
  title TEXT,
  description TEXT,
  gamme TEXT,               -- Pour filtrage
  duration TEXT,            -- Pour vidéos: "2:34"
  
  -- Affichage
  ordre INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,  -- Pour section "Pan Concert"
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_galerie_ordre ON galerie(ordre);
CREATE INDEX IF NOT EXISTS idx_galerie_featured ON galerie(featured);

-- ============================================================================
-- TABLE: ARTICLES (Blog)
-- ============================================================================
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  slug TEXT UNIQUE NOT NULL,
  
  -- Contenu
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,  -- HTML
  cover_image TEXT,
  
  -- Classification
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Auteur
  author TEXT DEFAULT 'Mistral Pans',
  
  -- Publication
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);

-- ============================================================================
-- TABLE: CONFIGURATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS configuration (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer la config par défaut
INSERT INTO configuration (key, value) VALUES 
  ('entreprise', '{
    "nom": "Adrien Santamaria",
    "marque": "Mistral Pan",
    "adresse": "105 rue du bas val Mary",
    "code_postal": "95630",
    "ville": "Mériel",
    "siret": "889 482 758 00014",
    "email": "adrien.santamaria@gmail.com",
    "telephone": "07 62 76 65 30",
    "iban": "FR76 1751 5000 9208 0035 0475 637",
    "bic": "CEPAFRPP751",
    "banque": "Caisse d Epargne"
  }'::jsonb),
  ('defaults', '{
    "loyer_mensuel": 50,
    "montant_caution": 1150,
    "frais_dossier_transport": 100,
    "frais_transport_retour": 40,
    "duree_engagement_mois": 3,
    "prix_par_note": 115
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- TABLE: ACCESSOIRES
-- ============================================================================
CREATE TABLE IF NOT EXISTS accessoires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  nom TEXT NOT NULL,
  description TEXT,
  
  -- Prix
  prix DECIMAL(10,2),
  
  -- Stock
  quantite_stock INTEGER DEFAULT 0,
  
  -- Statut
  statut TEXT DEFAULT 'disponible' CHECK (statut IN ('disponible', 'en_ligne', 'rupture')),
  
  -- Média
  image TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FONCTION: Mise à jour automatique de updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger à toutes les tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN ('clients', 'instruments', 'locations', 'commandes', 'factures', 'professeurs', 'galerie', 'articles', 'accessoires')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END $$;

-- ============================================================================
-- FONCTION: Génération automatique numéro de facture
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_facture_numero()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    next_num INTEGER;
BEGIN
    year_prefix := 'FA-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-';
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(numero FROM year_prefix || '(\d+)') AS INTEGER)
    ), 0) + 1
    INTO next_num
    FROM factures
    WHERE numero LIKE year_prefix || '%';
    
    NEW.numero := year_prefix || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-générer le numéro
DROP TRIGGER IF EXISTS generate_facture_numero_trigger ON factures;
CREATE TRIGGER generate_facture_numero_trigger
BEFORE INSERT ON factures
FOR EACH ROW
WHEN (NEW.numero IS NULL OR NEW.numero = '')
EXECUTE FUNCTION generate_facture_numero();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Sécurité de base
-- ============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE professeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE galerie ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessoires ENABLE ROW LEVEL SECURITY;

-- Politique: Lecture publique pour certaines tables (site vitrine)
CREATE POLICY "Public read professeurs actifs" ON professeurs
    FOR SELECT USING (statut = 'active');

CREATE POLICY "Public read galerie" ON galerie
    FOR SELECT USING (true);

CREATE POLICY "Public read articles publiés" ON articles
    FOR SELECT USING (status = 'published');

CREATE POLICY "Public read instruments en ligne" ON instruments
    FOR SELECT USING (statut = 'en_ligne');

CREATE POLICY "Public read accessoires en ligne" ON accessoires
    FOR SELECT USING (statut = 'en_ligne');

-- Politique: Accès complet pour les utilisateurs authentifiés (admin)
CREATE POLICY "Admin full access clients" ON clients
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access instruments" ON instruments
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access locations" ON locations
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access commandes" ON commandes
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access factures" ON factures
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access professeurs" ON professeurs
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access galerie" ON galerie
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access articles" ON articles
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access configuration" ON configuration
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access accessoires" ON accessoires
    FOR ALL USING (auth.role() = 'authenticated');

-- Politique: Permettre l'insertion de demandes de professeurs (formulaire public)
CREATE POLICY "Public insert professeurs pending" ON professeurs
    FOR INSERT WITH CHECK (statut = 'pending');

-- ============================================================================
-- FIN DU SCHÉMA
-- ============================================================================

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Schéma Mistral Pans créé avec succès !';
    RAISE NOTICE 'Tables créées: clients, instruments, locations, commandes, factures, professeurs, galerie, articles, accessoires, configuration';
END $$;
