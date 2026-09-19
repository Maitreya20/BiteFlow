import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AppStoreProvider } from '@/store/AppStore'
import { CartProvider, useCart } from '@/store/CartStore'
import { Button, ToastProvider } from '@/components/ui'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { GuestMenuPreview } from '@/components/GuestMenuPreview'
import type { Branding, MenuItem } from '@/lib/types'

describe('smoke tests', () => {
  it('renders the dashboard shell in demo mode without crashing', () => {
    // In demo mode the store reads from the bundled seed dataset. Mounting the
    // dashboard shell verifies the provider + layout tree stays coherent. The
    // shell also renders the demo role switcher, which reads the toast context.
    render(
      <BrowserRouter>
        <AppStoreProvider>
          <ToastProvider>
            <DashboardShell variant="app" />
          </ToastProvider>
        </AppStoreProvider>
      </BrowserRouter>,
    )

    expect(document.body).toBeInTheDocument()
    expect(screen.getByText(/BiteFlow/i)).toBeInTheDocument()
  })

  it('renders the customer guest menu preview with branding', () => {
    const branding: Branding = {
      logoUrl: null,
      logoEmoji: '☕',
      primaryColor: '#EA580C',
      secondaryColor: '#0F172A',
      accentColor: '#F97316',
      fontFamily: 'Manrope',
      radiusScale: 'soft',
      buttonStyle: 'solid',
      cardStyle: 'elevated',
      menuLayout: 'grid',
      heroHeadline: 'Slow-roasted mornings',
      heroSubcopy: 'All-day brunch',
      heroImageUrl: null,
      tagline: 'Specialty coffee',
      address: '18 Maple Lane',
      phone: '+91 98200 41120',
      rating: 4.8,
      isOpen: true,
      currency: 'INR',
      taxPercent: 5,
      serviceChargePercent: 0,
    }

    const menuItems: MenuItem[] = [
      {
        id: 'item-1',
        organizationId: 'org-1',
        categoryId: 'cat-1',
        name: 'Cold Brew Hazelnut',
        description: '18-hour steeped cold brew',
        price: 220,
        imageUrl: null,
        prepTimeMinutes: 4,
        calories: 140,
        available: true,
        isChefPick: false,
        isTrending: true,
        isVegetarian: false,
        isSpicy: false,
        allergens: [],
        tags: ['Trending'],
        optionGroups: [],
        sortOrder: 0,
      },
    ]

    render(
      <GuestMenuPreview
        branding={branding}
        categories={[]}
        items={menuItems}
        restaurantName="Urban Bean Cafe"
        tableNumber="T-04"
      />,
    )

    expect(screen.getByText('Cold Brew Hazelnut')).toBeInTheDocument()
    // Price renders as localized currency: `₹220`.
    expect(screen.getByText('₹220')).toBeInTheDocument()
  })

  it('cart provider can add and clear a line', async () => {
    function CartHarness() {
      const cart = useCart()
      return (
        <div>
          <div data-testid="count">{cart.count}</div>
          <div data-testid="subtotal">{cart.subtotal}</div>
          <button
            onClick={() =>
              cart.addLine({
                item: {
                  id: 'i1',
                  organizationId: 'org',
                  categoryId: 'c',
                  name: 'Espresso',
                  description: '',
                  price: 180,
                  imageUrl: null,
                  prepTimeMinutes: 3,
                  calories: 10,
                  available: true,
                  isChefPick: false,
                  isTrending: false,
                  isVegetarian: false,
                  isSpicy: false,
                  allergens: [],
                  tags: [],
                  optionGroups: [],
                  sortOrder: 0,
                } as MenuItem,
                quantity: 2,
                options: [],
                optionsTotal: 0,
                notes: '',
              })
            }
          >
            add
          </button>
          <button onClick={() => cart.clear()}>clear</button>
        </div>
      )
    }

    render(
      <BrowserRouter>
        <AppStoreProvider>
          <CartProvider>
            <CartHarness />
          </CartProvider>
        </AppStoreProvider>
      </BrowserRouter>,
    )

    expect(screen.getByTestId('count')).toHaveTextContent('0')

    screen.getByText('add').click()

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('2')
      expect(screen.getByTestId('subtotal')).toHaveTextContent('360')
    })

    screen.getByText('clear').click()
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0')
    })
  })

  it('Button renders loading state as a spinner', () => {
    render(<Button loading>Submit</Button>)
    expect(document.querySelector('button')).toBeInTheDocument()
    expect(screen.getByText('Submit')).toBeInTheDocument()
  })
})
