-- =============================================================================
-- HISA Matcha CRM — Seed Data
-- =============================================================================
-- HOW TO RUN:
--   1. Open your Supabase project → SQL Editor
--   2. Paste and run this entire script (requires service role / SQL Editor access)
--   3. Each user's temporary password is: HisaMatcha2025!
--      → Have each user reset their password via Supabase Auth → Users → Send Reset
--
-- The handle_new_user() trigger will auto-create a profiles row for each user.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Auth users
-- We insert directly into auth.users (only possible with service role access
-- in the SQL Editor). The trigger creates matching profiles rows automatically.
-- ---------------------------------------------------------------------------

insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) values
  -- Nina — Admin (originally lead_gen, promoted to admin)
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'nina@hisamatcha.com',
    '$2b$10$/BweeX4Zeeqv5St/VcMNLeCJM99GS3X/u4YHwKeKUIMU0O84aEme6',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Nina","role":"admin"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '', '', '', ''
  ),
  -- Tatsumi — Admin (originally closer, promoted to admin)
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'tatsumi@hisamatcha.com',
    '$2b$10$/BweeX4Zeeqv5St/VcMNLeCJM99GS3X/u4YHwKeKUIMU0O84aEme6',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Tatsumi","role":"admin"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '', '', '', ''
  ),
  -- Takuma — Admin / CEO
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'takuma@hisamatcha.com',
    '$2b$10$/BweeX4Zeeqv5St/VcMNLeCJM99GS3X/u4YHwKeKUIMU0O84aEme6',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Takuma","role":"admin"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '', '', '', ''
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Auth identities (required for email/password login to work)
-- ---------------------------------------------------------------------------
insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'nina@hisamatcha.com',
    'email',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"nina@hisamatcha.com","email_verified":true}'::jsonb,
    now(), now(), now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'tatsumi@hisamatcha.com',
    'email',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"tatsumi@hisamatcha.com","email_verified":true}'::jsonb,
    now(), now(), now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '33333333-3333-3333-3333-333333333333',
    'takuma@hisamatcha.com',
    'email',
    '{"sub":"33333333-3333-3333-3333-333333333333","email":"takuma@hisamatcha.com","email_verified":true}'::jsonb,
    now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

-- ---------------------------------------------------------------------------
-- Sample products (representative of a real Google Sheets product master)
-- In production these will be overwritten by the /api/products/sync endpoint.
-- ---------------------------------------------------------------------------
insert into products (
  product_id,
  supplier_product_name,
  customer_facing_product_name,
  price_per_kg,
  gross_profit_margin,
  harvest,
  tasting_notes,
  inventory_available,
  active,
  last_synced_at
) values
  (
    'PROD-001',
    'Uji Ceremonial Grade A',
    'HISA Ceremonial Uji',
    180.00,
    0.42,
    'Spring 2024 — Uji, Kyoto',
    'Deep umami, sweet finish, vibrant jade color. No bitterness.',
    50.0,
    true,
    now()
  ),
  (
    'PROD-002',
    'Nishio Premium Culinary',
    'HISA Premium Culinary',
    95.00,
    0.38,
    'Spring 2024 — Nishio, Aichi',
    'Bright vegetal notes, mild bitterness, excellent for lattes.',
    120.0,
    true,
    now()
  ),
  (
    'PROD-003',
    'Kagoshima Everyday Blend',
    'HISA Everyday',
    60.00,
    0.35,
    'Autumn 2023 — Kagoshima',
    'Earthy, robust. Ideal for high-volume matcha latte programs.',
    200.0,
    true,
    now()
  )
on conflict (product_id) do update set
  supplier_product_name        = excluded.supplier_product_name,
  customer_facing_product_name = excluded.customer_facing_product_name,
  price_per_kg                 = excluded.price_per_kg,
  gross_profit_margin          = excluded.gross_profit_margin,
  harvest                      = excluded.harvest,
  tasting_notes                = excluded.tasting_notes,
  inventory_available          = excluded.inventory_available,
  active                       = excluded.active,
  last_synced_at               = excluded.last_synced_at;

