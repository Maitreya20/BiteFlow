import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  Icon,
  LimitMeter,
  MetricCard,
  SegmentedControl,
  Switch,
  useToast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { PLAN_COLOR, useTenantRows } from './AdminOverview'
import { PLANS, PLAN_LIST, LIMIT_LABELS } from '@/lib/plans'
import { formatMoney, formatNumber } from '@/lib/format'
import type { PlanId } from '@/lib/types'

/** Feature flags per tier — prd.md §7 feature gating. */
const FEATURE_FLAGS: { key: string; label: string; from: PlanId[] }[] = [
  { key: 'qr_ordering', label: 'QR table ordering', from: ['starter', 'growth', 'pro', 'enterprise'] },
  { key: 'digital_menu', label: 'Digital menu & QR menu', from: ['starter', 'growth', 'pro', 'enterprise'] },
  { key: 'kds', label: 'Kitchen Display System', from: ['growth', 'pro', 'enterprise'] },
  { key: 'reservations', label: 'Reservations', from: ['growth', 'pro', 'enterprise'] },
  { key: 'inventory', label: 'Inventory tracking', from: ['growth', 'pro', 'enterprise'] },
  { key: 'white_label', label: 'White-label branding', from: ['growth', 'pro', 'enterprise'] },
  { key: 'loyalty', label: 'Loyalty programme', from: ['pro', 'enterprise'] },
  { key: 'branches', label: 'Multi-branch', from: ['pro', 'enterprise'] },
  { key: 'api', label: 'API access & webhooks', from: ['pro', 'enterprise'] },
  { key: 'sso', label: 'SSO + advanced RBAC', from: ['enterprise'] },
  { key: 'sla', label: 'Dedicated SLA', from: ['enterprise'] },
]

