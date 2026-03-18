-- Migration 027: USPS tracking settings
INSERT INTO crm_settings (category, key, value, label)
VALUES
  ('integrations', 'usps_enabled', 'false', 'USPS Tracking Enabled'),
  ('integrations', 'usps_poll_interval_hours', '4', 'USPS Poll Interval (hours)')
ON CONFLICT (key) DO NOTHING;
