-- Migration 019: Daily Briefs
-- Stores generated daily operational summaries with a unique token for public URL access.

CREATE TABLE IF NOT EXISTS daily_briefs (
  brief_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token           text NOT NULL UNIQUE,
  brief_data      jsonb NOT NULL,
  brief_html      text NOT NULL,
  brief_text      text NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  supplier_notes  text,
  posted_to_chat  boolean NOT NULL DEFAULT false,
  posted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_token ON daily_briefs(token);
CREATE INDEX IF NOT EXISTS idx_daily_briefs_generated ON daily_briefs(generated_at DESC);

ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;
