import { useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  Icon,
  MetricCard,
  ProgressBar,
  SearchInput,
  SegmentedControl,
  Switch,
  useToast,
  type Column,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { formatDate, formatMoney, relativeTime } from '@/lib/format'
import { ORDER_STATUS_LABELS, type Customer } from '@/lib/types'

const TIER_STYLES: Record<Customer['tier'], { tone: 'neutral' | 'info' | 'warning' | 'brand'; icon: string }> = {
  bronze: { tone: 'neutral', icon: 'workspace_premium' },
  silver: { tone: 'info', icon: 'workspace_premium' },
  gold: { tone: 'warning', icon: 'military_tech' },
  platinum: { tone: 'brand', icon: 'diamond' },
}

type Segment = 'all' | 'new' | 'returning' | 'vip' | 'lapsed'

export function CustomersPage() {
  const { customers, orders, organization } = useAppStore()
  const toast = useToast()

  const [segment, setSegment] = useState<Segment>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)

  const currency = organization?.branding.currency ?? 'INR'

  const decorated = useMemo(
    () =>
      customers.map((c) => {
        const lifetimeOrders = orders.filter((o) => o.customerId === c.id)
        return {
          customer: c,
          recentOrders: lifetimeOrders.slice(0, 8),
          isNew: Date.now() - new Date(c.createdAt).getTime() < 30 * 864e5,
          isLapsed: c.lastVisitAt ? Date.now() - new Date(c.lastVisitAt).getTime() > 30 * 864e5 : true,
          isVip: c.tier === 'gold' || c.tier === 'platinum',
        }
      }),
    [customers, orders],
  )

  const counts = useMemo(
    () => ({
      all: decorated.length,
      new: decorated.filter((d) => d.isNew).length,
      returning: decorated.filter((d) => !d.isNew).length,
      vip: decorated.filter((d) => d.isVip).length,
      lapsed: decorated.filter((d) => d.isLapsed).length,
    }),
    [decorated],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return decorated.filter((d) => {
      if (segment === 'new' && !d.isNew) return false
      if (segment === 'returning' && d.isNew) return false
      if (segment === 'vip' && !d.isVip) return false
      if (segment === 'lapsed' && !d.isLapsed) return false
      if (!q) return true
      return (
        d.customer.name.toLowerCase().includes(q) ||
        d.customer.phone.toLowerCase().includes(q) ||
        d.customer.email.toLowerCase().includes(q)
      )
    })
  }, [decorated, segment, query])

  const totalSpend = customers.reduce((s, c) => s + c.totalSpend, 0)
  const totalPoints = customers.reduce((s, c) => s + c.loyaltyPoints, 0)
  const maxSpend = Math.max(1, ...customers.map((c) => c.totalSpend))

  const columns: Column<(typeof decorated)[number]>[] = [
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (d) => d.customer.name,
      render: ({ customer }) => (
        <div className="flex items-center gap-space-sm">
          <Avatar name={customer.name} size={34} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-label-md text-label-md font-semibold text-on-surface">
              {customer.name}
            </span>
            <span className="truncate font-label-xs text-label-xs text-on-surface-variant">
              {customer.phone}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      sortValue: (d) => d.customer.tier,
      render: ({ customer }) => (
        <Badge tone={TIER_STYLES[customer.tier].tone} icon={TIER_STYLES[customer.tier].icon}>
          {customer.tier}
        </Badge>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      sortValue: (d) => d.customer.totalOrders,
      render: ({ customer }) => (
        <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface">
          {customer.totalOrders}
        </span>
      ),
      hideBelow: 'sm' as const,
    },
    {
      key: 'spend',
      header: 'Lifetime spend',
      align: 'right',
      sortValue: (d) => d.customer.totalSpend,
      render: ({ customer }) => (
        <div className="flex min-w-[120px] flex-col items-end gap-space-xs">
          <span className="tabular font-label-md text-label-md font-bold text-on-surface">
            {formatMoney(customer.totalSpend, currency)}
          </span>
          <ProgressBar value={customer.totalSpend} max={maxSpend} className="w-20" />
        </div>
      ),
    },
    {
      key: 'loyalty',
      header: 'Points',
      align: 'right',
      sortValue: (d) => d.customer.loyaltyPoints,
      render: ({ customer }) => (
        <span className="tabular font-label-sm text-label-sm font-semibold text-primary">
          {customer.loyaltyPoints.toLocaleString('en-IN')}
        </span>
      ),
      hideBelow: 'lg' as const,
    },
    {
      key: 'lastVisit',
      header: 'Last visit',
      align: 'right',
      sortValue: (d) => d.customer.lastVisitAt ?? '',
      render: ({ customer, isLapsed }) => (
        <span
          className={cn(
            'font-body-sm text-body-sm',
            isLapsed ? 'font-semibold text-status-critical' : 'text-on-surface-variant',
          )}
        >
          {customer.lastVisitAt ? relativeTime(customer.lastVisitAt) : 'Never'}
        </span>
      ),
      hideBelow: 'md' as const,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sticky: true,
      render: ({ customer }) => (
        <Button size="sm" variant="ghost" iconRight="chevron_right" onClick={() => setSelected(customer)}>
          Open
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            Customers &amp; CRM
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {customers.length} guests · {formatMoney(totalSpend, currency)} lifetime revenue ·{' '}
            {totalPoints.toLocaleString('en-IN')} loyalty points issued
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search name, phone or email"
            className="w-full sm:w-72"
          />
          <Button
            variant="secondary"
            icon="download"
            onClick={() => toast.info('CSV export is not wired up in the prototype')}
          >
            Export
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-space-lg lg:grid-cols-4">
        <MetricCard label="Total customers" value={customers.length} icon="group" tone="neutral" />
        <MetricCard label="New this month" value={counts.new} icon="person_add" tone="brand" />
        <MetricCard label="Returning" value={counts.returning} icon="repeat" tone="success" />
        <MetricCard label="VIP tier" value={counts.vip} icon="diamond" tone="warning" />
      </section>

      <SegmentedControl
        value={segment}
        onChange={setSegment}
        className="overflow-x-auto"
        options={[
          { value: 'all' as const, label: 'All customers', count: counts.all },
          { value: 'new' as const, label: 'New (30d)', count: counts.new, icon: 'person_add' },
          { value: 'returning' as const, label: 'Returning', count: counts.returning, icon: 'repeat' },
          { value: 'vip' as const, label: 'VIP', count: counts.vip, icon: 'diamond' },
          { value: 'lapsed' as const, label: 'Lapsed 30d+', count: counts.lapsed, icon: 'schedule' },
        ]}
      />

      <Card padded={false} className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(d) => d.customer.id}
          onRowClick={(d) => setSelected(d.customer)}
          empty={
            <EmptyState
              icon="group"
              title={query ? `No customers match “${query}”` : 'No customers in this segment'}
              description="Guest profiles are created automatically when they order from a table QR."
            />
          }
        />
      </Card>

      {/* ---------------------------------------------------- customer drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? `${selected.phone} · joined ${formatDate(selected.createdAt)}` : ''}
        width="lg"
        footer={
          selected ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-space-sm">
              <Button
                size="sm"
                variant="secondary"
                icon="sms"
                onClick={() => toast.info('SMS campaigns are post-MVP')}
              >
                Send offer
              </Button>
              <div className="flex gap-space-xs">
                <Button size="sm" variant="secondary" icon="loyalty" onClick={() => toast.info('Point adjustments are post-MVP')}>
                  Adjust points
                </Button>
                <Button size="sm" icon="receipt_long">
                  New order
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {selected && <CustomerDetail customer={selected} currency={currency} />}
      </Drawer>
    </div>
  )
}

function CustomerDetail({ customer, currency }: { customer: Customer; currency: string }) {
  const { orders } = useAppStore()
  const customerOrders = orders.filter((o) => o.customerId === customer.id)
  const average = customer.totalOrders ? customer.totalSpend / customer.totalOrders : 0

  const nextTier: Customer['tier'] | null =
    customer.tier === 'bronze' ? 'silver' : customer.tier === 'silver' ? 'gold' : customer.tier === 'gold' ? 'platinum' : null
  const tierTarget = { silver: 15000, gold: 40000, platinum: 90000 } as const
  const target = nextTier ? tierTarget[nextTier as 'silver' | 'gold' | 'platinum'] : 0

  return (
    <div className="flex flex-col gap-space-lg p-space-xl">
      <div className="flex items-center gap-space-md rounded-2xl bg-surface-container-low p-space-md">
        <Avatar name={customer.name} size={52} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
            {customer.name}
          </span>
          <span className="truncate font-body-sm text-body-sm text-on-surface-variant">
            {customer.email}
          </span>
        </div>
        <Badge tone={TIER_STYLES[customer.tier].tone} icon={TIER_STYLES[customer.tier].icon} className="ml-auto">
          {customer.tier}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-space-sm">
        {[
          { label: 'Lifetime spend', value: formatMoney(customer.totalSpend, currency), icon: 'payments' },
          { label: 'Orders', value: String(customer.totalOrders), icon: 'receipt_long' },
          { label: 'Average ticket', value: formatMoney(average, currency), icon: 'sell' },
          { label: 'Visits', value: String(customer.visitCount), icon: 'directions_walk' },
        ].map((cell) => (
          <div key={cell.label} className="flex flex-col gap-0.5 rounded-xl bg-surface-container-low p-space-md">
            <span className="flex items-center gap-space-xs font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
              <Icon name={cell.icon} size={13} />
              {cell.label}
            </span>
            <span className="tabular font-headline-sm text-headline-sm font-bold text-on-surface">
              {cell.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-space-sm rounded-2xl border border-slate-200 p-space-md">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-space-sm font-label-md text-label-md font-semibold text-on-surface">
            <Icon name="loyalty" size={18} className="text-primary" />
            Loyalty
          </span>
          <span className="tabular font-headline-sm text-headline-sm font-bold text-primary">
            {customer.loyaltyPoints.toLocaleString('en-IN')} pts
          </span>
        </div>
        {nextTier ? (
          <>
            <ProgressBar value={customer.totalSpend} max={target} />
            <span className="font-label-xs text-label-xs text-on-surface-variant">
              {formatMoney(Math.max(0, target - customer.totalSpend), currency)} more spend to reach{' '}
              <strong className="capitalize text-on-surface">{nextTier}</strong>
            </span>
          </>
        ) : (
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            Already at the highest tier — platinum benefits apply.
          </span>
        )}
        <span className="font-label-xs text-label-xs text-on-surface-variant">
          Earn rate: 10 points per {currency === 'INR' ? '₹100' : '100'} spent
        </span>
      </div>

      {customer.preferences.length > 0 && (
        <div className="flex flex-col gap-space-sm">
          <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Preferences
          </span>
          <div className="flex flex-wrap gap-space-xs">
            {customer.preferences.map((p) => (
              <Badge key={p} tone="brand">
                {p}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {customer.notes && (
        <div className="flex items-start gap-space-sm rounded-xl bg-status-info-bg p-space-md">
          <Icon name="sticky_note_2" size={17} className="mt-0.5 shrink-0 text-status-info" />
          <span className="font-body-sm text-body-sm text-on-surface">{customer.notes}</span>
        </div>
      )}

      <div className="flex flex-col gap-space-sm">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Order history ({customerOrders.length})
        </span>
        {customerOrders.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No linked orders yet in this dataset window.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
            {customerOrders.slice(0, 6).map((order) => (
              <div key={order.id} className="flex items-center justify-between px-space-md py-space-sm">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {order.orderNumber}
                  </span>
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    {formatDate(order.placedAt)} · {order.items.length} items
                  </span>
                </div>
                <div className="flex items-center gap-space-sm">
                  <Badge
                    tone={
                      order.status === 'completed'
                        ? 'success'
                        : order.status === 'cancelled'
                          ? 'critical'
                          : 'warning'
                    }
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                  <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface">
                    {formatMoney(order.total, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Switch
        checked={customer.marketingConsent}
        onChange={async (v) => {
          await api.upsertCustomer({ ...customer, marketingConsent: v })
        }}
        label="Marketing consent"
        description="Only message guests who have explicitly opted in."
      />
    </div>
  )
}
