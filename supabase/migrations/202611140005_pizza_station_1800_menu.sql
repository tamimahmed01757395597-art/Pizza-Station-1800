begin;

insert into public.categories (name, slug, sort_order, is_active)
values
  ('Pizza', 'pizza', 1, true),
  ('Starters', 'starters', 2, true),
  ('Burgers', 'burgers', 3, true),
  ('Pasta', 'pasta', 4, true),
  ('Shawarma', 'shawarma', 5, true),
  ('Meatbox', 'meatbox', 6, true),
  ('Sub-Sandwich', 'sub-sandwich', 7, true),
  ('Shakes & Coffees', 'shakes-coffees', 8, true),
  ('Falooda & Lassi', 'falooda-lassi', 9, true),
  ('Mocktails', 'mocktails', 10, true),
  ('Juices', 'juices', 11, true),
  ('Biryani', 'biryani', 12, true),
  ('Indian Curry', 'indian-curry', 13, true),
  ('Soup', 'soup', 14, true),
  ('Chow Mein', 'chow-mein', 15, true),
  ('Salad', 'salad', 16, true),
  ('Fried Rice', 'fried-rice', 17, true),
  ('Curry', 'curry', 18, true),
  ('Combo Packs', 'combo-packs', 19, true),
  ('Naan Roti Platter', 'naan-roti-platter', 20, true),
  ('Set Menu', 'set-menu', 21, true),
  ('Couple Platter', 'couple-platter', 22, true),
  ('Whole Chicken Dish', 'whole-chicken-dish', 23, true)
on conflict do nothing;

