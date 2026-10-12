-- Delivery dates are Store-only order metadata. Customers can read only their own order rows via existing RLS.
alter table public.store_orders add column if not exists expected_delivery_date date;
alter table public.store_orders add column if not exists delivered_at timestamptz;
create or replace function public.store_set_expected_delivery_date(p_order_id uuid,p_delivery_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.store_orders%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if not public.has_store_permission('store.orders.process') then raise exception 'Not allowed to update delivery dates'; end if;
 if p_delivery_date is not null and p_delivery_date < current_date then raise exception 'Expected delivery date cannot be in the past'; end if;
 select * into v_order from public.store_orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 update public.store_orders set expected_delivery_date=p_delivery_date,updated_at=now() where id=p_order_id;
 insert into public.store_audit_logs(actor_user_id,action,resource_type,resource_id,before_data,after_data)
 values(auth.uid(),'store.order.delivery_date_updated','store_order',p_order_id::text,
 jsonb_build_object('expected_delivery_date',v_order.expected_delivery_date),
 jsonb_build_object('expected_delivery_date',p_delivery_date,'order_number',v_order.order_number));
 return jsonb_build_object('order_number',v_order.order_number,'expected_delivery_date',p_delivery_date);
end; $$;
revoke all on function public.store_set_expected_delivery_date(uuid,date) from public,anon;
grant execute on function public.store_set_expected_delivery_date(uuid,date) to authenticated;
