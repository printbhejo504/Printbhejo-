-- Store COD checkout: creates an authenticated customer's order atomically.
create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_id uuid not null references auth.users(id) on delete restrict,
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 100),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  address text not null check (char_length(trim(address)) between 8 and 500),
  city text not null check (char_length(trim(city)) between 1 and 100),
  state text not null check (char_length(trim(state)) between 1 and 100),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  status text not null default 'pending' check (status in ('pending','confirmed','packed','shipped','delivered','cancelled','returned')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.store_order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.store_orders(id) on delete restrict,
  product_id uuid not null references public.store_products(id) on delete restrict,
  product_name text not null,
  sku text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);
create index if not exists store_orders_customer_created_idx on public.store_orders(customer_id, created_at desc);
create index if not exists store_orders_status_created_idx on public.store_orders(status, created_at desc);
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
create policy "Customers view own Store orders" on public.store_orders for select to authenticated using (customer_id = (select auth.uid()) or public.has_store_permission('store.orders.view'));
create policy "Customers view own Store order items" on public.store_order_items for select to authenticated using (exists (select 1 from public.store_orders o where o.id = order_id and (o.customer_id = (select auth.uid()) or public.has_store_permission('store.orders.view'))));
grant select on public.store_orders, public.store_order_items to authenticated;

create or replace function public.store_place_cod_order(
  p_customer_name text, p_phone text, p_address text, p_city text, p_state text, p_pincode text, p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_order_number bigint;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_product public.store_products%rowtype;
  v_qty integer;
  v_count integer := 0;
begin
  if v_user is null then raise exception 'Please sign in before checkout'; end if;
  if p_customer_name is null or char_length(trim(p_customer_name)) not between 2 and 100 then raise exception 'Enter a valid full name'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number'; end if;
  if p_address is null or char_length(trim(p_address)) not between 8 and 500 then raise exception 'Enter a complete delivery address'; end if;
  if p_city is null or char_length(trim(p_city)) not between 1 and 100 or p_state is null or char_length(trim(p_state)) not between 1 and 100 then raise exception 'Enter city and state'; end if;
  if p_pincode !~ '^[1-9][0-9]{5}$' then raise exception 'Enter a valid 6-digit PIN code'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception 'Cart must contain 1 to 50 products'; end if;
  insert into public.store_orders(customer_id,customer_name,phone,address,city,state,pincode,subtotal)
  values(v_user,trim(p_customer_name),trim(p_phone),trim(p_address),trim(p_city),trim(p_state),trim(p_pincode),0)
  returning id,order_number into v_order_id,v_order_number;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'product_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid product in cart'; end if;
    if coalesce(v_item->>'quantity','') !~ '^[0-9]{1,5}$' then raise exception 'Invalid quantity'; end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 then raise exception 'Quantity must be positive'; end if;
    select * into v_product from public.store_products where id=(v_item->>'product_id')::uuid and active=true for share;
    if not found then raise exception 'A product is no longer available'; end if;
    if v_qty < v_product.minimum_order_qty then raise exception 'Quantity is below minimum order quantity for %',v_product.name; end if;
    if exists (select 1 from public.store_order_items oi where oi.order_id=v_order_id and oi.product_id=v_product.id) then raise exception 'Duplicate product in cart'; end if;
    insert into public.store_order_items(order_id,product_id,product_name,sku,unit_price,quantity,line_total)
    values(v_order_id,v_product.id,v_product.name,v_product.sku,v_product.selling_price,v_qty,v_product.selling_price*v_qty);
    v_total := v_total + v_product.selling_price*v_qty;
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then raise exception 'Cart is empty'; end if;
  update public.store_orders set subtotal=v_total where id=v_order_id;
  insert into public.store_audit_logs(actor_user_id,action,resource_type,resource_id,after_data)
  values(v_user,'store.order.created','store_order',v_order_id::text,jsonb_build_object('order_number',v_order_number,'payment_method','cod','subtotal',v_total));
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'subtotal',v_total,'status','pending','payment_method','cod');
end;
$$;
revoke all on function public.store_place_cod_order(text,text,text,text,text,text,jsonb) from public, anon;
grant execute on function public.store_place_cod_order(text,text,text,text,text,text,jsonb) to authenticated;
