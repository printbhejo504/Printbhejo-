-- Store admin inventory operations: permission-checked, atomic stock receipts/adjustments.
-- Existing transfer/session tables are untouched.

create policy "Authorized staff create Store inventory rows"
  on public.store_inventory for insert to authenticated
  with check (
    public.has_store_permission('store.inventory.receive')
    or public.has_store_permission('store.inventory.adjust')
  );

create policy "Authorized staff update Store inventory rows"
  on public.store_inventory for update to authenticated
  using (
    public.has_store_permission('store.inventory.receive')
    or public.has_store_permission('store.inventory.adjust')
  )
  with check (
    public.has_store_permission('store.inventory.receive')
    or public.has_store_permission('store.inventory.adjust')
  );

create policy "Authorized staff append Store inventory movements"
  on public.store_inventory_movements for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (movement_type = 'receipt' and public.has_store_permission('store.inventory.receive'))
      or (movement_type in ('adjustment','damage') and public.has_store_permission('store.inventory.adjust'))
    )
  );

create or replace function public.store_record_stock_movement(
  p_product_id uuid,
  p_movement_type text,
  p_quantity_delta integer,
  p_reason text
)
returns table(product_id uuid, quantity_on_hand integer, quantity_reserved integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_on_hand integer;
  v_reserved integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_product_id is null or p_quantity_delta is null or p_quantity_delta = 0
     or length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Product, non-zero quantity and a reason of at least 3 characters are required'
      using errcode = '22023';
  end if;

  if p_movement_type not in ('receipt','adjustment','damage') then
    raise exception 'Unsupported stock movement type' using errcode = '22023';
  end if;

  if p_movement_type = 'receipt' then
    if p_quantity_delta <= 0 or not public.has_store_permission('store.inventory.receive') then
      raise exception 'Permission denied or invalid receipt quantity' using errcode = '42501';
    end if;
  elsif not public.has_store_permission('store.inventory.adjust') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  insert into public.store_inventory as i (product_id, quantity_on_hand, quantity_reserved, updated_at)
  values (p_product_id, 0, 0, now())
  on conflict (product_id) do nothing;

  select i.quantity_on_hand, i.quantity_reserved
    into v_on_hand, v_reserved
    from public.store_inventory i
   where i.product_id = p_product_id
   for update;

  if not found then
    raise exception 'Inventory row unavailable or access denied' using errcode = '42501';
  end if;

  if v_on_hand + p_quantity_delta < v_reserved then
    raise exception 'Stock cannot fall below reserved quantity' using errcode = '23514';
  end if;

  update public.store_inventory i
     set quantity_on_hand = v_on_hand + p_quantity_delta,
         updated_at = now()
   where i.product_id = p_product_id
   returning i.quantity_on_hand, i.quantity_reserved into v_on_hand, v_reserved;

  insert into public.store_inventory_movements
    (product_id, movement_type, quantity_delta, reason, created_by)
  values
    (p_product_id, p_movement_type, p_quantity_delta, trim(p_reason), auth.uid());

  return query select p_product_id, v_on_hand, v_reserved;
end;
$$;

revoke all on function public.store_record_stock_movement(uuid,text,integer,text) from public, anon;
grant execute on function public.store_record_stock_movement(uuid,text,integer,text) to authenticated;
