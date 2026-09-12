import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  FoodThumb,
  Icon,
  Input,
  SegmentedControl,
  Select,
  SearchInput,
  Toolbar,
  useToast,
  type Column,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { elapsed, formatDateTime, formatMoney, formatTime, relativeTime } from '@/lib/format'
import {
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  type Order,
  type OrderStatus,
} from '@/lib/types'
import { useTicker } from '@/lib/hooks'

const STATUS_TONES: Record<OrderStatus, 'neutral' | 'warning' | 'info' | 'success' | 'critical'> = {
  pending: 'warning',
  accepted: 'info',
  preparing: 'warning',
  ready: 'success',
  served: 'info',
  completed: 'neutral',
  cancelled: 'critical',
}

type Filter = 'all' | OrderStatus

export function OrdersPage() {
  const { orders, organization, role, hasCapability } = useAppStore()
  const toast = useToast()
  useTicker(15000)

  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [timeWindow, setTimeWindow] = useState<'today' | '7d' | 'all'>('today')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)

  const currency = organization?.branding.currency ?? 'INR'

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: orders.length }
    orders.forEach((o) => {
      base[o.status] = (base[o.status] ?? 0) + 1
    })
    return base
  }, [orders])

  const filtered = useMemo(() => {
    const cutoff = timeWindow === 'today' ? new Date().setHours(0, 0, 0, 0) : Date.now() - 7 * 864e5
    const q = query.trim().toLowerCase()
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false
      if (timeWindow !== 'all' && new Date(o.placedAt).getTime() < cutoff) return false
      if (!q) return true
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        (o.tableNumber ?? '').toLowerCase().includes(q) ||
        (o.customerName ?? '').toLowerCase().includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q))
      )
    })
  }, [orders, filter, query, timeWindow])

  const selected = orders.find((o) => o.id === selectedId) ?? null

  const advance = async (order: Order, next: OrderStatus) => {
    if (next === 'cancelled') {
      setCancelTarget(order)
      return
    }
    setBusy(true)
    await api.updateOrderStatus(order.id, next)
    setBusy(false)
    toast.success(`Order ${order.orderNumber} → ${ORDER_STATUS_LABELS[next]}`)
  }

  const columns: Column<Order>[] = [
    {
      key: 'order',
      header: 'Order',
      sortValue: (o) => o.orderNumber,
      render: (o) => (
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-semibold text-on-surface">{o.orderNumber}</span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            {formatTime(o.placedAt)} · {relativeTime(o.placedAt)}
          </span>
        </div>
      ),
    },
    {
      key: 'table',
      header: 'Table',
      sortValue: (o) => o.tableNumber ?? '',
      render: (o) => (
        <span className="inline-flex items-center rounded bg-surface-container-high px-space-xs py-0.5 font-label-xs text-label-xs font-bold text-on-surface">
          {o.tableNumber ?? 'Takeaway'}
        </span>
      ),
      hideBelow: 'sm' as const,
    },
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (o) => o.customerName ?? '',
      render: (o) => (
        <div className="flex flex-col">
          <span className="font-body-sm text-body-sm text-on-surface">{o.customerName ?? 'Guest'}</span>
          <span className="font-label-xs text-label-xs capitalize text-on-surface-variant">
            {o.channel.replace('_', '-')}
          </span>
        </div>
      ),
      hideBelow: 'md' as const,
    },
    {
      key: 'items',
      header: 'Items',
      render: (o) => (
        <div className="flex max-w-[220px] flex-col">
          <span className="truncate font-body-sm text-body-sm text-on-surface">
            {o.items[0]?.quantity}× {o.items[0]?.name}
          </span>
          {o.items.length > 1 && (
            <span className="font-label-xs text-label-xs text-on-surface-variant">
              +{o.items.length - 1} more
            </span>
          )}
        </div>
      ),
      hideBelow: 'lg' as const,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortValue: (o) => o.total,
      render: (o) => (
        <div className="flex flex-col items-end">
          <span className="font-label-md text-label-md font-bold text-on-surface">
            {formatMoney(o.total, currency)}
          </span>
          <span
            className={cn(
              'font-label-xs text-label-xs font-semibold',
              o.paymentStatus === 'paid' ? 'text-status-success' : 'text-status-warning',
            )}
          >
            {o.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => (
        <Badge tone={STATUS_TONES[o.status]} dot>
          {ORDER_STATUS_LABELS[o.status]}
        </Badge>
      ),
    },
    {
      key: 'timer',
      header: 'Elapsed',
      align: 'right',
      hideBelow: 'lg' as const,
      render: (o) =>
        ['completed', 'cancelled'].includes(o.status) ? (
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            {o.completedAt ? relativeTime(o.completedAt) : '—'}
          </span>
        ) : (
          <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface">
            {elapsed(o.placedAt)}
          </span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sticky: true,
      render: (o) => (
        <Button
          size="sm"
          variant="ghost"
          iconRight="chevron_right"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedId(o.id)
          }}
        >
          Open
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Orders</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {filtered.length} of {orders.length} orders · {counts.pending ?? 0} awaiting the kitchen
          </p>
        </div>
        <Toolbar>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search order, table, guest or dish"
            className="w-full sm:w-72"
          />
          <Select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as typeof timeWindow)}
            options={[
              { value: 'today', label: 'Today' },
              { value: '7d', label: 'Last 7 days' },
              { value: 'all', label: 'All time' },
            ]}
            className="w-full sm:w-40"
          />
        </Toolbar>
      </header>

      <SegmentedControl
        value={filter}
        onChange={(v) => setFilter(v)}
        className="overflow-x-auto"
        options={[
          { value: 'all' as Filter, label: 'All', count: counts.all },
          { value: 'pending' as Filter, label: 'Pending', count: counts.pending ?? 0, icon: 'schedule' },
          { value: 'accepted' as Filter, label: 'Accepted', count: counts.accepted ?? 0 },
          { value: 'preparing' as Filter, label: 'Preparing', count: counts.preparing ?? 0, icon: 'skillet' },
          { value: 'ready' as Filter, label: 'Ready', count: counts.ready ?? 0, icon: 'room_service' },
          { value: 'served' as Filter, label: 'Served', count: counts.served ?? 0 },
          { value: 'completed' as Filter, label: 'Completed', count: counts.completed ?? 0, icon: 'check_circle' },
          { value: 'cancelled' as Filter, label: 'Cancelled', count: counts.cancelled ?? 0 },
        ]}
      />

      <Card padded={false} className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(o) => o.id}
          onRowClick={(o) => setSelectedId(o.id)}
          empty={
            <EmptyState
              icon="receipt_long"
              title={query ? `No orders match “${query}”` : 'No orders in this view'}
              description={
                query
                  ? 'Try a different order number, table or dish name.'
                  : 'Once a guest scans a table QR and places an order, it appears here instantly.'
              }
              action={
                query ? (
                  <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      {/* --------------------------------------------------------- order drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? `${selected.orderNumber} · ${selected.tableNumber ?? 'Takeaway'}` : ''}
        subtitle={selected ? `${formatDateTime(selected.placedAt)} · ${relativeTime(selected.placedAt)}` : ''}
        width="lg"
        footer={
          selected ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-space-sm">
              <div className="flex flex-wrap gap-space-xs">
                {(ORDER_TRANSITIONS[selected.status] ?? [])
                  .filter((s) => s !== 'cancelled')
                  .map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      icon={
                        next === 'accepted'
                          ? 'check'
                          : next === 'preparing'
                            ? 'skillet'
                            : next === 'ready'
                              ? 'room_service'
                              : next === 'served'
                                ? 'restaurant'
                                : 'done_all'
                      }
                      loading={busy}
                      onClick={() => void advance(selected, next)}
                    >
                      Mark {ORDER_STATUS_LABELS[next].toLowerCase()}
                    </Button>
                  ))}
              </div>
              {ORDER_TRANSITIONS[selected.status]?.includes('cancelled') && hasCapability('orders') && (
                <Button size="sm" variant="danger-ghost" icon="cancel" onClick={() => setCancelTarget(selected)}>
                  Cancel order
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {selected && <OrderDetail order={selected} currency={currency} role={role} />}
      </Drawer>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return
          setBusy(true)
          await api.updateOrderStatus(cancelTarget.id, 'cancelled', { reason: 'Cancelled by staff' })
          setBusy(false)
          setCancelTarget(null)
          toast.success('Order cancelled')
        }}
        title="Cancel this order?"
        message={
          <>
            <strong>{cancelTarget?.orderNumber}</strong> will be marked cancelled and the table released.
            The guest is not notified automatically in the prototype.
          </>
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        loading={busy}
      />
    </div>
  )
}

/* ------------------------------------------------------------ order detail */

function OrderDetail({
  order,
  currency,
  role,
}: {
  order: Order
  currency: string
  role: string
}) {
  const toast = useToast()
  const [paying, setPaying] = useState(false)

  const timeline = [
    { label: 'Received', at: order.placedAt, icon: 'receipt_long' },
    { label: 'Accepted', at: order.acceptedAt, icon: 'check' },
    { label: 'Preparing', at: order.preparingAt, icon: 'skillet' },
    { label: 'Ready', at: order.readyAt, icon: 'room_service' },
    { label: 'Served', at: order.servedAt, icon: 'restaurant' },
    { label: 'Completed', at: order.completedAt, icon: 'done_all' },
  ]
  const reachedIndex = timeline.findIndex((t) => !t.at)

  return (
    <div className="flex flex-col gap-space-lg p-space-xl">
      {/* status timeline */}
      <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-md">
        <div className="flex items-center justify-between">
          <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Status timeline
          </span>
          <Badge tone={STATUS_TONES[order.status]} dot>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>
        <ol className="flex flex-col gap-space-xs">
          {timeline.map((step, i) => {
            const done = reachedIndex === -1 || i < reachedIndex
            const active = i === reachedIndex
            return (
              <li key={step.label} className="flex items-center gap-space-md">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    done && 'bg-status-success text-white',
                    active && 'bg-primary text-on-primary',
                    !done && !active && 'bg-surface-container-highest text-on-surface-variant',
                  )}
                >
                  <Icon name={step.icon} size={15} />
                </span>
                <span className="flex flex-1 items-center justify-between">
                  <span
                    className={cn(
                      'font-label-sm text-label-sm',
                      active ? 'font-bold text-on-surface' : 'text-on-surface-variant',
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
        {order.status === 'cancelled' && (
          <div className="flex items-center gap-space-sm rounded-lg bg-status-critical-bg p-space-sm">
            <Icon name="cancel" size={16} className="text-status-critical" />
            <span className="font-label-xs text-label-xs text-on-surface">
              Cancelled {order.cancelledAt ? relativeTime(order.cancelledAt) : ''} — {order.cancelledReason}
            </span>
          </div>
        )}
      </div>

      {/* items */}
      <div className="flex flex-col gap-space-sm">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Items ({order.items.length})
        </span>
        {order.items.map((line) => (
          <div key={line.id} className="flex items-start justify-between gap-space-md border-b border-slate-100 pb-space-sm last:border-0">
            <div className="flex min-w-0 items-start gap-space-md">
              <FoodThumb name={line.name} size={40} />
              <div className="flex min-w-0 flex-col">
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  {line.quantity}× {line.name}
                </span>
                {line.options.length > 0 && (
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    {line.options.join(' · ')}
                    {line.optionsTotal > 0 && ` (+${formatMoney(line.optionsTotal, currency)})`}
                  </span>
                )}
                {line.notes && (
                  <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded bg-status-warning-bg px-1.5 py-0.5 font-label-xs text-label-xs text-status-warning">
                    <Icon name="sticky_note_2" size={12} />
                    {line.notes}
                  </span>
                )}
              </div>
            </div>
            <span className="tabular shrink-0 font-label-md text-label-md font-semibold text-on-surface">
              {formatMoney(line.lineTotal, currency)}
            </span>
          </div>
        ))}
      </div>

      {/* notes */}
      {(order.allergyNote || order.kitchenNote || order.notes) && (
        <div className="flex flex-col gap-space-sm">
          {order.allergyNote && (
            <div className="flex items-start gap-space-sm rounded-xl bg-status-critical-bg p-space-sm">
              <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-status-critical" />
              <span className="font-body-sm text-body-sm text-on-surface">{order.allergyNote}</span>
            </div>
          )}
          {order.kitchenNote && (
            <div className="flex items-start gap-space-sm rounded-xl bg-status-warning-bg p-space-sm">
              <Icon name="skillet" size={16} className="mt-0.5 shrink-0 text-status-warning" />
              <span className="font-body-sm text-body-sm text-on-surface">{order.kitchenNote}</span>
            </div>
          )}
          {order.notes && (
            <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-sm">
              <Icon name="sticky_note_2" size={16} className="mt-0.5 shrink-0 text-on-surface-variant" />
              <span className="font-body-sm text-body-sm text-on-surface">{order.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* bill */}
      <div className="flex flex-col gap-space-xs rounded-2xl border border-slate-200 p-space-md">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Bill summary
        </span>
        <Row label="Subtotal" value={formatMoney(order.subtotal, currency)} />
        <Row label="Tax" value={formatMoney(order.taxAmount, currency)} />
        {order.serviceCharge > 0 && (
          <Row label="Service charge" value={formatMoney(order.serviceCharge, currency)} />
        )}
        {order.discount > 0 && (
          <Row label="Discount" value={`−${formatMoney(order.discount, currency)}`} tone="success" />
        )}
        <div className="mt-space-xs flex items-center justify-between border-t border-slate-200 pt-space-sm">
          <span className="font-label-md text-label-md font-bold text-on-surface">Total</span>
          <span className="tabular font-headline-sm text-headline-sm font-bold text-on-surface">
            {formatMoney(order.total, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between pt-space-xs">
          <Badge tone={order.paymentStatus === 'paid' ? 'success' : 'warning'}>
            {order.paymentStatus === 'paid' ? `Paid · ${order.paymentMethod}` : 'Awaiting payment'}
          </Badge>
          {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
            <Button
              size="sm"
              icon="payments"
              loading={paying}
              onClick={async () => {
                setPaying(true)
                await api.payOrder(order.id, 'card')
                setPaying(false)
                toast.success('Payment captured', `${order.orderNumber} marked complete.`)
              }}
            >
              Take payment
            </Button>
          )}
        </div>
      </div>

      {/* meta */}
      <div className="grid grid-cols-2 gap-space-sm">
        <Meta label="Customer" value={order.customerName ?? 'Guest'} />
        <Meta label="Channel" value={order.channel.replace('_', '-')} />
        <Meta label="Sales staff" value={role.replace('_', ' ')} />
        <Meta label="Order ID" value={order.id} />
      </div>

      <div className="flex gap-space-sm">
        <Button
          variant="secondary"
          icon="print"
          onClick={() => toast.info('Printing is not wired up in the prototype')}
        >
          Print ticket
        </Button>
        <Button
          variant="secondary"
          icon="receipt"
          onClick={() => toast.info('Receipt email is not wired up in the prototype')}
        >
          Email receipt
        </Button>
      </div>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
      <span
        className={cn(
          'tabular font-label-sm text-label-sm font-semibold',
          tone === 'success' ? 'text-status-success' : 'text-on-surface',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-surface-container-low p-space-sm">
      <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="truncate font-label-sm text-label-sm font-semibold capitalize text-on-surface">
        {value}
      </span>
    </div>
  )
}
