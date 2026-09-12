import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Icon } from '@/components/ui'
import { useAppStore } from '@/store/AppStore'
import { useCart } from '@/store/CartStore'
import { getGuestOrders } from '@/lib/customerSession'
import { formatMoney, formatTime, relativeTime } from '@/lib/format'
import { ORDER_STATUS_LABELS } from '@/lib/types'

export function CustomerOrders() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const cart = useCart()
  const { db } = useAppStore()

  const org = db.organizations.find((o) => o.slug === slug) ?? null
  const base = `/r/${slug}`

  const orders = useMemo(() => {
    if (!org) return []
    const refs = getGuestOrders(org.id)
    return refs
      .map((ref) => db.orders.find((o) => o.id === ref.orderId))
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
  }, [db.orders, org])

  if (!org) return null

  const branding = org.branding
  const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status))
  const past = orders.filter((o) => ['completed', 'cancelled'].includes(o.status))

  const reorder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId)
    if (!order) return
    let added = 0
    order.items.forEach((line) => {
      const menuItem = db.menuItems.find((m) => m.id === line.menuItemId)
      if (!menuItem || !menuItem.available) return
      cart.addLine({
        item: menuItem,
        quantity: line.quantity,
        options: line.options,
        optionsTotal: line.optionsTotal,
        notes: line.notes,
      })
      added += 1
    })
    if (added) navigate(`${base}/cart`)
  }

  if (orders.length === 0) {
    return (
      <div className="px-space-lg py-space-xl">
        <EmptyState
          icon="receipt_long"
          title="No orders on this device yet"
          description="Once you place an order from a table QR it appears here so you can track it and view the bill."
          action={
            <Link to={`${base}/menu`}>
              <Button icon="restaurant_menu">Browse the menu</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-space-lg px-space-lg py-space-lg">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold tracking-tight text-on-surface">
          Your orders
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {orders.length} order{orders.length === 1 ? '' : 's'} at {org.name}
        </p>
      </div>

      {active.length > 0 && (
        <section className="flex flex-col gap-space-md">
          <h2 className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-primary">
            In progress
          </h2>
          {active.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => navigate(`${base}/order/${order.id}`)}
              className="flex flex-col gap-space-sm rounded-2xl border-[1.5px] p-space-md text-left"
              style={{
                borderColor: branding.primaryColor,
                background: `color-mix(in srgb, ${branding.primaryColor} 6%, white)`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-space-sm">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {order.orderNumber}
                  </span>
                  {order.tableNumber && <Badge tone="neutral">{order.tableNumber}</Badge>}
                </span>
                <Badge tone={order.status === 'ready' ? 'success' : 'warning'} dot>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {order.items.length} items · placed {relativeTime(order.placedAt)}
              </span>
              <div className="flex items-center justify-between border-t border-slate-200 pt-space-sm">
                <span className="tabular font-label-md text-label-md font-bold text-on-surface">
                  {formatMoney(order.total, branding.currency)}
                </span>
                <span
                  className="flex items-center gap-1 font-label-sm text-label-sm font-semibold"
                  style={{ color: branding.primaryColor }}
                >
                  Track order
                  <Icon name="arrow_forward" size={15} />
                </span>
              </div>
            </button>
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-space-md">
          <h2 className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Past orders
          </h2>
          {past.map((order) => (
            <Card key={order.id} className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-space-sm">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {order.orderNumber}
                  </span>
                  {order.tableNumber && <Badge tone="neutral">{order.tableNumber}</Badge>}
                </span>
                <Badge tone={order.status === 'cancelled' ? 'critical' : 'success'}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </div>
              <div className="flex flex-col gap-0.5">
                {order.items.slice(0, 3).map((line) => (
                  <span key={line.id} className="flex justify-between font-body-sm text-body-sm">
                    <span className="text-on-surface-variant">
                      {line.quantity}× {line.name}
                    </span>
                    <span className="tabular text-on-surface-variant">
                      {formatMoney(line.lineTotal, branding.currency)}
                    </span>
                  </span>
                ))}
                {order.items.length > 3 && (
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    +{order.items.length - 3} more
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-space-sm">
                <span className="font-label-xs text-label-xs text-on-surface-variant">
                  {formatTime(order.placedAt)} · {relativeTime(order.placedAt)}
                </span>
                <span className="tabular font-label-md text-label-md font-bold text-on-surface">
                  {formatMoney(order.total, branding.currency)}
                </span>
              </div>
              <div className="flex gap-space-xs">
                <Button size="sm" variant="secondary" icon="repeat" onClick={() => reorder(order.id)}>
                  Order again
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="receipt"
                  onClick={() => navigate(`${base}/bill`)}
                >
                  View bill
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
