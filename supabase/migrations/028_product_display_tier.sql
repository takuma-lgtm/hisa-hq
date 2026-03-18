-- Add display_tier column to products for the proposal builder carousel
-- Values: 'premium' (Edge/Ceremonial), 'versatile' (All-purpose), 'budget' (Budget-friendly)
-- Products with no tier assigned will not appear in the carousel

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS display_tier text
  CHECK (display_tier IN ('premium', 'versatile', 'budget'));

CREATE INDEX IF NOT EXISTS idx_products_display_tier ON products(display_tier);
