import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  SegmentedControl,
  useToast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { elapsed, elapsedMinutes, formatTime } from '@/lib/format'
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from '@/lib/types'
import { useTicker } from '@/lib/hooks'

/** Rush thresholds in minutes — drive the ticket accent bar colour. */
const RUSH_AFTER = 18
const WARN_AFTER = 10

interface Lane {
  id: 'new' | 'preparing' | 'ready' | 'completed'
  title: string
  statuses: OrderStatus[]
  icon: string
  accent: string
}

const LANES: Lane[] = [
  { id: 'new', title: 'New', statuses: ['pending', 'accepted'], icon: 'fiber_new', accent: 'bg-status-info' },
  { id: 'preparing', title: 'Preparing', statuses: ['preparing'], icon: 'skillet', accent: 'bg-kds-prep' },
  { id: 'ready', title: 'Ready', statuses: ['ready', 'served'], icon: 'room_service', accent: 'bg-kds-ready' },
  { id: 'completed', title: 'Completed', statuses: ['completed', 'cancelled'], icon: 'done_all', accent: 'bg-slate-400' },
]

export function KitchenPage() {
  const { orders, organization, role } = useAppStore()
  const toast = useToast()
  const tick = useTicker(1000)

  const [density, setDensity] = useState<'comfortable' | 'dense'>('comfortable')
  const [filterZone, setFilterZone] = useState<'all' | 'dine_in' | 'takeaway'>('all')

  const currency = organization?.branding.currency ?? 'INR'

  const activeOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (filterZone !== 'all' && o.channel !== filterZone) return false
        // Completed tickets linger on the board for 20 minutes so the pass can verify them.
        return !['completed', 'cancelled'].includes(o.status) || elapsedMinutes(o.completedAt) < 20
      }),
    // `tick` re-evaluates each second so the completed window slides and timers update.
    [orders, filterZone, tick],
  )

  const kitchensBusy = activeOrders.filter((o) => ['preparing', 'pending'].includes(o.status)).length

  const advance = async (order: Order, next: OrderStatus) => {
    await api.updateOrderStatus(order.id, next, { actorName: `${role.replace('_', ' ')} (KDS)` })
    toast.success(`${order.orderNumber} → ${ORDER_STATUS_LABELS[next]}`)
  }

  return (
    <div className="flex flex-col gap-space-lg">
      {/* KDS header */}
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
              Kitchen Display
            </h1>
            <Badge tone={kitchensBusy > 6 ? 'critical' : 'success'} dot>
              {kitchensBusy > 6 ? 'Rush' : 'On track'}
            </Badge>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {activeOrders.length} tickets on the board · timers update every second
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-space-sm">
          <SegmentedControl
            value={filterZone}
            onChange={setFilterZone}
            options={[
              { value: 'all', label: 'All', icon: 'apps' },
              { value: 'dine_in', label: 'Dine-in', icon: 'table_restaurant' },
              { value: 'takeaway', label: 'Takeaway', icon: 'shopping_bag' },
            ]}
          />
          <SegmentedControl
            value={density}
            onChange={setDensity}
            options={[
              { value: 'comfortable', label: 'Standard', icon: 'view_agenda' },
              { value: 'dense', label: 'Dense', icon: 'view_list' },
            ]}
          />
        </div>
      </header>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-space-md rounded-xl border border-slate-200 bg-surface-container-lowest px-space-md py-space-sm">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Priority
        </span>
        {[
          { label: `Under ${WARN_AFTER}m`, className: 'bg-status-success' },
          { label: `${WARN_AFTER}–${RUSH_AFTER}m`, className: 'bg-kds-prep' },
          { label: `Over ${RUSH_AFTER}m`, className: 'bg-kds-rush' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-space-xs">
            <span className={cn('h-1 w-6 rounded-full', l.className)} />
            <span className="font-label-xs text-label-xs text-on-surface-variant">{l.label}</span>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-space-xs font-label-xs text-label-xs text-on-surface-variant">
          <Icon name="bolt" size={14} className="text-primary" />
          Tap an action to advance the ticket instantly
        </span>
      </div>

      {/* Kanban board */}
      <div className="grid gap-space-md lg:grid-cols-2 2xl:grid-cols-4">
        {LANES.map((lane) => {
          const laneOrders = activeOrders.filter((o) => lane.statuses.includes(o.status))
          return (
            <section
              key={lane.id}
              className="flex min-h-[280px] flex-col gap-space-sm rounded-2xl bg-surface-container-low p-space-md"
              aria-label={`${lane.title} lane`}
            >
              <header className="flex items-center justify-between">
                <span className="flex items-center gap-space-sm">
                  <span className={cn('h-2.5 w-2.5 rounded-full', lane.accent)} />
                  <h2 className="font-headline-sm text-headline-sm font-bold uppercase tracking-wide text-on-surface">
                    {lane.title}
                  </h2>
                  <Icon name={lane.icon} size={17} className="text-on-surface-variant" />
                </span>
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-container-highest px-space-xs font-label-sm text-label-sm font-bold text-on-surface">
                  {laneOrders.length}
                </span>
              </header>

              {laneOrders.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 py-space-xl">
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    {lane.id === 'completed' ? 'Nothing completed yet' : 'Lane clear'}
                  </span>
                </div>
              ) : (
                <div className="scroll-slim flex max-h-[62vh] flex-col gap-space-sm overflow-y-auto pr-1">
                  {laneOrders.map((order) => (
                    <Ticket
                      key={order.id}
                      order={order}
                      currency={currency}
                      dense={density === 'dense'}
                      onAdvance={advance}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {activeOrders.length === 0 && (
        <EmptyState
          icon="soup_kitchen"
          title="No tickets on the board"
          description="When a guest places an order from a table QR, the ticket appears here within a second."
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ ticket */

function Ticket({
  order,
  currency,
  dense,
  onAdvance,
}: {
  order: Order
  currency: string
  dense: boolean
  onAdvance: (order: Order, next: OrderStatus) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const startedAt = order.preparingAt ?? order.acceptedAt ?? order.placedAt
  const minutes = elapsedMinutes(startedAt)

  const urgency =
    ['completed', 'cancelled'].includes(order.status)
      ? 'done'
      : minutes >= RUSH_AFTER
        ? 'rush'
        : minutes >= WARN_AFTER
          ? 'warn'
          : 'fresh'

  const accent =
    urgency === 'rush'
      ? 'bg-kds-rush'
      : urgency === 'warn'
        ? 'bg-kds-prep'
        : urgency === 'done'
          ? 'bg-slate-300'
          : 'bg-kds-ready'

  const nextAction: { label: string; next: OrderStatus; icon: string } | null =
    order.status === 'pending'
      ? { label: 'Accept', next: 'accepted', icon: 'check' }
      : order.status === 'accepted'
        ? { label: 'Start preparing', next: 'preparing', icon: 'skillet' }
        : order.status === 'preparing'
          ? { label: 'Mark ready', next: 'ready', icon: 'room_service' }
          : order.status === 'ready'
            ? { label: 'Mark served', next: 'served', icon: 'restaurant' }
            : order.status === 'served'
              ? { label: 'Complete', next: 'completed', icon: 'done_all' }
              : null

  return (
    <article
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-e1',
        dense ? 'gap-space-xs p-space-sm' : 'gap-space-sm p-space-md',
      )}
    >
      {/* urgency accent bar */}
      <span className={cn('absolute inset-y-0 left-0 w-1', accent)} aria-hidden />

      <header className="flex items-start justify-between gap-space-sm pl-space-xs">
        <div className="flex flex-col">
          <span className="flex items-center gap-space-sm">
            <span className="rounded bg-slate-900 px-space-xs py-0.5 font-label-xs text-label-xs font-bold text-white">
              {order.tableNumber ?? 'TA'}
            </span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
              {order.orderNumber}
            </span>
          </span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            Placed {formatTime(order.placedAt)} · {order.items.reduce((s, i) => s + i.quantity, 0)} items
          </span>
        </div>
        <span
          className={cn(
            'tabular shrink-0 rounded-lg px-space-xs py-1 font-label-sm text-label-sm font-bold',
            urgency === 'rush' && 'bg-status-critical-bg text-status-critical',
            urgency === 'warn' && 'bg-status-warning-bg text-status-warning',
            urgency === 'fresh' && 'bg-status-success-bg text-status-success',
            urgency === 'done' && 'bg-slate-100 text-slate-500',
          )}
        >
          {elapsed(startedAt)}
        </span>
      </header>

      {order.allergyNote && (
        <div className="flex items-center gap-space-sm rounded-lg bg-status-critical px-space-sm py-1.5 pl-space-md">
          <Icon name="warning" size={15} className="shrink-0 text-white" />
          <span className="font-label-xs text-label-xs font-bold uppercase tracking-wide text-white">
            {order.allergyNote}
          </span>
        </div>
      )}

      <ul className="flex flex-col pl-space-xs">
        {order.items.map((line) => (
          <li
            key={line.id}
            className="flex flex-col border-b border-slate-100 py-space-xs last:border-0"
          >
            <span className="flex items-start gap-space-sm">
              <span
                className={cn(
                  'tabular flex h-6 min-w-6 shrink-0 items-center justify-center rounded font-label-sm text-label-sm font-bold',
                  line.quantity > 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700',
                )}
              >
                {line.quantity}
              </span>
              <span className={cn('font-label-md text-label-md font-semibold text-on-surface', !dense && 'text-[15px]')}>
                {line.name}
              </span>
            </span>
            {line.options.length > 0 && (
              <span className="ml-8 font-label-xs text-label-xs text-on-surface-variant">
                {line.options.join(' · ')}
              </span>
            )}
            {line.notes && (
              <span className="ml-8 font-label-xs text-label-xs font-semibold text-kds-prep">
                ↳ {line.notes}
              </span>
            )}
          </li>
        ))}
      </ul>

      {order.kitchenNote && (
        <div className="flex items-start gap-space-sm rounded-lg bg-status-warning-bg px-space-sm py-1.5 pl-space-md">
          <Icon name="sticky_note_2" size={14} className="mt-0.5 shrink-0 text-status-warning" />
          <span className="font-label-xs text-label-xs text-on-surface">{order.kitchenNote}</span>
        </div>
      )}

      <footer className="flex items-center justify-between gap-space-sm pl-space-xs">
        <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface-variant">
          {currency === 'INR' ? '₹' : ''}
          {order.total.toLocaleString('en-IN')}
        </span>
        {nextAction ? (
          <Button
            size={dense ? 'sm' : 'md'}
            icon={nextAction.icon}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              await onAdvance(order, nextAction.next)
              setBusy(false)
            }}
          >
            {nextAction.label}
          </Button>
        ) : (
          <Badge tone={order.status === 'cancelled' ? 'critical' : 'neutral'}>
            {order.status === 'cancelled' ? 'Cancelled' : 'Archived'}
          </Badge>
        )}
      </footer>
    </article>
  )
}
