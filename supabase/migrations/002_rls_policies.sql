-- =============================================================================
-- HISA Matcha CRM — Row Level Security Policies
-- =============================================================================
-- Role matrix:
--   admin      → full access to everything
--   closer     → samples, quotations, invoices, recurring orders; read customers/opps
--   lead_gen   → customers, opportunities (own), instagram logs; NO quotations/invoices
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------
alter table profiles         enable row level security;
alter table customers        enable row level security;
alter table opportunities    enable row level security;
alter table instagram_logs   enable row level security;
alter table sample_batches   enable row level security;
alter table products         enable row level security;
alter table quotations       enable row level security;
alter table invoices         enable row level security;
alter table recurring_orders enable row level security;
alter table notifications    enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: get the current user's role without hitting profiles on every call.
-- STABLE + security definer means it runs once per query plan, not per row.
-- ---------------------------------------------------------------------------
create or replace function get_my_role()
returns user_role
language sql stable security definer
set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- Everyone can read their own row. Admin can read all.
-- Users can update their own display name.
-- Only the trigger (via service role) inserts rows.
-- ---------------------------------------------------------------------------
create policy "profiles: read own or admin reads all"
  on profiles for select
  using (id = auth.uid() or get_my_role() = 'admin');

create policy "profiles: update own"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- customers
-- All roles can read.
-- lead_gen and admin can insert (they generate leads).
-- All roles can update (closer updates assigned status, lead_gen fills in info).
-- Only admin can delete.
-- ---------------------------------------------------------------------------
create policy "customers: all roles can select"
  on customers for select
  using (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "customers: lead_gen and admin can insert"
  on customers for insert
  with check (get_my_role() in ('admin', 'lead_gen'));

create policy "customers: all roles can update"
  on customers for update
  using (get_my_role() in ('admin', 'closer', 'lead_gen'))
  with check (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "customers: admin only delete"
  on customers for delete
  using (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- opportunities
-- All roles can read (kanban is visible to everyone).
-- lead_gen and admin can insert new opportunities.
-- All roles can update (lead_gen qualifies, closer advances stages).
-- Only admin can delete.
-- ---------------------------------------------------------------------------
create policy "opportunities: all roles can select"
  on opportunities for select
  using (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "opportunities: lead_gen and admin can insert"
  on opportunities for insert
  with check (get_my_role() in ('admin', 'lead_gen'));

create policy "opportunities: all roles can update"
  on opportunities for update
  using (get_my_role() in ('admin', 'closer', 'lead_gen'))
  with check (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "opportunities: admin only delete"
  on opportunities for delete
  using (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- instagram_logs
-- All roles can read (closer may review conversation history).
-- lead_gen and admin can insert and update (they run outreach).
-- Only admin can delete.
-- ---------------------------------------------------------------------------
create policy "instagram_logs: all roles can select"
  on instagram_logs for select
  using (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "instagram_logs: lead_gen and admin can insert"
  on instagram_logs for insert
  with check (get_my_role() in ('admin', 'lead_gen'));

create policy "instagram_logs: lead_gen and admin can update"
  on instagram_logs for update
  using (get_my_role() in ('admin', 'lead_gen'))
  with check (get_my_role() in ('admin', 'lead_gen'));

create policy "instagram_logs: admin only delete"
  on instagram_logs for delete
  using (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- sample_batches
-- All roles can read (lead_gen needs visibility on shipment status).
-- closer and admin can insert and update (they ship samples).
-- Only admin can delete.
-- ---------------------------------------------------------------------------
create policy "sample_batches: all roles can select"
  on sample_batches for select
  using (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "sample_batches: closer and admin can insert"
  on sample_batches for insert
  with check (get_my_role() in ('admin', 'closer'));

create policy "sample_batches: closer and admin can update"
  on sample_batches for update
  using (get_my_role() in ('admin', 'closer'))
  with check (get_my_role() in ('admin', 'closer'));

create policy "sample_batches: admin only delete"
  on sample_batches for delete
  using (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- products
-- All roles can read (needed for dropdowns in quotations, sample forms).
-- Only admin can write (sync is an admin-only action).
-- ---------------------------------------------------------------------------
create policy "products: all roles can select"
  on products for select
  using (get_my_role() in ('admin', 'closer', 'lead_gen'));

create policy "products: admin only insert"
  on products for insert
  with check (get_my_role() = 'admin');

create policy "products: admin only update"
  on products for update
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

create policy "products: admin only delete"
  on products for delete
  using (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- quotations
-- lead_gen has NO access (cannot view pricing details or send quotes).
-- closer and admin can read, insert, and update.
-- Only admin can delete.
-- ---------------------------------------------------------------------------
create policy "quotations: closer and admin can select"
  on quotations for select
  using (get_my_role() in ('admin', 'closer'));

create policy "quotations: closer and admin can insert"
  on quotations for insert
  with check (get_my_role() in ('admin', 'closer'));

create policy "quotations: closer and admin can update"
  on quotations for update
  using (get_my_role() in ('admin', 'closer'))
  with check (get_my_role() in ('admin', 'closer'));

create policy "quotations: admin only delete"
  on quotations for delete
  using (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- invoices
-- lead_gen has NO access.
-- closer can read (needs to see payment status and send payment links).
-- Only admin can insert, update, delete (admin approves and generates invoices).
-- ---------------------------------------------------------------------------
create policy "invoices: closer and admin can select"
  on invoices for select
  using (get_my_role() in ('admin', 'closer'));

create policy "invoices: admin only insert"
  on invoices for insert
  with check (get_my_role() = 'admin');

create policy "invoices: admin only update"
  on invoices for update
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

create policy "invoices: admin only delete"
  on invoices for delete
  using (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- recurring_orders
-- lead_gen has NO access (recurring customer management is closer + admin).
-- closer and admin can read, insert, and update.
-- Only admin can delete.
-- ---------------------------------------------------------------------------
create policy "recurring_orders: closer and admin can select"
  on recurring_orders for select
  using (get_my_role() in ('admin', 'closer'));

create policy "recurring_orders: closer and admin can insert"
  on recurring_orders for insert
  with check (get_my_role() in ('admin', 'closer'));

create policy "recurring_orders: closer and admin can update"
  on recurring_orders for update
  using (get_my_role() in ('admin', 'closer'))
  with check (get_my_role() in ('admin', 'closer'));

create policy "recurring_orders: admin only delete"
  on recurring_orders for delete
  using (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- notifications
-- Each user can only read and update (mark as read) their own notifications.
-- Admin can read all.
-- Insert is handled server-side via service role (bypasses RLS) or the
-- create_notification() security definer function.
-- ---------------------------------------------------------------------------
create policy "notifications: read own or admin reads all"
  on notifications for select
  using (user_id = auth.uid() or get_my_role() = 'admin');

create policy "notifications: update own (mark as read)"
  on notifications for update
  using (user_id = auth.uid() or get_my_role() = 'admin')
  with check (user_id = auth.uid() or get_my_role() = 'admin');

-- Admin can delete old notifications
create policy "notifications: admin only delete"
  on notifications for delete
  using (get_my_role() = 'admin');
