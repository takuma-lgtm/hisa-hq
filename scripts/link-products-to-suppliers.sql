-- =============================================================================
-- Link Existing Products to Suppliers + Cleanup
-- Run in Supabase SQL Editor (requires service role)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Delete seed products (PROD-001, PROD-002, PROD-003)
--    These are placeholder products from seed.sql, not real inventory.
--    WARNING: Destructive — only run manually after verifying these are seed data.
-- ---------------------------------------------------------------------------
DELETE FROM products WHERE product_id IN ('PROD-001', 'PROD-002', 'PROD-003');

-- ---------------------------------------------------------------------------
-- 2. Create 4 suppliers (2 existing in business, 2 new)
--    All set to deal_established since we already work with them.
-- ---------------------------------------------------------------------------

-- Oigawa Chaen (大井川茶園) — OC-1, Machine Mill, TENCHA 1
INSERT INTO suppliers (supplier_id, supplier_name, supplier_name_en, stage, business_type, converted_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '大井川茶園',
  'Oigawa Chaen',
  'deal_established',
  'tea_wholesaler',
  now()
)
ON CONFLICT (supplier_id) DO NOTHING;

-- Yamacho Suzuki Choju (山長鈴木長十) — SZ-1 through SZ-7
INSERT INTO suppliers (supplier_id, supplier_name, supplier_name_en, stage, business_type, converted_at)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  '山長鈴木長十',
  'Yamacho Suzuki Choju',
  'deal_established',
  'tea_wholesaler',
  now()
)
ON CONFLICT (supplier_id) DO NOTHING;

-- Matsuda Shoten (松田商店) — SC-3 through SC-9
INSERT INTO suppliers (supplier_id, supplier_name, supplier_name_en, stage, business_type, converted_at)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  '松田商店',
  'Matsuda Shoten',
  'deal_established',
  'tea_wholesaler',
  now()
)
ON CONFLICT (supplier_id) DO NOTHING;

-- Tsuboichi Seicha (壷市製茶) — TS-1
INSERT INTO suppliers (supplier_id, supplier_name, supplier_name_en, stage, business_type, converted_at)
VALUES (
  'a0000000-0000-0000-0000-000000000004',
  '壷市製茶',
  'Tsuboichi Seicha',
  'deal_established',
  'tea_wholesaler',
  now()
)
ON CONFLICT (supplier_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Link products → suppliers
--    For each: set primary_supplier_id, update supplier text, create supplier_products row
-- ---------------------------------------------------------------------------

-- ---- Oigawa Chaen: OC-1, Machine Mill, TENCHA 1 ----
UPDATE products
SET primary_supplier_id = 'a0000000-0000-0000-0000-000000000001',
    supplier = 'Oigawa Chaen'
WHERE product_id IN ('OC-1', 'Machine Mill', 'TENCHA 1');

INSERT INTO supplier_products (supplier_id, product_id, is_primary)
SELECT 'a0000000-0000-0000-0000-000000000001', product_id, true
FROM products
WHERE product_id IN ('OC-1', 'Machine Mill', 'TENCHA 1')
ON CONFLICT DO NOTHING;

-- ---- Yamacho Suzuki Choju: SZ-1 through SZ-7 ----
UPDATE products
SET primary_supplier_id = 'a0000000-0000-0000-0000-000000000002',
    supplier = 'Yamacho Suzuki Choju'
WHERE product_id IN ('SZ-1', 'SZ-2', 'SZ-3', 'SZ-4', 'SZ-5', 'SZ-6', 'SZ-7');

INSERT INTO supplier_products (supplier_id, product_id, is_primary)
SELECT 'a0000000-0000-0000-0000-000000000002', product_id, true
FROM products
WHERE product_id IN ('SZ-1', 'SZ-2', 'SZ-3', 'SZ-4', 'SZ-5', 'SZ-6', 'SZ-7')
ON CONFLICT DO NOTHING;

-- ---- Matsuda Shoten: SC-3 through SC-9 ----
UPDATE products
SET primary_supplier_id = 'a0000000-0000-0000-0000-000000000003',
    supplier = 'Matsuda Shoten'
WHERE product_id IN ('SC-3', 'SC-4', 'SC-5', 'SC-6', 'SC-7', 'SC-8', 'SC-9');

INSERT INTO supplier_products (supplier_id, product_id, is_primary)
SELECT 'a0000000-0000-0000-0000-000000000003', product_id, true
FROM products
WHERE product_id IN ('SC-3', 'SC-4', 'SC-5', 'SC-6', 'SC-7', 'SC-8', 'SC-9')
ON CONFLICT DO NOTHING;

-- ---- Tsuboichi Seicha: TS-1 ----
UPDATE products
SET primary_supplier_id = 'a0000000-0000-0000-0000-000000000004',
    supplier = 'Tsuboichi Seicha'
WHERE product_id = 'TS-1';

INSERT INTO supplier_products (supplier_id, product_id, is_primary)
SELECT 'a0000000-0000-0000-0000-000000000004', product_id, true
FROM products
WHERE product_id = 'TS-1'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Verification queries (run separately to check results)
-- ---------------------------------------------------------------------------

-- Check: should return 18 products, all with a supplier
SELECT product_id, supplier, primary_supplier_id
FROM products
WHERE active = true
ORDER BY product_id;

-- Check: should return 4 suppliers
SELECT supplier_id, supplier_name, supplier_name_en, stage
FROM suppliers
ORDER BY supplier_name_en;

-- Check: should return 18 supplier_products links
SELECT sp.supplier_id, s.supplier_name_en, sp.product_id
FROM supplier_products sp
JOIN suppliers s ON s.supplier_id = sp.supplier_id
ORDER BY s.supplier_name_en, sp.product_id;