with menu_items(category_slug, slug, name, description, base_price, is_featured) as (
  values
    ('pizza', 'ps1800-regular-chicken-pizza', 'Regular Chicken Pizza', 'Chicken, mozzarella cheese, mushroom, black olive and capsicum.', 490, true),
    ('pizza', 'ps1800-chicken-sausage-pizza', 'Chicken Sausage Pizza', 'Chicken sausage, mozzarella cheese, mushroom, black olive and capsicum.', 490, false),
    ('pizza', 'ps1800-mexican-chicken-pizza', 'Mexican Chicken Pizza', 'Mexican-style chicken, cheese, mushroom, black olive and capsicum.', 540, false),
    ('pizza', 'ps1800-bbq-chicken-pizza', 'BBQ Chicken Pizza', 'BBQ chicken, mozzarella cheese, mushroom, black olive and capsicum.', 590, false),
    ('pizza', 'ps1800-bbq-beef-pizza', 'BBQ Beef Pizza', 'BBQ beef, mozzarella cheese, mushroom, black olive and capsicum.', 690, false),

    ('starters', 'ps1800-french-fries', 'French Fries', 'Crispy golden French fries.', 150, false),
    ('starters', 'ps1800-potato-wedges', 'Potato Wedges', 'Seasoned potato wedges.', 160, false),
    ('starters', 'ps1800-honey-garlic-chicken', 'Honey Garlic Chicken', 'Chicken tossed in a sweet honey-garlic sauce.', 250, false),
    ('starters', 'ps1800-chicken-nuggets-fries', 'Chicken Nuggets with French Fries', 'Six pieces, served with French fries.', 240, false),
    ('starters', 'ps1800-cheese-corndog', 'Cheese Corndog', 'Cheese-filled corndog.', 350, false),
    ('starters', 'ps1800-fried-prawns-fries', 'Fried Prawns with French Fries', 'Six pieces, served with French fries.', 300, false),
    ('starters', 'ps1800-chicken-cheese-balls', 'Chicken Cheese Balls', 'Four pieces.', 250, false),
    ('starters', 'ps1800-chicken-lollipop', 'Chicken Lollipop', 'Six pieces.', 250, false),
    ('starters', 'ps1800-crispy-wings', 'Crispy Wings', 'Six pieces.', 270, false),
    ('starters', 'ps1800-naga-wings', 'Naga Wings', 'Six pieces.', 280, false),
    ('starters', 'ps1800-bbq-wings', 'BBQ Wings', 'Six pieces.', 280, false),
    ('starters', 'ps1800-chicken-strips-fries', 'Chicken Strips with French Fries', 'Crispy chicken strips, served with French fries.', 280, false),
    ('starters', 'ps1800-thai-crispy-chicken-4-8', 'Thai/Crispy Chicken', 'Choose four or eight pieces.', 280, false),
    ('starters', 'ps1800-thai-crispy-chicken-1', 'Thai/Crispy Chicken (1 pc)', 'One piece.', 100, false),
    ('starters', 'ps1800-spicy-garlic-mushroom', 'Spicy Garlic Mushroom', 'Mushrooms tossed with spicy garlic.', 220, false),
    ('starters', 'ps1800-wonton', 'Wonton', 'Crispy wontons.', 150, false),
    ('starters', 'ps1800-tandoori-chicken-2-4', 'Tandoori Chicken', 'Choose two or four pieces.', 320, false),
    ('starters', 'ps1800-chicken-nachos', 'Chicken Nachos', 'Nachos topped with chicken.', 350, false),
    ('starters', 'ps1800-tacos', 'Tacos', 'Chicken tacos.', 320, false),

    ('burgers', 'ps1800-regular-chicken-burger', 'Regular Chicken Burger', 'Chicken burger.', 180, true),
    ('burgers', 'ps1800-sub-burger', 'Sub Burger', 'Sub-style burger.', 190, false),
    ('burgers', 'ps1800-crispy-chicken-cheese-burger', 'Crispy Chicken Cheese Burger', 'Crispy chicken with cheese.', 250, false),
    ('burgers', 'ps1800-chicken-loaded-burger', 'Chicken Loaded Burger', 'Loaded chicken burger.', 260, false),
    ('burgers', 'ps1800-double-patty-chicken-burger', 'Double Patty Chicken Burger', 'Chicken burger with two patties.', 340, false),
    ('burgers', 'ps1800-chicken-sizzling-burger', 'Chicken Sizzling Burger', 'Sizzling chicken burger.', 350, false),
    ('burgers', 'ps1800-beef-burger', 'Beef Burger', 'Beef burger.', 300, false),

    ('pasta', 'ps1800-cream-pasta', 'Cream Pasta', 'Creamy pasta.', 330, false),
    ('pasta', 'ps1800-pink-sauce-pasta', 'Pink Sauce Pasta', 'Pasta in pink sauce.', 320, false),
    ('pasta', 'ps1800-naga-pasta', 'Naga Pasta', 'Spicy Naga-style pasta.', 300, false),
    ('pasta', 'ps1800-penne-pasta', 'Penne Pasta', 'Penne pasta.', 280, false),
    ('pasta', 'ps1800-indian-spicy-pasta', 'Indian Spicy Pasta', 'Spicy Indian-style pasta.', 250, false),

    ('shawarma', 'ps1800-beef-shawarma', 'Beef Shawarma', 'Beef shawarma.', 280, false),
    ('shawarma', 'ps1800-bbq-chicken-shawarma', 'BBQ Chicken Shawarma', 'BBQ chicken shawarma.', 220, false),
    ('shawarma', 'ps1800-arabian-shawarma', 'Arabian Shawarma', 'Arabian-style shawarma.', 180, false),

    ('meatbox', 'ps1800-regular-meatbox', 'Regular Meatbox', 'Regular meatbox.', 190, false),
    ('meatbox', 'ps1800-bbq-meatbox', 'BBQ Meatbox', 'BBQ meatbox.', 280, false),
    ('meatbox', 'ps1800-loaded-meatbox', 'Loaded Meatbox', 'Loaded meatbox.', 360, false),

    ('sub-sandwich', 'ps1800-chicken-cheese-sub-sandwich', 'Chicken Cheese Sub-Sandwich', 'Chicken and cheese sub-sandwich.', 220, false),
    ('sub-sandwich', 'ps1800-bbq-sub-sandwich', 'BBQ Sub-Sandwich', 'BBQ sub-sandwich.', 230, false),

    ('shakes-coffees', 'ps1800-mixed-nut-milkshake', 'Mixed Nut Milkshake', 'Mixed nut milkshake.', 200, false),
    ('shakes-coffees', 'ps1800-chocolate-milkshake', 'Chocolate Milkshake', 'Chocolate milkshake.', 200, false),
    ('shakes-coffees', 'ps1800-vanilla-milkshake', 'Vanilla Milkshake', 'Vanilla milkshake.', 180, false),
    ('shakes-coffees', 'ps1800-strawberry-milkshake', 'Strawberry Milkshake', 'Strawberry milkshake.', 180, false),
    ('shakes-coffees', 'ps1800-mango-milkshake', 'Mango Milkshake', 'Mango milkshake.', 180, false),
    ('shakes-coffees', 'ps1800-chocolate-cold-coffee', 'Chocolate Cold Coffee', 'Chocolate cold coffee.', 150, false),
    ('shakes-coffees', 'ps1800-hot-coffee', 'Hot Coffee', 'Hot coffee.', 80, false),
    ('shakes-coffees', 'ps1800-black-coffee', 'Black Coffee', 'Black coffee.', 60, false),

    ('falooda-lassi', 'ps1800-falooda', 'Falooda', 'Falooda.', 180, false),
    ('falooda-lassi', 'ps1800-special-lassi', 'Special Lassi', 'Special lassi.', 150, false),
    ('falooda-lassi', 'ps1800-sweet-lassi', 'Sweet Lassi', 'Sweet lassi.', 130, false),

    ('mocktails', 'ps1800-three-layer-mojito', '3 Layer Mojito', 'Three-layer mojito.', 180, false),
    ('mocktails', 'ps1800-virgin-mojito-mint', 'Virgin Mojito Mint', 'Mint virgin mojito.', 150, false),
    ('mocktails', 'ps1800-green-apple-mojito', 'Green Apple Mojito', 'Green apple mojito.', 150, false),
    ('mocktails', 'ps1800-strawberry-mojito', 'Strawberry Mojito', 'Strawberry mojito.', 150, false),
    ('mocktails', 'ps1800-blue-ocean', 'Blue Ocean', 'Blue Ocean mocktail.', 150, false),
    ('mocktails', 'ps1800-lemonade-mint', 'Lemonade Mint', 'Mint lemonade.', 120, false),

    ('juices', 'ps1800-seasonal-fruit-juice', 'Seasonal Fruit Juice', 'Seasonal fruit juice.', 150, false),
    ('juices', 'ps1800-lemon-juice', 'Lemon Juice', 'Lemon juice.', 80, false),

    ('biryani', 'ps1800-bucket-biryani', 'Bucket Biryani', 'Bucket biryani, listed as 1:2.', 550, false),
    ('biryani', 'ps1800-bombai-cheese-biryani', 'Bombai Cheese Biryani', 'Bombai cheese biryani.', 400, false),
    ('biryani', 'ps1800-mutton-dum-biryani', 'Mutton Dum Biryani', 'Mutton dum biryani.', 350, false),
    ('biryani', 'ps1800-chicken-hyderabadi-biryani', 'Chicken Hyderabadi Biryani', 'Chicken Hyderabadi biryani.', 550, false),
    ('biryani', 'ps1800-kashmiri-polao', 'Kashmiri Polao', 'Kashmiri polao, listed as 1:3.', 500, false),
    ('biryani', 'ps1800-beef-bhuna-khichuri', 'Beef Bhuna Khichuri', 'Beef bhuna khichuri.', 230, false),
    ('biryani', 'ps1800-chicken-bhuna-khichuri', 'Chicken Bhuna Khichuri', 'Chicken bhuna khichuri.', 180, false),
    ('biryani', 'ps1800-khichuri-with-beef-bhuna', 'Khichuri with Beef Bhuna', 'Khichuri served with beef bhuna.', 350, false),

    ('indian-curry', 'ps1800-achari-mutton', 'Achari Mutton', 'Achari mutton, listed as 1:3.', 450, false),
    ('indian-curry', 'ps1800-mutton-korai', 'Mutton Korai', 'Mutton korai, listed as 1:3.', 420, false),
    ('indian-curry', 'ps1800-achari-chicken', 'Achari Chicken', 'Achari chicken, listed as 1:3.', 390, false),
    ('indian-curry', 'ps1800-chicken-korai', 'Chicken Korai', 'Chicken korai, listed as 1:3.', 370, false),
    ('indian-curry', 'ps1800-masala-duck', 'Masala Duck', 'Masala duck, listed as 1:3.', 450, false),
    ('indian-curry', 'ps1800-beef-sizzling', 'Beef Sizzling', 'Beef sizzling, listed as 1:3.', 420, false),
    ('indian-curry', 'ps1800-chicken-sizzling', 'Chicken Sizzling', 'Chicken sizzling, listed as 1:3.', 370, false),

    ('soup', 'ps1800-korean-ramen', 'Korean Ramen', 'Korean ramen, listed as 1:1.', 350, false),
    ('soup', 'ps1800-thai-soup', 'Thai Soup', 'Thai soup, listed as 1:3.', 400, false),
    ('soup', 'ps1800-corn-soup', 'Corn Soup', 'Corn soup, listed as 1:3.', 280, false),

    ('chow-mein', 'ps1800-chicken-chow-mein', 'Chicken Chow-Mein', 'Chicken chow-mein, listed as 1:3.', 400, false),
    ('chow-mein', 'ps1800-thai-chow-mein', 'Thai Chow-Mein', 'Thai chow-mein, listed as 1:3.', 450, false),

    ('salad', 'ps1800-cashew-nut-salad', 'Cashew Nut Salad', 'Cashew nut salad.', 380, false),
    ('salad', 'ps1800-chicken-grilled-salad', 'Chicken Grilled Salad', 'Chicken grilled salad.', 320, false),

    ('fried-rice', 'ps1800-thai-fried-rice', 'Thai Fried Rice', 'Thai fried rice, listed as 1:3.', 450, false),
    ('fried-rice', 'ps1800-mixed-fried-rice', 'Mixed Fried Rice', 'Mixed fried rice, listed as 1:3.', 370, false),
    ('fried-rice', 'ps1800-chicken-fried-rice', 'Chicken Fried Rice', 'Chicken fried rice, listed as 1:3.', 360, false),
    ('fried-rice', 'ps1800-masala-fried-rice', 'Masala Fried Rice', 'Masala fried rice, listed as 1:3.', 350, false),
    ('fried-rice', 'ps1800-steamed-rice', 'Steamed Rice', 'Steamed rice, listed as 1:3.', 250, false),

    ('curry', 'ps1800-masala-beef', 'Masala Beef', 'Masala beef, listed as 1:3.', 450, false),
    ('curry', 'ps1800-masala-chicken', 'Masala Chicken', 'Masala chicken, listed as 1:3.', 350, false),
    ('curry', 'ps1800-beef-chilli-onion', 'Beef Chilli Onion', 'Beef chilli onion, listed as 1:3.', 400, false),
    ('curry', 'ps1800-chicken-chilli-onion', 'Chicken Chilli Onion', 'Chicken chilli onion, listed as 1:3.', 280, false),
    ('curry', 'ps1800-special-vegetable', 'Special Vegetable', 'Special vegetable, listed as 1:3.', 350, false),
    ('curry', 'ps1800-thai-vegetable', 'Thai Vegetable', 'Thai vegetable, listed as 1:3.', 350, false),
    ('curry', 'ps1800-chinese-vegetable', 'Chinese Vegetable', 'Chinese vegetable, listed as 1:3.', 250, false),

    ('combo-packs', 'ps1800-combo-pack-1', 'Combo Pack #1', 'Red sauce pasta, two pieces of Naga wings, drinks and sauce.', 400, false),
    ('combo-packs', 'ps1800-combo-pack-2', 'Combo Pack #2', 'Chicken chow-mein, crispy chicken fry, French fries, drinks and sauce.', 300, false),
    ('combo-packs', 'ps1800-combo-pack-3', 'Combo Pack #3', 'Vegetable chow-mein, Thai chicken fry, potato wedges, drinks and sauce.', 260, false),

    ('naan-roti-platter', 'ps1800-naan-roti-platter-1', 'Naan Roti Platter #1', 'Naan with tandoori chicken, salad and sauce.', 300, false),
    ('naan-roti-platter', 'ps1800-naan-roti-platter-2', 'Naan Roti Platter #2', 'Naan with chicken chapa masala, salad and sauce.', 280, false),
    ('naan-roti-platter', 'ps1800-naan-roti-platter-3', 'Naan Roti Platter #3', 'Naan with shashlik, salad and sauce.', 280, false),

    ('set-menu', 'ps1800-set-menu-1', 'Set Menu #1', 'Egg fried rice, beef basil leaf curry, garlic mushroom, fried egg, drinks and salad.', 460, false),
    ('set-menu', 'ps1800-set-menu-2', 'Set Menu #2', 'Fried rice, tandoori chicken, chicken sizzling, Chinese vegetable, drinks and salad.', 450, false),
    ('set-menu', 'ps1800-set-menu-3', 'Set Menu #3', 'Egg fried rice, Mongolian beef, Chinese vegetable, fried egg, chips and salad.', 420, false),
    ('set-menu', 'ps1800-set-menu-4', 'Set Menu #4', 'Egg fried rice, chicken basil leaf curry, garlic chicken, fried egg, drinks and salad.', 420, false),
    ('set-menu', 'ps1800-set-menu-5', 'Set Menu #5', 'Fried rice, BBQ chicken, chicken ball, Chinese vegetable, drinks and salad.', 400, false),
    ('set-menu', 'ps1800-set-menu-6', 'Set Menu #6', 'Egg fried rice, peri-peri chicken, sauteed vegetable, fried egg, drinks and salad.', 380, false),
    ('set-menu', 'ps1800-set-menu-7', 'Set Menu #7', 'Egg fried rice, chicken teriyaki, sauteed vegetable, fried egg, drinks and salad.', 380, false),
    ('set-menu', 'ps1800-set-menu-8', 'Set Menu #8', 'Fried rice, chicken nuggets, chicken ball, sauteed vegetable, drinks and salad.', 380, false),
    ('set-menu', 'ps1800-set-menu-9', 'Set Menu #9', 'Egg fried rice, four pieces of popcorn chicken, fried egg, Chinese vegetable, drinks and salad.', 380, false),
    ('set-menu', 'ps1800-set-menu-10', 'Set Menu #10', 'Fried rice, chicken saslik, Chinese vegetable, chips, fried egg, drinks and salad.', 370, false),
    ('set-menu', 'ps1800-set-menu-11', 'Set Menu #11', 'Fried rice, Mexican chicken, garlic mushroom, crispy chicken fry, drinks and salad.', 330, false),
    ('set-menu', 'ps1800-set-menu-12', 'Set Menu #12', 'Fried rice, masala chicken, Thai chicken fry, drinks and salad.', 300, false),
    ('set-menu', 'ps1800-set-menu-13', 'Set Menu #13', 'Egg fried rice, cashew-nut chicken curry, Chinese vegetable, fried egg, drinks and salad.', 300, false),
    ('set-menu', 'ps1800-set-menu-14', 'Set Menu #14', 'Fried rice, chicken chilli onion, Thai chicken fry, drinks and salad.', 280, false),
    ('set-menu', 'ps1800-set-menu-15', 'Set Menu #15', 'Fried rice, Chinese vegetable, Thai chicken fry, drinks and salad.', 250, false),

    ('couple-platter', 'ps1800-couple-platter-1', 'Couple Platter #1', 'Fried rice, tandoori chicken, Chinese vegetable, wonton, drinks and salad.', 660, false),
    ('couple-platter', 'ps1800-couple-platter-2', 'Couple Platter #2', 'Chicken nuggets, special fried rice, potato wedges, Chinese vegetable, fries, salad and drinks.', 750, false),
    ('couple-platter', 'ps1800-couple-platter-3', 'Couple Platter #3', 'BBQ chicken, mixed fried rice, Thai soup, wonton, potato wedges, Chinese vegetable, chicken salad and drinks.', 800, false),

    ('whole-chicken-dish', 'ps1800-whole-chicken-dish-1', 'Whole Chicken Dish #1', 'Baked chicken with basmati rice and salad.', 1200, false),
    ('whole-chicken-dish', 'ps1800-whole-chicken-dish-2', 'Whole Chicken Dish #2', 'Baked chicken with fried rice and salad.', 1000, false)
)
insert into public.products (
  category_id, slug, name, description, base_price, is_active, is_available, is_featured
)
select c.id, m.slug, m.name, m.description, m.base_price, true, true, m.is_featured
from menu_items m
join public.categories c on c.slug = m.category_slug
on conflict (slug) do update
set category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    base_price = excluded.base_price,
    updated_at = now();

