import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'

/**
 * The guest screens keep their primary action in a sticky bar pinned to the
 * bottom of the viewport — but the customer shell has its own fixed bottom
 * navigation pinned to the same edge at a higher z-index. Both sticky bars
 * used `bottom-0`, so on every phone the invisible nav overlayed the primary
 * button: tapping "Add to cart" hit the nav's "Orders" link instead, and the
 * diner landed on an empty orders page with no toast and nothing in the cart.
 * Exactly the "did I order or not?" confusion this suite exists to prevent.
 *
 * jsdom does no layout, so this cannot assert pixel geometry — the live
 * verification that found the bug did that. What it can do is pin the class
 * contract that encodes the fix: the CTA bar must be offset above the nav
 * (`bottom-[68px]`), because anything still at `bottom-0` under a `z-40` nav
 * is unreachable by construction.
 */

const CTA_BAR_SELECTOR = '.fixed.bottom-\\[68px\\]'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('guest sticky CTA sits above the fixed bottom nav', () => {
  it('dish page: the Add to cart bar is offset above the nav', () => {
    renderAt('/r/urban-bean-cafe/table/t-01/menu/item_urban-bean-cafe_0_0')

    const bar = document.querySelector(CTA_BAR_SELECTOR)
    expect(bar, 'DishDetail CTA bar must use bottom-[68px] — at bottom-0 the z-40 bottom nav overlays it and steals every tap').not.toBeNull()
    expect(bar?.textContent).toContain('Add to cart')
    // The nav must still be its own, lower element — this test is meaningless
    // if the two bars were merged instead of layered correctly.
    expect(screen.getByRole('navigation')).not.toBe(bar)
  })

  it('cart page: the Place order bar is offset above the nav', () => {
    // The bar only renders when the cart has lines, and the cart persists in
    // localStorage — seed a line directly, the way the app itself would.
    localStorage.setItem(
      'biteflow.cart.v1',
      JSON.stringify([
        {
          signature: 'item_urban-bean-cafe_0_0::|',
          menuItemId: 'item_urban-bean-cafe_0_0',
          name: 'Cold Brew Hazelnut',
          unitPrice: 220,
          quantity: 1,
          options: [],
          optionsTotal: 0,
          notes: '',
        },
      ]),
    )
    renderAt('/r/urban-bean-cafe/table/t-01/cart')

    const bar = document.querySelector(CTA_BAR_SELECTOR)
    expect(bar, 'CartPage CTA bar must use bottom-[68px] — at bottom-0 the z-40 bottom nav overlays it and steals every tap').not.toBeNull()
    expect(bar?.textContent).toContain('Place order')
    expect(screen.getByRole('navigation')).not.toBe(bar)
  })

  it('no guest page still pins a primary CTA at bottom-0 under the nav', () => {
    const guestPaths = [
      '/r/urban-bean-cafe/table/t-01/menu/item_urban-bean-cafe_0_0',
      '/r/urban-bean-cafe/table/t-01/cart',
    ]
    for (const path of guestPaths) {
      renderAt(path)
      // Any element that is fixed to bottom-0 inside the customer shell must
      // not also contain a primary button — that combination is what made the
      // button untappable.
      const suspicious = [...document.querySelectorAll('.fixed.bottom-0')].filter(
        (el) => el.querySelector('button') && !el.matches('nav, nav *, [role="navigation"], [role="navigation"] *'),
      )
      expect(suspicious, `${path} renders a button-bearing fixed bottom-0 overlay that is not the nav`).toEqual([])
      cleanup()
    }
  })
})
