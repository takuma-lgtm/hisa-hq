-- 024: Update RLS policies for simplified role system
-- Old roles: admin, closer, lead_gen
-- New roles: owner, admin, member
--
-- Role mapping:
--   owner  = full access (was: admin)       — Takuma
--   admin  = full access (was: admin)       — Tatsumi (unchanged)
--   member = limited access (was: lead_gen) — Nina
--
-- Permission mapping:
--   ('admin', 'closer', 'lead_gen') → ('owner', 'admin', 'member')
--   ('admin', 'closer')             → ('owner', 'admin')
--   ('admin', 'lead_gen')           → ('owner', 'admin', 'member')
--   'admin' only                    → ('owner', 'admin')

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles: read own or admin reads all" ON profiles;

CREATE POLICY "profiles: read own or admin reads all"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR get_my_role() IN ('owner', 'admin'));

-- (profiles: update own — no role check, unchanged)

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "customers: all roles can select" ON customers;
DROP POLICY IF EXISTS "customers: lead_gen and admin can insert" ON customers;
DROP POLICY IF EXISTS "customers: all roles can update" ON customers;
DROP POLICY IF EXISTS "customers: admin only delete" ON customers;

CREATE POLICY "customers: all roles can select"
  ON customers FOR SELECT
  USING (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "customers: member and admin can insert"
  ON customers FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "customers: all roles can update"
  ON customers FOR UPDATE
  USING (get_my_role() IN ('owner', 'admin', 'member'))
  WITH CHECK (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "customers: admin only delete"
  ON customers FOR DELETE
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "opportunities: all roles can select" ON opportunities;
DROP POLICY IF EXISTS "opportunities: lead_gen and admin can insert" ON opportunities;
DROP POLICY IF EXISTS "opportunities: all roles can update" ON opportunities;
DROP POLICY IF EXISTS "opportunities: admin only delete" ON opportunities;

CREATE POLICY "opportunities: all roles can select"
  ON opportunities FOR SELECT
  USING (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "opportunities: member and admin can insert"
  ON opportunities FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "opportunities: all roles can update"
  ON opportunities FOR UPDATE
  USING (get_my_role() IN ('owner', 'admin', 'member'))
  WITH CHECK (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "opportunities: admin only delete"
  ON opportunities FOR DELETE
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- instagram_logs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "instagram_logs: all roles can select" ON instagram_logs;
DROP POLICY IF EXISTS "instagram_logs: lead_gen and admin can insert" ON instagram_logs;
DROP POLICY IF EXISTS "instagram_logs: lead_gen and admin can update" ON instagram_logs;
DROP POLICY IF EXISTS "instagram_logs: admin only delete" ON instagram_logs;

CREATE POLICY "instagram_logs: all roles can select"
  ON instagram_logs FOR SELECT
  USING (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "instagram_logs: member and admin can insert"
  ON instagram_logs FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "instagram_logs: member and admin can update"
  ON instagram_logs FOR UPDATE
  USING (get_my_role() IN ('owner', 'admin', 'member'))
  WITH CHECK (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "instagram_logs: admin only delete"
  ON instagram_logs FOR DELETE
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- sample_batches
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "sample_batches: all roles can select" ON sample_batches;
DROP POLICY IF EXISTS "sample_batches: closer and admin can insert" ON sample_batches;
DROP POLICY IF EXISTS "sample_batches: closer and admin can update" ON sample_batches;
DROP POLICY IF EXISTS "sample_batches: admin only delete" ON sample_batches;

CREATE POLICY "sample_batches: all roles can select"
  ON sample_batches FOR SELECT
  USING (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "sample_batches: admin can insert"
  ON sample_batches FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "sample_batches: admin can update"
  ON sample_batches FOR UPDATE
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "sample_batches: admin only delete"
  ON sample_batches FOR DELETE
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "products: all roles can select" ON products;
DROP POLICY IF EXISTS "products: admin only insert" ON products;
DROP POLICY IF EXISTS "products: admin only update" ON products;
DROP POLICY IF EXISTS "products: admin only delete" ON products;

CREATE POLICY "products: all roles can select"
  ON products FOR SELECT
  USING (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "products: admin only insert"
  ON products FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "products: admin only update"
  ON products FOR UPDATE
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "products: admin only delete"
  ON products FOR DELETE
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- quotations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "quotations: closer and admin can select" ON quotations;
DROP POLICY IF EXISTS "quotations: closer and admin can insert" ON quotations;
DROP POLICY IF EXISTS "quotations: closer and admin can update" ON quotations;
DROP POLICY IF EXISTS "quotations: admin only delete" ON quotations;

CREATE POLICY "quotations: admin can select"
  ON quotations FOR SELECT
  USING (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "quotations: admin can insert"
  ON quotations FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "quotations: admin can update"
  ON quotations FOR UPDATE
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "quotations: admin only delete"
  ON quotations FOR DELETE
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "invoices: closer and admin can select" ON invoices;
DROP POLICY IF EXISTS "invoices: admin only insert" ON invoices;
DROP POLICY IF EXISTS "invoices: admin only update" ON invoices;
DROP POLICY IF EXISTS "invoices: admin only delete" ON invoices;

CREATE POLICY "invoices: admin can select"
  ON invoices FOR SELECT
  USING (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "invoices: admin only insert"
  ON invoices FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "invoices: admin only update"
  ON invoices FOR UPDATE
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "invoices: admin only delete"
  ON invoices FOR DELETE
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- recurring_orders
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "recurring_orders: closer and admin can select" ON recurring_orders;
DROP POLICY IF EXISTS "recurring_orders: closer and admin can insert" ON recurring_orders;
DROP POLICY IF EXISTS "recurring_orders: closer and admin can update" ON recurring_orders;
DROP POLICY IF EXISTS "recurring_orders: admin only delete" ON recurring_orders;

CREATE POLICY "recurring_orders: admin can select"
  ON recurring_orders FOR SELECT
  USING (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "recurring_orders: admin can insert"
  ON recurring_orders FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "recurring_orders: admin can update"
  ON recurring_orders FOR UPDATE
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "recurring_orders: admin only delete"
  ON recurring_orders FOR DELETE
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications: read own or admin reads all" ON notifications;
DROP POLICY IF EXISTS "notifications: update own (mark as read)" ON notifications;
DROP POLICY IF EXISTS "notifications: admin only delete" ON notifications;

CREATE POLICY "notifications: read own or admin reads all"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() OR get_my_role() IN ('owner', 'admin'));

CREATE POLICY "notifications: update own (mark as read)"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid() OR get_my_role() IN ('owner', 'admin'))
  WITH CHECK (user_id = auth.uid() OR get_my_role() IN ('owner', 'admin'));

CREATE POLICY "notifications: admin only delete"
  ON notifications FOR DELETE
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- suppliers (migration 017)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;

CREATE POLICY "suppliers_insert" ON suppliers
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "suppliers_update" ON suppliers
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "suppliers_delete" ON suppliers
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- supplier_communications (migration 017)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "supplier_comms_insert" ON supplier_communications;
DROP POLICY IF EXISTS "supplier_comms_update" ON supplier_communications;
DROP POLICY IF EXISTS "supplier_comms_delete" ON supplier_communications;

CREATE POLICY "supplier_comms_insert" ON supplier_communications
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "supplier_comms_update" ON supplier_communications
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "supplier_comms_delete" ON supplier_communications
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- supplier_products (migration 017)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "supplier_products_insert" ON supplier_products;
DROP POLICY IF EXISTS "supplier_products_update" ON supplier_products;
DROP POLICY IF EXISTS "supplier_products_delete" ON supplier_products;

CREATE POLICY "supplier_products_insert" ON supplier_products
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "supplier_products_update" ON supplier_products
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "supplier_products_delete" ON supplier_products
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- supplier_message_templates (migration 017)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "supplier_templates_insert" ON supplier_message_templates;
DROP POLICY IF EXISTS "supplier_templates_update" ON supplier_message_templates;
DROP POLICY IF EXISTS "supplier_templates_delete" ON supplier_message_templates;

CREATE POLICY "supplier_templates_insert" ON supplier_message_templates
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "supplier_templates_update" ON supplier_message_templates
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "supplier_templates_delete" ON supplier_message_templates
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- supplier_purchase_orders (migration 018)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "spo_insert" ON supplier_purchase_orders;
DROP POLICY IF EXISTS "spo_update" ON supplier_purchase_orders;
DROP POLICY IF EXISTS "spo_delete" ON supplier_purchase_orders;

CREATE POLICY "spo_insert" ON supplier_purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "spo_update" ON supplier_purchase_orders
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "spo_delete" ON supplier_purchase_orders
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- supplier_purchase_order_items (migration 018)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "spo_items_insert" ON supplier_purchase_order_items;
DROP POLICY IF EXISTS "spo_items_update" ON supplier_purchase_order_items;
DROP POLICY IF EXISTS "spo_items_delete" ON supplier_purchase_order_items;

CREATE POLICY "spo_items_insert" ON supplier_purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "spo_items_update" ON supplier_purchase_order_items
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "spo_items_delete" ON supplier_purchase_order_items
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- us_outbound_orders (migration 021)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "uso_insert" ON us_outbound_orders;
DROP POLICY IF EXISTS "uso_update" ON us_outbound_orders;
DROP POLICY IF EXISTS "uso_delete" ON us_outbound_orders;

CREATE POLICY "uso_insert" ON us_outbound_orders
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "uso_update" ON us_outbound_orders
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "uso_delete" ON us_outbound_orders
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- us_outbound_order_items (migration 021)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "uso_items_insert" ON us_outbound_order_items;
DROP POLICY IF EXISTS "uso_items_update" ON us_outbound_order_items;
DROP POLICY IF EXISTS "uso_items_delete" ON us_outbound_order_items;

CREATE POLICY "uso_items_insert" ON us_outbound_order_items
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "uso_items_update" ON us_outbound_order_items
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'))
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

CREATE POLICY "uso_items_delete" ON us_outbound_order_items
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- discovery_runs (migration 022)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "discovery_runs_insert" ON discovery_runs;
DROP POLICY IF EXISTS "discovery_runs_update" ON discovery_runs;

CREATE POLICY "discovery_runs_insert" ON discovery_runs
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "discovery_runs_update" ON discovery_runs
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('owner', 'admin', 'member'))
  WITH CHECK (get_my_role() IN ('owner', 'admin', 'member'));

-- ---------------------------------------------------------------------------
-- discovered_prospects (migration 022)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "discovered_prospects_insert" ON discovered_prospects;
DROP POLICY IF EXISTS "discovered_prospects_update" ON discovered_prospects;

CREATE POLICY "discovered_prospects_insert" ON discovered_prospects
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'admin', 'member'));

CREATE POLICY "discovered_prospects_update" ON discovered_prospects
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('owner', 'admin', 'member'))
  WITH CHECK (get_my_role() IN ('owner', 'admin', 'member'));
