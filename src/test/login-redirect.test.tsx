/**
 * `LoginPage` bounces an already-authenticated visitor off `/login`, and it must
 * do so from an effect rather than during render.
 *
 * Calling `navigate()` while rendering makes React warn
 * "Cannot update a component (`BrowserRouter`) while rendering a different
 * component (`LoginPage`)" and risks dropping the navigation. The warning is
 * asserted separately in `login-render-phase.test.tsx` because React emits it
 * at most once per process — sharing a file with the behavioural tests here
 * would let whichever test runs first consume it.
 *
 * These run the real demo-mode `signIn()`, so they double as a guard that the
 * seeded accounts still authenticate.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui'
import { AppStoreProvider } from '@/store/AppStore'
import { LoginPage } from '@/pages/auth/LoginPage'
import { MODE, getSession, signIn, signOut } from '@/data/api'

/** Minimal stand-in for the surface `/login` redirects into. */
function DashboardProbe() {
  return <div>dashboard-surface</div>
}

function renderLoginAt(entry = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppStoreProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app/dashboard" element={<DashboardProbe />} />
          </Routes>
        </ToastProvider>
      </AppStoreProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage authenticated redirect', () => {
  beforeEach(async () => {
    // Demo mode is what makes the seeded credentials usable offline. Assert it
    // loudly rather than silently skipping if credentials ever get configured.
    expect(MODE).toBe('demo')
    await signOut()
  })

  afterEach(async () => {
    await signOut()
  })

  it('redirects a signed-in visitor away from /login', async () => {
    await signIn('owner@urbanbean.test', 'demo1234')
    expect(getSession()).not.toBeNull()

    renderLoginAt()

    expect(await screen.findByText('dashboard-surface')).toBeInTheDocument()
  })

  it('leaves a signed-out visitor on /login', async () => {
    renderLoginAt()

    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByText('dashboard-surface')).not.toBeInTheDocument()
  })
})
