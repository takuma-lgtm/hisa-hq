-- =============================================================================
-- Seed Inventory: SKUs, Stock Levels, and Historical Transactions
-- Run in Supabase SQL Editor after migration 021
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Insert 13 SKUs
--    unit_cost_jpy derived from CSV value/qty * 150 (exchange rate)
-- ---------------------------------------------------------------------------

INSERT INTO skus (sku_name, product_id, name_external_eng, sku_type, unit_weight_kg, unit_cost_jpy)
VALUES
  ('SC-3_1kg',      'SC-3', 'SC-3 1kg Bulk',       'Product', 1.0,    NULL),
  ('SC-3_30g',      'SC-3', 'SC-3 30g Sample',     'Product', 0.03,   360),
  ('SC-4_1kg',      'SC-4', 'SC-4 1kg Bulk',       'Retail',  1.0,    NULL),
  ('SC-4_30g',      'SC-4', 'SC-4 30g Sample',     'Product', 0.03,   450),
  ('SC-5_1kg',      'SC-5', 'SC-5 1kg Bulk',       'Sample',  1.0,    NULL),
  ('SC-5_30g',      'SC-5', 'SC-5 30g Sample',     'Sample',  0.03,   450),
  ('SC-6_1kg',      'SC-6', 'SC-6 1kg Bulk',       'Sample',  1.0,    NULL),
  ('SC-6_30g',      'SC-6', 'SC-6 30g Sample',     'Product', 0.03,   300),
  ('SC-3_RedCans',  'SC-3', 'SC-3 Red Cans',       'Retail',  0.03,   NULL),
  ('OC-1_50g',      'OC-1', 'OC-1 50g Sample',     'Sample',  0.05,   NULL),
  ('OC-1_1kg',      'OC-1', 'OC-1 1kg Bulk',       'Product', 1.0,    NULL),
  ('OC-1_30g',      'OC-1', 'OC-1 30g Sample',     'Sample',  0.03,   150),
  ('SC-7_30g',      'SC-7', 'SC-7 30g Sample',     'Sample',  0.03,   600)
