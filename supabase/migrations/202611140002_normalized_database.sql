-- Additive, data-preserving extension of 202611140001_initial_schema.sql.
-- No application tables or rows are dropped. The payment-method CHECK is
-- replaced only to admit the normalized value "cash"; historical values remain valid.
begin;

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  recipient_phone text not null,
  address_line1 text not null,
  address_line2 text,
  locality text not null,
  region text,
  postal_code text not null,
  country_code text not null default 'US' check (country_code ~ '^[A-Z]{2}$'),
  delivery_instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists addresses_one_default_per_customer_idx
  on public.addresses(customer_id) where is_default;
create index if not exists addresses_customer_created_idx
  on public.addresses(customer_id, created_at desc);
create index if not exists profiles_email_lower_idx on public.profiles(lower(email));
create index if not exists order_items_order_idx on public.order_items(order_id, id);
create index if not exists order_items_product_idx on public.order_items(product_id) where product_id is not null;

create table if not exists public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null check (permission_key ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists staff_permissions_active_unique_idx
  on public.staff_permissions(profile_id, permission_key) where revoked_at is null;

create table if not exists public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  group_key text not null check (group_key ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  name text not null,
  selection_type text not null default 'multiple' check (selection_type in ('single', 'multiple')),
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer not null default 1 check (max_selections >= 1),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, group_key),
  check (max_selections >= min_selections),
  check (selection_type <> 'single' or max_selections = 1)
);
create index if not exists product_option_groups_product_active_idx
  on public.product_option_groups(product_id, is_active, sort_order);

create table if not exists public.product_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  legacy_addon_id uuid unique references public.product_addons(id) on delete set null,
  name text not null,
  price_delta numeric(10,2) not null default 0 check (price_delta >= 0),
  sort_order integer not null default 0,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);
create index if not exists product_options_group_available_idx
  on public.product_options(group_id, is_available, sort_order);

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  section text,
  capacity integer check (capacity is null or capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restaurant_tables_active_label_idx
  on public.restaurant_tables(is_active, label);

create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  started_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours'),
  ended_at timestamptz,
  ended_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > started_at),
  check (ended_at is null or ended_at >= started_at),
  check (ended_at is not null or ended_by is null)
);
create unique index if not exists table_sessions_one_open_per_table_idx
  on public.table_sessions(restaurant_table_id) where ended_at is null;
create index if not exists table_sessions_expiry_idx
  on public.table_sessions(expires_at) where ended_at is null;

alter table public.orders
  add column if not exists customer_address_id uuid references public.addresses(id) on delete set null,
  add column if not exists delivery_address_snapshot jsonb,
  add column if not exists restaurant_table_id uuid references public.restaurant_tables(id) on delete set null,
  add column if not exists table_session_id uuid references public.table_sessions(id) on delete set null,
  add column if not exists cash_collection_point text;
update public.orders
set cash_collection_point = case
  when order_type = 'delivery' then 'delivery'
  else 'restaurant'
end
where cash_collection_point is distinct from case
  when order_type = 'delivery' then 'delivery'
  else 'restaurant'
end;
alter table public.orders alter column cash_collection_point set default 'restaurant';
alter table public.orders alter column cash_collection_point set not null;
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cash', 'cash_on_delivery', 'cash_at_restaurant'));
alter table public.orders add constraint orders_cash_collection_point_check
  check (cash_collection_point in ('restaurant', 'delivery'));
alter table public.orders add constraint orders_collection_matches_order_type_check
  check ((order_type = 'delivery' and cash_collection_point = 'delivery')
    or (order_type <> 'delivery' and cash_collection_point = 'restaurant'));
create index if not exists orders_address_idx on public.orders(customer_address_id);
create index if not exists orders_table_session_idx on public.orders(table_session_id) where table_session_id is not null;
create index if not exists orders_restaurant_table_idx on public.orders(restaurant_table_id) where restaurant_table_id is not null;
create index if not exists delivery_zones_active_idx on public.delivery_zones(is_active, name);

alter table public.order_items
  add column if not exists product_name_snapshot text not null default 'Unknown product',
  add column if not exists variant_name_snapshot text,
  add column if not exists variant_price_delta_snapshot numeric(10,2) not null default 0
    check (variant_price_delta_snapshot >= 0),
  add column if not exists product_variant_id uuid references public.product_variants(id) on delete set null;
update public.order_items oi
set product_name_snapshot = coalesce(
      nullif(oi.snapshot ->> 'name', ''),
      (select p.name from public.products p where p.id = oi.product_id),
      'Deleted product'
    ),
    variant_name_snapshot = nullif(oi.snapshot #>> '{variant,name}', ''),
    variant_price_delta_snapshot = coalesce((oi.snapshot #>> '{variant,price_delta}')::numeric, 0)
where oi.product_name_snapshot = 'Unknown product';
update public.order_items oi
set product_variant_id = pv.id
from public.product_variants pv
where oi.product_variant_id is null
  and pv.product_id = oi.product_id
  and (oi.snapshot #>> '{variant,id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and pv.id = (oi.snapshot #>> '{variant,id}')::uuid;
create index if not exists order_items_product_variant_idx
  on public.order_items(product_variant_id) where product_variant_id is not null;

create table if not exists public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  product_option_id uuid references public.product_options(id) on delete set null,
  option_group_name_snapshot text not null,
  option_name_snapshot text not null,
  option_price_snapshot numeric(10,2) not null check (option_price_snapshot >= 0),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (order_item_id, product_option_id)
);
create index if not exists order_item_options_item_idx on public.order_item_options(order_item_id);
create index if not exists order_item_options_option_idx
  on public.order_item_options(product_option_id) where product_option_id is not null;

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text check (from_status is null or from_status in (
    'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'
  )),
  to_status text not null check (to_status in (
    'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'
  )),
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_status_history_order_created_idx
  on public.order_status_history(order_id, created_at desc);
create index if not exists order_status_history_actor_idx
  on public.order_status_history(changed_by, created_at desc) where changed_by is not null;

create table if not exists public.cash_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  source_payment_record_id uuid unique references public.payment_records(id) on delete set null,
  method text not null default 'cash' check (method = 'cash'),
  status text not null check (status in ('paid', 'refunded')),
  amount numeric(10,2) not null check (amount > 0),
  received_by uuid not null references public.profiles(id) on delete restrict,
  received_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists cash_payments_received_at_idx on public.cash_payments(received_at desc);
create index if not exists cash_payments_received_by_idx on public.cash_payments(received_by, received_at desc);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid references public.coupons(id) on delete set null,
  coupon_code_snapshot text not null,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  discount_amount numeric(10,2) not null check (discount_amount >= 0),
  status text not null default 'applied' check (status in ('applied', 'voided')),
  redeemed_at timestamptz not null default now(),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'voided') = (voided_at is not null))
);
create index if not exists coupon_redemptions_coupon_created_idx
  on public.coupon_redemptions(coupon_id, redeemed_at desc);
