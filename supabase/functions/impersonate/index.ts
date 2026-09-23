/**
 * `impersonate` — server-enforced super-admin impersonation.
 *
 * Why this exists as a function rather than a client call: `supabase.auth` binds
 * a session to one user. To view the tenant as its owner, the browser needs a
 * real session for that owner, and minting one requires the service role key —
 * which must never reach the browser. So the browser asks this function, and the
 * function decides whether it is allowed.
 *
 * What the client is trusted with: an organization id and a free-text reason.
 * Nothing else. In particular it can never supply the actor or the target user
 * id — the actor is read from the verified JWT, and the target is resolved by
 * `begin_impersonation()` from `memberships`.
 *
 * Order of operations matters:
 *   1. verify the JWT (who is calling),
 *   2. call `begin_impersonation()` *with the caller's token*, so Postgres
 *      re-checks the `super_admin` membership and writes the audit row — the
 *      function cannot be invoked by a non-admin even if this file were wrong,
 *   3. only then mint the target's session with the service role.
 *
 * If step 3 fails the recorded session is closed again, so the audit trail never
 * claims an impersonation that never started.
 *
 * Deploy: `supabase functions deploy impersonate`
 */

import { serve } from 'https://deno.land/std@0.202.0/http/server'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const MAX_TTL_MINUTES = 240

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: CORS_HEADERS })

/** Postgres raises our authorization guards as 42501 (insufficient_privilege). */
const isForbidden = (error: { message?: string; code?: string } | null): boolean =>
  Boolean(error) && (error!.code === '42501' || /not a platform super admin|authentication required/i.test(error!.message ?? ''))

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Missing bearer token' }, 401)
  }

  let body: { organization_id?: string; reason?: string; ttl_minutes?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const organizationId = body.organization_id
  if (!organizationId) {
    return json({ error: 'organization_id is required' }, 400)
  }

  const ttlMinutes = Math.min(Math.max(Number(body.ttl_minutes) || 30, 1), MAX_TTL_MINUTES)

  // Caller-scoped client: every request runs as the caller, so `auth.uid()`
  // inside Postgres is their real identity.
  const asCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })

  const { data: userData, error: userError } = await asCaller.auth.getUser()
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401)
  }

  // --- step 2: authorization + audit, decided by the database ----------------
  const { data: started, error: beginError } = await asCaller.rpc('begin_impersonation', {
    p_organization_id: organizationId,
    p_reason: (body.reason ?? '').slice(0, 500),
    p_ttl_minutes: ttlMinutes,
  })

  if (beginError) {
    return json(
      { error: isForbidden(beginError) ? 'Not permitted' : beginError.message },
      isForbidden(beginError) ? 403 : 400,
    )
  }

  const session = started as {
    id: string
    actor_user_id: string
    target_user_id: string
    target_email: string
    target_organization_id: string
    expires_at: string
  }

  // --- step 3: mint a session for the target, service role only -------------
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  /** Close the audit row we just opened, so the log never overstates access. */
  const abandon = async (reason: string) => {
    await admin
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString(), ended_by: null })
      .eq('id', session.id)
      .is('ended_at', null)
    return json({ error: reason }, 502)
  }

  if (!session.target_email) {
    return await abandon('Target account has no email on record')
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: session.target_email,
  })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) {
    return await abandon(linkError?.message ?? 'Could not mint an impersonation link')
  }

  const { data: minted, error: mintError } = await admin.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (mintError || !minted.session) {
    return await abandon(mintError?.message ?? 'Could not mint an impersonation session')
  }

  // Only the tokens the caller needs to stand in for the target. The session row
  // id is returned so the client can end it precisely.
  return json({
    impersonation: {
      id: session.id,
      organization_id: session.target_organization_id,
      target_user_id: session.target_user_id,
      target_email: session.target_email,
      expires_at: session.expires_at,
    },
    session: {
      access_token: minted.session.access_token,
      refresh_token: minted.session.refresh_token,
    },
  })
})
