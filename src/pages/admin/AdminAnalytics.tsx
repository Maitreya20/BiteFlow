import { useMemo, useState } from 'react'
import {
  BarChart,
  Badge,
  Card,
  CardHeader,
  DataTable,
  DonutChart,
  Icon,
  LineChart,
  MetricCard,
  ProgressBar,
  SegmentedControl,
  type ChartPoint,
  type Column,
} from '@/components/ui'
import { PLAN_COLOR, useTenantRows, type TenantRow } from './AdminOverview'
import { useAppStore } from '@/store/AppStore'
import { PLANS, PLAN_LIST } from '@/lib/plans'
import { formatMoney, formatNumber, percentDelta } from '@/lib/format'

type Window = '7' | '30' | '90'

export function AdminAnalytics() {
  const { db } = useAppStore()
  const rows = useTenantRows()
  const [window, setWindow] = useState<Window>('30')
  const days = Number(window)

  const gmvTrend: ChartPoint[] = useMemo(() => {
    const out: ChartPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
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
  }, [db.orders, days])

  const windowStats = useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const prevCutoff = cutoff - days * 24 * 60 * 60 * 1000
    const inWindow = db.orders.filter((o) => new Date(o.placedAt).getTime() >= cutoff && o.status !== 'cancelled')
    const prev = db.orders.filter(
      (o) =>
        new Date(o.placedAt).getTime() >= prevCutoff &&
        new Date(o.placedAt).getTime() < cutoff &&
        o.status !== 'cancelled',
    )
    const gmv = inWindow.reduce((s, o) => s + o.total, 0)
    const prevGmv = prev.reduce((s, o) => s + o.total, 0)
    return {
      gmv,
      gmvDelta: percentDelta(gmv, prevGmv),
      orders: inWindow.length,
      ordersDelta: percentDelta(inWindow.length, prev.length),
      aov: inWindow.length ? Math.round(gmv / inWindow.length) : 0,
      perTenant: rows.length ? Math.round(gmv / rows.length) : 0,
    }
  }, [db.orders, days, rows.length])

  const ordersPerTenant: ChartPoint[] = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 8)
        .map((r) => ({ label: r.org.name.split(' ')[0], value: r.orders, note: r.org.name })),
    [rows],
  )

  const gmvPerTenant: ChartPoint[] = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8)
        .map((r) => ({ label: r.org.name.split(' ')[0], value: r.revenue, note: r.org.name })),
    [rows],
  )

  const planMix = useMemo(
    () =>
      PLAN_LIST.map((p) => ({
        label: p.name,
        value: rows.filter((r) => r.org.planId === p.id).length,
        color: PLAN_COLOR[p.id],
      })).filter((s) => s.value > 0),
    [rows],
  )

  const channelMix = useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const orders = db.orders.filter((o) => new Date(o.placedAt).getTime() >= cutoff && o.status !== 'cancelled')
    const total = Math.max(1, orders.reduce((s, o) => s + o.total, 0))
    return (['dine_in', 'takeaway', 'delivery'] as const).map((channel) => {
      const bucket = orders.filter((o) => o.channel === channel)
      const revenue = bucket.reduce((s, o) => s + o.total, 0)
      return {
        channel,
        label: channel === 'dine_in' ? 'Dine-in QR' : channel === 'takeaway' ? 'Takeaway' : 'Delivery',
        orders: bucket.length,
        revenue,
        share: Math.round((revenue / total) * 100),
      }
    })
  }, [db.orders, days])

  const retention = useMemo(() => {
    const thirty = Date.now() - 30 * 24 * 60 * 60 * 1000
    const newCustomers = db.customers.filter((c) => new Date(c.createdAt).getTime() >= thirty).length
    const returning = Math.max(0, db.customers.length - newCustomers)
    const loyalty = db.customers.reduce((s, c) => s + c.loyaltyPoints, 0)
    const repeatRate = db.customers.length ? (returning / db.customers.length) * 100 : 0
    return { newCustomers, returning, loyalty, repeatRate }
  }, [db.customers])

  const leaderboard: Column<TenantRow>[] = [
    {
      key: 'rank',
      header: '#',
      width: '48px',
      render: (r) => (
        <span className="tabular font-label-sm text-label-sm text-on-surface-variant">
          {[...rows].sort((a, b) => b.revenue - a.revenue).indexOf(r) + 1}
        </span>
      ),
    },
    {
      key: 'tenant',
      header: 'Restaurant',
      sortValue: (r) => r.org.name,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-semibold text-on-surface">{r.org.name}</span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">{r.plan.name} plan</span>
        </div>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      sortValue: (r) => r.orders,
      render: (r) => <span className="tabular font-body-sm text-body-sm">{formatNumber(r.orders)}</span>,
      hideBelow: 'sm' as const,
    },
    {
      key: 'aov',
      header: 'AOV',
      align: 'right',
      sortValue: (r) => (r.orders ? r.revenue / r.orders : 0),
      render: (r) => (
        <span className="tabular font-body-sm text-body-sm">
          {formatMoney(r.orders ? r.revenue / r.orders : 0)}
        </span>
      ),
      hideBelow: 'md' as const,
    },
    {
      key: 'gmv',
      header: 'GMV',
      align: 'right',
      sortValue: (r) => r.revenue,
      render: (r) => (
        <span className="tabular font-label-md text-label-md font-semibold">{formatMoney(r.revenue)}</span>
      ),
    },
    {
      key: 'share',
      header: 'Share',
      render: (r) => {
        const total = Math.max(1, rows.reduce((s, x) => s + x.revenue, 0))
        return (
          <div className="flex w-24 items-center gap-space-xs">
            <ProgressBar value={r.revenue} max={total} className="flex-1" />
            <span className="tabular font-label-xs text-label-xs text-on-surface-variant">
              {Math.round((r.revenue / total) * 100)}%
            </span>
          </div>
        )
      },
      hideBelow: 'lg' as const,
    },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Platform Analytics</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Cross-tenant demand, revenue quality and retention — prd.md §22
          </p>
        </div>
        <SegmentedControl
          value={window}
          onChange={setWindow}
          options={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
          ]}
        />
      </header>

      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={`GMV · last ${days}d`}
          value={formatMoney(windowStats.gmv, 'INR', { compact: true })}
          icon="stacked_line_chart"
          delta={windowStats.gmvDelta}
          hint="vs previous period"
          tone="success"
        />
        <MetricCard
          label="Orders"
          value={formatNumber(windowStats.orders)}
          icon="receipt_long"
          delta={windowStats.ordersDelta}
          hint="vs previous period"
        />
        <MetricCard
          label="Average order value"
          value={formatMoney(windowStats.aov)}
          icon="shopping_bag"
          tone="info"
        />
        <MetricCard
          label="GMV per tenant"
          value={formatMoney(windowStats.perTenant)}
          icon="storefront"
          hint={`${rows.length} active tenants`}
          tone="neutral"
        />
      </div>

      <Card>
        <CardHeader
          title="Gross order value"
          subtitle={`Daily platform-wide GMV over the last ${days} days`}
          icon="show_chart"
          action={<Badge tone="success" dot>Live</Badge>}
        />
        <div className="pt-space-md">
          <LineChart data={gmvTrend} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Orders per tenant"
            subtitle="Top 8 tenants by volume"
            icon="bar_chart"
          />
          <div className="pt-space-md">
            <BarChart
              data={ordersPerTenant}
              currency="INR"
              valueFormatter={(v) => `${formatNumber(v)} orders`}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="GMV per tenant" subtitle="Top 8 tenants by revenue" icon="payments" />
          <div className="pt-space-md">
            <BarChart data={gmvPerTenant} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-3">
        <Card className="flex flex-col items-center gap-space-md">
          <CardHeader title="Plan distribution" subtitle="Tenants per tier" icon="donut_small" />
          <DonutChart segments={planMix} centerValue={String(rows.length)} centerLabel="Tenants" />
          <div className="flex w-full flex-col gap-space-xs">
            {planMix.map((s) => (
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

        <Card>
          <CardHeader title="Order channel mix" subtitle={`Revenue split · last ${days} days`} icon="call_split" />
          <div className="flex flex-col gap-space-md pt-space-md">
            {channelMix.map((c) => (
              <div key={c.channel} className="flex flex-col gap-space-xs">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">{c.label}</span>
                  <span className="tabular font-label-sm text-label-sm text-on-surface-variant">
                    {formatMoney(c.revenue, 'INR', { compact: true })} · {c.share}%
                  </span>
                </div>
                <ProgressBar value={c.share} tone={c.channel === 'dine_in' ? 'brand' : 'success'} />
                <span className="font-label-xs text-label-xs text-on-surface-variant">
                  {formatNumber(c.orders)} orders
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Guest retention" subtitle="Platform-wide CRM health" icon="favorite" />
          <div className="flex flex-col gap-space-md pt-space-md">
            <div className="flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Repeat guests</span>
              <span className="tabular font-label-md text-label-md font-bold">
                {retention.repeatRate.toFixed(0)}%
              </span>
            </div>
            <ProgressBar value={retention.repeatRate} tone={retention.repeatRate >= 60 ? 'success' : 'warning'} />
            <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
              {[
                { label: 'New (30d)', value: formatNumber(retention.newCustomers) },
                { label: 'Returning', value: formatNumber(retention.returning) },
                { label: 'Total guests', value: formatNumber(db.customers.length) },
                { label: 'Points issued', value: formatNumber(retention.loyalty) },
              ].map((s) => (
                <div key={s.label} className="flex flex-col gap-0.5 rounded-xl bg-surface-container-low p-space-sm">
                  <span className="font-label-xs text-label-xs text-on-surface-variant">{s.label}</span>
                  <span className="tabular font-label-md text-label-md font-bold">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="border-b border-slate-200 p-space-lg">
          <CardHeader
            title="Tenant leaderboard"
            subtitle="Ranked by lifetime gross order value"
            icon="leaderboard"
            action={
              <span className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                <Icon name="info" size={15} />
                Lifetime figures
              </span>
            }
          />
        </div>
        <DataTable columns={leaderboard} rows={[...rows].sort((a, b) => b.revenue - a.revenue)} rowKey={(r) => r.org.id} />
      </Card>

      <Card className="flex flex-col gap-space-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-space-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-info-bg text-status-info">
            <Icon name="analytics" size={18} />
          </span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Highest value tier is{' '}
            <strong className="text-on-surface">
              {PLANS[[...PLAN_LIST].sort((a, b) => b.priceMonthly - a.priceMonthly)[0].id].name}
            </strong>{' '}
            — {formatMoney(PLANS.enterprise.priceMonthly || PLANS.pro.priceMonthly)} average contract value.
          </p>
        </div>
      </Card>
    </div>
  )
}
