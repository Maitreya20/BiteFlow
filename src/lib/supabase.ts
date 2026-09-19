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

/** Public QR/menu links need a base URL; falls back to the current origin. */
export const siteOrigin = (): string =>
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')

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
