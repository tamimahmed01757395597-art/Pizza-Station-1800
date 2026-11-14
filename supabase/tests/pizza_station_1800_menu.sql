begin;

do $$
declare
  v_products integer;
  v_categories integer;
begin
  select count(*), count(distinct category_id)
    into v_products, v_categories
  from public.products
  where slug like 'ps1800-%';

  if v_products <> 123 then
    raise exception 'Expected 123 Pizza Station menu products, found %', v_products;
  end if;
  if v_categories <> 23 then
    raise exception 'Expected menu products in 23 categories, found %', v_categories;
  end if;

  if not exists (
    select 1
    from public.products p
    join public.product_variants v on v.product_id = p.id
    where p.slug = 'ps1800-regular-chicken-pizza'
      and v.name = 'Large'
      and p.base_price + v.price_delta = 750
  ) then
    raise exception 'Regular Chicken Pizza large size should cost BDT 750';
  end if;

  if not exists (
    select 1
    from public.products p
    join public.product_addons a on a.product_id = p.id
    where p.slug = 'ps1800-beef-burger'
      and a.name = 'Extra Cheese'
      and a.price = 50
  ) then
    raise exception 'Beef Burger extra cheese should cost BDT 50';
  end if;

  if not exists (
    select 1
    from public.restaurant_settings
    where key = 'restaurant.phone'
      and value = to_jsonb('+880 1794-369923'::text)
  ) then
    raise exception 'Restaurant phone setting was not created';
  end if;
end;
$$;

rollback;
