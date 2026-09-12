/**
 * BiteFlow domain model.
 * Mirrors prd.md §6 (tenant model), §10 (menu), §13 (order lifecycle),
 * §15 (tables), §16 (service requests), §17 (reservations), §18 (inventory),
 * §19 (RBAC), §20 (customers), §21 (loyalty), §7 (subscriptions).
 */

export type Role =
  | 'super_admin'
  | 'owner'
  | 'manager'
  | 'cashier'
  | 'chef'
  | 'kitchen_staff'
  | 'waiter'
  | 'customer'

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  owner: 'Organization Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  chef: 'Chef',
  kitchen_staff: 'Kitchen Staff',
  waiter: 'Waiter',
  customer: 'Customer',
}

/** Sidebar/screen access per role — enforced server-side too (prd.md §19). */
export const ROLE_CAPABILITIES: Record<Role, string[]> = {
  super_admin: ['*'],
  owner: ['*'],
  manager: [
    'dashboard',
    'orders',
    'kitchen',
    'tables',
    'reservations',
    'menu',
    'inventory',
    'customers',
    'employees',
    'analytics',
    'settings',
  ],
  cashier: ['dashboard', 'orders', 'tables', 'customers', 'billing'],
  chef: ['kitchen', 'orders', 'inventory'],
  kitchen_staff: ['kitchen'],
  waiter: ['dashboard', 'orders', 'tables', 'reservations'],
  customer: [],
}

/* ------------------------------------------------------------------ Tenancy */

export type BusinessType =
  | 'cafe'
  | 'restaurant'
  | 'food_court'
  | 'cloud_kitchen'
  | 'bakery'
  | 'bar'

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  cafe: 'Café',
  restaurant: 'Restaurant',
  food_court: 'Food Court',
  cloud_kitchen: 'Cloud Kitchen',
  bakery: 'Bakery',
  bar: 'Bar & Lounge',
}

export type PlanId = 'starter' | 'growth' | 'pro' | 'enterprise'

export interface PlanLimits {
  maxBranches: number
  maxEmployees: number
  maxTables: number
  maxMenuItems: number
  maxOrdersPerMonth: number
  maxCustomers: number
  maxStorageMb: number
}

export interface Plan {
  id: PlanId
  name: string
  priceMonthly: number
  priceYearly: number
  tagline: string
  bestFor: string
  features: string[]
  limits: PlanLimits
  recommended?: boolean
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'

/** Restaurant branding config — design.md §19, prd.md §9. */
export interface Branding {
  logoUrl: string | null
  logoEmoji: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: 'Manrope' | 'Inter' | 'Playfair Display' | 'DM Sans' | 'Sora'
  radiusScale: 'sharp' | 'soft' | 'round'
  buttonStyle: 'solid' | 'outline' | 'pill'
  cardStyle: 'elevated' | 'flat' | 'bordered'
  menuLayout: 'grid' | 'list' | 'magazine'
  heroHeadline: string
  heroSubcopy: string
  heroImageUrl: string | null
  tagline: string
  address: string
  phone: string
  rating: number
  isOpen: boolean
  currency: string
  taxPercent: number
  serviceChargePercent: number
}

export interface Organization {
  id: string
  name: string
  slug: string
  businessType: BusinessType
  gstNumber: string
  timezone: string
  currency: string
  language: string
  planId: PlanId
  subscriptionStatus: SubscriptionStatus
  trialEndsAt: string | null
  renewsAt: string | null
  createdAt: string
  seededDemo: boolean
  branding: Branding
}

/* --------------------------------------------------------------- Identity */

export interface Profile {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  phone: string | null
  createdAt: string
}

export interface Membership {
  id: string
  organizationId: string
  userId: string
  role: Role
  status: 'active' | 'invited' | 'suspended'
  shift: string
  invitedAt: string
  lastActiveAt: string | null
}

/* ----------------------------------------------------------------- Menu */

export interface MenuOption {
  id: string
  name: string
  priceDelta: number
  isDefault?: boolean
}

export interface MenuOptionGroup {
  id: string
  name: string
  type: 'single' | 'multi'
  required: boolean
  options: MenuOption[]
}

export interface MenuCategory {
  id: string
  organizationId: string
  name: string
  description: string
  icon: string
  sortOrder: number
  isActive: boolean
}

export interface MenuItem {
  id: string
  organizationId: string
  categoryId: string
  name: string
  description: string
  price: number
  imageUrl: string | null
  prepTimeMinutes: number
  calories: number
  available: boolean
  isChefPick: boolean
  isTrending: boolean
  isVegetarian: boolean
  isSpicy: boolean
  allergens: string[]
  tags: string[]
  optionGroups: MenuOptionGroup[]
  sortOrder: number
}

/* --------------------------------------------------------------- Tables */export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning'
export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  cleaning: 'Cleaning',
}

