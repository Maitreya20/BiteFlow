import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Divider,
  DonutChart,
  Icon,
  LineChart,
  MetricCard,
  ProgressBar,
  type ChartPoint,
  type Column,
} from '@/components/ui'
import { useAppStore } from '@/store/AppStore'
import { PLANS, PLAN_LIST } from '@/lib/plans'
import { formatDate, formatMoney, formatNumber, relativeTime } from '@/lib/format'
import type { AuditLog, Organization, SubscriptionStatus } from '@/lib/types'

export const STATUS_TONE: Record<SubscriptionStatus, 'success' | 'info' | 'warning' | 'critical'> = {
  active: 'success',
  trialing: 'info',
  past_due: 'warning',
  cancelled: 'critical',
  expired: 'critical',
}

export const PLAN_COLOR: Record<string, string> = {
  starter: '#94A3B8',
  growth: '#EA580C',
  pro: '#1E293B',
  enterprise: '#0EA5E9',
}

export interface TenantRow {
  org: Organization
  plan: (typeof PLANS)[keyof typeof PLANS]
  team: number
  orders: number
  revenue: number
  tables: number
  customers: number
}

/** Derive per-tenant rollups from the platform dataset (prd.md §24). */
export function useTenantRows(): TenantRow[] {
  const { db } = useAppStore()
  return useMemo(
    () =>
      db.organizations.map((org) => {
        const orders = db.orders.filter((o) => o.organizationId === org.id)
        return {
          org,
          plan: PLANS[org.planId],
          team: db.memberships.filter((m) => m.organizationId === org.id).length,
          orders: orders.length,
          revenue: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
          tables: db.tables.filter((t) => t.organizationId === org.id).length,
          customers: db.customers.filter((c) => c.organizationId === org.id).length,
        }
      }),
    [db],
  )
}

const HEALTH = [
  { name: 'API gateway', detail: 'ap-south-1 · p95 128 ms', status: 'Operational', tone: 'success' as const },
  { name: 'Postgres (Supabase)', detail: 'Replication healthy · 42% storage', status: 'Operational', tone: 'success' as const },
  { name: 'Realtime channel', detail: '4 tables streaming · 0 dropped', status: 'Operational', tone: 'success' as const },
  { name: 'QR menu CDN', detail: 'Cache hit rate 97.4%', status: 'Degraded', tone: 'warning' as const },
  { name: 'Payment webhooks', detail: 'Last event 4m ago', status: 'Operational', tone: 'success' as const },
  { name: 'Nightly backups', detail: '03:00 IST · verified 11 Sep', status: 'Operational', tone: 'success' as const },
]

