/** Subscription tier definitions — prd.md §7. */
import type { Plan, PlanId } from './types'

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 999,
    priceYearly: 9990,
    tagline: 'Digital menu + QR ordering for a single counter',
    bestFor: 'Small cafés and single-location businesses',
    features: [
      'Digital menu',
      'QR table ordering',
      'Basic table management',
      'Basic analytics',
      'Email support',
    ],
    limits: {
      maxBranches: 1,
      maxEmployees: 5,
      maxTables: 10,
      maxMenuItems: 40,
      maxOrdersPerMonth: 800,
      maxCustomers: 500,
      maxStorageMb: 500,
    },
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 2499,
    priceYearly: 24990,
    tagline: 'Kitchen, staff and reservations for a full-service floor',
    bestFor: 'Growing single-location restaurants',
    recommended: true,
    features: [
      'Everything in Starter',
      'Kitchen Display System (KDS)',
      'Staff management & RBAC',
      'Reservations',
      'Inventory tracking',
      'Advanced analytics',
      'Custom branding / white-label',
    ],
    limits: {
      maxBranches: 1,
      maxEmployees: 25,
      maxTables: 40,
      maxMenuItems: 200,
      maxOrdersPerMonth: 5000,
      maxCustomers: 10000,
      maxStorageMb: 5000,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 5999,
    priceYearly: 59990,
    tagline: 'Multi-branch operations, loyalty and API access',
    bestFor: 'Larger restaurants and multi-location groups',
    features: [
      'Everything in Growth',
      'Multiple branches',
      'Advanced analytics & forecasting',
      'Advanced inventory',
      'Loyalty programme',
      'API access',
      'Priority support',
    ],
    limits: {
      maxBranches: 5,
      maxEmployees: 120,
      maxTables: 150,
      maxMenuItems: 900,
      maxOrdersPerMonth: 30000,
      maxCustomers: 100000,
      maxStorageMb: 40000,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 0,
    priceYearly: 0,
    tagline: 'Custom limits, integrations and white-label reseller',
    bestFor: 'Chains, franchises and platform partners',
    features: [
      'Everything in Pro',
      'Custom limits & SLAs',
      'Custom integrations',
      'Advanced RBAC + SSO',
      'Dedicated support manager',
      'White-label reseller options',
    ],
    limits: {
      maxBranches: 999,
      maxEmployees: 5000,
      maxTables: 5000,
      maxMenuItems: 50000,
      maxOrdersPerMonth: 1000000,
      maxCustomers: 5000000,
      maxStorageMb: 500000,
    },
  },
}

export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.growth, PLANS.pro, PLANS.enterprise]

export const LIMIT_LABELS: Record<keyof Plan['limits'], string> = {
  maxBranches: 'Branches',
  maxEmployees: 'Employees',
  maxTables: 'Tables',
  maxMenuItems: 'Menu items',
  maxOrdersPerMonth: 'Orders / month',
  maxCustomers: 'Customers',
  maxStorageMb: 'Storage (MB)',
}

export function isAtLimit(current: number, limit: number): boolean {
  return limit > 0 && current >= limit
}

/** Upgrade path used by limit states (design.md §35). */
export function nextPlanId(current: PlanId): PlanId | null {
  const order: PlanId[] = ['starter', 'growth', 'pro', 'enterprise']
  const idx = order.indexOf(current)
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null
}

export const TRIAL_DAYS = 14
