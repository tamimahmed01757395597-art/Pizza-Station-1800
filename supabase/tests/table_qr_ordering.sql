-- Run only after migrations 001-006 on a disposable/staging Supabase database.
-- All fixtures and test orders are rolled back when the script succeeds.
begin;

do $$
declare
  v_label text := 'QR Test ' || replace(gen_random_uuid()::text, '-', '');
  v_token text := translate(rtrim(encode(public.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  v_invalid_token text := translate(rtrim(encode(public.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  v_table_id uuid;
  v_session_id uuid;
  v_product_id uuid;
  v_order jsonb;
  v_duplicate_order jsonb;
  v_order_payload jsonb;
  v_guest_status jsonb;
  v_order_id uuid;
  v_idempotency_key uuid := gen_random_uuid();
  v_attached_table_id uuid;
  v_attached_session_id uuid;
  v_rejected boolean;
begin
  insert into public.restaurant_tables(label, qr_token_hash)
  values (v_label, encode(public.digest(v_token, 'sha256'), 'hex'))
  returning id into v_table_id;

  insert into public.table_sessions(
    restaurant_table_id, token_hash, expires_at
  ) values (
    v_table_id,
    encode(public.digest(public.gen_random_bytes(32), 'sha256'), 'hex'),
    now() + interval '1 hour'
  ) returning id into v_session_id;

  if public.resolve_table_qr(v_token) ->> 'table_number' <> v_label then
    raise exception 'Valid QR did not resolve to its table label';
  end if;

  insert into public.products(slug, name, base_price, is_active, is_available)
  values (
    'qr-test-' || replace(gen_random_uuid()::text, '-', ''),
    'QR test pizza', 10, true, true
  ) returning id into v_product_id;

  v_order_payload := jsonb_build_object(
    'idempotency_key', v_idempotency_key,
    'order_type', 'dine_in',
    'payment_method', 'cash_at_restaurant',
    'customer', jsonb_build_object(
      'name', 'QR test customer',
      'email', 'qr-test@example.com',
      'phone', '+15555550123'
    ),
    'table_token', v_token,
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'quantity', 1
    ))
  );
  v_order := public.create_order(v_order_payload);
  v_order_id := (v_order ->> 'id')::uuid;

  v_duplicate_order := public.create_order(v_order_payload);
  if (v_duplicate_order ->> 'id')::uuid is distinct from v_order_id
     or v_duplicate_order ->> 'duplicate' <> 'true' then
    raise exception 'An idempotent retry created or returned a different order';
  end if;

  v_guest_status := public.get_dine_in_order_status(v_order_id, v_token);
  if v_guest_status ->> 'status' <> 'pending'
     or v_guest_status ->> 'payment_status' <> 'unpaid'
     or v_guest_status ->> 'table_number' <> v_label
     or jsonb_array_length(v_guest_status -> 'items') <> 1 then
    raise exception 'Guest order status did not return the scoped receipt';
  end if;
  v_rejected := false;
  begin
    perform public.get_dine_in_order_status(v_order_id, v_invalid_token);
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'A different table QR token read this order status';
  end if;

  select restaurant_table_id, table_session_id
  into v_attached_table_id, v_attached_session_id
  from public.orders where id = v_order_id;
  if v_attached_table_id is distinct from v_table_id
     or v_attached_session_id is distinct from v_session_id then
    raise exception 'Order did not attach the server-resolved table and active session';
  end if;

  v_rejected := false;
  begin
    perform public.resolve_table_qr(v_invalid_token);
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Invalid QR token was accepted';
  end if;

  v_rejected := false;
  begin
    perform public.create_order(jsonb_build_object(
      'idempotency_key', gen_random_uuid(),
      'order_type', 'dine_in',
      'payment_method', 'cash_at_restaurant',
      'customer', jsonb_build_object(
        'name', 'QR test customer',
        'email', 'qr-test@example.com',
        'phone', '+15555550123'
      ),
      'table_token', v_invalid_token,
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id,
        'quantity', 1
      ))
    ));
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Order with an invalid QR token was accepted';
  end if;

  update public.table_sessions
  set ended_at = now()
  where id = v_session_id;
  v_rejected := false;
  begin
    perform public.resolve_table_qr(v_token);
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'QR for a closed session was accepted';
  end if;
  v_guest_status := public.get_dine_in_order_status(v_order_id, v_token);
  if v_guest_status ->> 'order_number' is null then
    raise exception 'An existing order status was lost when its table session closed';
  end if;

  v_rejected := false;
  begin
    perform public.create_order(jsonb_build_object(
      'idempotency_key', gen_random_uuid(),
      'order_type', 'dine_in',
      'payment_method', 'cash_at_restaurant',
      'customer', jsonb_build_object(
        'name', 'QR test customer',
        'email', 'qr-test@example.com',
        'phone', '+15555550123'
      ),
      'table_token', v_token,
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id,
        'quantity', 1
      ))
    ));
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Order for a closed session was accepted';
  end if;

  insert into public.restaurant_tables(label, is_active, qr_token_hash)
  values (
    v_label || ' Inactive',
    false,
    encode(public.digest(v_invalid_token, 'sha256'), 'hex')
  );
  v_rejected := false;
  begin
    perform public.resolve_table_qr(v_invalid_token);
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Inactive table QR was accepted';
  end if;

  v_rejected := false;
  begin
    perform public.create_order(jsonb_build_object(
      'idempotency_key', gen_random_uuid(),
      'order_type', 'dine_in',
      'payment_method', 'cash_at_restaurant',
      'customer', jsonb_build_object(
        'name', 'QR test customer',
        'email', 'qr-test@example.com',
        'phone', '+15555550123'
      ),
      'table_token', v_invalid_token,
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id,
        'quantity', 1
      ))
    ));
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Order for an inactive table was accepted';
  end if;
end;
$$;

rollback;