export function AdminOverview() {
  const { db, session, switchOrganization } = useAppStore()
  const tenantRows = useTenantRows()

  const platform = useMemo(() => {
    const orgs = db.organizations
    const paying = orgs.filter((o) => o.subscriptionStatus === 'active')
    const trialing = orgs.filter((o) => o.subscriptionStatus === 'trialing')
    const atRisk = orgs.filter((o) => o.subscriptionStatus === 'past_due' || o.subscriptionStatus === 'cancelled')
    const mrr = paying.reduce((s, o) => s + PLANS[o.planId].priceMonthly, 0)
    const mrrLast = Math.round(mrr * 0.912)
    const orders = db.orders
    const gmv = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000
    return {
      tenants: orgs.length,
      paying: paying.length,
      trialing: trialing.length,
      atRisk: atRisk.length,
      mrr,
      mrrLast,
      orders: orders.length,
      gmv,
      signups: orgs.filter((o) => new Date(o.createdAt).getTime() >= since).length,
      accounts: db.profiles.length,
      planMix: PLAN_LIST.map((p) => ({
        label: p.name,
        value: orgs.filter((o) => o.planId === p.id).length,
        color: PLAN_COLOR[p.id],
      })).filter((s) => s.value > 0),
    }
  }, [db])

  /** New tenants per month for the last 6 months. */
  const signupTrend: ChartPoint[] = useMemo(() => {
    const out: ChartPoint[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date()
      start.setDate(1)
      start.setMonth(start.getMonth() - i)
      const end = new Date(start)
      end.setMonth(end.getMonth() + 1)
      out.push({
        label: start.toLocaleDateString('en-IN', { month: 'short' }),
        value: db.organizations.filter((o) => {
          const t = new Date(o.createdAt).getTime()
          return t >= start.getTime() && t < end.getTime()
        }).length,
      })
    }
    return out
  }, [db.organizations])

  /** Platform order value over the last 14 days. */
  const gmvTrend: ChartPoint[] = useMemo(() => {
    const out: ChartPoint[] = []
    for (let i = 13; i >= 0; i--) {
      const ref = new Date()
      ref.setDate(ref.getDate() - i)
      out.push({
        label: ref.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        value: db.orders
          .filter((o) => {
            const d = new Date(o.placedAt)
            return (
              o.status !== 'cancelled' &&
              d.getFullYear() === ref.getFullYear() &&
              d.getMonth() === ref.getMonth() &&
              d.getDate() === ref.getDate()
            )
          })
          .reduce((s, o) => s + o.total, 0),
      })
    }
    return out
  }, [db.orders])

  const recent: TenantRow[] = useMemo(
    () =>
      [...tenantRows]
        .sort((a, b) => +new Date(b.org.createdAt) - +new Date(a.org.createdAt))
        .slice(0, 5),
    [tenantRows],
  )

  const columns: Column<TenantRow>[] = [
    {
      key: 'tenant',
      header: 'Restaurant',
      sortValue: (r) => r.org.name,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-semibold text-on-surface">{r.org.name}</span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">/{r.org.slug}</span>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      sortValue: (r) => r.plan.name,
      render: (r) => <Badge tone="neutral">{r.plan.name}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge tone={STATUS_TONE[r.org.subscriptionStatus]} dot>
          {r.org.subscriptionStatus}
        </Badge>
      ),
      hideBelow: 'sm',
    },
    {
      key: 'mrr',
      header: 'MRR',
      align: 'right',
      sortValue: (r) => r.plan.priceMonthly,
      render: (r) => (
        <span className="tabular font-label-md text-label-md font-semibold">
          {formatMoney(r.plan.priceMonthly)}
        </span>
      ),
      hideBelow: 'md',
    },
    {
      key: 'created',
      header: 'Joined',
      align: 'right',
      sortValue: (r) => r.org.createdAt,
      render: (r) => (
        <span className="font-body-sm text-body-sm text-on-surface-variant">{formatDate(r.org.createdAt)}</span>
      ),
    },
  ]

  const recentActivity: AuditLog[] = db.auditLogs.slice(0, 6)

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            Platform Overview
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            All tenants, revenue and infrastructure health · {session?.user.fullName ?? 'Super Admin'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Button variant="secondary" icon="download">
            Export report
          </Button>
          <Link to="/admin/tenants">
            <Button icon="storefront">Manage tenants</Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Monthly recurring revenue"
          value={formatMoney(platform.mrr, 'INR', { compact: true })}
          icon="payments"
          delta={((platform.mrr - platform.mrrLast) / Math.max(1, platform.mrrLast)) * 100}
          hint="vs last month"
        />
        <MetricCard
          label="Active tenants"
          value={formatNumber(platform.tenants)}
          icon="storefront"
          hint={`${platform.paying} paying · ${platform.trialing} trialling`}
          tone="info"
        />
        <MetricCard
          label="Orders processed"
          value={formatNumber(platform.orders)}
          icon="receipt_long"
          hint={`${formatMoney(platform.gmv, 'INR', { compact: true })} lifetime GMV`}
          tone="success"
        />
        <MetricCard
          label="Accounts at risk"
          value={formatNumber(platform.atRisk)}
          icon="report"
          hint="Payment failed or cancelled"
          tone={platform.atRisk > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Platform order value"
            subtitle="Last 14 days across every tenant"
            icon="trending_up"
            action={<Badge tone="success" dot>Live</Badge>}
          />
          <div className="pt-space-md">
            <LineChart data={gmvTrend} />
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center gap-space-md">
          <CardHeader title="Plan mix" subtitle="Tenants per subscription tier" icon="donut_small" />
          <DonutChart
            segments={platform.planMix}
            centerValue={String(platform.tenants)}
            centerLabel="Tenants"
          />
          <div className="flex w-full flex-col gap-space-xs">
            {platform.planMix.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-space-sm">
                <span className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tabular font-label-sm text-label-sm font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-3">
        <Card>
          <CardHeader title="New tenants" subtitle="Signups over the last 6 months" icon="person_add" />
          <div className="flex flex-col gap-space-md pt-space-md">
            {signupTrend.map((point) => (
              <div key={point.label} className="flex items-center gap-space-md">
                <span className="w-10 font-label-sm text-label-sm text-on-surface-variant">{point.label}</span>
                <ProgressBar
                  value={point.value}
                  max={Math.max(1, ...signupTrend.map((p) => p.value))}
                  className="flex-1"
                />
                <span className="tabular w-6 text-right font-label-sm text-label-sm font-semibold">
                  {point.value}
                </span>
              </div>
            ))}
            <Divider />
            <div className="flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Signups (30 days)</span>
              <span className="font-label-md text-label-md font-bold">{platform.signups}</span>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Infrastructure health"
            subtitle="Live status of the shared BaaS stack"
            icon="monitor_heart"
          />
          <div className="flex flex-col divide-y divide-slate-200 pt-space-sm">
            {HEALTH.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-space-md py-space-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="font-label-md text-label-md font-semibold text-on-surface">{row.name}</span>
                  <span className="truncate font-label-xs text-label-xs text-on-surface-variant">{row.detail}</span>
                </div>
                <Badge tone={row.tone} dot>
                  {row.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Newest tenants"
            subtitle="Latest restaurants to join the platform"
            icon="storefront"
            action={
              <Link
                to="/admin/tenants"
                className="flex items-center gap-1 font-label-sm text-label-sm font-semibold text-primary hover:underline"
              >
                View all <Icon name="arrow_forward" size={15} />
              </Link>
            }
          />
          <div className="pt-space-sm">
            <DataTable
              columns={columns}
              rows={recent}
              rowKey={(r) => r.org.id}
              density="compact"
              onRowClick={(r) => {
                switchOrganization(r.org.id)
              }}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" subtitle="Cross-tenant audit stream" icon="history" />
          <div className="flex flex-col gap-space-md pt-space-md">
            {recentActivity.map((log) => (
              <div key={log.id} className="flex items-start gap-space-sm">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <Icon name="bolt" size={15} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="font-body-sm text-body-sm text-on-surface">{log.summary}</span>
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    {log.actorName} · {relativeTime(log.createdAt)}
                  </span>
                </div>
              </div>
            ))}
            <Link
              to="/admin/audit"
              className="flex items-center gap-1 font-label-sm text-label-sm font-semibold text-primary hover:underline"
            >
              Open audit log <Icon name="arrow_forward" size={15} />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
