begin;

do $$
declare
  v_extension_schema text;
begin
  select n.nspname into v_extension_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if v_extension_schema is null then
    raise exception 'The pgcrypto extension must be installed before migration 003';
  end if;

  if v_extension_schema <> 'public' then
    if to_regprocedure('public.gen_random_bytes(integer)') is null then
      execute format($ddl$
        create function public.gen_random_bytes(p_bytes integer)
        returns bytea
        language sql volatile strict
        set search_path = ''
        as $wrapper$
          select %I.gen_random_bytes(p_bytes)
        $wrapper$
      $ddl$, v_extension_schema);
      revoke all on function public.gen_random_bytes(integer) from public, anon, authenticated;
    end if;

    if to_regprocedure('public.digest(text,text)') is null then
      execute format($ddl$
        create function public.digest(p_data text, p_type text)
        returns bytea
        language sql immutable strict
        set search_path = ''
        as $wrapper$
          select %I.digest(p_data, p_type)
        $wrapper$
      $ddl$, v_extension_schema);
      revoke all on function public.digest(text, text) from public, anon, authenticated;
    end if;

    if to_regprocedure('public.digest(bytea,text)') is null then
      execute format($ddl$
        create function public.digest(p_data bytea, p_type text)
        returns bytea
        language sql immutable strict
        set search_path = ''
        as $wrapper$
          select %I.digest(p_data, p_type)
        $wrapper$
      $ddl$, v_extension_schema);
      revoke all on function public.digest(bytea, text) from public, anon, authenticated;
    end if;
  end if;
end;
$$;

alter table public.restaurant_tables
  add column if not exists qr_token_hash text;

update public.restaurant_tables
set qr_token_hash = encode(public.digest(public.gen_random_bytes(32), 'sha256'), 'hex')
where qr_token_hash is null;

alter table public.restaurant_tables
  alter column qr_token_hash set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.restaurant_tables'::regclass
      and conname = 'restaurant_tables_qr_token_hash_check'
  ) then
    alter table public.restaurant_tables
      add constraint restaurant_tables_qr_token_hash_check
      check (qr_token_hash ~ '^[0-9a-f]{64}$');
  end if;
end;
$$;

create unique index if not exists restaurant_tables_qr_token_hash_idx
  on public.restaurant_tables(qr_token_hash);
create index if not exists orders_table_session_created_idx
  on public.orders(table_session_id, created_at desc)
  where table_session_id is not null;

create or replace function public.sync_table_session_legacy()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_label text;
  v_token_hash text;
  v_accepting_orders boolean;
begin
  select rt.label, rt.qr_token_hash,
    rt.is_active and exists (
      select 1 from public.table_sessions ts
      where ts.restaurant_table_id = rt.id
        and ts.ended_at is null
        and ts.expires_at > now()
    )
  into v_label, v_token_hash, v_accepting_orders
  from public.restaurant_tables rt
  where rt.id = new.restaurant_table_id;

  if v_label is null then
    raise exception using errcode = '22023', message = 'Restaurant table not found';
  end if;

  insert into public.dining_tables(label, token_hash, is_active)
  values (v_label, v_token_hash, v_accepting_orders)
  on conflict (label) do update
    set token_hash = excluded.token_hash,
        is_active = excluded.is_active;
  return new;
end;
$$;

create or replace function public.sync_restaurant_table_legacy()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_accepting_orders boolean;
begin
  select new.is_active and exists (
    select 1 from public.table_sessions ts
    where ts.restaurant_table_id = new.id
      and ts.ended_at is null
      and ts.expires_at > now()
  )
  into v_accepting_orders;

  insert into public.dining_tables(label, token_hash, is_active)
  values (new.label, new.qr_token_hash, v_accepting_orders)
  on conflict (label) do update
    set token_hash = excluded.token_hash,
        is_active = excluded.is_active;

  if not new.is_active then
    update public.table_sessions
    set ended_at = coalesce(ended_at, now()),
        ended_by = coalesce(ended_by, auth.uid())
    where restaurant_table_id = new.id
      and ended_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists restaurant_tables_legacy_sync on public.restaurant_tables;
create trigger restaurant_tables_legacy_sync
  after insert or update of label, qr_token_hash, is_active on public.restaurant_tables
  for each row execute function public.sync_restaurant_table_legacy();

drop trigger if exists table_sessions_legacy_sync on public.table_sessions;
create trigger table_sessions_legacy_sync
  after insert or update of token_hash, expires_at, ended_at on public.table_sessions
  for each row execute function public.sync_table_session_legacy();

