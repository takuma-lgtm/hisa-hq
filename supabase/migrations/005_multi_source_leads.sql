-- Migration 005: Add source_type column for multi-source lead import
-- Tracks how each lead was imported (e.g. 'sheets_import', 'gemini', 'manual')

ALTER TABLE customers ADD COLUMN IF NOT EXISTS source_type text;

-- Backfill existing leads that came from sheets import
UPDATE customers
SET source_type = 'sheets_import'
WHERE lead_source = 'sheets_import'
  AND source_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_source_type ON customers (source_type);
