/**
 * Guards the specific regression that made `LoginPage` noisy: redirecting an
 * already-authenticated visitor by calling `navigate()` during render.
 *
 * This lives in its own file on purpose. React emits the render-phase-update
 * warning at most once per process, so any other test that exercises the same
 * redirect would consume it and leave this assertion passing vacuously. Vitest
 * gives each file a fresh module registry, so the warning is always live here.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui'
import { AppStoreProvider } from '@/store/AppStore'
import { LoginPage } from '@/pages/auth/LoginPage'
import { signIn, signOut } from '@/data/api'

const errors: string[] = []
const originalConsoleError = console.error

describe('LoginPage render-phase safety', () => {
  beforeAll(() => {
    // React resolves `console.error` at call time, so a plain reassignment
    // catches these warnings where `vi.spyOn` does not.
    console.error = (...args: unknown[]) => {
      errors.push(args.map((a) => String(a)).join(' '))
    }
  })

  afterAll(() => {
    console.error = originalConsoleError
  })

  it('does not update the router while rendering', async () => {
    await signIn('owner@urbanbean.test', 'demo1234')
    expect(errors).toEqual([])

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppStoreProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/app/dashboard" element={<div>dashboard-surface</div>} />
            </Routes>
          </ToastProvider>
        </AppStoreProvider>
      </MemoryRouter>,
    )

    // The redirect still has to happen — the fix moves *when* it runs, not whether.
    await screen.findByText('dashboard-surface')

    const renderPhaseUpdate = errors.find((e) =>
      /Cannot update a component|while rendering a different component/i.test(e),
    )
    expect(renderPhaseUpdate, `captured console.error:\n${errors.join('\n')}`).toBeUndefined()

    await signOut()
  })
})
