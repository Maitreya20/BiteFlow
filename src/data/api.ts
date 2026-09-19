/**
 * BiteFlow data access layer.
 *
 * One API surface, two backends:
 *   • demo  → the bundled seed dataset (persisted to localStorage), with an
 *     in-process pub/sub standing in for realtime.
 *   • live  → Supabase Postgres + Auth + Realtime, with RLS enforcing tenant
 *     isolation (prd.md §26).
 *
 * Screens only ever import from this module, so switching backends is a .env change.
 */
import type {
  AppNotification,
  AuditLog,
  Branding,
  Customer,
  DemoDatabase,
  InventoryItem,
  Invoice,
  MenuCategory,
  MenuItem,
  Membership,
  Order,
  OrderItem,
  OrderStatus,
  Organization,
  PaymentMethod,
  PlanId,
  Profile,
  Reservation,
  RestaurantTable,
  Role,
  ServiceRequest,
  ServiceRequestStatus,
  TableStatus,
} from '@/lib/types'
import { buildSeedDatabase, DEMO_OWNER_ID } from './seed'
import { isSupabaseConfigured, supabase, requireSupabase } from '@/lib/supabase'
import { uid } from '@/lib/format'

export const MODE: 'live' | 'demo' = isSupabaseConfigured ? 'live' : 'demo'

/* ------------------------------------------------------------------ session */

export interface SessionUser {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
}

export interface AuthSession {
  user: SessionUser
  memberships: { organizationId: string; role: Role }[]
  activeOrganizationId: string
}

const SESSION_KEY = 'biteflow.session.v1'
const DB_KEY = 'biteflow.demo-db.v3'

/* --------------------------------------------------------------- internal state */

let db: DemoDatabase = loadDemoDb()
let session: AuthSession | null = readStoredSession()
const listeners = new Set<() => void>()
/** Demo-mode latency so loading skeletons are exercised realistically. */
const LATENCY = 0

function loadDemoDb(): DemoDatabase {
  if (typeof localStorage === 'undefined') return buildSeedDatabase()
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as DemoDatabase
  } catch {
    /* corrupt cache — fall through to a fresh seed */
  }
  const seeded = buildSeedDatabase()
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(seeded))
  } catch {
    /* storage may be unavailable (private mode) */
  }
  return seeded
}

function readStoredSession(): AuthSession | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

function persist() {
  if (typeof localStorage === 'undefined') return
  try {
    if (MODE === 'demo') localStorage.setItem(DB_KEY, JSON.stringify(db))
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore quota errors in the prototype */
  }
}

function emit() {
  // Bump the dataset reference so `useSyncExternalStore` sees a new snapshot even
  // though every mutation above worked in place.
  db = { ...db }
  persist()
  listeners.forEach((l) => l())
}

/** Subscribe to dataset/session changes (realtime stand-in for demo mode). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let cachedSnapshot: { db: DemoDatabase; session: AuthSession | null } = { db, session }

/** Stable snapshot — only a new reference when the dataset or session changed. */
export function getSnapshot(): { db: DemoDatabase; session: AuthSession | null } {
  if (cachedSnapshot.db !== db || cachedSnapshot.session !== session) {
    cachedSnapshot = { db, session }
  }
  return cachedSnapshot
}

function sleep(ms: number) {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve()
}

/* ------------------------------------------------------------------- helpers */

export function activeOrg(): Organization | null {
  if (!session) return null
  return db.organizations.find((o) => o.id === session!.activeOrganizationId) ?? null
}

export function activeRole(): Role {
  if (!session) return 'customer'
  const membership = db.memberships.find(
    (m) => m.organizationId === session!.activeOrganizationId && m.userId === session!.user.id,
  )
  if (membership) return membership.role
  // Super admins can enter any tenant.
  const platformAdmin = db.memberships.find(
    (m) => m.userId === session!.user.id && m.role === 'super_admin',
  )
  return platformAdmin ? 'super_admin' : 'owner'
}

function recomputeTableState(organizationId: string) {
  const liveStatuses: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'served']
  const orgTables = db.tables.filter((t) => t.organizationId === organizationId)
  orgTables.forEach((t) => {
    const live = db.orders.find(
      (o) => o.tableId === t.id && liveStatuses.includes(o.status),
    )
    if (live) {
      t.status = 'occupied'
      t.currentBill = live.total
      t.occupiedSince = t.occupiedSince ?? live.placedAt
    } else if (t.status === 'occupied') {
      t.status = 'cleaning'
      t.currentBill = 0
      t.occupiedSince = null
      t.assignedWaiterId = null
      t.assignedWaiterName = null
    }
  })
}

function logAudit(entry: Omit<AuditLog, 'id' | 'createdAt' | 'ipAddress'>) {
  db.auditLogs.unshift({
    ...entry,
    id: uid('aud'),
    createdAt: new Date().toISOString(),
    ipAddress: '49.36.10.100',
  })
  db.auditLogs = db.auditLogs.slice(0, 400)
}

function notify(entry: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
  db.notifications.unshift({
    ...entry,
    id: uid('ntf'),
    read: false,
    createdAt: new Date().toISOString(),
  })
  db.notifications = db.notifications.slice(0, 120)
}

/* ============================================================================
   LIVE MODE — Supabase queries
   ========================================================================= */

