import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, Drawer, EmptyState, Icon, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { publicBase } from '@/lib/publicRoutes'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { elapsed, formatMoney, formatTime } from '@/lib/format'
import { ORDER_STATUS_LABELS, SERVICE_REQUEST_LABELS, type Order, type ServiceRequestType } from '@/lib/types'
import { useTicker } from '@/lib/hooks'

const REQUEST_ICONS: Record<ServiceRequestType, string> = {
  call_waiter: 'notifications_active',
  request_bill: 'request_quote',
  water: 'water_drop',
  cutlery: 'cutlery',
  clean_table: 'cleaning_services',
  other: 'more_horiz',
}

export function OrderTracking() {
  const { slug = '', orderId = '', tableNumber } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { db } = useAppStore()
  useTicker(1000)

  const [helpOpen, setHelpOpen] = useState(false)

  // Guests ride on the anon key, which cannot receive realtime order events
  // (postgres_changes enforces the subscriber's SELECT rights). In live mode
  // the tracking screen therefore polls the guest rpc for authoritative
  // status: the round-trip also fills in the server-allocated BF number once
  // the first poll lands.
  const isLive = api.getConnectionStatus() !== 'demo'
  const [polled, setPolled] = useState<Order | null>(null)
  const [pollFailed, setPollFailed] = useState(false)
  // "Located" means the rpc answered (found or definitively not found) at
  // least once; before that a live guest is in the transient "finding" state.
  const [pollDone, setPollDone] = useState(false)
  useEffect(() => {
    if (!isLive) return
    let cancelled = false
    const tick = async () => {
      try {
        const result = await api.fetchGuestOrder(orderId)
        if (!cancelled) {
          // Merge the server's line items in: after a page reload the store
          // copy is gone and the rpc is the only source for the ticket body.
          setPolled(result ? { ...result.order, items: result.items } : null)
          setPollDone(true)
          setPollFailed(false)
        }
      } catch {
        if (!cancelled) setPollFailed(true)
      }
    }
    void tick()
    const timer = setInterval(tick, 10_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [isLive, orderId])

  const org = db.organizations.find((o) => o.slug === slug) ?? null
  // Authoritative data (server status, BF number) wins when present; the
  // optimistic in-store copy is the fallback and the instant first paint.
  const order = polled ?? db.orders.find((o) => o.id === orderId) ?? null
  const table = order?.tableId ? db.tables.find((t) => t.id === order.tableId) ?? null : null

  const steps = useMemo(
    () =>
      order
        ? [
            { label: 'Received', at: order.placedAt, icon: 'receipt_long' },
            { label: 'Accepted', at: order.acceptedAt, icon: 'check' },
            { label: 'Preparing', at: order.preparingAt, icon: 'skillet' },
            { label: 'Ready', at: order.readyAt, icon: 'room_service' },
            { label: 'Served', at: order.servedAt, icon: 'restaurant' },
          ]
        : [],
    [order],
  )

  if (!org) return null

  const branding = org.branding
  const base = publicBase(slug, tableNumber)

  if (!order) {
    // A live guest with no store copy (e.g. after a page reload) can be in one
    // of three states before the first successful poll lands: still locating,
    // transiently unreachable, or genuinely not found. Only the last one is
    // a real dead end.
    const locating = isLive && !pollDone
    const transient = isLive && pollDone && pollFailed
    return (
      <div className="px-space-lg py-space-xl">
        <EmptyState
          icon={locating ? 'search' : transient ? 'cloud_sync' : 'receipt_long'}
          title={locating ? 'Finding your order…' : transient ? 'Reconnecting…' : 'Order not found'}
          description={
            locating
              ? 'Connecting to the kitchen — this only takes a moment.'
              : transient
                ? 'We lost the connection while fetching your order and are retrying automatically.'
                : 'This order may belong to another session or was cleared.'
          }
          action={
            locating || transient ? null : (
              <Link to={`${base}/menu`}>
                <Button icon="restaurant_menu">Back to the menu</Button>
              </Link>
            )
          }
        />
      </div>
    )
  }

  const reachedIndex = steps.findIndex((s) => !s.at)
  const isCancelled = order.status === 'cancelled'
  const liveIndex = isCancelled ? 2 : reachedIndex === -1 ? steps.length : reachedIndex

  const estimate = Math.max(
    0,
    (order.preparingAt ? 18 : 12) - Math.floor((Date.now() - new Date(order.placedAt).getTime()) / 60000),
  )

  const requestHelp = async (type: ServiceRequestType) => {
    if (!table) {
      toast.error('No table linked to this order')
      return
    }
    await api.createServiceRequest({
      organizationId: org.id,
      tableId: table.id,
      tableNumber: table.tableNumber,
      type,
    })
    setHelpOpen(false)
    toast.success(`${SERVICE_REQUEST_LABELS[type]} requested`, `${table.tableNumber} — a runner is on the way.`)
  }

  return (
    <div className="flex flex-col gap-space-lg px-space-lg py-space-lg">
      {/* --------------------------------------------------------- headline */}
      <div
        className="flex flex-col items-center gap-space-xs rounded-2xl p-space-lg text-center"
        style={{ background: `color-mix(in srgb, ${branding.primaryColor} 10%, white)` }}
      >
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Order
        </span>
        <span className="font-headline-lg text-headline-lg font-extrabold tracking-tight text-on-surface">
          {order.orderNumber}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-space-sm">
          <Badge tone={isCancelled ? 'critical' : order.status === 'ready' ? 'success' : 'warning'} dot>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
          {table && (
            <Badge tone="neutral" icon="table_restaurant">
              {table.tableNumber}
            </Badge>
          )}
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            Placed {formatTime(order.placedAt)}
          </span>
        </div>
        {!isCancelled && order.status !== 'served' && order.status !== 'completed' && (
          <span className="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">
            {order.status === 'ready'
              ? 'Your food is ready and on its way out.'
              : `Estimated ready in about ${estimate} min`}
          </span>
        )}
      </div>

      {isLive && pollFailed && (
        <div className="flex items-start gap-space-sm rounded-xl bg-status-warning-bg p-space-md">
          <Icon name="wifi_off" size={17} className="mt-0.5 shrink-0 text-status-warning" />
          <span className="font-body-sm text-body-sm text-on-surface">
            Connection blip — showing your last known order status. It refreshes automatically.
          </span>
        </div>
      )}

      {isCancelled && (
        <div className="flex items-start gap-space-sm rounded-xl bg-status-critical-bg p-space-md">
          <Icon name="cancel" size={18} className="mt-0.5 shrink-0 text-status-critical" />
          <span className="font-body-sm text-body-sm text-on-surface">
            This order was cancelled{order.cancelledReason ? ` — ${order.cancelledReason}` : ''}. Nothing has
            been charged.
          </span>
        </div>
      )}

      {/* --------------------------------------------------------- timeline */}
      <Card className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Progress</span>
          <span className="tabular flex items-center gap-space-xs font-label-xs text-label-xs text-on-surface-variant">
            <Icon name="schedule" size={13} />
            {elapsed(order.placedAt)} ago
          </span>
        </div>
        <ol className="flex flex-col gap-space-sm">
          {steps.map((step, i) => {
            const done = i < liveIndex
            const active = i === liveIndex && !isCancelled
            return (
              <li key={step.label} className="flex items-center gap-space-md">
                <span
                  className={cn(
                    'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    done && 'text-white',
                    active && 'text-white',
                    !done && !active && 'bg-surface-container-highest text-on-surface-variant',
                  )}
                  style={
                    done || active
                      ? { background: done ? branding.primaryColor : branding.accentColor }
                      : undefined
                  }
                >
                  <Icon name={step.icon} size={17} />
                  {active && (
                    <span
                      className="absolute inset-0 animate-ping rounded-full opacity-30"
                      style={{ background: branding.accentColor }}
                    />
                  )}
                </span>
                <span className="flex flex-1 items-center justify-between">
                  <span
                    className={cn(
                      'font-label-md text-label-md',
                      active ? 'font-bold text-on-surface' : done ? 'text-on-surface' : 'text-on-surface-variant',
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="tabular font-label-xs text-label-xs text-on-surface-variant">
                    {step.at ? formatTime(step.at) : '—'}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
        {order.status === 'pending' && (
          <div className="flex items-start gap-space-sm rounded-xl bg-status-info-bg p-space-md">
            <Icon name="info" size={17} className="mt-0.5 shrink-0 text-status-info" />
            <span className="font-body-sm text-body-sm text-on-surface">
              Waiting for the kitchen to accept your order. This usually takes under a minute.
            </span>
          </div>
        )}
      </Card>

      {/* ----------------------------------------------------------- items */}
      <Card className="flex flex-col gap-space-sm">
        <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
          Your items ({order.items.length})
        </span>
        {order.items.map((line) => (
          <div key={line.id} className="flex items-start justify-between gap-space-md border-b border-slate-100 pb-space-sm last:border-0">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                {line.quantity}× {line.name}
              </span>
              {line.options.length > 0 && (
                <span className="font-label-xs text-label-xs text-on-surface-variant">
                  {line.options.join(' · ')}
                </span>
              )}
              {line.notes && (
                <span className="font-label-xs text-label-xs text-on-surface-variant">Note: {line.notes}</span>
              )}
            </div>
            <span className="tabular shrink-0 font-label-md text-label-md font-semibold text-on-surface">
              {formatMoney(line.lineTotal, branding.currency)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-slate-200 pt-space-sm">
          <span className="font-label-md text-label-md font-bold text-on-surface">Total</span>
          <span className="tabular font-headline-sm text-headline-sm font-bold text-on-surface">
            {formatMoney(order.total, branding.currency)}
          </span>
        </div>
        <Badge tone={order.paymentStatus === 'paid' ? 'success' : 'warning'}>
          {order.paymentStatus === 'paid' ? `Paid · ${order.paymentMethod}` : 'Payment due at the end'}
        </Badge>
      </Card>

      {/* --------------------------------------------------------- actions */}
      <div className="grid gap-space-sm sm:grid-cols-2">
        <Button variant="secondary" icon="support_agent" onClick={() => setHelpOpen(true)}>
          Need help?
        </Button>
        <Button variant="secondary" icon="request_quote" onClick={() => navigate(`${base}/bill`)}>
          View bill
        </Button>
      </div>

      <Link to={`${base}/menu`}>
        <Button block icon="add" variant="ghost">
          Add something else
        </Button>
      </Link>

      {/* -------------------------------------------------------- help sheet */}
      <Drawer open={helpOpen} onClose={() => setHelpOpen(false)} side="bottom" title="How can we help?">
        <div className="grid grid-cols-2 gap-space-sm">
          {(Object.keys(SERVICE_REQUEST_LABELS) as ServiceRequestType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => void requestHelp(type)}
              className="flex flex-col items-start gap-space-sm rounded-xl border border-slate-200 bg-white p-space-md text-left transition-colors hover:bg-surface-container-low"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${branding.primaryColor} 12%, white)`,
                  color: branding.primaryColor,
                }}
              >
                <Icon name={REQUEST_ICONS[type]} size={19} />
              </span>
              <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                {SERVICE_REQUEST_LABELS[type]}
              </span>
            </button>
          ))}
        </div>
      </Drawer>
    </div>
  )
}
