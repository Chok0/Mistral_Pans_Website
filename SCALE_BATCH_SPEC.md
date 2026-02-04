# Scale Batch System - Technical Specification

> **Version:** 1.0
> **Date:** February 2026
> **Status:** Draft - For Future Development

---

## Overview

This specification describes a database-driven scale management system with batch categorization for the Mistral Pans configurator. The system replaces the hardcoded `scales-data.js` with a flexible, admin-configurable approach.

---

## Goals

1. **Organize 65+ scales** into manageable batches for the configurator
2. **Simplify user experience** by showing curated scale selections
3. **Enable admin control** over which scales appear and how they're grouped
4. **Preserve music theory logic** for sharp/flat notation
5. **Support future expansion** for scales with >9 notes

---

## Batch Structure

### Five Batch Categories

| Batch | French Name | Description | Behavior |
|-------|-------------|-------------|----------|
| `debutant` | Débutant | Beginner-friendly scales | Always visible, fixed position |
| `mineur` | Mineur | Minor mode scales (Kurd, Celtic, etc.) | Rotates with other batches |
| `majeur` | Majeur | Major mode scales (Sabye, Oxalis, etc.) | Rotates with other batches |
| `modal` | Modal | Modal scales (Dorian, Phrygian, etc.) | Rotates with other batches |
| `ethnic` | Ethnique | World music scales (Hijaz, Akebono, etc.) | Rotates with other batches |

### Configurator Display Logic

- **Desktop:** Show all 5 batch chips
- **Mobile:** Show 3-4 batch chips with horizontal scroll
- **Débutant batch** is always visible in first position
- Other batches can be reordered by admin

---

## Data Model

### New Table: `gammes` (Scales)

```sql
CREATE TABLE gammes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  nom VARCHAR(100) NOT NULL,           -- "Kurd", "Celtic Minor", etc.
  slug VARCHAR(100) UNIQUE NOT NULL,   -- "kurd", "celtic-minor"

  -- Musical Properties
  pattern VARCHAR(100) NOT NULL,       -- "D/-A-Bb-C-D-E-F-G-A_"
  mode VARCHAR(50),                    -- "aeolian", "dorian", "mixolydian", etc.
  interval_ding VARCHAR(10),           -- "Q5", "Q4", "T3m", "M2"
  caractere TEXT,                      -- "Nostalgique, mélancolique"

  -- Classification
  collection VARCHAR(50),              -- "Mineur", "Majeur", "Modal", "Ethnic", "Mixte"
  batch VARCHAR(20) NOT NULL,          -- "debutant", "mineur", "majeur", "modal", "ethnic"

  -- Note Configuration
  nb_notes INTEGER DEFAULT 9,          -- Total notes including ding
  notes_octave2 INTEGER DEFAULT 0,     -- Number of octave 2 notes
  has_bottoms BOOLEAN DEFAULT false,   -- Whether scale uses bottom notes

  -- For scales >9 notes
  note_variants JSONB,                 -- Configuration for selectable notes

  -- Display
  ordre INTEGER DEFAULT 0,             -- Sort order within batch
  visible BOOLEAN DEFAULT true,        -- Show in configurator
  featured BOOLEAN DEFAULT false,      -- Highlight as popular

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_gammes_batch ON gammes(batch);
CREATE INDEX idx_gammes_visible ON gammes(visible);
CREATE INDEX idx_gammes_ordre ON gammes(batch, ordre);
```

### New Table: `gammes_batches` (Batch Configuration)

```sql
CREATE TABLE gammes_batches (
  id VARCHAR(20) PRIMARY KEY,          -- "debutant", "mineur", etc.
  nom VARCHAR(50) NOT NULL,            -- Display name in French
  description TEXT,
  ordre INTEGER DEFAULT 0,             -- Display order in configurator
  couleur VARCHAR(20),                 -- Chip color (CSS variable or hex)
  icone VARCHAR(50),                   -- Optional icon class
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO gammes_batches (id, nom, ordre, couleur) VALUES
  ('debutant', 'Débutant', 0, 'var(--color-success)'),
  ('mineur', 'Mineur', 1, 'var(--color-accent)'),
  ('majeur', 'Majeur', 2, 'var(--color-warning)'),
  ('modal', 'Modal', 3, '#8B5CF6'),
  ('ethnic', 'Ethnique', 4, '#EC4899');
```

### Updated Table: `instruments`

Add reference to scale:

```sql
ALTER TABLE instruments
ADD COLUMN gamme_id UUID REFERENCES gammes(id);
```

---

## Pattern Notation

### Standard Pattern Format