async function liveLoadAll(): Promise<DemoDatabase> {
  const sb = requireSupabase()
  const [
    profiles,
    organizations,
    memberships,
    categories,
    menuItems,
    tables,
    orders,
    orderItems,
    serviceRequests,
    reservations,
    inventory,
    customers,
    invoices,
    paymentMethods,
    auditLogs,
    notifications,
  ] = await Promise.all([
    sb.from('profiles').select('*'),
    sb.from('organizations').select('*'),
    sb.from('memberships').select('*'),
    sb.from('menu_categories').select('*'),
    sb.from('menu_items').select('*'),
    sb.from('restaurant_tables').select('*'),
    sb.from('orders').select('*').order('placed_at', { ascending: false }).limit(500),
    sb.from('order_items').select('*'),
    sb.from('service_requests').select('*').order('created_at', { ascending: false }).limit(200),
    sb.from('reservations').select('*').order('date', { ascending: true }).limit(200),
    sb.from('inventory_items').select('*'),
    sb.from('customers').select('*'),
    sb.from('invoices').select('*').order('issued_at', { ascending: false }),
    sb.from('payment_methods').select('*'),
    sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(400),
    sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(120),
  ])

  const first = (r: { error: unknown } | null) => {
    if (r && 'error' in r && r.error) throw r.error
  }
  ;[profiles, organizations, memberships].forEach(first)

  const itemsByOrder = new Map<string, OrderItem[]>()
  ;((orderItems.data ?? []) as Record<string, unknown>[]).forEach((row) => {
    const orderId = row.order_id as string
    const list = itemsByOrder.get(orderId) ?? []
    list.push(mapOrderItem(row))
    itemsByOrder.set(orderId, list)
  })

  return {
    profiles: ((profiles.data ?? []) as Record<string, unknown>[]).map(mapProfile),
    organizations: ((organizations.data ?? []) as Record<string, unknown>[]).map(mapOrganization),
    memberships: ((memberships.data ?? []) as Record<string, unknown>[]).map(mapMembership),
    categories: ((categories.data ?? []) as Record<string, unknown>[]).map(mapCategory),
    menuItems: ((menuItems.data ?? []) as Record<string, unknown>[]).map(mapMenuItem),
    tables: ((tables.data ?? []) as Record<string, unknown>[]).map(mapTable),
    orders: ((orders.data ?? []) as Record<string, unknown>[]).map((row) =>
      mapOrder(row, itemsByOrder.get(row.id as string) ?? []),
    ),
    serviceRequests: ((serviceRequests.data ?? []) as Record<string, unknown>[]).map(mapServiceRequest),
    reservations: ((reservations.data ?? []) as Record<string, unknown>[]).map(mapReservation),
    inventory: ((inventory.data ?? []) as Record<string, unknown>[]).map(mapInventory),
    customers: ((customers.data ?? []) as Record<string, unknown>[]).map(mapCustomer),
    invoices: ((invoices.data ?? []) as Record<string, unknown>[]).map(mapInvoice),
    paymentMethods: ((paymentMethods.data ?? []) as Record<string, unknown>[]).map(mapPaymentMethod),
    auditLogs: ((auditLogs.data ?? []) as Record<string, unknown>[]).map(mapAuditLog),
    notifications: ((notifications.data ?? []) as Record<string, unknown>[]).map(mapNotification),
  }
}

/* ---------------------------------------------------------- row → domain maps */

const s = (v: unknown, fallback = ''): string => (v == null ? fallback : String(v))
const n = (v: unknown, fallback = 0): number => (v == null ? fallback : Number(v))
const b = (v: unknown, fallback = false): boolean => (v == null ? fallback : Boolean(v))
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const json = <T,>(v: unknown): T => (v ?? {}) as T

export const mapProfile = (r: Record<string, unknown>): Profile => ({
  id: s(r.id),
  email: s(r.email),
  fullName: s(r.full_name),
  avatarUrl: (r.avatar_url as string) ?? null,
  phone: (r.phone as string) ?? null,
  createdAt: s(r.created_at),
})

export const mapOrganization = (r: Record<string, unknown>): Organization => ({
  id: s(r.id),
  name: s(r.name),
  slug: s(r.slug),
  businessType: s(r.business_type, 'restaurant') as Organization['businessType'],
  gstNumber: s(r.gst_number),
  timezone: s(r.timezone, 'Asia/Kolkata'),
  currency: s(r.currency, 'INR'),
  language: s(r.language, 'en-IN'),
  planId: s(r.plan_id, 'starter') as PlanId,
  subscriptionStatus: s(r.subscription_status, 'active') as Organization['subscriptionStatus'],
  trialEndsAt: (r.trial_ends_at as string) ?? null,
  renewsAt: (r.renews_at as string) ?? null,
  createdAt: s(r.created_at),
  seededDemo: b(r.seeded_demo),
  branding: json<Branding>(r.branding),
})

export const mapMembership = (r: Record<string, unknown>): Membership => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  userId: s(r.user_id),
  role: s(r.role, 'waiter') as Role,
  status: s(r.status, 'active') as Membership['status'],
  shift: s(r.shift),
  invitedAt: s(r.invited_at),
  lastActiveAt: (r.last_active_at as string) ?? null,
})

export const mapCategory = (r: Record<string, unknown>): MenuCategory => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  name: s(r.name),
  description: s(r.description),
  icon: s(r.icon, 'restaurant_menu'),
  sortOrder: n(r.sort_order),
  isActive: b(r.is_active, true),
})

export const mapMenuItem = (r: Record<string, unknown>): MenuItem => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  categoryId: s(r.category_id),
  name: s(r.name),
  description: s(r.description),
  price: n(r.price),
  imageUrl: (r.image_url as string) ?? null,
  prepTimeMinutes: n(r.prep_time_minutes, 10),
  calories: n(r.calories),
  available: b(r.available, true),
  isChefPick: b(r.is_chef_pick),
  isTrending: b(r.is_trending),
  isVegetarian: b(r.is_vegetarian),
  isSpicy: b(r.is_spicy),
  allergens: arr<string>(r.allergens),
  tags: arr<string>(r.tags),
  optionGroups: arr<MenuItem['optionGroups'][number]>(r.option_groups),
  sortOrder: n(r.sort_order),
})

export const mapTable = (r: Record<string, unknown>): RestaurantTable => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  branchId: s(r.branch_id, 'main'),
  tableNumber: s(r.table_number),
  capacity: n(r.capacity, 4),
  status: s(r.status, 'available') as TableStatus,
  assignedWaiterId: (r.assigned_waiter_id as string) ?? null,
  assignedWaiterName: (r.assigned_waiter_name as string) ?? null,
  currentBill: n(r.current_bill),
  occupiedSince: (r.occupied_since as string) ?? null,
  qrToken: s(r.qr_token),
  zone: s(r.zone, 'Indoor') as RestaurantTable['zone'],
  posX: n(r.pos_x),
  posY: n(r.pos_y),
})

export const mapOrderItem = (r: Record<string, unknown>): OrderItem => ({
  id: s(r.id),
  orderId: s(r.order_id),
  menuItemId: s(r.menu_item_id),
  name: s(r.name),
  unitPrice: n(r.unit_price),
  quantity: n(r.quantity, 1),
  options: arr<string>(r.options),
  optionsTotal: n(r.options_total),
  notes: s(r.notes),
  lineTotal: n(r.line_total),
})

