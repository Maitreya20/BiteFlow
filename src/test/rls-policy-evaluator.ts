/**
 * A minimal reader/evaluator for the row level security policies that live in
 * `supabase/schema.sql`.
 *
 * Why this exists: the `/admin` platform screens are guarded on the client by
 * session role alone, which is cosmetic. The authoritative boundary is Postgres
 * RLS. `src/test/rls.test.ts` uses this module to read the *actual* policies and
 * helper functions out of the SQL source and evaluate those predicates against a
 * multi-tenant fixture, so schema drift breaks `npm test` without needing a
 * database.
 *
 * Scope is deliberately tiny — exactly the predicate grammar the BiteFlow
 * policies use:
 *
 *   and / or / not, parentheses, `=` and `<>`, `is [not] null`,
 *   bare boolean columns, and the three `security definer` helpers
 *   (`is_org_member`, `is_super_admin`, `is_public_tenant`).
 *
 * Anything outside that grammar throws loudly instead of guessing, so a policy
 * edit that this reader cannot understand fails the test rather than silently
 * passing.
 */

export type SqlValue = string | number | boolean | null

export interface Policy {
  name: string
  table: string
  /** select | insert | update | delete | all */
  command: string
  /** Roles in a `to ...` clause, or null when the policy applies to public. */
  roles: string[] | null
  using: string | null
  withCheck: string | null
}

export interface Dataset {
  memberships: Array<{ organization_id: string; user_id: string; role: string; status: string }>
  organizations: Array<{ id: string; subscription_status: string }>
}

export interface PolicyContext {
  role: 'anon' | 'authenticated'
  /** auth.uid() — null for anon. */
  uid: string | null
  data: Dataset
}

export type Row = Record<string, SqlValue>

/* ------------------------------------------------------------------ parsing */

/** Removes `--` line comments and block comments so they cannot confuse the scanner. */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

/** Reads a balanced `(...)` group starting at `openIndex`, respecting quoted strings. */
function readBalanced(text: string, openIndex: number): { body: string; end: number } {
  let depth = 0
  let inString = false

  for (let i = openIndex; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (char === "'") inString = false
      continue
    }
    if (char === "'") {
      inString = true
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth === 0) return { body: text.slice(openIndex + 1, i), end: i }
    }
  }

  throw new Error('Unbalanced parentheses in SQL fragment')
}

/** Returns the text of a statement up to its top-level terminating semicolon. */
function readStatementBody(text: string): string {
  let depth = 0
  let inString = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (char === "'") inString = false
      continue
    }
    if (char === "'") {
      inString = true
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    else if (char === ';' && depth === 0) return text.slice(0, i)
  }

  return text
}

function extractClause(body: string, keyword: RegExp): string | null {
  const match = keyword.exec(body)
  if (!match) return null
  const rest = body.slice(match.index + match[0].length)
  const open = rest.indexOf('(')
  if (open === -1) return null
  return readBalanced(rest, open).body.trim()
}

function buildPolicy(name: string, table: string, body: string): Policy {
  const command = /for\s+(select|insert|update|delete|all)/i.exec(body)?.[1]?.toLowerCase() ?? 'all'
  const roleClause = /\bto\s+([a-z_][a-z0-9_]*(\s*,\s*[a-z_][a-z0-9_]*)*)/i.exec(body)

  return {
    name,
    table,
    command,
    roles: roleClause
      ? roleClause[1]
          .split(',')
          .map((role) => role.trim().toLowerCase())
          .filter(Boolean)
      : null,
    using: extractClause(body, /\busing\b/i),
    withCheck: extractClause(body, /\bwith\s+check\b/i),
  }
}

/**
 * Extracts every `create policy <name> on public.<table> ...` statement.
 *
 * Policies built inside a `format()` template in a `do $$ ... $$` block (the
 * per-tenant operational tables) are skipped naturally: their names are `%I`,
 * which the pattern below will not match. Those tables are covered by the pgTAP
 * test that runs against a live database.
 */
