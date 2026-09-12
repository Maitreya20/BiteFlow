import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Icon } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import { PLANS } from '@/lib/plans'
import { DEMO_MODE_NOTE } from '@/lib/constants'

const GOLDEN_PATH = [
  { title: 'Open the dashboard', copy: 'Land on Urban Bean Cafe with live orders and today\'s numbers.', to: '/app/dashboard', icon: 'grid_view' },
  { title: 'Place a QR order', copy: 'Add dishes as a guest at table T-04 and submit the ticket.', to: '/r/urban-bean-cafe/table/T-04/menu', icon: 'qr_code_2' },
  { title: 'Work the kitchen board', copy: 'Accept, prepare and mark the ticket ready on the KDS.', to: '/app/kitchen', icon: 'soup_kitchen' },
  { title: 'Settle the bill', copy: 'Open the table, complete the payment and see the table free up.', to: '/app/tables', icon: 'payments' },
  { title: 'Review analytics', copy: 'Inspect revenue, peak hours and menu engineering for the tenant.', to: '/app/analytics', icon: 'insights' },
  { title: 'Rebrand the tenant', copy: 'Change colours and watch the guest menu re-skin live.', to: '/app/branding', icon: 'palette' },
]

const TENANTS = [
  { slug: 'urban-bean-cafe', name: 'Urban Bean Cafe', emoji: '☕', plan: 'Growth', color: '#EA580C', note: 'Specialty coffee & all-day brunch' },
  { slug: 'spice-route', name: 'Spice Route Restaurant', emoji: '🍛', plan: 'Pro', color: '#B91C1C', note: 'Regional Indian kitchen' },
  { slug: 'the-green-bowl', name: 'The Green Bowl', emoji: '🥗', plan: 'Starter', color: '#15803D', note: 'Plant-forward bowls' },
  { slug: 'urban-bean-cafe', name: 'Urban Bean Cafe', emoji: '☕', plan: 'Growth', color: '#EA580C', note: 'All-day café' },
  { slug: 'spice-route', name: 'Spice Route Restaurant', emoji: '🍛', plan: 'Pro', color: '#B91C1C', note: 'Regional Indian kitchen' },
]