-- ---------------------------------------------------------------------------
-- Sample customers (realistic cafe leads at different pipeline stages)
-- ---------------------------------------------------------------------------
insert into customers (
  customer_id,
  cafe_name,
  instagram_handle,
  email,
  phone,
  city,
  state,
  country,
  contact_person,
  cafe_type,
  monthly_matcha_usage_kg,
  budget_range,
  status
) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Bloom Coffee & Matcha',
    '@bloomcoffeenyc',
    'hello@bloomcoffeenyc.com',
    '+1 212 555 0101',
    'New York',
    'NY',
    'USA',
    'Sarah Kim',
    'matcha_focused',
    8.0,
    '$600–$1,200/mo',
    'qualified_opportunity'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Third Wave Espresso',
    '@thirdwaveespresso',
    'info@thirdwaveespresso.com',
    '+1 323 555 0204',
    'Los Angeles',
    'CA',
    'USA',
    'James Park',
    'coffee_shop',
    3.0,
    '$200–$400/mo',
    'lead'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Cha House Melbourne',
    '@chahousemelbourne',
    'orders@chahouse.com.au',
    '+61 3 9555 0321',
    'Melbourne',
    'VIC',
    'Australia',
    'Lily Nguyen',
    'already_serving_matcha',
    15.0,
    '$1,000–$2,000/mo',
    'recurring_customer'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Minto Café',
    '@mintocafe',
    'hello@mintocafe.ca',
    '+1 604 555 0417',
    'Vancouver',
    'BC',
    'Canada',
    'Kenji Watanabe',
    'new_to_matcha',
    null,
    null,
    'lead'
  )
on conflict (customer_id) do nothing;

-- ---------------------------------------------------------------------------
-- Sample opportunities (one per customer, at representative stages)
-- ---------------------------------------------------------------------------
insert into opportunities (
  opportunity_id,
  customer_id,
  stage,
  assigned_to,
  product_match_possible,
  casual_price_shared,
  product_guide_shared,
  notes
) values
  (
    '00000001-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'samples_shipped',
    '22222222-2222-2222-2222-222222222222', -- Tatsumi
    true,
    true,
    true,
    'Interested in Ceremonial and Premium Culinary. Owner confirmed $800/mo budget. Sample sent via FedEx.'
  ),
  (
    '00000002-0000-0000-0000-000000000002',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'outreach_sent',
    null,
    false,
    false,
    false,
    'Initial DM sent via Instagram. No reply yet.'
  ),
  (
    '00000003-0000-0000-0000-000000000003',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'deal_won',
    '22222222-2222-2222-2222-222222222222', -- Tatsumi
    true,
    true,
    true,
    'Long-term customer. Ordering 15kg/mo of Premium Culinary. Auto-renews monthly.'
  ),
  (
    '00000004-0000-0000-0000-000000000004',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'lead_created',
    null,
    false,
    false,
    false,
    'Brand new lead from Instagram scrape. Never served matcha before — good education opportunity.'
  )
on conflict (opportunity_id) do nothing;

-- ---------------------------------------------------------------------------
-- Sample instagram logs (for Bloom Coffee lead)
-- ---------------------------------------------------------------------------
insert into instagram_logs (
  customer_id,
  message_sent,
  reply_received,
  status,
  notes
) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Hi Sarah! Love what you''re doing at Bloom. We source ceremonial-grade Uji matcha — would you be open to a tasting sample?',
    'Hey! Yes absolutely, we''ve been looking for a new matcha supplier. Send me more info!',
    'interested',
    'Very warm reply. Moved to email follow-up.'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Hi James! We noticed Third Wave has a great coffee program — have you considered adding a matcha option? Happy to send a complimentary sample.',
    null,
    'no_response',
    'Sent Mon. Will follow up Friday if no reply.'
  );

-- ---------------------------------------------------------------------------
-- Sample batch (for Bloom Coffee — sample sent to closer-assigned opp)
-- ---------------------------------------------------------------------------
insert into sample_batches (
  batch_id,
  opportunity_id,
  customer_id,
  products_sent,
  date_shipped,
  tracking_number,
  carrier,
  delivery_status,
  result
) values
  (
    '00000b01-0000-0000-0000-000000000001',
    '00000001-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '[
      {"product_id":"PROD-001","customer_facing_name":"HISA Ceremonial Uji","qty_g":100},
      {"product_id":"PROD-002","customer_facing_name":"HISA Premium Culinary","qty_g":200}
    ]'::jsonb,
    current_date - interval '5 days',
    '123456789012',
    'FedEx',
    'In Transit',
    'pending'
  )
on conflict (batch_id) do nothing;

-- ---------------------------------------------------------------------------
-- Sample recurring order (for Cha House Melbourne — Won customer)
-- ---------------------------------------------------------------------------
insert into recurring_orders (
  order_id,
  customer_id,
  assigned_closer,
  line_items,
  total_amount,
  status,
  monthly_volume,
  notes
) values
  (
    '00000c01-0000-0000-0000-000000000001',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '22222222-2222-2222-2222-222222222222', -- Tatsumi
    '[{"product_id":"PROD-002","name":"HISA Premium Culinary","qty_kg":15,"price_per_kg":95}]'::jsonb,
    1425.00,
    'paid',
    15.0,
    'Monthly standing order. Invoiced on the 1st.'
  )
on conflict (order_id) do nothing;
