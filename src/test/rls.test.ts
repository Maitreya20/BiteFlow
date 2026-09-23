/**
 * @vitest-environment node
 *
 * RLS enforcement — platform-level boundary.
 *
 * The `/admin` platform screens are guarded on the client by session role alone
 * (see src/App.tsx + src/lib/nav.ts), which is cosmetic: anyone can flip a
 * localStorage demo session or call the REST API directly. The authoritative
 * boundary is Postgres row level security in `supabase/schema.sql`.
 *
 * This test reads the *real* RLS policies and helper functions out of the SQL
 * source, then evaluates those predicates against a multi-tenant fixture as
 * three different callers:
 *
 *   • tenant owner   → must not read platform rows or other tenants' rows
 *   • super admin    → must read everything (positive control)
 *   • anon           → must be denied the private platform tables
 *
 * It runs without a database, so schema drift breaks `npm test`. The same
 * invariants are executed against a real Postgres instance by
 * `supabase/tests/rls_platform_admin_boundary_test.sql` (`supabase test db`).
 *
 * "Platform-level tables" are the ones the live loader in src/data/api.ts reads
 * across the tenant boundary to render the admin surface: profiles,
 * organizations, memberships and audit_logs.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  extractFunctionBody,
  extractPolicies,
  extractRlsTables,
  visibleKeys,
  type Dataset,
  type Policy,
  type PolicyContext,
  type Row,
} from './rls-policy-evaluator'

/* ------------------------------------------------------------------- sources */

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const read = (relative: string): string => readFileSync(join(ROOT, relative), 'utf8')

const SCHEMA_SQL = read('supabase/schema.sql')
const MIGRATION_001 = read('supabase/migrations/001_full_stack.sql')
const MIGRATION_002 = read('supabase/migrations/002_order_numbering.sql')
const MIGRATION_003 = read('supabase/migrations/003_order_number_counter_rls.sql')
const MIGRATION_004 = read('supabase/migrations/004_impersonation.sql')
const API_SOURCE = read('src/data/api.ts')

const ALL_SQL = [SCHEMA_SQL, MIGRATION_001, MIGRATION_002, MIGRATION_003, MIGRATION_004]
const RLS_TABLES = new Set(ALL_SQL.flatMap((sql) => [...extractRlsTables(sql)]))

const SCHEMA_POLICIES = extractPolicies(SCHEMA_SQL)
const MIGRATION_001_POLICIES = extractPolicies(MIGRATION_001)
const MIGRATION_003_POLICIES = extractPolicies(MIGRATION_003)
const MIGRATION_004_POLICIES = extractPolicies(MIGRATION_004)

/** Policies for a base table, read from the canonical declarative schema. */
const basePolicies = (table: string): Policy[] => SCHEMA_POLICIES.filter((policy) => policy.table === table)

const BASE_TABLES = ['profiles', 'organizations', 'memberships', 'audit_logs'] as const

const normalise = (expr: string): string => expr.replace(/\s+/g, ' ').trim().toLowerCase()

/* ------------------------------------------------------------------- fixture */

const ORG_A = 'org-a'
const ORG_B = 'org-b'
/** Non-live tenant — used to prove the public-directory branch is bounded. */
const ORG_C = 'org-c'

const OWNER_A = 'user-owner-a'
const OWNER_B = 'user-owner-b'
const OWNER_C = 'user-owner-c'
const WAITER_A = 'user-waiter-a'
const SUSPENDED_B = 'user-suspended-b'
const PLATFORM_ADMIN = 'user-platform-admin'

const ORGANIZATION_ROWS: Row[] = [
  { id: ORG_A, subscription_status: 'active' },
  { id: ORG_B, subscription_status: 'active' },
  { id: ORG_C, subscription_status: 'cancelled' },
]

