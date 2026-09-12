import { useMemo, useState } from 'react'
import {
  BarChart,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  DonutChart,
  EmptyState,
  FoodThumb,
  Icon,
  LineChart,
  MetricCard,
  ProgressBar,
  SegmentedControl,
  StatDelta,
  useToast,
  type Column,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import { withinWindow } from '@/data/metrics'
import { formatMoney, formatNumber, percentDelta } from '@/lib/format'
import type { Order } from '@/lib/types'

type Range = 1 | 7 | 30 | 90

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 1, label: 'Today' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

export function AnalyticsPage() {
  const { orders, tables, customers, menuItems, categories, metrics, organization } = useAppStore()
  const toast = useToast()
  const [range, setRange] = useState<Range>(30)
  const currency = organization?.branding.currency ?? 'INR'

  const scoped = useMemo(() => withinWindow(orders, range), [orders, range])
  const previous = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - range * 2)
    cutoff.setHours(0, 0, 0, 0)
    const start = new Date()
    start.setDate(start.getDate() - range)
    start.setHours(0, 0, 0, 0)
    return orders.filter((o) => {
      const t = new Date(o.placedAt).getTime()
      return t >= cutoff.getTime() && t < start.getTime()
    })
  }, [orders, range])

  const revenue = scoped.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)
  const prevRevenue = previous.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)
  const aov = scoped.length ? revenue / scoped.filter((o) => o.status !== 'cancelled').length : 0
  const prevAov = previous.length ? prevRevenue / previous.filter((o) => o.status !== 'cancelled').length : 0
  const cancelled = scoped.filter((o) => o.status === 'cancelled').length
  const cancellationRate = scoped.length ? (cancelled / scoped.length) * 100 : 0

  const dailyTrend = useMemo(() => {
    const days = Math.min(range, 30)
    return Array.from({ length: days }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      d.setHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      const bucket = scoped.filter((o) => {
        const t = new Date(o.placedAt).getTime()
        return t >= d.getTime() && t < next.getTime() && o.status !== 'cancelled'
      })
      return {
        label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        value: bucket.reduce((s, o) => s + o.total, 0),
      }
    })
  }, [scoped, range])

  const hourlyBuckets = useMemo(() => {
    const buckets = new Map<number, number>()
    scoped
      .filter((o) => o.status !== 'cancelled')
      .forEach((o) => {
        const h = new Date(o.placedAt).getHours()
        buckets.set(h, (buckets.get(h) ?? 0) + o.total)
      })
    return Array.from({ length: 17 }, (_, i) => i + 7).map((h) => ({
      label: `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`,
      value: buckets.get(h) ?? 0,
    }))
  }, [scoped])

  const menuEngineering = useMemo(() => {
    const tally = new Map<string, { qty: number; revenue: number; cost: number }>()
    scoped
      .filter((o) => o.status !== 'cancelled')
      .forEach((o) =>
        o.items.forEach((line) => {
          const prev = tally.get(line.name) ?? { qty: 0, revenue: 0, cost: 0 }
          const menuItem = menuItems.find((m) => m.name === line.name)
          tally.set(line.name, {
            qty: prev.qty + line.quantity,
            revenue: prev.revenue + line.lineTotal,
            cost: prev.cost + line.quantity * (menuItem ? menuItem.price * 0.32 : line.unitPrice * 0.32),
          })
        }),
      )
    return [...tally.entries()]
      .map(([name, stat]) => ({
        name,
        quantity: stat.qty,
        revenue: stat.revenue,
        margin: stat.revenue ? ((stat.revenue - stat.cost) / stat.revenue) * 100 : 0,
        category: menuItems.find((m) => m.name === name)?.categoryId ?? '',
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [scoped, menuItems])

  const categoryPerformance = useMemo(() => {
    const tally = new Map<string, number>()
    menuEngineering.forEach((row) => {
      const name = categories.find((c) => c.id === row.category)?.name ?? 'Uncategorised'
      tally.set(name, (tally.get(name) ?? 0) + row.revenue)
    })
    const total = [...tally.values()].reduce((s, v) => s + v, 0) || 1
    const palette = [
      'var(--color-primary)',
      'var(--color-secondary)',
      'var(--color-status-warning)',
      'var(--color-status-success)',
      'var(--color-status-info)',
      'var(--color-tertiary)',
    ]
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label,
        value,
        share: Math.round((value / total) * 100),
        color: palette[i % palette.length],
      }))
  }, [menuEngineering, categories])

  const peak = hourlyBuckets.reduce((best, cur) => (cur.value > best.value ? cur : best), hourlyBuckets[0])

  const customerColumns: Column<{ name: string; orders: number; spend: number; lastVisit: string | null }>[] = [
    { key: 'name', header: 'Customer', sortValue: (r) => r.name, render: (r) => (
      <span className="font-label-md text-label-md font-semibold text-on-surface">{r.name}</span>
    ) },
    { key: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orders, render: (r) => (
      <span className="tabular font-label-sm text-label-sm text-on-surface">{r.orders}</span>
    ) },
    { key: 'spend', header: 'Spend', align: 'right', sortValue: (r) => r.spend, render: (r) => (
      <span className="tabular font-label-md text-label-md font-bold text-on-surface">
        {formatMoney(r.spend, currency)}
      </span>
    ) },
    { key: 'avg', header: 'Avg ticket', align: 'right', hideBelow: 'sm' as const, render: (r) => (
      <span className="tabular font-body-sm text-body-sm text-on-surface-variant">
        {formatMoney(r.orders ? r.spend / r.orders : 0, currency)}
      </span>
    ) },
  ]

  if (!orders.length) {
    return (
      <EmptyState
        icon="insights"
        title="No data to analyse yet"
        description="Analytics populate as soon as your first orders land."
      />
    )
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Analytics</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {range === 1 ? 'Today' : `Last ${range} days`} · {scoped.length} orders in scope
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <SegmentedControl
            value={String(range)}
            onChange={(value) => setRange(Number(value) as Range)}
            options={RANGE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
          />
          <Button
            variant="secondary"
            icon="download"
            onClick={() => toast.info('Report export is not wired up in the prototype')}
          >
            Export report
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-space-lg sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={formatMoney(revenue, currency)}
          icon="payments"
          delta={percentDelta(revenue, prevRevenue)}
          hint="vs previous period"
        />
        <MetricCard
          label="Orders"
          value={scoped.length}
          icon="receipt_long"
          delta={percentDelta(scoped.length, previous.length)}
          hint="vs previous period"
        />
        <MetricCard
          label="Average order value"
          value={formatMoney(aov, currency)}
          icon="sell"
          delta={percentDelta(aov, prevAov)}
          hint="basket size"
        />
        <MetricCard
          label="Cancellation rate"
          value={`${cancellationRate.toFixed(1)}%`}
          icon="cancel"
          tone={cancellationRate > 8 ? 'warning' : 'success'}
          hint={`${cancelled} cancelled orders`}
        />
      </section>

      {/* --------------------------------------------------------- revenue */}
      <Card className="flex flex-col gap-space-lg">
        <CardHeader
          icon="show_chart"
          title="Revenue trend"
          subtitle={`Daily gross revenue over ${Math.min(range, 30)} days`}
          badge={<Badge tone="info">Gross</Badge>}
        />
        <LineChart data={dailyTrend} currency={currency} />
      </Card>

      <div className="grid gap-space-lg lg:grid-cols-2">
        <Card className="flex flex-col gap-space-md">
          <CardHeader
            icon="schedule"
            title="Peak ordering hours"
            subtitle={`Busiest window: ${peak?.label ?? '—'}`}
          />
          <BarChart
            data={hourlyBuckets.map((b) => ({
              ...b,
              highlight: b.label === peak?.label && b.value > 0,
            }))}
            currency={currency}
          />
        </Card>

        <Card className="flex flex-col gap-space-md">
          <CardHeader icon="donut_small" title="Category performance" subtitle="Share of revenue" />
          {categoryPerformance.length ? (
            <>
              <div className="flex justify-center py-space-sm">
                <DonutChart
                  segments={categoryPerformance.slice(0, 6).map((c) => ({
                    label: c.label,
                    value: c.value,
                    color: c.color,
                  }))}
                  centerValue={formatMoney(revenue, currency, { compact: true })}
                  centerLabel="Revenue"
                />
              </div>
              <div className="flex flex-col gap-space-xs">
                {categoryPerformance.slice(0, 6).map((c) => (
                  <div key={c.label} className="flex items-center justify-between gap-space-sm">
                    <span className="flex items-center gap-space-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      <span className="font-body-sm text-body-sm text-on-surface">{c.label}</span>
                    </span>
                    <span className="flex items-center gap-space-md">
                      <span className="font-label-xs text-label-xs text-on-surface-variant">{c.share}%</span>
                      <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface">
                        {formatMoney(c.value, currency, { compact: true })}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon="pie_chart" title="No category data" description="Sell a few dishes to see the split." />
          )}
        </Card>
      </div>

      {/* ---------------------------------------------------------- tables */}
      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Card padded={false} className="flex flex-col overflow-hidden">
          <div className="p-space-lg">
            <CardHeader
              icon="restaurant_menu"
              title="Menu engineering"
              subtitle="Revenue, volume and estimated margin per dish"
              badge={<Badge tone="brand">Top {Math.min(menuEngineering.length, 10)}</Badge>}
            />
          </div>
          <DataTable
            columns={[
              {
                key: 'dish',
                header: 'Dish',
                sortValue: (r) => r.name,
                render: (r) => (
                  <div className="flex items-center gap-space-sm">
                    <FoodThumb name={r.name} size={34} />
                    <span className="font-label-sm text-label-sm font-semibold text-on-surface">{r.name}</span>
                  </div>
                ),
              },
              {
                key: 'qty',
                header: 'Sold',
                align: 'right',
                sortValue: (r) => r.quantity,
                render: (r) => <span className="tabular font-label-sm text-label-sm">{r.quantity}</span>,
              },
              {
                key: 'revenue',
                header: 'Revenue',
                align: 'right',
                sortValue: (r) => r.revenue,
                render: (r) => (
                  <span className="tabular font-label-md text-label-md font-bold text-on-surface">
                    {formatMoney(r.revenue, currency)}
                  </span>
                ),
              },
              {
                key: 'margin',
                header: 'Est. margin',
                align: 'right',
                sortValue: (r) => r.margin,
                render: (r) => (
                  <span className="flex flex-col items-end gap-space-xs">
                    <span
                      className={cn(
                        'tabular font-label-sm text-label-sm font-semibold',
                        r.margin > 65 ? 'text-status-success' : r.margin > 55 ? 'text-status-warning' : 'text-status-critical',
                      )}
                    >
                      {r.margin.toFixed(0)}%
                    </span>
                    <ProgressBar
                      value={r.margin}
                      max={100}
                      tone={r.margin > 65 ? 'success' : r.margin > 55 ? 'warning' : 'critical'}
                      className="w-16"
                    />
                  </span>
                ),
              },
            ]}
            rows={menuEngineering.slice(0, 10)}
            rowKey={(r) => r.name}
            empty={<EmptyState icon="restaurant_menu" title="No dish sales yet" />}
          />
        </Card>

        <div className="flex flex-col gap-space-lg">
          <Card className="flex flex-col gap-space-md">
            <CardHeader icon="table_restaurant" title="Table utilisation" subtitle="Current floor state" />
            <div className="flex flex-col gap-space-sm">
              {[
                { label: 'Occupied', value: tables.filter((t) => t.status === 'occupied').length, tone: 'warning' as const },
                { label: 'Available', value: tables.filter((t) => t.status === 'available').length, tone: 'success' as const },
                { label: 'Reserved', value: tables.filter((t) => t.status === 'reserved').length, tone: 'brand' as const },
                { label: 'Cleaning', value: tables.filter((t) => t.status === 'cleaning').length, tone: 'brand' as const },
              ].map((row) => (
                <div key={row.label} className="flex flex-col gap-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{row.label}</span>
                    <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface">
                      {row.value} / {tables.length}
                    </span>
                  </div>
                  <ProgressBar value={row.value} max={tables.length || 1} tone={row.tone} />
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-surface-container-low p-space-md">
              <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                Utilisation now
              </span>
              <p className="tabular font-mono-metric text-mono-metric font-bold text-on-surface">
                {metrics.tableUtilization}%
              </p>
            </div>
          </Card>

          <Card className="flex flex-col gap-space-md">
            <CardHeader icon="soup_kitchen" title="Kitchen throughput" subtitle="Preparation performance" />
            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-space-md">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Average prep time</span>
                <span className="tabular font-headline-sm text-headline-sm font-bold text-on-surface">
                  {metrics.avgPrepMinutes}m
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-space-md">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Orders in window</span>
                <span className="tabular font-headline-sm text-headline-sm font-bold text-on-surface">
                  {formatNumber(scoped.length)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-space-md">
                <span className="font-label-sm text-label-sm text-on-surface-variant">On-time rate</span>
                <span className="flex flex-col items-end">
                  <span className="tabular font-headline-sm text-headline-sm font-bold text-status-success">
                    {Math.max(0, 100 - cancellationRate).toFixed(0)}%
                  </span>
                  <StatDelta value={percentDelta(revenue, prevRevenue)} />
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* --------------------------------------------------------- customers */}
      <Card padded={false} className="flex flex-col overflow-hidden">
        <div className="p-space-lg">
          <CardHeader
            icon="group"
            title="Top customers"
            subtitle={`${customers.length} guests · ${metrics.newCustomers} new in the last 30 days`}
          />
        </div>
        <DataTable
          columns={customerColumns}
          rows={customers.slice(0, 8).map((c) => ({
            name: c.name,
            orders: c.totalOrders,
            spend: c.totalSpend,
            lastVisit: c.lastVisitAt,
          }))}
          rowKey={(r) => r.name}
          empty={<EmptyState icon="group" title="No customer data yet" />}
        />
      </Card>
    </div>
  )
}
