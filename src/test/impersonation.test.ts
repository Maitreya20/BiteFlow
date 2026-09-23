/**
 * @vitest-environment node
 *
 * Live-mode impersonation, from the client's side.
 *
 * `src/lib/supabase` is mocked so `MODE` is `live` without real credentials, and
 * the fake client records every call. The point of these tests is the *shape of
 * the trust boundary*:
 *
 *   • the client sends an organization id and a reason — nothing that decides
 *     who it is or who it becomes;
 *   • a session without a super-admin membership is refused locally and the
 *     server is never even called;
 *   • impersonation adopts the session the server minted, and exiting restores
 *     the actor's own token.
 *
 * The server half of the boundary — that the Edge Function derives the actor
 * from the JWT and that Postgres re-checks the membership and writes the audit
 * row — is asserted in src/test/impersonation-server.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    session: null as null | { access_token: string; refresh_token: string; user: { id: string; email: string } },
    rows: {} as Record<string, unknown[]>,
    invoke: [] as { name: string; body: Record<string, unknown> }[],
    rpc: [] as { name: string; args: Record<string, unknown> }[],
    setSession: [] as { access_token: string; refresh_token: string }[],
    invokeResult: { data: null as unknown, error: null as unknown },
  }

  const queryBuilder = (table: string) => {
    const result = { data: state.rows[table] ?? [], error: null }
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'order', 'limit', 'eq', 'is', 'update', 'insert', 'delete', 'upsert']) {
      builder[method] = () => builder
    }
    // `liveLoadAll` awaits these builders inside Promise.all, so a thenable is
    // enough — no need to emulate PostgREST.
    builder.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected)
    return builder
  }

  const client = {
    auth: {
      getSession: async () => ({ data: { session: state.session }, error: null }),
      getUser: async () => ({ data: { user: state.session?.user ?? null }, error: null }),
      setSession: async (tokens: { access_token: string; refresh_token: string }) => {
        state.setSession.push(tokens)
        // Whoever the minted/restored token belongs to is now the caller.
        state.session = tokens.access_token.startsWith('actor-')
          ? { ...tokens, user: { id: 'admin-1', email: 'admin@biteflow.com' } }
          : { ...tokens, user: { id: 'owner-1', email: 'owner@urbanbean.test' } }
        return { data: { session: state.session }, error: null }
      },
      signOut: async () => {
        state.session = null
        return { error: null }
      },
    },
    functions: {
      invoke: async (name: string, options: { body: Record<string, unknown> }) => {
        state.invoke.push({ name, body: options.body })
        return state.invokeResult
      },
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpc.push({ name, args })
      return { data: { ended: true }, error: null }
    },
    from: (table: string) => queryBuilder(table),
  }

  return { state, client }
})

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: h.client,
  requireSupabase: () => h.client,
  siteOrigin: () => 'http://localhost:5173',
  connectionState: 'live',
}))

import {
  MODE,
  canImpersonate,
  endImpersonation,
  getImpersonation,
  getSession,
  loadSession,
  signOut,
  startImpersonation,
} from '@/data/api'

const ADMIN_TOKENS = { access_token: 'actor-token', refresh_token: 'actor-refresh' }
const MINTED = {
  impersonation: {
    id: 'imp-1',
    organization_id: 'org-a',
    target_user_id: 'owner-1',
    target_email: 'owner@urbanbean.test',
    expires_at: '2026-09-22T12:30:00.000Z',
  },
  session: { access_token: 'owner-token', refresh_token: 'owner-refresh' },
}

/** Rows the fake PostgREST layer returns, per table. */
const ROWS: Record<string, unknown[]> = {
  profiles: [
    { id: 'admin-1', email: 'admin@biteflow.com', full_name: 'Platform Admin', avatar_url: null },
    { id: 'owner-1', email: 'owner@urbanbean.test', full_name: 'Priya Owner', avatar_url: null },
  ],
  organizations: [
    { id: 'org-a', name: 'Urban Bean', slug: 'urban-bean', subscription_status: 'active', plan_id: 'growth' },
  ],
  memberships: [
    { id: 'm-admin', organization_id: 'org-a', user_id: 'admin-1', role: 'super_admin', status: 'active' },
    { id: 'm-owner', organization_id: 'org-a', user_id: 'owner-1', role: 'owner', status: 'active' },
  ],
}

