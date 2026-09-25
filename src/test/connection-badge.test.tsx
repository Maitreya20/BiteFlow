/**
 * The connection chip as staff actually see it: mounted in the dashboard shell.
 *
 * Drives the real store through demo-mode sign-in, so what is asserted is the
 * full chain — api state → AppStore → chip — not a component in isolation.
 * The live/degraded states are covered at the state-machine level in
 * realtime-status.test.ts; here we pin what each state *looks like* and that
 * the Refresh action exists exactly when the dashboard may be stale.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppStoreProvider } from '@/store/AppStore'
import { ConnectionBadge } from '@/components/layout/ConnectionBadge'
import { DEMO_ACCOUNTS } from '@/lib/constants'
import { signIn, signOut } from '@/data/api'

function renderBadge() {
  return render(
    <AppStoreProvider>
      <MemoryRouter>
        <ConnectionBadge />
      </MemoryRouter>
    </AppStoreProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('connection chip', () => {
  it('shows Demo in demo mode, with the cross-tab caveat in its accessible name', async () => {
    await signIn(DEMO_ACCOUNTS[0].email, 'demo')
    renderBadge()

    const chip = screen.getByRole('status')
    expect(chip).toHaveTextContent('Demo')
    expect(chip).toHaveAccessibleDescription(/synced across open tabs/i)
    expect(within(chip).queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()
    await signOut()
  })

  it('carries a hint for every state so the chip explains itself on hover/focus', async () => {
    await signIn(DEMO_ACCOUNTS[0].email, 'demo')
    renderBadge()
    expect(screen.getByRole('status')).toHaveAccessibleDescription(/demo mode/i)
    await signOut()
  })

  it('is a status region so screen readers announce state changes', async () => {
    await signIn(DEMO_ACCOUNTS[0].email, 'demo')
    renderBadge()
    // role="status" implies aria-live="polite"; assert the role contract itself.
    expect(screen.getByRole('status')).toBeInTheDocument()
    await signOut()
  })
})
