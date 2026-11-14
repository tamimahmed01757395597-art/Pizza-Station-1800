create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin', 'manager', 'cashier', 'delivery')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          new.raw_user_meta_data ->> 'phone', 'customer');
  return new;
end;
$$;
create trigger auth_user_profile_created after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create or replace function public.prevent_profile_role_escalation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
     and (new.role is distinct from old.role or new.email is distinct from old.email) then
    raise exception 'Profile role and email cannot be changed by this user';
  end if;
  return new;
end;
$$;
create trigger profile_role_guard before update on public.profiles
for each row execute function public.prevent_profile_role_escalation();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  slug text not null unique,
  name text not null,
  description text not null default '',
  base_price numeric(10,2) not null check (base_price >= 0),
  image_url text,
  is_active boolean not null default true,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  inventory_quantity integer check (inventory_quantity is null or inventory_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price_delta numeric(10,2) not null default 0 check (price_delta >= 0),
  is_available boolean not null default true,
  unique (product_id, name)
);
create table public.product_addons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  is_available boolean not null default true,
  unique (product_id, name)
);
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fee numeric(10,2) not null default 0 check (fee >= 0),
  minimum_order numeric(10,2) not null default 0 check (minimum_order >= 0),
  postal_codes text[] not null default '{}',
  is_active boolean not null default true
);
create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  token_hash text not null unique,
  is_active boolean not null default true
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0 and (discount_type <> 'percent' or discount_value <= 100)),
  minimum_order numeric(10,2) not null default 0 check (minimum_order >= 0),
  maximum_discount numeric(10,2) check (maximum_discount is null or maximum_discount >= 0),
  usage_limit integer check (usage_limit is null or usage_limit >= 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  idempotency_key uuid not null unique,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  order_type text not null check (order_type in ('dine_in', 'delivery', 'pickup')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled')),
  payment_method text not null check (payment_method in ('cash_on_delivery', 'cash_at_restaurant')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  discount numeric(10,2) not null default 0 check (discount >= 0),
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  total numeric(10,2) not null check (total >= 0),
  coupon_id uuid references public.coupons(id) on delete set null,
  delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  delivery_address text,
  delivery_postal_code text,
  table_token_hash text,
  notes text not null default '',
  delivery_status text check (delivery_status is null or delivery_status in ('assigned', 'picked_up', 'delivered', 'failed')),
  delivery_staff_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total = subtotal - discount + delivery_fee)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  snapshot jsonb not null
);
create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in ('paid', 'refunded')),
  amount numeric(10,2) not null check (amount > 0),
  received_by uuid not null references public.profiles(id),
  received_at timestamptz not null default now(),
  note text
);
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  type text not null,
  channel text not null check (channel in ('in_app', 'email')),
  payload jsonb not null default '{}',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index orders_status_created_idx on public.orders(status, created_at desc);
create index products_active_category_idx on public.products(is_active, category_id);

create or replace function public.has_role(p_roles text[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = any(p_roles));
$$;

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

  perform pg_advisory_xact_lock(hashtext(p_payload ->> 'idempotency_key'));
  select id, order_number into v_order_id, v_order_number
    from public.orders where idempotency_key = (p_payload ->> 'idempotency_key')::uuid;
  if v_order_id is not null then
    if (select customer_id from public.orders where id = v_order_id) is distinct from v_user_id then
      raise exception using errcode = '42501', message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'duplicate', true);
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
    p_payload #>> '{customer,name}', p_payload #>> '{customer,email}', p_payload #>> '{customer,phone}',
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