create index if not exists coupon_redemptions_customer_created_idx
  on public.coupon_redemptions(customer_id, redeemed_at desc) where customer_id is not null;

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  status text not null check (status in ('assigned', 'picked_up', 'delivered', 'failed', 'reassigned', 'cancelled')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('delivered', 'failed', 'reassigned', 'cancelled')) = (completed_at is not null))
);
create unique index if not exists delivery_assignments_one_active_idx
  on public.delivery_assignments(order_id) where status in ('assigned', 'picked_up');
create index if not exists delivery_assignments_staff_status_idx
  on public.delivery_assignments(staff_id, status, assigned_at desc);
create index if not exists delivery_assignments_order_idx on public.delivery_assignments(order_id, assigned_at desc);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid unique references public.products(id) on delete set null,
  product_name_snapshot text not null,
  sku text unique,
  is_tracked boolean not null default true,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  unit text not null default 'each',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_items_reorder_idx
  on public.inventory_items(quantity_on_hand, reorder_level) where is_tracked;

insert into public.inventory_items (product_id, product_name_snapshot, is_tracked, quantity_on_hand)
select p.id, p.name, p.inventory_quantity is not null, coalesce(p.inventory_quantity, 0)
from public.products p
on conflict (product_id) do update
set product_name_snapshot = excluded.product_name_snapshot,
    is_tracked = excluded.is_tracked,
    quantity_on_hand = case when excluded.is_tracked then excluded.quantity_on_hand else public.inventory_items.quantity_on_hand end,
    updated_at = now();

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  source_legacy_movement_id uuid unique references public.inventory_movements(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  order_id uuid references public.orders(id) on delete set null,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_item_created_idx
  on public.stock_movements(inventory_item_id, created_at desc);
create index if not exists stock_movements_order_idx
  on public.stock_movements(order_id) where order_id is not null;
create index if not exists stock_movements_actor_created_idx
  on public.stock_movements(created_by, created_at desc) where created_by is not null;

insert into public.stock_movements (
  source_legacy_movement_id, inventory_item_id, product_id, product_name_snapshot,
  quantity_delta, reason, created_by, created_at
)
select im.id, ii.id, p.id, p.name, im.quantity_delta, im.reason, im.created_by, im.created_at
from public.inventory_movements im
join public.products p on p.id = im.product_id
join public.inventory_items ii on ii.product_id = p.id
on conflict (source_legacy_movement_id) do nothing;

create table if not exists public.restaurant_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{0,99}$'),
  value jsonb not null,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete restrict,
  product_name_snapshot text not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 2000),
  is_published boolean not null default false,
  moderated_by uuid references public.profiles(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, product_id, order_id)
);
create index if not exists reviews_published_created_idx
  on public.reviews(created_at desc) where is_published;
create index if not exists reviews_product_published_idx
  on public.reviews(product_id, created_at desc) where is_published;
create index if not exists reviews_customer_created_idx
  on public.reviews(customer_id, created_at desc);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity_table text not null,
  entity_id text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx
  on public.audit_logs(entity_table, entity_id, created_at desc);
create index if not exists audit_logs_actor_created_idx
  on public.audit_logs(actor_id, created_at desc) where actor_id is not null;

alter table public.coupons add column if not exists updated_at timestamptz not null default now();
alter table public.coupons add column if not exists created_at timestamptz not null default now();
alter table public.delivery_zones add column if not exists updated_at timestamptz not null default now();
alter table public.delivery_zones add column if not exists created_at timestamptz not null default now();
alter table public.categories add column if not exists updated_at timestamptz not null default now();
alter table public.product_variants add column if not exists created_at timestamptz not null default now();
alter table public.product_variants add column if not exists updated_at timestamptz not null default now();
alter table public.product_addons add column if not exists created_at timestamptz not null default now();
alter table public.product_addons add column if not exists updated_at timestamptz not null default now();
alter table public.order_items add column if not exists created_at timestamptz not null default now();

insert into public.restaurant_settings (key, value, updated_by, created_at, updated_at)
select s.key, s.value, s.updated_by, s.updated_at, s.updated_at
from public.settings s
on conflict (key) do nothing;

insert into public.restaurant_tables (label, is_active)
select d.label, d.is_active
from public.dining_tables d
on conflict (label) do update set is_active = excluded.is_active;

insert into public.table_sessions (restaurant_table_id, token_hash, expires_at, ended_at)
select rt.id, d.token_hash,
       now() + interval '12 hours',
       case when d.is_active then null else now() end
from public.dining_tables d
join public.restaurant_tables rt on rt.label = d.label
on conflict (token_hash) do nothing;

update public.orders o
set restaurant_table_id = ts.restaurant_table_id,
    table_session_id = ts.id
from public.table_sessions ts
where o.order_type = 'dine_in'
  and o.table_token_hash = ts.token_hash
  and (o.restaurant_table_id is null or o.table_session_id is null);

