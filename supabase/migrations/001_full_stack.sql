-- ============================================================================
--  BiteFlow — full-stack migration snapshot (v1)
--  Generated: 2026-09-14
--  Derived from supabase/schema.sql + applied migrations. Regenerate when the schema changes.
-- ============================================================================
-- ============================================================================
--  BiteFlow — Supabase schema
--  Multi-tenant restaurant OS. Mirrors src/lib/types.ts and prd.md §6, §10,
--  §13, §15–§21, §7, §27 (audit) and §26 (tenant isolation).
--
--  Run order:   1) schema.sql   2) seed.sql (optional demo tenant)
--
--  Every table is scoped by organization_id and protected by RLS keyed on the
--  caller's membership. The app talks to these tables exclusively through
--  src/data/api.ts (live mode).
--
--  NOTE: ordering matters here. Tables are created first; the SQL helper
--  functions (is_org_member & co) come after them because Postgres validates
--  language-SQL function bodies at CREATE time.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Keep function-body validation from tripping over objects created later in
-- this script (trigger functions reference tables further down).
set check_function_bodies = off;

-- ------------------------------------------------------------------ identity

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null,
  full_name   text not null default '',
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ tenancy

create table if not exists public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  business_type       text not null default 'restaurant',
  gst_number          text not null default '',
  timezone            text not null default 'Asia/Kolkata',
  currency            text not null default 'INR',
  language            text not null default 'en-IN',
  plan_id             text not null default 'starter' check (plan_id in ('starter','growth','pro','enterprise')),
  subscription_status text not null default 'trialing'
                        check (subscription_status in ('trialing','active','past_due','cancelled','expired')),
  trial_ends_at       timestamptz,
  renews_at           timestamptz,
  created_at          timestamptz not null default now(),
  seeded_demo         boolean not null default false,
  branding            jsonb not null default '{}'::jsonb
);

create table if not exists public.memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id         uuid references auth.users on delete cascade,
  email           text,                      -- set for pending invites
  role            text not null default 'waiter'
                    check (role in ('super_admin','owner','manager','cashier','chef','kitchen_staff','waiter','customer')),
  status          text not null default 'active' check (status in ('active','invited','suspended')),
  shift           text not null default '',
  invited_at      timestamptz not null default now(),
  last_active_at  timestamptz
);

create index if not exists memberships_org_idx  on public.memberships (organization_id);
create index if not exists memberships_user_idx on public.memberships (user_id);

-- ---------------------------------------------------------------------- menu

create table if not exists public.menu_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name            text not null,
  description     text not null default '',
  icon            text not null default 'restaurant_menu',
  sort_order      int  not null default 0,
  is_active       boolean not null default true
);

create table if not exists public.menu_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations on delete cascade,
  category_id      uuid not null references public.menu_categories on delete cascade,
  name             text not null,
  description      text not null default '',
  price            numeric(12,2) not null default 0,
  image_url        text,
  prep_time_minutes int not null default 10,
  calories         int not null default 0,
  available        boolean not null default true,
  is_chef_pick     boolean not null default false,
  is_trending      boolean not null default false,
  is_vegetarian    boolean not null default false,
  is_spicy         boolean not null default false,
  allergens        jsonb not null default '[]'::jsonb,
  tags             jsonb not null default '[]'::jsonb,
  option_groups    jsonb not null default '[]'::jsonb,
  sort_order       int not null default 0
);

create index if not exists menu_items_org_idx on public.menu_items (organization_id);

-- -------------------------------------------------------------------- tables

create table if not exists public.restaurant_tables (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations on delete cascade,
  branch_id            text not null default 'main',
  table_number         text not null,
  capacity             int not null default 4,
  status               text not null default 'available'
                         check (status in ('available','occupied','reserved','cleaning')),
  assigned_waiter_id   uuid,
  assigned_waiter_name text,
  current_bill         numeric(12,2) not null default 0,
  occupied_since       timestamptz,
  qr_token             text not null default encode(gen_random_bytes(6), 'hex'),
  zone                 text not null default 'Indoor',
  pos_x                numeric not null default 0,
  pos_y                numeric not null default 0,
  unique (organization_id, table_number)
);

