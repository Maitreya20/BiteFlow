/**
 * The app's single persistent screen-reader live region.
 *
 * Mounted once, above the router (see src/App.tsx), so a message emitted from a
 * page that is about to unmount — switching role navigates to a different shell —
 * is still announced. Uses the shared store in src/lib/announce.ts.
 *
 * Visually hidden: it exists for assistive technology, not for the eye. Visible
 * feedback for the same events is the selected tab, the impersonation banner and
 * the route itself.
 */

import { useSyncExternalStore } from 'react'
import { getAnnouncement, subscribeAnnouncements } from '@/lib/announce'

export function LiveAnnouncer() {
  const { message, nonce } = useSyncExternalStore(
    subscribeAnnouncements,
    getAnnouncement,
    getAnnouncement,
  )

  // A trailing zero-width space flips with every announcement, so repeating the
  // same string twice is still a DOM change that screen readers pick up.
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
      {nonce % 2 === 0 ? '' : '\u200B'}
    </div>
  )
}