const MEMBERSHIP_ROWS: Row[] = [
  { id: 'mem-owner-a', organization_id: ORG_A, user_id: OWNER_A, role: 'owner', status: 'active' },
  { id: 'mem-waiter-a', organization_id: ORG_A, user_id: WAITER_A, role: 'waiter', status: 'active' },
  { id: 'mem-platform-admin', organization_id: ORG_A, user_id: PLATFORM_ADMIN, role: 'super_admin', status: 'active' },
  { id: 'mem-owner-b', organization_id: ORG_B, user_id: OWNER_B, role: 'owner', status: 'active' },
  { id: 'mem-owner-c', organization_id: ORG_C, user_id: OWNER_C, role: 'owner', status: 'active' },
  { id: 'mem-suspended-b', organization_id: ORG_B, user_id: SUSPENDED_B, role: 'manager', status: 'suspended' },
]

const PROFILE_ROWS: Row[] = [
  { id: OWNER_A },
  { id: OWNER_B },
  { id: OWNER_C },
  { id: WAITER_A },
  { id: PLATFORM_ADMIN },
]

const AUDIT_LOG_ROWS: Row[] = [
  { id: 'log-platform', organization_id: null, action: 'platform.plan.changed' },
  { id: 'log-a', organization_id: ORG_A, action: 'order.created' },
  { id: 'log-b', organization_id: ORG_B, action: 'order.created' },
  { id: 'log-c', organization_id: ORG_C, action: 'order.created' },
]

const COUNTER_ROWS: Row[] = [
  { id: ORG_A, organization_id: ORG_A, last_number: 1250 },
  { id: ORG_B, organization_id: ORG_B, last_number: 1300 },
  { id: ORG_C, organization_id: ORG_C, last_number: 1199 },
]

const IMPERSONATION_ROWS: Row[] = [
  // Platform staff standing in for a member of ORG_A.
  { id: 'imp-1', actor_user_id: PLATFORM_ADMIN, target_user_id: OWNER_A, target_organization_id: ORG_A },
  // An impersonation of ORG_B's owner, by the same platform admin.
  { id: 'imp-2', actor_user_id: PLATFORM_ADMIN, target_user_id: OWNER_B, target_organization_id: ORG_B },
]

const DATA: Dataset = {
  memberships: MEMBERSHIP_ROWS.map((row) => ({
    organization_id: String(row.organization_id),
    user_id: String(row.user_id),
    role: String(row.role),
    status: String(row.status),
  })),
  organizations: ORGANIZATION_ROWS.map((row) => ({
    id: String(row.id),
    subscription_status: String(row.subscription_status),
  })),
}

const context = (role: 'anon' | 'authenticated', uid: string | null): PolicyContext => ({
  role,
  uid,
  data: DATA,
})

const OWNER_A_CTX = context('authenticated', OWNER_A)
const OWNER_B_CTX = context('authenticated', OWNER_B)
const OWNER_C_CTX = context('authenticated', OWNER_C)
const SUSPENDED_B_CTX = context('authenticated', SUSPENDED_B)
const ADMIN_CTX = context('authenticated', PLATFORM_ADMIN)
const ANON_CTX = context('anon', null)

/** Visible row keys, sorted so expectations are order-independent. */
function seen(policies: Policy[], rows: Row[], ctx: PolicyContext, key = 'id'): string[] {
  return visibleKeys(policies, rows, ctx, key).sort()
}

/* -------------------------------------------------------------- policy shape */