```
[Ding]/[Note1]-[Note2]-[Note3]-[Note4]-[Note5]-[Note6]-[Note7]-[Note8]_
```

- **Ding:** Root note with octave (e.g., `D3`, `E3`)
- **Separator:** `/` after ding
- **Notes:** Hyphen-separated, can include sharps (`#`) or flats (`b`)
- **Terminator:** `_` marks end of pattern

### Examples

| Scale | Pattern |
|-------|---------|
| Kurd 9 | `D/-A-Bb-C-D-E-F-G-A_` |
| Celtic 10 | `D/-A-C-D-E-F-G-A-C-D_` |
| Pygmy 9 | `D/-A-C-D-Eb-G-A-C-D_` |

### Interval Notation (Ding to First Note)

| Code | Name | Semitones | Example |
|------|------|-----------|---------|
| `Q5` | Quinte (5th) | 7 | D→A |
| `Q4` | Quarte (4th) | 5 | D→G |
| `T3m` | Tierce mineure | 3 | D→F |
| `T3M` | Tierce majeure | 4 | D→F# |
| `M2` | Seconde majeure | 2 | D→E |

---

## Music Theory Integration

### Existing Logic (Preserved)

The `shouldUseFlats(root, mode)` function in `scales-data.js` calculates correct enharmonic spelling based on:

1. **Circle of Fifths position** of the root
2. **Mode offset** (lydian=+1, ionian=0, mixolydian=-1, dorian=-2, aeolian=-3, phrygian=-4)
3. **Comparison** of sharp vs flat notation complexity

### Mode Mapping

| Mode Property | Circle Offset | Typical Scales |
|---------------|---------------|----------------|
| `lydian` | +1 | Lydian |
| `ionian` | 0 | Major, Sabye |
| `mixolydian` | -1 | Oxalis, Magic Voyage |
| `dorian` | -2 | Dorian, Amara |
| `aeolian` | -3 | Kurd, Celtic, Pygmy |
| `phrygian` | -4 | Phrygian |
| `phrygian_dominant` | -4 | Hijaz |

### Scales Without Standard Mode ("Mixte")

For scales that don't fit standard Western modes, set `mode: null` and the system will:
1. Use a default (aeolian) for calculation
2. Or store explicit `use_flats` override in database

---

## Scales >9 Notes

### Problem

Handpan physical layout supports 8-9 tone fields comfortably. Scales with 10+ notes require:
- User selection of which notes to include
- Or automatic "core" vs "optional" note designation

### Proposed Solution: Note Variants

```json
{
  "core_notes": ["A", "C", "D", "E", "F", "G", "A"],
  "optional_notes": [
    {"note": "C5", "position": "top", "label": "Octave haute"},
    {"note": "D5", "position": "top", "label": "Octave haute"}
  ],
  "max_notes": 10,
  "default_config": ["core", "C5"]
}
```

### UI Behavior

1. Scale with >9 notes shows "Configurer" button
2. Opens modal with core notes (locked) and optional notes (toggleable)
3. User selects which optional notes to include
4. Selection affects pricing (octave 2 notes = +50€ each)

---

## Admin Panel Integration

### New Tab: "Gammes" (Scales)

Located in `admin.html`, between "Stock" and "Professeurs" tabs.

#### Features

1. **Scale List View**
   - Filterable by batch
   - Sortable by name, ordre, visibility
   - Quick toggle for visibility
   - Drag-drop reordering within batch

2. **Scale Editor Modal**
   - All fields from `gammes` table
   - Pattern builder/validator
   - Preview of scale on SVG handpan
   - Mode selector with automatic sharp/flat preview

3. **Batch Manager**
   - Reorder batches
   - Edit batch colors/names
   - View scale count per batch

#### Admin UI Components (in `admin-ui.js`)

```javascript
// New components needed:
MistralAdminUI.renderScalesTab()
MistralAdminUI.renderScaleEditor(scale)
MistralAdminUI.renderBatchManager()
MistralAdminUI.renderPatternBuilder()
MistralAdminUI.renderScalePreview(pattern, root)
```

---

## Configurator Integration

### Changes to `boutique.html`

1. **Batch Chips Row**
   ```html
   <div class="batch-chips">
     <button class="batch-chip active" data-batch="debutant">Débutant</button>
     <button class="batch-chip" data-batch="mineur">Mineur</button>
     <!-- etc. -->
   </div>
   ```

2. **Scale Selector**
   - Filters scales by selected batch
   - Shows scale name + note count
   - Featured scales highlighted

3. **Root Selector**
   - Unchanged, but dynamically shows sharp/flat based on selected scale's mode

### Changes to `handpan-player.js`

