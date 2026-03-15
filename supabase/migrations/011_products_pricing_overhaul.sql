-- Migration 011: Products & Pricing Overhaul
-- Adds multi-currency pricing columns, pricing_tiers table, and crm_settings table.
-- Migration 011: Products & Pricing Overhaul
-- Adds multi-currency pricing columns, pricing_tiers table, and crm_settings table.
-- Migration 011: Products & Pricing Overhaul
-- Adds multi-currency pricing columns, pricing_tiers table, and crm_settings table.

-- ============================================================================
-- 1. New columns on products
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS date_added date;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_internal_jpn text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS matcha_cost_per_kg_jpy numeric CHECK (matcha_cost_per_kg_jpy >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS us_landing_cost_per_kg_usd numeric CHECK (us_landing_cost_per_kg_usd >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS uk_landing_cost_per_kg_gbp numeric CHECK (uk_landing_cost_per_kg_gbp >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS eu_landing_cost_per_kg_eur numeric CHECK (eu_landing_cost_per_kg_eur >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price_usd numeric CHECK (selling_price_usd >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_price_usd numeric CHECK (min_price_usd >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price_gbp numeric CHECK (selling_price_gbp >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_price_gbp numeric CHECK (min_price_gbp >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price_eur numeric CHECK (selling_price_eur >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_price_eur numeric CHECK (min_price_eur >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS gross_profit_per_kg_usd numeric;

-- Backfill new columns from existing data
UPDATE products SET us_landing_cost_per_kg_usd = landing_cost_per_kg_usd
  WHERE landing_cost_per_kg_usd IS NOT NULL AND us_landing_cost_per_kg_usd IS NULL;

UPDATE products SET selling_price_usd = default_selling_price_usd
  WHERE default_selling_price_usd IS NOT NULL AND selling_price_usd IS NULL;

UPDATE products SET min_price_usd = min_selling_price_usd
  WHERE min_selling_price_usd IS NOT NULL AND min_price_usd IS NULL;

-- ============================================================================
-- 2. pricing_tiers table
-- ============================================================================

CREATE TABLE IF NOT EXISTS pricing_tiers (
  tier_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    text NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  currency      text NOT NULL DEFAULT 'USD',
  tier_name     text NOT NULL,
  min_volume_kg numeric NOT NULL DEFAULT 0 CHECK (min_volume_kg >= 0),
  discount_pct  numeric NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  price_per_kg  numeric NOT NULL CHECK (price_per_kg >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_product ON pricing_tiers(product_id, currency);

-- ============================================================================
-- 3. crm_settings table
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  label       text,
  category    text DEFAULT 'general',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. RLS policies
-- ============================================================================

ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_settings ENABLE ROW LEVEL SECURITY;

-- pricing_tiers: all authenticated users can read
CREATE POLICY "pricing_tiers_select" ON pricing_tiers
  FOR SELECT TO authenticated USING (true);

-- pricing_tiers: admin can insert/update/delete
CREATE POLICY "pricing_tiers_admin_insert" ON pricing_tiers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "pricing_tiers_admin_update" ON pricing_tiers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "pricing_tiers_admin_delete" ON pricing_tiers
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- crm_settings: all authenticated users can read
CREATE POLICY "crm_settings_select" ON crm_settings
  FOR SELECT TO authenticated USING (true);

-- crm_settings: admin can insert/update/delete
CREATE POLICY "crm_settings_admin_insert" ON crm_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "crm_settings_admin_update" ON crm_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "crm_settings_admin_delete" ON crm_settings
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 5. Seed crm_settings
-- ============================================================================

INSERT INTO crm_settings (key, value, label, category) VALUES
  -- Exchange rates
  ('exchange_rate_usd_jpy', '150', 'USD/JPY Exchange Rate', 'exchange_rates'),
  ('exchange_rate_usd_gbp', '0.75', 'USD/GBP Exchange Rate', 'exchange_rates'),
  ('exchange_rate_usd_eur', '0.85', 'USD/EUR Exchange Rate', 'exchange_rates'),
  -- Shipping costs
  ('shipping_cost_jp_us_per_kg_jpy', '2000', 'JP→US Shipping Cost (¥/kg)', 'shipping'),
  ('shipping_cost_jp_eu_per_kg_jpy', '4000', 'JP→EU Shipping Cost (¥/kg) via DHL', 'shipping'),
  -- Company info
  ('company_name', 'Hisa Matcha', 'Company Name', 'company'),
  ('company_phone', '+818047835681', 'Company Phone', 'company'),
  ('company_email', 'info@hisamatcha.com', 'Company Email', 'company'),
  ('us_warehouse_address', '8309 S 124th St, Seattle, Washington 98178, United States', 'US Warehouse Address', 'company'),
  ('jp_warehouse_address', '', 'JP Warehouse Address', 'company'),
  -- Margin alert thresholds
  ('margin_alert_red_profit_usd', '150', 'Red alert: gross profit below this ($)', 'margin_alerts'),
  ('margin_alert_red_margin_pct', '15', 'Red alert: margin below this (%)', 'margin_alerts'),
  ('margin_alert_yellow_profit_usd', '330', 'Yellow alert: gross profit below this ($)', 'margin_alerts'),
  ('margin_alert_yellow_margin_pct', '25', 'Yellow alert: margin below this (%)', 'margin_alerts')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  updated_at = now();