update public.orders
set delivery_address_snapshot = jsonb_strip_nulls(jsonb_build_object(
  'line1', delivery_address,
  'postal_code', delivery_postal_code
))
where delivery_address_snapshot is null and delivery_address is not null;

insert into public.order_status_history (order_id, from_status, to_status, created_at, note)
select o.id, null, o.status, o.created_at, 'Migrated status snapshot'
from public.orders o
where not exists (select 1 from public.order_status_history h where h.order_id = o.id);

insert into public.coupon_redemptions (
  coupon_id, coupon_code_snapshot, order_id, customer_id, discount_amount, status, redeemed_at, voided_at
)
select o.coupon_id, c.code, o.id, o.customer_id, o.discount,
       case when o.status = 'cancelled' then 'voided' else 'applied' end,
       o.created_at,
       case when o.status = 'cancelled' then o.updated_at else null end
from public.orders o
join public.coupons c on c.id = o.coupon_id
where o.coupon_id is not null
on conflict (order_id) do nothing;

insert into public.cash_payments (
  order_id, source_payment_record_id, status, amount, received_by, received_at, note
)
select pr.order_id, pr.id, pr.status, pr.amount, pr.received_by, pr.received_at, pr.note
from public.payment_records pr
on conflict (source_payment_record_id) do nothing;

insert into public.delivery_assignments (
  order_id, staff_id, assigned_by, status, assigned_at, completed_at
)
select o.id,
       o.delivery_staff_id,
       null,
       case o.delivery_status
         when 'picked_up' then 'picked_up'
         when 'delivered' then 'delivered'
         when 'failed' then 'failed'
         else case when o.status = 'cancelled' then 'cancelled' else 'assigned' end
       end,
       o.updated_at,
       case when o.delivery_status in ('delivered', 'failed') or o.status = 'cancelled' then o.updated_at else null end
from public.orders o
where o.delivery_staff_id is not null
  and o.order_type = 'delivery'
on conflict do nothing;

insert into public.product_option_groups (
  product_id, group_key, name, selection_type, min_selections, max_selections
)
select distinct a.product_id, 'legacy-addons', 'Add-ons', 'multiple', 0, 50
from public.product_addons a
on conflict (product_id, group_key) do nothing;

insert into public.product_options (group_id, legacy_addon_id, name, price_delta, is_available)
select g.id, a.id, a.name, a.price, a.is_available
from public.product_addons a
join public.product_option_groups g
  on g.product_id = a.product_id and g.group_key = 'legacy-addons'
on conflict (legacy_addon_id) do nothing;

insert into public.order_item_options (
  order_item_id, product_option_id, option_group_name_snapshot, option_name_snapshot,
  option_price_snapshot, quantity
)
select oi.id,
       po.id,
       coalesce(pog.name, 'Add-on'),
       coalesce(addon.value ->> 'name', po.name, 'Deleted option'),
       coalesce((addon.value ->> 'price')::numeric, po.price_delta, 0),
       oi.quantity
