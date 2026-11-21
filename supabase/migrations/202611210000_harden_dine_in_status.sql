begin;

-- A table QR token must only reveal orders belonging to the table's *current*
-- staff session. Previously an old/copied token could read historic orders.
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
    on ts.id = o.table_session_id
   and ts.restaurant_table_id = rt.id
   and ts.ended_at is null
   and ts.expires_at > now()
  where o.id = p_order_id
    and o.order_type = 'dine_in'
    and rt.is_active
    and rt.qr_token_hash = encode(public.digest(p_raw_token, 'sha256'), 'hex');

  if v_result is null then
    raise exception using errcode = '22023', message = 'Order not found for this table QR';
  end if;
  return v_result;
end;
$$;

revoke all on function public.get_dine_in_order_status(uuid, text) from public;
grant execute on function public.get_dine_in_order_status(uuid, text) to anon, authenticated;

commit;
