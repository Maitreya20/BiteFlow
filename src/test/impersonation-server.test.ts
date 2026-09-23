/**
 * @vitest-environment node
 *
 * The *server half* of the impersonation boundary.
 *
 * The live client test (src/test/impersonation.test.ts) shows the browser only
 * sends an organization id. This file pins the other side: that the Edge
 * Function and the migration together actually make the decision, so a caller
 * who ignores the client entirely still cannot promote themselves.
 *
 * These read the real sources, so an edit that weakens the boundary — accepting
 * an actor id from the request body, skipping the super-admin check, dropping the
 * audit write, or letting a client role insert into the log — fails `npm test`.
 * The database policies themselves are evaluated in src/test/rls.test.ts, and
 * against a real Postgres instance by supabase/tests/impersonation_boundary_test.sql.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const read = (relative: string): string => readFileSync(join(ROOT, relative), 'utf8')

const FUNCTION = read('supabase/functions/impersonate/index.ts')
const MIGRATION = read('supabase/migrations/004_impersonation.sql')

/** Every .ts/.tsx file under src/, so we can prove the service key stays server-side. */
function sourceFiles(dir = 'src'): string[] {
  const out: string[] = []
  for (const entry of readdirSync(join(ROOT, dir))) {
    const relative = `${dir}/${entry}`
    if (statSync(join(ROOT, relative)).isDirectory()) out.push(...sourceFiles(relative))
    else if (/\.tsx?$/.test(entry)) out.push(relative)
  }
  return out
}

const indexOf = (haystack: string, needle: string) => {
  const at = haystack.indexOf(needle)
  expect(at, `expected to find ${needle}`).toBeGreaterThan(-1)
  return at
}