export function extractPolicies(sql: string): Policy[] {
  const source = stripSqlComments(sql)
  const policies: Policy[] = []
  const pattern = /create\s+policy\s+([A-Za-z_][A-Za-z0-9_]*)\s+on\s+public\.([A-Za-z_][A-Za-z0-9_]*)/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source)) !== null) {
    const body = readStatementBody(source.slice(pattern.lastIndex))
    policies.push(buildPolicy(match[1], match[2], body))
  }

  return policies
}

/** Tables with `alter table public.<table> enable row level security;`. */
export function extractRlsTables(sql: string): Set<string> {
  const source = stripSqlComments(sql)
  const tables = new Set<string>()
  const pattern = /alter\s+table\s+public\.([A-Za-z_][A-Za-z0-9_]*)\s+enable\s+row\s+level\s+security/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source)) !== null) tables.add(match[1])

  return tables
}

/** Returns the body of `create or replace function public.<name>(...) ... $$ ... $$;`. */
export function extractFunctionBody(sql: string, name: string): string {
  const source = stripSqlComments(sql)
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([^)]*\\)[\\s\\S]*?as\\s*\\$\\$([\\s\\S]*?)\\$\\$`,
    'i',
  )
  const match = pattern.exec(source)
  if (!match) throw new Error(`Could not find function public.${name}() in the SQL source`)
  return match[1]
}

/* --------------------------------------------------------------- expression */

interface Token {
  type: 'ident' | 'string' | 'number' | 'punct'
  value: string
}

const TWO_CHAR_OPERATORS = new Set(['<>', '!=', '<=', '>='])

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const char = input[i]

    if (/\s/.test(char)) {
      i += 1
      continue
    }

    if (char === "'") {
      let j = i + 1
      let value = ''
      while (j < input.length) {
        if (input[j] === "'" && input[j + 1] === "'") {
          value += "'"
          j += 2
          continue
        }
        if (input[j] === "'") break
        value += input[j]
        j += 1
      }
      tokens.push({ type: 'string', value })
      i = j + 1
      continue
    }

    if (/[0-9]/.test(char)) {
      let j = i
      while (j < input.length && /[0-9.]/.test(input[j])) j += 1
      tokens.push({ type: 'number', value: input.slice(i, j) })
      i = j
      continue
    }

    if (/[A-Za-z_]/.test(char)) {
      let j = i
      while (j < input.length && /[A-Za-z0-9_.]/.test(input[j])) j += 1
      tokens.push({ type: 'ident', value: input.slice(i, j) })
      i = j
      continue
    }

    const two = input.slice(i, i + 2)
    if (TWO_CHAR_OPERATORS.has(two)) {
      tokens.push({ type: 'punct', value: two })
      i += 2
      continue
    }

    if ('(),=<>'.includes(char)) {
      tokens.push({ type: 'punct', value: char })
      i += 1
      continue
    }

    throw new Error(`Unsupported character ${JSON.stringify(char)} in RLS predicate: ${input}`)
  }

  return tokens
}

type Operand =
  | { kind: 'column'; name: string }
  | { kind: 'literal'; value: SqlValue }
  | { kind: 'uid' }
  | { kind: 'helper'; name: string; arg: Operand | null }

type Node =
  | { kind: 'or'; left: Node; right: Node }
  | { kind: 'and'; left: Node; right: Node }
  | { kind: 'not'; expr: Node }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'column'; name: string }
  | { kind: 'helper'; name: string; arg: Operand | null }
  | { kind: 'compare'; left: Operand; op: '=' | '<>'; right: Operand }
  | { kind: 'isNull'; operand: Operand; negated: boolean }

const BOOLEAN_HELPERS = ['is_super_admin', 'is_org_member', 'is_public_tenant']

/** Parses a policy `using`/`with check` predicate into an AST. Throws on anything unexpected. */
export function parsePredicate(expr: string): Node {
  const tokens = tokenize(expr)
  let pos = 0

  const peek = (): Token | undefined => tokens[pos]
  const advance = (): Token | undefined => tokens[pos++]
  const isPunct = (value: string): boolean => {
    const token = peek()
    return Boolean(token && token.type === 'punct' && token.value === value)
  }
  const isKeyword = (value: string): boolean => {
    const token = peek()
    return Boolean(token && token.type === 'ident' && token.value.toLowerCase() === value)
  }
  const expect = (value: string): void => {
    if (!isPunct(value)) {
      throw new Error(`Expected ${value} but found ${JSON.stringify(peek()?.value)} in: ${expr}`)
    }
    advance()
  }

  function parseOr(): Node {
    let node = parseAnd()
    while (isKeyword('or')) {
      advance()
      node = { kind: 'or', left: node, right: parseAnd() }
    }
    return node
  }

  function parseAnd(): Node {
    let node = parseNot()
    while (isKeyword('and')) {
      advance()
      node = { kind: 'and', left: node, right: parseNot() }
    }
    return node
  }

  function parseNot(): Node {
    if (isKeyword('not')) {
      advance()
      return { kind: 'not', expr: parseNot() }
    }
    return parsePrimary()
  }

  function parsePrimary(): Node {
    if (isPunct('(')) {
      advance()
      const node = parseOr()
      expect(')')
      return node
    }
    return parseAtom()
  }

  function parseAtom(): Node {
    const left = parseOperand()

    if (isKeyword('is')) {
      advance()
      let negated = false
      if (isKeyword('not')) {
        advance()
        negated = true
      }
      if (!isKeyword('null')) throw new Error(`Expected "null" after "is" in: ${expr}`)
      advance()
      return { kind: 'isNull', operand: left, negated }
    }

    const token = peek()
    if (token && token.type === 'punct' && (token.value === '=' || token.value === '<>' || token.value === '!=')) {
      advance()
      return {
        kind: 'compare',
        left,
        op: token.value === '=' ? '=' : '<>',
        right: parseOperand(),
      }
    }

    if (left.kind === 'literal') {
      if (typeof left.value === 'boolean') return { kind: 'boolean', value: left.value }
      throw new Error(`Bare non-boolean literal in predicate: ${expr}`)
    }
    if (left.kind === 'column') return { kind: 'column', name: left.name }
    if (left.kind === 'helper') return { kind: 'helper', name: left.name, arg: left.arg }

    throw new Error(`Unsupported bare operand in predicate: ${expr}`)
  }

  function parseOperand(): Operand {
    const token = advance()
    if (!token) throw new Error(`Unexpected end of RLS predicate: ${expr}`)

    if (token.type === 'string') return { kind: 'literal', value: token.value }
    if (token.type === 'number') return { kind: 'literal', value: Number(token.value) }

    if (token.type === 'punct') {
      throw new Error(`Unexpected ${token.value} in RLS predicate: ${expr}`)
    }

    const name = token.value.toLowerCase().replace(/^public\./, '')

    if (isPunct('(')) {
      advance()
      let arg: Operand | null = null
      if (!isPunct(')')) arg = parseOperand()
      expect(')')
      if (name === 'auth.uid') return { kind: 'uid' }
      if (BOOLEAN_HELPERS.includes(name)) return { kind: 'helper', name, arg }
      throw new Error(`Unknown function ${name}() in RLS predicate: ${expr}`)
    }

    if (name === 'true') return { kind: 'literal', value: true }
    if (name === 'false') return { kind: 'literal', value: false }
    if (name === 'null') return { kind: 'literal', value: null }

    return { kind: 'column', name }
  }

  const root = parseOr()
  if (pos !== tokens.length) {
    throw new Error(`Unexpected trailing tokens in RLS predicate: ${expr}`)
  }
  return root
}

/* -------------------------------------------------------------- evaluation */

function resolveOperand(operand: Operand, row: Row, context: PolicyContext): SqlValue {
  switch (operand.kind) {
    case 'column':
      return row[operand.name] ?? null
    case 'literal':
      return operand.value
    case 'uid':
      return context.uid
    case 'helper':
      return evaluateHelper(operand.name, operand.arg, row, context)
  }
}

/**
 * Mirrors the three `security definer` helpers. The structural test in
 * rls.test.ts asserts the SQL bodies really do implement these semantics, so the
 * two cannot drift apart silently.
 */
function evaluateHelper(name: string, arg: Operand | null, row: Row, context: PolicyContext): boolean {
  const { memberships, organizations } = context.data

  switch (name) {
    case 'is_super_admin':
      return (
        context.uid !== null &&
        memberships.some((m) => m.user_id === context.uid && m.role === 'super_admin' && m.status === 'active')
      )

    case 'is_org_member': {
      const org = arg ? resolveOperand(arg, row, context) : null
      return (
        context.uid !== null &&
        typeof org === 'string' &&
        memberships.some(
          (m) => m.organization_id === org && m.user_id === context.uid && m.status === 'active',
        )
      )
    }

    case 'is_public_tenant': {
      const org = arg ? resolveOperand(arg, row, context) : null
      return (
        typeof org === 'string' &&
        organizations.some(
          (o) => o.id === org && (o.subscription_status === 'active' || o.subscription_status === 'trialing'),
        )
      )
    }

    default:
      throw new Error(`Unknown RLS helper ${name}()`)
  }
}

export function evaluatePredicate(node: Node, row: Row, context: PolicyContext): boolean {
  switch (node.kind) {
    case 'or':
      return evaluatePredicate(node.left, row, context) || evaluatePredicate(node.right, row, context)
    case 'and':
      return evaluatePredicate(node.left, row, context) && evaluatePredicate(node.right, row, context)
    case 'not':
      return !evaluatePredicate(node.expr, row, context)
    case 'boolean':
      return node.value
    case 'column':
      return Boolean(row[node.name])
    case 'helper':
      return evaluateHelper(node.name, node.arg, row, context)
    case 'isNull': {
      const value = resolveOperand(node.operand, row, context)
      const isNull = value === null || value === undefined
      return node.negated ? !isNull : isNull
    }
    case 'compare': {
      const left = resolveOperand(node.left, row, context)
      const right = resolveOperand(node.right, row, context)
      // SQL treats a comparison against NULL as NULL, which does not satisfy a
      // policy. Model that as false so anon (auth.uid() = null) is denied.
      if (left === null || right === null || left === undefined || right === undefined) return false
      return node.op === '=' ? left === right : left !== right
    }
  }
}

/** True when a policy applies to the given command + caller role. */
export function policyAppliesTo(policy: Policy, command: string, role: 'anon' | 'authenticated'): boolean {
  if (!(policy.command === 'all' || policy.command === command)) return false
  // No `to` clause means the policy is FOR PUBLIC / ALL, which includes anon.
  if (!policy.roles) return true
  return policy.roles.includes(role)
}

/**
 * Postgres semantics: with RLS enabled and no applicable policy, every row is
 * denied. Otherwise a row is visible when at least one applicable SELECT policy
 * passes (policies are OR-ed).
 */
export function isRowVisible(policies: Policy[], row: Row, context: PolicyContext): boolean {
  const applicable = policies.filter(
    (policy) => policyAppliesTo(policy, 'select', context.role) && policy.using !== null,
  )
  if (applicable.length === 0) return false
  return applicable.some((policy) => evaluatePredicate(parsePredicate(policy.using as string), row, context))
}

/** Convenience: the row keys a caller can see in a table given the policies and fixture rows. */
export function visibleKeys(
  policies: Policy[],
  rows: Row[],
  context: PolicyContext,
  key = 'id',
): string[] {
  return rows.filter((row) => isRowVisible(policies, row, context)).map((row) => String(row[key]))
}