export const mapOrder = (r: Record<string, unknown>, items: OrderItem[] = []): Order => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  orderNumber: s(r.order_number),
  channel: s(r.channel, 'dine_in') as Order['channel'],
  tableId: (r.table_id as string) ?? null,
  tableNumber: (r.table_number as string) ?? null,
  customerId: (r.customer_id as string) ?? null,
  customerName: (r.customer_name as string) ?? null,
  status: s(r.status, 'pending') as OrderStatus,
  items,
  subtotal: n(r.subtotal),
  taxAmount: n(r.tax_amount),
  serviceCharge: n(r.service_charge),
  discount: n(r.discount),
  total: n(r.total),
  notes: s(r.notes),
  allergyNote: s(r.allergy_note),
  kitchenNote: s(r.kitchen_note),
  paymentStatus: s(r.payment_status, 'unpaid') as Order['paymentStatus'],
  paymentMethod: (r.payment_method as Order['paymentMethod']) ?? null,
  placedAt: s(r.placed_at),
  acceptedAt: (r.accepted_at as string) ?? null,
  preparingAt: (r.preparing_at as string) ?? null,
  readyAt: (r.ready_at as string) ?? null,
  servedAt: (r.served_at as string) ?? null,
  completedAt: (r.completed_at as string) ?? null,
  cancelledAt: (r.cancelled_at as string) ?? null,
  cancelledReason: (r.cancelled_reason as string) ?? null,
})

export const mapServiceRequest = (r: Record<string, unknown>): ServiceRequest => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  tableId: s(r.table_id),
  tableNumber: s(r.table_number),
  type: s(r.type, 'call_waiter') as ServiceRequest['type'],
  status: s(r.status, 'pending') as ServiceRequest['status'],
  note: s(r.note),
  assignedToName: (r.assigned_to_name as string) ?? null,
  createdAt: s(r.created_at),
  resolvedAt: (r.resolved_at as string) ?? null,
})

export const mapReservation = (r: Record<string, unknown>): Reservation => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  customerName: s(r.customer_name),
  phone: s(r.phone),
  email: s(r.email),
  date: s(r.date),
  time: s(r.time),
  guests: n(r.guests, 2),
  tableId: (r.table_id as string) ?? null,
  tableNumber: (r.table_number as string) ?? null,
  status: s(r.status, 'pending') as Reservation['status'],
  specialRequest: s(r.special_request),
  createdAt: s(r.created_at),
})

export const mapInventory = (r: Record<string, unknown>): InventoryItem => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  ingredient: s(r.ingredient),
  category: s(r.category),
  currentStock: n(r.current_stock),
  unit: s(r.unit, 'pcs') as InventoryItem['unit'],
  lowStockThreshold: n(r.low_stock_threshold),
  unitCost: n(r.unit_cost),
  supplier: s(r.supplier),
  expiryDate: (r.expiry_date as string) ?? null,
  lastRestockedAt: s(r.last_restocked_at),
})

export const mapCustomer = (r: Record<string, unknown>): Customer => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  name: s(r.name),
  phone: s(r.phone),
  email: s(r.email),
  totalOrders: n(r.total_orders),
  totalSpend: n(r.total_spend),
  loyaltyPoints: n(r.loyalty_points),
  tier: s(r.tier, 'bronze') as Customer['tier'],
  visitCount: n(r.visit_count),
  lastVisitAt: (r.last_visit_at as string) ?? null,
  preferences: arr<string>(r.preferences),
  notes: s(r.notes),
  marketingConsent: b(r.marketing_consent),
  createdAt: s(r.created_at),
})

export const mapInvoice = (r: Record<string, unknown>): Invoice => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  invoiceNumber: s(r.invoice_number),
  issuedAt: s(r.issued_at),
  amount: n(r.amount),
  status: s(r.status, 'paid') as Invoice['status'],
  planId: s(r.plan_id, 'growth') as PlanId,
  periodLabel: s(r.period_label),
})

export const mapPaymentMethod = (r: Record<string, unknown>): PaymentMethod => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  brand: s(r.brand, 'visa') as PaymentMethod['brand'],
  last4: s(r.last4),
  expiry: s(r.expiry),
  isDefault: b(r.is_default, true),
})

export const mapAuditLog = (r: Record<string, unknown>): AuditLog => ({
  id: s(r.id),
  organizationId: (r.organization_id as string) ?? null,
  actorId: (r.actor_id as string) ?? null,
  actorName: s(r.actor_name),
  actorRole: s(r.actor_role, 'owner') as Role,
  action: s(r.action),
  entityType: s(r.entity_type),
  entityId: (r.entity_id as string) ?? null,
  summary: s(r.summary),
  ipAddress: s(r.ip_address, '—'),
  createdAt: s(r.created_at),
})

export const mapNotification = (r: Record<string, unknown>): AppNotification => ({
  id: s(r.id),
  organizationId: s(r.organization_id),
  kind: s(r.kind, 'system') as AppNotification['kind'],
  title: s(r.title),
  body: s(r.body),
  read: b(r.read),
  createdAt: s(r.created_at),
  href: (r.href as string) ?? null,
})

/* ============================================================================
   Auth
   ========================================================================= */

export async function signIn(email: string, password: string): Promise<AuthSession> {
  if (MODE === 'live') {
    const sb = requireSupabase()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    const live = await liveLoadAll()
    db = live
    const profile = db.profiles.find((p) => p.id === data.user!.id)
    const ms = db.memberships.filter((m) => m.userId === data.user!.id)
    session = {
      user: {
        id: data.user!.id,
        email: data.user!.email ?? email,
        fullName: profile?.fullName ?? email.split('@')[0],
        avatarUrl: profile?.avatarUrl ?? null,
      },
      memberships: ms.map((m) => ({ organizationId: m.organizationId, role: m.role })),
      activeOrganizationId: ms[0]?.organizationId ?? db.organizations[0]?.id ?? '',
    }
  } else {
    // Demo mode: any password works; resolve the account by email.
    const profile =
      db.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) ??
      db.profiles.find((p) => p.id === DEMO_OWNER_ID)!
    const ms = db.memberships.filter((m) => m.userId === profile.id)
    const memberships = ms.length
      ? ms
      : db.organizations.map((o, i) => ({
          id: `mem_demo_${i}`,
          organizationId: o.id,
          userId: profile.id,
          role: (i === 0 ? 'owner' : 'manager') as Role,
          status: 'active' as const,
          shift: 'Full day',
          invitedAt: o.createdAt,
          lastActiveAt: new Date().toISOString(),
        }))
    session = {
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
      },
      memberships: memberships.map((m) => ({ organizationId: m.organizationId, role: m.role })),
      activeOrganizationId: memberships[0]?.organizationId ?? db.organizations[0].id,
    }
  }
  persist()
  emit()
  return session
}

export async function signUp(input: {
  fullName: string
  email: string
  password: string
}): Promise<AuthSession> {
  if (MODE === 'live') {
    const sb = requireSupabase()
    const { data, error } = await sb.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { full_name: input.fullName } },
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Check your inbox to confirm your email, then sign in.')
    session = {
      user: {
        id: data.user.id,
        email: input.email,
        fullName: input.fullName,
        avatarUrl: null,
      },
      memberships: [],
      activeOrganizationId: '',
    }
    persist()
    emit()
    return session
  }

  const profile: Profile = {
    id: uid('user'),
    email: input.email,
    fullName: input.fullName,
    avatarUrl: null,
    phone: null,
    createdAt: new Date().toISOString(),
  }
  db.profiles.push(profile)
  session = {
    user: { id: profile.id, email: profile.email, fullName: profile.fullName, avatarUrl: null },
    memberships: [],
    activeOrganizationId: '',
  }
  persist()
  emit()
  return session
}

