-- Migration 006: Add Google Maps / Apify columns for lead discovery
-- Supports importing leads from Google Maps via Apify scraper

ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_rating numeric;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_review_count integer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_google_place_id
  ON customers (google_place_id)
  WHERE google_place_id IS NOT NULL;
