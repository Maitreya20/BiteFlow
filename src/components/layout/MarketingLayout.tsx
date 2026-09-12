import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Button, Icon } from '@/components/ui'
import { useAppStore } from '@/store/AppStore'

const LINKS = [
  { label: 'Product', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Demo', to: '/demo' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

const FOOTER_GROUPS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Live demo', to: '/demo' },
      { label: 'QR ordering', to: '/features' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'Cafés', to: '/features' },
      { label: 'Full-service dining', to: '/features' },
      { label: 'Cloud kitchens', to: '/features' },
      { label: 'Food courts', to: '/features' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Security', to: '/about' },
      { label: 'Status', to: '/about' },
    ],
  },
]

export function MarketingLayout() {
  const [open, setOpen] = useState(false)
  const { session } = useAppStore()
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-surface-container-lowest/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-space-lg">
          <Link to="/" className="flex items-center gap-space-sm" aria-label="BiteFlow home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
              <Icon name="restaurant" size={20} />
            </span>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight">BiteFlow</span>
          </Link>

          <nav className="hidden items-center gap-space-xs md:flex" aria-label="Main">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-space-md py-space-xs font-label-sm text-label-sm font-semibold transition-colors',
                    isActive || pathname === link.to
                      ? 'bg-surface-container-low text-on-surface'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-space-sm md:flex">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link to={session ? '/app/dashboard' : '/signup'}>
              <Button size="sm" iconRight="arrow_forward">
                {session ? 'Open dashboard' : 'Start Free'}
              </Button>
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low md:hidden"
          >
            <Icon name={open ? 'close' : 'menu'} size={22} />
          </button>
        </div>

        {open && (
          <div className="anim-fade-up border-t border-slate-200 bg-surface-container-lowest px-space-lg py-space-md md:hidden">
            <nav className="flex flex-col gap-space-xs" aria-label="Mobile">
              {LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-space-md py-space-sm font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-space-md flex gap-space-sm">
              <Link to="/login" className="flex-1" onClick={() => setOpen(false)}>
                <Button variant="secondary" block>
                  Log in
                </Button>
              </Link>
              <Link to={session ? '/app/dashboard' : '/signup'} className="flex-1" onClick={() => setOpen(false)}>
                <Button block>{session ? 'Dashboard' : 'Start Free'}</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-surface-container-lowest">
        <div className="mx-auto grid w-full max-w-[1200px] gap-space-2xl px-space-lg py-space-3xl sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-space-md">
            <div className="flex items-center gap-space-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
                <Icon name="restaurant" size={20} />
              </span>
              <span className="font-headline-sm text-headline-sm font-bold">BiteFlow</span>
            </div>
            <p className="max-w-xs font-body-sm text-body-sm text-on-surface-variant">
              Multi-tenant restaurant SaaS — QR ordering, kitchen display, tables, analytics and
              white-label branding in one platform.
            </p>
            <div className="flex items-center gap-space-xs font-label-xs text-label-xs text-on-surface-variant">
              <Icon name="verified_user" size={15} className="text-status-success" />
              Tenant-isolated with row-level security
            </div>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-space-sm">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {group.title}
              </span>
              {group.links.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 px-space-lg py-space-lg">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-between gap-space-sm sm:flex-row">
            <p className="font-label-xs text-label-xs text-on-surface-variant">
              © {new Date().getFullYear()} BiteFlow. Prototype build.
            </p>
            <p className="font-label-xs text-label-xs text-on-surface-variant">
              Made for restaurants, cafés, cloud kitchens and food courts.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
