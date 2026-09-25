-- ============================================================================
--  005_guest_order_flows.sql
--  Make the guest (anon) flows actually work on a live project.
-- ============================================================================
--
--  Discovered while wiring the guest confirmation UI: on the hosted database
--  every guest flow except the bare orders INSERT silently failed.
--
--  Root cause 1 — RLS subqueries run with the CALLER's privileges. Anon
--  deliberately has no SELECT policy on `orders`, so the
--  `exists (select 1 from orders ...)` inside the order_items INSERT policy
--  could never see the guest's own order → every order_items insert 42501'd.
--
--  Root cause 2 — an UPDATE policy alone is not enough: UPDATE and DELETE row
--  visibility ALSO requires the row to pass a SELECT policy. With none, anon's
--  `public_orders_pay` policy compiled fine, returned 204, and updated zero
--  rows. Every "settle the bill" tap was silently discarded.
--
--  This migration rebuilds the guest surface accordingly:
--
--    * order_items INSERT     → policy keyed on organization_id directly (no
--                                subquery), so attaching line items works.
--    * bill settle            → SECURITY DEFINER rpc `settle_guest_order`;
--                                the no-op UPDATE policy is dropped.
--    * order status tracking  → SECURITY DEFINER rpc `get_guest_order`; the
--                                guest already holds the unguessable order
--                                uuid, so returning that single row is the
--                                capability. Enables the polling fallback on
--                                the tracking screen without opening SELECT
--                                on orders to anon.
--    * orders UPDATE policy   → dropped (was unreachable by construction).
--
--  Staff (authenticated) policies are untouched: members hold SELECT via
--  orders_tenant_all and were never affected by either root cause.
-- ============================================================================

set check_function_bodies = off;

-- ------------------------------------------------- parent-order visibility
-- SECURITY DEFINER so the check can see the parent order without granting
-- anon any SELECT on `orders`. One helper serves both the insert policy and
-- the read policy on order_items.
create or replace function public.is_public_order(
  p_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
     where o.id = p_order_id
       and public.is_public_tenant(o.organization_id)
  )
$$;

revoke execute on function public.is_public_order(uuid) from public;
grant  execute on function public.is_public_order(uuid) to anon, authenticated;

-- ------------------------------------------------------------- order_items
-- Guests attach line items to the order they just placed. The check rides on
-- the parent order via the definer helper above; the guest still cannot
-- enumerate other orders (no SELECT policy on orders for anon).
drop policy if exists public_order_items_insert on public.order_items;
create policy public_order_items_insert on public.order_items
  for insert to anon
  with check (public.is_public_order(order_id));

-- Same reasoning for reading a ticket's lines back (guest order tracking).
drop policy if exists public_order_items_read on public.order_items;
create policy public_order_items_read on public.order_items
  for select to anon
  using (public.is_public_order(order_id));

-- ----------------------------------------------------- bill settle (replace)
drop policy if exists public_orders_pay on public.orders;

-- The guest bill settle, done properly. SECURITY DEFINER means the function
-- sees the row regardless of anon RLS; the guards below re-implement exactly
-- what the old policy intended: unpaid, dine-in, public tenant. The update is
-- idempotent for a repeated tap and refuses anything that is not a settle.
create or replace function public.settle_guest_order(
  p_order_id uuid,
  p_method   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method text := lower(btrim(coalesce(p_method, '')));
begin
  if v_method not in ('cash', 'card', 'upi', 'wallet') then
    raise exception 'settle_guest_order: unsupported payment method' using errcode = '22023';
  end if;

  update public.orders
     set payment_status = 'paid',
         payment_method = v_method,
         status         = 'completed',
         completed_at   = coalesce(completed_at, now())
   where id = p_order_id
     and payment_status = 'unpaid'
     and channel        = 'dine_in'
     and public.is_public_tenant(organization_id);

  if not found then
    -- Either already settled (idempotent re-tap) or not settleable. Distinguish
    -- so the client can tell the guest something true.
    if exists (
      select 1 from public.orders
       where id = p_order_id
         and payment_status = 'paid'
         and channel        = 'dine_in'
         and public.is_public_tenant(organization_id)
    ) then
      return;  -- already paid — treat as success
    end if;
    raise exception 'settle_guest_order: order cannot be settled' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.settle_guest_order(uuid, text) from public, anon, authenticated;
grant  execute on function public.settle_guest_order(uuid, text) to anon, authenticated;

-- ------------------------------------------------ order status for the guest
-- The tracking screen polls this while the order is pending. Capability is the
-- unguessable order uuid itself; nothing else is exposed, and only rows of a
-- public tenant are ever returned.
create or replace function public.get_guest_order(
  p_order_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(o)
    from public.orders o
   where o.id = p_order_id
     and public.is_public_tenant(o.organization_id)
$$;

revoke execute on function public.get_guest_order(uuid) from public, anon, authenticated;
grant  execute on function public.get_guest_order(uuid) to anon, authenticated;

-- The guest also needs their own line items to render the ticket. Same
-- capability model: the uuid selects the order, the join is definer-side.
create or replace function public.get_guest_order_items(
  p_order_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb)
    from public.order_items i
   where i.order_id = p_order_id
     and exists (
       select 1 from public.orders o
        where o.id = p_order_id
          and public.is_public_tenant(o.organization_id)
     )
$$;

revoke execute on function public.get_guest_order_items(uuid) from public, anon, authenticated;
grant  execute on function public.get_guest_order_items(uuid) to anon, authenticated;