async function signInAsAdmin() {
  h.state.session = { ...ADMIN_TOKENS, user: { id: 'admin-1', email: 'admin@biteflow.com' } }
  await loadSession()
}

async function signInAsOwner() {
  h.state.session = {
    access_token: 'owner-token',
    refresh_token: 'owner-refresh',
    user: { id: 'owner-1', email: 'owner@urbanbean.test' },
  }
  await loadSession()
}

describe('impersonation (live mode)', () => {
  beforeEach(async () => {
    h.state.rows = structuredClone(ROWS)
    h.state.invoke.length = 0
    h.state.rpc.length = 0
    h.state.setSession.length = 0
    h.state.invokeResult = { data: structuredClone(MINTED), error: null }
    await signOut()
  })

  it('runs in live mode with a super-admin session', async () => {
    // Precondition for every other assertion here.
    expect(MODE).toBe('live')
    await signInAsAdmin()
    expect(canImpersonate()).toBe(true)
  })

  it('refuses a session that is not a platform super admin, without calling the server', async () => {
    await signInAsOwner()

    expect(canImpersonate()).toBe(false)
    await expect(startImpersonation('org-a')).rejects.toThrow(/super admin/i)
    // The local guard is not the boundary — but there is no reason to ask.
    expect(h.state.invoke).toHaveLength(0)
    expect(getImpersonation()).toBeNull()
  })

  it('sends only an organization id and a reason', async () => {
    await signInAsAdmin()
    await startImpersonation('org-a', 'debugging a stuck order')

    expect(h.state.invoke).toHaveLength(1)
    expect(h.state.invoke[0].name).toBe('impersonate')
    // Anything that decides *who* the caller is, or who they become, must be
    // derived server-side — the client has no say.
    expect(Object.keys(h.state.invoke[0].body).sort()).toEqual(['organization_id', 'reason'])
    expect(h.state.invoke[0].body).toEqual({
      organization_id: 'org-a',
      reason: 'debugging a stuck order',
    })
  })

  it('adopts the minted session and records the impersonation', async () => {
    await signInAsAdmin()
    const state = await startImpersonation('org-a')

    expect(h.state.setSession).toEqual([MINTED.session])
    expect(getSession()?.user.email).toBe('owner@urbanbean.test')
    expect(state.organizationId).toBe('org-a')
    expect(state.organizationName).toBe('Urban Bean')
    expect(state.targetEmail).toBe('owner@urbanbean.test')
    expect(state.expiresAt).toBe(MINTED.impersonation.expires_at)
  })

  it('closes the audit row and hands the actor’s token back on exit', async () => {
    await signInAsAdmin()
    await startImpersonation('org-a')
    await endImpersonation()

    expect(h.state.rpc).toEqual([{ name: 'end_impersonation', args: { p_session_id: 'imp-1' } }])
    expect(h.state.setSession.at(-1)).toEqual(ADMIN_TOKENS)
    expect(getImpersonation()).toBeNull()
    expect(getSession()?.user.email).toBe('admin@biteflow.com')
  })

  it('surfaces a server refusal and stays on the actor session', async () => {
    await signInAsAdmin()
    h.state.invokeResult = { data: null, error: new Error('Not permitted') }

    await expect(startImpersonation('org-a')).rejects.toThrow(/not permitted/i)
    expect(getImpersonation()).toBeNull()
    expect(getSession()?.user.email).toBe('admin@biteflow.com')
  })

  it('will not start a second impersonation on top of an active one', async () => {
    await signInAsAdmin()
    await startImpersonation('org-a')

    await expect(startImpersonation('org-a')).rejects.toThrow(/already impersonating/i)
    expect(h.state.invoke).toHaveLength(1)
  })
})