create or replace function public.confirm_cash_payment(p_order_id uuid, p_status text, p_amount numeric, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'manager', 'cashier') then raise exception using errcode = '42501', message = 'Cashier authorization required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Order not found'; end if;
  if p_status not in ('paid', 'refunded') then raise exception using errcode = '22023', message = 'Invalid payment status'; end if;
  if p_amount <= 0 or p_amount <> v_order.total then
    raise exception using errcode = '22023', message = 'Payment amount does not match order total';
  end if;
  if p_status = 'refunded' and v_order.payment_status <> 'paid' then
    raise exception using errcode = '22023', message = 'Only paid orders can be refunded';
  end if;
  if p_status = 'paid' and v_order.payment_status <> 'unpaid' then
    raise exception using errcode = '22023', message = 'Order is not awaiting payment';
  end if;
  update public.orders set payment_status = p_status, updated_at = now() where id = p_order_id;
  insert into public.payment_records (order_id, status, amount, received_by, note)
    values (p_order_id, p_status, p_amount, auth.uid(), p_note);
  insert into public.notifications (order_id, customer_id, type, channel, payload)
    values (p_order_id, v_order.customer_id, 'payment_status', 'in_app',
      jsonb_build_object('order_number', v_order.order_number, 'payment_status', p_status));
end;
$$;

create or replace function public.adjust_inventory(p_product_id uuid, p_quantity_delta integer, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_role(array['admin', 'manager']) then
    raise exception using errcode = '42501', message = 'Inventory authorization required';
  end if;
  if p_quantity_delta = 0 or length(trim(p_reason)) = 0 then
    raise exception using errcode = '22023', message = 'Invalid inventory adjustment';
  end if;
  update public.products set inventory_quantity = coalesce(inventory_quantity, 0) + p_quantity_delta,
    updated_at = now()
    where id = p_product_id and coalesce(inventory_quantity, 0) + p_quantity_delta >= 0;
  if not found then raise exception using errcode = '22023', message = 'Product not found or inventory would become negative'; end if;
  insert into public.inventory_movements (product_id, quantity_delta, reason, created_by)
    values (p_product_id, p_quantity_delta, trim(p_reason), auth.uid());
end;
$$;

create or replace function public.update_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_allowed boolean := false;
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'manager') then
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

create or replace function public.update_delivery(p_order_id uuid, p_status text, p_staff_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_role text;
  v_next_order_status text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'manager', 'delivery') then
    raise exception using errcode = '42501', message = 'Delivery authorization required';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.order_type <> 'delivery' then
    raise exception using errcode = 'P0002', message = 'Delivery order not found';
  end if;
  if v_role = 'delivery' and v_order.delivery_staff_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'This delivery is not assigned to you';
  end if;
  if p_status = 'assigned' then
    if v_role not in ('admin', 'manager') or p_staff_id is null
       or not exists (select 1 from public.profiles where id = p_staff_id and role = 'delivery') then
      raise exception using errcode = '42501', message = 'A valid delivery staff assignment is required';
    end if;
    if v_order.status not in ('ready', 'out_for_delivery') then
      raise exception using errcode = '22023', message = 'Order is not ready for delivery assignment';
    end if;
  elsif p_status = 'picked_up' then
    if v_order.delivery_status is distinct from 'assigned' then raise exception using errcode = '22023', message = 'Delivery must be assigned before pickup'; end if;
    v_next_order_status := 'out_for_delivery';
  elsif p_status = 'delivered' then
    if v_order.delivery_status is distinct from 'picked_up' then raise exception using errcode = '22023', message = 'Delivery must be picked up before completion'; end if;
    v_next_order_status := 'completed';
  elsif p_status = 'failed' then
    if v_order.delivery_status is null or v_order.delivery_status not in ('assigned', 'picked_up') then raise exception using errcode = '22023', message = 'Delivery cannot be marked failed'; end if;
  else
    raise exception using errcode = '22023', message = 'Invalid delivery status';
  end if;
  update public.orders set delivery_status = p_status,
    delivery_staff_id = case when p_status = 'assigned' then p_staff_id else delivery_staff_id end,
    status = coalesce(v_next_order_status, status), updated_at = now()
    where id = p_order_id;
  insert into public.notifications (order_id, customer_id, type, channel, payload)
    values (p_order_id, v_order.customer_id, 'delivery_status', 'in_app',
      jsonb_build_object('order_number', v_order.order_number, 'delivery_status', p_status));
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_addons enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.dining_tables enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_records enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.settings enable row level security;
alter table public.notifications enable row level security;