describe('impersonate Edge Function: the actor is never the client’s word', () => {
  it('is POST-only and answers the browser preflight', () => {
    expect(FUNCTION).toMatch(/req\.method === 'OPTIONS'/)
    expect(FUNCTION).toMatch(/req\.method !== 'POST'/)
  })

  it('identifies the caller from the Authorization header, via the auth server', () => {
    expect(FUNCTION).toMatch(/headers\.get\(['"]Authorization['"]\)/)
    expect(FUNCTION).toMatch(/auth\.getUser\(\)/)
  })

  it('never reads an actor, role or target user id out of the request body', () => {
    // The only body fields are the tenant to enter, a reason and a TTL.
    const readBodyFields = [...FUNCTION.matchAll(/body\.([a-z_]+)/g)].map((match) => match[1])
    expect(new Set(readBodyFields)).toEqual(new Set(['organization_id', 'reason', 'ttl_minutes']))

    for (const forbidden of ['body.actor', 'body.role', 'body.user_id', 'body.target_user_id', 'body.email']) {
      expect(FUNCTION, `${forbidden} must not be trusted`).not.toContain(forbidden)
    }
  })

  it('lets Postgres make the authorization decision, with the caller’s own token', () => {
    // The RPC runs on a caller-scoped client, so auth.uid() inside Postgres is the
    // real caller and the super-admin re-check cannot be skipped.
    expect(FUNCTION).toMatch(/global:\s*\{\s*headers:\s*\{\s*Authorization:\s*authorization\s*\}\s*\}/)
    expect(FUNCTION).toMatch(/\.rpc\(\s*['"]begin_impersonation['"]/)

    const authorization = indexOf(FUNCTION, "rpc('begin_impersonation'")
    const minting = indexOf(FUNCTION, 'generateLink')
    expect(authorization, 'the membership check must run before any session is minted').toBeLessThan(
      minting,
    )
  })

  it('reports a refusal as 403 rather than accepting an insufficient-privilege error', () => {
    expect(FUNCTION).toMatch(/42501/)
    expect(FUNCTION).toMatch(/403/)
    expect(FUNCTION).toMatch(/401/)
  })

  it('rolls the audit row back when the session cannot be minted', () => {
    // Otherwise the log would claim an impersonation that never happened.
    expect(FUNCTION).toMatch(/const abandon = /)
    expect(FUNCTION).toMatch(/impersonation_sessions['"]?\)\s*\n?\s*\.update/)
    expect(FUNCTION).toMatch(/ended_at/)
  })
})

describe('impersonation migration: audited, time-boxed, client-read-only', () => {
  it('enables row level security and gives clients no way to write', () => {
    expect(MIGRATION).toMatch(/alter table public\.impersonation_sessions enable row level security/i)

    const policies = [...MIGRATION.matchAll(/create policy\s+(\w+)[\s\S]*?(?=;)/gi)].map((match) =>
      match[0].replace(/\s+/g, ' ').toLowerCase(),
    )
    expect(policies.length).toBeGreaterThan(0)

    for (const policy of policies) {
      expect(policy, 'a `for all` policy would open writes').not.toMatch(/for all\b/)
      expect(policy, 'no client role may insert an impersonation record').not.toMatch(/for insert\b/)
      expect(policy, 'no client role may rewrite an impersonation record').not.toMatch(/for update\b/)
      expect(policy, 'the audit trail must not be erasable').not.toMatch(/for delete\b/)
      expect(policy, 'a blanket allow would defeat the boundary').not.toMatch(/using\s*\(\s*true\s*\)/)
    }

    expect(MIGRATION).toMatch(/revoke all on public\.impersonation_sessions from anon/i)
  })

  it('derives the actor from auth.uid() and never from a parameter', () => {
    const begin = MIGRATION.slice(indexOf(MIGRATION, 'function public.begin_impersonation'))
    const body = begin.slice(0, indexOf(begin, 'grant execute'))

    expect(body).toMatch(/v_actor\s+uuid\s*:=\s*auth\.uid\(\)/)
    expect(body, 'the caller cannot nominate who it is').not.toMatch(/p_actor/)
    // The signature decides which parameters exist at all.
    const signature = MIGRATION.match(/function public\.begin_impersonation\(([\s\S]*?)\)\s*\nreturns/)?.[1] ?? ''
    expect(signature.replace(/\s+/g, ' ')).toMatch(/p_organization_id uuid/)
    expect(signature).not.toMatch(/p_actor|p_user_id|p_role/)
  })

  it('requires an active super-admin membership and refuses self-impersonation', () => {
    const begin = MIGRATION.slice(indexOf(MIGRATION, 'function public.begin_impersonation'))
    const body = begin.slice(0, indexOf(begin, 'grant execute'))

    expect(body).toMatch(/not public\.is_super_admin\(\)/)
    expect(body).toMatch(/raise exception/i)
    expect(body).toMatch(/v_target = v_actor/)
    expect(body).toMatch(/m\.status = 'active'/)
    // The target is resolved from memberships, never supplied by the caller.
    expect(body).toMatch(/from public\.memberships m/)
    expect(body).not.toMatch(/p_target_user_id/)
  })

  it('writes an immutable audit row for both start and end', () => {
    const begin = MIGRATION.slice(indexOf(MIGRATION, 'function public.begin_impersonation'))
    expect(begin).toMatch(/insert into public\.audit_logs/)
    expect(begin).toMatch(/platform\.impersonation\.started/)

    const end = MIGRATION.slice(indexOf(MIGRATION, 'function public.end_impersonation'))
    expect(end).toMatch(/insert into public\.audit_logs/)
    expect(end).toMatch(/platform\.impersonation\.ended/)
  })

  it('time-boxes the grant and keeps the functions SECURITY DEFINER with a pinned search_path', () => {
    expect(MIGRATION).toMatch(/expires_at > started_at/i)
    expect(MIGRATION).toMatch(/make_interval\(mins => v_ttl\)/)
    expect(MIGRATION).toMatch(/greatest\(1, least\(coalesce\(p_ttl_minutes, 30\), 240\)\)/)

    for (const name of ['begin_impersonation', 'end_impersonation', 'active_impersonation']) {
      const declaration =
        new RegExp(`function public\\.${name}\\([\\s\\S]*?as \\$\\$`, 'i').exec(MIGRATION)?.[0] ?? ''
      expect(declaration, `public.${name}() must exist`).toBeTruthy()
      expect(declaration, `public.${name}() must be SECURITY DEFINER`).toMatch(/security definer/i)
      expect(declaration, `public.${name}() must pin search_path`).toMatch(/set search_path = public/i)
    }
  })

  it('grants the impersonation RPCs to authenticated callers only', () => {
    for (const name of ['begin_impersonation', 'end_impersonation', 'active_impersonation']) {
      expect(MIGRATION).toMatch(new RegExp(`grant execute on function public\\.${name}[\\s\\S]*?to authenticated`, 'i'))
      expect(MIGRATION, `${name} must not be granted to anon`).not.toMatch(
        new RegExp(`grant execute on function public\\.${name}[^;]*to[^;]*anon`, 'i'),
      )
    }
  })

  it('only ends rows the caller is party to', () => {
    const end = MIGRATION.slice(indexOf(MIGRATION, 'function public.end_impersonation'))
    const body = end.slice(0, indexOf(end, 'grant execute'))
    expect(body).toMatch(/s\.target_user_id = v_uid or s\.actor_user_id = v_uid/)
  })
})

describe('service role key: server-side only', () => {
  it('is referenced by the Edge Function', () => {
    expect(FUNCTION).toMatch(/Deno\.env\.get\(['"]SUPABASE_SERVICE_ROLE_KEY['"]\)/)
  })

  it('never appears anywhere in the browser bundle source', () => {
    // Test files are excluded: this assertion itself names the variable.
    const offenders = sourceFiles()
      .filter((file) => !file.startsWith('src/test/'))
      .filter((file) => /SERVICE_ROLE|service_role_key/i.test(read(file)))

    expect(offenders, 'the service role key must never reach the client').toEqual([])
  })
})
