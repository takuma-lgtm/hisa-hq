-- =============================================================================
-- Migration 004: Lead Intake & Management fields
-- Adds lead_stage enum and new columns to customers for Google Sheets import.
-- =============================================================================

-- New enum for CRM-managed lead workflow status
CREATE TYPE lead_stage_enum AS ENUM (
  'new_lead',
  'contacted',
  'replied',
  'qualified',
  'handed_off',
  'disqualified'
);

-- New columns on customers
-- Sheet-importable fields + CRM workflow fields
ALTER TABLE customers
  ADD COLUMN lead_stage        lead_stage_enum DEFAULT 'new_lead',
  ADD COLUMN instagram_url     text,
  ADD COLUMN website_url       text,
  ADD COLUMN serves_matcha     boolean,
  ADD COLUMN platform_used     text,
  ADD COLUMN date_generated    date,
  ADD COLUMN date_contacted    date,
  ADD COLUMN source_region     text,
  ADD COLUMN last_imported_at  timestamptz,
  ADD COLUMN lead_assigned_to  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN notes             text;

-- Indexes for common lead-page queries
CREATE INDEX idx_customers_lead_stage
  ON customers(lead_stage) WHERE status = 'lead';

CREATE INDEX idx_customers_source_region
  ON customers(source_region) WHERE status = 'lead';

CREATE INDEX idx_customers_lead_assigned_to
  ON customers(lead_assigned_to) WHERE lead_assigned_to IS NOT NULL;

CREATE INDEX idx_customers_instagram_url
  ON customers(instagram_url) WHERE instagram_url IS NOT NULL;

CREATE INDEX idx_customers_website_url
  ON customers(website_url) WHERE website_url IS NOT NULL;
