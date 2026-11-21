begin;

-- ---------------------------------------------------------------------------
-- F2: throttle order creation inside the database.
-- The anon key is public, so POST /rest/v1/rpc/create_order bypasses every
-- Next.js rate limit. This table is private to the security-definer function.
-- ---------------------------------------------------------------------------
create table if not exists public.order_submission_throttle (
  bucket_key text primary key,
  window_start timestamptz not null,
  attempt_count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.order_submission_throttle enable row level security;
revoke all on public.order_submission_throttle from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- F2 + F5: replace create_order with a version that throttles by a hashed
-- email/user/10-minute-window key and refuses an anonymous idempotency-key
-- match unless the existing order belongs to the same guest address.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_order_type text := p_payload ->> 'order_type';
  v_payment_method text := p_payload ->> 'payment_method';
  v_subtotal numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 0;
  v_total numeric(10,2);
  v_coupon public.coupons%rowtype;
  v_zone public.delivery_zones%rowtype;
  v_line jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_line_unit numeric(10,2);
  v_line_total numeric(10,2);
  v_qty integer;
  v_addon public.product_addons%rowtype;
  v_addon_ids uuid[];
  v_snapshot jsonb;
  v_table_hash text;
  v_items jsonb := '[]'::jsonb;
  v_customer_email text;
  v_throttle_window timestamptz;
  v_throttle_key text;
  v_attempts integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_payload -> 'items') is distinct from 'array'
     or jsonb_array_length(coalesce(p_payload -> 'items', '[]'::jsonb)) < 1
     or jsonb_array_length(coalesce(p_payload -> 'items', '[]'::jsonb)) > 50
     or coalesce(p_payload ->> 'idempotency_key', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or jsonb_typeof(p_payload -> 'customer') is distinct from 'object'
     or length(trim(coalesce(p_payload #>> '{customer,name}', ''))) not between 1 and 120
     or length(trim(coalesce(p_payload #>> '{customer,email}', ''))) not between 3 and 254
     or p_payload #>> '{customer,email}' !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
     or length(trim(coalesce(p_payload #>> '{customer,phone}', ''))) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'Invalid order payload';
  end if;
  if v_order_type is null or v_order_type not in ('dine_in', 'delivery', 'pickup') then
    raise exception using errcode = '22023', message = 'Invalid order type';
  end if;
  if v_payment_method is null
     or (v_order_type = 'delivery' and v_payment_method <> 'cash_on_delivery')
     or (v_order_type <> 'delivery' and v_payment_method <> 'cash_at_restaurant') then
    raise exception using errcode = '22023', message = 'Invalid payment method';
  end if;

  -- F4: an authenticated customer's stored email is always their verified auth
  -- email, never the address supplied in the request. Status notifications read
  -- this column later, so normalising here closes the redirect path too.
  v_customer_email := lower(trim(p_payload #>> '{customer,email}'));
  if v_user_id is not null then
    select lower(u.email) into v_customer_email
      from auth.users u
     where u.id = v_user_id and u.email_confirmed_at is not null;
    if v_customer_email is null then
      raise exception using errcode = '42501', message = 'A verified email is required';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_payload ->> 'idempotency_key'));
  select id, order_number into v_order_id, v_order_number
    from public.orders where idempotency_key = (p_payload ->> 'idempotency_key')::uuid;
  if v_order_id is not null then
    if v_user_id is null then
      -- NULL IS DISTINCT FROM NULL is false, so the old check let a second
      -- anonymous caller reuse a known key and read someone else's order.
      if not exists (
        select 1 from public.orders
         where id = v_order_id
           and customer_id is null
           and lower(customer_email) = v_customer_email
      ) then
        raise exception using errcode = '42501', message = 'Idempotency key already used';
      end if;
    elsif (select customer_id from public.orders where id = v_order_id) is distinct from v_user_id then
      raise exception using errcode = '42501', message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'duplicate', true);
  end if;

  -- 10-minute fixed window keyed on a hash, never the raw address. Reuses of
  -- an existing idempotency key return above and do not consume an attempt.
  v_throttle_window := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
  v_throttle_key := encode(public.digest(
    coalesce(v_customer_email, 'unknown') || '|' ||
    coalesce(v_user_id::text, 'anon') || '|' || v_throttle_window::text,
    'sha256'), 'hex');
  insert into public.order_submission_throttle as throttle (bucket_key, window_start, attempt_count)
  values (v_throttle_key, v_throttle_window, 1)
  on conflict (bucket_key) do update
    set window_start = excluded.window_start,
        attempt_count = case
          when throttle.window_start = excluded.window_start
            then throttle.attempt_count + 1
          else 1 end,
        updated_at = now()
  returning attempt_count into v_attempts;
  if v_attempts > 10 then
    raise exception using errcode = '42501', message = 'Too many orders. Please try again later.';
  end if;

  for v_line in select value from jsonb_array_elements(p_payload -> 'items') loop
    v_qty := (v_line ->> 'quantity')::integer;
    if v_qty < 1 or v_qty > 20 then raise exception using errcode = '22023', message = 'Invalid quantity'; end if;
    select * into v_product from public.products
      where id = (v_line ->> 'product_id')::uuid and is_active and is_available
      for update;
    if not found then raise exception using errcode = '22023', message = 'Product unavailable'; end if;
    if v_product.inventory_quantity is not null and v_product.inventory_quantity < v_qty then
      raise exception using errcode = '22023', message = 'Insufficient product inventory';
    end if;
    v_line_unit := v_product.base_price;
    v_variant := null;
    if nullif(v_line ->> 'variant_id', '') is not null then
      select * into v_variant from public.product_variants
        where id = (v_line ->> 'variant_id')::uuid and product_id = v_product.id and is_available;
      if not found then raise exception using errcode = '22023', message = 'Invalid product variant'; end if;
      v_line_unit := v_line_unit + v_variant.price_delta;
    end if;
    v_snapshot := jsonb_build_object('product_id', v_product.id, 'name', v_product.name,
      'variant', case when v_variant.id is null then null else jsonb_build_object('id', v_variant.id, 'name', v_variant.name, 'price_delta', v_variant.price_delta) end,
      'addons', '[]'::jsonb);
    v_variant := null;
    v_addon_ids := array(select jsonb_array_elements_text(coalesce(v_line -> 'addon_ids', '[]'::jsonb))::uuid);
    if cardinality(v_addon_ids) > 30 then raise exception using errcode = '22023', message = 'Too many product add-ons'; end if;
    if cardinality(v_addon_ids) > 0 then
      if (select count(distinct addon_id) from unnest(v_addon_ids) as selected_addons(addon_id)) <> cardinality(v_addon_ids) then
        raise exception using errcode = '22023', message = 'Duplicate add-on';
      end if;
      for v_addon in select * from public.product_addons
        where id = any(v_addon_ids) and product_id = v_product.id and is_available
      loop
        v_line_unit := v_line_unit + v_addon.price;
        v_snapshot := jsonb_set(v_snapshot, '{addons}',
          (v_snapshot -> 'addons') || jsonb_build_array(jsonb_build_object('id', v_addon.id, 'name', v_addon.name, 'price', v_addon.price)));
      end loop;
      if (select count(*) from public.product_addons where id = any(v_addon_ids) and product_id = v_product.id and is_available) <> cardinality(v_addon_ids) then
        raise exception using errcode = '22023', message = 'Invalid product add-on';
      end if;
    end if;
    v_line_total := round(v_line_unit * v_qty, 2);
    v_subtotal := v_subtotal + v_line_total;
    v_snapshot := v_snapshot || jsonb_build_object('unit_price', v_line_unit);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'quantity', v_qty, 'unit_price', v_line_unit,
      'line_total', v_line_total, 'snapshot', v_snapshot));
  end loop;

  if exists (
    select 1 from public.products p
    join (select (item.value ->> 'product_id')::uuid product_id, sum((item.value ->> 'quantity')::integer)::integer qty
      from jsonb_array_elements(v_items) as item(value) group by (item.value ->> 'product_id')::uuid) q on q.product_id = p.id
    where p.inventory_quantity is not null and p.inventory_quantity < q.qty
  ) then raise exception using errcode = '22023', message = 'Insufficient product inventory'; end if;

  if v_order_type = 'delivery' then
    if length(trim(coalesce(p_payload ->> 'address', ''))) not between 1 and 500
       or length(coalesce(p_payload ->> 'postal_code', '')) > 20 then
      raise exception using errcode = '22023', message = 'Delivery address is invalid';
    end if;
    select * into v_zone from public.delivery_zones where id = (p_payload ->> 'delivery_zone_id')::uuid and is_active;
    if not found then raise exception using errcode = '22023', message = 'Invalid delivery zone'; end if;
    if v_subtotal < v_zone.minimum_order then raise exception using errcode = '22023', message = 'Minimum delivery order not met'; end if;
    if cardinality(v_zone.postal_codes) > 0 and not (upper(trim(coalesce(p_payload ->> 'postal_code', ''))) = any(v_zone.postal_codes)) then
      raise exception using errcode = '22023', message = 'Postal code is outside the delivery zone';
    end if;
    v_delivery_fee := v_zone.fee;
  end if;
  if nullif(p_payload ->> 'coupon_code', '') is not null then
    select * into v_coupon from public.coupons where code = upper(trim(p_payload ->> 'coupon_code'))
      and is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
      and (usage_limit is null or usage_count < usage_limit)
      for update;
    if not found then raise exception using errcode = '22023', message = 'Coupon is invalid or expired'; end if;
    if v_subtotal < v_coupon.minimum_order then raise exception using errcode = '22023', message = 'Coupon minimum order not met'; end if;
    if v_coupon.discount_type = 'percent' then v_discount := round(v_subtotal * v_coupon.discount_value / 100, 2);
    else v_discount := least(v_subtotal, v_coupon.discount_value); end if;
    if v_coupon.maximum_discount is not null then v_discount := least(v_discount, v_coupon.maximum_discount); end if;
    update public.coupons set usage_count = usage_count + 1 where id = v_coupon.id;
  end if;
  v_total := greatest(0, v_subtotal - v_discount + v_delivery_fee);
  if v_order_type = 'dine_in' then
    if length(coalesce(p_payload ->> 'table_token', '')) not between 8 and 200 then raise exception using errcode = '22023', message = 'Table token required'; end if;
    v_table_hash := encode(public.digest(p_payload ->> 'table_token', 'sha256'), 'hex');
    perform 1 from public.dining_tables where token_hash = v_table_hash and is_active;
    if not found then raise exception using errcode = '22023', message = 'Invalid table token'; end if;
  end if;

  v_order_id := gen_random_uuid();
  v_order_number := 'PS-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.orders (id, order_number, idempotency_key, customer_id, customer_name, customer_email, customer_phone,
    order_type, payment_method, subtotal, discount, delivery_fee, total, coupon_id, delivery_zone_id, delivery_address,
    delivery_postal_code, table_token_hash, notes)
  values (v_order_id, v_order_number, (p_payload ->> 'idempotency_key')::uuid, v_user_id,
    p_payload #>> '{customer,name}', v_customer_email, p_payload #>> '{customer,phone}',
    v_order_type, v_payment_method, v_subtotal, v_discount, v_delivery_fee, v_total,
    v_coupon.id, v_zone.id, nullif(p_payload ->> 'address', ''), nullif(p_payload ->> 'postal_code', ''),
    v_table_hash, coalesce(p_payload ->> 'notes', ''));
  for v_line in select value from jsonb_array_elements(v_items) loop
    insert into public.order_items (order_id, product_id, quantity, unit_price, line_total, snapshot)
      values (v_order_id, (v_line ->> 'product_id')::uuid, (v_line ->> 'quantity')::integer,
        (v_line ->> 'unit_price')::numeric, (v_line ->> 'line_total')::numeric, v_line -> 'snapshot');
  end loop;
  update public.products p set inventory_quantity = p.inventory_quantity - q.qty
    from (select product_id, sum(quantity)::integer as qty from public.order_items where order_id = v_order_id group by product_id) q
    where p.id = q.product_id and p.inventory_quantity is not null;
  insert into public.inventory_movements (product_id, quantity_delta, reason, created_by)
    select p.id, -sum(oi.quantity)::integer, 'Order ' || v_order_number, v_user_id
    from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = v_order_id and p.inventory_quantity is not null
    group by p.id;
  insert into public.notifications (order_id, customer_id, type, channel, payload)
    values (v_order_id, v_user_id, 'order_confirmation', 'in_app',
      jsonb_build_object('order_number', v_order_number, 'status', 'pending'));
  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'subtotal', v_subtotal,
    'discount', v_discount, 'delivery_fee', v_delivery_fee, 'total', v_total, 'duplicate', false);
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- F3: kitchen.manage no longer grants blanket SELECT on customer PII.
-- Prep staff read a reduced projection through get_kitchen_orders() below.
-- ---------------------------------------------------------------------------
drop policy if exists "Customers and authorized staff read orders" on public.orders;
create policy "Customers and authorized staff read orders" on public.orders for select to authenticated
  using (
    customer_id = auth.uid()
    or public.has_role(array['admin', 'manager', 'cashier'])
    or (delivery_staff_id = auth.uid() and public.has_role(array['delivery']))
    or public.has_staff_permission('orders.manage')
  );

drop policy if exists "Customers and authorized staff read order items" on public.order_items;
create policy "Customers and authorized staff read order items" on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid()
      or public.has_role(array['admin', 'manager', 'cashier'])
      or (o.delivery_staff_id = auth.uid() and public.has_role(array['delivery']))
      or public.has_staff_permission('orders.manage')
    )
  ));

drop policy if exists "Customers and authorized staff read order option snapshots" on public.order_item_options;
create policy "Customers and authorized staff read order option snapshots" on public.order_item_options for select to authenticated
  using (exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id and (
      o.customer_id = auth.uid()
      or public.has_role(array['admin', 'manager', 'cashier'])
      or (o.delivery_staff_id = auth.uid() and public.has_role(array['delivery']))
      or public.has_staff_permission('orders.manage')
    )
  ));

drop policy if exists "Customers and authorized staff read order status history" on public.order_status_history;
create policy "Customers and authorized staff read order status history" on public.order_status_history for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid()
      or public.has_role(array['admin', 'manager', 'cashier'])
      or (o.delivery_staff_id = auth.uid() and public.has_role(array['delivery']))
      or public.has_staff_permission('orders.manage')
    )
  ));

-- Security-definer projection for the kitchen display: order identity, status,
-- table and item composition only. No email, phone, address, notes or customer id.
create or replace function public.get_kitchen_orders(p_order_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not (
    public.has_role(array['admin', 'manager', 'cashier', 'kitchen'])
    or public.has_staff_permission('kitchen.manage')
    or public.has_staff_permission('orders.manage')
  ) then
    raise exception using errcode = '42501', message = 'Kitchen access required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'order_type', o.order_type,
    'status', o.status,
    'payment_status', o.payment_status,
    'table_label', rt.label,
    'restaurant_table', case when rt.id is null then null else jsonb_build_object('label', rt.label) end,
    'created_at', o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'quantity', oi.quantity,
        'name', coalesce(oi.snapshot ->> 'name', 'Menu item'),
        'snapshot', oi.snapshot
      ) order by oi.id)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb)
  ) order by o.created_at desc), '[]'::jsonb)
  into v_result
  from public.orders o
  left join public.restaurant_tables rt on rt.id = o.restaurant_table_id
  where p_order_id is null or o.id = p_order_id;

  return v_result;
end;
$$;

revoke all on function public.get_kitchen_orders(uuid) from public;
grant execute on function public.get_kitchen_orders(uuid) to authenticated;

commit;
