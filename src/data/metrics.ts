/** Analytics engine — prd.md §22. Pure functions over the loaded dataset. */
import type {
  Customer,
  MenuItem,
  Order,
  OrderChannel,
  RestaurantTable,
  TenantMetrics,
} from '@/lib/types'
import { percentDelta } from '@/lib/format'

const isSameDay = (iso: string | null, ref: Date) => {
  if (!iso) return false
  const d = new Date(iso)
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  )
}

const startOfDay = (offsetDays: number) => {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  d.setHours(0, 0, 0, 0)
  return d
}

export interface AnalyticsInput {
  orders: Order[]
  tables: RestaurantTable[]
  customers: Customer[]
  menuItems: MenuItem[]
}

const CHANNEL_LABELS: Record<OrderChannel, string> = {
  dine_in: 'Dine-in QR',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
}

export function computeMetrics(input: AnalyticsInput): TenantMetrics {
  const { orders, tables, customers, menuItems } = input
  const today = new Date()
  const yesterdayRef = startOfDay(1)

  const revenueOf = (o: Order) => (o.status === 'cancelled' ? 0 : o.total)

  const todayOrders = orders.filter((o) => isSameDay(o.placedAt, today))
  const ydayOrders = orders.filter((o) => isSameDay(o.placedAt, yesterdayRef))

  const salesToday = todayOrders.reduce((s, o) => s + revenueOf(o), 0)
  const salesYesterday = ydayOrders.reduce((s, o) => s + revenueOf(o), 0)
  const aov = todayOrders.length ? salesToday / todayOrders.length : 0
  const aovYday = ydayOrders.length ? salesYesterday / ydayOrders.length : 0

  const occupied = tables.filter((t) => t.status === 'occupied').length
  const utilization = tables.length ? (occupied / tables.length) * 100 : 0

  /* ---- hourly buckets ------------- */
  const hourly: TenantMetrics['hourly'] = []
  for (let h = 8; h <= 23; h++) {
    const ordersAtHour = todayOrders.filter((o) => new Date(o.placedAt).getHours() === h)
    hourly.push({
      label: `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`,
      orders: ordersAtHour.length,
      revenue: ordersAtHour.reduce((s, o) => s + revenueOf(o), 0),
    })
  }

  /* ---- channel mix ---------------- */
  const totalChannelRevenue = Math.max(1, todayOrders.reduce((s, o) => s + revenueOf(o), 0))
  const channels: OrderChannel[] = ['dine_in', 'takeaway', 'delivery']
  const channelMix = channels.map((channel) => {
    const bucket = todayOrders.filter((o) => o.channel === channel)
    const revenue = bucket.reduce((s, o) => s + revenueOf(o), 0)
    return {
      channel,
      label: CHANNEL_LABELS[channel],
      share: Math.round((revenue / totalChannelRevenue) * 100),
      revenue,
    }
  })

  /* ---- top items ------------------ */
  const itemTally = new Map<string, { quantity: number; revenue: number }>()
  orders
    .filter((o) => o.status !== 'cancelled')
    .forEach((o) =>
      o.items.forEach((line) => {
        const prev = itemTally.get(line.name) ?? { quantity: 0, revenue: 0 }
        itemTally.set(line.name, {
          quantity: prev.quantity + line.quantity,
          revenue: prev.revenue + line.lineTotal,
        })
      }),
    )

  const badges = ['Top Seller', 'Fastest Turnaround', 'High Table Share', 'Best Margin', 'Crowd Favourite']
  const topItems = [...itemTally.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 6)
    .map(([name, stat], i) => ({
      name,
      imageUrl: menuItems.find((m) => m.name === name)?.imageUrl ?? null,
      quantity: stat.quantity,
      revenue: stat.revenue,
      badge: badges[i % badges.length],
    }))

  /* ---- revenue trend (14 days) ---- */
  const revenueTrend: TenantMetrics['revenueTrend'] = []
  for (let i = 13; i >= 0; i--) {
    const ref = startOfDay(i)
    const dayOrders = orders.filter((o) => isSameDay(o.placedAt, ref))
    revenueTrend.push({
      label: ref.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      value: dayOrders.reduce((s, o) => s + revenueOf(o), 0),
    })
  }

  /* ---- kitchen + customer stats --- */
  const prepared = orders.filter((o) => o.preparingAt && o.readyAt && o.status !== 'cancelled')
  const avgPrep = prepared.length
    ? prepared.reduce(
        (s, o) => s + (new Date(o.readyAt!).getTime() - new Date(o.preparingAt!).getTime()) / 60_000,
        0,
      ) / prepared.length
    : 0

  const cancelled = orders.filter((o) => o.status === 'cancelled').length
  const cancellationRate = orders.length ? (cancelled / orders.length) * 100 : 0

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const newCustomers = customers.filter((c) => new Date(c.createdAt).getTime() >= thirtyDaysAgo).length
  const returningCustomers = Math.max(0, customers.length - newCustomers)
  const loyaltyPointsIssued = customers.reduce((s, c) => s + c.loyaltyPoints, 0)

  const peak = hourly.reduce(
    (best, cur) => (cur.orders > best.orders ? cur : best),
    hourly[0] ?? { label: '—', orders: 0, revenue: 0 },
  )

  return {
    salesToday,
    salesYesterday,
    ordersToday: todayOrders.length,
    ordersYesterday: ydayOrders.length,
    averageOrderValue: Math.round(aov),
    aovDelta: percentDelta(aov, aovYday),
    tablesOccupied: occupied,
    tablesTotal: tables.length,
    tableUtilization: Math.round(utilization),
    avgPrepMinutes: Math.round(avgPrep) || 0,
    cancellationRate: Number(cancellationRate.toFixed(1)),
    newCustomers,
    returningCustomers,
    loyaltyPointsIssued,
    hourly,
    channelMix,
    topItems,
    revenueTrend,
    peakHours: peak.label,
  }
}

/** Orders filtered to a trailing window, used by the analytics time filter. */
export function withinWindow(orders: Order[], days: number): Order[] {
  const cutoff = startOfDay(days - 1).getTime()
  return orders.filter((o) => new Date(o.placedAt).getTime() >= cutoff)
}
