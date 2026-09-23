-- ============================================================================
--  rls_platform_admin_boundary_test.sql
--
--  Run with:   supabase test db        (requires the Supabase CLI + Docker)
--
--  Proves against a real Postgres instance that the client-side /admin guard is
--  backed by RLS: an authenticated tenant owner must not be able to read
--  platform-level rows (audit_logs with a null organization_id), another
--  tenant's organizations / memberships, another user's profile, or another
--  tenant's order-number counter — while a platform super admin can.
--
--  The same invariants run without a database in src/test/rls.test.ts.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

-- pgtap installs into `extensions`; keep it reachable after switching roles.
set local search_path = public, extensions;

select plan(15);

-- ------------------------------------------------------------------ fixtures
-- Inserted as the connecting role (the table owner), so RLS does not apply to
-- the setup. The auth.users insert also exercises handle_new_user(), which
-- mirrors each user into public.profiles.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner-a@rls.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner-b@rls.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'platform-admin@rls.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, subscription_status)
values
  ('00000000-0000-4000-8000-0000000000b1', 'RLS Tenant A', 'rls-tenant-a', 'active'),
  ('00000000-0000-4000-8000-0000000000b2', 'RLS Tenant B', 'rls-tenant-b', 'active')
on conflict (id) do nothing;

-- owner A belongs to tenant A; owner B to tenant B; the platform admin is a
-- super_admin of tenant A (mirroring the demo seed).
insert into public.memberships (organization_id, user_id, role, status)
values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a2', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a3', 'super_admin', 'active');

insert into public.audit_logs (organization_id, actor_name, actor_role, action, summary)
values
  (null,                                   'System',  'super_admin', 'platform.plan.changed', 'platform-level row'),
  ('00000000-0000-4000-8000-0000000000b1', 'Owner A', 'owner',       'order.created',         'tenant A row'),
  ('00000000-0000-4000-8000-0000000000b2', 'Owner B', 'owner',       'order.created',         'tenant B row');

insert into public.order_number_counters (organization_id, last_number)
values ('00000000-0000-4000-8000-0000000000b2', 1250)
on conflict (organization_id) do nothing;

-- ============================================ authenticated tenant owner (A)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select is(
  (select count(*)::int from public.audit_logs where organization_id is null),
  0,
  'tenant owner cannot read platform-level audit rows (organization_id is null)'
);

select is(
  (select count(*)::int from public.audit_logs where organization_id = '00000000-0000-4000-8000-0000000000b2'),
  0,
  'tenant owner cannot read another tenant''s audit rows'
);

select is(
  (select count(*)::int from public.audit_logs where organization_id = '00000000-0000-4000-8000-0000000000b1'),
  1,
  'tenant owner can still read their own tenant''s audit rows'
);

select is(
  (select count(*)::int from public.memberships where organization_id = '00000000-0000-4000-8000-0000000000b2'),
  0,
  'tenant owner cannot read another tenant''s memberships'
);

select is(
  (select count(*)::int from public.profiles where id <> '00000000-0000-4000-8000-0000000000a1'),
  0,
  'tenant owner cannot read other users'' profiles'
);

select is(
  (select count(*)::int from public.order_number_counters
    where organization_id = '00000000-0000-4000-8000-0000000000b2'),
  0,
  'tenant owner cannot read another tenant''s order-number counter'
);

select is(
  (select count(*)::int from public.organizations where id = '00000000-0000-4000-8000-0000000000b1'),
  1,
  'tenant owner can still read their own tenant'
);

-- ================================================= authenticated platform admin
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}';

select is(
  (select count(*)::int from public.audit_logs where organization_id is null),
  1,
  'platform super admin can read platform-level audit rows'
);

select is(
  (select count(*)::int from public.memberships where organization_id = '00000000-0000-4000-8000-0000000000b2'),
  1,
  'platform super admin can read every tenant''s memberships'
);

select is(
  (select count(*)::int from public.profiles),
  3,
  'platform super admin can read every profile'
);

select is(
  (select count(*)::int from public.order_number_counters
    where organization_id = '00000000-0000-4000-8000-0000000000b2'),
  1,
  'platform super admin can read every tenant''s order-number counter'
);

-- ======================================================================= anon
reset role;
set local role anon;

select is((select count(*)::int from public.audit_logs), 0, 'anon cannot read audit logs');
select is((select count(*)::int from public.memberships), 0, 'anon cannot read memberships');
select is((select count(*)::int from public.profiles), 0, 'anon cannot read profiles');

select ok(
  not has_table_privilege('anon', 'public.order_number_counters', 'select'),
  'anon has no SELECT grant on order_number_counters'
);

-- ====================================================================== finish
reset role;
select * from finish();
rollback;