export interface RestaurantTable {
  id: string
  organizationId: string
  branchId: string
  tableNumber: string
  capacity: number
  status: TableStatus
  assignedWaiterId: string | null
  assignedWaiterName: string | null
  currentBill: number
  occupiedSince: string | null
  qrToken: string
  zone: 'Indoor' | 'Terrace' | 'Private' | 'Bar'
  posX: number
  posY: number
}

/* --------------------------------------------------------------- Orders */

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/** Permitted transitions — prd.md §13. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: ['completed'],
  completed: [],
  cancelled: [],
}

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type OrderChannel = 'dine_in' | 'takeaway' | 'delivery'

export interface OrderItem {
  id: string
  orderId: string
  menuItemId: string
  name: string
  unitPrice: number
  quantity: number
  options: string[]
  optionsTotal: number
  notes: string
  lineTotal: number
}

export interface Order {
  id: string
  organizationId: string
  orderNumber: string
  channel: OrderChannel
  tableId: string | null
  tableNumber: string | null
  customerId: string | null
  customerName: string | null
  status: OrderStatus
  items: OrderItem[]
  subtotal: number
  taxAmount: number
  serviceCharge: number
  discount: number
  total: number
  notes: string
  allergyNote: string
  kitchenNote: string
  paymentStatus: PaymentStatus
  paymentMethod: 'upi' | 'card' | 'cash' | 'wallet' | null
  placedAt: string
  acceptedAt: string | null
  preparingAt: string | null
  readyAt: string | null
  servedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelledReason: string | null
}

/* ------------------------------------------------------ Service requests */export type ServiceRequestType =
  | 'call_waiter'
  | 'request_bill'
  | 'water'
  | 'cutlery'
  | 'clean_table'
  | 'other'
export const SERVICE_REQUEST_LABELS: Record<ServiceRequestType, string> = {
  call_waiter: 'Call Waiter',
  request_bill: 'Bill Request',
  water: 'Water Refill',
  cutlery: 'Cutlery',
  clean_table: 'Table Cleaning',
  other: 'Other',
}

export type ServiceRequestStatus = 'pending' | 'acknowledged' | 'in_progress' | 'completed'

export interface ServiceRequest {
  id: string
  organizationId: string
  tableId: string
  tableNumber: string
  type: ServiceRequestType
  status: ServiceRequestStatus
  note: string
  assignedToName: string | null
  createdAt: string
  resolvedAt: string | null
}

/* ------------------------------------------------------------ Reservations */

export type ReservationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface Reservation {
  id: string
  organizationId: string
  customerName: string
  phone: string
  email: string
  date: string
  time: string
  guests: number
  tableId: string | null
  tableNumber: string | null
  status: ReservationStatus
  specialRequest: string
  createdAt: string
}

/* --------------------------------------------------------------- Inventory */

export type InventoryStatus = 'healthy' | 'low' | 'critical' | 'expired'
export type InventoryUnit = 'kg' | 'g' | 'l' | 'ml' | 'pcs' | 'packs' | 'bottles'

export interface InventoryItem {
  id: string
  organizationId: string
  ingredient: string
  category: string
  currentStock: number
  unit: InventoryUnit
  lowStockThreshold: number
  unitCost: number
  supplier: string
  expiryDate: string | null
  lastRestockedAt: string
}

