import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from '@/App'

/**
 * A scanned table QR code is just a URL, and the whole feature is broken if that
 * URL does not match a route. It previously did not: `/r/:slug/table/:tableNumber`
 * fell through to the `*` catch-all, so a diner who scanned the code on the table
 * landed on the marketing home page. Nothing in the app surfaced an error — the
 * code "worked" and the guest saw the wrong thing.
 *
 * These tests drive the real router at the exact URL shape the QR encoder
 * produces (`guestTableUrl`), so link and route cannot drift apart again.
 */

function LocationProbe() {
  const { pathname } = useLocation()
  return <span data-testid="pathname">{pathname}</span>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // `ScrollToTop` calls this on every navigation; jsdom does not implement it.
  window.scrollTo = vi.fn()
})

afterEach(cleanup)

describe('scanned table QR URL', () => {
  it('opens the guest menu for the restaurant instead of bouncing to the marketing site', () => {
    renderAt('/r/urban-bean-cafe/table/t-01')

    // The catch-all redirect would have replaced this with the landing page.
    expect(screen.getByTestId('pathname')).toHaveTextContent('/r/urban-bean-cafe/table/t-01')
    expect(screen.getByText('Urban Bean Cafe')).toBeInTheDocument()
    expect(screen.queryByText(/Turn Every Table Into a Digital Ordering Experience/i)).not.toBeInTheDocument()
  })

  it('attaches the table the diner is sitting at', () => {
    renderAt('/r/urban-bean-cafe/table/t-01')

    const header = screen.getByRole('banner')
    expect(within(header).getByText('T-01')).toBeInTheDocument()
  })

  it('keeps a table-less restaurant link working (no table attached)', () => {
    renderAt('/r/urban-bean-cafe')

    expect(screen.getByTestId('pathname')).toHaveTextContent('/r/urban-bean-cafe')
    expect(screen.getByText('Urban Bean Cafe')).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).queryByText(/^T-\d+$/)).not.toBeInTheDocument()
  })

  it('still lands on the restaurant for an unknown slug, with a real message', () => {
    renderAt('/r/not-a-restaurant/table/t-99')

    expect(screen.getByText(/Restaurant not found/i)).toBeInTheDocument()
  })

  it('resolves a table number case-insensitively, because not every printer preserves case', () => {
    renderAt('/r/urban-bean-cafe/table/T-01')

    expect(within(screen.getByRole('banner')).getByText('T-01')).toBeInTheDocument()
  })
})

describe('guest navigation', () => {
  it('carries the table into every tab, so ordering still knows the table', () => {
    renderAt('/r/urban-bean-cafe/table/t-01')

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => Boolean(href?.startsWith('/r/')))

    expect(hrefs.length).toBeGreaterThan(0)
    expect(hrefs.every((href) => href.startsWith('/r/urban-bean-cafe/table/t-01'))).toBe(true)
    // The menu is reachable in one tap from the landing screen.
    expect(hrefs).toContain('/r/urban-bean-cafe/table/t-01/menu')
  })

  it('renders a table-scoped sub-page directly (deep link / refresh)', () => {
    renderAt('/r/urban-bean-cafe/table/t-02/menu')

    expect(screen.getByTestId('pathname')).toHaveTextContent('/r/urban-bean-cafe/table/t-02/menu')
    expect(within(screen.getByRole('banner')).getByText('T-02')).toBeInTheDocument()
  })
})
