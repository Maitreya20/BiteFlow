/**
 * Guest (QR) route helpers.
 *
 * A table QR code encodes `/r/:slug/table/:tableNumber`. That shape has to be
 * agreed on by three places — the printed/downloaded link, the router, and the
 * in-app navigation that follows a scan — so it lives here rather than being
 * rebuilt as a template string at each call site. A QR code that points at a
 * path no route matches is the worst kind of bug: the code scans fine and the
 * diner lands on the marketing site.
 */
import { siteOrigin } from '@/lib/supabase'

/** `/r/<slug>` — the restaurant plus the table the diner is sitting at, if known. */
export function publicBase(slug: string, tableNumber?: string | null): string {
  const table = tableNumber?.trim()
  return table ? `/r/${slug}/table/${table}` : `/r/${slug}`
}

/**
 * Absolute URL to encode in a table's QR code. The table number is lowercased
 * because `resolvePublicContext` matches case-insensitively, and a stable
 * casing keeps one printed code per table rather than several confusing ones.
 */
export function guestTableUrl(slug: string, tableNumber: string, origin = siteOrigin()): string {
  // A trailing slash on the configured site URL would produce `//r/...`, which
  // some hosts (and the router) treat as a different path.
  const base = origin.replace(/\/+$/, '')
  return `${base}${publicBase(slug, tableNumber.trim().toLowerCase())}`
}
