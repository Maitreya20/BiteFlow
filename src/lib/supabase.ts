/**
 * Supabase client bootstrap.
 *
 * The prototype runs in two modes:
 *   • "live" — VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY present. Reads/writes go
 *     through Postgres with RLS enforcing tenant isolation (prd.md §26).
 *   • "demo" — no credentials. The bundled dataset in `src/data/seed.ts` backs every
 *     screen so the golden-path demo (prd.md §30) runs with zero setup.
 *
 * Nothing outside `src/data/api.ts` branches on the mode.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const forceDemo = String(import.meta.env.VITE_DEMO_MODE ?? '').toLowerCase() === 'true'

// Treat placeholder/example values as "not configured" so a checked-in
// .env that wasn't filled in still falls back to demo mode cleanly.
const hasCredentials =
  Boolean(url && anonKey) &&
  !url!.includes('your-project-ref') &&
  !url!.includes('your-project-url') &&
  !anonKey!.includes('your-anon') &&
  anonKey!.length > 50

/** True when real Supabase credentials are wired up. */
export const isSupabaseConfigured = hasCredentials && !forceDemo

/**
 * Public QR/menu links need a base URL.
 *
 * A wrong value here is unusually costly: it is baked into every printed and
 * downloaded QR code, and the failure only shows up on someone else's phone. An
 * unedited `VITE_PUBLIC_SITE_URL` template therefore has to be treated as "not
 * configured" — exactly like the Supabase credential check above — instead of
 * being trusted and producing codes that point at a domain that does not exist.
 */
const ORIGIN_PLACEHOLDER = /your-public-domain|your-project-ref|your-project-url|example\.(com|org|net)|<[^>]*>/i
/** Origins that only resolve on the machine that produced them. */
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i

export const siteOrigin = (): string => {
  const configured = String(import.meta.env.VITE_PUBLIC_SITE_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
  const current = typeof window !== 'undefined' ? window.location.origin : ''
  const fallback = current || 'http://localhost:5173'

  if (!configured || ORIGIN_PLACEHOLDER.test(configured)) return fallback
  // A localhost value that survived into a deployed build is worse than no
  // value: the diner would be sent to their own device. Prefer where we are
  // actually being served from.
  if (LOCAL_ORIGIN.test(configured) && current && !LOCAL_ORIGIN.test(current)) return fallback
  return configured
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
      global: {
        headers: { 'x-application-name': 'biteflow-prototype' },
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, or leave VITE_DEMO_MODE=true.',
    )
  }
  return supabase
}

export type ConnectionState = 'live' | 'demo'

export const connectionState: ConnectionState = isSupabaseConfigured ? 'live' : 'demo'
