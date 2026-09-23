-- ============================================================================
--  impersonation_boundary_test.sql
--
--  Run with:   supabase test db        (requires the Supabase CLI + Docker)
--
--  Proves against a real Postgres instance that super-admin impersonation is a
--  server decision rather than a client one:
--
--    • a tenant owner cannot start an impersonation (the function checks
--      is_super_admin()), nor forge, edit or erase an impersonation record —
--      the log is client-read-only;
--    • an impersonated tenant can see that it happened, but nobody else's;
--    • a platform admin's start/end both land in audit_logs;
--    • the grant is time-boxed by a CHECK constraint.
--
--  The same invariants run without a database in src/test/rls.test.ts (policies)
--  and src/test/impersonation-server.test.ts (function + Edge Function source).
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

-- pgtap installs into `extensions`; keep it reachable after switching roles.
set local search_path = public, extensions;

select plan(16);

-- ------------------------------------------------------------------ fixtures
-- Inserted as the connecting role (the table owner), so RLS does not apply to
-- the setup. The auth.users insert also exercises handle_new_user(), which
-- mirrors each user into public.profiles — the impersonation functions read
-- emails from there.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner-a@imp.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner-b@imp.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'platform-admin@imp.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, subscription_status)
values
  ('00000000-0000-4000-8000-0000000000d1', 'Imp Tenant A', 'imp-tenant-a', 'active'),
  ('00000000-0000-4000-8000-0000000000d2', 'Imp Tenant B', 'imp-tenant-b', 'active'),
  -- Tenant C exists so the platform admin is its *only* member: the one case
  -- where the resolved target is the caller, which must be refused.
  ('00000000-0000-4000-8000-0000000000d3', 'Imp Tenant C', 'imp-tenant-c', 'active')
on conflict (id) do nothing;

insert into public.memberships (organization_id, user_id, role, status)
values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c2', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c3', 'super_admin', 'active'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000c3', 'manager', 'active');

-- One impersonation already on record: the platform admin standing in for B's
-- owner. Used to check who can see it.
insert into public.impersonation_sessions (
  id, actor_user_id, actor_email, target_user_id, target_email,
  target_organization_id, target_role, reason, expires_at
)
values (
  '00000000-0000-4000-8000-0000000000e1',
  '00000000-0000-4000-8000-0000000000c3', 'platform-admin@imp.test',
  '00000000-0000-4000-8000-0000000000c2', 'owner-b@imp.test',
  '00000000-0000-4000-8000-0000000000d2', 'owner', 'stuck order', now() + interval '30 minutes'
);

-- ============================================================ window constraint
-- Runs as the connecting role: this is a table constraint, not a policy.
select throws_ok(
  $$ insert into public.impersonation_sessions
       (actor_user_id, target_user_id, target_organization_id, started_at, expires_at)
     values ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c2',
             '00000000-0000-4000-8000-0000000000d2', now(), now() - interval '1 minute') $$,
  '23514',
  null,
  'an impersonation whose grant would already be expired is rejected'
);

-- ==================================================================== anon
set local role anon;

select ok(
  not has_table_privilege('anon', 'public.impersonation_sessions', 'select'),
  'anon has no SELECT grant on the impersonation log'
);

-- ============================================ authenticated tenant owner (A)
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';

select is(
  (select count(*)::int from public.impersonation_sessions
    where id = '00000000-0000-4000-8000-0000000000e1'),
  0,
  'a tenant owner cannot read an impersonation of somebody else'
);

select throws_ok(
  $$ insert into public.impersonation_sessions
       (actor_user_id, target_user_id, target_organization_id, expires_at)
     values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2',
             '00000000-0000-4000-8000-0000000000d1', now() + interval '1 hour') $$,
  '42501',
  null,
  'a tenant owner cannot forge an impersonation record'
);

select is(
  (with updated as (
     update public.impersonation_sessions set ended_at = now() returning 1
   ) select count(*)::int from updated),
  0,
  'a tenant owner cannot rewrite the impersonation log'
);

select throws_ok(
  $$ select public.begin_impersonation('00000000-0000-4000-8000-0000000000d2') $$,
  '42501',
  null,
  'a tenant owner cannot start an impersonation'
);

-- ============================================ authenticated tenant owner (B)
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}';

select is(
  (select count(*)::int from public.impersonation_sessions),
  1,
  'an impersonated tenant can see that it happened'
);

select is(
  (public.active_impersonation() ->> 'id'),
  '00000000-0000-4000-8000-0000000000e1',
  'the impersonated session is reported to its own token'
);

select is(
  (with deleted as (
     delete from public.impersonation_sessions returning 1
   ) select count(*)::int from deleted),
  0,
  'an impersonated tenant cannot erase the audit trail'
);

-- ================================================= authenticated platform admin
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}';

select is(
  (select count(*)::int from public.impersonation_sessions),
  1,
  'platform staff can read the whole impersonation log'
);

select is(
  (public.begin_impersonation('00000000-0000-4000-8000-0000000000d2') ->> 'target_user_id'),
  '00000000-0000-4000-8000-0000000000c2',
  'a super admin impersonates the tenant owner resolved from memberships'
);

select throws_ok(
  $$ select public.begin_impersonation('00000000-0000-4000-8000-0000000000d3') $$,
  '22023',
  null,
  'a super admin cannot impersonate themselves'
);

select is(
  (select count(*)::int from public.audit_logs
    where action = 'platform.impersonation.started'
      and actor_id = '00000000-0000-4000-8000-0000000000c3'),
  1,
  'starting an impersonation writes an audit row naming the actor'
);

select is(
  (public.end_impersonation('00000000-0000-4000-8000-0000000000e1') ->> 'ended'),
  'true',
  'the actor can end the impersonation'
);

select is(
  (select count(*)::int from public.audit_logs
    where action = 'platform.impersonation.ended'
      and actor_id = '00000000-0000-4000-8000-0000000000c3'),
  1,
  'ending an impersonation writes an audit row naming the actor'
);

-- ===================================================== after the grant is closed
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}';

select ok(
  public.active_impersonation() is null,
  'an ended impersonation is no longer active for the impersonated token'
);

-- ====================================================================== finish
reset role;
select * from finish();
rollback;
