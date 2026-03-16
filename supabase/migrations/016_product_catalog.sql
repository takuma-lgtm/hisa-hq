-- Migration 016: Product catalog — sensory profiles, tasting logs, competitor evaluations
-- Adds sensory profile columns to products, creates sensory_logs table.

-- ---------------------------------------------------------------------------
-- 1. Extend products with sensory profile + competitor columns
-- ---------------------------------------------------------------------------

ALTER TABLE products ADD COLUMN IF NOT EXISTS tasting_headline text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS long_description text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS harvest_season text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cultivar text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS production_region text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS grind_method text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS roast_level text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS texture_description text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS best_for text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_folder_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_competitor boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS competitor_producer text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS competitor_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS introduced_by text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS should_contact_producer boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. Create sensory_logs table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sensory_logs (
  log_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          text NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  taster_name         text NOT NULL,
  tasted_at           date NOT NULL DEFAULT CURRENT_DATE,
  umami_rating        smallint CHECK (umami_rating BETWEEN 1 AND 5),
  bitterness_rating   smallint CHECK (bitterness_rating BETWEEN 1 AND 5),
  fineness_rating     smallint CHECK (fineness_rating BETWEEN 1 AND 5),
  color_notes         text,
  texture_notes       text,
  aroma_notes         text,
  flavor_notes        text,
  comparison_notes    text,
  general_notes       text,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensory_logs_product ON sensory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_sensory_logs_taster ON sensory_logs(taster_name);

-- ---------------------------------------------------------------------------
-- 3. RLS for sensory_logs
-- ---------------------------------------------------------------------------

ALTER TABLE sensory_logs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "sensory_logs_select" ON sensory_logs
  FOR SELECT TO authenticated USING (true);

-- All authenticated users can insert
CREATE POLICY "sensory_logs_insert" ON sensory_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Admin only can update
CREATE POLICY "sensory_logs_update" ON sensory_logs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Admin only can delete
CREATE POLICY "sensory_logs_delete" ON sensory_logs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
