import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon } from '@/components/ui'
import { cn } from '@/lib/cn'

const MODULES = [
  {
    icon: 'qr_code_2',
    title: 'QR Ordering',
    tone: 'brand' as const,
    copy: 'One permanent code per table, plus bulk generation and a printable floor sheet.',
    points: [
      'Unique QR per table and branch',
      'Bulk select, generate and download',
      'Copy link, regenerate or preview',
      'No app install for guests',
    ],
  },
  {
    icon: 'restaurant_menu',
    title: 'Digital Menu',
    tone: 'info' as const,
    copy: 'A catalog built for real kitchens — categories, option groups, allergens and availability.',
    points: [
      'Categories with ordering and icons',
      'Single- and multi-select option groups',
      'Prep time, calories and allergen tags',
      'Chef Pick, Trending and availability flags',
    ],
  },
  {
    icon: 'soup_kitchen',
    title: 'Kitchen Display',
    tone: 'warning' as const,
    copy: 'A four-lane board tuned for 1366px+ screens, readable from across the pass.',
    points: [
      'New, Preparing, Ready and Completed lanes',
      'Live elapsed timer per ticket',
      'Allergy and kitchen-note callouts',
      'One-tap Accept → Prepare → Ready → Complete',
    ],
  },
  {
    icon: 'table_restaurant',
    title: 'Tables & Floor',
    tone: 'neutral' as const,
    copy: 'Grid and floor-plan views with live occupancy, bills and waiter assignment.',
    points: [
      'Five table states with colour + icon semantics',
      'Assign a waiter to any table',
      'Running bill and occupied duration',
      'Zone-based floor layout',
    ],
  },
  {
    icon: 'book_online',
    title: 'Reservations',
    tone: 'success' as const,
    copy: 'A day calendar with guest counts, table allocation and no-show tracking.',
    points: [
      'List and calendar views',
      'Confirm, complete, cancel, no-show',
      'Special-request capture',
      'Table pre-allocation',
    ],
  },
  {
    icon: 'inventory_2',
    title: 'Inventory',
    tone: 'critical' as const,
    copy: 'Know what is on the shelf before service starts, not halfway through it.',
    points: [
      'Healthy, Low, Critical and Expired states',
      'Low-stock thresholds per ingredient',
      'Supplier and unit cost records',
      'One-tap restock adjustments',
    ],
  },
  {
    icon: 'badge',
    title: 'Staff & RBAC',
    tone: 'neutral' as const,
    copy: 'Granular roles that actually restrict what a screen can do.',
    points: [
      'Owner, manager, cashier, chef, kitchen, waiter',
      'Capability-gated navigation',
      'Shift assignment and invite flow',
      'Every privileged action audit-logged',
    ],
  },
  {
    icon: 'insights',
    title: 'Analytics',
    tone: 'info' as const,
    copy: 'The numbers an operator actually uses at the end of a shift.',
    points: [
      'Revenue, orders and average ticket',
      'Peak ordering hours',
      'Table utilisation and turnover',
      'Menu engineering: top and slow movers',
    ],
  },
  {
    icon: 'palette',
    title: 'Branding & White-label',
    tone: 'brand' as const,
    copy: 'Tenant colours, type and shape that re-skin the guest experience instantly.',
    points: [
      'Primary, secondary and accent colours',
      'Font family and corner radius',
      'Button and card style',
      'Live guest-menu preview while editing',
    ],
  },
  {
    icon: 'loyalty',
    title: 'Loyalty',
    tone: 'success' as const,
    copy: 'Points on spend with tier progression — no blockchain, no wallet, no friction.',
    points: [
      'Configurable earn rate per currency unit',
      'Bronze → Platinum tier progression',
      'Points balance on the customer record',
      'Redemption tracked in order history',
    ],
  },
]

const PLATFORM = [
  { icon: 'shield', title: 'Row-level security', copy: 'Tenant isolation enforced in Postgres, not in the client.' },
  { icon: 'bolt', title: 'Realtime updates', copy: 'Orders, tables and service requests stream to every open screen.' },
  { icon: 'history', title: 'Audit logging', copy: 'Logins, plan changes, refunds and role edits are recorded.' },
  { icon: 'devices', title: 'Responsive by role', copy: 'Desktop for the back office, tablet for KDS, mobile for guests.' },
  { icon: 'accessibility_new', title: 'Accessible', copy: 'Keyboard support, visible focus, semantic forms, sufficient contrast.' },
  { icon: 'api', title: 'Provider-agnostic payments', copy: 'Razorpay or Stripe slot in behind one checkout interface.' },
]

export function FeaturesPage() {
  return (
    <div className="flex flex-col">
      <section className="px-space-lg py-space-3xl">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-space-md text-center">
          <Badge tone="brand" icon="auto_awesome">
            Features
          </Badge>
          <h1 className="max-w-3xl font-display-hero-mobile text-display-hero-mobile tracking-tight lg:font-headline-xl lg:text-headline-xl">
            Every part of service, on one platform
          </h1>
          <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
            BiteFlow covers the whole loop — guest scans, kitchen cooks, runner serves, cashier
            settles, owner reviews. Nothing to stitch together.
          </p>
        </div>
      </section>

      <section className="px-space-lg pb-space-3xl">
        <div className="mx-auto grid w-full max-w-[1200px] gap-space-lg lg:grid-cols-2">
          {MODULES.map((m) => (
            <Card key={m.title} className="flex flex-col gap-space-md" interactive>
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                  <Icon name={m.icon} size={22} />
                </span>
                <Badge tone={m.tone}>{m.title}</Badge>
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface">{m.title}</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{m.copy}</p>
              <ul className="grid gap-space-xs sm:grid-cols-2">
                {m.points.map((p) => (
                  <li key={p} className="flex items-start gap-space-sm">
                    <Icon name="check_circle" size={16} className="mt-0.5 shrink-0 text-status-success" />
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{p}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 px-space-lg py-space-3xl">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="flex flex-col gap-space-sm">
            <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-primary">
              Under the hood
            </span>
            <h2 className="font-headline-lg text-headline-lg tracking-tight text-white">
              Built like production software
            </h2>
          </div>
          <div className="mt-space-2xl grid gap-space-lg sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM.map((p) => (
              <div key={p.title} className="flex flex-col gap-space-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                  <Icon name={p.icon} size={20} />
                </span>
                <h3 className="font-headline-sm text-headline-sm text-white">{p.title}</h3>
                <p className="font-body-sm text-body-sm text-slate-400">{p.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-space-lg py-space-3xl">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-space-md rounded-3xl border border-slate-200 bg-surface-container-lowest px-space-xl py-space-2xl text-center">
          <h2 className="font-headline-lg text-headline-lg tracking-tight">
            See it running before you decide
          </h2>
          <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">
            The demo tenant is fully seeded — three restaurants, live orders, a working kitchen board
            and real analytics.
          </p>
          <div className="flex flex-wrap justify-center gap-space-sm">
            <Link to="/demo">
              <Button size="lg" icon="play_circle">
                Open the demo
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="lg" variant="secondary" iconRight="arrow_forward">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
