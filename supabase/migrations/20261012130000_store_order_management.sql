-- Store order processing status changes, protected by Store RBAC.
create or replace function public.store_update_order_status(p_order_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_before public.store_orders%rowtype;
  v_after public.store_orders%rowtype;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_status not in ('pending','confirmed','packed','shipped','delivered','cancelled','returned') then
    raise exception 'Invalid order status';
  end if;
  if not public.has_store_permission('store.orders.view') then
    raise exception 'Not allowed to view Store orders';
  end if;
  if p_status = 'cancelled' then
    if not public.has_store_permission('store.orders.cancel') then raise exception 'Not allowed to cancel orders'; end if;
  elsif p_status <> 'pending' then
    if not public.has_store_permission('store.orders.process') then raise exception 'Not allowed to process orders'; end if;
  end if;
  select * into v_before from public.store_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_before.status in ('cancelled','returned','delivered') and p_status <> v_before.status then
    raise exception 'This order is already closed';
  end if;
  update public.store_orders set status = p_status, updated_at = now()
    where id = p_order_id returning * into v_after;
  insert into public.store_audit_logs(actor_user_id, action, resource_type, resource_id, before_data, after_data)
  values (v_user, 'store.order.status_updated', 'store_order', p_order_id::text,
    jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', v_after.status, 'order_number', v_after.order_number));
  return jsonb_build_object('order_id',v_after.id,'order_number',v_after.order_number,'status',v_after.status);
end;
$$;
revoke all on function public.store_update_order_status(uuid,text) from public, anon;
grant execute on function public.store_update_order_status(uuid,text) to authenticated;
