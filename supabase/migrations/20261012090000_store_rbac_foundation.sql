-- PrintBhejo Store RBAC foundation.
-- Safe additive migration: creates Store-specific authorization tables only.
-- Does not modify existing transfer tables, profiles, or current Admin Panel permissions.

create table if not exists public.store_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.store_permissions (
  code text primary key,
  module text not null,
  action text not null,
  description text not null default ''
);

create table if not exists public.store_role_permissions (
  role_id uuid not null references public.store_roles(id) on delete cascade,
  permission_code text not null references public.store_permissions(code) on delete cascade,
  allowed boolean not null default true,
  primary key (role_id, permission_code)
);

create table if not exists public.store_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_user_roles (
  user_id uuid not null references public.store_staff(user_id) on delete cascade,
  role_id uuid not null references public.store_roles(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.store_user_permission_overrides (
  user_id uuid not null references public.store_staff(user_id) on delete cascade,
  permission_code text not null references public.store_permissions(code) on delete cascade,
  allowed boolean not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_code)
);

create table if not exists public.store_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists store_user_roles_user_id_idx on public.store_user_roles(user_id);
create index if not exists store_user_permission_overrides_user_id_idx on public.store_user_permission_overrides(user_id);
create index if not exists store_audit_logs_created_at_idx on public.store_audit_logs(created_at desc);
create index if not exists store_audit_logs_actor_idx on public.store_audit_logs(actor_user_id, created_at desc);

insert into public.store_roles (code, name, description) values
  ('inventory_manager', 'Inventory Manager', 'Manages product availability and stock movements.'),
  ('order_manager', 'Order Manager', 'Processes customer orders and fulfilment status.'),
  ('delivery_staff', 'Dispatch / Delivery Staff', 'Handles only assigned dispatch and delivery work.'),
  ('accounts_manager', 'Accounts / Payment Manager', 'Reconciles payments and handles approved finance workflows.')
on conflict (code) do nothing;

insert into public.store_permissions (code, module, action, description) values
  ('store.catalog.view', 'catalog', 'view', 'View Store catalogue data in admin tools.'),
  ('store.products.view', 'products', 'view', 'View product records.'),
  ('store.products.create', 'products', 'create', 'Create products.'),
  ('store.products.update', 'products', 'update', 'Edit product details and selling price.'),
  ('store.products.archive', 'products', 'archive', 'Archive products without deleting order history.'),
  ('store.inventory.view', 'inventory', 'view', 'View stock levels and stock movement history.'),
  ('store.inventory.receive', 'inventory', 'receive', 'Record supplier stock receipts.'),
  ('store.inventory.adjust', 'inventory', 'adjust', 'Adjust stock with a reason.'),
  ('store.inventory.approve_adjustment', 'inventory', 'approve_adjustment', 'Approve sensitive stock adjustments.'),
  ('store.suppliers.view', 'suppliers', 'view', 'View supplier records.'),
  ('store.suppliers.manage', 'suppliers', 'manage', 'Create and edit suppliers.'),
  ('store.costs.view', 'costs', 'view', 'View purchase cost and margin information.'),
  ('store.orders.view', 'orders', 'view', 'View orders permitted by assigned scope.'),
  ('store.orders.process', 'orders', 'process', 'Confirm, pack and process orders.'),
  ('store.orders.cancel', 'orders', 'cancel', 'Cancel eligible orders.'),
  ('store.orders.assign', 'orders', 'assign', 'Assign orders to fulfilment or delivery staff.'),
  ('store.delivery.update_assigned', 'delivery', 'update_assigned', 'Update status only for assigned deliveries.'),
  ('store.payments.view', 'payments', 'view', 'View payment status and reconciliation records.'),
  ('store.payments.reconcile', 'payments', 'reconcile', 'Reconcile payment records.'),
  ('store.refunds.request', 'refunds', 'request', 'Request a refund.'),
  ('store.refunds.approve', 'refunds', 'approve', 'Approve eligible refunds.'),
  ('store.reports.view', 'reports', 'view', 'View Store reports.'),
  ('store.reports.export', 'reports', 'export', 'Export permitted Store reports.'),
  ('store.staff.view', 'staff', 'view', 'View Store staff accounts.'),
  ('store.staff.manage', 'staff', 'manage', 'Activate/deactivate Store staff and assign job roles.'),
  ('store.permissions.manage', 'staff', 'permissions', 'Customize per-user Store permissions.'),
  ('store.audit.view', 'audit', 'view', 'View Store audit history.')
on conflict (code) do nothing;

-- Seed conservative defaults. Purchase costs, refunds, staff administration and permission
-- management are intentionally excluded from ordinary role templates.
insert into public.store_role_permissions (role_id, permission_code, allowed)
select r.id, p.code, true
from public.store_roles r
join public.store_permissions p on
  (r.code = 'inventory_manager' and p.code in (
    'store.catalog.view','store.products.view','store.products.create','store.products.update',
    'store.inventory.view','store.inventory.receive','store.inventory.adjust','store.suppliers.view'
  ))
  or (r.code = 'order_manager' and p.code in (
    'store.catalog.view','store.products.view','store.orders.view','store.orders.process','store.orders.cancel'
  ))
  or (r.code = 'delivery_staff' and p.code in (
    'store.orders.view','store.delivery.update_assigned'
  ))
  or (r.code = 'accounts_manager' and p.code in (
    'store.orders.view','store.payments.view','store.payments.reconcile','store.refunds.request','store.reports.view'
  ))
on conflict (role_id, permission_code) do nothing;

create or replace function public.has_store_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
          and coalesce(p.disabled, false) = false
      )
      or (
        exists (
          select 1 from public.store_staff s
          where s.user_id = auth.uid() and s.active = true
        )
        and coalesce(
          (select o.allowed
           from public.store_user_permission_overrides o
           where o.user_id = auth.uid() and o.permission_code = p_permission),
          (select bool_or(rp.allowed)
           from public.store_user_roles ur
           join public.store_role_permissions rp on rp.role_id = ur.role_id
           where ur.user_id = auth.uid() and rp.permission_code = p_permission),
          false
        )
      )
    );
