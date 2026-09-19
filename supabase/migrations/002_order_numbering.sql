-- ============================================================================
--  002_order_numbering.sql
--  Applies the order-numbering subsystem to a database that already has
--  the base schema from 001_full_stack.sql.
--
--  Safe to run multiple times (all objects are  /
--   / ).
--  Does NOT touch tables or policies created by 001.
-- ============================================================================

set check_function_bodies = off;

-- ----------------------------------------------------------------- counter

create table if not exists public.order_number_counters (
  organization_id uuid primary key,
  last_number     integer not null default 1199,
  constraint order_number_counters_last_number_check check (last_number >= 1199)
);

grant select on public.order_number_counters to anon, authenticated;

-- --------------------------------------------------------- atomic allocator

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
    insert into public.order_number_counters (organization_id, last_number)
    values (p_org_id, 1200)
    returning last_number into v_num;
  end if;

  return v_num;
end;
$$;

grant execute on function public.next_order_number(uuid) to authenticated;
grant execute on function public.next_order_number(uuid) to service_role;

-- --------------------------------------------------------- rollback helper

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

-- --------------------------------------------------------- formatting helper

create or replace function public.format_order_number(p_num integer)
returns text
language sql
stable
as $$
  select 'BF-' || p_num;
$$;

-- --------------------------------------------------------- BEFORE INSERT trigger

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

-- --------------------------------------------------------- safety net

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_org_number_unique'
      and contype = 'u'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_org_number_unique
      unique (organization_id, order_number);
  end if;
end
$$;

grant execute on function public.allocate_order_number() to trigger;
grant execute on function public.rollback_order_number(uuid) to anon, authenticated;
grant execute on function public.format_order_number(integer) to anon, authenticated;