export async function signOut(): Promise<void> {
  if (MODE === 'live') await supabase?.auth.signOut()
  session = null
  persist()
  emit()
}

export async function loadSession(): Promise<AuthSession | null> {
  if (MODE === 'live') {
    const { data } = await requireSupabase().auth.getSession()
    if (!data.session) {
      session = null
      return null
    }
    db = await liveLoadAll()
    const profile = db.profiles.find((p) => p.id === data.session!.user.id)
    const ms = db.memberships.filter((m) => m.userId === data.session!.user.id)
    session = {
      user: {
        id: data.session.user.id,
        email: data.session.user.email ?? '',
        fullName: profile?.fullName ?? 'Operator',
        avatarUrl: profile?.avatarUrl ?? null,
      },
      memberships: ms.map((m) => ({ organizationId: m.organizationId, role: m.role })),
      activeOrganizationId: ms[0]?.organizationId ?? db.organizations[0]?.id ?? '',
    }
  }
  return session
}

export function getSession(): AuthSession | null {
  return session
}

export function switchOrganization(organizationId: string) {
  if (!session) return
  session = { ...session, activeOrganizationId: organizationId }
  emit()
}

/* ============================================================================
   Onboarding — create a tenant from the wizard (prd.md §8, §32)
   ========================================================================= */

export async function createOrganization(input: {
  name: string
  slug: string
  businessType: Organization['businessType']
  gstNumber: string
  currency: string
  language: string
  timezone: string
  address: string
  phone: string
  planId: PlanId
  branding: Branding
}): Promise<Organization> {
  const now = new Date().toISOString()
  const org: Organization = {
    id: uid('org'),
    name: input.name,
    slug: input.slug,
    businessType: input.businessType,
    gstNumber: input.gstNumber,
    timezone: input.timezone,
    currency: input.currency,
    language: input.language,
    planId: input.planId,
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    renewsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    seededDemo: false,
    branding: {
      ...input.branding,
      address: input.address,
      phone: input.phone,
      currency: input.currency,
    },
  }

  if (MODE === 'live') {
    const sb = requireSupabase()
    const { data, error } = await sb
      .from('organizations')
      .insert({
        name: org.name,
        slug: org.slug,
        business_type: org.businessType,
        gst_number: org.gstNumber,
        currency: org.currency,
        language: org.language,
        timezone: org.timezone,
        plan_id: org.planId,
        subscription_status: org.subscriptionStatus,
        trial_ends_at: org.trialEndsAt,
        renews_at: org.renewsAt,
        branding: org.branding,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    const created = mapOrganization(data as Record<string, unknown>)
    org.id = created.id
    // Seed the order number counter for this new tenant so the first order
    // starts at BF-1200. The counter row is created by next_order_number()
    // on the first call, but seeding it here makes the intent explicit.
    if (MODE === 'live') {
      try {
        await sb.from('order_number_counters').upsert({
          organization_id: org.id,
          last_number: 1199,
        })
      } catch (_e) {
        // ignore — counter row may already exist
      }
    }
    if (session) {
      await sb
        .from('memberships')
        .insert({ organization_id: org.id, user_id: session.user.id, role: 'owner', status: 'active' })
    }
  }

  db.organizations.push(org)
  if (session) {
    db.memberships.push({
      id: uid('mem'),
      organizationId: org.id,
      userId: session.user.id,
      role: 'owner',
      status: 'active',
      shift: 'Full day',
      invitedAt: now,
      lastActiveAt: now,
    })
    session = {
      ...session,
      memberships: [...session.memberships, { organizationId: org.id, role: 'owner' }],
      activeOrganizationId: org.id,
    }
  }
  logAudit({
    organizationId: org.id,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: 'owner',
    action: 'tenant.created',
    entityType: 'organization',
    entityId: org.id,
    summary: `Restaurant "${org.name}" created on the ${org.planId} plan`,
  })
  notify({
    organizationId: org.id,
    kind: 'system',
    title: 'Welcome to BiteFlow',
    body: `${org.name} is on a 14-day ${org.planId} trial. Finish setup to go live.`,
    href: '/app/dashboard',
  })
  emit()
  return org
}

/* ============================================================================
   Menu
   ========================================================================= */

export async function upsertMenuItem(item: MenuItem): Promise<MenuItem> {
  const idx = db.menuItems.findIndex((m) => m.id === item.id)
  if (idx >= 0) db.menuItems[idx] = item
  else db.menuItems.push(item)

  if (MODE === 'live') {
    const sb = requireSupabase()
    const { error } = await sb.from('menu_items').upsert({
      id: item.id,
      organization_id: item.organizationId,
      category_id: item.categoryId,
      name: item.name,
      description: item.description,
      price: item.price,
      image_url: item.imageUrl,
      prep_time_minutes: item.prepTimeMinutes,
      calories: item.calories,
      available: item.available,
      is_chef_pick: item.isChefPick,
      is_trending: item.isTrending,
      is_vegetarian: item.isVegetarian,
      is_spicy: item.isSpicy,
      allergens: item.allergens,
      tags: item.tags,
      option_groups: item.optionGroups,
      sort_order: item.sortOrder,
    })
    if (error) throw new Error(error.message)
  }

  logAudit({
    organizationId: item.organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: idx >= 0 ? 'menu.item_updated' : 'menu.item_created',
    entityType: 'menu_item',
    entityId: item.id,
    summary: `${idx >= 0 ? 'Updated' : 'Created'} menu item "${item.name}"`,
  })
  emit()
  return item
}

export async function deleteMenuItem(organizationId: string, itemId: string): Promise<void> {
  db.menuItems = db.menuItems.filter((m) => m.id !== itemId)
  if (MODE === 'live') await requireSupabase().from('menu_items').delete().eq('id', itemId)
  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'menu.item_deleted',
    entityType: 'menu_item',
    entityId: itemId,
    summary: 'Archived a menu item',
  })
  emit()
}

export async function upsertCategory(category: MenuCategory): Promise<MenuCategory> {
  const idx = db.categories.findIndex((c) => c.id === category.id)
  if (idx >= 0) db.categories[idx] = category
  else db.categories.push(category)
  if (MODE === 'live') {
    const { error } = await requireSupabase().from('menu_categories').upsert({
      id: category.id,
      organization_id: category.organizationId,
      name: category.name,
      description: category.description,
      icon: category.icon,
      sort_order: category.sortOrder,
      is_active: category.isActive,
    })
    if (error) throw new Error(error.message)
  }
  emit()
  return category
}

