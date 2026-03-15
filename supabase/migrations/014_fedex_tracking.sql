-- Migration 014: FedEx tracking + draft messages
-- Adds auto-tracking columns to sample_batches, creates draft_messages table,
-- and seeds FedEx-related CRM settings.

-- ---------------------------------------------------------------------------
-- 1. Extend sample_batches with tracking columns
-- ---------------------------------------------------------------------------

ALTER TABLE sample_batches ADD COLUMN IF NOT EXISTS tracking_url text;
ALTER TABLE sample_batches ADD COLUMN IF NOT EXISTS carrier_status text;
ALTER TABLE sample_batches ADD COLUMN IF NOT EXISTS carrier_status_detail text;
ALTER TABLE sample_batches ADD COLUMN IF NOT EXISTS estimated_delivery date;
ALTER TABLE sample_batches ADD COLUMN IF NOT EXISTS last_tracked_at timestamptz;
ALTER TABLE sample_batches ADD COLUMN IF NOT EXISTS auto_track_enabled boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 2. Create draft_messages table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS draft_messages (
  draft_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  opportunity_id  uuid REFERENCES opportunities(opportunity_id) ON DELETE SET NULL,
  batch_id        uuid REFERENCES sample_batches(batch_id) ON DELETE SET NULL,
  trigger_event   text NOT NULL,
  channel         text NOT NULL DEFAULT 'instagram_dm',
  message_text    text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  dismissed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_draft_messages_status ON draft_messages(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_draft_messages_customer ON draft_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_draft_messages_opportunity ON draft_messages(opportunity_id);

-- ---------------------------------------------------------------------------
-- 3. RLS for draft_messages
-- ---------------------------------------------------------------------------

ALTER TABLE draft_messages ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read drafts
CREATE POLICY "draft_messages_select" ON draft_messages
  FOR SELECT TO authenticated USING (true);

-- Admin and closer can insert
CREATE POLICY "draft_messages_insert" ON draft_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'closer')
    )
  );

-- Admin and closer can update
CREATE POLICY "draft_messages_update" ON draft_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'closer')
    )
  );

-- Admin only can delete
CREATE POLICY "draft_messages_delete" ON draft_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Seed FedEx integration settings
-- ---------------------------------------------------------------------------

INSERT INTO crm_settings (key, value, label, category) VALUES
  ('fedex_enabled', 'false', 'FedEx Tracking Enabled', 'integrations'),
  ('tracking_poll_interval_hours', '2', 'Tracking Poll Interval (hours)', 'integrations')
ON CONFLICT (key) DO NOTHING;
