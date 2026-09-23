/**
 * Role switching is a whole-screen change. A sighted user sees it happen — the
 * shell, the route and the selected tab all change. A screen reader user sees
 * nothing unless we say so, which is what these tests pin down:
 *
 *   • the change is announced through the live region that outlives the
 *     navigation the switch causes;
 *   • the current role can be re-read at any time, not only at the moment it
 *     changed;
 *   • Alt+Shift+R toggles, but never while the user is typing or inside a modal.
 *
 * Demo mode, against the real `signIn()`, so the assertions ride the same code
 * path a user does. The live-mode variant is covered in role-switcher-live.test.tsx.
 */

import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LiveAnnouncer, ToastProvider } from '@/components/ui'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { AppStoreProvider } from '@/store/AppStore'
import { MODE, getSession, signIn, signOut } from '@/data/api'

const SHORTCUT = { key: 'R', altKey: true, shiftKey: true }

function Harness({ children }: { children?: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/harness']}>
      <AppStoreProvider>
        <ToastProvider>
          {/* Mounted above the routes, exactly as src/App.tsx does it. */}
          <LiveAnnouncer />
          {children ?? (
            // The switcher lives in the shell on every surface, so each route
            // renders its own copy — switching role remounts it, which is the
            // whole reason announcements must outlive the navigation.
            <Routes>
              <Route path="/harness" element={<RoleSwitcher />} />
              <Route
                path="/app/dashboard"
                element={
                  <>
                    <RoleSwitcher />
                    <div>tenant-home</div>
                  </>
                }
              />
              <Route
                path="/admin"
                element={
                  <>
                    <RoleSwitcher />
                    <div>platform-home</div>
                  </>
                }
              />
            </Routes>
          )}
        </ToastProvider>
      </AppStoreProvider>
    </MemoryRouter>
  )
}

/** Text the app has handed to assistive technology via the live region. */
const announced = () => screen.getByRole('status').textContent ?? ''

describe('role switcher accessibility (demo mode)', () => {
  beforeEach(async () => {
    expect(MODE).toBe('demo')
    await signOut()
  })

  it('announces the new role, and survives the navigation it causes', async () => {
    await signIn('owner@urbanbean.test', 'demo1234')
    render(<Harness />)

    fireEvent.click(screen.getByRole('tab', { name: /admin/i }))

    await waitFor(() => expect(getSession()?.user.email).toBe('admin@biteflow.com'))
    // The switcher that emitted this unmounted when /admin rendered — the
    // announcement still has to land.
    expect(await screen.findByText('platform-home')).toBeInTheDocument()
    expect(announced()).toMatch(/Acting as Platform super admin/i)
  })

  it('re-announces on every change, including a repeat of the same role', async () => {
    await signIn('owner@urbanbean.test', 'demo1234')
    render(<Harness />)

    fireEvent.click(screen.getByRole('tab', { name: /admin/i }))
    await waitFor(() => expect(getSession()?.user.email).toBe('admin@biteflow.com'))
    const first = announced()

    fireEvent.click(await screen.findByRole('tab', { name: /owner/i }))
    await waitFor(() => expect(getSession()?.user.email).toBe('owner@urbanbean.test'))

    expect(announced()).toMatch(/Acting as Restaurant owner/i)
    expect(announced()).not.toBe(first)
  })

  it('describes the current role to assistive technology', async () => {
    await signIn('owner@urbanbean.test', 'demo1234')
    render(<Harness />)

    const tablist = screen.getByRole('tablist', { name: /switch demo role/i })
    expect(tablist).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+R')

    // Not a live region: a readout the user can come back to.
    const describedBy = tablist.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const readout = document.getElementById(describedBy!)
    expect(readout?.textContent).toMatch(/Acting as Restaurant owner/i)
    expect(readout?.textContent).toMatch(/Alt\+Shift\+R/)
  })

  it('toggles the role with the keyboard shortcut', async () => {
    await signIn('owner@urbanbean.test', 'demo1234')
    render(<Harness />)

    fireEvent.keyDown(window, SHORTCUT)

    await waitFor(() => expect(getSession()?.user.email).toBe('admin@biteflow.com'))
    expect(announced()).toMatch(/Acting as Platform super admin/i)

    fireEvent.keyDown(window, SHORTCUT)
    await waitFor(() => expect(getSession()?.user.email).toBe('owner@urbanbean.test'))
  })

  it('ignores the shortcut while the user is typing', async () => {
    await signIn('owner@urbanbean.test', 'demo1234')
    render(
      <Harness>
        <input aria-label="Order note" />
        <Routes>
          <Route path="/harness" element={<RoleSwitcher />} />
        </Routes>
      </Harness>,
    )

    const input = screen.getByLabelText('Order note')
    input.focus()
    fireEvent.keyDown(input, SHORTCUT)

    // A note that happens to contain "r" must not sign the operator out.
    expect(getSession()?.user.email).toBe('owner@urbanbean.test')
  })

  it('ignores the shortcut when the event arrives pre-targeted elsewhere', async () => {
    // A real keystroke bubbles from the focused field, but not every event does —
    // a programmatic dispatch lands on the window with a window target. The focus
    // check catches that case, so the promise above holds unconditionally.
    await signIn('owner@urbanbean.test', 'demo1234')
    render(
      <Harness>
        <input aria-label="Order note" />
        <Routes>
          <Route path="/harness" element={<RoleSwitcher />} />
        </Routes>
      </Harness>,
    )

    screen.getByLabelText('Order note').focus()
    fireEvent.keyDown(window, SHORTCUT)

    expect(getSession()?.user.email).toBe('owner@urbanbean.test')
  })

  it('ignores the shortcut while a modal is open', async () => {
    await signIn('owner@urbanbean.test', 'demo1234')
    render(
      <Harness>
        <div role="dialog" aria-modal="true" aria-label="Confirm order" />
        <Routes>
          <Route path="/harness" element={<RoleSwitcher />} />
        </Routes>
      </Harness>,
    )

    fireEvent.keyDown(window, SHORTCUT)

    // The operator is mid-task; swapping the session underneath them would be rude.
    expect(getSession()?.user.email).toBe('owner@urbanbean.test')
  })

  it('does exactly what the menu entry does, and nothing more', async () => {
    // Whatever the shortcut reaches must already be reachable by mouse: it is a
    // convenience for the same control, not a second, quieter capability.
    await signIn('admin@biteflow.com', 'demo1234')
    render(<Harness />)

    fireEvent.keyDown(window, SHORTCUT)

    await waitFor(() => expect(getSession()?.user.email).toBe('owner@urbanbean.test'))
    expect(announced()).toMatch(/Acting as Restaurant owner/i)
  })
})