from public.order_items oi
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(oi.snapshot -> 'addons') = 'array'
    then oi.snapshot -> 'addons' else '[]'::jsonb end
) as addon(value)
left join public.product_options po
  on (addon.value ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and po.legacy_addon_id = (addon.value ->> 'id')::uuid
left join public.product_option_groups pog on pog.id = po.group_id
where not exists (
  select 1 from public.order_item_options existing
  where existing.order_item_id = oi.id
    and existing.product_option_id is not distinct from po.id
    and existing.option_name_snapshot = coalesce(addon.value ->> 'name', po.name, 'Deleted option')
);

create or replace function public.has_staff_permission(p_permission_key text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select
    public.has_role(array['admin', 'manager'])
    or exists (
      select 1 from public.staff_permissions sp
      where sp.profile_id = auth.uid()
        and sp.permission_key = p_permission_key
        and sp.revoked_at is null
    );
$$;

create or replace function public.adjust_inventory(p_product_id uuid, p_quantity_delta integer, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_staff_permission('inventory.manage') then
    raise exception using errcode = '42501', message = 'Inventory authorization required';
  end if;
  if p_quantity_delta = 0 or length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception using errcode = '22023', message = 'Invalid inventory adjustment';
  end if;
  perform set_config('app.stock_reason', trim(p_reason), true);
  update public.products
  set inventory_quantity = coalesce(inventory_quantity, 0) + p_quantity_delta,
      updated_at = now()
  where id = p_product_id
    and coalesce(inventory_quantity, 0) + p_quantity_delta >= 0;
  if not found then
    raise exception using errcode = '22023', message = 'Product not found or inventory would become negative';
  end if;
  insert into public.inventory_movements (product_id, quantity_delta, reason, created_by)
  values (p_product_id, p_quantity_delta, trim(p_reason), auth.uid());
end;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.normalize_order_before_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_collection_point text;
  v_address_snapshot jsonb;
begin
  if new.payment_method is null
     or new.payment_method not in ('cash', 'cash_on_delivery', 'cash_at_restaurant') then
    raise exception using errcode = '22023', message = 'Unsupported cash payment method';
  end if;
  new.payment_method := 'cash';
  v_collection_point := case when new.order_type = 'delivery' then 'delivery' else 'restaurant' end;
  new.cash_collection_point := v_collection_point;

  if new.order_type = 'dine_in' then
    if new.table_token_hash is null then
      raise exception using errcode = '22023', message = 'Dine-in requires an active table session';
    end if;
    select ts.id, ts.restaurant_table_id
      into new.table_session_id, new.restaurant_table_id
    from public.table_sessions ts
    join public.restaurant_tables rt on rt.id = ts.restaurant_table_id
    where ts.token_hash = new.table_token_hash
      and ts.ended_at is null
      and ts.expires_at > now()
      and rt.is_active
    for update of ts;
    if not found then
      raise exception using errcode = '22023', message = 'Dine-in table session is invalid or expired';
    end if;
  else
    new.table_session_id := null;
    new.restaurant_table_id := null;
    new.table_token_hash := null;
  end if;

  if new.customer_address_id is not null then
    select jsonb_strip_nulls(jsonb_build_object(
      'recipient_name', a.recipient_name,
      'recipient_phone', a.recipient_phone,
      'line1', a.address_line1,
      'line2', a.address_line2,
      'locality', a.locality,
      'region', a.region,
      'postal_code', a.postal_code,
      'country_code', a.country_code,
      'delivery_instructions', a.delivery_instructions
    ))
    into v_address_snapshot
    from public.addresses a
    where a.id = new.customer_address_id
      and a.customer_id = new.customer_id;
    if not found then
      raise exception using errcode = '42501', message = 'Address does not belong to this customer';
    end if;
  end if;

  if new.order_type = 'delivery' then
    if v_address_snapshot is not null then
      new.delivery_address_snapshot := v_address_snapshot;
    elsif new.delivery_address_snapshot is null then
      new.delivery_address_snapshot := coalesce(v_address_snapshot, jsonb_strip_nulls(jsonb_build_object(
        'line1', new.delivery_address,
        'postal_code', new.delivery_postal_code
      )));
    end if;
    if jsonb_typeof(new.delivery_address_snapshot) is distinct from 'object'
       or new.delivery_address_snapshot = '{}'::jsonb
       or length(trim(coalesce(new.delivery_address_snapshot ->> 'line1', ''))) = 0 then
      raise exception using errcode = '22023', message = 'Delivery address snapshot is required';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sync_table_session_legacy()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_label text;
begin
  if tg_op = 'UPDATE' then
    if old.token_hash is distinct from new.token_hash then
      update public.dining_tables set is_active = false where token_hash = old.token_hash;
    end if;
  end if;
  select label into v_label from public.restaurant_tables where id = new.restaurant_table_id;
  if new.ended_at is null and new.expires_at > now() then
    insert into public.dining_tables (label, token_hash, is_active)
    values (v_label, new.token_hash, true)
    on conflict (label) do update
      set token_hash = excluded.token_hash, is_active = true;
  else
    update public.dining_tables set is_active = false where token_hash = new.token_hash;
  end if;
  return new;
end;
$$;

create or replace function public.start_table_session(
  p_restaurant_table_id uuid,
  p_raw_token text,
  p_expires_at timestamptz default (now() + interval '12 hours')
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_session_id uuid;
  v_token_hash text;
begin
  if not public.has_role(array['admin', 'manager']) then
    raise exception using errcode = '42501', message = 'Table session authorization required';
  end if;
  if p_raw_token is null or length(p_raw_token) < 32 or length(p_raw_token) > 256
     or p_expires_at <= now() or p_expires_at > now() + interval '12 hours' then
    raise exception using errcode = '22023', message = 'Invalid table token or expiry';
  end if;
  if not exists (select 1 from public.restaurant_tables where id = p_restaurant_table_id and is_active) then
    raise exception using errcode = '22023', message = 'Restaurant table is not active';
  end if;
  v_token_hash := encode(public.digest(p_raw_token, 'sha256'), 'hex');
  update public.table_sessions
    set ended_at = now(), ended_by = auth.uid()
    where restaurant_table_id = p_restaurant_table_id and ended_at is null;
  insert into public.table_sessions (restaurant_table_id, token_hash, started_by, expires_at)
    values (p_restaurant_table_id, v_token_hash, auth.uid(), p_expires_at)
    returning id into v_session_id;
  return v_session_id;
end;
$$;

create or replace function public.sync_order_item_snapshot()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_variant_id uuid;
  v_option_ids uuid[];
  v_group record;
  v_selected_count integer;
  v_matched_count integer;
begin
  if new.product_name_snapshot = 'Unknown product' then
    new.product_name_snapshot := coalesce(
      nullif(new.snapshot ->> 'name', ''),
      (select p.name from public.products p where p.id = new.product_id),
      'Deleted product'
    );
  end if;
  if new.variant_name_snapshot is null then
    new.variant_name_snapshot := nullif(new.snapshot #>> '{variant,name}', '');
  end if;
  if (new.snapshot #>> '{variant,price_delta}') ~ '^[0-9]+(\.[0-9]+)?$' then
    new.variant_price_delta_snapshot := (new.snapshot #>> '{variant,price_delta}')::numeric;
  end if;
  if (new.snapshot #>> '{variant,id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_variant_id := (new.snapshot #>> '{variant,id}')::uuid;
    if exists (select 1 from public.product_variants pv where pv.id = v_variant_id and pv.product_id = new.product_id) then
      new.product_variant_id := v_variant_id;
    end if;
  end if;
  v_option_ids := array(
    select (addon.value ->> 'id')::uuid
    from jsonb_array_elements(
      case when jsonb_typeof(new.snapshot -> 'addons') = 'array'
        then new.snapshot -> 'addons' else '[]'::jsonb end
    ) as addon(value)
    where (addon.value ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );
  select count(distinct po.legacy_addon_id) into v_matched_count
  from public.product_options po
  join public.product_option_groups pog on pog.id = po.group_id
  where po.legacy_addon_id = any(coalesce(v_option_ids, array[]::uuid[]))
    and pog.product_id = new.product_id
    and pog.is_active
    and po.is_available;
  if v_matched_count <> coalesce(cardinality(v_option_ids), 0) then
    raise exception using errcode = '22023', message = 'Selected product options are no longer available';
  end if;
  for v_group in
    select id, min_selections, max_selections
    from public.product_option_groups
    where product_id = new.product_id and is_active
  loop
    select count(*) into v_selected_count
    from public.product_options po
    where po.group_id = v_group.id
      and po.is_available
      and po.legacy_addon_id = any(coalesce(v_option_ids, array[]::uuid[]));
    if v_selected_count < v_group.min_selections or v_selected_count > v_group.max_selections then
      raise exception using errcode = '22023', message = 'Product option selection does not meet its group rules';
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.sync_legacy_addon_to_option()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_sync_flag text := current_setting('app.syncing_menu_option', true);
  v_group_id uuid;
  v_group_active boolean;
begin
  if v_sync_flag = 'true' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  perform set_config('app.syncing_menu_option', 'true', true);
  if tg_op = 'DELETE' then
    delete from public.product_options where legacy_addon_id = old.id;
    perform set_config('app.syncing_menu_option', coalesce(v_sync_flag, ''), true);
    return old;
  end if;

  insert into public.product_option_groups (
    product_id, group_key, name, selection_type, min_selections, max_selections, is_active
  ) values (new.product_id, 'legacy-addons', 'Add-ons', 'multiple', 0, 50, true)
  on conflict (product_id, group_key) do nothing
  returning id into v_group_id;
  if v_group_id is null then
    select id into v_group_id from public.product_option_groups
    where product_id = new.product_id and group_key = 'legacy-addons';
  end if;
  select is_active into v_group_active
  from public.product_option_groups where id = v_group_id;
  insert into public.product_options (
    id, group_id, legacy_addon_id, name, price_delta, is_available, updated_at
  ) values (
    new.id, v_group_id, new.id, new.name, new.price, new.is_available and v_group_active, now()
  )
  on conflict (legacy_addon_id) do update
    set group_id = excluded.group_id,
        name = excluded.name,
        price_delta = excluded.price_delta,
        is_available = excluded.is_available,
        updated_at = now();
  perform set_config('app.syncing_menu_option', coalesce(v_sync_flag, ''), true);
  return new;
end;
$$;

create or replace function public.sync_option_to_legacy_addon()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_sync_flag text := current_setting('app.syncing_menu_option', true);
  v_product_id uuid;
  v_group_active boolean;
  v_addon_id uuid;
begin
  if v_sync_flag = 'true' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  perform set_config('app.syncing_menu_option', 'true', true);
  if tg_op = 'DELETE' then
    if old.legacy_addon_id is not null then
      delete from public.product_addons where id = old.legacy_addon_id;
    end if;
    perform set_config('app.syncing_menu_option', coalesce(v_sync_flag, ''), true);
    return old;
  end if;
  select product_id, is_active into v_product_id, v_group_active
  from public.product_option_groups where id = new.group_id;
  if v_product_id is null then
    raise exception using errcode = '22023', message = 'Product option group not found';
  end if;
  v_addon_id := coalesce(new.legacy_addon_id, new.id);
  if exists (
    select 1 from public.product_addons a
    where a.id = v_addon_id and a.product_id <> v_product_id
  ) then
    raise exception using errcode = '22023', message = 'Legacy option belongs to a different product';
  end if;
  if tg_op = 'UPDATE' then
    if old.legacy_addon_id is not null
       and old.legacy_addon_id is distinct from new.legacy_addon_id then
      delete from public.product_addons where id = old.legacy_addon_id;
    end if;
  end if;
  insert into public.product_addons (id, product_id, name, price, is_available)
  values (v_addon_id, v_product_id, new.name, new.price_delta, new.is_available and v_group_active)
  on conflict (id) do update
    set name = excluded.name, price = excluded.price, is_available = excluded.is_available;
  if new.legacy_addon_id is distinct from v_addon_id then
    update public.product_options set legacy_addon_id = v_addon_id where id = new.id;
  end if;
  perform set_config('app.syncing_menu_option', coalesce(v_sync_flag, ''), true);
  return new;
end;
$$;

create or replace function public.sync_option_group_availability()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_sync_flag text := current_setting('app.syncing_menu_option', true);
begin
  if v_sync_flag = 'true' then return new; end if;
  perform set_config('app.syncing_menu_option', 'true', true);
  update public.product_addons a
  set is_available = po.is_available and new.is_active
  from public.product_options po
  where po.group_id = new.id
    and po.legacy_addon_id = a.id
    and a.is_available is distinct from (po.is_available and new.is_active);
  perform set_config('app.syncing_menu_option', coalesce(v_sync_flag, ''), true);
  return new;
end;
$$;

create or replace function public.snapshot_order_item_options()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_addon jsonb;
  v_option public.product_options%rowtype;
  v_group_name text;
  v_option_id uuid;
  v_option_name text;
  v_option_price numeric(10,2);
begin
  if jsonb_typeof(new.snapshot -> 'addons') is distinct from 'array' then
    return new;
  end if;
  for v_addon in select value from jsonb_array_elements(new.snapshot -> 'addons') loop
    v_option := null;
    v_group_name := null;
    v_option_id := null;
    v_option_name := coalesce(v_addon ->> 'name', 'Selected option');
    v_option_price := case when (v_addon ->> 'price') ~ '^[0-9]+(\.[0-9]+)?$'
      then (v_addon ->> 'price')::numeric else 0 end;
    if (v_addon ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      select po.* into v_option
      from public.product_options po
      join public.product_option_groups pog on pog.id = po.group_id
      where po.legacy_addon_id = (v_addon ->> 'id')::uuid
        and pog.product_id = new.product_id
      limit 1;
      if found then
        v_option_id := v_option.id;
        v_option_name := v_option.name;
        v_option_price := v_option.price_delta;
        select name into v_group_name from public.product_option_groups where id = v_option.group_id;
      end if;
    end if;
    insert into public.order_item_options (
      order_item_id, product_option_id, option_group_name_snapshot,
      option_name_snapshot, option_price_snapshot, quantity
    ) values (
      new.id, v_option_id, coalesce(v_group_name, 'Add-on'), v_option_name, v_option_price, new.quantity
    )
    on conflict (order_item_id, product_option_id) do nothing;
  end loop;
  return new;
end;
$$;

create or replace function public.record_order_events()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('app.current_order_id', new.id::text, true);
  if tg_op = 'INSERT' then
    perform set_config('app.stock_reason', 'Order stock movement', true);
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
      values (new.id, null, new.status, auth.uid());
    if new.coupon_id is not null then
      insert into public.coupon_redemptions (
        coupon_id, coupon_code_snapshot, order_id, customer_id, discount_amount, status
      )
      select new.coupon_id, c.code, new.id, new.customer_id, new.discount, 'applied'
      from public.coupons c where c.id = new.coupon_id
      on conflict (order_id) do nothing;
    end if;
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
      values (new.id, old.status, new.status, auth.uid());
    if new.status = 'cancelled' then
      perform set_config('app.stock_reason', 'Order cancellation restock', true);
      update public.coupon_redemptions
      set status = 'voided', voided_at = now()
      where order_id = new.id and status = 'applied';
      update public.delivery_assignments
      set status = 'cancelled', completed_at = now()
      where order_id = new.id and status in ('assigned', 'picked_up');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.record_cash_payment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_staff_permission('payments.confirm') then
    raise exception using errcode = '42501', message = 'Cash payment permission required';
  end if;
  insert into public.cash_payments (
    order_id, source_payment_record_id, method, status, amount, received_by, received_at, note
  ) values (
    new.order_id, new.id, 'cash', new.status, new.amount, new.received_by, new.received_at, new.note
  )
  on conflict (source_payment_record_id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_product_inventory()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_item_id uuid;
  v_delta integer;
  v_order_text text;
  v_order_id uuid;
  v_reason text;
begin
  insert into public.inventory_items (
    product_id, product_name_snapshot, is_tracked, quantity_on_hand, updated_at
  ) values (
    new.id, new.name, new.inventory_quantity is not null,
    coalesce(new.inventory_quantity, 0), now()
  )
  on conflict (product_id) do update set
    product_name_snapshot = excluded.product_name_snapshot,
    is_tracked = excluded.is_tracked,
    quantity_on_hand = case when excluded.is_tracked
      then excluded.quantity_on_hand else public.inventory_items.quantity_on_hand end,
    updated_at = now()
  returning id into v_item_id;

  if tg_op = 'UPDATE' then
    if new.inventory_quantity is not null
       and old.inventory_quantity is distinct from new.inventory_quantity then
      v_delta := new.inventory_quantity - coalesce(old.inventory_quantity, 0);
      if v_delta <> 0 then
        v_order_text := nullif(current_setting('app.current_order_id', true), '');
        if v_order_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          v_order_id := v_order_text::uuid;
        else
          v_order_id := null;
        end if;
        v_reason := coalesce(
          nullif(current_setting('app.stock_reason', true), ''),
          case when v_order_id is null then 'Product inventory adjustment' else 'Order stock movement' end
        );
        if v_order_id is null and not public.has_staff_permission('inventory.manage') then
          raise exception using errcode = '42501', message = 'Inventory permission required';
        end if;
        insert into public.stock_movements (
          inventory_item_id, product_id, product_name_snapshot, order_id,
          quantity_delta, reason, created_by
        ) values (
          v_item_id, new.id, new.name, v_order_id, v_delta, v_reason, auth.uid()
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.record_delivery_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_assignment_status text;
begin
  if new.order_type <> 'delivery' then return new; end if;
  if tg_op = 'INSERT' then
    if new.delivery_staff_id is not null then
      insert into public.delivery_assignments (order_id, staff_id, assigned_by, status)
        values (new.id, new.delivery_staff_id, auth.uid(), 'assigned');
    end if;
    return new;
  end if;
  if new.delivery_staff_id is distinct from old.delivery_staff_id then
    if new.delivery_staff_id is not null then
      update public.delivery_assignments
      set status = 'reassigned', completed_at = now()
      where order_id = new.id and status in ('assigned', 'picked_up');
      insert into public.delivery_assignments (order_id, staff_id, assigned_by, status)
        values (new.id, new.delivery_staff_id, auth.uid(), 'assigned');
    end if;
  elsif new.delivery_status is distinct from old.delivery_status then
    v_assignment_status := case new.delivery_status
      when 'picked_up' then 'picked_up'
      when 'delivered' then 'delivered'
      when 'failed' then 'failed'
      else null
    end;
    if v_assignment_status is not null then
      update public.delivery_assignments
      set status = v_assignment_status,
          completed_at = case when v_assignment_status in ('delivered', 'failed') then now() else null end
      where order_id = new.id and status in ('assigned', 'picked_up');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_order_staff_permissions()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.delivery_status is distinct from old.delivery_status
     and not public.has_staff_permission('delivery.update')
     and not public.has_staff_permission('orders.manage') then
    raise exception using errcode = '42501', message = 'Delivery update permission required';
  end if;
  if new.status is distinct from old.status
     and new.status not in ('out_for_delivery', 'completed')
     and not public.has_staff_permission('orders.manage') then
    raise exception using errcode = '42501', message = 'Order management permission required';
  end if;
  if new.status is distinct from old.status
     and new.status in ('out_for_delivery', 'completed')
     and old.order_type = 'delivery'
     and not public.has_staff_permission('delivery.update')
     and not public.has_staff_permission('orders.manage') then
    raise exception using errcode = '42501', message = 'Delivery update permission required';
  end if;
  return new;
end;
$$;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_id := coalesce(v_new ->> 'id', v_new ->> 'key', '');
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_id := coalesce(v_new ->> 'id', v_new ->> 'key', '');
  else
    v_old := to_jsonb(old);
    v_id := coalesce(v_old ->> 'id', v_old ->> 'key', '');
  end if;
  insert into public.audit_logs (actor_id, action, entity_table, entity_id, old_data, new_data)
    values (auth.uid(), lower(tg_op), tg_table_name, v_id, v_old, v_new);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.guard_review_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.customer_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'Reviews must belong to the authenticated customer';
  end if;
  if not exists (
    select 1 from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.id = new.order_id
      and o.customer_id = auth.uid()
      and o.status = 'completed'
      and oi.product_id = new.product_id
  ) then
    raise exception using errcode = '42501', message = 'A completed order for this product is required';
  end if;
  new.product_name_snapshot := coalesce(
    (select p.name from public.products p where p.id = new.product_id),
    new.product_name_snapshot
  );
  return new;
end;
$$;

drop trigger if exists table_sessions_legacy_sync on public.table_sessions;
create trigger table_sessions_legacy_sync
  after insert or update of token_hash, expires_at, ended_at on public.table_sessions
  for each row execute function public.sync_table_session_legacy();

drop trigger if exists orders_normalize_before_insert on public.orders;
create trigger orders_normalize_before_insert
  before insert on public.orders
  for each row execute function public.normalize_order_before_insert();
drop trigger if exists orders_staff_permission_guard on public.orders;
create trigger orders_staff_permission_guard
  before update on public.orders
  for each row execute function public.guard_order_staff_permissions();
drop trigger if exists orders_event_history on public.orders;
create trigger orders_event_history
  after insert or update of status on public.orders
  for each row execute function public.record_order_events();
drop trigger if exists orders_delivery_assignment_history on public.orders;
create trigger orders_delivery_assignment_history
  after insert or update of delivery_status, delivery_staff_id on public.orders
  for each row execute function public.record_delivery_assignment();

drop trigger if exists order_items_snapshot_before_insert on public.order_items;
create trigger order_items_snapshot_before_insert
  before insert on public.order_items
  for each row execute function public.sync_order_item_snapshot();
drop trigger if exists order_items_options_after_insert on public.order_items;
create trigger order_items_options_after_insert
  after insert on public.order_items
  for each row execute function public.snapshot_order_item_options();
drop trigger if exists product_addons_option_sync on public.product_addons;
create trigger product_addons_option_sync
  after insert or update or delete on public.product_addons
  for each row execute function public.sync_legacy_addon_to_option();
drop trigger if exists product_options_legacy_sync on public.product_options;
create trigger product_options_legacy_sync
  after insert or update or delete on public.product_options
  for each row execute function public.sync_option_to_legacy_addon();
drop trigger if exists product_option_group_availability_sync on public.product_option_groups;
create trigger product_option_group_availability_sync
  after update of is_active on public.product_option_groups
  for each row execute function public.sync_option_group_availability();

drop trigger if exists payment_records_cash_history on public.payment_records;
create trigger payment_records_cash_history
  after insert on public.payment_records
  for each row execute function public.record_cash_payment();

drop trigger if exists products_inventory_sync on public.products;
create trigger products_inventory_sync
  after insert or update of name, inventory_quantity on public.products
  for each row execute function public.sync_product_inventory();

drop trigger if exists reviews_owner_order_guard on public.reviews;
create trigger reviews_owner_order_guard
  before insert on public.reviews
  for each row execute function public.guard_review_insert();

drop trigger if exists addresses_updated_at on public.addresses;
create trigger addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();
drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
drop trigger if exists variants_updated_at on public.product_variants;
create trigger variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
drop trigger if exists addons_updated_at on public.product_addons;
create trigger addons_updated_at before update on public.product_addons
  for each row execute function public.set_updated_at();
drop trigger if exists option_groups_updated_at on public.product_option_groups;
create trigger option_groups_updated_at before update on public.product_option_groups
  for each row execute function public.set_updated_at();
drop trigger if exists options_updated_at on public.product_options;
create trigger options_updated_at before update on public.product_options
  for each row execute function public.set_updated_at();
drop trigger if exists tables_updated_at on public.restaurant_tables;
create trigger tables_updated_at before update on public.restaurant_tables
  for each row execute function public.set_updated_at();
drop trigger if exists inventory_items_updated_at on public.inventory_items;
create trigger inventory_items_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();
drop trigger if exists restaurant_settings_updated_at on public.restaurant_settings;
create trigger restaurant_settings_updated_at before update on public.restaurant_settings
  for each row execute function public.set_updated_at();
drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();
drop trigger if exists delivery_assignments_updated_at on public.delivery_assignments;
create trigger delivery_assignments_updated_at before update on public.delivery_assignments
  for each row execute function public.set_updated_at();
drop trigger if exists coupons_updated_at on public.coupons;
create trigger coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();
drop trigger if exists zones_updated_at on public.delivery_zones;
create trigger zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();

drop trigger if exists products_audit on public.products;
create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.audit_row_change();
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();
drop trigger if exists orders_audit on public.orders;
create trigger orders_audit after insert or update or delete on public.orders
  for each row execute function public.audit_row_change();
drop trigger if exists coupons_audit on public.coupons;
create trigger coupons_audit after insert or update or delete on public.coupons
  for each row execute function public.audit_row_change();
drop trigger if exists delivery_zones_audit on public.delivery_zones;
create trigger delivery_zones_audit after insert or update or delete on public.delivery_zones
  for each row execute function public.audit_row_change();
drop trigger if exists restaurant_settings_audit on public.restaurant_settings;
create trigger restaurant_settings_audit after insert or update or delete on public.restaurant_settings
  for each row execute function public.audit_row_change();

alter table public.addresses enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.product_options enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.table_sessions enable row level security;
alter table public.order_item_options enable row level security;
alter table public.order_status_history enable row level security;
alter table public.cash_payments enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Customers manage own addresses" on public.addresses;
create policy "Customers manage own addresses" on public.addresses for all to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid() and public.has_role(array['customer']));

drop policy if exists "Staff read own permissions" on public.staff_permissions;
create policy "Staff read own permissions" on public.staff_permissions for select to authenticated
  using (profile_id = auth.uid() or public.has_role(array['admin']));
drop policy if exists "Admins manage staff permissions" on public.staff_permissions;
create policy "Admins manage staff permissions" on public.staff_permissions for all to authenticated
  using (public.has_role(array['admin']))
  with check (public.has_role(array['admin']));

drop policy if exists "Public reads active option groups" on public.product_option_groups;
create policy "Public reads active option groups" on public.product_option_groups for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.products p where p.id = product_id and p.is_active and p.is_available
  ));
drop policy if exists "Admins manage option groups" on public.product_option_groups;
create policy "Admins manage option groups" on public.product_option_groups for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));

drop policy if exists "Public reads available product options" on public.product_options;
create policy "Public reads available product options" on public.product_options for select to anon, authenticated
  using (is_available and exists (
    select 1 from public.product_option_groups g
    join public.products p on p.id = g.product_id
    where g.id = group_id and g.is_active and p.is_active and p.is_available
  ));
drop policy if exists "Admins manage product options" on public.product_options;
create policy "Admins manage product options" on public.product_options for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));

drop policy if exists "Public reads active restaurant tables" on public.restaurant_tables;
create policy "Public reads active restaurant tables" on public.restaurant_tables for select to anon, authenticated
  using (is_active);
drop policy if exists "Admins manage restaurant tables" on public.restaurant_tables;
create policy "Admins manage restaurant tables" on public.restaurant_tables for all to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));

drop policy if exists "Admins read table sessions" on public.table_sessions;
create policy "Admins read table sessions" on public.table_sessions for select to authenticated
  using (public.has_role(array['admin', 'manager']));
drop policy if exists "Admins create table sessions" on public.table_sessions;
create policy "Admins create table sessions" on public.table_sessions for insert to authenticated
  with check (public.has_role(array['admin', 'manager']));
drop policy if exists "Admins end table sessions" on public.table_sessions;
create policy "Admins end table sessions" on public.table_sessions for update to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));

drop policy if exists "Customers read own order option snapshots" on public.order_item_options;
create policy "Customers read own order option snapshots" on public.order_item_options for select to authenticated
  using (exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id and (
      o.customer_id = auth.uid()
      or public.has_role(array['admin', 'manager', 'cashier'])
      or (o.delivery_staff_id = auth.uid() and public.has_role(array['delivery']))
    )
  ));

