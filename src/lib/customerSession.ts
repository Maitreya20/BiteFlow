/**
 * Guest-side session tracker.
 * The prototype lets a diner browse and order without an account, so we keep the
 * ids of orders placed on this device locally to power "your orders", tracking and
 * the bill screen (prd.md §12: no sign-in required).
 */
const KEY = 'biteflow.guest.orders.v1'

export interface GuestOrderRef {
  orderId: string
  orderNumber: string
  organizationId: string
  tableNumber: string | null
  placedAt: string
  total: number
}

function readAll(): GuestOrderRef[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as GuestOrderRef[]) : []
  } catch {
    return []
  }
}

function writeAll(refs: GuestOrderRef[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(refs.slice(0, 40)))
  } catch {
    /* ignore */
  }
}

export function rememberOrder(ref: GuestOrderRef) {
  const all = readAll().filter((r) => r.orderId !== ref.orderId)
  writeAll([ref, ...all])
}

export function getGuestOrders(organizationId?: string): GuestOrderRef[] {
  const all = readAll()
  return organizationId ? all.filter((r) => r.organizationId === organizationId) : all
}

export function getLatestGuestOrder(organizationId?: string): GuestOrderRef | null {
  return getGuestOrders(organizationId)[0] ?? null
}

export function forgetOrder(orderId: string) {
  writeAll(readAll().filter((r) => r.orderId !== orderId))
}
