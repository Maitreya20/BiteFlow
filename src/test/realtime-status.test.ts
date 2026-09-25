/**
 * @vitest-environment node
 *
 * The realtime status state machine.
 *
 * The header chip is only trustworthy if it actually tracks the socket. These
 * tests drive `subscribeRealtime` against a faked Supabase client and assert
 * the full lifecycle: connecting → live on SUBSCRIBED, degraded on
 * CHANNEL_ERROR/TIMED_OUT, and back to connecting on CLOSED (Supabase retries
 * automatically — the chip must not claim "live" while it is not).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    session: null as null | { access_token: string; refresh_token: string; user: { id: string; email: string } },
    rows: {} as Record<string, unknown[]>,
    statusCallback: null as null | ((status: string) => void),
    removed: [] as unknown[],
  }

  const queryBuilder = (table: string) => {
    const result = { data: state.rows[table] ?? [], error: null }
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'order', 'limit', 'eq', 'is', 'update', 'insert', 'delete', 'upsert']) {
      builder[method] = () => builder
    }
    builder.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected)
    return builder
  }

  const channel = {
    on: () => channel,
    subscribe: (callback?: (status: string) => void) => {
      state.statusCallback = callback ?? null
      return channel
    },
  }

  const client = {
    auth: {
      getSession: async () => ({ data: { session: state.session }, error: null }),
    },
    channel: (_name: string) => channel,
    removeChannel: async (ch: unknown) => {
      state.removed.push(ch)
      return { error: null }
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

import { getConnectionStatus, loadSession, subscribeRealtime } from '@/data/api'

const ROWS: Record<string, unknown[]> = {
  profiles: [],
  organizations: [],
  memberships: [],
}

beforeEach(() => {
  h.state.rows = { ...ROWS }
  h.state.session = {
    access_token: 't',
    refresh_token: 'r',
    user: { id: 'u1', email: 'o@x.test' },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('realtime connection status', () => {
  it('starts as connecting before the socket confirms', async () => {
    await loadSession()
    const unsubscribe = subscribeRealtime('org-a')
    expect(getConnectionStatus()).toBe('connecting')
    unsubscribe()
  })

  it('becomes live when the socket reports SUBSCRIBED', async () => {
    await loadSession()
    const unsubscribe = subscribeRealtime('org-a')
    h.state.statusCallback?.('SUBSCRIBED')
    expect(getConnectionStatus()).toBe('live')
    unsubscribe()
  })

  it('goes degraded on CHANNEL_ERROR and stays degraded until the socket says otherwise', async () => {
    await loadSession()
    const unsubscribe = subscribeRealtime('org-a')
    h.state.statusCallback?.('SUBSCRIBED')
    expect(getConnectionStatus()).toBe('live')

    h.state.statusCallback?.('CHANNEL_ERROR')
    expect(getConnectionStatus()).toBe('degraded')

    // No event between — status must not silently "heal" itself.
    expect(getConnectionStatus()).toBe('degraded')
    unsubscribe()
  })

  it('goes degraded on TIMED_OUT too', async () => {
    await loadSession()
    const unsubscribe = subscribeRealtime('org-a')
    h.state.statusCallback?.('TIMED_OUT')
    expect(getConnectionStatus()).toBe('degraded')
    unsubscribe()
  })

  it('returns to connecting (not live) on CLOSED while Supabase retries', async () => {
    await loadSession()
    const unsubscribe = subscribeRealtime('org-a')
    h.state.statusCallback?.('SUBSCRIBED')
    expect(getConnectionStatus()).toBe('live')

    h.state.statusCallback?.('CLOSED')
    expect(getConnectionStatus()).toBe('connecting')
    unsubscribe()
  })

  it('reports demo in demo mode without touching the socket', async () => {
    vi.resetModules()
    vi.doMock('@/lib/supabase', () => ({
      isSupabaseConfigured: false,
      supabase: null,
      requireSupabase: () => {
        throw new Error('no backend in demo mode')
      },
      siteOrigin: () => 'http://localhost:5173',
      connectionState: 'demo',
    }))
    const api = await import('@/data/api')
    expect(api.getConnectionStatus()).toBe('demo')
    // subscribeRealtime in demo mode is a no-op and must not change the state.
    const off = api.subscribeRealtime('org-a')
    expect(api.getConnectionStatus()).toBe('demo')
    off()
    vi.doUnmock('@/lib/supabase')
  })
})
