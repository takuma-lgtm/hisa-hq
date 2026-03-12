-- =============================================================================
-- HISA Matcha CRM — Schema V2
-- Fixes pipeline stage enum values, adds new enums, expands existing tables,
-- and creates call_logs, opportunity_proposals, opportunity_proposal_items,
-- and sample_batch_items tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fix opportunity_stage_enum
-- Rename existing values to match the actual 14-stage sales process.
-- NOTE: ALTER TYPE ... RENAME VALUE requires each statement outside a
-- transaction that also includes ADD VALUE. Run renames first, then adds.
-- ---------------------------------------------------------------------------

ALTER TYPE opportunity_stage_enum RENAME VALUE 'contacted'          TO 'outreach_sent';
ALTER TYPE opportunity_stage_enum RENAME VALUE 'replied'            TO 'cafe_replied';
ALTER TYPE opportunity_stage_enum RENAME VALUE 'qualified'          TO 'get_info';
ALTER TYPE opportunity_stage_enum RENAME VALUE 'assigned_to_closer' TO 'product_guide_sent';
ALTER TYPE opportunity_stage_enum RENAME VALUE 'sample_sent'        TO 'samples_shipped';
ALTER TYPE opportunity_stage_enum RENAME VALUE 'sample_delivered'   TO 'samples_delivered';
ALTER TYPE opportunity_stage_enum RENAME VALUE 'won'                TO 'deal_won';
ALTER TYPE opportunity_stage_enum RENAME VALUE 'payment_pending'    TO 'payment_received';

-- Add new stage values.
-- ADD VALUE cannot run inside a transaction block in Postgres <14;
-- each statement is auto-committed.
ALTER TYPE opportunity_stage_enum ADD VALUE IF NOT EXISTS 'sample_approved'    AFTER 'product_guide_sent';
ALTER TYPE opportunity_stage_enum ADD VALUE IF NOT EXISTS 'collect_feedback'   AFTER 'quote_sent';
ALTER TYPE opportunity_stage_enum ADD VALUE IF NOT EXISTS 'first_order'        AFTER 'payment_received';
ALTER TYPE opportunity_stage_enum ADD VALUE IF NOT EXISTS 'recurring_customer' AFTER 'first_order';
ALTER TYPE opportunity_stage_enum ADD VALUE IF NOT EXISTS 'disqualified'       AFTER 'lost';

-- Legacy values kept for backward compat but hidden from PIPELINE_STAGES const:
--   quote_accepted, internal_review_pending, invoice_sent

-- ---------------------------------------------------------------------------
-- 2. New enums
-- ---------------------------------------------------------------------------

create type call_type_enum as enum (
  'discovery',
  'pre_sample',
  'post_delivery',
  'negotiation',
  'general'
);

create type call_outcome_enum as enum (
  'not_interested',
  'follow_up',
  'samples_approved',
  'deal_closed',
  'other'
);

create type sample_feedback_enum as enum (
  'liked',
  'neutral',
  'disliked',
  'pending'
);

create type cafe_segment_enum as enum (
  'coffee_shop',
  'matcha_specialist',
  'mixed',
  'other'
);

create type matcha_experience_enum as enum (
  'new_to_matcha',
  'already_uses_matcha'
);

-- ---------------------------------------------------------------------------
-- 3. Expand customers table
-- ---------------------------------------------------------------------------

-- Contact basics (zip was missing)
alter table customers add column if not exists zip_code text;

-- Demand fields (handoff-required)
alter table customers add column if not exists budget_delivered_price_per_kg numeric
  check (budget_delivered_price_per_kg >= 0);
alter table customers add column if not exists budget_currency text not null default 'USD';

-- Lead source tracking
alter table customers add column if not exists is_outbound boolean not null default true;
alter table customers add column if not exists lead_source text default 'outbound_scraped';
  -- values: outbound_scraped | inbound_website | referral | other

-- Cafe segment (two separate dimensions; old cafe_type kept for compat)
alter table customers add column if not exists cafe_segment cafe_segment_enum;
alter table customers add column if not exists matcha_experience matcha_experience_enum;