with variant_data(product_slug, name, price_delta) as (
  values
    ('ps1800-regular-chicken-pizza', 'Small', 0),
    ('ps1800-regular-chicken-pizza', 'Medium', 140),
    ('ps1800-regular-chicken-pizza', 'Large', 260),
    ('ps1800-chicken-sausage-pizza', 'Small', 0),
    ('ps1800-chicken-sausage-pizza', 'Medium', 140),
    ('ps1800-chicken-sausage-pizza', 'Large', 260),
    ('ps1800-mexican-chicken-pizza', 'Small', 0),
    ('ps1800-mexican-chicken-pizza', 'Medium', 140),
    ('ps1800-mexican-chicken-pizza', 'Large', 270),
    ('ps1800-bbq-chicken-pizza', 'Small', 0),
    ('ps1800-bbq-chicken-pizza', 'Medium', 140),
    ('ps1800-bbq-chicken-pizza', 'Large', 300),
    ('ps1800-bbq-beef-pizza', 'Small', 0),
    ('ps1800-bbq-beef-pizza', 'Medium', 200),
    ('ps1800-bbq-beef-pizza', 'Large', 390),
    ('ps1800-thai-crispy-chicken-4-8', '4 pcs', 0),
    ('ps1800-thai-crispy-chicken-4-8', '8 pcs', 270),
    ('ps1800-tandoori-chicken-2-4', '2 pcs', 0),
    ('ps1800-tandoori-chicken-2-4', '4 pcs', 300)
)
insert into public.product_variants (product_id, name, price_delta, is_available)
select p.id, v.name, v.price_delta, true
from variant_data v
join public.products p on p.slug = v.product_slug
on conflict (product_id, name) do update
set price_delta = excluded.price_delta,
    updated_at = now();