export function AdminPlans() {
  const rows = useTenantRows()
  const toast = useToast()
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [flags, setFlags] = useState<Record<string, PlanId[]>>(
    () => Object.fromEntries(FEATURE_FLAGS.map((f) => [f.key, f.from])) as Record<string, PlanId[]>,
  )

  const stats = useMemo(() => {
    const perPlan = PLAN_LIST.map((plan) => {
      const tenants = rows.filter((r) => r.org.planId === plan.id)
      return {
        plan,
        tenants: tenants.length,
        mrr: tenants.filter((t) => t.org.subscriptionStatus === 'active').length * plan.priceMonthly,
        churned: tenants.filter((t) => t.org.subscriptionStatus === 'cancelled').length,
      }
    })
    const mrr = perPlan.reduce((s, p) => s + p.mrr, 0)
    const paying = rows.filter((r) => r.org.subscriptionStatus === 'active').length
    return {
      perPlan,
      mrr,
      paying,
      arpa: paying ? Math.round(mrr / paying) : 0,
      largest: [...perPlan].sort((a, b) => b.mrr - a.mrr)[0],
    }
  }, [rows])

  const toggleFlag = (key: string, planId: PlanId, on: boolean) => {
    setFlags((prev) => {
      const current = prev[key] ?? []
      return { ...prev, [key]: on ? [...current, planId] : current.filter((p) => p !== planId) }
    })
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Plans &amp; Pricing</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Subscription tiers, limits and feature gating across the platform
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <SegmentedControl
            value={cycle}
            onChange={setCycle}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly', icon: 'savings' },
            ]}
          />
          <Button icon="add" onClick={() => toast.info('Custom tiers are configured by the platform team')}>
            New tier
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Platform MRR" value={formatMoney(stats.mrr)} icon="payments" tone="success" />
        <MetricCard label="Paying tenants" value={formatNumber(stats.paying)} icon="verified" />
        <MetricCard label="ARPA" value={formatMoney(stats.arpa)} icon="trending_up" tone="info" />
        <MetricCard
          label="Top tier by MRR"
          value={stats.largest?.plan.name ?? '—'}
          icon="workspace_premium"
          hint={stats.largest ? `${formatMoney(stats.largest.mrr)} monthly` : undefined}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2 2xl:grid-cols-4">
        {stats.perPlan.map(({ plan, tenants, mrr, churned }) => {
          const price = cycle === 'monthly' ? plan.priceMonthly : Math.round(plan.priceYearly / 12)
          return (
            <Card
              key={plan.id}
              className={cn('flex flex-col gap-space-md', plan.recommended && 'border-primary/40 shadow-e2')}
            >
              <div className="flex items-start justify-between gap-space-sm">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-space-xs">
                    <span className="h-3 w-3 rounded-full" style={{ background: PLAN_COLOR[plan.id] }} />
                    <span className="font-headline-sm text-headline-sm font-bold">{plan.name}</span>
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{plan.tagline}</span>
                </div>
                {plan.recommended && <Badge tone="warning">Popular</Badge>}
              </div>

              <div className="flex items-end gap-1">
                {price === 0 ? (
                  <span className="font-headline-md text-headline-md font-bold">Custom</span>
                ) : (
                  <>
                    <span className="tabular font-headline-md text-headline-md font-bold">
                      {formatMoney(price)}
                    </span>
                    <span className="pb-1 font-body-sm text-body-sm text-on-surface-variant">
                      /mo{cycle === 'yearly' ? ' billed yearly' : ''}
                    </span>
                  </>
                )}
              </div>

              <Divider />

              <div className="flex flex-col gap-space-sm">
                <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Included
                </span>
                <ul className="flex flex-col gap-space-xs">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-space-xs font-body-sm text-body-sm">
                      <Icon name="check_circle" size={16} className="mt-0.5 shrink-0 text-status-success" />
                      <span className="text-on-surface">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Divider />

              <div className="flex flex-col gap-space-sm">
                <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Limits
                </span>
                {Object.entries(plan.limits).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-space-sm">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {LIMIT_LABELS[key as keyof typeof LIMIT_LABELS]}
                    </span>
                    <span className="tabular font-label-sm text-label-sm font-semibold">
                      {value >= 9999 ? 'Unlimited' : formatNumber(value)}
                    </span>
                  </div>
                ))}
              </div>

              <Divider />

              <div className="flex flex-col gap-space-sm">
                <LimitMeter
                  label="Tenants on this tier"
                  used={tenants}
                  limit={Math.max(1, ...stats.perPlan.map((p) => p.tenants)) * 1.5}
                />
                <div className="flex items-center justify-between">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Contracted MRR</span>
                  <span className="tabular font-label-md text-label-md font-bold">{formatMoney(mrr)}</span>
                </div>
                {churned > 0 && (
                  <Badge tone="critical" dot>
                    {churned} cancelled
                  </Badge>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Card padded={false}>
        <div className="border-b border-slate-200 p-space-lg">
          <CardHeader
            title="Feature gating matrix"
            subtitle="Toggle which capabilities each tier unlocks — enforced by RLS + API guards"
            icon="tune"
          />
        </div>
        <div className="scroll-slim overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-space-lg py-space-md text-left font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Capability
                </th>
                {PLAN_LIST.map((plan) => (
                  <th
                    key={plan.id}
                    className="px-space-lg py-space-md text-center font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant"
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_FLAGS.map((flag) => (
                <tr key={flag.key} className="border-b border-slate-200 last:border-0 hover:bg-slate-50/60">
                  <td className="px-space-lg py-space-md font-body-sm text-body-sm text-on-surface">{flag.label}</td>
                  {PLAN_LIST.map((plan) => {
                    const on = (flags[flag.key] ?? []).includes(plan.id)
                    return (
                      <td key={plan.id} className="px-space-lg py-space-md">
                        <div className="flex justify-center">
                          <Switch
                            checked={on}
                            onChange={(next) => {
                              toggleFlag(flag.key, plan.id, next)
                              toast.info(
                                `${next ? 'Enabled' : 'Disabled'} ${flag.label} for ${PLANS[plan.id].name}`,
                              )
                            }}
                            label={undefined}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