create index if not exists tables_org_idx on public.restaurant_tables (organization_id);

-- -------------------------------------------------------------------- orders

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations on delete cascade,
  order_number     text not null,
  channel          text not null default 'dine_in' check (channel in ('dine_in','takeaway','delivery')),
  table_id         uuid references public.restaurant_tables on delete set null,
  table_number     text,
  customer_id      uuid,
  customer_name    text,
  status           text not null default 'pending'
                     check (status in ('pending','accepted','preparing','ready','served','completed','cancelled')),
  subtotal         numeric(12,2) not null default 0,
  tax_amount       numeric(12,2) not null default 0,
  service_charge   numeric(12,2) not null default 0,
  discount         numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  notes            text not null default '',
  allergy_note     text not null default '',
  kitchen_note     text not null default '',
  payment_status   text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  payment_method   text check (payment_method in ('upi','card','cash','wallet')),
  placed_at        timestamptz not null default now(),
  accepted_at      timestamptz,
  preparing_at     timestamptz,
  ready_at         timestamptz,
  served_at        timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  cancelled_reason text
);

create index if not exists orders_org_placed_idx on public.orders (organization_id, placed_at desc);
create index if not exists orders_status_idx     on public.orders (organization_id, status);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders on delete cascade,
  menu_item_id  uuid,
  name          text not null,
  unit_price    numeric(12,2) not null default 0,
  quantity      int not null default 1,
  options       jsonb not null default '[]'::jsonb,
  options_total numeric(12,2) not null default 0,
  notes         text not null default '',
  line_total    numeric(12,2) not null default 0
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ----------------------------------------------------------- service requests

create table if not exists public.service_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations on delete cascade,
  table_id         uuid references public.restaurant_tables on delete cascade,
  table_number     text not null,
  type             text not null default 'call_waiter'
                     check (type in ('call_waiter','request_bill','water','cutlery','clean_table','other')),
  status           text not null default 'pending'
                     check (status in ('pending','acknowledged','in_progress','completed')),
  note             text not null default '',
  assigned_to_name text,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index if not exists service_requests_org_idx on public.service_requests (organization_id, created_at desc);

-- -------------------------------------------------------------- reservations

create table if not exists public.reservations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations on delete cascade,
  customer_name    text not null,
  phone            text not null default '',
  email            text not null default '',
  date             date not null,
  time             text not null,
  guests           int not null default 2,
  table_id         uuid references public.restaurant_tables on delete set null,
  table_number     text,
  status           text not null default 'pending'
                     check (status in ('pending','confirmed','seated','cancelled','no_show')),
  special_request  text not null default '',
  created_at       timestamptz not null default now()
);

create index if not exists reservations_org_date_idx on public.reservations (organization_id, date);

-- ----------------------------------------------------------------- inventory

create table if not exists public.inventory_items (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations on delete cascade,
  ingredient          text not null,
  category            text not null default 'General',
  current_stock       numeric(12,3) not null default 0,
  unit                text not null default 'pcs',
  low_stock_threshold numeric(12,3) not null default 0,
  unit_cost           numeric(12,2) not null default 0,
  supplier            text not null default '',
  expiry_date         date,
  last_restocked_at   timestamptz not null default now()
);

create index if not exists inventory_org_idx on public.inventory_items (organization_id);

-- ----------------------------------------------------------------- customers

