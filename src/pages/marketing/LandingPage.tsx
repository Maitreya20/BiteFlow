import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon, Sparkline } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PLANS } from '@/lib/plans'
import { formatMoney } from '@/lib/format'
import { useAppStore } from '@/store/AppStore'

/* ------------------------------------------------------------------ helpers */

function Section({
  children,
  className,
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('px-space-lg py-space-3xl lg:py-space-4xl', className)}>
      <div className="mx-auto w-full max-w-[1200px]">{children}</div>
    </section>
  )
}

function SectionHead({
  eyebrow,
  title,
  copy,
  center,
}: {
  eyebrow?: string
  title: ReactNode
  copy?: string
  center?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-space-sm', center && 'mx-auto max-w-2xl text-center')}>
      {eyebrow && (
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-primary">
          {eyebrow}
        </span>
      )}
      <h2 className="font-headline-lg text-headline-lg tracking-tight text-on-surface lg:text-headline-xl lg:leading-[48px]">
        {title}
      </h2>
      {copy && <p className="font-body-lg text-body-lg text-on-surface-variant">{copy}</p>}
    </div>
  )
}

/* --------------------------------------------------------------------- data */

const BENEFITS = [
  {
    icon: 'timer',
    title: 'Orders in under 40 seconds',
    copy: 'Guests scan, order and pay without waiting for a server to circle back. Tickets hit the kitchen instantly.',
  },
  {
    icon: 'trending_up',
    title: 'Higher average ticket',
    copy: 'Photos, add-ons and smart upsell prompts lift the basket — the prototype demo shows +5.2% AOV.',
  },
  {
    icon: 'fact_check',
    title: 'Fewer mistakes',
    copy: 'Allergies and kitchen notes travel with the ticket. No more shouting over a hot pass.',
  },
  {
    icon: 'storefront',
    title: 'Every branch isolated',
    copy: 'Each restaurant is its own tenant with row-level security, branding and subscription limits.',
  },
]

const FEATURE_GROUPS = [
  { icon: 'qr_code_2', title: 'QR Ordering', copy: 'Unique, printable QR per table. Bulk generate, download and reprint any time.' },
  { icon: 'restaurant_menu', title: 'Digital Menu', copy: 'Categories, options, add-ons, allergens, chef picks and live availability toggles.' },
  { icon: 'soup_kitchen', title: 'Kitchen Display', copy: 'Four-lane KDS with prep timers, rush flags and one-tap status progression.' },
  { icon: 'table_restaurant', title: 'Tables & Floor', copy: 'Grid and floor-plan views, waiter assignment, live bills and occupancy timing.' },
  { icon: 'book_online', title: 'Reservations', copy: 'Day calendar, guest counts, table allocation and no-show tracking.' },
  { icon: 'inventory_2', title: 'Inventory', copy: 'Stock levels, low-stock thresholds, supplier records and expiry warnings.' },
  { icon: 'badge', title: 'Staff & Roles', copy: 'Owner, manager, cashier, chef, kitchen and waiter roles with enforced permissions.' },
  { icon: 'insights', title: 'Analytics', copy: 'Revenue, peak hours, table utilisation, menu engineering and prep-time trends.' },
  { icon: 'loyalty', title: 'Loyalty', copy: 'Points on spend, tier progression, redemption and customer order history.' },
  { icon: 'palette', title: 'White-label', copy: 'Colours, fonts, radius, button and card styles that re-skin the guest menu live.' },
]

const STEPS = [
  { n: '01', title: 'Create your restaurant', copy: 'Sign up and answer six fields. Your tenant workspace is provisioned instantly.' },
  { n: '02', title: 'Pick a plan', copy: 'Start on a 14-day trial. Limits for tables, staff, items and orders scale with you.' },
  { n: '03', title: 'Brand and add menu', copy: 'Set colours and logo with a live guest preview, then import or hand-build the menu.' },
  { n: '04', title: 'Print QR and go live', copy: 'Generate table codes, invite staff and launch. Guests order from their own phone.' },
]