update public.restaurant_tables rt
set qr_token_hash = rt.qr_token_hash;

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
      raise exception using errcode = '22023', message = 'Dine-in requires a valid table QR and open session';
    end if;
    select ts.id, ts.restaurant_table_id
      into new.table_session_id, new.restaurant_table_id
    from public.restaurant_tables rt
    join public.table_sessions ts on ts.restaurant_table_id = rt.id
    where rt.qr_token_hash = new.table_token_hash
      and rt.is_active
      and ts.ended_at is null
      and ts.expires_at > now()
    for update of rt, ts;
    if not found then
      raise exception using errcode = '22023', message = 'Table QR is invalid or the table session is closed';
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

create or replace function public.resolve_table_qr(p_raw_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_label text;
begin
  if p_raw_token is null or p_raw_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = '22023', message = 'Table QR is invalid or not accepting orders';
  end if;

  select rt.label into v_label
  from public.restaurant_tables rt
  where rt.qr_token_hash = encode(public.digest(p_raw_token, 'sha256'), 'hex')
    and rt.is_active
    and exists (
      select 1 from public.table_sessions ts
      where ts.restaurant_table_id = rt.id
        and ts.ended_at is null
        and ts.expires_at > now()
    );

  if v_label is null then
    raise exception using errcode = '22023', message = 'Table QR is invalid or not accepting orders';
  end if;
  return jsonb_build_object('table_number', v_label);
end;
$$;

create or replace function public.can_manage_tables()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.has_role(array['admin', 'manager'])
    or (
      public.has_role(array['cashier', 'delivery'])
      and public.has_staff_permission('tables.manage')
    );
$$;

create or replace function public.admin_create_restaurant_table(
  p_label text,
  p_section text,
  p_capacity integer,
  p_raw_token text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_table public.restaurant_tables%rowtype;
begin
  if not public.can_manage_tables() then
    raise exception using errcode = '42501', message = 'Table management permission required';
  end if;
  if length(trim(coalesce(p_label, ''))) not between 1 and 80
     or length(coalesce(p_section, '')) > 80
     or (p_capacity is not null and p_capacity not between 1 and 100)
     or p_raw_token is null or p_raw_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = '22023', message = 'Invalid table details or QR token';
  end if;
  insert into public.restaurant_tables(label, section, capacity, qr_token_hash)
  values (trim(p_label), nullif(trim(p_section), ''), p_capacity,
    encode(public.digest(p_raw_token, 'sha256'), 'hex'))
  returning * into v_table;
  return jsonb_build_object(
    'id', v_table.id,
    'label', v_table.label,
    'section', v_table.section,
    'capacity', v_table.capacity,
    'is_active', v_table.is_active,
    'created_at', v_table.created_at
  );
end;
$$;

create or replace function public.admin_rotate_restaurant_table_qr(
  p_restaurant_table_id uuid,
  p_raw_token text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_table public.restaurant_tables%rowtype;
begin
  if not public.can_manage_tables() then
    raise exception using errcode = '42501', message = 'Table management permission required';
  end if;
  if p_raw_token is null or p_raw_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = '22023', message = 'Invalid QR token';
  end if;
  update public.restaurant_tables
  set qr_token_hash = encode(public.digest(p_raw_token, 'sha256'), 'hex')
  where id = p_restaurant_table_id
  returning * into v_table;
  if not found then
    raise exception using errcode = '22023', message = 'Restaurant table not found';
  end if;
  return jsonb_build_object('id', v_table.id, 'label', v_table.label, 'is_active', v_table.is_active);
end;
$$;

create or replace function public.admin_set_restaurant_table_active(
  p_restaurant_table_id uuid,
  p_is_active boolean
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_table public.restaurant_tables%rowtype;
begin
  if not public.can_manage_tables() then
    raise exception using errcode = '42501', message = 'Table management permission required';
  end if;
  if p_is_active is null then
    raise exception using errcode = '22023', message = 'Table activation state is required';
  end if;
  update public.restaurant_tables
  set is_active = p_is_active
  where id = p_restaurant_table_id
  returning * into v_table;
  if not found then
    raise exception using errcode = '22023', message = 'Restaurant table not found';
  end if;
  return jsonb_build_object('id', v_table.id, 'label', v_table.label, 'is_active', v_table.is_active);
end;
$$;

create or replace function public.open_table_session(
  p_restaurant_table_id uuid,
  p_expires_at timestamptz default (now() + interval '12 hours')
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_is_active boolean;
  v_session_id uuid;
begin
  if not public.can_manage_tables() then
    raise exception using errcode = '42501', message = 'Table management permission required';
  end if;
  if p_expires_at is null
     or p_expires_at <= now()
     or p_expires_at > now() + interval '12 hours' then
    raise exception using errcode = '22023', message = 'Table session expiry must be within 12 hours';
  end if;
  select is_active into v_is_active
  from public.restaurant_tables
  where id = p_restaurant_table_id
  for update;
  if not found or not v_is_active then
    raise exception using errcode = '22023', message = 'Restaurant table is missing or inactive';
  end if;

  update public.table_sessions
  set ended_at = now(), ended_by = auth.uid()
  where restaurant_table_id = p_restaurant_table_id
    and ended_at is null
    and expires_at <= now();

  if exists (
    select 1 from public.table_sessions
    where restaurant_table_id = p_restaurant_table_id
      and ended_at is null
      and expires_at > now()
  ) then
    raise exception using errcode = '22023', message = 'This table already has an open session';
  end if;

  insert into public.table_sessions(
    restaurant_table_id, token_hash, started_by, expires_at
  )
  values (
    p_restaurant_table_id,
    encode(public.digest(public.gen_random_bytes(32), 'sha256'), 'hex'),
    auth.uid(),
    p_expires_at
  )
  returning id into v_session_id;
  return v_session_id;
end;
$$;

create or replace function public.close_table_session(p_table_session_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_manage_tables() then
    raise exception using errcode = '42501', message = 'Table management permission required';
  end if;
  update public.table_sessions
  set ended_at = now(), ended_by = auth.uid()
  where id = p_table_session_id
    and ended_at is null;
  if not found then
    raise exception using errcode = '22023', message = 'Table session is already closed or missing';
  end if;
end;
$$;

drop policy if exists "Public reads active restaurant tables" on public.restaurant_tables;
drop policy if exists "Admins manage restaurant tables" on public.restaurant_tables;
drop policy if exists "Staff read restaurant table metadata" on public.restaurant_tables;
create policy "Staff read restaurant table metadata" on public.restaurant_tables
  for select to authenticated
  using (public.can_manage_tables());

drop policy if exists "Admins read table sessions" on public.table_sessions;
drop policy if exists "Admins create table sessions" on public.table_sessions;
drop policy if exists "Admins end table sessions" on public.table_sessions;
drop policy if exists "Staff read table sessions" on public.table_sessions;
create policy "Staff read table sessions" on public.table_sessions
  for select to authenticated
  using (public.can_manage_tables());

drop policy if exists "Table staff read dine-in session orders" on public.orders;
create policy "Table staff read dine-in session orders" on public.orders
  for select to authenticated
  using (
    order_type = 'dine_in'
    and public.can_manage_tables()
  );
drop policy if exists "Table staff read dine-in session items" on public.order_items;
create policy "Table staff read dine-in session items" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.order_type = 'dine_in'
      and public.can_manage_tables()
  ));

revoke all on public.restaurant_tables from public, anon, authenticated;
grant select (id, label, section, capacity, is_active, created_at, updated_at)
  on public.restaurant_tables to authenticated;
revoke all on public.table_sessions from public, anon, authenticated;
grant select (id, restaurant_table_id, started_by, started_at, expires_at, ended_at, ended_by, created_at)
  on public.table_sessions to authenticated;
revoke select on public.orders from public, anon, authenticated;
grant select (
  id, order_number, customer_id, customer_name, customer_email, customer_phone,
  order_type, status, payment_method, payment_status, subtotal, discount,
  delivery_fee, total, coupon_id, delivery_zone_id, delivery_address,
  delivery_postal_code, notes, delivery_status, delivery_staff_id,
  created_at, updated_at, customer_address_id, delivery_address_snapshot,
  restaurant_table_id, table_session_id, cash_collection_point
) on public.orders to authenticated;

revoke all on function public.resolve_table_qr(text) from public, anon, authenticated;
grant execute on function public.resolve_table_qr(text) to anon, authenticated;
revoke all on function public.can_manage_tables() from public, anon, authenticated;
grant execute on function public.can_manage_tables() to authenticated;
revoke all on function public.admin_create_restaurant_table(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.admin_create_restaurant_table(text, text, integer, text) to authenticated;
revoke all on function public.admin_rotate_restaurant_table_qr(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_rotate_restaurant_table_qr(uuid, text) to authenticated;
revoke all on function public.admin_set_restaurant_table_active(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_restaurant_table_active(uuid, boolean) to authenticated;
revoke all on function public.open_table_session(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.open_table_session(uuid, timestamptz) to authenticated;
revoke all on function public.close_table_session(uuid) from public, anon, authenticated;
grant execute on function public.close_table_session(uuid) to authenticated;
revoke all on function public.start_table_session(uuid, text, timestamptz) from public, anon, authenticated;

commit;
