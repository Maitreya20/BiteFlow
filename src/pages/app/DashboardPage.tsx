import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Badge,
  BarChart,
  Button,
  Card,
  CardHeader,
  DonutChart,
  EmptyState,
  FoodThumb,
  Icon,
  MetricCard,
  ProgressBar,
  SegmentedControl,
  Sparkline,
  StatDelta,
  Toolbar,
} from '@/components/ui'
import { useAppStore } from '@/store/AppStore'
import { elapsed, formatMoney, formatTime, greeting, percentDelta, relativeTime } from '@/lib/format'
import { ORDER_STATUS_LABELS, SERVICE_REQUEST_LABELS, TABLE_STATUS_LABELS } from '@/lib/types'
import { cn } from '@/lib/cn'

type Range = 'today' | '7d' | '30d'

export function DashboardPage() {
  const {
    organization,
    metrics,
    orders,
    tables,
    serviceRequests,
    inventory,
    reservations,
    customers,
  } = useAppStore()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('today')

  const currency = organization?.branding.currency ?? 'INR'

  const liveOrders = useMemo(
    () => orders.filter((o) => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)),
    [orders],
  )

  const pendingRequests = useMemo(
    () => serviceRequests.filter((s) => s.status !== 'completed'),
    [serviceRequests],
  )

  const lowStock = useMemo(
    () => inventory.filter((i) => i.currentStock <= i.lowStockThreshold),
    [inventory],
  )

  const upcomingReservations = useMemo(
    () => reservations.filter((r) => r.status === 'pending' || r.status === 'confirmed').slice(0, 3),
    [reservations],
  )

  const channelSegments = metrics.channelMix
    .filter((c) => c.revenue > 0)
    .map((c, i) => ({
      label: c.label,
      value: c.revenue,
      color: ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-status-warning)'][i % 3],
    }))

  const occupancy = tables.filter((t) => t.status === 'occupied').length
  const reserved = tables.filter((t) => t.status === 'reserved').length
  const free = tables.filter((t) => t.status === 'available').length

  const hourlyData = metrics.hourly.map((h) => ({
    label: h.label,
    value: h.revenue,
    highlight: h.revenue === Math.max(...metrics.hourly.map((x) => x.revenue)) && h.revenue > 0,
    note: h.revenue === Math.max(...metrics.hourly.map((x) => x.revenue)) && h.revenue > 0 ? 'Peak' : undefined,
  }))

  return (
    <div className="flex flex-col gap-space-xl">
      {/* ------------------------------------------------------------- header */}
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-space-2xs">
          <div className="flex flex-wrap items-center gap-space-sm">
            <Badge tone="brand" dot>
              Service active
            </Badge>
            <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
              Realtime sync
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            {greeting()}, {organization?.name ?? 'there'} 👋
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Live floor velocity, kitchen load and transaction pulse for the current shift.
          </p>
        </div>

        <Toolbar>
          <SegmentedControl
            value={range}
            onChange={setRange}
            options={[
              { value: 'today', label: 'Today' },
              { value: '7d', label: '7 days' },
              { value: '30d', label: '30 days' },
            ]}
          />
          <Button variant="secondary" icon="add_circle" onClick={() => navigate('/app/menu')}>
            Add Menu Item
          </Button>
          <Button variant="secondary" icon="table_bar" onClick={() => navigate('/app/tables')}>
            New Table
          </Button>
          <Button icon="qr_code_scanner" onClick={() => navigate('/app/tables/qr')}>
            Generate QR
          </Button>
        </Toolbar>
      </header>

      {/* ------------------------------------------------------------ metrics */}
      <section className="grid grid-cols-1 gap-space-lg sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Today's sales"
          value={formatMoney(metrics.salesToday, currency)}
          icon="payments"
          delta={percentDelta(metrics.salesToday, metrics.salesYesterday)}
          hint="vs yesterday"
          footer={<Sparkline values={metrics.revenueTrend.map((r) => r.value)} className="w-full" width={180} />}
        />
        <MetricCard
          label="Orders today"
          value={metrics.ordersToday}
          icon="receipt_long"
          delta={percentDelta(metrics.ordersToday, metrics.ordersYesterday)}
          hint="vs yesterday"
          footer={
            <span className="inline-flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
              <Icon name="timer" size={15} className="text-primary" />
              Avg prep {metrics.avgPrepMinutes}m
            </span>
          }
        />
        <MetricCard
          label="Average order value"
          value={formatMoney(metrics.averageOrderValue, currency)}
          icon="sell"
          delta={metrics.aovDelta}
          hint="basket size"
        />
        <MetricCard
          label="Table utilisation"
          value={
            <span>
              {occupancy}
              <span className="font-headline-sm text-headline-sm text-on-surface-variant">
                {' / '}
                {tables.length}
              </span>
            </span>
          }
          icon="table_restaurant"
          progress={{ value: occupancy, max: tables.length || 1 }}
          hint={`${metrics.tableUtilization}% capacity · ${free} free · ${reserved} reserved`}
        />
      </section>

      {/* ------------------------------------------------- trend + top dishes */}
      <section className="grid grid-cols-1 gap-space-lg lg:grid-cols-12 lg:items-start">
        <Card className="lg:col-span-8 flex flex-col gap-space-lg">
          <CardHeader
            icon="insights"
            title="Revenue by hour"
            subtitle={`Peak window: ${metrics.peakHours} · ${range === 'today' ? 'today' : `last ${range.replace('d', ' days')}`}`}
            badge={<Badge tone="info">Live</Badge>}
          />

          {hourlyData.every((h) => h.value === 0) ? (
            <EmptyState
              icon="bar_chart"
              title="No orders in this window yet"
              description="Once the first QR order lands, hourly revenue appears here."
              action={
                <Button size="sm" icon="qr_code_2" onClick={() => navigate('/app/tables/qr')}>
                  Share a table QR
                </Button>
              }
            />
          ) : (
            <>
              <BarChart data={hourlyData} currency={currency} />
              <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-low p-space-md">
                <div className="flex flex-wrap items-center gap-space-lg">
                  {metrics.channelMix.map((c, i) => (
                    <div key={c.channel} className="flex items-center gap-space-sm">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{
                          background: ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-status-warning)'][i % 3],
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="font-label-xs text-label-xs font-semibold text-on-surface">
                          {c.label}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {c.share}% ({formatMoney(c.revenue, currency, { compact: true })})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  to="/app/analytics"
                  className="flex w-fit items-center gap-1 font-label-sm text-label-sm font-semibold text-primary hover:underline"
                >
                  Full analytics
                  <Icon name="chevron_right" size={15} />
                </Link>
              </div>
            </>
          )}
        </Card>

        <Card className="lg:col-span-4 flex flex-col gap-space-md">
          <CardHeader
            icon="leaderboard"
            title="Top performing dishes"
            subtitle="By revenue this period"
            badge={<Badge tone="brand">Top 3</Badge>}
          />
          {metrics.topItems.length === 0 ? (
            <EmptyState icon="restaurant_menu" title="No sales yet" description="Sell a dish to see it ranked here." />
          ) : (
            <div className="flex flex-col gap-space-sm">
              {metrics.topItems.slice(0, 3).map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-space-md rounded-xl bg-surface-container-low p-space-md"
                >
                  <div className="flex min-w-0 items-center gap-space-md">
                    <FoodThumb name={item.name} imageUrl={item.imageUrl} size={48} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-label-md text-label-md font-semibold text-on-surface">
                        {item.name}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {item.quantity} sold
                      </span>
                      <span className="font-label-xs text-label-xs font-semibold text-status-success">
                        {item.badge}
                      </span>
                    </div>
                  </div>
                  <span className="tabular shrink-0 font-label-md text-label-md font-bold text-on-surface">
                    {formatMoney(item.revenue, currency)}
                  </span>
                </div>
              ))}
              <Link to="/app/analytics">
                <Button variant="secondary" block iconRight="arrow_forward">
                  Menu engineering report
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </section>

      {/* -------------------------------------------- operations bottom row */}
      <section className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
        {/* Live orders */}
        <Card className="lg:col-span-5 flex flex-col gap-space-md">
          <CardHeader
            icon="receipt_long"
            title="Live orders pipeline"
            subtitle={`${liveOrders.length} ticket${liveOrders.length === 1 ? '' : 's'} in progress`}
            action={
              <Link to="/app/orders" className="font-label-xs text-label-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            }
          />
          {liveOrders.length === 0 ? (
            <EmptyState
              icon="check_circle"
              title="All caught up"
              description="No open tickets right now."
            />
          ) : (
            <div className="flex flex-col gap-space-sm">
              {liveOrders.slice(0, 3).map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => navigate('/app/orders')}
                  className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md text-left transition-colors hover:bg-surface-container"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-space-sm">
                      <span className="rounded bg-primary px-space-xs py-0.5 font-label-xs text-label-xs font-bold text-on-primary">
                        {order.tableNumber ?? 'Takeaway'}
                      </span>
                      <span className="font-label-md text-label-md font-bold text-on-surface">
                        {order.orderNumber}
                      </span>
                    </span>
                    <Badge
                      tone={
                        order.status === 'ready'
                          ? 'success'
                          : order.status === 'preparing'
                            ? 'warning'
                            : order.status === 'accepted'
                              ? 'info'
                              : 'neutral'
                      }
                    >
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {order.items.slice(0, 2).map((line) => (
                      <span key={line.id} className="flex justify-between font-body-sm text-body-sm text-on-surface">
                        <span>
                          {line.quantity}× {line.name}
                        </span>
                        <span className="tabular text-on-surface-variant">
                          {formatMoney(line.lineTotal, currency)}
                        </span>
                      </span>
                    ))}
                    {order.items.length > 2 && (
                      <span className="font-label-xs text-label-xs text-on-surface-variant">
                        +{order.items.length - 2} more items
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-space-2xs">
                    <span className="flex items-center gap-space-xs font-label-xs text-label-xs text-on-surface-variant">
                      <Icon name="schedule" size={14} className="text-primary" />
                      {elapsed(order.placedAt)} elapsed
                    </span>
                    <span className="tabular font-label-xs text-label-xs font-semibold text-on-surface">
                      {formatMoney(order.total, currency)} total
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Service requests */}
        <Card className="lg:col-span-4 flex flex-col gap-space-md">
          <CardHeader
            icon="room_service"
            title="Waiter calls"
            subtitle="Guest requests from table QR"
            badge={
              pendingRequests.length ? (
                <Badge tone="critical">{pendingRequests.length} pending</Badge>
              ) : (
                <Badge tone="success">Clear</Badge>
              )
            }
          />
          {pendingRequests.length === 0 ? (
            <EmptyState icon="notifications_off" title="No open requests" description="Guests are happy." />
          ) : (
            <div className="flex flex-col gap-space-sm">
              {pendingRequests.slice(0, 3).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-space-sm rounded-xl bg-surface-container-low p-space-sm"
                >
                  <div className="flex items-center gap-space-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-highest font-label-sm text-label-sm font-bold text-primary">
                      {request.tableNumber}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                        {SERVICE_REQUEST_LABELS[request.type]}
                      </span>
                      <span className="font-label-xs text-label-xs text-on-surface-variant">
                        {relativeTime(request.createdAt)}
                      </span>
                    </div>
                  </div>
                  <Link to="/app/tables">
                    <Button size="sm" variant="ghost" iconRight="chevron_right">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Stock + reservations */}
        <Card className="lg:col-span-3 flex flex-col gap-space-md">
          <CardHeader icon="warning_amber" title="Stock & ops" subtitle="Needs attention" />
          <div className="flex flex-col gap-space-xs">
            {lowStock.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-status-critical-bg p-space-xs"
              >
                <div className="flex flex-col">
                  <span className="font-label-xs text-label-xs font-bold text-on-surface">
                    {item.ingredient}
                  </span>
                  <span className="font-label-xs text-label-xs text-status-critical">
                    {item.currentStock}
                    {item.unit} left · min {item.lowStockThreshold}
                  </span>
                </div>
                <Link to="/app/inventory">
                  <Button size="sm" variant="ghost">
                    Reorder
                  </Button>
                </Link>
              </div>
            ))}
            {!lowStock.length && (
              <div className="flex items-center gap-space-xs rounded-lg bg-status-success-bg p-space-xs">
                <Icon name="check_circle" size={16} className="text-status-success" />
                <span className="font-label-xs text-label-xs text-on-surface">Stock levels healthy</span>
              </div>
            )}

            {upcomingReservations.length > 0 && (
              <div className="flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-xs">
                <span className="flex items-center gap-space-xs font-label-xs text-label-xs font-semibold text-on-surface">
                  <Icon name="event_seat" size={14} className="text-primary" />
                  Upcoming reservations
                </span>
                {upcomingReservations.map((r) => (
                  <span key={r.id} className="flex justify-between font-label-xs text-label-xs text-on-surface-variant">
                    <span>{r.customerName}</span>
                    <span className="tabular font-semibold text-on-surface">{r.time}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <Link to="/app/inventory" className="mt-auto">
            <Button variant="secondary" block size="sm" icon="inventory_2">
              Manage stock
            </Button>
          </Link>
        </Card>
      </section>

      {/* ------------------------------------------- table status mini-grid */}
      <Card className="flex flex-col gap-space-md">
        <CardHeader
          icon="table_restaurant"
          title="Floor at a glance"
          subtitle={`${occupancy} occupied · ${free} available · ${reserved} reserved`}
          action={
            <Link to="/app/tables">
              <Button size="sm" variant="secondary" iconRight="arrow_forward">
                Open floor plan
              </Button>
            </Link>
          }
        />
        <div className="grid grid-cols-3 gap-space-sm sm:grid-cols-4 lg:grid-cols-8">
          {tables.slice(0, 16).map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => navigate('/app/tables')}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl border p-space-sm transition-colors',
                table.status === 'occupied' && 'border-status-warning/30 bg-status-warning-bg',
                table.status === 'available' && 'border-status-success/30 bg-status-success-bg',
                table.status === 'reserved' && 'border-status-info/30 bg-status-info-bg',
                table.status === 'cleaning' && 'border-slate-200 bg-slate-50',

              )}
            >
              <span className="font-label-md text-label-md font-bold text-on-surface">
                {table.tableNumber}
              </span>
              <span className="font-label-xs text-[10px] text-on-surface-variant">
                {TABLE_STATUS_LABELS[table.status]}
              </span>
              {table.currentBill > 0 && (
                <span className="tabular font-label-xs text-[10px] font-semibold text-on-surface">
                  {formatMoney(table.currentBill, currency, { compact: true })}
                </span>
              )}
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