$$;

revoke all on function public.has_store_permission(text) from public, anon;
grant execute on function public.has_store_permission(text) to authenticated;

alter table public.store_roles enable row level security;
alter table public.store_permissions enable row level security;
alter table public.store_role_permissions enable row level security;
alter table public.store_staff enable row level security;
alter table public.store_user_roles enable row level security;
alter table public.store_user_permission_overrides enable row level security;
alter table public.store_audit_logs enable row level security;

create policy "Store roles visible to authorized staff"
  on public.store_roles for select to authenticated
  using (public.has_store_permission('store.staff.view') or public.has_store_permission('store.permissions.manage'));

create policy "Store permissions visible to authorized staff"
  on public.store_permissions for select to authenticated
  using (public.has_store_permission('store.staff.view') or public.has_store_permission('store.permissions.manage'));

create policy "Store role permissions visible to authorized staff"
  on public.store_role_permissions for select to authenticated
  using (public.has_store_permission('store.staff.view') or public.has_store_permission('store.permissions.manage'));

create policy "Staff can view own Store staff record"
  on public.store_staff for select to authenticated
  using (user_id = (select auth.uid()) or public.has_store_permission('store.staff.view'));

create policy "Owners manage Store staff"
  on public.store_staff for all to authenticated
  using (public.has_store_permission('store.staff.manage'))
  with check (public.has_store_permission('store.staff.manage'));

create policy "Users can view own Store roles"
  on public.store_user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_store_permission('store.staff.view'));

create policy "Owners manage Store role assignments"
  on public.store_user_roles for all to authenticated
  using (public.has_store_permission('store.staff.manage'))
  with check (public.has_store_permission('store.staff.manage'));

create policy "Users can view own Store permission overrides"
  on public.store_user_permission_overrides for select to authenticated
  using (user_id = (select auth.uid()) or public.has_store_permission('store.permissions.manage'));

create policy "Owners manage Store permission overrides"
  on public.store_user_permission_overrides for all to authenticated
  using (public.has_store_permission('store.permissions.manage'))
  with check (public.has_store_permission('store.permissions.manage'));

create policy "Authorized owners view Store audit log"
  on public.store_audit_logs for select to authenticated
  using (public.has_store_permission('store.audit.view'));

-- Deliberately no client INSERT/UPDATE/DELETE policy on audit logs. Trusted server-side
-- workflows will write audit events when Store mutations are implemented.
