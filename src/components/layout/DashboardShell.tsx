import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Icon } from '@/components/ui'
import { APP_NAV, ADMIN_NAV, type BadgeKey, type NavGroup } from './nav'
import { DemoRoleSwitcher } from './DemoRoleSwitcher'
import { useAppStore } from '@/store/AppStore'
import { PLANS } from '@/lib/plans'
import { relativeTime } from '@/lib/format'

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside])
  return ref
}

function Dropdown({
  trigger,
  children,
  align = 'right',
  width = 300,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: ReactNode
  align?: 'left' | 'right'
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={cn(
            'anim-fade-up absolute z-50 mt-space-xs overflow-hidden rounded-xl border border-slate-200 bg-surface-container-lowest shadow-e3',
            align === 'right' ? 'right-0' : 'left-0',
          )}
          style={{ width }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function DashboardShell({
  variant = 'app',
  title,
  subtitle,
  actions,
  children,
}: {
  variant?: 'app' | 'admin'
  title?: string
  subtitle?: string
  actions?: ReactNode
  children?: ReactNode
}) {
  const {
    session,
    organization,
    role,
    mode,
    hasCapability,
    db,
    notifications,
    orders,
    serviceRequests,
    inventory,
    metrics,
    switchOrganization,
    signOut,
    refresh,
  } = useAppStore()

  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [mobileNav, setMobileNav] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useClickOutside<HTMLDivElement>(() => setSearch(''))

  useEffect(() => setMobileNav(false), [pathname])

  const navGroups: NavGroup[] = variant === 'admin' ? ADMIN_NAV : APP_NAV

  const badgeCounts: Record<BadgeKey, number> = useMemo(
    () => ({
      orders: orders.filter((o) => o.status === 'pending').length,
      kitchen: orders.filter((o) => ['pending', 'accepted', 'preparing'].includes(o.status)).length,
      serviceRequests: serviceRequests.filter((s) => s.status === 'pending').length,
      inventory: inventory.filter((i) => i.currentStock <= i.lowStockThreshold).length,
      notifications: notifications.filter((n) => !n.read).length,
    }),
    [orders, serviceRequests, inventory, notifications],
  )

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.capability || hasCapability(item.capability)),
        }))
        .filter((group) => group.items.length > 0),
    [navGroups, hasCapability],
  )

  const unread = badgeCounts.notifications
  const plan = PLANS[organization?.planId ?? 'starter']

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return { orders: [], items: [], tables: [] }
    return {
      orders: orders
        .filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(q) ||
            (o.tableNumber ?? '').toLowerCase().includes(q) ||
            (o.customerName ?? '').toLowerCase().includes(q),
        )
        .slice(0, 4),
      items: db.menuItems
        .filter((m) => m.organizationId === organization?.id && m.name.toLowerCase().includes(q))
        .slice(0, 4),
      tables: []
        .slice(0, 0) as never[],
    }
  }, [search, orders, db.menuItems, organization?.id])

  const tenantMemberships = useMemo(
    () =>
      (session?.memberships ?? [])
        .map((m) => ({
          ...m,
          organization: db.organizations.find((o) => o.id === m.organizationId),
        }))
        .filter((m) => m.organization),
    [session?.memberships, db.organizations],
  )

  const sidebar = (
    <div className="flex h-full flex-col justify-between overflow-y-auto scroll-slim">
      <div className="flex flex-col">
        <Link to={variant === 'admin' ? '/admin' : '/app/dashboard'} className="flex h-16 items-center gap-space-sm px-space-xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Icon name="restaurant" size={18} />
          </span>
          <span className="font-headline-sm text-headline-sm font-bold tracking-tight">BiteFlow</span>
          {variant === 'admin' && <Badge tone="slate">Admin</Badge>}
        </Link>

        <nav className="flex flex-col gap-space-2xs px-space-md py-space-sm" aria-label="Primary">
          {visibleGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-space-2xs">
              <div className="px-space-sm pb-space-2xs pt-space-md font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {group.title}
              </div>
              {group.items.map((item) => {
                const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/admin'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between rounded-lg px-space-md py-space-sm transition-colors',
                        isActive
                          ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                          : 'font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                      )
                    }
                  >
                    <span className="flex items-center gap-space-md">
                      <Icon name={item.icon} size={18} />
                      <span>{item.label}</span>
                    </span>
                    {item.badgeKey === 'inventory' && count > 0 ? (
                      <span className="flex h-2 w-2 rounded-full bg-status-warning" title="Low stock alert" />
                    ) : count > 0 ? (
                      <span className="rounded-full bg-primary px-space-xs py-0.5 font-label-xs text-label-xs text-on-primary">
                        {count}
                      </span>
                    ) : null}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-space-xs p-space-md">
        {variant === 'app' && organization && (
          <div className="flex flex-col gap-space-xs rounded-xl bg-surface-container-low p-space-md">
            <div className="flex items-center justify-between gap-space-sm">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-label-md text-label-md font-bold text-on-surface">
                  {organization.name}
                </span>
                <span className="font-label-xs text-label-xs text-on-surface-variant">
                  {organization.branding.tagline || organization.businessType}
                </span>
              </div>
              <Link
                to="/app/tables"
                title="Share table QR codes"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high"
              >
                <Icon name="qr_code_2" size={18} />
              </Link>
            </div>
            <div className="flex items-center justify-between pt-space-2xs">
              <Badge
                tone={
                  organization.subscriptionStatus === 'active'
                    ? 'success'
                    : organization.subscriptionStatus === 'trialing'
                      ? 'info'
                      : 'critical'
                }
              >
                {organization.subscriptionStatus === 'trialing'
                  ? `${plan.name} trial`
                  : `${plan.name} plan`}
              </Badge>
              <Link
                to="/app/settings"
                className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant hover:text-on-surface"
              >
                <Icon name="help" size={14} />
                Docs
              </Link>
            </div>
          </div>
        )}

        <div className="flex items-center gap-space-xs rounded-xl bg-surface-container-low p-space-xs">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              mode === 'live' ? 'bg-status-success' : 'bg-status-warning',
            )}
          />
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            {mode === 'live' ? 'Supabase connected' : 'Demo dataset'}
          </span>
          {mode === 'live' && (
            <button
              type="button"
              onClick={() => void refresh()}
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high"
              title="Refresh data"
              aria-label="Refresh data"
            >
              <Icon name="refresh" size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-50 hidden h-full w-64 flex-col border-r border-slate-200 bg-surface-container-lowest lg:flex">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMobileNav(false)}
          />
          <aside className="anim-drawer relative z-10 h-full w-72 border-r border-slate-200 bg-surface-container-lowest">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-space-md border-b border-slate-200 bg-surface-container-lowest/90 px-space-lg backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-space-md">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low lg:hidden"
            >
              <Icon name="menu" size={22} />
            </button>

            {variant === 'app' && organization && (
              <Dropdown
                width={300}
                align="left"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="hidden items-center gap-space-sm rounded-lg bg-surface-container-low px-space-md py-space-xs text-left hover:bg-surface-container sm:flex"
                  >
                    <span className="flex flex-col">
                      <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                        Tenant
                      </span>
                      <span className="max-w-[220px] truncate font-label-sm text-label-sm font-semibold text-on-surface">
                        {organization.name}
                      </span>
                    </span>
                    <Icon name="expand_more" size={18} className="text-on-surface-variant" />
                  </button>
                )}
              >
                <div className="border-b border-slate-200 px-space-md py-space-sm">
                  <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Switch tenant
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto scroll-slim py-space-xs">
                  {tenantMemberships.map((m) => {
                    const org = m.organization!
                    const active = org.id === organization.id
                    return (
                      <button
                        key={m.organizationId}
                        type="button"
                        onClick={() => switchOrganization(m.organizationId)}
                        className={cn(
                          'flex w-full items-center gap-space-md px-space-md py-space-sm text-left hover:bg-surface-container-low',
                          active && 'bg-surface-container-low',
                        )}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-label-sm font-bold text-on-surface">
                          {org.branding.logoEmoji}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-label-sm text-label-sm font-semibold text-on-surface">
                            {org.name}
                          </span>
                          <span className="font-label-xs text-label-xs capitalize text-on-surface-variant">
                            {m.role.replace('_', ' ')} · {org.planId}
                          </span>
                        </span>
                        {active && <Icon name="check" size={16} className="text-primary" />}
                      </button>
                    )
                  })}
                  {!tenantMemberships.length && (
                    <p className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface-variant">
                      No tenants yet — finish onboarding to create one.
                    </p>
                  )}
                </div>
                <Link
                  to="/onboarding/account"
                  className="flex items-center gap-space-sm border-t border-slate-200 px-space-md py-space-sm font-label-sm text-label-sm text-primary hover:bg-surface-container-low"
                >
                  <Icon name="add_business" size={16} />
                  Create another restaurant
                </Link>
              </Dropdown>
            )}

            <div className="relative hidden md:block" ref={searchRef}>
              <Icon
                name="search"
                size={18}
                className="pointer-events-none absolute left-space-md top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Quick search orders, tables, dishes"
                aria-label="Quick search"
                className="h-9 w-64 rounded-lg bg-surface-container-low pl-10 pr-space-md font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_15%,transparent)]"
              />
              {search.trim().length >= 2 && (
                <div className="anim-fade-up absolute left-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-surface-container-lowest shadow-e3">
                  {searchResults.orders.length === 0 && searchResults.items.length === 0 ? (
                    <p className="px-space-md py-space-md font-body-sm text-body-sm text-on-surface-variant">
                      No matches for “{search}”.
                    </p>
                  ) : (
                    <div className="py-space-xs">
                      {searchResults.orders.length > 0 && (
                        <span className="block px-space-md py-space-xs font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                          Orders
                        </span>
                      )}
                      {searchResults.orders.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setSearch('')
                            navigate('/app/orders')
                          }}
                          className="flex w-full items-center justify-between px-space-md py-space-sm text-left hover:bg-surface-container-low"
                        >
                          <span className="font-label-sm text-label-sm font-semibold">{o.orderNumber}</span>
                          <span className="font-label-xs text-label-xs text-on-surface-variant">
                            {o.tableNumber ?? '—'} · {o.status}
                          </span>
                        </button>
                      ))}
                      {searchResults.items.length > 0 && (
                        <span className="block px-space-md py-space-xs font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                          Menu
                        </span>
                      )}
                      {searchResults.items.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSearch('')
                            navigate('/app/menu')
                          }}
                          className="flex w-full items-center justify-between px-space-md py-space-sm text-left hover:bg-surface-container-low"
                        >
                          <span className="truncate font-label-sm text-label-sm">{m.name}</span>
                          <span className="tabular font-label-xs text-label-xs text-on-surface-variant">
                            ₹{m.price}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-space-sm sm:gap-space-md">
            {variant === 'app' && (
              <div className="hidden items-center gap-space-xs rounded-full bg-status-success-bg px-space-md py-1 xl:flex">
                <span className="h-2 w-2 rounded-full bg-status-success" />
                <span className="font-label-xs text-label-xs font-semibold text-status-success">
                  Kitchen online · {badgeCounts.kitchen} active
                </span>
              </div>
            )}

            <Link to="/app/orders" className="hidden sm:block">
              <Button size="sm" icon="add">
                New Order
              </Button>
            </Link>

            {/* Demo-only shortcut between the owner and super-admin sessions. */}
            <DemoRoleSwitcher />

            <Dropdown
              width={340}
              trigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low"
                >
                  <Icon name="notifications" size={22} />
                  {unread > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-critical px-1 font-label-xs text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </button>
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-space-md py-space-sm">
                <span className="font-label-sm text-label-sm font-bold text-on-surface">Notifications</span>
                <Link to="/app/settings" className="font-label-xs text-label-xs text-primary hover:underline">
                  Preferences
                </Link>
              </div>
              <div className="max-h-80 overflow-y-auto scroll-slim">
                {notifications.slice(0, 6).map((n) => (
                  <div
                    key={n.id}
                    className={cn('flex gap-space-md border-b border-slate-100 px-space-md py-space-sm', !n.read && 'bg-ember-50/60')}
                  >
                    <Icon
                      name={
                        n.kind === 'order'
                          ? 'receipt_long'
                          : n.kind === 'service_request'
                            ? 'room_service'
                            : n.kind === 'inventory'
                              ? 'inventory_2'
                              : n.kind === 'subscription'
                                ? 'credit_card'
                                : 'info'
                      }
                      size={18}
                      className="mt-0.5 text-primary"
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface">{n.title}</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{n.body}</span>
                      <span className="mt-0.5 font-label-xs text-label-xs text-on-surface-variant">
                        {relativeTime(n.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
                {!notifications.length && (
                  <p className="px-space-md py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
                    You're all caught up.
                  </p>
                )}
              </div>
            </Dropdown>

            <Dropdown
              width={260}
              trigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  className="flex items-center gap-space-sm rounded-lg p-0.5 hover:bg-surface-container-low"
                  aria-label="Account menu"
                >
                  <Avatar name={session?.user.fullName ?? 'Operator'} size={32} />
                </button>
              )}
            >
              <div className="border-b border-slate-200 px-space-md py-space-sm">
                <p className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {session?.user.fullName ?? 'Operator'}
                </p>
                <p className="font-label-xs text-label-xs text-on-surface-variant">
                  {session?.user.email} · {role.replace('_', ' ')}
                </p>
              </div>
              <div className="py-space-xs">
                <Link to="/app/settings" className="flex items-center gap-space-sm px-space-md py-space-sm font-body-sm text-body-sm hover:bg-surface-container-low">
                  <Icon name="person" size={17} /> Your profile
                </Link>
                <Link to="/app/billing" className="flex items-center gap-space-sm px-space-md py-space-sm font-body-sm text-body-sm hover:bg-surface-container-low">
                  <Icon name="credit_card" size={17} /> Subscription
                </Link>
                <Link to="/app/branding" className="flex items-center gap-space-sm px-space-md py-space-sm font-body-sm text-body-sm hover:bg-surface-container-low">
                  <Icon name="palette" size={17} /> Branding
                </Link>
                {role === 'super_admin' || session?.memberships.some((m) => m.role === 'super_admin') ? (
                  <Link to="/admin" className="flex items-center gap-space-sm px-space-md py-space-sm font-body-sm text-body-sm hover:bg-surface-container-low">
                    <Icon name="shield_person" size={17} /> Platform admin
                  </Link>
                ) : null}
              </div>
              <DemoRoleSwitcher presentation="menu" />
              <button
                type="button"
                onClick={() => void signOut().then(() => navigate('/'))}
                className="flex w-full items-center gap-space-sm border-t border-slate-200 px-space-md py-space-sm font-body-sm text-body-sm text-status-critical hover:bg-status-critical-bg"
              >
                <Icon name="logout" size={17} /> Sign out
              </button>
            </Dropdown>
          </div>
        </header>

        <main className="w-full px-space-lg py-space-lg lg:px-space-xl">
          {(title || actions) && (
            <div className="mb-space-lg flex flex-col gap-space-md lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-0.5">
                {title && (
                  <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-space-sm">{actions}</div>}
            </div>
          )}
          {children ?? <Outlet />}
          <div className="h-space-lg lg:h-0" />
          {/* Mobile bottom nav — design.md §29 */}
          <nav className="pb-safe fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-surface-container-lowest/95 backdrop-blur-xl lg:hidden">
            {visibleGroups
              .flatMap((g) => g.items)
              .slice(0, 5)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-1 flex-col items-center gap-0.5 py-space-sm font-label-xs text-label-xs',
                      isActive ? 'text-primary' : 'text-on-surface-variant',
                    )
                  }
                >
                  <Icon name={item.icon} size={20} />
                  <span className="truncate px-1">{item.label.split(' ')[0]}</span>
                </NavLink>
              ))}
          </nav>
          <div className="h-16 lg:hidden" />
        </main>
      </div>
    </div>
  )
}