/* --------------------------------------------------------------- Customers */

export interface Customer {
  id: string
  organizationId: string
  name: string
  phone: string
  email: string
  totalOrders: number
  totalSpend: number
  loyaltyPoints: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  visitCount: number
  lastVisitAt: string | null
  preferences: string[]
  notes: string
  marketingConsent: boolean
  createdAt: string
}

/* ----------------------------------------------------------------- Billing */

export interface Invoice {
  id: string
  organizationId: string
  invoiceNumber: string
  issuedAt: string
  amount: number
  status: 'paid' | 'pending' | 'failed'
  planId: PlanId
  periodLabel: string
}

export interface PaymentMethod {
  id: string
  organizationId: string
  brand: 'visa' | 'mastercard' | 'amex' | 'rupay' | 'upi'
  last4: string
  expiry: string
  isDefault: boolean
}

/* -------------------------------------------------------------- Audit log */

export interface AuditLog {
  id: string
  organizationId: string | null
  actorId: string | null
  actorName: string
  actorRole: Role
  action: string
  entityType: string
  entityId: string | null
  summary: string
  ipAddress: string
  createdAt: string
}

/* ------------------------------------------------------------- Notifications */

export type NotificationKind =
  | 'order'
  | 'service_request'
  | 'inventory'
  | 'subscription'
  | 'system'

export interface AppNotification {
  id: string
  organizationId: string
  kind: NotificationKind
  title: string
  body: string
  read: boolean
  createdAt: string
  href: string | null
}

/* ------------------------------------------------------------ Demo dataset */

/** Shape returned by both the demo seed and the Supabase adapter. */
export interface DemoDatabase {
  profiles: Profile[]
  organizations: Organization[]
  memberships: Membership[]
  categories: MenuCategory[]
  menuItems: MenuItem[]
  tables: RestaurantTable[]
  orders: Order[]
  serviceRequests: ServiceRequest[]
  reservations: Reservation[]
  inventory: InventoryItem[]
  customers: Customer[]
  invoices: Invoice[]
  paymentMethods: PaymentMethod[]
  auditLogs: AuditLog[]
  notifications: AppNotification[]
}

/* ------------------------------------------------------- Dashboard metrics */

export interface TenantMetrics {
  salesToday: number
  salesYesterday: number
  ordersToday: number
  ordersYesterday: number
  averageOrderValue: number
  aovDelta: number
  tablesOccupied: number
  tablesTotal: number
  tableUtilization: number
  avgPrepMinutes: number
  cancellationRate: number
  newCustomers: number
  returningCustomers: number
  loyaltyPointsIssued: number
  hourly: { label: string; orders: number; revenue: number }[]
  channelMix: { channel: OrderChannel; label: string; share: number; revenue: number }[]
  topItems: { name: string; imageUrl: string | null; quantity: number; revenue: number; badge: string }[]
  revenueTrend: { label: string; value: number }[]
  peakHours: string
}

/* ---------------------------------------------------------------- Tenants */

/** Row shape for the Super Admin tenant table (design.md §21). */
export interface AdminTenantRow {
  organization: Organization
  ownerName: string
  ownerEmail: string
  planId: PlanId
  status: SubscriptionStatus | 'suspended'
  branches: number
  employees: number
  ordersThisMonth: number
  revenueThisMonth: number
  createdAt: string
}

/* -------------------------------------------------------------- Onboarding */

export interface OnboardingDraft {
  account: { fullName: string; email: string; password: string }
  restaurant: {
    name: string
    slug: string
    businessType: BusinessType
    gstNumber: string
    currency: string
    language: string
    timezone: string
    address: string
    phone: string
  }
  planId: PlanId
  branding: Branding
  menuMethod: 'manual' | 'import'
  tables: { tableNumber: string; capacity: number; zone: RestaurantTable['zone'] }[]
  staff: { email: string; role: Role; name: string }[]
}

export type OnboardingStepId =
  | 'account'
  | 'restaurant'
  | 'plan'
  | 'branding'
  | 'menu'
  | 'tables'
  | 'staff'
  | 'launch'