drop policy if exists "Customers read own order status history" on public.order_status_history;
create policy "Customers read own order status history" on public.order_status_history for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid()
      or public.has_role(array['admin', 'manager', 'cashier'])
      or (o.delivery_staff_id = auth.uid() and public.has_role(array['delivery']))
    )
  ));

drop policy if exists "Customers and cashiers read cash payments" on public.cash_payments;
create policy "Customers and cashiers read cash payments" on public.cash_payments for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid()
      or public.has_staff_permission('payments.confirm')
    )
  ));

drop policy if exists "Customers and admins read coupon redemptions" on public.coupon_redemptions;
create policy "Customers and admins read coupon redemptions" on public.coupon_redemptions for select to authenticated
  using (customer_id = auth.uid() or public.has_role(array['admin', 'manager']));

drop policy if exists "Assigned staff and order owners read delivery assignments" on public.delivery_assignments;
create policy "Assigned staff and order owners read delivery assignments" on public.delivery_assignments for select to authenticated
  using (
    staff_id = auth.uid()
    or public.has_role(array['admin', 'manager'])
    or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

drop policy if exists "Inventory staff read inventory items" on public.inventory_items;
create policy "Inventory staff read inventory items" on public.inventory_items for select to authenticated
  using (public.has_staff_permission('inventory.manage'));
drop policy if exists "Inventory staff read stock movements" on public.stock_movements;
create policy "Inventory staff read stock movements" on public.stock_movements for select to authenticated
  using (public.has_staff_permission('inventory.manage'));

drop policy if exists "Public reads public restaurant settings" on public.restaurant_settings;
create policy "Public reads public restaurant settings" on public.restaurant_settings for select to anon, authenticated
  using (visibility = 'public');
drop policy if exists "Admins manage restaurant settings" on public.restaurant_settings;
create policy "Admins manage restaurant settings" on public.restaurant_settings for all to authenticated
  using (public.has_role(array['admin']))
  with check (public.has_role(array['admin']));

drop policy if exists "Public reads published reviews" on public.reviews;
create policy "Public reads published reviews" on public.reviews for select to anon, authenticated
  using (is_published or customer_id = auth.uid() or public.has_role(array['admin', 'manager']));
drop policy if exists "Customers create reviews for completed orders" on public.reviews;
create policy "Customers create reviews for completed orders" on public.reviews for insert to authenticated
  with check (
    customer_id = auth.uid()
    and public.has_role(array['customer'])
    and exists (
      select 1 from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.id = order_id and o.customer_id = auth.uid()
        and o.status = 'completed' and oi.product_id = product_id
    )
  );
drop policy if exists "Admins moderate reviews" on public.reviews;
create policy "Admins moderate reviews" on public.reviews for update to authenticated
  using (public.has_role(array['admin', 'manager']))
  with check (public.has_role(array['admin', 'manager']));

drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs" on public.audit_logs for select to authenticated
  using (public.has_role(array['admin']));

grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, update, delete on public.staff_permissions to authenticated;
grant select, insert, update, delete on public.product_option_groups, public.product_options to authenticated;
grant select, insert, update, delete on public.restaurant_tables to authenticated;
grant select on public.product_option_groups, public.product_options, public.restaurant_tables to anon;
grant select on public.order_item_options, public.order_status_history, public.cash_payments,
  public.coupon_redemptions, public.delivery_assignments, public.inventory_items, public.stock_movements to authenticated;
grant select, insert, update, delete on public.restaurant_settings, public.reviews to authenticated;
grant select on public.restaurant_settings, public.reviews to anon;
grant select on public.audit_logs to authenticated;
revoke all on function public.has_staff_permission(text) from public, anon;
grant execute on function public.has_staff_permission(text) to authenticated;
revoke all on function public.start_table_session(uuid, text, timestamptz) from public, anon;
grant execute on function public.start_table_session(uuid, text, timestamptz) to authenticated;
grant select, update on public.table_sessions to authenticated;

commit;
