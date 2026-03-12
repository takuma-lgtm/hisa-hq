-- =============================================================================
-- HISA Matcha CRM — Initial Schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('admin', 'closer', 'lead_gen');

create type cafe_type_enum as enum (
  'coffee_shop',
  'matcha_focused',
  'already_serving_matcha',
  'new_to_matcha',
  'other'
);

create type customer_status_enum as enum (
  'lead',
  'qualified_opportunity',
  'recurring_customer',
  'lost'
);

create type opportunity_stage_enum as enum (
  'lead_created',
  'contacted',
  'replied',
  'qualified',
  'assigned_to_closer',
  'sample_sent',
  'sample_delivered',
  'quote_sent',
  'quote_accepted',
  'internal_review_pending',
  'invoice_sent',
  'payment_pending',
  'won',
  'lost'
);

create type instagram_status_enum as enum (
  'no_response',
  'replied',
  'interested',
  'not_interested'
);

create type sample_result_enum as enum (
  'pending',
  'rejected',
  'approved'
);

create type payment_terms_enum as enum (
  '100_upfront',
  '50_50',
  'custom'
);

create type quote_status_enum as enum (
  'draft',
  'sent',
  'accepted',
  'rejected'
);

create type payment_status_enum as enum (
  'pending',
  'paid',
  'failed'
);

create type notification_type_enum as enum (
  'sample_delivered',
  'quote_accepted',
  'invoice_approval_needed',
  'payment_received',
  'payment_overdue'
);

-- ---------------------------------------------------------------------------
-- profiles
-- Extends auth.users. Stores the display name and role for each of the 3
-- team members. Auto-created by the on_auth_user_created trigger below.
-- ---------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null,
  role        user_role not null default 'lead_gen',
  created_at  timestamptz not null default now()
);

comment on table profiles is
  'One row per authenticated user. role drives all RLS policies.';