const TESTIMONIALS = [
  {
    quote:
      'We replaced three apps with BiteFlow. The kitchen screen is the only thing my chefs look at now, and tickets stopped getting lost on the pass.',
    name: 'Meera Iyer',
    role: 'Owner · Spice Route Restaurant',
  },
  {
    quote:
      'Setup took an afternoon. Table QRs went up on Friday and our weekend covers were up by a fifth without hiring anyone.',
    name: 'Aarav Mehta',
    role: 'Owner · Urban Bean Cafe',
  },
  {
    quote:
      'Having the floor plan and live table bills on one screen changed how our runners work the room during peak service.',
    name: 'Rahul Mehta',
    role: 'Manager · Urban Bean Cafe',
  },
]

const FAQS = [
  {
    q: 'Do my guests need to install an app?',
    a: 'No. They scan the table QR and the menu opens in their browser. No account, no download, no friction.',
  },
  {
    q: 'Is each restaurant really isolated?',
    a: 'Yes. Every record carries an organization id and Postgres row-level security enforces it server-side — the client can never widen its own access.',
  },
  {
    q: 'Can I use my own branding?',
    a: 'On Growth and above you control logo, colours, typography, corner radius and menu layout. The guest experience updates immediately.',
  },
  {
    q: 'What happens when I hit a plan limit?',
    a: 'You get an explicit upgrade prompt instead of a silently disabled button, and nothing in your live service is interrupted.',
  },
  {
    q: 'Which payment providers are supported?',
    a: 'Checkout is provider-agnostic. The prototype ships with a simulated gateway so the flow is demonstrable, and Razorpay or Stripe drop in behind the same interface.',
  },
]

/* -------------------------------------------------------------------- page */