with addon_data(product_slug, name, price) as (
  values
    ('ps1800-regular-chicken-pizza', 'Extra Cheese', 100),
    ('ps1800-chicken-sausage-pizza', 'Extra Cheese', 100),
    ('ps1800-mexican-chicken-pizza', 'Extra Cheese', 100),
    ('ps1800-bbq-chicken-pizza', 'Extra Cheese', 100),
    ('ps1800-bbq-beef-pizza', 'Extra Cheese', 100),
    ('ps1800-regular-chicken-burger', 'Extra Cheese', 50),
    ('ps1800-sub-burger', 'Extra Cheese', 50),
    ('ps1800-crispy-chicken-cheese-burger', 'Extra Cheese', 50),
    ('ps1800-chicken-loaded-burger', 'Extra Cheese', 50),
    ('ps1800-double-patty-chicken-burger', 'Extra Cheese', 50),
    ('ps1800-chicken-sizzling-burger', 'Extra Cheese', 50),
    ('ps1800-beef-burger', 'Extra Cheese', 50)
)
insert into public.product_addons (product_id, name, price, is_available)
select p.id, a.name, a.price, true
from addon_data a
join public.products p on p.slug = a.product_slug
on conflict (product_id, name) do update
set price = excluded.price,
    updated_at = now();

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
    visibility = 'public'
where (restaurant_settings.key = 'restaurant.name'
       and restaurant_settings.value = '"Pizza Station (Development)"'::jsonb)
   or (restaurant_settings.key = 'restaurant.currency'
       and restaurant_settings.value = '"USD"'::jsonb)
   or restaurant_settings.key in (
     'restaurant.phone', 'restaurant.google_maps_url',
     'restaurant.latitude', 'restaurant.longitude'
   );

update public.products
set is_active = false,
    is_available = false,
    updated_at = now()
where slug in ('classic-margherita', 'pepperoni', 'garlic-knots', 'sparkling-water');

commit;
