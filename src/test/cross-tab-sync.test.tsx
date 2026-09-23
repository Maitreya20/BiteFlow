/**
 * Cross-tab sync in demo mode.
 *
 * Demo state lives in localStorage, and before this suite existed each tab kept
 * its own in-memory copy: an order placed through the guest flow in one window
 * never appeared on the restaurant dashboard open in another — the exact
 * "orders don't update in real time" report. Browsers fire a `storage` event in
 * every *other* tab when localStorage changes, so the sync contract is:
 *
 *   write in tab A  →  `storage` event in tab B  →  tab B reloads state + emits
 *
 * jsdom does not deliver storage events across "tabs", so the test dispatches
 * the event a browser would fire and asserts the receiving side does its half.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSnapshot,
  placeOrder,
  signIn,
  signOut,
  subscribe,
} from '@/data/api'
import { buildSeedDatabase } from '@/data/seed'
import { DEMO_ACCOUNTS } from '@/lib/constants'

const DB_KEY = 'biteflow.demo-db.v3'

/** Simulate another tab having written to localStorage. */
function storageEvent(key: string, newValue: string | null): StorageEvent {
  // jsdom's StorageEvent needs init; React 18 + jsdom is happy with this shape.
  const event = new StorageEvent('storage', { key, newValue })
  Object.defineProperty(event, 'storageArea', { value: window.localStorage })
  return event
}

describe('demo mode cross-tab sync', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('an order written in one tab appears in another after the storage event', async () => {
    // Tab B is signed in and idle on the dashboard.
    await signIn(DEMO_ACCOUNTS[0].email, 'demo')

    const before = getSnapshot().db.orders.length

    // Tab A (guest window) places an order — it persists the dataset, which in
    // a browser fires `storage` in tab B.
    const order = await placeOrder({
      organizationId: getSnapshot().db.organizations[0].id,
      tableId: null,
      tableNumber: 'T-01',
      channel: 'dine_in',
      customerId: null,
      customerName: 'Cross-tab guest',
      items: [
        { menuItemId: 'item_x', name: 'Coffee', unitPrice: 200, quantity: 1, options: [], optionsTotal: 0, notes: '' },
      ],
      notes: '',
      allergyNote: '',
      kitchenNote: '',
      taxPercent: 5,
      serviceChargePercent: 0,
    })

    // Tab B receives the event a browser would fire.
    window.dispatchEvent(storageEvent(DB_KEY, window.localStorage.getItem(DB_KEY)))

    expect(getSnapshot().db.orders.length).toBe(before + 1)
    expect(getSnapshot().db.orders.some((o) => o.id === order.id)).toBe(true)
  })

  it('a dataset change also emits to React subscribers', async () => {
    await signIn(DEMO_ACCOUNTS[0].email, 'demo')

    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    await placeOrder({
      organizationId: getSnapshot().db.organizations[0].id,
      tableId: null,
      tableNumber: null,
      channel: 'takeaway',
      customerId: null,
      customerName: 'Emitter guest',
      items: [
        { menuItemId: 'item_x', name: 'Tea', unitPrice: 100, quantity: 1, options: [], optionsTotal: 0, notes: '' },
      ],
      notes: '',
      allergyNote: '',
      kitchenNote: '',
      taxPercent: 0,
      serviceChargePercent: 0,
    })
    listener.mockClear()

    window.dispatchEvent(storageEvent(DB_KEY, window.localStorage.getItem(DB_KEY)))

    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('a session written in another tab (role switch) is adopted too', async () => {
    await signIn(DEMO_ACCOUNTS[0].email, 'demo')
    expect(getSnapshot().session?.user.email).toBe(DEMO_ACCOUNTS[0].email)

    // Tab A switches the demo session (e.g. to the super admin account).
    await signOut()
    await signIn(DEMO_ACCOUNTS[1].email, 'demo')

    window.dispatchEvent(storageEvent('biteflow.session.v1', null))
    window.dispatchEvent(
      storageEvent('biteflow.session.v1', window.localStorage.getItem('biteflow.session.v1')),
    )

    expect(getSnapshot().session?.user.email).toBe(DEMO_ACCOUNTS[1].email)
  })

  it('a torn/unreadable dataset from another tab does not wipe the current copy', async () => {
    await signIn(DEMO_ACCOUNTS[0].email, 'demo')
    const before = getSnapshot().db.orders.length

    window.dispatchEvent(storageEvent(DB_KEY, '{not json'))

    expect(getSnapshot().db.orders.length).toBe(before)
    expect(getSnapshot().db.organizations.length).toBeGreaterThan(0)
  })

  it('ignores storage events for unrelated keys', async () => {
    await signIn(DEMO_ACCOUNTS[0].email, 'demo')
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)
    listener.mockClear()

    window.dispatchEvent(storageEvent('biteflow.cart.v1', '[]'))

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('seed sanity: a dataset instance round-trips through JSON unchanged', () => {
    // The sync path re-parses what another tab serialized. The seed bakes fresh
    // timestamps into every call, so two *calls* can never be equal — but one
    // instance must survive JSON.stringify → parse without losing anything
    // (Date, Map, undefined-in-array, …), or cross-tab copies would diverge.
    const instance = buildSeedDatabase()
    const roundTrip = JSON.parse(JSON.stringify(instance))
    expect(roundTrip).toEqual(instance)
  })
})