export async function deleteCategory(organizationId: string, categoryId: string): Promise<void> {
  db.categories = db.categories.filter((c) => c.id !== categoryId)
  db.menuItems = db.menuItems.filter((m) => m.categoryId !== categoryId)
  if (MODE === 'live') await requireSupabase().from('menu_categories').delete().eq('id', categoryId)
  emit()
}

export async function importMenu(
  organizationId: string,
  payload: { categories: string[]; items: { name: string; price: number; category: string }[] },
): Promise<number> {
  const existing = db.categories.filter((c) => c.organizationId === organizationId)
  const allNames = [...new Set([...payload.categories, ...payload.items.map((i) => i.category)])]
  const categoryMap = new Map<string, MenuCategory>()

  allNames.forEach((name, i) => {
    const found =
      existing.find((c) => c.name.toLowerCase() === name.toLowerCase()) ??
      ({
        id: uid('cat'),
        organizationId,
        name,
        description: '',
        icon: 'restaurant_menu',
        sortOrder: existing.length + i,
        isActive: true,
      } satisfies MenuCategory)
    if (!existing.includes(found)) db.categories.push(found)
    categoryMap.set(name, found)
  })

  payload.items.forEach((row, i) => {
    const category = categoryMap.get(row.category) ?? [...categoryMap.values()][0]
    db.menuItems.push({
      id: uid('item'),
      organizationId,
      categoryId: category?.id ?? '',
      name: row.name,
      description: '',
      price: row.price,
      imageUrl: null,
      prepTimeMinutes: 10,
      calories: 0,
      available: true,
      isChefPick: false,
      isTrending: false,
      isVegetarian: false,
      isSpicy: false,
      allergens: [],
      tags: ['Imported'],
      optionGroups: [],
      sortOrder: i,
    })
  })

  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'menu.imported',
    entityType: 'menu_item',
    entityId: null,
    summary: `Imported ${payload.items.length} items across ${categoryMap.size} categories`,
  })
  emit()
  return payload.items.length
}

/* ============================================================================
   Tables
   ========================================================================= */

export async function upsertTable(table: RestaurantTable): Promise<RestaurantTable> {
  const idx = db.tables.findIndex((t) => t.id === table.id)
  if (idx >= 0) db.tables[idx] = table
  else db.tables.push(table)
  if (MODE === 'live') {
    const { error } = await requireSupabase().from('restaurant_tables').upsert({
      id: table.id,
      organization_id: table.organizationId,
      branch_id: table.branchId,
      table_number: table.tableNumber,
      capacity: table.capacity,
      status: table.status,
      assigned_waiter_id: table.assignedWaiterId,
      assigned_waiter_name: table.assignedWaiterName,
      current_bill: table.currentBill,
      occupied_since: table.occupiedSince,
      qr_token: table.qrToken,
      zone: table.zone,
      pos_x: table.posX,
      pos_y: table.posY,
    })
    if (error) throw new Error(error.message)
  }
  emit()
  return table
}

export async function updateTableStatus(
  organizationId: string,
  tableId: string,
  status: TableStatus,
): Promise<void> {
  const table = db.tables.find((t) => t.id === tableId)
  if (!table) return
  table.status = status
  if (status === 'available' || status === 'cleaning') {
    table.currentBill = 0
    table.occupiedSince = null
    table.assignedWaiterId = null
    table.assignedWaiterName = null
  }
  if (MODE === 'live') {
    await requireSupabase()
      .from('restaurant_tables')
      .update({
        status,
        current_bill: table.currentBill,
        occupied_since: table.occupiedSince,
        assigned_waiter_id: table.assignedWaiterId,
      })
      .eq('id', tableId)
  }
  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'table.status_changed',
    entityType: 'table',
    entityId: tableId,
    summary: `${table.tableNumber} set to ${status}`,
  })
  emit()
}

export async function assignWaiter(
  organizationId: string,
  tableId: string,
  waiterId: string | null,
  waiterName: string | null,
): Promise<void> {
  const table = db.tables.find((t) => t.id === tableId)
  if (!table) return
  table.assignedWaiterId = waiterId
  table.assignedWaiterName = waiterName
  if (MODE === 'live') {
    await requireSupabase()
      .from('restaurant_tables')
      .update({ assigned_waiter_id: waiterId, assigned_waiter_name: waiterName })
      .eq('id', tableId)
  }
  emit()
}

export async function regenerateQr(organizationId: string, tableId: string): Promise<string> {
  const table = db.tables.find((t) => t.id === tableId)
  if (!table) return ''
  table.qrToken = `${table.tableNumber.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`
  if (MODE === 'live') {
    await requireSupabase().from('restaurant_tables').update({ qr_token: table.qrToken }).eq('id', tableId)
  }
  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'table.qr_regenerated',
    entityType: 'table',
    entityId: tableId,
    summary: `Regenerated QR for ${table.tableNumber}`,
  })
  emit()
  return table.qrToken
}

/* ============================================================================
   Orders
   ========================================================================= */

export interface PlaceOrderInput {
  organizationId: string
  tableId: string | null
  tableNumber: string | null
  channel: Order['channel']
  customerId: string | null
  customerName: string | null
  items: { menuItemId: string; name: string; unitPrice: number; quantity: number; options: string[]; optionsTotal: number; notes: string }[]
  notes: string
  allergyNote: string
  kitchenNote: string
  taxPercent: number
  serviceChargePercent: number
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  const org = db.organizations.find((o) => o.id === input.organizationId)
  const orderId = uid('ord')

  const items: OrderItem[] = input.items.map((line, i) => ({
    id: `${orderId}_${i}`,
    orderId,
    menuItemId: line.menuItemId,
    name: line.name,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    options: line.options,
    optionsTotal: line.optionsTotal,
    notes: line.notes,
    lineTotal: (line.unitPrice + line.optionsTotal) * line.quantity,
  }))

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const taxAmount = Math.round((subtotal * input.taxPercent) / 100)
  const serviceCharge = Math.round((subtotal * input.serviceChargePercent) / 100)

  // The database now fills in order_number automatically via a BEFORE INSERT
  // trigger (allocate_order_number()). In live mode we pass a placeholder and
  // read the real number back from the INSERT response.
  // In demo mode we still compute one client-side.
  let orderNumber: string
  if (MODE === 'live') {
    orderNumber = ''  // trigger will fill it in
  } else {
    const count = db.orders.filter((o) => o.organizationId === input.organizationId).length
    orderNumber = `BF-${1200 + count}`
  }

