/**
 * Live smoke test: catches drift between the schema this repo ships
 * (supabase/migrations/*, supabase/schema.sql) and what actually exists on the
 * hosted Supabase project.
 *
 * Why contract checks instead of diffing migration files: the hosted project
 * can be migrated by the CLI, the MCP `apply_migration` tool or pasted SQL, so
 * migration *names* and *timestamps* differ from the repo. What must never
 * drift is the *contract* those migrations establish — the tables the app
 * reads, RLS being on, the SECURITY DEFINER helpers, who holds grants, and the
 * realtime publication. Those are what this script asserts.
 *
 * Two layers:
 *
 *   1. Client checks (always run) — need only the anon key from .env.local.
 *      REST is up, the expected tables are exposed, auth answers, and a
 *      realtime channel on `orders` subscribes.
 *
 *   2. SQL contract checks (run when SUPABASE_ACCESS_TOKEN is set) — queries
 *      pg_catalog through the Management API the same way the MCP tools do,
 *      and asserts the full 001→004 migration contract: tables, RLS flags,
 *      key policies, function signatures, grants and publication membership.
 *
 * Usage:
 *   npm run smoke
 *   SUPABASE_ACCESS_TOKEN=sbpat_xxx npm run smoke   # enables the SQL layer
 *
 * Exit code is non-zero if anything failed, so CI or a deploy pipeline can
 * gate on it.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------- env & args

const envFile = (() => {
  try { return readFileSync('.env.local', 'utf8') } catch { return '' }
})()
const fromEnvFile = (k) => envFile.match(new RegExp(`^${k}\\s*=\\s*(\\S+)`, 'm'))?.[1]

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || fromEnvFile('VITE_SUPABASE_URL')
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || fromEnvFile('VITE_SUPABASE_ANON_KEY')
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || fromEnvFile('SUPABASE_ACCESS_TOKEN')

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('smoke: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env.local (live mode required)')
  process.exit(1)
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]

const results = []
const pass = (what) => results.push({ ok: true, what })
const fail = (what, detail) => results.push({ ok: false, what, detail })

// ------------------------------------------------- the contract (migrations)

/** Tables every live project must have, with RLS on. (001/003/004) */
const CONTRACT_TABLES = [
  'organizations', 'profiles', 'memberships',
  'menu_categories', 'menu_items', 'restaurant_tables',
  'orders', 'order_items', 'service_requests', 'notifications', 'audit_logs',
  'order_number_counters',                    // 002/003
  'impersonation_sessions',                   // 004
]

/**
 * Tables that must NOT be readable by the anon key (003/004 revoked anon
 * access deliberately — operational metadata and platform security data). A
 * 200 here means those migrations were undone or superseded on the host.
 */
const ANON_FORBIDDEN_TABLES = ['order_number_counters', 'impersonation_sessions']

/** Policies the repo migrations create or replace by exact name. */
const CONTRACT_POLICIES = [
  { table: 'orders', policy: 'public_orders_insert' },                 // 001 guest insert
  { table: 'orders', policy: 'public_orders_pay' },                    // 001 guest bill settle
  { table: 'order_number_counters', policy: 'order_number_counters_select' }, // 003
  { table: 'impersonation_sessions', policy: 'impersonation_select' },  // 004
]

/** SECURITY DEFINER helpers the app calls through PostgREST rpc(). */
const CONTRACT_FUNCTIONS = [
  { name: 'next_order_number', args: 'org_id uuid', result: 'integer' },
  { name: 'rollback_order_number', args: 'p_org_id uuid', result: 'integer' }, // 003 changed void → integer
  { name: 'is_public_tenant', args: 'org uuid', result: 'boolean' },
  { name: 'begin_impersonation', args: 'p_organization_id uuid, p_reason text, p_ttl_minutes integer', result: 'jsonb' }, // 004 — note pg renders int as integer
  { name: 'end_impersonation', args: 'p_session_id uuid', result: 'jsonb' },   // 004
  { name: 'active_impersonation', args: '', result: 'jsonb' },                 // 004
]

