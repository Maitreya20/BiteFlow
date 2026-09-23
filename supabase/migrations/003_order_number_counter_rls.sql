-- ============================================================================
--  003_order_number_counter_rls.sql
--  Applies the platform RLS boundary to public.order_number_counters.
--
--  Gap being closed: 002 created the table without row level security and then
--  granted SELECT to the `anon` role. With RLS off, any holder of the public
--  anon key could read every tenant's current order number (and, because there
--  was no policy at all, the table was writable by any authenticated caller
--  that had a grant).
--
--  After this migration the counter sits behind the same membership boundary as
--  the rest of the schema. Reads are limited to members of that tenant plus
--  platform admins; the `anon` grant is removed. Writes are intentionally left
--  to the SECURITY DEFINER helpers (next_order_number / rollback_order_number),
--  which run as the table owner and therefore bypass RLS — no INSERT, UPDATE or
--  DELETE policy is granted to anon or authenticated.
--
--  Safe to run multiple times.
-- ============================================================================

set check_function_bodies = off;

-- ------------------------------------------------------------------- RLS

alter table public.order_number_counters enable row level security;

drop policy if exists order_number_counters_select on public.order_number_counters;
create policy order_number_counters_select on public.order_number_counters
  for select using (public.is_org_member(organization_id) or public.is_super_admin());

-- The counter is operational metadata, not part of the public QR catalogue.
-- Revoke everything (not just SELECT) from anon, so the only way to reach the
-- table is through the membership-scoped policy below.
revoke all on public.order_number_counters from anon;
grant  select on public.order_number_counters to authenticated;

-- --------------------------------------------------- harden the rollback RPC
-- rollback_order_number() shipped with no authorization check and was granted
-- to anon + authenticated, so any caller could repeatedly decrement an arbitrary
-- tenant's counter. Give it the same membership guard as next_order_number() and
-- keep it server-side (service_role) only.

create or replace function public.rollback_order_number(p_org_id uuid)
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
     set last_number = greatest(1199, last_number - 1)
   where organization_id = p_org_id
  returning last_number into v_num;
  return v_num;
end;
$$;

revoke execute on function public.rollback_order_number(uuid) from public, anon, authenticated;
grant  execute on function public.rollback_order_number(uuid) to service_role;
