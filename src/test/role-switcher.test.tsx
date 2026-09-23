/**
 * The dashboard shell's role switcher must move between the seeded owner and
 * super-admin sessions with a single click — no sign-out, no clearing
 * `biteflow.session.v1`, no reload.
 *
 * These run against the real demo-mode `signIn()`, so they also guard the
 * assumption the switcher depends on: both demo accounts exist in the seed
 * dataset and land on the surface that matches their role. The live-mode
 * impersonation branch is covered by src/test/impersonation.test.tsx.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { ToastProvider } from '@/components/ui'
import { AppStoreProvider } from '@/store/AppStore'
import { MODE, getSession, signIn, signOut } from '@/data/api'

/** Mirrors the provider tree the shell is mounted in by src/App.tsx. */
function renderSwitcher(presentation: 'tabs' | 'menu' = 'tabs') {
  return render(
    <BrowserRouter>
      <AppStoreProvider>
        <ToastProvider>
          <RoleSwitcher presentation={presentation} />
        </ToastProvider>
      </AppStoreProvider>
    </BrowserRouter>,
  )
}

describe('RoleSwitcher (demo mode)', () => {
  beforeEach(async () => {
    await signOut()
  })

  it('offers both demo sessions and marks the active one', async () => {
    await signIn('owner@urbanbean.test', 'demo1234')
    renderSwitcher()

    const owner = await screen.findByRole('tab', { name: /owner/i })
    const admin = screen.getByRole('tab', { name: /admin/i })

    expect(owner).toHaveAttribute('aria-selected', 'true')
    expect(admin).toHaveAttribute('aria-selected', 'false')
  })

  it('switches to the super admin in one click', async () => {
    await signIn('owner@urbanbean.test', 'demo1234')
    renderSwitcher()

    screen.getByRole('tab', { name: /admin/i }).click()

    await waitFor(() => expect(getSession()?.user.email).toBe('admin@biteflow.com'))
    // The membership swap is what makes the /admin screens render real data.
    expect(getSession()?.memberships.some((m) => m.role === 'super_admin')).toBe(true)
  })

  it('switches back to the owner from the account-menu variant', async () => {
    await signIn('admin@biteflow.com', 'demo1234')
    renderSwitcher('menu')

    const ownerEntry = await screen.findByRole('button', { name: /restaurant owner/i })
    ownerEntry.click()

    await waitFor(() => expect(getSession()?.user.email).toBe('owner@urbanbean.test'))
    expect(getSession()?.memberships.some((m) => m.role === 'owner')).toBe(true)
  })

  it('exposes a labelled tab list in demo mode', async () => {
    // The switcher is a demo affordance: live mode has no guaranteed demo
    // accounts, so it renders nothing. That makes this suite's precondition the
    // absence of Supabase credentials — assert it loudly if that ever changes.
    expect(MODE).toBe('demo')
    await signIn('owner@urbanbean.test', 'demo1234')
    renderSwitcher()

    expect(await screen.findByRole('tablist', { name: /switch demo role/i })).toBeInTheDocument()
  })
})
