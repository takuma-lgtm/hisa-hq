-- Migration 008: Add columns for Clay deep enrichment
-- contact_title: job title of the contact person (e.g., "Owner", "Manager")
-- linkedin_url: LinkedIn profile URL of the contact person
-- company_size: company/cafe size info from Clay

ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_title text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_size text;