-- ---------------------------------------------------------------------------
-- customers
-- The cafe record — single source of truth for contact info, cafe
-- classification, and current lifecycle status.
-- ---------------------------------------------------------------------------
create table customers (
  customer_id              uuid primary key default gen_random_uuid(),
  cafe_name                text not null,
  instagram_handle         text,
  email                    text,
  phone                    text,
  address                  text,
  city                     text,
  state                    text,
  country                  text,
  contact_person           text,
  preferred_payment_method text,
  cafe_type                cafe_type_enum,
  monthly_matcha_usage_kg  numeric check (monthly_matcha_usage_kg >= 0),
  budget_range             text,
  status                   customer_status_enum not null default 'lead',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table customers is
  'Cafe records. status mirrors the highest stage of any linked opportunity.';

create index customers_status_idx  on customers (status);
create index customers_created_idx on customers (created_at desc);

-- ---------------------------------------------------------------------------
-- opportunities
-- One opportunity per customer deal attempt. Tracks the 14-stage pipeline.
-- The 5 qualification fields must all be set before the stage can advance
-- past "qualified" (enforced in application logic).
-- ---------------------------------------------------------------------------
create table opportunities (
  opportunity_id         uuid primary key default gen_random_uuid(),
  customer_id            uuid not null references customers (customer_id) on delete cascade,
  stage                  opportunity_stage_enum not null default 'lead_created',
  assigned_to            uuid references profiles (id) on delete set null,
  -- Qualification gate fields (must be filled before advancing to "qualified")
  product_match_possible boolean not null default false,
  casual_price_shared    boolean not null default false,
  product_guide_shared   boolean not null default false,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table opportunities is
  'Pipeline record per deal. Stage advances through 14 steps from lead_created to won/lost.';

create index opportunities_customer_idx on opportunities (customer_id);
create index opportunities_stage_idx    on opportunities (stage);
create index opportunities_assigned_idx on opportunities (assigned_to);

-- ---------------------------------------------------------------------------
-- instagram_logs
-- Append-only log of every Instagram DM exchange. No API required —
-- team members log manually. Linked to the customer record.
-- ---------------------------------------------------------------------------
create table instagram_logs (
  log_id         uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers (customer_id) on delete cascade,
  message_sent   text,
  reply_received text,
  status         instagram_status_enum not null default 'no_response',
  notes          text,
  created_at     timestamptz not null default now()
);

comment on table instagram_logs is
  'Manual log of DM outreach. status tracks interest level of the cafe contact.';

create index instagram_logs_customer_idx on instagram_logs (customer_id);

-- ---------------------------------------------------------------------------
-- sample_batches
-- A customer may receive multiple shipments. Tracks products sent, carrier
-- info, FedEx tracking number, delivery status, and the result verdict.
-- ---------------------------------------------------------------------------
create table sample_batches (
  batch_id        uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references opportunities (opportunity_id) on delete cascade,
  customer_id     uuid not null references customers (customer_id),
  -- JSONB array: [{product_id, customer_facing_name, qty_g}]
  products_sent   jsonb not null default '[]',
  date_shipped    date,
  tracking_number text,
  carrier         text,
  delivery_status text,
  delivery_date   date,
  feedback_notes  text,
  result          sample_result_enum not null default 'pending',
  created_at      timestamptz not null default now()
);

comment on table sample_batches is
  'Each row is one sample shipment. products_sent is a JSONB array of product snapshots.';

create index sample_batches_opportunity_idx on sample_batches (opportunity_id);
create index sample_batches_customer_idx    on sample_batches (customer_id);
create index sample_batches_tracking_idx    on sample_batches (tracking_number) where tracking_number is not null;

-- ---------------------------------------------------------------------------
-- products
-- Local cache of the Google Sheets product master. Populated via the
-- /api/products/sync endpoint. All product dropdowns read from this table.
-- ---------------------------------------------------------------------------
create table products (
  product_id                   text primary key,
  supplier_product_name        text not null,
  customer_facing_product_name text not null,
  price_per_kg                 numeric not null check (price_per_kg >= 0),
  gross_profit_margin          numeric check (gross_profit_margin between 0 and 1),
  harvest                      text,
  tasting_notes                text,
  inventory_available          numeric check (inventory_available >= 0),
  active                       boolean not null default true,
  last_synced_at               timestamptz
);

comment on table products is
  'Cached copy of the Google Sheets product master. product_id matches the sheet row identifier.';

create index products_active_idx on products (active) where active = true;

-- ---------------------------------------------------------------------------
-- quotations
-- Built by the closer after a sample result = approved. Contains line items
-- (JSONB), payment and shipping terms, and tracks acceptance.
-- ---------------------------------------------------------------------------
create table quotations (
  quotation_id   uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities (opportunity_id) on delete cascade,
  customer_id    uuid not null references customers (customer_id),
  -- JSONB array: [{product_id, name, qty_kg, price_per_kg, subtotal}]
  line_items     jsonb not null default '[]',
  total_amount   numeric not null check (total_amount >= 0),
  payment_terms  payment_terms_enum not null default '100_upfront',
  custom_terms   text,
  shipping_terms text,
  status         quote_status_enum not null default 'draft',
  created_by     uuid not null references profiles (id),
  accepted_at    timestamptz,
  created_at     timestamptz not null default now()
);

comment on table quotations is
  'A quote sent to a cafe. On acceptance, stage advances to internal_review_pending.';

create index quotations_opportunity_idx on quotations (opportunity_id);
create index quotations_customer_idx    on quotations (customer_id);
create index quotations_status_idx      on quotations (status);

-- ---------------------------------------------------------------------------
-- invoices
-- Generated after internal review approval. Holds the Stripe payment link
-- and payment status, updated automatically via Stripe webhook.
-- ---------------------------------------------------------------------------
create table invoices (
  invoice_id             uuid primary key default gen_random_uuid(),
  quotation_id           uuid not null references quotations (quotation_id),
  opportunity_id         uuid not null references opportunities (opportunity_id),
  customer_id            uuid not null references customers (customer_id),
  amount                 numeric not null check (amount >= 0),
  stripe_payment_link    text,
  stripe_payment_intent  text,
  payment_status         payment_status_enum not null default 'pending',
  payment_terms          text,
  reviewed_by            uuid references profiles (id) on delete set null,
  approved_at            timestamptz,
  created_at             timestamptz not null default now()
);

comment on table invoices is
  'One invoice per quotation. stripe_payment_link is generated on admin approval.';

create index invoices_opportunity_idx on invoices (opportunity_id);
create index invoices_customer_idx    on invoices (customer_id);
create index invoices_payment_idx     on invoices (payment_status);

-- ---------------------------------------------------------------------------
-- recurring_orders
-- Order history for customers who have reached "Won" status. Each order
-- references an invoice and tracks the assigned closer and monthly volume.
-- ---------------------------------------------------------------------------
create table recurring_orders (
  order_id        uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers (customer_id),
  assigned_closer uuid references profiles (id) on delete set null,
  -- JSONB array: [{product_id, name, qty_kg, price_per_kg}]
  line_items      jsonb not null default '[]',
  total_amount    numeric check (total_amount >= 0),
  invoice_id      uuid references invoices (invoice_id) on delete set null,
  status          text not null default 'pending',
  notes           text,
  monthly_volume  numeric check (monthly_volume >= 0),
  created_at      timestamptz not null default now()
);

comment on table recurring_orders is
  'Order history for Won customers. monthly_volume (kg) drives the recurring tab metrics.';

create index recurring_orders_customer_idx on recurring_orders (customer_id);
create index recurring_orders_closer_idx   on recurring_orders (assigned_closer);

-- ---------------------------------------------------------------------------
-- notifications
-- In-app notification log. Inserted by DB triggers and server-side logic.
-- Supabase Realtime subscription on this table drives the bell icon.
-- ---------------------------------------------------------------------------
create table notifications (
  notification_id uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles (id) on delete cascade,
  type            notification_type_enum not null,
  message         text not null,
  reference_id    uuid,
  reference_type  text, -- 'opportunity' | 'invoice' | 'sample_batch' | 'quotation'
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

comment on table notifications is
  'Per-user notification rows. reference_id + reference_type link to the relevant record.';

create index notifications_user_idx     on notifications (user_id);
create index notifications_unread_idx   on notifications (user_id, read) where read = false;
create index notifications_created_idx  on notifications (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at auto-maintenance
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

create trigger opportunities_set_updated_at
  before update on opportunities
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on Supabase Auth signup
-- Reads name and role from user metadata set during invite/creation.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'lead_gen')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Notification helper (called by server-side API routes via service role)
-- ---------------------------------------------------------------------------
create or replace function create_notification(
  p_user_id        uuid,
  p_type           notification_type_enum,
  p_message        text,
  p_reference_id   uuid    default null,
  p_reference_type text    default null
)
returns uuid
language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into notifications (user_id, type, message, reference_id, reference_type)
  values (p_user_id, p_type, p_message, p_reference_id, p_reference_type)
  returning notification_id into v_id;
  return v_id;
end;
$$;

comment on function create_notification is
  'Called server-side (service role) to push a notification to a specific user.';
