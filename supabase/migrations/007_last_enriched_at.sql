-- Migration 007: Add last_enriched_at for Apify contact enrichment tracking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;