create table if not exists public.customers (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations on delete cascade,
  name              text not null,
  phone             text not null default '',
  email             text not null default '',
  total_orders      int not null default 0,
  total_spend       numeric(12,2) not null default 0,
  loyalty_points    int not null default 0,
  tier              text not null default 'bronze' check (tier in ('bronze','silver','gold','platinum')),
  visit_count       int not null default 0,
  last_visit_at     timestamptz,
  preferences       jsonb not null default '[]'::jsonb,
  notes             text not null default '',
  marketing_consent boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists customers_org_idx on public.customers (organization_id);

-- ------------------------------------------------------- billing & platform

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  invoice_number  text not null,
  issued_at       timestamptz not null default now(),
  amount          numeric(12,2) not null default 0,
  status          text not null default 'paid' check (status in ('paid','pending','failed')),
  plan_id         text not null default 'growth',
  period_label    text not null default ''
);

create table if not exists public.payment_methods (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  brand           text not null default 'visa' check (brand in ('visa','mastercard','amex','rupay','upi')),
  last4           text not null default '',
  expiry          text not null default '',
  is_default      boolean not null default true
);

-- Append-only audit trail (prd.md §27). No UPDATE/DELETE policy is granted.
create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations on delete set null,
  actor_id        uuid,
  actor_name      text not null default 'System',
  actor_role      text not null default 'owner',
  action          text not null,
  entity_type     text not null default '',
  entity_id       text,
  summary         text not null default '',
  ip_address      text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  kind            text not null default 'system'
                    check (kind in ('order','service_request','inventory','subscription','system')),
  title           text not null,
  body            text not null default '',
  read            boolean not null default false,
  href            text,
  created_at      timestamptz not null default now()
);

create index if not exists notifications_org_idx on public.notifications (organization_id, created_at desc);

-- ============================================================================
--  RLS helpers — created AFTER the tables, because Postgres validates
--  language-SQL function bodies at CREATE time.
-- ============================================================================

-- Membership test used by every RLS policy. SECURITY DEFINER so the policy can
-- read `memberships` without recursing into its own RLS check.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

-- Platform staff can read/write across tenants (prd.md §24).
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.role = 'super_admin' and m.status = 'active'
  );
$$;

-- A tenant is publicly visible (QR menu) only while its subscription is live.
create or replace function public.is_public_tenant(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = org and o.subscription_status in ('active', 'trialing')
  );
$$;

-- ============================================================================
--  Row Level Security — tenant isolation (prd.md §26)
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.organizations     enable row level security;
alter table public.memberships       enable row level security;
alter table public.menu_categories   enable row level security;
alter table public.menu_items        enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.service_requests  enable row level security;
alter table public.reservations      enable row level security;
alter table public.inventory_items   enable row level security;
alter table public.customers         enable row level security;
alter table public.invoices          enable row level security;
alter table public.payment_methods   enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.notifications     enable row level security;

-- ---------------------------------------------------------------- profiles

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------- organizations

drop policy if exists org_select_member on public.organizations;
create policy org_select_member on public.organizations
  for select using (public.is_org_member(id) or public.is_super_admin() or public.is_public_tenant(id));

drop policy if exists org_insert_authenticated on public.organizations;
create policy org_insert_authenticated on public.organizations
  for insert to authenticated with check (true);

drop policy if exists org_update_member on public.organizations;
create policy org_update_member on public.organizations
  for update using (public.is_org_member(id) or public.is_super_admin())
  with check (public.is_org_member(id) or public.is_super_admin());

-- ---------------------------------------------------------------- memberships

drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (
    user_id = auth.uid() or public.is_org_member(organization_id) or public.is_super_admin()
  );

drop policy if exists memberships_write on public.memberships;
create policy memberships_write on public.memberships
  for all using (public.is_org_member(organization_id) or public.is_super_admin())
  with check (public.is_org_member(organization_id) or public.is_super_admin() or user_id = auth.uid());

-- ----------------------------------------------- tenant-scoped table policies
-- Same shape for every operational table: members read/write, super admin can
-- do anything. Guest (anon) access is granted separately below.

do $$
declare
  t text;