/** Grants that define the guest/tenant boundary. */
const CONTRACT_GRANTS = [
  // 003/004: operational metadata is NOT guest-readable, only service_role.
  { grantee: 'anon', table: 'order_number_counters', mustHave: [], label: 'anon has NO privileges on order_number_counters (003)' },
  { grantee: 'anon', table: 'impersonation_sessions', mustHave: [], label: 'anon has NO privileges on impersonation_sessions (004)' },
  // Guests place and settle orders, nothing else.
  { grantee: 'anon', table: 'orders', mustHave: ['INSERT', 'UPDATE'], label: 'anon can INSERT and UPDATE orders (guest flow)' },
]

/** Tables the realtime layer depends on. */
const CONTRACT_PUBLICATION_TABLES = ['orders', 'restaurant_tables', 'service_requests', 'notifications']

/** The order-number trigger that stamps BF-#### on guest orders. */
const CONTRACT_TRIGGER = { table: 'orders', nameLike: 'number', label: 'order-number trigger attached to orders' }

// ------------------------------------------------------------- client checks

async function clientChecks() {
  const restHeaders = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }

  // REST up + every contract table exposed in the anon schema. Note this is an
  // *exposure* check: an empty page (or an RLS-filtered one) is fine, only a
  // PGRST205 "not in schema cache" means the table is missing/exposed-not.
  const notExposed = []
  const restErrors = []
  const leaked = []
  for (const table of CONTRACT_TABLES) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, { headers: restHeaders })
      if (res.status === 404) notExposed.push(table)
      else if (res.ok && ANON_FORBIDDEN_TABLES.includes(table)) leaked.push(table)
      else if (!res.ok && !ANON_FORBIDDEN_TABLES.includes(table)) restErrors.push(`${table}: HTTP ${res.status}`)
    } catch (e) {
      restErrors.push(`${table}: ${e.message}`)
    }
  }
  if (notExposed.length === 0 && restErrors.length === 0 && leaked.length === 0) {
    pass(`REST boundary correct: all ${CONTRACT_TABLES.length} tables exposed, anon blocked from ${ANON_FORBIDDEN_TABLES.length}`)
  } else {
    const detail = [
      ...notExposed.map((t) => `${t} not exposed`),
      ...leaked.map((t) => `${t} READABLE BY ANON (003/004 boundary lost)`),
      ...restErrors,
    ].join('; ')
    fail('REST exposure boundary matches migrations', detail)
  }

  // Auth service healthy.
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: ANON_KEY } })
    res.ok ? pass('auth service healthy') : fail('auth service healthy', `HTTP ${res.status}`)
  } catch (e) {
    fail('auth service healthy', e.message)
  }

  // Realtime socket + publication reachable (SUBSCRIBED means the socket, the
  // supabase_realtime publication and anon's access all line up; it does NOT
  // deliver anon order events — the probe covers that with a member session).
  await new Promise((resolve) => {
    const sb = createClient(SUPABASE_URL, ANON_KEY)
    const done = (ok, detail) => { ok ? pass('realtime channel subscribes on orders') : fail('realtime channel subscribes on orders', detail); sb.removeAllChannels(); resolve() }
    const timer = setTimeout(() => done(false, 'no SUBSCRIBED within 10s'), 10_000)
    sb.channel('smoke-' + Date.now())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {})
      .subscribe((status) => { if (status === 'SUBSCRIBED') { clearTimeout(timer); done(true) } })
  })
}

// ------------------------------------------------------- SQL contract checks