describe('RLS policy shape', () => {
  it('enables row level security on every platform-level table', () => {
    for (const table of [...BASE_TABLES, 'order_number_counters']) {
      expect(RLS_TABLES.has(table), `${table} must have RLS enabled`).toBe(true)
    }
  })

  it('keeps the migration identical to the declarative schema for platform tables', () => {
    for (const table of BASE_TABLES) {
      const describe_ = (policies: Policy[]) =>
        policies
          .filter((policy) => policy.table === table && (policy.command === 'all' || policy.command === 'select'))
          .map((policy) => `${policy.name} :: ${policy.command} :: ${policy.roles ?? 'public'} :: ${normalise(policy.using ?? '')}`)
          .sort()

      const fromSchema = describe_(SCHEMA_POLICIES)
      const fromMigration = describe_(MIGRATION_001_POLICIES)

      expect(fromMigration, `${table} select policies differ between schema.sql and 001_full_stack.sql`).toEqual(
        fromSchema,
      )
    }
  })

  it('grants cross-tenant reads only through is_super_admin()', () => {
    for (const table of BASE_TABLES) {
      const selects = basePolicies(table).filter(
        (policy) => policy.command === 'all' || policy.command === 'select',
      )

      expect(selects.length, `${table} must have at least one select policy`).toBeGreaterThan(0)
      expect(
        selects.some((policy) => /is_super_admin\s*\(/.test(policy.using ?? '')),
        `${table} must expose a super-admin read path`,
      ).toBe(true)

      for (const policy of selects) {
        // A blanket allow would defeat the tenant boundary entirely.
        expect(normalise(policy.using ?? ''), `${policy.name} must not be a blanket allow`).not.toBe('true')
      }
    }
  })

  it('keeps the order-number counter behind the tenant boundary', () => {
    const selects = MIGRATION_003_POLICIES.filter(
      (policy) => policy.table === 'order_number_counters' && (policy.command === 'all' || policy.command === 'select'),
    )

    expect(selects).toHaveLength(1)
    expect(normalise(selects[0].using ?? '')).toBe(
      'public.is_org_member(organization_id) or public.is_super_admin()',
    )
    // No write policy: only the SECURITY DEFINER allocator may mutate a counter.
    expect(
      MIGRATION_003_POLICIES.filter((policy) => policy.table === 'order_number_counters' && policy.command !== 'select'),
    ).toHaveLength(0)
    // The table is operational metadata, not part of the public QR catalogue.
    expect(MIGRATION_003).toMatch(/revoke all on public\.order_number_counters from anon/i)
  })

  it('keeps the impersonation log client-read-only', () => {
    expect(RLS_TABLES.has('impersonation_sessions'), 'RLS must be enabled on the log').toBe(true)

    const selects = MIGRATION_004_POLICIES.filter(
      (policy) => policy.table === 'impersonation_sessions' && (policy.command === 'all' || policy.command === 'select'),
    )
    expect(selects).toHaveLength(1)
    expect(normalise(selects[0].using ?? '')).toBe(
      'actor_user_id = auth.uid() or target_user_id = auth.uid() or public.is_super_admin()',
    )

    // The log is written only by the SECURITY DEFINER functions, so no client
    // role may insert, edit or erase a record — otherwise a super admin could
    // impersonate someone and then delete the evidence.
    const writable = MIGRATION_004_POLICIES.filter(
      (policy) =>
        policy.table === 'impersonation_sessions' &&
        (policy.command === 'all' ||
          policy.command === 'insert' ||
          policy.command === 'update' ||
          policy.command === 'delete'),
    )
    expect(writable, 'no client-writable policy may exist on impersonation_sessions').toEqual([])
    expect(MIGRATION_004).toMatch(/revoke all on public\.impersonation_sessions from anon/i)
  })

  it('keeps audit_logs append-only', () => {
    const auditPolicies = [
      ...basePolicies('audit_logs'),
      ...MIGRATION_001_POLICIES.filter((policy) => policy.table === 'audit_logs'),
      ...MIGRATION_003_POLICIES.filter((policy) => policy.table === 'audit_logs'),
    ]
    const mutating = auditPolicies.filter(
      (policy) => policy.command === 'update' || policy.command === 'delete' || policy.command === 'all',
    )
    expect(mutating, 'audit_logs must not grant UPDATE/DELETE (and no `for all` policy)').toEqual([])
  })

  it('implements the RLS helpers as active-membership checks', () => {
    const isOrgMember = extractFunctionBody(SCHEMA_SQL, 'is_org_member')
    expect(isOrgMember).toMatch(/m\.organization_id\s*=\s*org/i)
    expect(isOrgMember).toMatch(/m\.user_id\s*=\s*auth\.uid\(\)/i)
    expect(isOrgMember).toMatch(/m\.status\s*=\s*'active'/i)

    const isSuperAdmin = extractFunctionBody(SCHEMA_SQL, 'is_super_admin')
    expect(isSuperAdmin).toMatch(/m\.user_id\s*=\s*auth\.uid\(\)/i)
    expect(isSuperAdmin).toMatch(/m\.role\s*=\s*'super_admin'/i)
    expect(isSuperAdmin).toMatch(/m\.status\s*=\s*'active'/i)

    const isPublicTenant = extractFunctionBody(SCHEMA_SQL, 'is_public_tenant')
    expect(isPublicTenant).toMatch(/subscription_status\s+in\s*\(\s*'active'\s*,\s*'trialing'\s*\)/i)

    // Every helper must be SECURITY DEFINER with a pinned search_path, otherwise
    // it would recurse into memberships' own RLS check (or be schema-hijackable).
    for (const name of ['is_org_member', 'is_super_admin', 'is_public_tenant']) {
      const declaration = new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([^)]*\\)[\\s\\S]*?as\\s*\\$\\$`,
        'i',
      ).exec(SCHEMA_SQL)?.[0]
      expect(declaration, `public.${name}() must exist`).toBeTruthy()
      expect(declaration, `public.${name}() must be SECURITY DEFINER`).toMatch(/security definer/i)
      expect(declaration, `public.${name}() must pin search_path`).toMatch(/set search_path = public/i)
    }
  })

  it('queries only RLS-protected tables from the client', () => {
    const queried = [...API_SOURCE.matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g)].map((match) => match[1])
    const unique = [...new Set(queried)].sort()

    expect(unique.length).toBeGreaterThan(0)
    expect(unique.filter((table) => !RLS_TABLES.has(table))).toEqual([])
  })
})

/* ----------------------------------------------------------- enforcement */

describe('RLS enforcement: tenant owner vs platform admin', () => {
  it('denies a tenant owner every platform-level audit row', () => {
    const visible = seen(basePolicies('audit_logs'), AUDIT_LOG_ROWS, OWNER_A_CTX)

    expect(visible).toEqual(['log-a'])
    expect(visible).not.toContain('log-platform')
    expect(visible).not.toContain('log-b')
    expect(visible).not.toContain('log-c')
  })

  it('denies a tenant owner another tenant’s memberships and another user’s profile', () => {
    expect(seen(basePolicies('memberships'), MEMBERSHIP_ROWS, OWNER_A_CTX)).toEqual([
      'mem-owner-a',
      'mem-platform-admin',
      'mem-waiter-a',
    ])
    expect(seen(basePolicies('profiles'), PROFILE_ROWS, OWNER_A_CTX)).toEqual([OWNER_A])
    expect(seen(basePolicies('organizations'), ORGANIZATION_ROWS, OWNER_A_CTX)).not.toContain(ORG_C)
  })

  it('is not simply denying the owner everything — their own tenant stays readable', () => {
    expect(seen(basePolicies('audit_logs'), AUDIT_LOG_ROWS, OWNER_A_CTX)).toContain('log-a')
    expect(seen(basePolicies('organizations'), ORGANIZATION_ROWS, OWNER_A_CTX)).toContain(ORG_A)
    expect(seen(basePolicies('memberships'), MEMBERSHIP_ROWS, OWNER_A_CTX)).toContain('mem-owner-a')
  })

  it('lets a platform super admin read every tenant (positive control)', () => {
    expect(seen(basePolicies('audit_logs'), AUDIT_LOG_ROWS, ADMIN_CTX)).toEqual([
      'log-a',
      'log-b',
      'log-c',
      'log-platform',
    ])
    expect(seen(basePolicies('organizations'), ORGANIZATION_ROWS, ADMIN_CTX)).toEqual([ORG_A, ORG_B, ORG_C])
    expect(seen(basePolicies('memberships'), MEMBERSHIP_ROWS, ADMIN_CTX)).toHaveLength(MEMBERSHIP_ROWS.length)
    expect(seen(basePolicies('profiles'), PROFILE_ROWS, ADMIN_CTX)).toHaveLength(PROFILE_ROWS.length)
    expect(seen(MIGRATION_003_POLICIES, COUNTER_ROWS, ADMIN_CTX)).toEqual([ORG_A, ORG_B, ORG_C])
  })

  it('denies anon the private platform tables', () => {
    expect(seen(basePolicies('profiles'), PROFILE_ROWS, ANON_CTX)).toEqual([])
    expect(seen(basePolicies('memberships'), MEMBERSHIP_ROWS, ANON_CTX)).toEqual([])
    expect(seen(basePolicies('audit_logs'), AUDIT_LOG_ROWS, ANON_CTX)).toEqual([])
  })

  it('shows only live tenants in the public QR directory', () => {
    // organizations is the one platform table with an intentional public read
    // path: the guest menu needs a live tenant's identity + branding. The
    // boundary that matters is that a non-live tenant never leaks.
    expect(seen(basePolicies('organizations'), ORGANIZATION_ROWS, ANON_CTX)).toEqual([ORG_A, ORG_B])
    expect(normalise(basePolicies('organizations')[0].using ?? '')).toContain('is_public_tenant(id)')
  })

  it('denies a tenant owner another tenant’s order-number counter', () => {
    expect(seen(MIGRATION_003_POLICIES, COUNTER_ROWS, OWNER_A_CTX, 'organization_id')).toEqual([ORG_A])
    expect(seen(MIGRATION_003_POLICIES, COUNTER_ROWS, OWNER_B_CTX, 'organization_id')).toEqual([ORG_B])
    expect(seen(MIGRATION_003_POLICIES, COUNTER_ROWS, ANON_CTX, 'organization_id')).toEqual([])
  })

  it('shows a tenant owner only the impersonations of themselves', () => {
    // A tenant being impersonated can see that it happened — but not who else
    // was impersonated, and not the platform-wide log.
    expect(seen(MIGRATION_004_POLICIES, IMPERSONATION_ROWS, OWNER_A_CTX)).toEqual(['imp-1'])
    expect(seen(MIGRATION_004_POLICIES, IMPERSONATION_ROWS, OWNER_B_CTX)).toEqual(['imp-2'])
    expect(seen(MIGRATION_004_POLICIES, IMPERSONATION_ROWS, OWNER_C_CTX)).toEqual([])
  })

  it('denies anon the impersonation log entirely', () => {
    expect(seen(MIGRATION_004_POLICIES, IMPERSONATION_ROWS, ANON_CTX)).toEqual([])
  })

  it('lets only platform staff see the whole impersonation log', () => {
    expect(seen(MIGRATION_004_POLICIES, IMPERSONATION_ROWS, ADMIN_CTX)).toEqual(['imp-1', 'imp-2'])
  })

  it('treats a suspended membership as no access at all', () => {
    expect(seen(basePolicies('organizations'), ORGANIZATION_ROWS, SUSPENDED_B_CTX)).toEqual(
      seen(basePolicies('organizations'), ORGANIZATION_ROWS, ANON_CTX),
    )
    expect(seen(basePolicies('audit_logs'), AUDIT_LOG_ROWS, SUSPENDED_B_CTX)).toEqual([])
    // Only their own pending row is reachable, via `user_id = auth.uid()`.
    expect(seen(basePolicies('memberships'), MEMBERSHIP_ROWS, SUSPENDED_B_CTX)).toEqual(['mem-suspended-b'])
  })
})

/* ---------------------------------------------------------------- calibration */

describe('RLS test harness calibration', () => {
  it('would flag a weakened policy as a failure', () => {
    // If a `using (true)` select policy ever replaced the real one, the owner
    // would see every platform row — this asserts the harness notices.
    const permissive: Policy[] = [
      { name: 'audit_logs_open', table: 'audit_logs', command: 'select', roles: null, using: 'true', withCheck: null },
    ]
    expect(seen(permissive, AUDIT_LOG_ROWS, OWNER_A_CTX)).toEqual(['log-a', 'log-b', 'log-c', 'log-platform'])
    expect(seen(permissive, AUDIT_LOG_ROWS, OWNER_A_CTX)).not.toEqual(
      seen(basePolicies('audit_logs'), AUDIT_LOG_ROWS, OWNER_A_CTX),
    )
  })
})
