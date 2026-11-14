begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'admin', 'manager', 'kitchen', 'cashier', 'delivery'));

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
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Order not found'; end if;
  v_allowed := case v_order.status
    when 'pending' then p_status in ('confirmed', 'cancelled')
    when 'confirmed' then p_status in ('preparing', 'cancelled')
    when 'preparing' then p_status in ('ready', 'cancelled')
    when 'ready' then v_order.order_type <> 'delivery' and p_status = 'completed'
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

drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers and authorized staff read orders" on public.orders for select to authenticated
  using (
    customer_id = auth.uid()
    or public.has_role(array['admin', 'manager', 'cashier'])
    or (delivery_staff_id = auth.uid() and public.has_role(array['delivery']))
    or public.has_staff_permission('kitchen.manage')
    or public.has_staff_permission('orders.manage')
  );

drop policy if exists "Customers read own order items" on public.order_items;
create policy "Customers and authorized staff read order items" on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid()
      or public.has_role(array['admin', 'manager', 'cashier'])
      or (o.delivery_staff_id = auth.uid() and public.has_role(array['delivery']))
      or public.has_staff_permission('kitchen.manage')
      or public.has_staff_permission('orders.manage')
    )
  ));

drop policy if exists "Customers read own order option snapshots" on public.order_item_options;
create policy "Customers and authorized staff read order option snapshots" on public.order_item_options for select to authenticated
  using (exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id and (
      o.customer_id = auth.uid()
      or public.has_role(array['admin', 'manager', 'cashier'])
      or (o.delivery_staff_id = auth.uid() and public.has_role(array['delivery']))
      or public.has_staff_permission('kitchen.manage')
      or public.has_staff_permission('orders.manage')
    )
  ));

drop policy if exists "Customers read own order status history" on public.order_status_history;
create policy "Customers and authorized staff read order status history" on public.order_status_history for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid()
      or public.has_role(array['admin', 'manager', 'cashier'])
      or (o.delivery_staff_id = auth.uid() and public.has_role(array['delivery']))
      or public.has_staff_permission('kitchen.manage')
      or public.has_staff_permission('orders.manage')
    )
  ));

drop policy if exists "Inventory staff update inventory items" on public.inventory_items;
create policy "Inventory staff update inventory items" on public.inventory_items for update to authenticated
  using (public.has_staff_permission('inventory.manage'))
  with check (public.has_staff_permission('inventory.manage'));
grant update on public.inventory_items to authenticated;

create or replace function public.admin_update_restaurant_table(
  p_restaurant_table_id uuid,
  p_label text,
  p_section text,
  p_capacity integer
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_table public.restaurant_tables%rowtype;
begin
  if not public.has_role(array['admin', 'manager'])
     and not public.has_staff_permission('tables.manage') then
    raise exception using errcode = '42501', message = 'Table management authorization required';
  end if;
  if length(trim(coalesce(p_label, ''))) not between 1 and 80
     or length(coalesce(p_section, '')) > 80
     or (p_capacity is not null and p_capacity not between 1 and 100) then
    raise exception using errcode = '22023', message = 'Invalid table details';
  end if;
  update public.restaurant_tables
    set label = trim(p_label), section = nullif(trim(coalesce(p_section, '')), ''),
        capacity = p_capacity, updated_at = now()
    where id = p_restaurant_table_id
    returning * into v_table;
  if not found then
    raise exception using errcode = 'P0002', message = 'Restaurant table not found';
  end if;
  return jsonb_build_object(
    'id', v_table.id, 'label', v_table.label, 'section', v_table.section,
    'capacity', v_table.capacity, 'is_active', v_table.is_active
  );
end;
$$;
revoke all on function public.admin_update_restaurant_table(uuid, text, text, integer) from public, anon;
grant execute on function public.admin_update_restaurant_table(uuid, text, text, integer) to authenticated;

create or replace function public.can_manage_tables()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.has_staff_permission('tables.manage');
$$;

create or replace function public.admin_dashboard_report(p_since timestamptz, p_until timestamptz)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_report jsonb;
begin
  if not public.has_role(array['admin', 'manager']) then
    raise exception using errcode = '42501', message = 'Report authorization required';
  end if;
  if p_since is null or p_until is null or p_until <= p_since
     or p_until - p_since > interval '366 days' then
    raise exception using errcode = '22023', message = 'Invalid report date range';
  end if;

  select jsonb_build_object(
    'order_count', count(*),
    'paid_revenue', coalesce(sum(o.total) filter (where o.payment_status = 'paid'), 0),
    'pending_count', count(*) filter (where o.status in ('pending', 'confirmed')),
    'completed_count', count(*) filter (where o.status = 'completed'),
    'status_counts', coalesce((
      select jsonb_object_agg(status, n) from (
        select o2.status, count(*) as n from public.orders o2
        where o2.created_at >= p_since and o2.created_at < p_until
        group by o2.status
      ) status_summary
    ), '{}'::jsonb),
    'order_type_counts', coalesce((
      select jsonb_agg(jsonb_build_object('type', order_type, 'orders', n, 'revenue', revenue) order by order_type)
      from (
        select o3.order_type, count(*) as n, coalesce(sum(o3.total), 0) as revenue
        from public.orders o3 where o3.created_at >= p_since and o3.created_at < p_until
        group by o3.order_type
      ) type_summary
    ), '[]'::jsonb),
    'daily_sales', coalesce((
      select jsonb_agg(jsonb_build_object('day', sales_day, 'sales', sales) order by sales_day)
      from (
        select o4.created_at::date as sales_day, coalesce(sum(o4.total) filter (where o4.payment_status = 'paid'), 0) as sales
        from public.orders o4 where o4.created_at >= p_since and o4.created_at < p_until
        group by o4.created_at::date
      ) daily_summary
    ), '[]'::jsonb),
    'best_sellers', coalesce((
      select jsonb_agg(jsonb_build_object('name', product_name, 'quantity', quantity) order by quantity desc)
      from (
        select coalesce(nullif(oi.snapshot ->> 'name', ''), oi.product_name_snapshot, 'Deleted product') as product_name,
               sum(oi.quantity) as quantity
        from public.order_items oi join public.orders o5 on o5.id = oi.order_id
        where o5.created_at >= p_since and o5.created_at < p_until
        group by coalesce(nullif(oi.snapshot ->> 'name', ''), oi.product_name_snapshot, 'Deleted product')
        order by sum(oi.quantity) desc
        limit 10
      ) seller_summary
    ), '[]'::jsonb),
    'cash_received', coalesce((
      select sum(cp.amount) from public.cash_payments cp
      where cp.status = 'paid' and cp.received_at >= p_since and cp.received_at < p_until
    ), 0)
  ) into v_report
  from public.orders o
  where o.created_at >= p_since and o.created_at < p_until;
  return v_report;
end;
$$;
revoke all on function public.admin_dashboard_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_dashboard_report(timestamptz, timestamptz) to authenticated;

commit;