const sql = async (query) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`)
  return body
}

async function sqlChecks() {
  // 1. Tables exist.
  const tables = (await sql(
    `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
  )).map((r) => r.table_name)
  const missingTables = CONTRACT_TABLES.filter((t) => !tables.includes(t))
  missingTables.length === 0
    ? pass(`all ${CONTRACT_TABLES.length} contract tables exist`)
    : fail('contract tables exist', `missing: ${missingTables.join(', ')}`)

  // 2. RLS is enabled on every one of them (a table with data but RLS off is
  //    the single most dangerous drift: policies silently stop mattering).
  const noRls = (await sql(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname = any(${JSON.stringify(CONTRACT_TABLES)}::text[])
       and not c.relrowsecurity`,
  )).map((r) => r.relname)
  noRls.length === 0
    ? pass('RLS enabled on every contract table')
    : fail('RLS enabled on every contract table', `RLS off: ${noRls.join(', ')}`)

  // 3. Policies the migrations create by name.
  const policies = (await sql(
    `select tablename, policyname from pg_policies where schemaname = 'public'`,
  )).map((r) => `${r.tablename}.${r.policyname}`)
  const missingPolicies = CONTRACT_POLICIES
    .filter((p) => !policies.includes(`${p.table}.${p.policy}`))
    .map((p) => `${p.table}.${p.policy}`)
  missingPolicies.length === 0
    ? pass(`key policies present (${CONTRACT_POLICIES.length})`)
    : fail('key policies present', `missing: ${missingPolicies.join(', ')}`)

  // 4. Function signatures — catch drift like 003's void → integer change.
  const fns = (await sql(
    `select p.proname,
            pg_get_function_identity_arguments(p.oid) as args,
            pg_get_function_result(p.oid) as result
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'`,
  )).map((r) => `${r.proname}(${r.args}) -> ${r.result}`)
  const missingFns = CONTRACT_FUNCTIONS
    .filter((f) => !fns.includes(`${f.name}(${f.args}) -> ${f.result}`))
    .map((f) => `${f.name}(${f.args}) -> ${f.result}`)
  missingFns.length === 0
    ? pass(`SECURITY DEFINER helper signatures match (${CONTRACT_FUNCTIONS.length})`)
    : fail('helper function signatures match', `missing/different: ${missingFns.join('; ')}`)

  // 5. Grants — the boundary the migrations draw.
  const grants = await sql(
    `select grantee, table_name, privilege_type
       from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')`,
  )
  for (const g of CONTRACT_GRANTS) {
    const held = grants.filter((r) => r.grantee === g.grantee && r.table_name === g.table).map((r) => r.privilege_type)
    const ok = g.mustHave.length === 0 ? held.length === 0 : g.mustHave.every((p) => held.includes(p))
    ok ? pass(g.label) : fail(g.label, `held: [${held.join(', ') || 'none'}], expected: [${g.mustHave.join(', ')}]`)
  }

  // 6. Realtime publication membership.
  const pub = (await sql(
    `select tablename from pg_publication_tables where pubname = 'supabase_realtime'`,
  )).map((r) => r.tablename)
  const missingPub = CONTRACT_PUBLICATION_TABLES.filter((t) => !pub.includes(t))
  missingPub.length === 0
    ? pass(`supabase_realtime publication covers ${CONTRACT_PUBLICATION_TABLES.join(', ')}`)
    : fail('supabase_realtime publication covers the realtime tables', `missing: ${missingPub.join(', ')}`)

  // 7. Order-number trigger attached to orders.
  const triggers = (await sql(
    `select t.tgname from pg_trigger t
      where t.tgrelid = 'public.orders'::regclass and not t.tgisinternal
        and t.tgname ilike '%number%'`,
  )).map((r) => r.tgname)
  triggers.length > 0
    ? pass(CONTRACT_TRIGGER.label, `(${triggers.join(', ')})`)
    : fail(CONTRACT_TRIGGER.label, 'guest orders would get no BF-#### number')

  // 8. rollback_order_number must be service_role-only (003 hardening).
  const rollbackGrants = (await sql(
    `select grantee from information_schema.role_routine_grants
      where specific_schema = 'public' and routine_name = 'rollback_order_number'
        and grantee in ('anon', 'authenticated')`,
  ))
  rollbackGrants.length === 0
    ? pass('rollback_order_number not callable by anon/authenticated (003)')
    : fail('rollback_order_number not callable by anon/authenticated (003)', `granted to: ${rollbackGrants.map((r) => r.grantee).join(', ')}`)
}

// ------------------------------------------------------------------- runner

console.log(`smoke: project ${PROJECT_REF} (${SUPABASE_URL})\n`)

await clientChecks()

if (ACCESS_TOKEN) {
  try {
    await sqlChecks()
  } catch (e) {
    fail('SQL contract checks', e.message)
  }
} else {
  console.log('(set SUPABASE_ACCESS_TOKEN to enable SQL contract checks — https://supabase.com/dashboard/account/tokens)\n')
}

let failures = 0
for (const r of results) {
  if (!r.ok) failures++
  console.log(`${r.ok ? '  PASS' : '✗ FAIL'}  ${r.what}${r.detail ? ` — ${r.detail}` : ''}`)
}

console.log(`\nSMOKE VERDICT: ${failures === 0 ? 'PASS ✅' : `FAIL ❌ (${failures} failure${failures === 1 ? '' : 's'})`}`)
process.exit(failures === 0 ? 0 : 1)
