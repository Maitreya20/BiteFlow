/** Navigation model — mirrors prd.md §5 information architecture. */

export type BadgeKey = 'orders' | 'kitchen' | 'serviceRequests' | 'inventory' | 'notifications'

export interface NavItem {
  label: string
  to: string
  icon: string
  badgeKey?: BadgeKey
  capability?: string
  matchPrefix?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const APP_NAV: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/app/dashboard', icon: 'grid_view', capability: 'dashboard' }],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Live Orders', to: '/app/orders', icon: 'receipt_long', badgeKey: 'orders', capability: 'orders' },
      { label: 'Kitchen KDS', to: '/app/kitchen', icon: 'soup_kitchen', badgeKey: 'kitchen', capability: 'kitchen' },
      { label: 'Tables & Floor', to: '/app/tables', icon: 'table_restaurant', capability: 'tables' },
      { label: 'Reservations', to: '/app/reservations', icon: 'book_online', capability: 'reservations' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { label: 'Menu Builder', to: '/app/menu', icon: 'restaurant_menu', capability: 'menu' },
      { label: 'Inventory Stock', to: '/app/inventory', icon: 'inventory_2', badgeKey: 'inventory', capability: 'inventory' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Customers & CRM', to: '/app/customers', icon: 'group', capability: 'customers' },
      { label: 'Staff & Roles', to: '/app/employees', icon: 'badge', capability: 'employees' },
    ],
  },
  {
    title: 'Insights',
    items: [{ label: 'Analytics & Reports', to: '/app/analytics', icon: 'insights', capability: 'analytics' }],
  },
  {
    title: 'Business',
    items: [
      { label: 'Subscription & Billing', to: '/app/billing', icon: 'credit_card', capability: 'billing' },
      { label: 'Brand & White-Label', to: '/app/branding', icon: 'palette', capability: 'branding' },
      { label: 'Settings', to: '/app/settings', icon: 'settings', capability: 'settings' },
    ],
  },
]

export const ADMIN_NAV: NavGroup[] = [
  {
    title: 'Platform',
    items: [
      { label: 'Overview', to: '/admin', icon: 'space_dashboard' },
      { label: 'Tenants', to: '/admin/tenants', icon: 'storefront' },
      { label: 'Plans', to: '/admin/plans', icon: 'sell' },
      { label: 'Subscriptions', to: '/admin/subscriptions', icon: 'autorenew' },
    ],
  },
  {
    title: 'Insights',
    items: [{ label: 'Platform Analytics', to: '/admin/analytics', icon: 'monitoring' }],
  },
  {
    title: 'Governance',
    items: [{ label: 'Audit Log', to: '/admin/audit', icon: 'policy' }],
  },
]

/** Customer mobile bottom navigation — design.md §29. */
export const CUSTOMER_TABS: NavItem[] = [
  { label: 'Home', to: 'home', icon: 'home' },
  { label: 'Menu', to: 'menu', icon: 'restaurant_menu' },
  { label: 'Orders', to: 'orders', icon: 'receipt_long' },
  { label: 'Bill', to: 'bill', icon: 'request_quote' },
  { label: 'Profile', to: 'profile', icon: 'person' },
]