export function LandingPage() {
  const { session } = useAppStore()
  const [faqOpen, setFaqOpen] = useState<number | null>(0)

  return (
    <div className="flex flex-col">
      {/* ------------------------------------------------------------- Hero */}
      <Section className="relative overflow-hidden pb-space-2xl">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 top-64 h-80 w-80 rounded-full bg-tertiary/10 blur-3xl" />

        <div className="relative grid gap-space-2xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="flex flex-col gap-space-lg">
            <span className="inline-flex w-fit items-center gap-space-xs rounded-full bg-ember-100 px-space-md py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-600" />
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-ember-700">
                Multi-tenant restaurant SaaS
              </span>
            </span>

            <h1 className="font-display-hero-mobile text-display-hero-mobile tracking-tight text-on-surface lg:font-display-hero lg:text-display-hero">
              Turn Every Table Into a Digital Ordering Experience.
            </h1>

            <p className="max-w-xl font-body-lg text-body-lg text-on-surface-variant">
              QR ordering, kitchen management, payments, analytics and restaurant automation — all
              in one platform.
            </p>

            <div className="flex flex-wrap items-center gap-space-sm">
              <Link to={session ? '/app/dashboard' : '/signup'}>
                <Button size="lg" iconRight="arrow_forward">
                  {session ? 'Open your dashboard' : 'Start Free'}
                </Button>
              </Link>
              <Link to="/demo">
                <Button size="lg" variant="secondary" icon="play_circle">
                  View Demo
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-space-lg pt-space-xs">
              {[
                { icon: 'check_circle', label: '14-day trial, no card' },
                { icon: 'check_circle', label: 'Live in one afternoon' },
                { icon: 'check_circle', label: 'Cancel any time' },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant"
                >
                  <Icon name={item.icon} size={16} className="text-status-success" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <HeroPreview />
        </div>
      </Section>

      {/* --------------------------------------------------------- Benefits */}
      <Section className="bg-surface-container-lowest">
        <div className="grid gap-space-lg sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex flex-col gap-space-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ember-100 text-ember-700">
                <Icon name={b.icon} size={21} />
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{b.title}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{b.copy}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ----------------------------------------------------- Feature grid */}
      <Section id="features">
        <SectionHead
          eyebrow="Everything in one place"
          title="Ten modules that replace your stack of tools"
          copy="From the guest's first scan to the owner's month-end report — one coherent system, one shared design language."
          center
        />
        <div className="mt-space-2xl grid gap-space-md sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_GROUPS.map((f) => (
            <Card key={f.title} className="flex flex-col gap-space-sm" interactive>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                <Icon name={f.icon} size={21} />
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{f.title}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{f.copy}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------- How it works */}
      <Section className="bg-surface-container-lowest">
        <SectionHead eyebrow="How it works" title="From signup to first order" center />
        <div className="mt-space-2xl grid gap-space-lg md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative flex flex-col gap-space-sm">
              <span className="font-headline-lg text-headline-lg font-extrabold text-primary/25">{s.n}</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{s.title}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{s.copy}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------- QR / Kitchen / Analytics */}
      <Section>
        <div className="grid gap-space-lg lg:grid-cols-3">
          <Card className="flex flex-col gap-space-md">
            <Badge tone="brand" icon="qr_code_2">
              QR ordering
            </Badge>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              One code per table, printed once
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Guests land directly on your branded menu with the table pre-selected. Bulk-generate a
              printable sheet for the whole floor.
            </p>
            <div className="mt-auto flex items-center justify-center rounded-2xl bg-surface-container-low p-space-lg">
              <div className="flex flex-col items-center gap-space-sm rounded-xl bg-white p-space-md shadow-e1">
                <Icon name="qr_code_2" size={76} className="text-slate-900" />
                <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-500">
                  Scan to order · T-04
                </span>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-space-md">
            <Badge tone="warning" icon="soup_kitchen">
              Kitchen display
            </Badge>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Built for the heat of service
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Large tickets, live prep clocks and a single tap to advance each order. Allergies flag
              in red before the plate leaves the pass.
            </p>
            <div className="mt-auto flex flex-col gap-space-sm rounded-2xl bg-slate-950 p-space-md">
              {[
                { table: 'T-04', order: 'BF-1042', mins: '08:12', tone: 'warning' as const },
                { table: 'T-11', order: 'BF-1043', mins: '03:45', tone: 'success' as const },
                { table: 'T-02', order: 'BF-1044', mins: '12:30', tone: 'critical' as const },
              ].map((t) => (
                <div
                  key={t.order}
                  className="flex items-center justify-between rounded-lg bg-slate-900 px-space-md py-space-sm"
                >
                  <span className="flex items-center gap-space-sm">
                    <span className="rounded bg-white/10 px-space-xs py-0.5 font-label-xs text-label-xs font-bold text-white">
                      {t.table}
                    </span>
                    <span className="font-label-sm text-label-sm text-slate-200">{t.order}</span>
                  </span>
                  <span
                    className={cn(
                      'tabular font-label-sm text-label-sm font-bold',
                      t.tone === 'critical' && 'text-status-critical',
                      t.tone === 'warning' && 'text-status-warning',
                      t.tone === 'success' && 'text-status-success',
                    )}
                  >
                    {t.mins}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-space-md">
            <Badge tone="info" icon="insights">
              Analytics
            </Badge>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Know what your floor is doing
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Revenue by hour, table utilisation, menu engineering and kitchen throughput — filtered
              by today, 7, 30 or 90 days.
            </p>
            <div className="mt-auto flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-md">
              <div className="flex items-end justify-between">
                <div>
                  <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                    Revenue · today
                  </span>
                  <p className="tabular font-mono-metric text-mono-metric">{formatMoney(42850)}</p>
                </div>
                <Sparkline values={[12, 18, 15, 26, 22, 31, 28, 38]} />
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
                <span className="font-label-xs text-label-xs font-semibold text-status-success">
                  +18.4% vs yesterday
                </span>
              </div>
            </div>
          </Card>
        </div>
      </Section>

      {/* -------------------------------------------------------- Testimonials */}
      <Section className="bg-surface-container-lowest">
        <SectionHead eyebrow="Operators" title="Trusted on the busiest nights" center />
        <div className="mt-space-2xl grid gap-space-lg lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="flex flex-col gap-space-md">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon key={i} name="star" size={16} filled className="text-status-warning" />
                ))}
              </div>
              <p className="font-body-md text-body-md text-on-surface">“{t.quote}”</p>
              <div className="mt-auto flex flex-col">
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">{t.name}</span>
                <span className="font-label-xs text-label-xs text-on-surface-variant">{t.role}</span>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* ----------------------------------------------------- Pricing preview */}
      <Section id="pricing-preview">
        <SectionHead
          eyebrow="Pricing"
          title="Plans that grow with the room"
          copy="Every plan includes QR ordering and the digital menu. Upgrade when your floor does."
          center
        />
        <div className="mt-space-2xl grid gap-space-lg md:grid-cols-2 lg:grid-cols-4">
          {Object.values(PLANS).map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                'flex flex-col gap-space-md',
                plan.recommended && 'border-primary ring-2 ring-primary/25',
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{plan.name}</h3>
                {plan.recommended && <Badge tone="brand">Recommended</Badge>}
              </div>
              <div className="flex items-baseline gap-1">
                {plan.priceMonthly ? (
                  <>
                    <span className="tabular font-headline-lg text-headline-lg font-bold">
                      {formatMoney(plan.priceMonthly)}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">/mo</span>
                  </>
                ) : (
                  <span className="font-headline-lg text-headline-lg font-bold">Custom</span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{plan.tagline}</p>
              <ul className="flex flex-col gap-space-xs">
                {plan.features.slice(0, 5).map((f) => (
                  <li key={f} className="flex items-start gap-space-sm">
                    <Icon name="check_circle" size={16} className="mt-0.5 shrink-0 text-status-success" />
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/pricing" className="mt-auto">
                <Button block variant={plan.recommended ? 'primary' : 'secondary'}>
                  Compare plan
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- FAQ */}
      <Section className="bg-surface-container-lowest">
        <div className="grid gap-space-2xl lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <SectionHead eyebrow="FAQ" title="Questions we get before every rollout" />
          <div className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {FAQS.map((faq, i) => {
              const open = faqOpen === i
              return (
                <div key={faq.q}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setFaqOpen(open ? null : i)}
                    className="flex w-full items-center justify-between gap-space-md px-space-lg py-space-md text-left hover:bg-surface-container-low"
                  >
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      {faq.q}
                    </span>
                    <Icon
                      name={open ? 'remove' : 'add'}
                      size={20}
                      className="shrink-0 text-on-surface-variant"
                    />
                  </button>
                  {open && (
                    <p className="anim-fade-up px-space-lg pb-space-md font-body-sm text-body-sm text-on-surface-variant">
                      {faq.a}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- CTA */}
      <Section>
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-space-xl py-space-3xl text-center">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-space-lg">
            <h2 className="font-headline-lg text-headline-lg tracking-tight text-white lg:text-headline-xl">
              Your next table can order itself.
            </h2>
            <p className="font-body-lg text-body-lg text-slate-300">
              Spin up a restaurant in the demo, add a few dishes and watch the ticket land on the
              kitchen screen in realtime.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-space-sm">
              <Link to={session ? '/app/dashboard' : '/signup'}>
                <Button size="lg" iconRight="arrow_forward">
                  {session ? 'Go to dashboard' : 'Start Free'}
                </Button>
              </Link>
              <Link to="/demo">
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Explore the demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------ hero preview */

function HeroPreview() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface-container-lowest shadow-e3">
        {/* Fake app chrome */}
        <div className="flex items-center gap-space-sm border-b border-slate-200 bg-surface-container-low px-space-md py-space-sm">
          <span className="flex gap-1">
            {['bg-status-critical', 'bg-status-warning', 'bg-status-success'].map((c) => (
              <span key={c} className={cn('h-2.5 w-2.5 rounded-full', c)} />
            ))}
          </span>
          <span className="ml-space-sm rounded-md bg-white px-space-sm py-0.5 font-label-xs text-label-xs text-on-surface-variant">
            biteflow.app/app/dashboard
          </span>
        </div>

        <div className="flex">
          <div className="hidden w-32 shrink-0 flex-col gap-space-xs border-r border-slate-200 bg-surface-container-low/60 p-space-sm sm:flex">
            {[
              { icon: 'grid_view', active: true },
              { icon: 'receipt_long' },
              { icon: 'soup_kitchen' },
              { icon: 'table_restaurant' },
              { icon: 'restaurant_menu' },
              { icon: 'insights' },
            ].map((n, i) => (
              <span
                key={i}
                className={cn(
                  'flex h-7 items-center rounded-md px-space-sm',
                  n.active ? 'bg-primary-container text-on-primary-container' : 'bg-white/70',
                )}
              >
                <Icon name={n.icon} size={15} />
              </span>
            ))}
          </div>

          <div className="flex-1 p-space-md">
            <div className="grid grid-cols-2 gap-space-sm">
              {[
                { label: "Today's sales", value: '₹42,850', icon: 'payments' },
                { label: 'Active orders', value: '128', icon: 'receipt' },
                { label: 'Avg order value', value: '₹540', icon: 'sell' },
                { label: 'Tables · 18/24', value: '75%', icon: 'table_restaurant' },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs text-[10px] uppercase tracking-wider text-slate-400">
                      {m.label}
                    </span>
                    <Icon name={m.icon} size={14} className="text-primary" />
                  </div>
                  <span className="tabular font-headline-sm text-headline-sm font-bold text-slate-900">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-space-sm rounded-xl border border-slate-200 bg-white p-space-md">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-[10px] uppercase tracking-wider text-slate-400">
                  Revenue by hour
                </span>
                <Badge tone="brand">Live</Badge>
              </div>
              <div className="mt-space-sm flex h-24 items-end gap-1">
                {[18, 32, 40, 52, 92, 84, 48, 28, 35, 44, 60, 98, 89, 55, 40].map((h, i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex-1 rounded-t-sm',
                      h > 80 ? 'bg-primary' : 'bg-surface-container-highest',
                    )}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating KDS card */}
      <div className="absolute -bottom-6 -left-4 hidden w-56 rounded-2xl border border-slate-200 bg-white p-space-md shadow-e3 sm:block">
        <div className="flex items-center justify-between">
          <span className="rounded bg-primary px-space-xs py-0.5 font-label-xs text-label-xs font-bold text-white">
            T-04
          </span>
          <Badge tone="warning" icon="skillet">
            Preparing
          </Badge>
        </div>
        <p className="mt-space-sm font-label-sm text-label-sm font-bold text-slate-900">BF-1042</p>
        <p className="font-label-xs text-label-xs text-slate-500">2× Truffle Brioche Burger</p>
        <p className="font-label-xs text-label-xs text-slate-500">1× Iced Hazelnut Latte</p>
        <div className="mt-space-sm flex items-center gap-space-xs">
          <Icon name="schedule" size={13} className="text-primary" />
          <span className="font-label-xs text-label-xs text-slate-500">8 mins ago</span>
        </div>
      </div>

      {/* Floating service request card */}
      <div className="absolute -right-3 top-8 hidden w-48 rounded-2xl border border-slate-200 bg-white p-space-sm shadow-e3 lg:block">
        <div className="flex items-center gap-space-xs">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-critical-bg text-status-critical">
            <Icon name="room_service" size={15} />
          </span>
          <div className="flex flex-col">
            <span className="font-label-xs text-label-xs font-bold text-slate-900">T-02 · Water</span>
            <span className="font-label-xs text-[10px] text-slate-500">2 mins ago</span>
          </div>
        </div>
      </div>
    </div>
  )
}
