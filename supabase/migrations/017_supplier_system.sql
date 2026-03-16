-- =============================================================================
-- Migration 017: Supplier System (仕入れ先管理)
-- Adds supplier management tables, enums, indexes, RLS policies, and seed data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

CREATE TYPE supplier_stage_enum AS ENUM (
  'not_started',       -- 7 - 未着手
  'inquiry_sent',      -- 4 - 問い合わせフォーム連絡済
  'met_at_event',      -- 6 - イベントでご挨拶
  'in_communication',  -- 1 - やりとり中
  'visit_scheduled',   -- 2 - 訪問予定
  'visited',           -- 3 - 訪問済
  'deal_established',  -- 9 - 取引成立
  'ng'                 -- 8 - NG
);

CREATE TYPE supplier_business_type_enum AS ENUM (
  'tea_wholesaler',    -- 製茶問屋
  'farm',              -- 農園
  'broker',            -- ブローカー
  'other'              -- その他
);

CREATE TYPE sample_tracking_status_enum AS ENUM (
  'none',              -- no samples in play
  'waiting',           -- Waiting for Samples
  'received',          -- Samples received, need evaluation
  'evaluated'          -- Samples tested and scored
);

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name        text NOT NULL,
  supplier_name_en     text,
  contact_person       text,
  email                text,
  phone                text,
  address              text,
  city                 text,
  prefecture           text,
  country              text NOT NULL DEFAULT 'Japan',
  website_url          text,
  instagram_url        text,
  stage                supplier_stage_enum NOT NULL DEFAULT 'not_started',
  business_type        supplier_business_type_enum,
  sample_status        sample_tracking_status_enum NOT NULL DEFAULT 'none',
  source               text,
  specialty            text,
  certifications       text[],
  annual_capacity_kg   numeric,
  lead_time_days       integer,
  payment_terms        text,
  memo                 text,
  action_memo          text,
  notes                text,
  assigned_to          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  first_contacted_at   timestamptz,
  last_contacted_at    timestamptz,
  date_updated         date,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_communications (
  comm_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id          uuid NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
  channel              text NOT NULL DEFAULT 'phone',
  direction            text NOT NULL DEFAULT 'outbound',
  subject              text,
  message_body         text,
  notes                text,
  created_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_products (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id          uuid NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
  product_id           text REFERENCES products(product_id) ON DELETE SET NULL,
  product_name_jpn     text,
  cost_per_kg_jpy      numeric CHECK (cost_per_kg_jpy >= 0),
  moq_kg               numeric,
  is_primary           boolean DEFAULT false,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_message_templates (
  template_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name        text NOT NULL,
  channel              text NOT NULL DEFAULT 'inquiry_form',
  message_body         text NOT NULL,
  is_default           boolean DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_suppliers_stage ON suppliers(stage);
CREATE INDEX IF NOT EXISTS idx_suppliers_prefecture ON suppliers(prefecture);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_type ON suppliers(business_type);
CREATE INDEX IF NOT EXISTS idx_suppliers_sample_status ON suppliers(sample_status);
CREATE INDEX IF NOT EXISTS idx_suppliers_assigned_to ON suppliers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON suppliers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_comms_supplier_id ON supplier_communications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_comms_created_at ON supplier_communications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product_id ON supplier_products(product_id);

-- ---------------------------------------------------------------------------
-- 4. Triggers (reuse existing set_updated_at function)
-- ---------------------------------------------------------------------------

CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_supplier_templates_updated_at
  BEFORE UPDATE ON supplier_message_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS Policies
-- ---------------------------------------------------------------------------

-- suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select" ON suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "suppliers_insert" ON suppliers
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "suppliers_update" ON suppliers
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'))
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "suppliers_delete" ON suppliers
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- supplier_communications
ALTER TABLE supplier_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_comms_select" ON supplier_communications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "supplier_comms_insert" ON supplier_communications
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "supplier_comms_update" ON supplier_communications
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'))
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "supplier_comms_delete" ON supplier_communications
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- supplier_products
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_products_select" ON supplier_products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "supplier_products_insert" ON supplier_products
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "supplier_products_update" ON supplier_products
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'))
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "supplier_products_delete" ON supplier_products
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'));

-- supplier_message_templates
ALTER TABLE supplier_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_templates_select" ON supplier_message_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "supplier_templates_insert" ON supplier_message_templates
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "supplier_templates_update" ON supplier_message_templates
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'closer'))
  WITH CHECK (get_my_role() IN ('admin', 'closer'));

CREATE POLICY "supplier_templates_delete" ON supplier_message_templates
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 6. ALTER products table — add primary_supplier_id FK
-- ---------------------------------------------------------------------------

ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_supplier_id uuid REFERENCES suppliers(supplier_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_primary_supplier ON products(primary_supplier_id);

-- ---------------------------------------------------------------------------
-- 7. Seed default message template
-- ---------------------------------------------------------------------------

INSERT INTO supplier_message_templates (template_name, channel, message_body, is_default)
VALUES (
  '問い合わせフォーム用',
  'inquiry_form',
  'お世話になっております。
株式会社ユタカの遠藤と申します。

海外向けに、日本産抹茶の卸・輸出事業に携わっております。
この度、日本中での高品質な抹茶を探していたところ、貴社のウェブサイトに辿り着きました。

貴社の御抹茶つきまして、ぜひ一度対面にてお話の機会を頂戴できればと存じ、ご連絡差し上げました。
こちらから日時をご提案してしまう形で恐縮ではございますが、今月にもしお時間があれば、ご挨拶にお伺いさせていただくことは可能でしょうか。

ご多用のところ大変恐縮ではございますが、ご検討いただけますと大変幸いです。

何卒よろしくお願い申し上げます。

株式会社ユタカ
遠藤',
  true
);
