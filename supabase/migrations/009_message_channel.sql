-- Migration 009: Add channel column to instagram_logs for multi-channel outreach tracking
-- Supports 'instagram_dm' (default, backward-compat) and 'email'

ALTER TABLE instagram_logs ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'instagram_dm';

CREATE INDEX IF NOT EXISTS idx_instagram_logs_channel ON instagram_logs (channel);
CREATE INDEX IF NOT EXISTS idx_instagram_logs_customer_created ON instagram_logs (customer_id, created_at DESC);
