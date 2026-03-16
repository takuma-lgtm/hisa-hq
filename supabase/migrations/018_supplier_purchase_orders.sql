-- =============================================================================
-- Migration 018: Supplier Purchase Orders + Active Supplier tracking
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add columns to suppliers table
-- ---------------------------------------------------------------------------

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS converted_at timestamptz;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS quality_rating smallint CHECK (quality_rating >= 1 AND quality_rating <= 5);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS reliability_rating smallint CHECK (reliability_rating >= 1 AND reliability_rating <= 5);

-- ---------------------------------------------------------------------------
-- 2. PO number sequence
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS supplier_purchase_orders (
  po_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number            text NOT NULL UNIQUE,
  supplier_id          uuid NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
  order_date           date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery    date,
  actual_delivery      date,
  delivery_status      text NOT NULL DEFAULT 'pending',
  total_amount_jpy     numeric,
  payment_status       text NOT NULL DEFAULT 'unpaid',
  payment_date         date,
  quality_rating       smallint CHECK (quality_rating >= 1 AND quality_rating <= 5),
  notes                text,
  created_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_purchase_order_items (
  item_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                uuid NOT NULL REFERENCES supplier_purchase_orders(po_id) ON DELETE CASCADE,
  product_id           text REFERENCES products(product_id) ON DELETE SET NULL,
  product_name_jpn     text,
  quantity_kg          numeric NOT NULL,
  price_per_kg_jpy     numeric NOT NULL,
  subtotal_jpy         numeric,
  notes                text
);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_spo_supplier_id ON supplier_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_spo_order_date ON supplier_purchase_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_spo_po_number ON supplier_purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_spo_items_po_id ON supplier_purchase_order_items(po_id);

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER set_spo_updated_at
  BEFORE UPDATE ON supplier_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RLS Policies
-- ---------------------------------------------------------------------------

-- supplier_purchase_orders
ALTER TABLE supplier_purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spo_select" ON supplier_purchase_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "spo_insert" ON supplier_purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "spo_update" ON supplier_purchase_orders
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'))
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "spo_delete" ON supplier_purchase_orders
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- supplier_purchase_order_items
ALTER TABLE supplier_purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spo_items_select" ON supplier_purchase_order_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "spo_items_insert" ON supplier_purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "spo_items_update" ON supplier_purchase_order_items
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'))
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "spo_items_delete" ON supplier_purchase_order_items
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'));
