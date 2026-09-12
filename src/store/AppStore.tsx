/** App-wide store: session, active tenant scope, derived selectors and actions. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import * as api from '@/data/api'
import { computeMetrics } from '@/data/metrics'
import { applyBranding } from './theme'
import { ROLE_CAPABILITIES } from '@/lib/types'
import type {
  AppNotification,
  AuditLog,
  Customer,
  DemoDatabase,
  InventoryItem,
  Invoice,
  MenuCategory,
  MenuItem,
  Order,
  PaymentMethod,
  Profile,
  Reservation,
  RestaurantTable,
  Role,
  ServiceRequest,
} from '@/lib/types'
import { PLANS } from '@/lib/plans'

export interface EmployeeRow {
  membershipId: string
  userId: string
  name: string
  email: string
  role: Role
  status: string
  shift: string
  invitedAt: string
  lastActiveAt: string | null
}

interface AppStoreValue {
  ready: boolean
  db: DemoDatabase
  session: api.AuthSession | null
  organization: DemoDatabase['organizations'][number] | null
  role: Role
  mode: 'live' | 'demo'
  signingOut: boolean

  orders: Order[]
  tables: RestaurantTable[]
  menuItems: MenuItem[]
  categories: MenuCategory[]
  serviceRequests: ServiceRequest[]
  reservations: Reservation[]
  inventory: InventoryItem[]
  customers: Customer[]
  invoices: Invoice[]
  paymentMethods: PaymentMethod[]
  notifications: AppNotification[]
  auditLogs: AuditLog[]
  employees: EmployeeRow[]
  profiles: Profile[]
  metrics: ReturnType<typeof computeMetrics>

  hasCapability: (capability: string) => boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  switchOrganization: (id: string) => void
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot)
  const [ready, setReady] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Restore the Supabase session on first paint (prd.md §26).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await api.loadSession()
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const { db, session } = snapshot

  const organization = useMemo(
    () => db.organizations.find((o) => o.id === session?.activeOrganizationId) ?? null,
    [db.organizations, session?.activeOrganizationId],
  )

  const role = useMemo<Role>(() => {
    if (!session) return 'customer'
    const membership = db.memberships.find(
      (m) => m.organizationId === session.activeOrganizationId && m.userId === session.user.id,
    )
    if (membership) return membership.role
    const admin = db.memberships.find(
      (m) => m.userId === session.user.id && m.role === 'super_admin',
    )
    return admin ? 'super_admin' : 'owner'
  }, [db.memberships, session])

  const orgId = organization?.id ?? ''

  const scope = useMemo(
    () => ({
      orders: db.orders
        .filter((o) => o.organizationId === orgId)
        .sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt)),
      tables: db.tables
        .filter((t) => t.organizationId === orgId)
        .sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true })),
      menuItems: db.menuItems.filter((m) => m.organizationId === orgId),
      categories: db.categories
        .filter((c) => c.organizationId === orgId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      serviceRequests: db.serviceRequests
        .filter((s) => s.organizationId === orgId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
      reservations: db.reservations
        .filter((r) => r.organizationId === orgId)
        .sort((a, b) => a.time.localeCompare(b.time)),
      inventory: db.inventory
        .filter((i) => i.organizationId === orgId)
        .sort((a, b) => a.ingredient.localeCompare(b.ingredient)),
      customers: db.customers
        .filter((c) => c.organizationId === orgId)
        .sort((a, b) => b.totalSpend - a.totalSpend),
      invoices: db.invoices
        .filter((i) => i.organizationId === orgId)
        .sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt)),
      paymentMethods: db.paymentMethods.filter((p) => p.organizationId === orgId),
      notifications: db.notifications
        .filter((n) => n.organizationId === orgId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
      auditLogs: db.auditLogs
        .filter((a) => a.organizationId === orgId || a.organizationId === null)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    }),
    [db, orgId],
  )

  const employees = useMemo<EmployeeRow[]>(() => {
    const emailOf = (userId: string) => db.profiles.find((p) => p.id === userId)?.email ?? ''
    return db.memberships
      .filter((m) => m.organizationId === orgId)
      .map((m) => {
        const userId = 'user_id' in m ? (m as { user_id?: string }).user_id ?? m.userId : m.userId
        const profile = db.profiles.find((p) => p.id === (m.userId || userId))
        return {
          membershipId: m.id,
          userId: m.userId,
          name: profile?.fullName ?? emailOf(m.userId).split('@')[0] ?? 'Teammate',
          email: profile?.email ?? '—',
          role: m.role,
          status: m.status,
          shift: m.shift,
          invitedAt: m.invitedAt,
          lastActiveAt: m.lastActiveAt,
        }
      })
  }, [db.memberships, db.profiles, orgId])

  const metrics = useMemo(
    () =>
      computeMetrics({
        orders: scope.orders,
        tables: scope.tables,
        customers: scope.customers,
        menuItems: scope.menuItems,
      }),
    [scope.orders, scope.tables, scope.customers, scope.menuItems],
  )

  // Re-skin the app whenever the tenant changes.
  useEffect(() => {
    applyBranding(organization?.branding ?? null)
  }, [organization?.branding])

  // Realtime: Supabase Postgres changes in live mode.
  useEffect(() => {
    if (!orgId || api.MODE !== 'live') return
    return api.subscribeRealtime(orgId)
  }, [orgId])

  const hasCapability = useCallback(
    (capability: string) => {
      const caps = ROLE_CAPABILITIES[role] ?? []
      return caps.includes('*') || caps.includes(capability)
    },
    [role],
  )

  const value: AppStoreValue = {
    ready,
    db,
    session,
    organization,
    role,
    mode: api.MODE,
    signingOut,
    ...scope,
    employees,
    profiles: db.profiles,
    metrics,
    hasCapability,
    refresh: api.refresh,
    switchOrganization: api.switchOrganization,
    signOut: async () => {
      setSigningOut(true)
      try {
        await api.signOut()
      } finally {
        setSigningOut(false)
      }
    },
  }

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore must be used inside <AppStoreProvider>')
  return ctx
}

/** Plan limits for the active tenant + current usage (design.md §18, §35). */
export function usePlanUsage() {
  const { organization, tables, menuItems, employees, orders, customers } = useAppStore()
  return useMemo(() => {
    const plan = PLANS[organization?.planId ?? 'starter']
    return {
      plan,
      usage: {
        maxTables: tables.length,
        maxMenuItems: menuItems.length,
        maxEmployees: employees.length,
        maxOrdersPerMonth: orders.filter(
          (o) => new Date(o.placedAt).getMonth() === new Date().getMonth(),
        ).length,
        maxCustomers: customers.length,
        maxBranches: 1,
        maxStorageMb: 1180,
      },
    }
  }, [organization?.planId, tables.length, menuItems.length, employees.length, orders, customers.length])
}

export { api }
