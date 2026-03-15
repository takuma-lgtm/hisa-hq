-- Migration 010: Lead qualification fields
-- Adds structured qualification data that must be completed before lead → opportunity conversion

ALTER TABLE customers ADD COLUMN IF NOT EXISTS qualified_products text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS qualified_volume_kg numeric;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS qualified_budget text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS qualified_samples_agreed boolean DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS qualified_at timestamptz;
