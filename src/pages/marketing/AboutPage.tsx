import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon } from '@/components/ui'

const PRINCIPLES = [
  {
    icon: 'restaurant_menu',
    title: 'Built for real service',
    copy: 'Every screen is designed for the two states that matter: calm prep and rush hour. Large targets, high contrast, no decorative clutter.',
  },
  {
    icon: 'shield',
    title: 'Isolation is not optional',
    copy: 'Each restaurant is a tenant. Authorization is enforced on the server and in the database — never by trusting a client-supplied organization id.',
  },
  {
    icon: 'bolt',
    title: 'Realtime by default',
    copy: 'A ticket accepted in the kitchen updates the waiter\'s table, the owner\'s dashboard and the guest\'s tracking screen without a refresh.',
  },
  {
    icon: 'palette',
    title: 'Brand is a first-class feature',
    copy: 'Multi-tenancy is only useful if each restaurant looks like itself. Branding drives the guest experience, not the operator console.',
  },
]

const SECURITY = [
  'Secure authentication with server-verified sessions',
  'Row-level security on every tenant-owned row',
  'Granular role-based access control, enforced server-side',
  'Input validation on every mutating endpoint',
  'Signed payment webhooks behind a provider abstraction',
  'Audit logging for privileged and financial actions',
  'Protection against IDOR and cross-tenant reference',
  'HTTPS everywhere, secrets kept out of the client bundle',
]

const STATS = [
  { label: 'Modules shipped', value: '10' },
  { label: 'Roles supported', value: '8' },
  { label: 'Screens designed', value: '40+' },
  { label: 'Tenants seeded', value: '3' },
]

export function AboutPage() {
  return (
    <div className="flex flex-col">
      <section className="px-space-lg py-space-3xl">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-space-lg">
          <Badge tone="brand" icon="info">
            About BiteFlow
          </Badge>
          <h1 className="max-w-3xl font-display-hero-mobile text-display-hero-mobile tracking-tight lg:font-headline-xl lg:text-headline-xl">
            Restaurant software that respects the people running the floor
          </h1>
          <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
            BiteFlow started from a simple observation: most restaurant tools are either beautiful
            guest experiences with no operational depth, or powerful back-office systems nobody
            enjoys using at 8pm on a Saturday. This platform is the attempt to be both.
          </p>
          <div className="grid gap-space-lg sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="tabular font-headline-xl text-headline-xl font-extrabold text-primary">
                  {s.value}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface-container-lowest px-space-lg py-space-3xl">
        <div className="mx-auto w-full max-w-[1200px]">
          <h2 className="font-headline-lg text-headline-lg tracking-tight">How we build</h2>
          <div className="mt-space-2xl grid gap-space-lg md:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <Card key={p.title} className="flex flex-col gap-space-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                  <Icon name={p.icon} size={22} />
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{p.title}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{p.copy}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-space-lg py-space-3xl">
        <div className="mx-auto grid w-full max-w-[1200px] gap-space-2xl lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-space-sm">
            <Badge tone="success" icon="verified_user">
              Security posture
            </Badge>
            <h2 className="font-headline-lg text-headline-lg tracking-tight">
              The non-negotiables we designed against
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              The product requirements make these mandatory, not aspirational. Every tenant-scoped
              query is written assuming the client is hostile.
            </p>
          </div>
          <div className="grid gap-space-sm sm:grid-cols-2">
            {SECURITY.map((item) => (
              <div
                key={item}
                className="flex items-start gap-space-sm rounded-xl border border-slate-200 bg-white p-space-md"
              >
                <Icon name="check_circle" size={17} className="mt-0.5 shrink-0 text-status-success" />
                <span className="font-body-sm text-body-sm text-on-surface-variant">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-space-lg pb-space-3xl">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-space-md rounded-3xl bg-slate-950 px-space-xl py-space-2xl text-center">
          <h2 className="font-headline-lg text-headline-lg tracking-tight text-white">
            Want to see the whole loop?
          </h2>
          <p className="max-w-xl font-body-md text-body-md text-slate-300">
            The demo walks signup, onboarding, QR ordering, kitchen and billing end to end.
          </p>
          <div className="flex flex-wrap justify-center gap-space-sm">
            <Link to="/demo">
              <Button size="lg" icon="play_circle">
                Open the demo
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                size="lg"
                variant="secondary"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Contact us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