begin
  foreach t in array array[
    'menu_categories','menu_items','restaurant_tables','orders','service_requests',
    'reservations','inventory_items','customers','invoices','payment_methods','notifications'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_tenant_all', t);
    execute format(
      'create policy %I on public.%I for all
         using (public.is_org_member(organization_id) or public.is_super_admin())
         with check (public.is_org_member(organization_id) or public.is_super_admin())',
      t || '_tenant_all', t
    );
  end loop;
end $$;

-- Order items inherit the order's tenant scope.
drop policy if exists order_items_tenant_all on public.order_items;
create policy order_items_tenant_all on public.order_items
  for all using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (public.is_org_member(o.organization_id) or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (public.is_org_member(o.organization_id) or public.is_super_admin())
    )
  );

-- ------------------------------------------------------- guest (QR) access
-- The customer menu and ordering flow runs on the anon key: read the published
-- catalog of a live tenant, and place orders / service requests.

drop policy if exists public_menu_read on public.menu_categories;
create policy public_menu_read on public.menu_categories
  for select to anon using (public.is_public_tenant(organization_id) and is_active);

drop policy if exists public_items_read on public.menu_items;
create policy public_items_read on public.menu_items
  for select to anon using (public.is_public_tenant(organization_id) and available);

drop policy if exists public_tables_read on public.restaurant_tables;
create policy public_tables_read on public.restaurant_tables
  for select to anon using (public.is_public_tenant(organization_id));

drop policy if exists public_orders_insert on public.orders;
create policy public_orders_insert on public.orders
  for insert to anon with check (public.is_public_tenant(organization_id) and channel = 'dine_in');

-- Guests settle their own table bill from the QR flow (prd.md §14). In
-- production this write should come from a payment-gateway webhook instead of
-- the browser; here it is scoped to live tenants and unpaid dine-in orders.
drop policy if exists public_orders_pay on public.orders;
create policy public_orders_pay on public.orders
  for update to anon
  using (public.is_public_tenant(organization_id) and channel = 'dine_in' and payment_status = 'unpaid')
  with check (public.is_public_tenant(organization_id) and channel = 'dine_in');

-- The order's line items are only readable by guests through that order.
drop policy if exists public_order_items_read on public.order_items;
create policy public_order_items_read on public.order_items
  for select to anon using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and public.is_public_tenant(o.organization_id)
    )
  );

drop policy if exists public_order_items_insert on public.order_items;

-- =========================================================
--  Order number counters
-- =========================================================
-- One row per tenant holding the last BF-XXXX number that was allocated.
-- This is the source of truth for the atomic allocator below.

create table if not exists public.order_number_counters (
  organization_id uuid primary key,
  last_number     integer not null default 1199,
  constraint order_number_counters_last_number_check check (last_number >= 1199)
);

grant select on public.order_number_counters to anon, authenticated;

-- =========================================================
--  Atomic order number allocator
-- =========================================================
-- Allocates the next sequential BF number for a tenant in a single
-- UPDATE ... RETURNING statement, which Postgres serializes at the
-- row lock level so concurrent callers never collide.

