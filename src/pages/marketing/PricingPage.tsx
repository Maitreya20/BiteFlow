import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon } from '@/components/ui'
import { cn } from '@/lib/cn'
import { LIMIT_LABELS, PLAN_LIST, PLANS } from '@/lib/plans'
import { formatMoney } from '@/lib/format'
import type { Plan } from '@/lib/types'

const COMPARISON: { feature: string; values: Record<Plan['id'], string | boolean> }[] = [
  { feature: 'QR table ordering', values: { starter: true, growth: true, pro: true, enterprise: true } },
  { feature: 'Digital menu', values: { starter: true, growth: true, pro: true, enterprise: true } },
  { feature: 'Kitchen Display System', values: { starter: false, growth: true, pro: true, enterprise: true } },
  { feature: 'Staff management & RBAC', values: { starter: false, growth: true, pro: true, enterprise: true } },
  { feature: 'Reservations', values: { starter: false, growth: true, pro: true, enterprise: true } },
  { feature: 'Inventory tracking', values: { starter: false, growth: true, pro: true, enterprise: true } },
  { feature: 'Custom branding', values: { starter: false, growth: true, pro: true, enterprise: true } },
  { feature: 'Loyalty programme', values: { starter: false, growth: false, pro: true, enterprise: true } },
  { feature: 'Multiple branches', values: { starter: '1', growth: '1', pro: 'Up to 5', enterprise: 'Unlimited' } },
  { feature: 'API access', values: { starter: false, growth: false, pro: true, enterprise: true } },
  { feature: 'Advanced RBAC + SSO', values: { starter: false, growth: false, pro: false, enterprise: true } },
  { feature: 'Dedicated support', values: { starter: false, growth: false, pro: 'Priority', enterprise: 'Named CSM' } },
]

const FAQS = [
  { q: 'Can I change plans later?', a: 'Yes. Upgrade or downgrade at any time from Subscription & Billing. Limits apply immediately; billing is pro-rated on the next invoice.' },
  { q: 'What happens at the end of the trial?', a: 'You pick a plan to continue. Nothing is deleted — your restaurant, menu and orders stay exactly as they were.' },
  { q: 'Do you charge per order?', a: 'No. Plans are flat monthly, and each tier includes a generous monthly order allowance before any usage conversation.' },
  { q: 'Is there an annual discount?', a: 'Two months free on annual billing across Starter, Growth and Pro. Enterprise is quoted per deployment.' },
]

export function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <div className="flex flex-col">
      <section className="px-space-lg py-space-3xl">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-space-md text-center">
          <Badge tone="brand" icon="sell">
            Pricing
          </Badge>
          <h1 className="max-w-2xl font-display-hero-mobile text-display-hero-mobile tracking-tight lg:font-headline-xl lg:text-headline-xl">
            Straightforward pricing for every floor size
          </h1>
          <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
            Start on a 14-day free trial. No card required, no per-order commission, cancel whenever.
          </p>

          <div className="mt-space-sm inline-flex items-center gap-1 rounded-xl bg-surface-container-low p-1">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn(
                'rounded-lg px-space-md py-1.5 font-label-sm text-label-sm font-semibold transition-colors',
                !annual ? 'bg-surface-container-lowest text-on-surface shadow-e1' : 'text-on-surface-variant',
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                'inline-flex items-center gap-space-xs rounded-lg px-space-md py-1.5 font-label-sm text-label-sm font-semibold transition-colors',
                annual ? 'bg-surface-container-lowest text-on-surface shadow-e1' : 'text-on-surface-variant',
              )}
            >
              Annual
              <span className="rounded-full bg-status-success-bg px-1.5 font-label-xs text-label-xs font-bold text-status-success">
                2 months free
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="px-space-lg pb-space-3xl">
        <div className="mx-auto grid w-full max-w-[1200px] gap-space-lg md:grid-cols-2 xl:grid-cols-4">
          {PLAN_LIST.map((plan) => {
            const price = annual ? plan.priceYearly : plan.priceMonthly
            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col gap-space-md',
                  plan.recommended && 'border-primary ring-2 ring-primary/25',
                )}
              >
                {plan.recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge tone="slate">Most popular</Badge>
                  </span>
                )}
                <div className="flex flex-col gap-0.5">
                  <h2 className="font-headline-md text-headline-md text-on-surface">{plan.name}</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{plan.bestFor}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  {price ? (
                    <>
                      <span className="tabular font-headline-lg text-headline-lg font-bold text-on-surface">
                        {formatMoney(price)}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        /{annual ? 'yr' : 'mo'}
                      </span>
                    </>
                  ) : (
                    <span className="font-headline-lg text-headline-lg font-bold text-on-surface">Custom</span>
                  )}
                </div>

                <p className="font-body-sm text-body-sm text-on-surface-variant">{plan.tagline}</p>

                <Link to={`/signup?plan=${plan.id}`}>
                  <Button block variant={plan.recommended ? 'primary' : 'secondary'}>
                    {plan.priceMonthly ? 'Start free trial' : 'Talk to sales'}
                  </Button>
                </Link>

                <div className="flex flex-col gap-space-xs border-t border-slate-200 pt-space-md">
                  <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Included limits
                  </span>
                  {(Object.keys(LIMIT_LABELS) as (keyof typeof LIMIT_LABELS)[])
                    .filter((k) => k !== 'maxStorageMb' && k !== 'maxCustomers')
                    .map((key) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {LIMIT_LABELS[key]}
                        </span>
                        <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface">
                          {plan.limits[key] >= 9999 ? 'Unlimited' : plan.limits[key].toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                </div>

                <ul className="flex flex-col gap-space-xs border-t border-slate-200 pt-space-md">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-space-sm">
                      <Icon name="check_circle" size={16} className="mt-0.5 shrink-0 text-status-success" />
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      </section>

      {/* -------------------------------------------------------- Comparison */}
      <section className="bg-surface-container-lowest px-space-lg py-space-3xl">
        <div className="mx-auto w-full max-w-[1200px]">
          <h2 className="font-headline-lg text-headline-lg tracking-tight">Compare every plan</h2>
          <div className="scroll-slim mt-space-lg overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-space-lg py-space-md text-left font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-500">
                    Feature
                  </th>
                  {PLAN_LIST.map((p) => (
                    <th
                      key={p.id}
                      className="px-space-lg py-space-md text-center font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-slate-200/70">
                    <td className="px-space-lg py-space-md font-body-sm text-body-sm font-medium text-on-surface">
                      {row.feature}
                    </td>
                    {PLAN_LIST.map((p) => {
                      const value = row.values[p.id]
                      return (
                        <td key={p.id} className="px-space-lg py-space-md text-center">
                          {typeof value === 'boolean' ? (
                            value ? (
                              <Icon name="check_circle" size={18} className="mx-auto text-status-success" />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )
                          ) : (
                            <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                              {value}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- FAQ */}
      <section className="px-space-lg py-space-3xl">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-space-lg">
          <h2 className="font-headline-lg text-headline-lg tracking-tight">Billing questions</h2>
          <div className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group px-space-lg py-space-md">
                <summary className="flex cursor-pointer items-center justify-between font-label-md text-label-md font-semibold text-on-surface">
                  {faq.q}
                  <Icon name="expand_more" size={20} className="text-on-surface-variant transition-transform group-open:rotate-180" />
                </summary>
                <p className="pt-space-sm font-body-sm text-body-sm text-on-surface-variant">{faq.a}</p>
              </details>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <Link to="/signup">
              <Button size="lg" iconRight="arrow_forward">
                Start your free trial
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="secondary">
                Talk to sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
