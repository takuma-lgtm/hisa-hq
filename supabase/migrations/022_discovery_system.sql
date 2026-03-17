-- =============================================================================
-- Migration 022: Discovery System
-- Adds discovery_runs + discovered_prospects for prospect discovery tools
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. discovery_runs — tracks each search/scrape run
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS discovery_runs (
  run_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source              text NOT NULL,
  status              text NOT NULL DEFAULT 'running',
  params              jsonb,
  apify_run_id        text,
  results_count       integer DEFAULT 0,
  imported_count      integer DEFAULT 0,
  duplicates_skipped  integer DEFAULT 0,
  error_message       text,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_discovery_runs_status ON discovery_runs(status);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_source ON discovery_runs(source);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_created ON discovery_runs(created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. discovered_prospects — staging table before import
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS discovered_prospects (
  prospect_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid NOT NULL REFERENCES discovery_runs(run_id) ON DELETE CASCADE,
  cafe_name           text NOT NULL,
  city                text,
  state               text,
  country             text DEFAULT 'US',
  instagram_url       text,
  instagram_handle    text,
  website_url         text,
  phone               text,
  address             text,
  rating              numeric,
  review_count        integer,
  serves_matcha       text,
  source              text,
  raw_data            jsonb,
  is_duplicate        boolean DEFAULT false,
  duplicate_of        uuid REFERENCES customers(customer_id) ON DELETE SET NULL,
  imported            boolean DEFAULT false,
  imported_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovered_prospects_run ON discovered_prospects(run_id);
CREATE INDEX IF NOT EXISTS idx_discovered_prospects_not_imported ON discovered_prospects(imported) WHERE imported = false;

-- ---------------------------------------------------------------------------
-- 3. RLS Policies
-- ---------------------------------------------------------------------------

ALTER TABLE discovery_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discovery_runs_select" ON discovery_runs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "discovery_runs_insert" ON discovery_runs
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'lead_gen'));

CREATE POLICY "discovery_runs_update" ON discovery_runs
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'lead_gen'))
  WITH CHECK (get_my_role() IN ('admin', 'lead_gen'));

ALTER TABLE discovered_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discovered_prospects_select" ON discovered_prospects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "discovered_prospects_insert" ON discovered_prospects
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'lead_gen'));

CREATE POLICY "discovered_prospects_update" ON discovered_prospects
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'lead_gen'))
  WITH CHECK (get_my_role() IN ('admin', 'lead_gen'));
