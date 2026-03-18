-- Add sku_id to supplier purchase order items so receipt can auto-update JP inventory
ALTER TABLE supplier_purchase_order_items
  ADD COLUMN IF NOT EXISTS sku_id uuid REFERENCES skus(sku_id);
