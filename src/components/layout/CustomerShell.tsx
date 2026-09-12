import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Badge, Button, Drawer, Icon, useToast, Avatar } from '@/components/ui'
import { useCart } from '@/store/CartStore'
import { resolvePublicContext, createServiceRequest } from '@/data/api'
import { formatMoney } from '@/lib/format'
import { SERVICE_REQUEST_LABELS, type ServiceRequestType } from '@/lib/types'
import { CUSTOMER_TABS } from './nav'

const REQUEST_ICONS: Record<ServiceRequestType, string> = {
  call_waiter: 'notifications_active',
  request_bill: 'request_quote',
  water: 'water_drop',
  cutlery: 'cutlery',
  clean_table: 'cleaning_services',
  other: 'more_horiz',
}

export function CustomerShell() {
  const { slug = '', tableNumber } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const toast = useToast()
  const cart = useCart()
  const [helpOpen, setHelpOpen] = useState(false)

  const { organization: org, table } = resolvePublicContext(slug, tableNumber)

  if (!org) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-space-md bg-background px-space-lg text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-low text-primary">
          <Icon name="storefront" size={28} />
        </span>
        <h1 className="font-headline-md text-headline-md">Restaurant not found</h1>
        <p className="max-w-sm font-body-sm text-body-sm text-on-surface-variant">
          This QR link doesn't match any restaurant on BiteFlow. Ask a staff member to reprint the code.
        </p>
        <Link to="/">
          <Button icon="home">Back to BiteFlow</Button>
        </Link>
      </div>
    )
  }

  const branding = org.branding
  const base = `/r/${slug}`
  const activeTab = (() => {
    if (pathname.includes('/cart')) return 'cart'
    if (pathname.includes('/order/')) return 'orders'
    if (pathname.includes('/bill')) return 'bill'
    if (pathname.includes('/menu/')) return 'menu'
    return 'home'
  })()

  const submitRequest = (type: ServiceRequestType) => {
    if (!table) {
      toast.error('No table detected', 'Scan the QR code on your table to request service.')
      return
    }
    void createServiceRequest({
      organizationId: org.id,
      tableId: table.id,
      tableNumber: table.tableNumber,
      type,
    })
    setHelpOpen(false)
    toast.success(
      `${SERVICE_REQUEST_LABELS[type]} requested`,
      `A team member is on the way to ${table.tableNumber}.`,
    )
  }

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col bg-background shadow-e1"
      style={{ fontFamily: 'var(--bf-font)' }}
    >
      {/* Sticky restaurant header — design.md §22 */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-surface-container-lowest/95 backdrop-blur-xl">
        <div className="pt-safe flex items-center gap-space-md px-space-lg py-space-md">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[22px] shadow-sm"
            style={{ background: `color-mix(in srgb, ${branding.primaryColor} 14%, white)` }}
            aria-hidden
          >
            {branding.logoEmoji}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate font-headline-sm text-headline-sm font-bold text-on-surface">
              {org.name}
            </h1>
            <div className="flex items-center gap-space-sm">
              <span className="inline-flex items-center gap-0.5 font-label-xs text-label-xs font-semibold text-on-surface-variant">
                <Icon name="star" size={13} filled className="text-status-warning" />
                {branding.rating.toFixed(1)}
              </span>
              <span className="text-on-surface-variant/50">·</span>
              <span
                className={cn(
                  'font-label-xs text-label-xs font-semibold',
                  branding.isOpen ? 'text-status-success' : 'text-status-critical',
                )}
              >
                {branding.isOpen ? 'Open now' : 'Closed'}
              </span>
              <span className="text-on-surface-variant/50">·</span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">
                {branding.tagline}
              </span>
            </div>
          </div>
          {table && (
            <Badge tone="brand" icon="table_restaurant">
              {table.tableNumber}
            </Badge>
          )}
        </div>
      </header>

      <main className="flex-1 pb-40">
        <Outlet />
      </main>

      {/* Floating cart — design.md §22 */}
      {cart.count > 0 && activeTab !== 'cart' && (
        <button
          type="button"
          onClick={() => navigate(`${base}/cart`)}
          className="anim-fade-up fixed bottom-20 left-1/2 z-40 flex w-[min(92vw,520px)] -translate-x-1/2 items-center justify-between gap-space-md rounded-2xl px-space-lg py-space-md text-left shadow-e3"
          style={{ background: branding.primaryColor, color: '#fff' }}
        >
          <span className="flex items-center gap-space-md">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Icon name="shopping_bag" size={20} />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 font-label-xs text-[10px] font-bold" style={{ color: branding.primaryColor }}>
                {cart.count}
              </span>
            </span>
            <span className="flex flex-col">
              <span className="font-label-md text-label-md font-bold">
                {cart.count} item{cart.count === 1 ? '' : 's'} in your order
              </span>
              <span className="font-label-xs text-label-xs opacity-90">Tap to review and place</span>
            </span>
          </span>
          <span className="tabular font-headline-sm text-headline-sm font-bold">
            {formatMoney(cart.subtotal, branding.currency)}
          </span>
        </button>
      )}

      {/* Service request FAB — design.md §26 */}
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-e3 lg:bottom-6 lg:right-6"
        style={{ background: branding.secondaryColor ?? '#0F172A' }}
        aria-label="Need help?"
      >
        <Icon name="support_agent" size={22} />
      </button>

      <Drawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        side="bottom"
        title="Need help?"
        subtitle={table ? `We'll send someone to ${table.tableNumber}` : 'Scan a table QR first'}
      >
        <div className="grid grid-cols-2 gap-space-sm">
          {(Object.keys(SERVICE_REQUEST_LABELS) as ServiceRequestType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => submitRequest(type)}
              className="flex flex-col items-start gap-space-sm rounded-xl border border-slate-200 bg-white p-space-md text-left transition-colors hover:bg-surface-container-low"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in srgb, ${branding.primaryColor} 14%, white)`, color: branding.primaryColor }}
              >
                <Icon name={REQUEST_ICONS[type]} size={19} />
              </span>
              <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                {SERVICE_REQUEST_LABELS[type]}
              </span>
            </button>
          ))}
        </div>
      </Drawer>

      {/* Bottom navigation — design.md §29 */}
      <nav className="pb-safe fixed bottom-0 left-1/2 z-40 flex w-[min(100vw,560px)] -translate-x-1/2 border-t border-slate-200 bg-surface-container-lowest/95 backdrop-blur-xl">
        {CUSTOMER_TABS.map((tab) => {
          const isMenu = tab.to === 'menu'
          const target =
            tab.to === 'home'
              ? base
              : tab.to === 'orders'
                ? `${base}/orders`
                : tab.to === 'bill'
                  ? `${base}/bill`
                  : tab.to === 'profile'
                    ? `${base}/profile`
                    : `${base}/menu`
          const active =
            tab.to === 'home'
              ? activeTab === 'home'
              : tab.to === 'menu'
                ? activeTab === 'menu'
                : tab.to === 'orders'
                  ? activeTab === 'orders'
                  : tab.to === 'bill'
                    ? activeTab === 'bill'
                    : false

          return (
            <Link
              key={tab.to}
              to={target}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-space-sm font-label-xs text-label-xs transition-colors',
                active ? 'font-bold' : 'text-on-surface-variant',
              )}
              style={active ? { color: branding.primaryColor } : undefined}
            >
              <span className="relative">
                <Icon name={tab.icon} size={21} />
                {isMenu && cart.count > 0 && (
                  <span
                    className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-label-xs text-[9px] font-bold text-white"
                    style={{ background: branding.primaryColor }}
                  >
                    {cart.count}
                  </span>
                )}
              </span>
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Keep the customer identity chip visible while browsing */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-safe">
        <span className="sr-only">Ordering from {org.name}</span>
      </div>
      <span className="hidden">
        <Avatar name={org.name} />
      </span>
    </div>
  )
}