1. Load scales from Supabase instead of `scales-data.js`
2. Cache scales in localStorage with TTL
3. Maintain fallback to static data if offline

### Changes to `scales-data.js`

Convert to hybrid mode:
- Keep music theory functions (`shouldUseFlats`, etc.)
- Remove hardcoded scale definitions
- Add `loadScales()` async function
- Export `MistralScales.getScale(slug)` API

---

## Migration Plan

### Phase 1: Database Setup
1. Create `gammes` and `gammes_batches` tables
2. Add RLS policies (public read, authenticated write)
3. Seed initial batch configuration

### Phase 2: Data Migration
1. Parse all 65 scales from catalogue
2. Assign each to appropriate batch
3. Insert into database
4. Verify pattern format and mode assignments

### Phase 3: Admin Panel
1. Add "Gammes" tab to admin
2. Implement CRUD operations
3. Add batch management
4. Add pattern builder/preview

### Phase 4: Configurator Update
1. Add batch chips UI
2. Update scale selector to filter by batch
3. Integrate with Supabase data
4. Implement offline fallback

### Phase 5: Extended Features
1. Note variants for >9 note scales
2. Scale recommendations based on user preferences
3. Popularity tracking

---

## API Endpoints (Supabase)

### Public Queries

```javascript
// Get all visible scales grouped by batch
const { data } = await supabase
  .from('gammes')
  .select('*')
  .eq('visible', true)
  .order('batch')
  .order('ordre');

// Get batches configuration
const { data } = await supabase
  .from('gammes_batches')
  .select('*')
  .eq('visible', true)
  .order('ordre');

// Get single scale by slug
const { data } = await supabase
  .from('gammes')
  .select('*')
  .eq('slug', 'kurd')
  .single();
```

### Admin Operations

```javascript
// Update scale
await supabase
  .from('gammes')
  .update({ batch: 'ethnic', ordre: 5 })
  .eq('id', scaleId);

// Bulk reorder
await supabase.rpc('reorder_gammes', {
  batch: 'mineur',
  ordered_ids: ['uuid1', 'uuid2', ...]
});
```

---

## Scale Catalogue Assignment

Based on the provided 65-scale catalogue, here is the proposed batch assignment:

### Débutant (8-10 scales)
Criteria: Popular, versatile, easy to play

- Kurd 9
- Celtic Minor 9
- Integral 9
- Pygmy 9
- Amara 9
- La Sirena
- Equinox
- Magic Voyage

### Mineur (15-20 scales)
All scales from "Mineur" collection:

- Kurd 9, 10
- Celtic Minor 9, 10, 11
- Integral 9, 10, 11
- Mystic 9, 10
- Pygmy 9, 10
- Aegean 9, 10
- AnnaZiska 9, 10, 11
- Melog Selisir

### Majeur (10-15 scales)
All scales from "Majeur" collection:

- Sabye 9, 10, 11
- Oxalis 8, 9, 10
- Magic Voyage 9, 10, 11

### Modal (10-15 scales)
Dorian, Lydian, Phrygian, and modal "Mixte" scales:

- Amara (Dorian)
- Onoleo (Lydian adjacent)
- La Sirena (Phrygian adjacent)
- Equinox
- Golden Gate
- Ysha Savita
- Romanian Hijaz
- Deep Bumble Bee
- Tarznauyn

### Ethnique (15-20 scales)
World music influenced scales:

- Hijaz 9, 10, 11
- Akebono
- Hitzaz Kar
- Maqam Rast
- Maqam Jiharkah
- Blues / Pentatoniques diverses
- Harmonic Minor variants

---

## Estimated Effort

| Phase | Complexity | Dependencies |
|-------|------------|--------------|
| Phase 1: Database | Low | None |
| Phase 2: Migration | Medium | Phase 1 |
| Phase 3: Admin Panel | High | Phase 1, 2 |
| Phase 4: Configurator | Medium | Phase 1, 2 |
| Phase 5: Extended | High | Phase 3, 4 |

---

## Open Questions

1. **Batch rotation logic:** Should non-débutant batches rotate randomly or in fixed order?
2. **Mobile UX:** Horizontal scroll vs dropdown for batch selection on small screens?
3. **Scale recommendations:** Should we track which scales users explore most?
4. **Offline mode:** How long should cached scales remain valid?
5. **>9 note pricing:** Should optional octave 2 notes have different pricing?

---

## References

- `CLAUDE.md` - Project documentation
- `ADMIN_SPEC.md` - Admin system specifications
- `js/scales-data.js` - Current scale definitions and music theory
- `js/handpan-player.js` - SVG handpan player implementation
- `boutique.html` - Configurator page

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial specification |
