-- ============================================================================
--  Super-admin impersonation (prd.md §24 "Admin impersonation")
-- ============================================================================
--
-- Platform staff need to enter a tenant to debug a live problem. The naive
-- implementation — a client-side "switch role" that rewrites the session — is
-- spoofable: anyone can flip a flag and be a super admin.
--
-- This migration makes the *authorization decision* a server one:
--
--   • the actor is always `auth.uid()` from the verified JWT, never a parameter,
--     so a caller cannot claim to be somebody else;
--   • the target is resolved from `memberships` by the function, never supplied
--     by the caller, so a super admin cannot impersonate an arbitrary user id;
--   • every start and end writes an immutable `audit_logs` row;
--   • the grant is time-boxed (`expires_at`) and single-purpose (`ended_at`).
--
-- `impersonation_sessions` has NO insert/update/delete policy for any client
-- role, so the only writers are these SECURITY DEFINER functions and
-- service_role. A client cannot forge, edit or erase a record.
--
-- The session *tokens* for the target are minted by the `impersonate` Edge
-- Function, which holds the service role key. This file is the part of the
-- boundary that Postgres enforces on its own.

-- ------------------------------------------------------------------- table

create table if not exists public.impersonation_sessions (
  id                     uuid primary key default gen_random_uuid(),
  actor_user_id          uuid not null,
  actor_email            text not null default '',
  target_user_id         uuid not null,
  target_email           text not null default '',
  target_organization_id uuid not null references public.organizations on delete cascade,
  target_role            text not null default 'owner',
  reason                 text not null default '',
  started_at             timestamptz not null default now(),
  expires_at             timestamptz not null,
  ended_at               timestamptz,
  ended_by               uuid,
  constraint impersonation_window check (expires_at > started_at),
  constraint impersonation_distinct_parties check (actor_user_id <> target_user_id)
);

create index if not exists impersonation_actor_idx
  on public.impersonation_sessions (actor_user_id, started_at desc);
create index if not exists impersonation_org_idx
  on public.impersonation_sessions (target_organization_id, started_at desc);
create index if not exists impersonation_open_idx
  on public.impersonation_sessions (target_user_id) where ended_at is null;

-- ---------------------------------------------------------------------- RLS

alter table public.impersonation_sessions enable row level security;

-- Read only: the acting super admin, the impersonated user (so they can see who
-- entered their tenant), and platform staff. Deliberately no write policy.
drop policy if exists impersonation_select on public.impersonation_sessions;
create policy impersonation_select on public.impersonation_sessions
  for select using (
    actor_user_id = auth.uid()
    or target_user_id = auth.uid()
    or public.is_super_admin()
  );

-- The impersonation log is platform metadata, not part of the guest catalogue.
revoke all on public.impersonation_sessions from anon;
grant select on public.impersonation_sessions to authenticated;

-- ---------------------------------------------------------------- begin/end

-- Start an impersonation. The actor comes from the JWT; the target is resolved
-- here. Calling this without an active `super_admin` membership raises 42501,
-- and row level security means a non-admin has no other way in.
create or replace function public.begin_impersonation(
  p_organization_id uuid,
  p_reason text default '',
  p_ttl_minutes int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor         uuid := auth.uid();
  v_actor_email   text;
  v_target        uuid;
  v_target_email  text;
  v_target_role   text;
  v_session       public.impersonation_sessions;
  v_ttl           int;
begin
  if v_actor is null then
    raise exception 'begin_impersonation: authentication required' using errcode = '42501';
  end if;

  if not public.is_super_admin() then
    raise exception 'begin_impersonation: caller is not a platform super admin' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'begin_impersonation: organization is required' using errcode = '22004';
  end if;

  -- Resolve the identity to adopt. Ordered so an org with several members always
  -- yields the owner first; the caller never chooses the user id.
  select m.user_id, m.role
    into v_target, v_target_role
    from public.memberships m
   where m.organization_id = p_organization_id
     and m.status = 'active'
     and m.role <> 'super_admin'
   order by case m.role when 'owner' then 0 when 'manager' then 1 else 2 end, m.user_id
   limit 1;

  if v_target is null then
    raise exception 'begin_impersonation: organization has no active member to impersonate'
      using errcode = 'P0002';
  end if;

  if v_target = v_actor then
    raise exception 'begin_impersonation: refusing to impersonate yourself' using errcode = '22023';
  end if;

  v_ttl := greatest(1, least(coalesce(p_ttl_minutes, 30), 240));

  select p.email into v_actor_email from public.profiles p where p.id = v_actor;
  select p.email into v_target_email from public.profiles p where p.id = v_target;

  insert into public.impersonation_sessions (
    actor_user_id, actor_email, target_user_id, target_email,
    target_organization_id, target_role, reason, expires_at
  ) values (
    v_actor, coalesce(v_actor_email, ''), v_target, coalesce(v_target_email, ''),
    p_organization_id, v_target_role, coalesce(p_reason, ''), now() + make_interval(mins => v_ttl)
  )
  returning * into v_session;

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_role, action,
    entity_type, entity_id, summary
  ) values (
    p_organization_id, v_actor, coalesce(v_actor_email, 'Platform staff'), 'super_admin',
    'platform.impersonation.started', 'impersonation_session', v_session.id::text,
    format(
      'Impersonating %s (%s) for up to %s minutes%s',
      coalesce(v_target_email, v_target::text),
      coalesce(v_target_role, 'owner'),
      v_ttl,
      case when coalesce(p_reason, '') = '' then '' else ' — ' || p_reason end
    )
  );

  return to_jsonb(v_session);
end;
$$;

-- End an impersonation. The caller is the impersonated user (that is who holds
-- the token while impersonating) or the actor; anything else matches no row.
create or replace function public.end_impersonation(p_session_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_row   public.impersonation_sessions;
  v_actor_email text;
begin
  if v_uid is null then
    raise exception 'end_impersonation: authentication required' using errcode = '42501';
  end if;

  update public.impersonation_sessions s
     set ended_at = now(), ended_by = v_uid
   where s.ended_at is null
     and (
       (p_session_id is not null
         and s.id = p_session_id
         and (s.target_user_id = v_uid or s.actor_user_id = v_uid))
       or (p_session_id is null and s.target_user_id = v_uid)
     )
  returning * into v_row;

  if v_row.id is null then
    return jsonb_build_object('ended', false);
  end if;

  select p.email into v_actor_email from public.profiles p where p.id = v_uid;

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_role, action,
    entity_type, entity_id, summary
  ) values (
    v_row.target_organization_id, v_uid, coalesce(v_actor_email, 'Platform staff'), 'super_admin',
    'platform.impersonation.ended', 'impersonation_session', v_row.id::text,
    format('Impersonation of %s ended after %s minutes.',
      coalesce(v_row.target_email, v_row.target_user_id::text),
      greatest(0, round(extract(epoch from (now() - v_row.started_at)) / 60)::int))
  );

  return jsonb_build_object('ended', true, 'session', to_jsonb(v_row));
end;
$$;

-- What is this token currently standing in for? Lets the app restore its banner
-- (and offer "exit") after a reload without trusting anything client-side.
create or replace function public.active_impersonation()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(s)
    from public.impersonation_sessions s
   where s.target_user_id = auth.uid()
     and s.ended_at is null
     and s.expires_at > now()
   order by s.started_at desc
   limit 1;
$$;

grant execute on function public.begin_impersonation(uuid, text, int) to authenticated;
grant execute on function public.end_impersonation(uuid) to authenticated;
grant execute on function public.active_impersonation() to authenticated;