export function DemoPage() {
  const navigate = useNavigate()
  const { session, signOut } = useAppStore()
  const [launching, setLaunching] = useState<string | null>(null)

  const enter = async (target: string, tenantSlug?: string) => {
    setLaunching(target)
    if (tenantSlug) {
      localStorage.setItem('biteflow.demo.tenant', tenantSlug)
    }
    if (!session) {
      try {
        const { signIn } = await import('@/data/api')
        await signIn('owner@urbanbean.test', 'demo1234')
        const { switchOrganization } = await import('@/data/api')
        if (tenantSlug) {
          const { getSnapshot } = await import('@/data/api')
          const org = getSnapshot().db.organizations.find((o) => o.slug === tenantSlug)
          if (org) switchOrganization(org.id)
        }
      } catch {
        /* fall through to login */
      }
    }
    setLaunching(null)
    navigate(target)
  }

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden px-space-lg py-space-3xl">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-center gap-space-md text-center">
          <Badge tone="info" icon="play_circle">
            Guided demo
          </Badge>
          <h1 className="max-w-3xl font-display-hero-mobile text-display-hero-mobile tracking-tight lg:font-headline-xl lg:text-headline-xl">
            Walk the golden path in five minutes
          </h1>
          <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
            Three seeded restaurants, live orders, a working kitchen board and real analytics. No
            setup, no signup required.
          </p>
          <div className="flex flex-wrap justify-center gap-space-sm">
            <Button size="lg" icon="rocket_launch" loading={launching === '/app/dashboard'} onClick={() => void enter('/app/dashboard')}>
              {session ? 'Resume demo session' : 'Launch demo as owner'}
            </Button>
            {session && (
              <Button size="lg" variant="secondary" icon="logout" onClick={() => void signOut()}>
                Reset session
              </Button>
            )}
          </div>
          <p className="font-label-xs text-label-xs text-on-surface-variant">{DEMO_MODE_NOTE}</p>
        </div>
      </section>

      <section className="px-space-lg pb-space-3xl">
        <div className="mx-auto grid w-full max-w-[1200px] gap-space-lg lg:grid-cols-3">
          {TENANTS.map((tenant) => (
            <Card key={tenant.slug} className="flex flex-col gap-space-md" interactive>
              <div className="flex items-center justify-between">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-[24px]"
                  style={{ background: `${tenant.color}1F` }}
                >
                  {tenant.emoji}
                </span>
                <Badge tone="neutral">{tenant.plan}</Badge>
              </div>
              <div className="flex flex-col gap-0.5">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">{tenant.name}</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{tenant.note}</p>
              </div>
              <div
                className="h-1.5 w-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${tenant.color}, ${tenant.color}55)` }}
              />
              <div className="mt-auto flex flex-col gap-space-xs">
                <Button
                  size="sm"
                  block
                  variant="secondary"
                  icon="open_in_new"
                  loading={launching === `/r/${tenant.slug}`}
                  onClick={() => void enter(`/r/${tenant.slug}/table/T-04/menu`)}
                >
                  Open guest menu
                </Button>
                <Button
                  size="sm"
                  block
                  icon="dashboard"
                  loading={launching === `/app/${tenant.slug}`}
                  onClick={() => void enter('/app/dashboard', tenant.slug)}
                >
                  Open as operator
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-surface-container-lowest px-space-lg py-space-3xl">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="flex flex-col gap-space-sm">
            <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-primary">
              The script
            </span>
            <h2 className="font-headline-lg text-headline-lg tracking-tight">
              Six stops, one continuous story
            </h2>
          </div>
          <div className="mt-space-2xl grid gap-space-md md:grid-cols-2 lg:grid-cols-3">
            {GOLDEN_PATH.map((step, i) => (
              <button
                key={step.title}
                type="button"
                onClick={() => void enter(step.to)}
                className={cn(
                  'group flex flex-col items-start gap-space-sm rounded-2xl border border-slate-200 bg-white p-space-lg text-left transition-all',
                  'hover:border-primary/40 hover:shadow-e2',
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                    <Icon name={step.icon} size={20} />
                  </span>
                  <span className="font-headline-sm text-headline-sm font-extrabold text-slate-200">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">{step.title}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">{step.copy}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-space-xs font-label-sm text-label-sm font-semibold text-primary">
                  Go there
                  <Icon name="arrow_forward" size={15} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-space-lg py-space-3xl">
        <div className="mx-auto grid w-full max-w-[1200px] gap-space-lg lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div className="flex flex-col gap-space-md">
            <h2 className="font-headline-lg text-headline-lg tracking-tight">
              Then make it yours on a real plan
            </h2>
            <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">
              The demo runs on the same code path as a live tenant. Create your own restaurant and
              the exact same screens, limits and branding controls apply.
            </p>
            <div className="flex flex-wrap gap-space-sm">
              <Link to="/signup">
                <Button size="lg" iconRight="arrow_forward">
                  Create my restaurant
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="secondary">
                  Compare plans
                </Button>
              </Link>
            </div>
          </div>
          <Card className="flex flex-col gap-space-md">
            <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Demo tenant plans
            </span>
            {Object.values(PLANS)
              .filter((p) => p.id !== 'enterprise')
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-slate-100 pb-space-xs last:border-0">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">{p.name}</span>
                  <span className="tabular font-label-sm text-label-sm text-on-surface-variant">
                    {p.limits.maxTables} tables · {p.limits.maxMenuItems} items
                  </span>
                </div>
              ))}
          </Card>
        </div>
      </section>
    </div>
  )
}