  const order: Order = {
    id: orderId,
    organizationId: input.organizationId,
    orderNumber,
    channel: input.channel,
    tableId: input.tableId,
    tableNumber: input.tableNumber,
    customerId: input.customerId,
    customerName: input.customerName,
    status: 'pending',
    items,
    subtotal,
    taxAmount,
    serviceCharge,
    discount: 0,
    total: subtotal + taxAmount + serviceCharge,
    notes: input.notes,
    allergyNote: input.allergyNote,
    kitchenNote: input.kitchenNote,
    paymentStatus: 'unpaid',
    paymentMethod: null,
    placedAt: new Date().toISOString(),
    acceptedAt: null,
    preparingAt: null,
    readyAt: null,
    servedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
  }

  // In live mode we commit to Postgres first; only when that succeeds do we
  // apply the order to the in-memory/demo store. If the remote write fails we
  // throw before touching local state, so the two backends never drift apart.
  if (MODE === 'live') {
    const sb = requireSupabase()
    const { data: inserted, error } = await sb
      .from('orders')
      .insert({
        id: order.id,
        organization_id: order.organizationId,
        order_number: order.orderNumber,
        channel: order.channel,
        table_id: order.tableId,
        table_number: order.tableNumber,
        customer_id: order.customerId,
        customer_name: order.customerName,
        status: order.status,
        subtotal: order.subtotal,
        tax_amount: order.taxAmount,
        service_charge: order.serviceCharge,
        discount: order.discount,
        total: order.total,
        notes: order.notes,
        allergy_note: order.allergyNote,
        kitchen_note: order.kitchenNote,
        payment_status: order.paymentStatus,
        placed_at: order.placedAt,
      })
      .select('order_number')
      .single()
    if (error) throw new Error(error.message)
    // The BEFORE INSERT trigger may have overwritten order_number with the
    // DB-allocated BF number — read it back so the local order matches.
    order.orderNumber = (inserted as Record<string, unknown>).order_number as string

    const { error: itemsError } = await sb.from('order_items').insert(
      items.map((i) => ({
        id: i.id,
        order_id: i.orderId,
        menu_item_id: i.menuItemId,
        name: i.name,
        unit_price: i.unitPrice,
        quantity: i.quantity,
        options: i.options,
        options_total: i.optionsTotal,
        notes: i.notes,
        line_total: i.lineTotal,
      })),
    )
    if (itemsError) throw new Error(itemsError.message)
  }

  db.orders.unshift(order)
  recomputeTableState(order.organizationId)

  notify({
    organizationId: order.organizationId,
    kind: 'order',
    title: `New order ${order.orderNumber}${order.tableNumber ? ` · ${order.tableNumber}` : ''}`,
    body: `${items.length} item${items.length === 1 ? '' : 's'} · ${org?.currency === 'INR' ? '₹' : ''}${order.total.toLocaleString('en-IN')}`,
    href: '/app/orders',
  })
  logAudit({
    organizationId: order.organizationId,
    actorId: session?.user.id ?? null,
    actorName: order.customerName ?? session?.user.fullName ?? 'Guest',
    actorRole: 'customer',
    action: 'order.created',
    entityType: 'order',
    entityId: order.id,
    summary: `Order ${order.orderNumber} placed${order.tableNumber ? ` from ${order.tableNumber}` : ''}`,
  })
  emit()
  return order
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  extra?: { reason?: string; actorName?: string },
): Promise<void> {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order) return
  const now = new Date().toISOString()
  order.status = status

  switch (status) {
    case 'accepted':
      order.acceptedAt = order.acceptedAt ?? now
      break
    case 'preparing':
      order.preparingAt = order.preparingAt ?? now
      order.acceptedAt = order.acceptedAt ?? now
      break
    case 'ready':
      order.readyAt = order.readyAt ?? now
      break
    case 'served':
      order.servedAt = order.servedAt ?? now
      break
    case 'completed':
      order.completedAt = order.completedAt ?? now
      order.servedAt = order.servedAt ?? now
      break
    case 'cancelled':
      order.cancelledAt = now
      order.cancelledReason = extra?.reason ?? 'Cancelled by staff'
      break
    default:
      break
  }

  if (MODE === 'live') {
    await requireSupabase()
      .from('orders')
      .update({
        status,
        accepted_at: order.acceptedAt,
        preparing_at: order.preparingAt,
        ready_at: order.readyAt,
        served_at: order.servedAt,
        completed_at: order.completedAt,
        cancelled_at: order.cancelledAt,
        cancelled_reason: order.cancelledReason,
      })
      .eq('id', orderId)
  }

  recomputeTableState(order.organizationId)
  logAudit({
    organizationId: order.organizationId,
    actorId: session?.user.id ?? null,
    actorName: extra?.actorName ?? session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'order.status_changed',
    entityType: 'order',
    entityId: order.id,
    summary: `Order ${order.orderNumber} moved to ${status}`,
  })
  emit()
}

export async function payOrder(
  orderId: string,
  method: NonNullable<Order['paymentMethod']>,
): Promise<void> {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order) return
  order.paymentStatus = 'paid'
  order.paymentMethod = method
  order.status = 'completed'
  order.completedAt = order.completedAt ?? new Date().toISOString()
  if (MODE === 'live') {
    await requireSupabase()
      .from('orders')
      .update({ payment_status: 'paid', payment_method: method, status: 'completed' })
      .eq('id', orderId)
  }
  logAudit({
    organizationId: order.organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'Guest',
    actorRole: 'customer',
    action: 'order.paid',
    entityType: 'order',
    entityId: order.id,
    summary: `Payment of ${order.total} captured via ${method}`,
  })
  emit()
}

/* ============================================================================
   Service requests
   ========================================================================= */

export async function createServiceRequest(input: {
  organizationId: string
  tableId: string
  tableNumber: string
  type: ServiceRequest['type']
  note?: string
}): Promise<ServiceRequest> {
  const request: ServiceRequest = {
    id: uid('sr'),
    organizationId: input.organizationId,
    tableId: input.tableId,
    tableNumber: input.tableNumber,
    type: input.type,
    status: 'pending',
    note: input.note ?? '',
    assignedToName: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  }
  if (MODE === 'live') {
    const { error } = await requireSupabase().from('service_requests').insert({
      id: request.id,
      organization_id: request.organizationId,
      table_id: request.tableId,
      table_number: request.tableNumber,
      type: request.type,
      status: request.status,
      note: request.note,
      created_at: request.createdAt,
    })
    if (error) throw new Error(error.message)
  }
  db.serviceRequests.unshift(request)
  notify({
    organizationId: request.organizationId,
    kind: 'service_request',
    title: `${input.tableNumber} · ${request.type.replace('_', ' ')}`,
    body: 'Guest requested assistance from the QR menu',
    href: '/app/tables',
  })
  emit()
  return request
}

