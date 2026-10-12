-- PrintBhejo Store catalogue and inventory tables (additive only).
-- Purchase costs and exact stock quantities are isolated from customer-readable product rows.

create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.store_categories(id) on delete set null,
  sku text unique,
  slug text not null unique,
  name text not null,
  brand text,
  short_description text not null default '',
  description text not null default '',
  image_url text,
  pack_size text not null default '1 unit',
  unit_label text not null default 'unit',
  selling_price numeric(12,2) not null check (selling_price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  minimum_order_qty integer not null default 1 check (minimum_order_qty >= 1),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  active boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_inventory (
  product_id uuid primary key references public.store_products(id) on delete restrict,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0 and quantity_reserved <= quantity_on_hand),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_product_costs (
  product_id uuid primary key references public.store_products(id) on delete restrict,
  purchase_cost numeric(12,2) not null default 0 check (purchase_cost >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.store_inventory_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.store_products(id) on delete restrict,
  movement_type text not null check (movement_type in ('receipt','adjustment','reservation','release','sale','return','damage')),
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null,
  reference_type text,
  reference_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists store_products_active_sort_idx on public.store_products(active, sort_order, created_at desc);
create index if not exists store_products_category_idx on public.store_products(category_id);
create index if not exists store_inventory_movements_product_date_idx on public.store_inventory_movements(product_id, created_at desc);

alter table public.store_categories enable row level security;
alter table public.store_products enable row level security;
alter table public.store_inventory enable row level security;
alter table public.store_product_costs enable row level security;
alter table public.store_inventory_movements enable row level security;

create policy "Signed in customers view active Store categories"
  on public.store_categories for select to authenticated using (active = true);

create policy "Authorized staff view all Store categories"
  on public.store_categories for select to authenticated
  using (public.has_store_permission('store.products.view'));

create policy "Authorized staff create Store categories"
  on public.store_categories for insert to authenticated
  with check (public.has_store_permission('store.products.create'));

create policy "Authorized staff update Store categories"
  on public.store_categories for update to authenticated
  using (public.has_store_permission('store.products.update'))
  with check (public.has_store_permission('store.products.update'));

create policy "Authorized staff archive Store categories"
  on public.store_categories for delete to authenticated
  using (public.has_store_permission('store.products.archive'));

create policy "Signed in customers view active Store products"
  on public.store_products for select to authenticated using (active = true);

create policy "Authorized staff view all Store products"
  on public.store_products for select to authenticated
  using (public.has_store_permission('store.products.view'));

create policy "Authorized staff create Store products"
  on public.store_products for insert to authenticated
  with check (public.has_store_permission('store.products.create'));

create policy "Authorized staff update Store products"
  on public.store_products for update to authenticated
  using (public.has_store_permission('store.products.update'))
  with check (public.has_store_permission('store.products.update'));

create policy "Authorized staff archive Store products"
  on public.store_products for delete to authenticated
  using (public.has_store_permission('store.products.archive'));

create policy "Authorized staff view Store inventory"
  on public.store_inventory for select to authenticated
  using (public.has_store_permission('store.inventory.view'));

create policy "Authorized staff view purchase costs"
  on public.store_product_costs for select to authenticated
  using (public.has_store_permission('store.costs.view'));

create policy "Authorized staff manage purchase costs"
  on public.store_product_costs for all to authenticated
  using (public.has_store_permission('store.costs.view'))
  with check (public.has_store_permission('store.costs.view'));

create policy "Authorized staff view inventory movements"
  on public.store_inventory_movements for select to authenticated
  using (public.has_store_permission('store.inventory.view'));

-- No client-side writes to inventory/movements yet. Stock mutations will be added
-- through atomic, permission-checked database functions in the inventory phase.
