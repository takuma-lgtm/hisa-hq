-- Migration 015: Payment integration — Stripe Checkout, Wise, Zelle
-- Adds payment columns to invoices, creates invoice number sequence,
-- and seeds payment-related CRM settings.

-- ---------------------------------------------------------------------------
-- 1. Extend invoices with payment columns
-- ---------------------------------------------------------------------------

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wise_transfer_reference text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wise_bank_details jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS zelle_email text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items_detail jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_via text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

-- ---------------------------------------------------------------------------
-- 2. Make quotation_id nullable (invoices can be created directly)
-- ---------------------------------------------------------------------------

ALTER TABLE invoices ALTER COLUMN quotation_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Invoice number sequence
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1;

-- RPC function to call nextval from Supabase JS client
CREATE OR REPLACE FUNCTION nextval_text(seq_name text) RETURNS text
  LANGUAGE sql SECURITY DEFINER AS $$
  SELECT nextval(seq_name)::text;
$$;

-- ---------------------------------------------------------------------------
-- 4. Index on invoice_number for lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- ---------------------------------------------------------------------------
-- 5. Seed payment-related CRM settings
-- ---------------------------------------------------------------------------

INSERT INTO crm_settings (key, value, label, category) VALUES
  -- Zelle
  ('zelle_email', 'info@hisamatcha.com', 'Zelle Email Address', 'payments'),
  -- Wise USD
  ('wise_usd_account_holder', '', 'Account Holder (USD)', 'payments'),
  ('wise_usd_routing_number', '', 'Routing Number (USD)', 'payments'),
  ('wise_usd_account_number', '', 'Account Number (USD)', 'payments'),
  ('wise_usd_bank_name', '', 'Bank Name (USD)', 'payments'),
  -- Wise GBP
  ('wise_gbp_account_holder', '', 'Account Holder (GBP)', 'payments'),
  ('wise_gbp_sort_code', '', 'Sort Code (GBP)', 'payments'),
  ('wise_gbp_account_number', '', 'Account Number (GBP)', 'payments'),
  ('wise_gbp_bank_name', '', 'Bank Name (GBP)', 'payments'),
  -- Wise EUR
  ('wise_eur_account_holder', '', 'Account Holder (EUR)', 'payments'),
  ('wise_eur_iban', '', 'IBAN (EUR)', 'payments'),
  ('wise_eur_bic', '', 'BIC/SWIFT (EUR)', 'payments'),
  ('wise_eur_bank_name', '', 'Bank Name (EUR)', 'payments')
ON CONFLICT (key) DO NOTHING;