create or replace function public.next_order_number(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num integer;
begin
  if not public.is_org_member(p_org_id) and not public.is_super_admin() then
    raise exception '403: not a member of this organization' using errcode = 'insufficient_permissions';
  end if;

  update public.order_number_counters
     set last_number = last_number + 1
   where organization_id = p_org_id
  returning last_number into v_num;

  if v_num is null then
    -- First order for this tenant — seed the counter.
    insert into public.order_number_counters (organization_id, last_number)
    values (p_org_id, 1200)
    returning last_number into v_num;
  end if;

  return v_num;
end;
$$;

grant execute on function public.next_order_number(uuid) to authenticated;
grant execute on function public.next_order_number(uuid) to service_role;

-- =========================================================
--  Rollback helper (Edge Function retry path)
-- =========================================================
-- Decrements the counter by one when an INSERT with an allocated number
-- hits the unique constraint, so the next allocation stays sequential.

create or replace function public.rollback_order_number(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num integer;
begin
  update public.order_number_counters
     set last_number = greatest(1199, last_number - 1)
   where organization_id = p_org_id
  returning last_number into v_num;
  return v_num;
end;
$$;

grant execute on function public.rollback_order_number(uuid) to service_role;

-- =========================================================
--  Formatting helper
-- =========================================================

create or replace function public.format_order_number(p_num integer)
returns text
language sql
stable
as $$
  select 'BF-' || p_num;
$$;

-- =========================================================
--  BEFORE INSERT trigger — fills order_number automatically
-- =========================================================
-- The app now passes order_number = '' (or omits it) on INSERT and lets
-- the trigger allocate the number atomically. This removes the race
-- condition between calling next_order_number() and then INSERTing.

create or replace function public.allocate_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.format_order_number(public.next_order_number(new.organization_id));
  end if;
  return new;
end;
$$;

drop trigger if exists orders_before_insert_number on public.orders;
create trigger orders_before_insert_number
  before insert on public.orders
  for each row execute function public.allocate_order_number();

-- =========================================================
--  Safety net — unique per-tenant order numbers
-- =========================================================
-- Even if something bypasses the trigger, Postgres rejects a duplicate
-- with a clear error instead of silently writing the same BF number twice.

alter table public.orders
  add constraint orders_org_number_unique
  unique (organization_id, order_number)
  not valid;

alter table public.orders validate constraint orders_org_number_unique;

grant execute on function public.allocate_order_number() to trigger;
grant execute on function public.rollback_order_number(uuid) to anon, authenticated;
grant execute on function public.format_order_number(integer) to anon, authenticated;
create policy public_order_items_insert on public.order_items
  for insert to anon with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and public.is_public_tenant(o.organization_id)
    )
  );

drop policy if exists public_service_requests_insert on public.service_requests;
create policy public_service_requests_insert on public.service_requests
  for insert to anon with check (public.is_public_tenant(organization_id));

-- ---------------------------------------------------------------- audit logs
-- Insert-only: no UPDATE or DELETE policy exists, so entries are immutable.

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select using (
    organization_id is null and public.is_super_admin()
    or organization_id is not null and (public.is_org_member(organization_id) or public.is_super_admin())
  );

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert with check (true);

-- ============================================================================
--  Triggers
-- ============================================================================

-- Mirror every new auth user into profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep a table's bill and occupancy in sync when an order changes state.
create or replace function public.sync_table_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live_statuses text[] := array['pending','accepted','preparing','ready','served'];
begin
  if new.table_id is null then
    return new;
  end if;

  if new.status = any (live_statuses) then
    update public.restaurant_tables
       set status       = 'occupied',
           current_bill = (select coalesce(sum(total), 0) from public.orders
                            where table_id = new.table_id and status = any (live_statuses)),
           occupied_since = coalesce(occupied_since, new.placed_at)
     where id = new.table_id;
  else
    update public.restaurant_tables
       set status = case when status = 'occupied' then 'cleaning' else status end,
           current_bill = 0,
           occupied_since = null
     where id = new.table_id
       and not exists (
         select 1 from public.orders
         where table_id = new.table_id and status = any (live_statuses) and id <> new.id
       );
  end if;

  return new;
end;
$$;

drop trigger if exists orders_sync_table on public.orders;
create trigger orders_sync_table
  after insert or update of status on public.orders
  for each row execute function public.sync_table_from_order();

-- ============================================================================
--  Realtime — live orders, tables, service requests and notifications (prd.md §25)
-- ============================================================================

-- `supabase_realtime` ships with every Supabase project; guard anyway so this
-- script also runs against a plain Postgres instance.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime not found — skipping realtime setup.';
    return;
  end if;

  foreach t in array array['orders','restaurant_tables','service_requests','notifications']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