-- Market intelligence (structured)
alter table customers add column if not exists current_supplier text;
alter table customers add column if not exists current_supplier_unknown boolean not null default false;
alter table customers add column if not exists current_delivered_price_per_kg numeric;
alter table customers add column if not exists current_price_unknown boolean not null default false;
alter table customers add column if not exists likes_about_current text;
alter table customers add column if not exists dislikes_about_current text;
alter table customers add column if not exists why_switch text;
alter table customers add column if not exists definition_of_good_matcha text;
alter table customers add column if not exists market_intel_notes text;

-- ---------------------------------------------------------------------------
-- 4. Expand opportunities table
-- ---------------------------------------------------------------------------

alter table opportunities add column if not exists lead_source text;
alter table opportunities add column if not exists handoff_at timestamptz;
alter table opportunities add column if not exists handoff_to uuid references profiles (id) on delete set null;
alter table opportunities add column if not exists disqualified_at timestamptz;
alter table opportunities add column if not exists disqualified_reason text;

create index if not exists opportunities_handoff_to_idx on opportunities (handoff_to) where handoff_to is not null;

-- ---------------------------------------------------------------------------
-- 5. Expand products table
-- ---------------------------------------------------------------------------

alter table products add column if not exists supplier text;
alter table products add column if not exists product_type text;
alter table products add column if not exists landing_cost_per_kg_usd numeric check (landing_cost_per_kg_usd >= 0);
alter table products add column if not exists min_selling_price_usd numeric check (min_selling_price_usd >= 0);
alter table products add column if not exists default_selling_price_usd numeric check (default_selling_price_usd >= 0);
alter table products add column if not exists monthly_available_stock_kg integer check (monthly_available_stock_kg >= 0);
alter table products add column if not exists product_guide_url text;

-- ---------------------------------------------------------------------------
-- 6. Expand sample_batches table
-- ---------------------------------------------------------------------------

alter table sample_batches add column if not exists ship_from text not null default 'US Warehouse';
-- More precise timestamps alongside existing date columns (kept for compat)
alter table sample_batches add column if not exists shipped_at timestamptz;
alter table sample_batches add column if not exists delivered_at timestamptz;

-- ---------------------------------------------------------------------------
-- 7. New table: call_logs
-- Records every phone/video call. Includes structured market-intel extraction
-- fields that can be applied back to the customer record.
-- ---------------------------------------------------------------------------

create table if not exists call_logs (
  log_id                     uuid primary key default gen_random_uuid(),
  opportunity_id             uuid not null references opportunities (opportunity_id) on delete cascade,
  customer_id                uuid not null references customers (customer_id),
  logged_by                  uuid not null references profiles (id),
  call_type                  call_type_enum not null default 'general',
  called_at                  timestamptz not null default now(),
  duration_minutes           integer check (duration_minutes > 0),
  spoke_with_role            text,   -- owner/manager/bar_manager/staff/other
  spoke_with_name            text,
  outcome                    call_outcome_enum not null default 'follow_up',
  raw_summary                text,
  -- Market intel extracted during call
  ext_current_supplier       text,
  ext_current_price_per_kg   numeric,
  ext_likes                  text,
  ext_dislikes               text,
  ext_why_switch             text,
  ext_definition_good_matcha text,
  ext_additional_notes       text,
  intel_applied              boolean not null default false,
  created_at                 timestamptz not null default now()
);

comment on table call_logs is
  'Structured call records. ext_* fields capture market intel that can be pushed to customers.';

create index if not exists call_logs_opportunity_idx on call_logs (opportunity_id);
create index if not exists call_logs_customer_idx    on call_logs (customer_id);
create index if not exists call_logs_logged_by_idx   on call_logs (logged_by);

-- ---------------------------------------------------------------------------
-- 8. New table: opportunity_proposals
-- Informal price lists sent via text/IG/WhatsApp before formal quotes.
-- ---------------------------------------------------------------------------

create table if not exists opportunity_proposals (
  proposal_id      uuid primary key default gen_random_uuid(),
  opportunity_id   uuid not null references opportunities (opportunity_id) on delete cascade,
  sent_at          timestamptz,
  sent_via         text not null default 'ig',  -- ig/whatsapp/sms/email/other
  notes            text,
  default_currency text not null default 'USD',
  created_by       uuid not null references profiles (id),
  created_at       timestamptz not null default now()
);

