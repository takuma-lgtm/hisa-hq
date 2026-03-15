-- Migration 012: Inventory System
-- Adds warehouse_locations, skus, inventory_levels, and inventory_transactions tables.

-- ============================================================================
-- 1. warehouse_locations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouse_locations (
  warehouse_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,
  short_code      text NOT NULL UNIQUE,
  address         text,
  country         text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouse_locations_select" ON warehouse_locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "warehouse_locations_admin_insert" ON warehouse_locations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "warehouse_locations_admin_update" ON warehouse_locations
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "warehouse_locations_admin_delete" ON warehouse_locations
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed warehouses
INSERT INTO warehouse_locations (name, short_code, country) VALUES
  ('JP Warehouse', 'JP', 'Japan')
ON CONFLICT (name) DO NOTHING;

INSERT INTO warehouse_locations (name, short_code, address, country) VALUES
  ('US Warehouse', 'US', '8309 S 124th St, Seattle, Washington 98178, United States', 'United States')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 2. skus table
-- ============================================================================

CREATE TABLE IF NOT EXISTS skus (
  sku_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_name            text NOT NULL UNIQUE,
  product_id          text REFERENCES products(product_id) ON DELETE SET NULL,
  name_external_eng   text,
  name_internal_jpn   text,
  sku_type            text NOT NULL DEFAULT 'Sample',
  unit_weight_kg      numeric NOT NULL DEFAULT 0.03,
  matcha_cost_per_kg_jpy  numeric,
  unit_cost_jpy       numeric,
  note                text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skus_product ON skus(product_id);
CREATE INDEX IF NOT EXISTS idx_skus_type ON skus(sku_type);

ALTER TABLE skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skus_select" ON skus
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "skus_admin_insert" ON skus
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "skus_admin_update" ON skus
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "skus_admin_delete" ON skus
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 3. inventory_levels table
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_levels (
  inventory_level_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id              uuid NOT NULL REFERENCES skus(sku_id) ON DELETE CASCADE,
  warehouse_id        uuid NOT NULL REFERENCES warehouse_locations(warehouse_id) ON DELETE CASCADE,
  quantity            integer NOT NULL DEFAULT 0,
  in_transit_qty      integer NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sku_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_levels_sku ON inventory_levels(sku_id);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_warehouse ON inventory_levels(warehouse_id);

ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_levels_select" ON inventory_levels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_levels_admin_insert" ON inventory_levels
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'closer'))
  );

CREATE POLICY "inventory_levels_admin_update" ON inventory_levels
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'closer'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'closer'))
  );

CREATE POLICY "inventory_levels_admin_delete" ON inventory_levels
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 4. inventory_transactions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
  transaction_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_ref     text,
  date_received       date,
  date_shipped        date,
  item_type           text NOT NULL DEFAULT 'Sample',
  movement_type       text NOT NULL,
  from_location       text,
  to_destination      text,
  sku_id              uuid NOT NULL REFERENCES skus(sku_id),
  warehouse_affected  uuid REFERENCES warehouse_locations(warehouse_id),
  qty_change          integer NOT NULL,
  carrier             text,
  delivery_status     text DEFAULT 'pending',
  tracking_dhl        text,
  tracking_fedex      text,
  tracking_usps       text,
  tracking_ups        text,
  note                text,
  customer_id         uuid REFERENCES customers(customer_id) ON DELETE SET NULL,
  opportunity_id      uuid REFERENCES opportunities(opportunity_id) ON DELETE SET NULL,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_sku ON inventory_transactions(sku_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_warehouse ON inventory_transactions(warehouse_affected);
CREATE INDEX IF NOT EXISTS idx_inv_tx_ref ON inventory_transactions(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_inv_tx_movement ON inventory_transactions(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_tx_date ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_tx_customer ON inventory_transactions(customer_id) WHERE customer_id IS NOT NULL;

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_transactions_select" ON inventory_transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_transactions_write_insert" ON inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'closer'))
  );

CREATE POLICY "inventory_transactions_write_update" ON inventory_transactions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'closer'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'closer'))
  );

CREATE POLICY "inventory_transactions_admin_delete" ON inventory_transactions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
