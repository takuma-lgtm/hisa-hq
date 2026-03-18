-- Migration 026: Lead intel fields
-- Adds structured market intelligence columns captured during promote/disqualify flow

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS matcha_interest_level   text,
  ADD COLUMN IF NOT EXISTS customer_bucket         text,
  ADD COLUMN IF NOT EXISTS disqualification_reason text;
