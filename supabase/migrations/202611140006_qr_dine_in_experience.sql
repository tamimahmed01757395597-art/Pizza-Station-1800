begin;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'preparing', 'ready', 'served', 'out_for_delivery', 'completed', 'cancelled'));

alter table public.order_status_history drop constraint if exists order_status_history_from_status_check;
alter table public.order_status_history add constraint order_status_history_from_status_check
  check (from_status is null or from_status in (
    'pending', 'confirmed', 'preparing', 'ready', 'served', 'out_for_delivery', 'completed', 'cancelled'
  ));
alter table public.order_status_history drop constraint if exists order_status_history_to_status_check;
alter table public.order_status_history add constraint order_status_history_to_status_check
  check (to_status in (
    'pending', 'confirmed', 'preparing', 'ready', 'served', 'out_for_delivery', 'completed', 'cancelled'
  ));

drop policy if exists "Public reads active products" on public.products;
create policy "Public reads active products" on public.products for select to anon, authenticated
  using (is_active or public.has_role(array['admin', 'manager']));

create or replace function public.guard_order_staff_permissions()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.delivery_status is distinct from old.delivery_status
     and not public.has_staff_permission('delivery.update')
     and not public.has_staff_permission('orders.manage') then
    raise exception using errcode = '42501', message = 'Delivery update permission required';
  end if;
  if new.status is distinct from old.status then
    if new.status in ('out_for_delivery', 'completed') and old.order_type = 'delivery' then
      if not public.has_staff_permission('delivery.update')
         and not public.has_staff_permission('orders.manage') then
        raise exception using errcode = '42501', message = 'Delivery update permission required';
      end if;
    elsif not public.has_staff_permission('orders.manage')
       and not (
         public.has_staff_permission('kitchen.manage')
         and ((old.status = 'confirmed' and new.status = 'preparing')
           or (old.status = 'preparing' and new.status = 'ready'))
       ) then
      raise exception using errcode = '42501', message = 'Order management permission required';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.update_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_allowed boolean := false;
begin
  if not public.has_staff_permission('kitchen.manage')
     and not public.has_staff_permission('orders.manage') then
    raise exception using errcode = '42501', message = 'Order management authorization required';
  end if;
  if not public.has_staff_permission('orders.manage')
     and p_status not in ('preparing', 'ready') then
    raise exception using errcode = '42501', message = 'Order management authorization required';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Order not found'; end if;
  v_allowed := case v_order.status
    when 'pending' then p_status in ('confirmed', 'cancelled')
    when 'confirmed' then p_status in ('preparing', 'cancelled')
    when 'preparing' then p_status in ('ready', 'cancelled')
    when 'ready' then
      (v_order.order_type = 'dine_in' and p_status = 'served')
      or (v_order.order_type <> 'dine_in' and v_order.order_type <> 'delivery' and p_status = 'completed')
    when 'served' then v_order.order_type = 'dine_in' and p_status = 'completed'
    else false
  end;
  if not v_allowed then raise exception using errcode = '22023', message = 'Invalid order status transition'; end if;
  if p_status = 'cancelled' and v_order.payment_status = 'paid' then
    raise exception using errcode = '22023', message = 'Refund the payment before cancelling this order';
  end if;
  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
  if p_status = 'cancelled' then
    update public.products p set inventory_quantity = p.inventory_quantity + q.qty, updated_at = now()
      from (select product_id, sum(quantity)::integer qty from public.order_items
        where order_id = p_order_id and product_id is not null group by product_id) q
      where p.id = q.product_id and p.inventory_quantity is not null;
    insert into public.inventory_movements (product_id, quantity_delta, reason, created_by)
      select p.id, sum(oi.quantity)::integer, 'Cancellation ' || v_order.order_number, auth.uid()
      from public.order_items oi join public.products p on p.id = oi.product_id
      where oi.order_id = p_order_id and p.inventory_quantity is not null
      group by p.id;
    if v_order.coupon_id is not null then
      update public.coupons set usage_count = greatest(0, usage_count - 1) where id = v_order.coupon_id;
    end if;
  end if;
  insert into public.notifications (order_id, customer_id, type, channel, payload)
    values (p_order_id, v_order.customer_id, 'order_status', 'in_app',
      jsonb_build_object('order_number', v_order.order_number, 'status', p_status));
end;
$$;

create or replace function public.get_dine_in_order_status(p_order_id uuid, p_raw_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_raw_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = '22023', message = 'Invalid table QR token';
  end if;

  select jsonb_build_object(
    'order_number', o.order_number,
    'table_number', rt.label,
    'status', o.status,
    'payment_status', o.payment_status,
    'total', o.total,
    'created_at', o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(oi.product_name_snapshot, oi.snapshot ->> 'name', 'Menu item'),
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'line_total', oi.line_total,
        'snapshot', oi.snapshot
      ) order by oi.id)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.orders o
  join public.restaurant_tables rt on rt.id = o.restaurant_table_id
  join public.table_sessions ts
    on ts.id = o.table_session_id and ts.restaurant_table_id = rt.id
  where o.id = p_order_id
    and o.order_type = 'dine_in'
    and rt.qr_token_hash = encode(public.digest(p_raw_token, 'sha256'), 'hex');

  if v_result is null then
    raise exception using errcode = '22023', message = 'Order not found for this table QR';
  end if;
  return v_result;
end;
$$;

revoke all on function public.get_dine_in_order_status(uuid, text) from public;
grant execute on function public.get_dine_in_order_status(uuid, text) to anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'The supabase_realtime publication is required before this migration';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end;
$$;

commit;
