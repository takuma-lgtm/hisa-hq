-- =============================================================================
-- Migration 021: Inventory Improvements + US Outbound Orders
-- Adds low stock flagging, auto-tracking columns, US outbound orders + items
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. SKU improvements: low stock flagging
-- ---------------------------------------------------------------------------

ALTER TABLE skus ADD COLUMN IF NOT EXISTS low_stock_threshold integer;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS reorder_supplier_id uuid REFERENCES suppliers(supplier_id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS reorder_note text;

-- ---------------------------------------------------------------------------
-- 2. Inventory transactions: tracking improvements
-- ---------------------------------------------------------------------------

ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS last_tracked_at timestamptz;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS auto_track_enabled boolean DEFAULT false;

-- ---------------------------------------------------------------------------
-- 3. Inbound PO auto-numbering sequence
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS inbound_po_seq START 7;
-- Starting at 7 because PO-1 through PO-6 exist in historical data

-- ---------------------------------------------------------------------------
-- 4. US Outbound Orders sequence
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS us_order_seq START 2;
-- Starting at 2 because order #1 (thedangspot) exists in historical data

-- ---------------------------------------------------------------------------
-- 5. us_outbound_orders table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS us_outbound_orders (
  order_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number           text NOT NULL UNIQUE,
  customer_id            uuid REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name          text NOT NULL,
  status                 text NOT NULL DEFAULT 'pending',
  ship_to_name           text,
  ship_to_address        text,
  ship_to_city           text,
  ship_to_state          text,
  ship_to_zip            text,
  ship_to_country        text DEFAULT 'United States',
  date_shipped_from_jp   date,
  date_received_us       date,
  date_shipped           date,
  date_delivered         date,
  carrier                text,
  tracking_number        text,
  tracking_url           text,
  delivery_status        text DEFAULT 'pending',
  last_tracked_at        timestamptz,
  auto_track_enabled     boolean DEFAULT false,
  shipping_cost_usd      numeric,
  total_item_value_usd   numeric,
  notes                  text,
  created_by             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 6. us_outbound_order_items table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS us_outbound_order_items (
  item_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               uuid NOT NULL REFERENCES us_outbound_orders(order_id) ON DELETE CASCADE,
  sku_id                 uuid NOT NULL REFERENCES skus(sku_id) ON DELETE RESTRICT,
  sku_name               text NOT NULL,
  product_description    text,
  quantity               integer NOT NULL,
  unit_value_usd         numeric,
  subtotal_usd           numeric
);

-- ---------------------------------------------------------------------------
-- 7. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_uso_customer ON us_outbound_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_uso_status ON us_outbound_orders(status);
CREATE INDEX IF NOT EXISTS idx_uso_date_shipped ON us_outbound_orders(date_shipped DESC);
CREATE INDEX IF NOT EXISTS idx_uso_created ON us_outbound_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uso_items_order ON us_outbound_order_items(order_id);

-- ---------------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER set_uso_updated_at
  BEFORE UPDATE ON us_outbound_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. RLS Policies — us_outbound_orders
-- ---------------------------------------------------------------------------

ALTER TABLE us_outbound_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uso_select" ON us_outbound_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "uso_insert" ON us_outbound_orders
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "uso_update" ON us_outbound_orders
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'))
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "uso_delete" ON us_outbound_orders
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 10. RLS Policies — us_outbound_order_items
-- ---------------------------------------------------------------------------

ALTER TABLE us_outbound_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uso_items_select" ON us_outbound_order_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "uso_items_insert" ON us_outbound_order_items
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "uso_items_update" ON us_outbound_order_items
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'))
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "uso_items_delete" ON us_outbound_order_items
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'));
