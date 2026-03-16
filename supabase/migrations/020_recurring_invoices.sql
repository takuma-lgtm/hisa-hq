-- Migration 020: Recurring invoices + split payments
-- Allows invoices without an opportunity (for recurring orders),
-- adds split payment support, and links invoices to recurring orders.

-- ---------------------------------------------------------------------------
-- 1. Allow invoices without an opportunity (for recurring orders)
-- ---------------------------------------------------------------------------
ALTER TABLE invoices ALTER COLUMN opportunity_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Link invoices to recurring orders + split payment columns
-- ---------------------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_order_id UUID REFERENCES recurring_orders(order_id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_split_label TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_group_id UUID;

-- ---------------------------------------------------------------------------
-- 3. Add currency to recurring_orders
-- ---------------------------------------------------------------------------
ALTER TABLE recurring_orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_recurring_order ON invoices(recurring_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_group ON invoices(payment_group_id);
