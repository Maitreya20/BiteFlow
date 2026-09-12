-- ============================================================================
--  BiteFlow — demo seed
--  Creates one fully-populated tenant ("Spice Route") so live mode looks the
--  same as the bundled demo dataset: menu, floor plan, orders, KDS tickets,
--  reservations, inventory, CRM, invoices and audit history.
--
--  Run after schema.sql. Safe to re-run — every insert is guarded.
-- ============================================================================

-- Fail loudly (and usefully) if the schema has not been applied yet.
do $$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.memberships') is null then
    raise exception 'Run supabase/schema.sql first — the BiteFlow tables are missing.';
  end if;
end $$;

do $$
declare
  v_org               uuid;
  v_owner             uuid;
  v_cat_starters      uuid;
  v_cat_mains         uuid;
  v_cat_breads        uuid;
  v_cat_desserts      uuid;
  v_cat_drinks        uuid;
  v_t01 uuid; v_t02 uuid; v_t03 uuid; v_t04 uuid; v_t05 uuid;
  v_t06 uuid; v_t07 uuid; v_t08 uuid;
  v_customer_1 uuid;
  v_customer_2 uuid;
  v_order_live uuid;
  v_order_prep uuid;
  v_order_done uuid;
begin
  /* ------------------------------------------------------------- tenant */
  select id into v_org from public.organizations where slug = 'spice-route';

  if v_org is null then
    insert into public.organizations (
      name, slug, business_type, gst_number, timezone, currency, language,
      plan_id, subscription_status, trial_ends_at, renews_at, seeded_demo, branding
    ) values (
      'Spice Route', 'spice-route', 'restaurant', '29ABCDE1234F1Z5', 'Asia/Kolkata', 'INR', 'en-IN',
      'growth', 'active', now(), now() + interval '21 days', true,
      jsonb_build_object(
        'logoUrl', null, 'logoEmoji', '🌶️',
        'primaryColor', '#EA580C', 'secondaryColor', '#0F172A', 'accentColor', '#16A34A',
        'fontFamily', 'Manrope', 'radiusScale', 'soft', 'buttonStyle', 'pill',
        'cardStyle', 'elevated', 'menuLayout', 'grid',
        'heroHeadline', 'Modern Indian, made for sharing',
        'heroSubcopy', 'Small plates, slow-cooked curries and a tandoor that never sleeps.',
        'heroImageUrl', null, 'tagline', 'Modern Indian Kitchen',
        'address', '12 Church Street, Bengaluru 560001', 'phone', '+91 98450 11223',
        'rating', 4.7, 'isOpen', true, 'currency', 'INR',
        'taxPercent', 5, 'serviceChargePercent', 5
      )
    )
    returning id into v_org;
  end if;

  /* -------------------------------------------------------------- menu */
  if not exists (select 1 from public.menu_categories where organization_id = v_org) then
    insert into public.menu_categories (organization_id, name, description, icon, sort_order)
      values (v_org, 'Starters', 'Small plates built for the table', 'tapas', 0) returning id into v_cat_starters;
    insert into public.menu_categories (organization_id, name, description, icon, sort_order)
      values (v_org, 'Mains', 'Slow-cooked curries and tandoor grills', 'dinner_dining', 1) returning id into v_cat_mains;
    insert into public.menu_categories (organization_id, name, description, icon, sort_order)
      values (v_org, 'Breads & Rice', 'Fresh from the tandoor', 'bakery_dining', 2) returning id into v_cat_breads;
    insert into public.menu_categories (organization_id, name, description, icon, sort_order)
      values (v_org, 'Desserts', 'Indian classics, lighter touch', 'icecream', 3) returning id into v_cat_desserts;
    insert into public.menu_categories (organization_id, name, description, icon, sort_order)
      values (v_org, 'Drinks', 'Coolers, chai and lassi', 'local_cafe', 4) returning id into v_cat_drinks;

    insert into public.menu_items (
      organization_id, category_id, name, description, price, prep_time_minutes, calories,
      is_vegetarian, is_spicy, is_chef_pick, is_trending, allergens, tags, option_groups, sort_order
    ) values
      (v_org, v_cat_starters, 'Paneer Tikka', 'Charred cottage cheese, ajwain marinade, mint chutney', 320, 14, 380,
        true, true, true, false, '["dairy"]', '["veg","tandoor"]',
        '[{"id":"og_spice","name":"Spice level","type":"single","required":true,"options":[{"id":"og_spice_mild","name":"Mild","priceDelta":0,"isDefault":true},{"id":"og_spice_med","name":"Medium","priceDelta":0},{"id":"og_spice_hot","name":"Hot","priceDelta":0}]}]', 0),
      (v_org, v_cat_starters, 'Chicken 65', 'Curry-leaf fried chicken, yoghurt dip', 360, 12, 460,
        false, true, false, true, '["dairy"]', '["non-veg","fried"]', '[]', 1),
      (v_org, v_cat_starters, 'Beetroot Kebab', 'Beetroot, peanut and quinoa patties', 280, 13, 260,
        true, false, false, false, '["nuts"]', '["veg","vegan"]', '[]', 2),
      (v_org, v_cat_starters, 'Prawn Koliwada', 'Semolina-crusted prawns, kokum aioli', 420, 15, 390,
        false, true, true, false, '["shellfish"]', '["non-veg","coastal"]', '[]', 3),
      (v_org, v_cat_mains, 'Butter Chicken', 'Overnight tomato masala, cream, fenugreek', 420, 18, 640,
        false, false, true, true, '["dairy","nuts"]', '["non-veg","gravy"]',
        '[{"id":"og_portion","name":"Portion","type":"single","required":true,"options":[{"id":"og_portion_half","name":"Half","priceDelta":0,"isDefault":true},{"id":"og_portion_full","name":"Full","priceDelta":160}]}]', 4),
      (v_org, v_cat_mains, 'Dal Makhani', 'Black lentils, 12-hour simmer, smoked butter', 340, 16, 480,
        true, false, false, true, '["dairy"]', '["veg","gravy"]', '[]', 5),
      (v_org, v_cat_mains, 'Kerala Fish Curry', 'Seer fish, coconut, tamarind and curry leaf', 480, 20, 520,
        false, true, true, false, '["fish"]', '["non-veg","coastal"]', '[]', 6),
      (v_org, v_cat_mains, 'Mushroom Gassi', 'Mangalorean coconut gravy, button mushrooms', 360, 17, 410,
        true, false, false, false, '["tree nuts"]', '["veg","vegan"]', '[]', 7),
      (v_org, v_cat_mains, 'Lamb Rogan Josh', 'Slow-braised lamb, Kashmiri chilli, fennel', 520, 22, 690,
        false, true, false, false, '["dairy"]', '["non-veg","gravy"]', '[]', 8),
      (v_org, v_cat_breads, 'Garlic Naan', 'Tandoor naan, roasted garlic butter', 90, 6, 210,
        true, false, false, false, '["gluten","dairy"]', '["veg","bread"]', '[]', 9),
      (v_org, v_cat_breads, 'Laccha Paratha', 'Layered whole-wheat paratha', 80, 7, 240,
        true, false, false, false, '["gluten","dairy"]', '["veg","bread"]', '[]', 10),
      (v_org, v_cat_breads, 'Jeera Rice', 'Basmati, cumin, ghee', 180, 8, 320,
        true, false, false, false, '["dairy"]', '["veg","rice"]', '[]', 11),
      (v_org, v_cat_desserts, 'Gulab Jamun', 'Warm milk dumplings, saffron syrup', 180, 5, 340,
        true, false, false, false, '["dairy","gluten"]', '["veg","sweet"]', '[]', 12),
      (v_org, v_cat_desserts, 'Filter Coffee Panna Cotta', 'Set cream, filter coffee reduction', 220, 5, 290,
        true, false, true, true, '["dairy"]', '["veg","sweet"]', '[]', 13),
      (v_org, v_cat_drinks, 'Masala Chaas', 'Spiced buttermilk, curry leaf', 120, 3, 90,
        true, false, false, false, '["dairy"]', '["veg","cooler"]', '[]', 14),
      (v_org, v_cat_drinks, 'Nimbu Soda', 'Lime, black salt, soda', 110, 3, 60,
        true, false, false, false, '[]', '["veg","cooler"]', '[]', 15),
      (v_org, v_cat_drinks, 'Kokum Cooler', 'Kokum, jaggery, mint', 140, 3, 110,
        true, false, false, true, '[]', '["veg","cooler"]', '[]', 16),
      (v_org, v_cat_drinks, 'Masala Chai', 'Assam leaf, ginger, cardamom', 90, 5, 120,
        true, false, false, false, '["dairy"]', '["veg","hot"]', '[]', 17);
  end if;

  /* ------------------------------------------------------- floor plan */
  if not exists (select 1 from public.restaurant_tables where organization_id = v_org) then
    insert into public.restaurant_tables (organization_id, table_number, capacity, status, zone, pos_x, pos_y)
      values (v_org, 'T-01', 2, 'occupied', 'Window', 60, 80) returning id into v_t01;
    insert into public.restaurant_tables (organization_id, table_number, capacity, status, zone, pos_x, pos_y)
      values (v_org, 'T-02', 4, 'available', 'Window', 220, 80) returning id into v_t02;
    insert into public.restaurant_tables (organization_id, table_number, capacity, status, zone, pos_x, pos_y)
      values (v_org, 'T-03', 4, 'occupied', 'Indoor', 380, 80) returning id into v_t03;
    insert into public.restaurant_tables (organization_id, table_number, capacity, status, zone, pos_x, pos_y)
      values (v_org, 'T-04', 6, 'reserved', 'Indoor', 540, 80) returning id into v_t04;
    insert into public.restaurant_tables (organization_id, table_number, capacity, status, zone, pos_x, pos_y)
      values (v_org, 'T-05', 4, 'available', 'Indoor', 60, 240) returning id into v_t05;
    insert into public.restaurant_tables (organization_id, table_number, capacity, status, zone, pos_x, pos_y)
      values (v_org, 'T-06', 8, 'cleaning', 'Family', 220, 240) returning id into v_t06;
    insert into public.restaurant_tables (organization_id, table_number, capacity, status, zone, pos_x, pos_y)
      values (v_org, 'T-07', 2, 'available', 'Bar', 380, 240) returning id into v_t07;
    insert into public.restaurant_tables (organization_id, table_number, capacity, status, zone, pos_x, pos_y)
      values (v_org, 'T-08', 4, 'available', 'Terrace', 540, 240) returning id into v_t08;
  end if;

  /* --------------------------------------------------------- customers */
  if not exists (select 1 from public.customers where organization_id = v_org) then
    insert into public.customers (
      organization_id, name, phone, email, total_orders, total_spend, loyalty_points, tier,
      visit_count, last_visit_at, preferences, marketing_consent
    ) values (
      v_org, 'Ananya Rao', '+919845011223', 'ananya@example.com', 14, 7860, 786, 'gold',
      14, now() - interval '3 days', '["no onion","jain"]'::jsonb, true
    ) returning id into v_customer_1;

    insert into public.customers (
      organization_id, name, phone, email, total_orders, total_spend, loyalty_points, tier,
      visit_count, last_visit_at, preferences, marketing_consent
    ) values (
      v_org, 'Rahul Menon', '+919880123456', 'rahul@example.com', 8, 4120, 412, 'silver',
      8, now() - interval '9 days', '["extra spicy"]'::jsonb, true
    ) returning id into v_customer_2;

    insert into public.customers (organization_id, name, phone, email, total_orders, total_spend, loyalty_points, tier, visit_count, last_visit_at, marketing_consent)
      values (v_org, 'Meera Iyer', '+919701445566', 'meera@example.com', 22, 12940, 1294, 'platinum', 22, now() - interval '1 day', true),
             (v_org, 'Karthik Shetty', '+919611223344', 'karthik@example.com', 5, 2310, 231, 'bronze', 5, now() - interval '21 days', false),
             (v_org, 'Farhan Qureshi', '+919821009911', 'farhan@example.com', 3, 1680, 168, 'bronze', 3, now() - interval '34 days', true);
  end if;

  /* ------------------------------------------------------------ orders */
  if not exists (select 1 from public.orders where organization_id = v_org) then
    insert into public.orders (
      organization_id, order_number, channel, table_id, table_number, customer_id, customer_name,
      status, subtotal, tax_amount, service_charge, total, payment_status, placed_at
    ) values (
      v_org, 'BF-1201', 'dine_in', v_t01, 'T-01', v_customer_1, 'Ananya Rao',
      'pending', 1060, 53, 53, 1166, 'unpaid', now() - interval '4 minutes'
    ) returning id into v_order_live;

    insert into public.order_items (order_id, name, unit_price, quantity, options, options_total, notes, line_total) values
      (v_order_live, 'Paneer Tikka', 320, 1, '["Medium"]'::jsonb, 0, 'No onion', 320),
      (v_order_live, 'Butter Chicken', 420, 1, '["Half"]'::jsonb, 0, '', 420),
      (v_order_live, 'Garlic Naan', 90, 2, '[]'::jsonb, 0, '', 180),
      (v_order_live, 'Masala Chaas', 120, 1, '[]'::jsonb, 0, '', 120);

    insert into public.orders (
      organization_id, order_number, channel, table_id, table_number, customer_id, customer_name,
      status, subtotal, tax_amount, service_charge, total, payment_status,
      placed_at, accepted_at, preparing_at
    ) values (
      v_org, 'BF-1200', 'dine_in', v_t03, 'T-03', v_customer_2, 'Rahul Menon',
      'preparing', 1420, 71, 71, 1562, 'unpaid',
      now() - interval '12 minutes', now() - interval '11 minutes', now() - interval '9 minutes'
    ) returning id into v_order_prep;

    insert into public.order_items (order_id, name, unit_price, quantity, options, options_total, notes, line_total) values
      (v_order_prep, 'Lamb Rogan Josh', 520, 1, '[]'::jsonb, 0, 'Extra spicy', 520),
      (v_order_prep, 'Dal Makhani', 340, 1, '[]'::jsonb, 0, '', 340),
      (v_order_prep, 'Laccha Paratha', 80, 3, '[]'::jsonb, 0, '', 240),
      (v_order_prep, 'Kokum Cooler', 140, 2, '[]'::jsonb, 0, '', 280);

    insert into public.orders (
      organization_id, order_number, channel, table_id, table_number, customer_id, customer_name,
      status, subtotal, tax_amount, service_charge, discount, total,
      payment_status, payment_method, placed_at, completed_at
    ) values (
      v_org, 'BF-1199', 'dine_in', v_t06, 'T-06', v_customer_1, 'Ananya Rao',
      'completed', 980, 49, 49, 50, 1028,
      'paid', 'upi', now() - interval '1 day', now() - interval '1 day' + interval '52 minutes'
    ) returning id into v_order_done;

    insert into public.order_items (order_id, name, unit_price, quantity, options, options_total, notes, line_total) values
      (v_order_done, 'Kerala Fish Curry', 480, 1, '[]'::jsonb, 0, '', 480),
      (v_order_done, 'Jeera Rice', 180, 1, '[]'::jsonb, 0, '', 180),
      (v_order_done, 'Prawn Koliwada', 420, 1, '[]'::jsonb, 0, '', 420);
  end if;

  /* ------------------------------------------------------ reservations */
  if not exists (select 1 from public.reservations where organization_id = v_org) then
    insert into public.reservations (organization_id, customer_name, phone, email, date, time, guests, table_id, table_number, status, special_request) values
      (v_org, 'Sneha Kapoor', '+919845000111', 'sneha@example.com', current_date, '19:30', 4, v_t04, 'T-04', 'confirmed', 'Anniversary — window table if possible'),
      (v_org, 'Vikram Nair', '+919845000222', 'vikram@example.com', current_date, '20:15', 2, null, null, 'pending', ''),
      (v_org, 'Priya Desai', '+919845000333', 'priya@example.com', current_date + 1, '13:00', 6, null, null, 'confirmed', 'One high chair needed'),
      (v_org, 'Aditya Bose', '+919845000444', 'aditya@example.com', current_date + 1, '21:00', 8, null, null, 'pending', 'Birthday cake at the end'),
      (v_org, 'Neha Gupta', '+919845000555', 'neha@example.com', current_date - 1, '20:00', 3, v_t02, 'T-02', 'seated', '');
  end if;

  /* --------------------------------------------------------- inventory */
  if not exists (select 1 from public.inventory_items where organization_id = v_org) then
    insert into public.inventory_items (organization_id, ingredient, category, current_stock, unit, low_stock_threshold, unit_cost, supplier, expiry_date, last_restocked_at) values
      (v_org, 'Paneer', 'Dairy', 4.5, 'kg', 6, 380, 'Nandini Distributors', current_date + 4, now() - interval '2 days'),
      (v_org, 'Chicken (boneless)', 'Meat', 12, 'kg', 8, 260, 'Freshcut Meats', current_date + 2, now() - interval '1 day'),
      (v_org, 'Basmati Rice', 'Grains', 45, 'kg', 15, 110, 'Sri Balaji Traders', current_date + 180, now() - interval '9 days'),
      (v_org, 'Tomatoes', 'Produce', 9, 'kg', 10, 42, 'Local Mandi', current_date + 3, now() - interval '1 day'),
      (v_org, 'Heavy Cream', 'Dairy', 7, 'ltr', 5, 210, 'Nandini Distributors', current_date + 6, now() - interval '3 days'),
      (v_org, 'Black Lentils (urad)', 'Grains', 28, 'kg', 10, 145, 'Sri Balaji Traders', current_date + 240, now() - interval '20 days'),
      (v_org, 'Seer Fish', 'Seafood', 3, 'kg', 4, 720, 'Coastal Catch', current_date + 1, now()),
      (v_org, 'Kokum Syrup', 'Beverage', 16, 'ltr', 6, 180, 'Goan Pantry', current_date + 90, now() - interval '12 days');
  end if;

  /* -------------------------------------------------- service requests */
  if not exists (select 1 from public.service_requests where organization_id = v_org) then
    insert into public.service_requests (organization_id, table_id, table_number, type, status, note, created_at) values
      (v_org, v_t03, 'T-03', 'request_bill', 'pending', 'Guest asked for the bill on the QR menu', now() - interval '2 minutes'),
      (v_org, v_t01, 'T-01', 'water', 'acknowledged', '', now() - interval '9 minutes');
  end if;

  /* ------------------------------------------------- billing & platform */
  if not exists (select 1 from public.invoices where organization_id = v_org) then
    insert into public.invoices (organization_id, invoice_number, issued_at, amount, status, plan_id, period_label) values
      (v_org, 'BF-INV-2412', now() - interval '32 days', 2499, 'paid', 'growth', 'Aug 2026 · monthly'),
      (v_org, 'BF-INV-2488', now() - interval '2 days', 2499, 'paid', 'growth', 'Sep 2026 · monthly');
  end if;

  if not exists (select 1 from public.payment_methods where organization_id = v_org) then
    insert into public.payment_methods (organization_id, brand, last4, expiry, is_default)
      values (v_org, 'visa', '4242', '08/28', true);
  end if;

  if not exists (select 1 from public.notifications where organization_id = v_org) then
    insert into public.notifications (organization_id, kind, title, body, read, href, created_at) values
      (v_org, 'order', 'New order BF-1201 · T-01', '4 items · ₹1,166', false, '/app/orders', now() - interval '4 minutes'),
      (v_org, 'service_request', 'T-03 · request bill', 'Guest requested assistance from the QR menu', false, '/app/tables', now() - interval '2 minutes'),
      (v_org, 'inventory', 'Low stock: Paneer', '4.5 kg left — below the 6 kg threshold', false, '/app/inventory', now() - interval '40 minutes'),
      (v_org, 'subscription', 'Invoice BF-INV-2488 paid', 'Growth plan renewed for September', true, '/app/billing', now() - interval '2 days');
  end if;

  if not exists (select 1 from public.audit_logs where organization_id = v_org) then
    insert into public.audit_logs (organization_id, actor_name, actor_role, action, entity_type, entity_id, summary, ip_address, created_at) values
      (v_org, 'System', 'owner', 'tenant.created', 'organization', v_org::text, 'Restaurant "Spice Route" created on the growth plan', '49.36.10.100', now() - interval '32 days'),
      (v_org, 'System', 'owner', 'menu.imported', 'menu_item', null, 'Imported 18 items across 5 categories', '49.36.10.100', now() - interval '32 days'),
      (v_org, 'System', 'manager', 'table.qr_regenerated', 'table', v_t03::text, 'Regenerated QR for T-03', '49.36.10.101', now() - interval '6 days'),
      (v_org, 'Guest', 'customer', 'order.created', 'order', v_order_live::text, 'Order BF-1201 placed from T-01', '49.36.10.140', now() - interval '4 minutes'),
      (v_org, 'Guest', 'customer', 'order.paid', 'order', v_order_done::text, 'Payment of 1028 captured via upi', '49.36.10.141', now() - interval '1 day');
  end if;

  /* --------------------------------------------- link the demo account */
  -- Give every existing auth user platform-admin rights on the demo tenant so
  -- both the restaurant app and /admin are reachable immediately. Change the
  -- role to 'owner' for a tenant-scoped preview.
  select id into v_owner from auth.users order by created_at limit 1;

  if v_owner is not null then
    insert into public.memberships (organization_id, user_id, role, status, shift, last_active_at)
    select v_org, v_owner, 'super_admin', 'active', 'Full day', now()
    where not exists (
      select 1 from public.memberships where organization_id = v_org and user_id = v_owner
    );

    insert into public.memberships (organization_id, user_id, email, role, status, shift)
    select v_org, null, 'priya.manager@spiceroute.example', 'manager', 'invited', 'Morning (08:00 – 16:00)'
    where not exists (
      select 1 from public.memberships where organization_id = v_org and email = 'priya.manager@spiceroute.example'
    );

    insert into public.memberships (organization_id, user_id, email, role, status, shift)
    select v_org, null, 'chef.arun@spiceroute.example', 'chef', 'invited', 'Evening (16:00 – 00:00)'
    where not exists (
      select 1 from public.memberships where organization_id = v_org and email = 'chef.arun@spiceroute.example'
    );
  end if;
end $$;
