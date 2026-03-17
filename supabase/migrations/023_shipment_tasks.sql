-- Migration 022: Shipment Tasks + Focus Products
-- Shipment tasks for JP-origin shipments (US→cafe uses existing us_outbound_orders)

-- Shipment tasks
create table if not exists shipment_tasks (
  task_id uuid primary key default gen_random_uuid(),
  task_type text not null check (task_type in ('sample', 'order')),
  route text not null check (route in ('jp_to_us', 'jp_to_cafe')),
  customer_name text,
  assigned_to uuid references profiles(id),
  created_by uuid not null references profiles(id),
  status text not null default 'open' check (status in ('open', 'done')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Line items per task
create table if not exists shipment_task_items (
  item_id uuid primary key default gen_random_uuid(),
  task_id uuid not null references shipment_tasks(task_id) on delete cascade,
  sku_id uuid not null references skus(sku_id),
  qty integer not null default 1
);

-- Indexes
create index if not exists idx_shipment_tasks_status on shipment_tasks(status);
create index if not exists idx_shipment_tasks_type on shipment_tasks(task_type);
create index if not exists idx_shipment_task_items_task on shipment_task_items(task_id);

-- RLS
alter table shipment_tasks enable row level security;
alter table shipment_task_items enable row level security;

create policy "shipment_tasks_select" on shipment_tasks for select to authenticated using (true);
create policy "shipment_tasks_insert" on shipment_tasks for insert to authenticated with check (true);
create policy "shipment_tasks_update" on shipment_tasks for update to authenticated using (true);

create policy "shipment_task_items_select" on shipment_task_items for select to authenticated using (true);
create policy "shipment_task_items_insert" on shipment_task_items for insert to authenticated with check (true);

-- Focus products setting
insert into crm_settings (key, value, label, category)
values ('focus_product_ids', '[]', 'Focus Product IDs', 'general')
on conflict (key) do nothing;
