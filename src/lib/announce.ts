/**
 * Cross-route announcements for assistive technology.
 *
 * Anything mounted *inside* the router loses its live region the moment the user
 * navigates, so a role change — the exact moment the whole screen changes — would
 * be silent if the announcement lived in the dashboard shell: the switcher would
 * set its text and then unmount as the new route renders.
 *
 * So announcements go through this tiny store instead, and `LiveAnnouncer` (a
 * single `role="status"` region mounted once, above the router) renders whatever
 * arrives. A message emitted from a page that is about to unmount still lands.
 *
 * Vue/React apps commonly call this pattern "announce" / "toast for SR only".
 */

export interface Announcement {
  message: string
  /** Increments on every announce, so an identical repeat still reads as a change. */
  nonce: number
}

let current: Announcement = { message: '', nonce: 0 }
const listeners = new Set<() => void>()

/** Queue a polite announcement. Empty strings are ignored. */
export function announce(message: string): void {
  if (!message) return
  current = { message, nonce: current.nonce + 1 }
  listeners.forEach((listener) => listener())
}

export function subscribeAnnouncements(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAnnouncement(): Announcement {
  return current
}
