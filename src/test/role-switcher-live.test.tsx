/**
 * `RoleSwitcher` in live mode.
 *
 * The store is mocked so the component can be driven through the three states a
 * super admin actually passes through — eligible, impersonating, and not
 * eligible — without a Supabase project. What matters here is the affordance:
 * the control appears only for a platform super admin, entering a tenant calls
 * the impersonation API with that tenant, and the way out is always visible
 * while standing in for someone else.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LiveAnnouncer, ToastProvider } from '@/components/ui'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'

const store = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('@/store/AppStore', () => ({ useAppStore: () => store.value }))

const ORGANIZATIONS = [
  { id: 'org-b', name: 'Blue Bottle' },
  { id: 'org-a', name: 'Urban Bean' },
]

const startImpersonation = vi.fn(async (_organizationId: string, _reason?: string) => {})
const endImpersonation = vi.fn(async () => {})

function setStore(overrides: Record<string, unknown> = {}) {
  store.value = {
    session: { user: { email: 'admin@biteflow.com' }, memberships: [], activeOrganizationId: '' },
    mode: 'live',
    db: { organizations: ORGANIZATIONS },
    impersonation: null,
    canImpersonate: true,
    startImpersonation,
    endImpersonation,
    ...overrides,
  }
}

function renderSwitcher(presentation: 'tabs' | 'menu' = 'tabs') {
  return render(
    <MemoryRouter initialEntries={['/harness']}>
      <ToastProvider>
        <LiveAnnouncer />
        <Routes>
          {/* The switcher lives on its own path: a `*` route would lose to the
              more specific probe routes below. */}
          <Route path="/harness" element={<RoleSwitcher presentation={presentation} />} />
          <Route path="/app/dashboard" element={<div>tenant-home</div>} />
          <Route path="/admin" element={<div>platform-home</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('RoleSwitcher (live mode)', () => {
  beforeEach(() => {
    startImpersonation.mockClear()
    endImpersonation.mockClear()
    setStore()
  })

  it('offers every tenant to a super admin and enters the chosen one', async () => {
    renderSwitcher()

    const picker = screen.getByLabelText(/impersonate tenant/i) as HTMLSelectElement
    // Sorted by name, so the platform list is stable no matter how RLS returns it.
    expect([...picker.options].slice(1).map((option) => option.text)).toEqual([
      'Blue Bottle',
      'Urban Bean',
    ])

    fireEvent.change(picker, { target: { value: 'org-a' } })

    await waitFor(() => expect(startImpersonation).toHaveBeenCalledTimes(1))
    expect(startImpersonation.mock.calls[0][0]).toBe('org-a')
    // A reason is always recorded on the audit row.
    expect(typeof startImpersonation.mock.calls[0][1]).toBe('string')
    expect(await screen.findByText('tenant-home')).toBeInTheDocument()
  })

  it('replaces the picker with an exit control while impersonating', async () => {
    setStore({
      impersonation: {
        id: 'imp-1',
        organizationId: 'org-a',
        organizationName: 'Urban Bean',
        targetEmail: 'owner@urbanbean.test',
        targetUserId: 'owner-1',
        reason: '',
        startedAt: '2026-09-22T12:00:00.000Z',
        expiresAt: '2026-09-22T12:30:00.000Z',
      },
    })
    renderSwitcher()

    expect(screen.queryByLabelText(/impersonate tenant/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /exit impersonation/i }))

    await waitFor(() => expect(endImpersonation).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('platform-home')).toBeInTheDocument()
  })

  it('names the tenant and the stand-in account in the account menu', () => {
    setStore({
      impersonation: {
        id: 'imp-1',
        organizationId: 'org-a',
        organizationName: 'Urban Bean',
        targetEmail: 'owner@urbanbean.test',
        targetUserId: 'owner-1',
        reason: '',
        startedAt: '2026-09-22T12:00:00.000Z',
        expiresAt: '2026-09-22T12:30:00.000Z',
      },
    })
    renderSwitcher('menu')

    expect(screen.getByText(/Urban Bean · owner@urbanbean.test/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /exit impersonation/i })).toBeInTheDocument()
  })

  it('lists tenants in the account menu for a super admin who is not impersonating', () => {
    renderSwitcher('menu')

    expect(screen.getByText('Impersonate tenant')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Urban Bean/ })).toBeInTheDocument()
  })

  it('announces entering a tenant, so the screen change is not silent', async () => {
    renderSwitcher()
    fireEvent.change(screen.getByLabelText(/impersonate tenant/i), { target: { value: 'org-a' } })

    await waitFor(() => expect(startImpersonation).toHaveBeenCalled())
    const spoken = screen.getByRole('status').textContent ?? ''
    expect(spoken).toMatch(/Impersonating Urban Bean/i)
    expect(spoken).toMatch(/Alt\+Shift\+R/)
  })

  it('exits the tenant with the keyboard shortcut, and advertises it', async () => {
    setStore({
      impersonation: {
        id: 'imp-1',
        organizationId: 'org-a',
        organizationName: 'Urban Bean',
        targetEmail: 'owner@urbanbean.test',
        targetUserId: 'owner-1',
        reason: '',
        startedAt: '2026-09-22T12:00:00.000Z',
        expiresAt: '2026-09-22T12:30:00.000Z',
      },
    })
    renderSwitcher()

    const exitButton = screen.getByRole('button', { name: /exit impersonation/i })
    expect(exitButton).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+R')

    fireEvent.keyDown(window, { key: 'R', altKey: true, shiftKey: true })
    await waitFor(() => expect(endImpersonation).toHaveBeenCalledTimes(1))
  })

  it('stays inert for a super admin who has not picked a tenant', async () => {
    // Entering a tenant needs a tenant choice, so there is no "the other role"
    // the shortcut could mean. It must not guess.
    renderSwitcher()

    fireEvent.keyDown(window, { key: 'R', altKey: true, shiftKey: true })

    expect(startImpersonation).not.toHaveBeenCalled()
    expect(endImpersonation).not.toHaveBeenCalled()
  })

  it('renders nothing for a live session that is not a platform super admin', () => {
    setStore({
      canImpersonate: false,
      session: { user: { email: 'owner@urbanbean.test' }, memberships: [], activeOrganizationId: 'org-a' },
    })
    renderSwitcher()

    // Nothing to click: no tenant picker, no demo tabs, no impersonation entry.
    expect(screen.queryByLabelText(/impersonate tenant/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByText(/impersonate tenant/i)).not.toBeInTheDocument()
    expect(startImpersonation).not.toHaveBeenCalled()
  })
})