create policy "Profiles are visible to their owner and admins" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(array['admin']));
create policy "Customers update own non-role profile fields" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "Public reads active categories" on public.categories for select to anon, authenticated using (is_active or public.has_role(array['admin', 'manager']));
create policy "Public reads active products" on public.products for select to anon, authenticated using ((is_active and is_available) or public.has_role(array['admin', 'manager']));
create policy "Public reads variants of active products" on public.product_variants for select to anon, authenticated using (is_available and exists (select 1 from public.products p where p.id = product_id and p.is_active and p.is_available));
create policy "Public reads addons of active products" on public.product_addons for select to anon, authenticated using (is_available and exists (select 1 from public.products p where p.id = product_id and p.is_active and p.is_available));
create policy "Public reads active delivery zones" on public.delivery_zones for select to anon, authenticated using (is_active);
create policy "Public cannot read table tokens" on public.dining_tables for select to anon, authenticated using (false);
create policy "Customers read own orders" on public.orders for select to authenticated using (customer_id = auth.uid() or public.has_role(array['admin', 'manager', 'cashier']) or (delivery_staff_id = auth.uid() and public.has_role(array['delivery'])));
create policy "Customers read own order items" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.has_role(array['admin', 'manager', 'cashier']) or (o.delivery_staff_id = auth.uid() and public.has_role(array['delivery'])))));
create policy "Authorized staff read payments" on public.payment_records for select to authenticated using (public.has_role(array['admin', 'manager', 'cashier']));
create policy "Authorized staff read inventory movements" on public.inventory_movements for select to authenticated using (public.has_role(array['admin', 'manager']));
create policy "Customers read own notifications" on public.notifications for select to authenticated using (customer_id = auth.uid() or public.has_role(array['admin', 'manager']));
create policy "Admins manage profiles" on public.profiles for all to authenticated
  using (public.has_role(array['admin']))
  with check (public.has_role(array['admin']));
create policy "Admins manage categories" on public.categories for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));
create policy "Admins manage products" on public.products for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));
create policy "Admins manage variants" on public.product_variants for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));
create policy "Admins manage addons" on public.product_addons for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));
create policy "Admins manage zones" on public.delivery_zones for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));
create policy "Admins manage coupons" on public.coupons for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));
create policy "Admins manage orders" on public.orders for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));
create policy "Admins manage order items" on public.order_items for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));
create policy "Admins manage inventory movements" on public.inventory_movements for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));
create policy "Admins manage settings" on public.settings for all to authenticated
  using (public.has_role(array['admin']))
  with check (public.has_role(array['admin']));

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;
revoke all on function public.confirm_cash_payment(uuid, text, numeric, text) from public;
grant execute on function public.confirm_cash_payment(uuid, text, numeric, text) to authenticated;
revoke all on function public.adjust_inventory(uuid, integer, text) from public;
grant execute on function public.adjust_inventory(uuid, integer, text) to authenticated;
revoke all on function public.update_order_status(uuid, text) from public;
grant execute on function public.update_order_status(uuid, text) to authenticated;
revoke all on function public.update_delivery(uuid, text, uuid) from public;
grant execute on function public.update_delivery(uuid, text, uuid) to authenticated;

grant select on public.categories, public.products, public.product_variants, public.product_addons, public.delivery_zones to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.orders, public.order_items, public.notifications to authenticated;
grant select on public.payment_records, public.inventory_movements, public.settings to authenticated;
grant select on public.coupons to authenticated;
grant insert, update, delete on public.categories, public.products, public.product_variants, public.product_addons,
  public.delivery_zones, public.coupons, public.settings to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy "Product images are publicly readable" on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
create policy "Product images are managed by admin staff" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_role(array['admin', 'manager']));
create policy "Product images are updated by admin staff" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_role(array['admin', 'manager']))
  with check (bucket_id = 'product-images' and public.has_role(array['admin', 'manager']));
create policy "Product images are deleted by admin staff" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_role(array['admin', 'manager']));
