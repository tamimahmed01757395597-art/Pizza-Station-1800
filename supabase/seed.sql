begin;

insert into public.restaurant_settings (key, value, visibility)
values
  ('restaurant.name', '"Pizza Station - 1800"'::jsonb, 'public'),
  ('restaurant.currency', '"BDT"'::jsonb, 'public'),
  ('restaurant.phone', '"+880 1794-369923"'::jsonb, 'public'),
  ('restaurant.google_maps_url', '"https://www.google.com/maps/place/Pizza+Station+-+1800/@23.8443824,89.9969749,17z/data=!4m7!3m6!1s0x3755f7adc416ff71:0x77f8d6669503d6a6!8m2!3d23.8439359!4d89.9990509!10e9!16s%2Fg%2F11fm9n8c7v"'::jsonb, 'public'),
  ('restaurant.latitude', '23.8439359'::jsonb, 'public'),
  ('restaurant.longitude', '89.9990509'::jsonb, 'public')
on conflict (key) do update
set value = excluded.value,
    visibility = excluded.visibility,
    updated_at = now();

commit;