comment on table opportunity_proposals is
  'Informal price proposals sent before formal quotes. One proposal can have many product items.';

create index if not exists opp_proposals_opportunity_idx on opportunity_proposals (opportunity_id);

-- ---------------------------------------------------------------------------
-- 9. New table: opportunity_proposal_items
-- Line items for each informal proposal.
-- ---------------------------------------------------------------------------

create table if not exists opportunity_proposal_items (
  item_id      uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references opportunity_proposals (proposal_id) on delete cascade,
  product_id   text not null references products (product_id),
  price_per_kg numeric not null check (price_per_kg >= 0),
  currency     text not null default 'USD',
  notes        text
);

comment on table opportunity_proposal_items is
  'One row per product in an informal proposal. Keyed to products.product_id.';

create index if not exists opp_proposal_items_proposal_idx on opportunity_proposal_items (proposal_id);

-- ---------------------------------------------------------------------------
-- 10. New table: sample_batch_items
-- Normalised row-per-product for sample shipments. Replaces JSONB products_sent
-- for new batches (old batches keep JSONB for compat; migrate lazily).
-- ---------------------------------------------------------------------------

create table if not exists sample_batch_items (
  item_id          uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references sample_batches (batch_id) on delete cascade,
  product_id       text references products (product_id),
  product_snapshot text,   -- snapshot of product name at time of shipping
  qty_grams        integer check (qty_grams > 0),
  feedback         sample_feedback_enum not null default 'pending',
  notes            text
);

comment on table sample_batch_items is
  'One row per product in a sample batch. feedback is captured post-delivery.';

create index if not exists sample_batch_items_batch_idx on sample_batch_items (batch_id);

-- ---------------------------------------------------------------------------
-- 11. RLS for new tables
-- ---------------------------------------------------------------------------

alter table call_logs               enable row level security;
alter table opportunity_proposals   enable row level security;
alter table opportunity_proposal_items enable row level security;
alter table sample_batch_items      enable row level security;

-- call_logs: all roles can read; lead_gen can insert/update own logs; closer and admin can insert/update all
create policy "call_logs: all roles can select"
  on call_logs for select
  using (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "call_logs: insert"
  on call_logs for insert
  with check (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "call_logs: update own or admin/closer update all"
  on call_logs for update
  using (
    logged_by = auth.uid()
    or get_my_role() in ('admin', 'closer')
  )
  with check (
    logged_by = auth.uid()
    or get_my_role() in ('admin', 'closer')
  );

create policy "call_logs: admin only delete"
  on call_logs for delete
  using (get_my_role() = 'admin');

-- opportunity_proposals: all roles can read and write (lead_gen creates them)
create policy "opp_proposals: all roles can select"
  on opportunity_proposals for select
  using (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "opp_proposals: all roles can insert"
  on opportunity_proposals for insert
  with check (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "opp_proposals: all roles can update"
  on opportunity_proposals for update
  using (get_my_role() in ('admin', 'closer', 'lead_gen'))
  with check (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "opp_proposals: admin only delete"
  on opportunity_proposals for delete
  using (get_my_role() = 'admin');

-- opportunity_proposal_items: same as proposals
create policy "opp_proposal_items: all roles can select"
  on opportunity_proposal_items for select
  using (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "opp_proposal_items: all roles can insert"
  on opportunity_proposal_items for insert
  with check (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "opp_proposal_items: all roles can update"
  on opportunity_proposal_items for update
  using (get_my_role() in ('admin', 'closer', 'lead_gen'))
  with check (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "opp_proposal_items: admin only delete"
  on opportunity_proposal_items for delete
  using (get_my_role() = 'admin');

-- sample_batch_items: all can read; closer + admin write
create policy "sample_batch_items: all roles can select"
  on sample_batch_items for select
  using (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "sample_batch_items: closer and admin can insert"
  on sample_batch_items for insert
  with check (get_my_role() in ('admin', 'closer'));

create policy "sample_batch_items: closer and admin can update"
  on sample_batch_items for update
  using (get_my_role() in ('admin', 'closer'))
  with check (get_my_role() in ('admin', 'closer'));

create policy "sample_batch_items: admin only delete"
  on sample_batch_items for delete
  using (get_my_role() = 'admin');