export async function updateServiceRequestStatus(
  requestId: string,
  status: ServiceRequestStatus,
  assignedToName?: string,
): Promise<void> {
  const request = db.serviceRequests.find((r) => r.id === requestId)
  if (!request) return
  request.status = status
  if (assignedToName) request.assignedToName = assignedToName
  if (status === 'completed') request.resolvedAt = new Date().toISOString()
  if (MODE === 'live') {
    await requireSupabase()
      .from('service_requests')
      .update({ status, assigned_to_name: request.assignedToName, resolved_at: request.resolvedAt })
      .eq('id', requestId)
  }
  emit()
}

/* ============================================================================
   Reservations
   ========================================================================= */

export async function upsertReservation(reservation: Reservation): Promise<Reservation> {
  const idx = db.reservations.findIndex((r) => r.id === reservation.id)
  if (idx >= 0) db.reservations[idx] = reservation
  else db.reservations.unshift(reservation)
  if (MODE === 'live') {
    const { error } = await requireSupabase().from('reservations').upsert({
      id: reservation.id,
      organization_id: reservation.organizationId,
      customer_name: reservation.customerName,
      phone: reservation.phone,
      email: reservation.email,
      date: reservation.date,
      time: reservation.time,
      guests: reservation.guests,
      table_id: reservation.tableId,
      table_number: reservation.tableNumber,
      status: reservation.status,
      special_request: reservation.specialRequest,
      created_at: reservation.createdAt,
    })
    if (error) throw new Error(error.message)
  }
  emit()
  return reservation
}

export async function updateReservationStatus(
  organizationId: string,
  reservationId: string,
  status: Reservation['status'],
): Promise<void> {
  const res = db.reservations.find((r) => r.id === reservationId)
  if (!res) return
  res.status = status
  if (MODE === 'live') {
    await requireSupabase().from('reservations').update({ status }).eq('id', reservationId)
  }
  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'reservation.status_changed',
    entityType: 'reservation',
    entityId: reservationId,
    summary: `${res.customerName}'s booking marked ${status}`,
  })
  emit()
}

/* ============================================================================
   Inventory
   ========================================================================= */

export async function upsertInventoryItem(item: InventoryItem): Promise<InventoryItem> {
  const idx = db.inventory.findIndex((i) => i.id === item.id)
  if (idx >= 0) db.inventory[idx] = item
  else db.inventory.push(item)
  if (MODE === 'live') {
    const { error } = await requireSupabase().from('inventory_items').upsert({
      id: item.id,
      organization_id: item.organizationId,
      ingredient: item.ingredient,
      category: item.category,
      current_stock: item.currentStock,
      unit: item.unit,
      low_stock_threshold: item.lowStockThreshold,
      unit_cost: item.unitCost,
      supplier: item.supplier,
      expiry_date: item.expiryDate,
      last_restocked_at: item.lastRestockedAt,
    })
    if (error) throw new Error(error.message)
  }
  emit()
  return item
}

export async function adjustStock(
  organizationId: string,
  itemId: string,
  delta: number,
): Promise<void> {
  const item = db.inventory.find((i) => i.id === itemId)
  if (!item) return
  item.currentStock = Math.max(0, Number((item.currentStock + delta).toFixed(3)))
  item.lastRestockedAt = new Date().toISOString()
  if (MODE === 'live') {
    await requireSupabase()
      .from('inventory_items')
      .update({ current_stock: item.currentStock, last_restocked_at: item.lastRestockedAt })
      .eq('id', itemId)
  }
  emit()
}

/* ============================================================================
   Customers
   ========================================================================= */

export async function upsertCustomer(customer: Customer): Promise<Customer> {
  const idx = db.customers.findIndex((c) => c.id === customer.id)
  if (idx >= 0) db.customers[idx] = customer
  else db.customers.push(customer)
  if (MODE === 'live') {
    await requireSupabase().from('customers').upsert({
      id: customer.id,
      organization_id: customer.organizationId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      total_orders: customer.totalOrders,
      total_spend: customer.totalSpend,
      loyalty_points: customer.loyaltyPoints,
      tier: customer.tier,
      visit_count: customer.visitCount,
      last_visit_at: customer.lastVisitAt,
      preferences: customer.preferences,
      notes: customer.notes,
      marketing_consent: customer.marketingConsent,
    })
  }
  emit()
  return customer
}

/* ============================================================================
   Billing / subscription
   ========================================================================= */

export async function changePlan(organizationId: string, planId: PlanId): Promise<void> {
  const org = db.organizations.find((o) => o.id === organizationId)
  if (!org) return
  const previous = org.planId
  org.planId = planId
  org.subscriptionStatus = 'active'
  if (MODE === 'live') {
    await requireSupabase().from('organizations').update({ plan_id: planId, subscription_status: 'active' }).eq('id', organizationId)
  }
  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'plan.changed',
    entityType: 'subscription',
    entityId: organizationId,
    summary: `Plan changed from ${previous} to ${planId}`,
  })
  notify({
    organizationId,
    kind: 'subscription',
    title: `Plan updated to ${planId}`,
    body: 'Your new limits are active immediately. Pro-rated on the next invoice.',
    href: '/app/billing',
  })
  emit()
}

export async function cancelSubscription(organizationId: string): Promise<void> {
  const org = db.organizations.find((o) => o.id === organizationId)
  if (!org) return
  org.subscriptionStatus = 'cancelled'
  if (MODE === 'live') {
    await requireSupabase().from('organizations').update({ subscription_status: 'cancelled' }).eq('id', organizationId)
  }
  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'subscription.cancelled',
    entityType: 'subscription',
    entityId: organizationId,
    summary: 'Subscription cancelled — access continues until the period ends',
  })
  emit()
}

/* ============================================================================
   Branding / settings
   ========================================================================= */

export async function updateBranding(organizationId: string, branding: Branding): Promise<void> {
  const org = db.organizations.find((o) => o.id === organizationId)
  if (!org) return
  org.branding = branding
  if (MODE === 'live') {
    await requireSupabase().from('organizations').update({ branding }).eq('id', organizationId)
  }
  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'branding.updated',
    entityType: 'organization',
    entityId: organizationId,
    summary: 'Updated brand colours and customer menu appearance',
  })
  emit()
}