ON CONFLICT (sku_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Insert current stock levels from Inventory Overview CSV
--    Requires warehouse_id lookups
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  jp_wh uuid;
  us_wh uuid;
BEGIN
  SELECT warehouse_id INTO jp_wh FROM warehouse_locations WHERE short_code = 'JP';
  SELECT warehouse_id INTO us_wh FROM warehouse_locations WHERE short_code = 'US';

  -- JP Warehouse levels
  INSERT INTO inventory_levels (sku_id, warehouse_id, quantity, in_transit_qty)
  SELECT s.sku_id, jp_wh, v.qty, 0
  FROM (VALUES
    ('SC-3_1kg',  0), ('SC-3_30g',  0), ('SC-4_1kg',  0), ('SC-4_30g',  0),
    ('SC-5_1kg',  0), ('SC-5_30g',  0), ('SC-6_1kg',  0), ('SC-6_30g',  0),
    ('SC-3_RedCans', 0), ('OC-1_50g', 0), ('OC-1_1kg', 0),
    ('OC-1_30g', 9), ('SC-7_30g', 5)
  ) AS v(sku, qty)
  JOIN skus s ON s.sku_name = v.sku
  ON CONFLICT (sku_id, warehouse_id) DO UPDATE SET quantity = EXCLUDED.quantity;

  -- US Warehouse levels
  INSERT INTO inventory_levels (sku_id, warehouse_id, quantity, in_transit_qty)
  SELECT s.sku_id, us_wh, v.qty, v.transit
  FROM (VALUES
    ('SC-3_1kg',  0, 0), ('SC-3_30g', 21, 0), ('SC-4_1kg',  0, 0), ('SC-4_30g',  9, 0),
    ('SC-5_1kg',  0, 0), ('SC-5_30g', 34, 0), ('SC-6_1kg',  0, 0), ('SC-6_30g', 29, 0),
    ('SC-3_RedCans', 0, 0), ('OC-1_50g', 0, 0), ('OC-1_1kg', 0, 0),
    ('OC-1_30g',  0, 0), ('SC-7_30g',  0, 0)
  ) AS v(sku, qty, transit)
  JOIN skus s ON s.sku_name = v.sku
  ON CONFLICT (sku_id, warehouse_id) DO UPDATE SET quantity = EXCLUDED.quantity, in_transit_qty = EXCLUDED.in_transit_qty;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Backfill historical transactions from Inventory Log CSV
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  jp_wh uuid;
  us_wh uuid;
BEGIN
  SELECT warehouse_id INTO jp_wh FROM warehouse_locations WHERE short_code = 'JP';
  SELECT warehouse_id INTO us_wh FROM warehouse_locations WHERE short_code = 'US';

  INSERT INTO inventory_transactions (
    transaction_ref, date_received, date_shipped, item_type, movement_type,
    from_location, to_destination, sku_id, warehouse_affected, qty_change,
    carrier, delivery_status, tracking_dhl, tracking_fedex, tracking_usps, note
  )
  SELECT
    v.ref, v.date_recv, v.date_ship, v.item_type, v.move_type,
    v.from_loc, v.to_loc, s.sku_id, v.wh_id, v.qty,
    v.carrier, v.status, v.t_dhl, v.t_fedex, v.t_usps, v.note
  FROM (VALUES
    -- PO-1: Shinchaen → JP Warehouse (2026-02-02)
    ('PO-1', '2026-02-02'::date, NULL::date, 'Sample', 'inbound_supplier_jp', 'Shinchaen', 'JP Warehouse', 'SC-5_30g', jp_wh, 40, NULL, 'delivered', NULL, NULL, NULL, NULL),
    ('PO-1', '2026-02-02'::date, NULL, 'Sample', 'inbound_supplier_jp', 'Shinchaen', 'JP Warehouse', 'SC-4_30g', jp_wh, 10, NULL, 'delivered', NULL, NULL, NULL, NULL),
    ('PO-1', '2026-02-02'::date, NULL, 'Sample', 'inbound_supplier_jp', 'Shinchaen', 'JP Warehouse', 'SC-3_30g', jp_wh, 40, NULL, 'delivered', NULL, NULL, NULL, NULL),
    ('PO-1', '2026-02-02'::date, NULL, 'Sample', 'inbound_supplier_jp', 'Shinchaen', 'JP Warehouse', 'SC-6_30g', jp_wh, 40, NULL, 'delivered', NULL, NULL, NULL, NULL),

    -- PO-2: Oigawa Chaen → JP Warehouse (2026-02-02)
    ('PO-2', '2026-02-02'::date, NULL, 'Sample', 'inbound_supplier_jp', 'Oigawa Chaen', 'JP Warehouse', 'OC-1_50g', jp_wh, 1, NULL, 'delivered', NULL, NULL, NULL, NULL),

    -- DIRECT-1: JP → UK Sales Partner (2026-02-03)
    ('DIRECT-1', NULL, '2026-02-03'::date, 'Sample', 'direct_jp_intl_customer', 'JP Warehouse', 'UK Sales Partner', 'SC-6_30g', jp_wh, -10, 'DHL', 'delivered', '1718576123', NULL, NULL, NULL),
    ('DIRECT-1', NULL, '2026-02-03'::date, 'Sample', 'direct_jp_intl_customer', 'JP Warehouse', 'UK Sales Partner', 'SC-3_30g', jp_wh, -10, 'DHL', 'delivered', '1718576123', NULL, NULL, NULL),
    ('DIRECT-1', NULL, '2026-02-03'::date, 'Sample', 'direct_jp_intl_customer', 'JP Warehouse', 'UK Sales Partner', 'OC-1_50g', jp_wh, -1, 'DHL', 'delivered', '1718576123', NULL, NULL, NULL),

    -- DIRECT-2: JP → Series A Coffee (2026-02-03)
    ('DIRECT-2', NULL, '2026-02-03'::date, 'Sample', 'direct_jp_us_customer', 'JP Warehouse', 'Series A Coffee', 'SC-5_30g', jp_wh, -5, 'DHL', 'delivered', '1718578374', NULL, NULL, NULL),
    ('DIRECT-2', NULL, '2026-02-03'::date, 'Sample', 'direct_jp_us_customer', 'JP Warehouse', 'Series A Coffee', 'SC-3_30g', jp_wh, -5, 'DHL', 'delivered', '1718578374', NULL, NULL, NULL),

    -- TR-1-OUT: JP → US Warehouse transfer (2026-02-04)
    ('TR-1-OUT', NULL, '2026-02-04'::date, 'Sample', 'transfer_jp_us_out', 'JP Warehouse', 'US Warehouse', 'SC-5_30g', jp_wh, -34, 'DHL', 'delivered', '2232651750', NULL, NULL, NULL),
    ('TR-1-OUT', NULL, '2026-02-04'::date, 'Sample', 'transfer_jp_us_out', 'JP Warehouse', 'US Warehouse', 'SC-6_30g', jp_wh, -29, 'DHL', 'delivered', '2232651750', NULL, NULL, NULL),
    ('TR-1-OUT', NULL, '2026-02-04'::date, 'Sample', 'transfer_jp_us_out', 'JP Warehouse', 'US Warehouse', 'SC-4_30g', jp_wh, -9, 'DHL', 'delivered', '2232651750', NULL, NULL, NULL),
    ('TR-1-OUT', NULL, '2026-02-04'::date, 'Sample', 'transfer_jp_us_out', 'JP Warehouse', 'US Warehouse', 'SC-3_30g', jp_wh, -24, 'DHL', 'delivered', '2232651750', NULL, NULL, NULL),

    -- TASTING-1: Personal use
    ('TASTING-1', NULL, NULL, 'Sample', 'personal_use', 'JP Warehouse', 'Personal Use', 'SC-3_30g', jp_wh, -1, NULL, NULL, NULL, NULL, NULL, NULL),
    ('TASTING-1', NULL, NULL, 'Sample', 'personal_use', 'JP Warehouse', 'Personal Use', 'SC-4_30g', jp_wh, -1, NULL, NULL, NULL, NULL, NULL, NULL),
    ('TASTING-1', NULL, NULL, 'Sample', 'personal_use', 'JP Warehouse', 'Personal Use', 'SC-5_30g', jp_wh, -1, NULL, NULL, NULL, NULL, NULL, NULL),
    ('TASTING-1', NULL, NULL, 'Sample', 'personal_use', 'JP Warehouse', 'Personal Use', 'SC-6_30g', jp_wh, -1, NULL, NULL, NULL, NULL, NULL, NULL),

    -- PO-3: Oigawa Chaen → JP (OC-1_30g)
    ('PO-3', '2026-02-12'::date, NULL, 'Sample', 'inbound_supplier_jp', 'Oigawa Chaen', 'JP Warehouse', 'OC-1_30g', jp_wh, 30, NULL, 'delivered', NULL, NULL, NULL, NULL),

    -- DIRECT-3: JP → Ikki Matcha, Thailand (2026-02-12)
    ('DIRECT-3', NULL, '2026-02-12'::date, 'Sample', 'direct_jp_intl_customer', 'JP Warehouse', 'Ikki Matcha', 'OC-1_30g', jp_wh, -10, 'FedEx', 'in_transit', NULL, '888713571164', NULL, 'Thailand'),

    -- PO-4: Shinchaen → JP Red Cans (2026-02-13)
    ('PO-4', '2026-02-13'::date, NULL, 'Retail', 'inbound_supplier_jp', 'Shinchaen', 'JP Warehouse', 'SC-3_RedCans', jp_wh, 60, NULL, 'delivered', NULL, NULL, NULL, NULL),

    -- DIRECT-4: JP → Matcha 108, Red Cans (2026-02-13)
    ('DIRECT-4', NULL, '2026-02-13'::date, 'Retail', 'direct_jp_us_customer', 'JP Warehouse', 'Matcha 108', 'SC-3_RedCans', jp_wh, -60, 'FedEx', 'in_transit', NULL, '888749651990', NULL, NULL),

    -- PO-5: Shinchaen → JP SC-7 (2026-02-17)
    ('PO-5', '2026-02-17'::date, NULL, 'Sample', 'inbound_supplier_jp', 'Shinchaen', 'JP Warehouse', 'SC-7_30g', jp_wh, 10, NULL, 'delivered', NULL, NULL, NULL, NULL),

    -- TASTING-2: Personal use SC-7
    ('TASTING-2', NULL, NULL, 'Sample', 'personal_use', 'JP Warehouse', 'Personal Use', 'SC-7_30g', jp_wh, -1, NULL, NULL, NULL, NULL, NULL, NULL),

    -- DIRECT-5: JP → HANIA personal use (2026-02-18)
    ('DIRECT-5', NULL, '2026-02-18'::date, 'Sample', 'direct_jp_intl_customer', 'JP Warehouse', 'Personal Use', 'OC-1_30g', jp_wh, -1, 'FedEx', 'delivered', NULL, '888862991168', NULL, 'HANIA Personal Use'),
    ('DIRECT-5', NULL, '2026-02-18'::date, 'Sample', 'direct_jp_intl_customer', 'JP Warehouse', 'Personal Use', 'SC-7_30g', jp_wh, -1, 'FedEx', 'delivered', NULL, '888862991168', NULL, 'HANIA Personal Use'),

    -- DIRECT-6: JP → UK Sales Partner (2026-02-18)
    ('DIRECT-6', NULL, '2026-02-18'::date, 'Sample', 'direct_jp_intl_customer', 'JP Warehouse', 'UK Sales Partner', 'OC-1_30g', jp_wh, -10, 'FedEx', 'in_transit', NULL, '888862858902', NULL, 'UK'),

    -- DIRECT-7: JP → Bonsai Coffee (2026-02-18)
    ('DIRECT-7', NULL, '2026-02-18'::date, 'Sample', 'direct_jp_us_customer', 'JP Warehouse', 'Bonsai Coffee', 'SC-7_30g', jp_wh, -3, 'FedEx', 'in_transit', NULL, '888862924540', NULL, 'BONSAI'),

    -- TR-1-IN: Transfer received at US Warehouse (2026-02-19)
    ('TR-1-IN', '2026-02-19'::date, NULL, 'Sample', 'transfer_jp_us_in', 'JP Warehouse', 'US Warehouse', 'SC-5_30g', us_wh, 34, NULL, 'delivered', NULL, NULL, NULL, NULL),
    ('TR-1-IN', '2026-02-19'::date, NULL, 'Sample', 'transfer_jp_us_in', 'JP Warehouse', 'US Warehouse', 'SC-6_30g', us_wh, 29, NULL, 'delivered', NULL, NULL, NULL, NULL),
    ('TR-1-IN', '2026-02-19'::date, NULL, 'Sample', 'transfer_jp_us_in', 'JP Warehouse', 'US Warehouse', 'SC-4_30g', us_wh, 9, NULL, 'delivered', NULL, NULL, NULL, NULL),
    ('TR-1-IN', '2026-02-19'::date, NULL, 'Sample', 'transfer_jp_us_in', 'JP Warehouse', 'US Warehouse', 'SC-3_30g', us_wh, 24, NULL, 'delivered', NULL, NULL, NULL, NULL),

    -- US-DIRECT-1: US Warehouse → thedangspot (2026-02-20)
    ('US-DIRECT-1', NULL, '2026-02-20'::date, 'Sample', 'us_local_customer', 'US Warehouse', 'thedangspot', 'SC-3_30g', us_wh, -3, 'USPS', 'delivered', NULL, NULL, '9200190396055711801937', NULL),

    -- DIRECT-8: JP → UK Sales Partner (2026-03-16)
    ('DIRECT-8', NULL, '2026-03-16'::date, 'Sample', 'direct_jp_intl_customer', 'JP Warehouse', 'UK Sales Partner', 'SC-6_30g', jp_wh, -19, 'FedEx', 'in_transit', NULL, NULL, NULL, 'UK sweet sugar matcha')
  ) AS v(ref, date_recv, date_ship, item_type, move_type, from_loc, to_loc, sku_name, wh_id, qty, carrier, status, t_dhl, t_fedex, t_usps, note)
  JOIN skus s ON s.sku_name = v.sku_name;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Seed historical US outbound order (thedangspot, order #1)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  order_uuid uuid := gen_random_uuid();
  sku_sc3 uuid;
  sku_sc5 uuid;
BEGIN
  SELECT sku_id INTO sku_sc3 FROM skus WHERE sku_name = 'SC-3_30g';
  SELECT sku_id INTO sku_sc5 FROM skus WHERE sku_name = 'SC-5_30g';

  INSERT INTO us_outbound_orders (
    order_id, order_number, customer_name, status,
    ship_to_name, ship_to_address, ship_to_city, ship_to_state, ship_to_zip, ship_to_country,
    date_shipped_from_jp, date_received_us, date_shipped,
    carrier, tracking_number, delivery_status,
    shipping_cost_usd, total_item_value_usd, notes
  ) VALUES (
    order_uuid, 'USO-2026-001', 'thedangspot', 'shipped',
    'thedangspot', '1002 Holly Hill Ct', 'Arlington', 'Texas', '76014', 'United States',
    '2026-02-04'::date, '2026-02-19'::date, '2026-02-20'::date,
    'USPS', '9200190396055711801937', 'delivered',
    7.22, 16.20, 'Wants new samples delivered within Feb'
  )
  ON CONFLICT (order_number) DO NOTHING;

  INSERT INTO us_outbound_order_items (order_id, sku_id, sku_name, product_description, quantity, unit_value_usd, subtotal_usd)
  VALUES
    (order_uuid, sku_sc3, 'SC-3_30g', 'SC-3', 3, 2.40, 7.20),
    (order_uuid, sku_sc5, 'SC-5_30g', 'SC-5', 3, 3.00, 9.00);
END $$;

-- ---------------------------------------------------------------------------
-- 5. Verification queries (run separately)
-- ---------------------------------------------------------------------------

-- Check: should return 13 SKUs
SELECT sku_name, product_id, sku_type, unit_weight_kg, unit_cost_jpy
FROM skus ORDER BY sku_name;

-- Check: stock levels per warehouse
SELECT s.sku_name, w.short_code, il.quantity, il.in_transit_qty
FROM inventory_levels il
JOIN skus s ON s.sku_id = il.sku_id
JOIN warehouse_locations w ON w.warehouse_id = il.warehouse_id
ORDER BY s.sku_name, w.short_code;

-- Check: transaction count (should be ~36)
SELECT count(*) AS transaction_count FROM inventory_transactions;

-- Check: US outbound order
SELECT order_number, customer_name, status, total_item_value_usd
FROM us_outbound_orders;