export async function updateOrganization(
  organizationId: string,
  patch: Partial<Organization>,
): Promise<void> {
  const org = db.organizations.find((o) => o.id === organizationId)
  if (!org) return
  Object.assign(org, patch)
  if (MODE === 'live') {
    await requireSupabase()
      .from('organizations')
      .update({
        name: org.name,
        slug: org.slug,
        business_type: org.businessType,
        gst_number: org.gstNumber,
        timezone: org.timezone,
        currency: org.currency,
        language: org.language,
      })
      .eq('id', organizationId)
  }
  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'organization.updated',
    entityType: 'organization',
    entityId: organizationId,
    summary: 'Restaurant profile updated',
  })
  emit()
}

/* ============================================================================
   Memberships (employees)
   ========================================================================= */

export async function inviteEmployee(input: {
  organizationId: string
  email: string
  name: string
  role: Role
  shift?: string
}): Promise<Membership> {
  const membership: Membership = {
    id: uid('mem'),
    organizationId: input.organizationId,
    userId: uid('user'),
    role: input.role,
    status: 'invited',
    shift: input.shift ?? 'Morning (08:00 – 16:00)',
    invitedAt: new Date().toISOString(),
    lastActiveAt: null,
  }
  if (MODE === 'live') {
    const { error } = await requireSupabase().from('memberships').insert({
      id: membership.id,
      organization_id: membership.organizationId,
      email: input.email,
      role: membership.role,
      status: membership.status,
      shift: membership.shift,
      invited_at: membership.invitedAt,
    })
    if (error) throw new Error(error.message)
  }
  db.memberships.push(membership)
  db.profiles.push({
    id: membership.userId,
    email: input.email,
    fullName: input.name,
    avatarUrl: null,
    phone: null,
    createdAt: new Date().toISOString(),
  })
  logAudit({
    organizationId: input.organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'employee.invited',
    entityType: 'membership',
    entityId: membership.id,
    summary: `Invited ${input.name} as ${input.role}`,
  })
  emit()
  return membership
}

export async function updateMembershipRole(
  organizationId: string,
  membershipId: string,
  role: Role,
): Promise<void> {
  const membership = db.memberships.find((m) => m.id === membershipId)
  if (!membership) return
  const previous = membership.role
  membership.role = role
  if (MODE === 'live') {
    await requireSupabase().from('memberships').update({ role }).eq('id', membershipId)
  }
  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'employee.role_changed',
    entityType: 'membership',
    entityId: membershipId,
    summary: `Role changed from ${previous} to ${role}`,
  })
  emit()
}

export async function removeMembership(organizationId: string, membershipId: string): Promise<void> {
  db.memberships = db.memberships.filter((m) => m.id !== membershipId)
  if (MODE === 'live') await requireSupabase().from('memberships').delete().eq('id', membershipId)
  logAudit({
    organizationId,
    actorId: session?.user.id ?? null,
    actorName: session?.user.fullName ?? 'System',
    actorRole: activeRole(),
    action: 'employee.removed',
    entityType: 'membership',
    entityId: membershipId,
    summary: 'Removed a team member',
  })
  emit()
}

/* ============================================================================
   Notifications
   ========================================================================= */

export async function markNotificationRead(id: string): Promise<void> {
  const n = db.notifications.find((x) => x.id === id)
  if (!n) return
  n.read = true
  if (MODE === 'live') await requireSupabase().from('notifications').update({ read: true }).eq('id', id)
  emit()
}

export async function markAllNotificationsRead(organizationId: string): Promise<void> {
  db.notifications
    .filter((x) => x.organizationId === organizationId)
    .forEach((x) => {
      x.read = true
    })
  if (MODE === 'live') {
    await requireSupabase().from('notifications').update({ read: true }).eq('organization_id', organizationId)
  }
  emit()
}

/* ============================================================================
   Realtime
   ========================================================================= */

/**
 * Realtime updates. Live mode subscribes to Supabase Postgres changes on the
 * operational tables (prd.md §25); demo mode simply replays local mutations.
 */
export function subscribeRealtime(organizationId: string): () => void {
  if (MODE !== 'live' || !supabase) return () => {}

  const tables = ['orders', 'restaurant_tables', 'service_requests', 'notifications']
  const channel = supabase.channel(`biteflow-org-${organizationId}`)
  tables.forEach((table) => {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `organization_id=eq.${organizationId}` },
      () => {
        void refresh()
      },
    )
  })
  channel.subscribe()
  return () => {
    void supabase?.removeChannel(channel)
  }
}

/** Re-pull the dataset from the backend (used by realtime + manual refresh). */
export async function refresh(): Promise<void> {
  if (MODE !== 'live') return
  db = await liveLoadAll()
  emit()
}

/* ============================================================================
   Demo helpers
   ========================================================================= */

export interface OrderNumberCounter {
  organizationId: string
  slug: string
  lastNumber: number
  nextOrderNumber: string
  tenantName: string
}

export async function getOrderNumberCounters(): Promise<OrderNumberCounter[]> {
  if (MODE !== 'live') {
    // Demo mode: synthesize counters from the demo orgs + order counts.
    return db.organizations.map((o) => {
      const count = db.orders.filter((ord) => ord.organizationId === o.id).length
      const lastNumber = 1199 + count
      return {
        organizationId: o.id,
        slug: o.slug,
        lastNumber,
        nextOrderNumber: `BF-${lastNumber + 1}`,
        tenantName: o.name,
      }
    })
  }
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('order_number_counters')
    .select('organization_id, last_number')
    .order('last_number', { ascending: false })
  if (error) throw new Error(error.message)

  const counters: OrderNumberCounter[] = []
  for (const row of (data ?? [])) {
    const org = db.organizations.find((o) => o.id === row.organization_id)
    if (!org) continue
    counters.push({
      organizationId: org.id,
      slug: org.slug,
      lastNumber: row.last_number,
      nextOrderNumber: `BF-${row.last_number + 1}`,
      tenantName: org.name,
    })
  }
  return counters
}

export async function resetDemoData(): Promise<void> {
  db = buildSeedDatabase()
  if (session) {
    session = {
      ...session,
      activeOrganizationId: db.organizations[0]?.id ?? '',
      memberships: db.memberships
        .filter((m) => m.userId === session!.user.id)
        .map((m) => ({ organizationId: m.organizationId, role: m.role })),
    }
  }
  emit()
  await sleep(LATENCY)
}

/** QR / public menu resolution by slug + optional table number (prd.md §11). */
export function resolvePublicContext(slug: string, tableNumber?: string) {
  const organization = db.organizations.find((o) => o.slug === slug) ?? null
  if (!organization) return { organization: null, table: null }
  const table = tableNumber
    ? (db.tables.find(
        (t) => t.organizationId === organization.id && t.tableNumber.toLowerCase() === tableNumber.toLowerCase(),
      ) ?? null)
    : null
  return { organization, table }
}

export { LATENCY }
