import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Divider,
  Drawer,
  EmptyState,
  Icon,
  Input,
  MetricCard,
  Select,
  Toolbar,
  useToast,
  type Column,
} from '@/components/ui'
import { PLAN_COLOR, STATUS_TONE, useTenantRows, type TenantRow } from './AdminOverview'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { PLANS, PLAN_LIST } from '@/lib/plans'
import { formatDate, formatMoney, formatNumber, relativeTime, titleCase } from '@/lib/format'
import { BUSINESS_TYPE_LABELS, type PlanId, type SubscriptionStatus } from '@/lib/types'

type StatusFilter = 'all' | SubscriptionStatus

export function AdminTenants() {
  const { db, switchOrganization } = useAppStore()
  const rows = useTenantRows()
  const toast = useToast()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | PlanId>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<TenantRow | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<TenantRow | null>(null)
  const [working, setWorking] = useState(false)
  const [counter, setCounter] = useState<import('@/data/api').OrderNumberCounter | null>(null)
  const [counterLoading, setCounterLoading] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => (planFilter === 'all' ? true : r.org.planId === planFilter))
      .filter((r) => (statusFilter === 'all' ? true : r.org.subscriptionStatus === statusFilter))
      .filter((r) =>
        q.length < 2
          ? true
          : r.org.name.toLowerCase().includes(q) ||
            r.org.slug.toLowerCase().includes(q) ||
            r.org.gstNumber.toLowerCase().includes(q),
      )
      .sort((a, b) => b.revenue - a.revenue)
  }, [rows, query, planFilter, statusFilter])

  const totals = useMemo(
    () => ({
      tenants: filtered.length,
      mrr: filtered
        .filter((r) => r.org.subscriptionStatus === 'active')
        .reduce((s, r) => s + r.plan.priceMonthly, 0),
      orders: filtered.reduce((s, r) => s + r.orders, 0),
      gmv: filtered.reduce((s, r) => s + r.revenue, 0),
    }),
    [filtered],
  )

  const ownerOf = (orgId: string) => {
    const membership =
      db.memberships.find((m) => m.organizationId === orgId && m.role === 'owner') ??
      db.memberships.find((m) => m.organizationId === orgId)
    const profile = db.profiles.find((p) => p.id === membership?.userId)
    return { name: profile?.fullName ?? '—', email: profile?.email ?? '—' }
  }

  const onPlanChange = async (row: TenantRow, planId: PlanId) => {
    setWorking(true)
    try {
      await api.changePlan(row.org.id, planId)
      toast.success(`${row.org.name} moved to the ${PLANS[planId].name} plan`)
      setSelected((prev) => (prev && prev.org.id === row.org.id ? { ...prev, plan: PLANS[planId] } : prev))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change the plan')
    } finally {
      setWorking(false)
    }
  }

  const onCancelSubscription = async (row: TenantRow) => {
    setWorking(true)
    try {
      await api.cancelSubscription(row.org.id)
      toast.info(`${row.org.name}'s subscription is cancelled at period end`)
    } finally {
      setWorking(false)
    }
  }

  const onEnterTenant = (row: TenantRow) => {
    switchOrganization(row.org.id)
    toast.success(`Now viewing ${row.org.name} as a platform admin`)
    navigate('/app/dashboard')
  }

  // Load the order number counter for the selected tenant.
  useEffect(() => {
    if (!selected) {
      setCounter(null)
      return
    }
    let cancelled = false
    setCounterLoading(true)
    void (async () => {
      try {
        const counters = await api.getOrderNumberCounters()
        const match = counters.find((c) => c.organizationId === selected!.org.id)
        if (!cancelled) setCounter(match ?? null)
      } catch {
        if (!cancelled) setCounter(null)
      } finally {
        if (!cancelled) setCounterLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selected])

  const columns: Column<TenantRow>[] = [
    {
      key: 'tenant',
      header: 'Restaurant',
      sortValue: (r) => r.org.name,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-semibold text-on-surface">{r.org.name}</span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            {BUSINESS_TYPE_LABELS[r.org.businessType]} · /{r.org.slug}
          </span>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      sortValue: (r) => r.plan.priceMonthly,
      render: (r) => (
        <span className="flex items-center gap-space-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLOR[r.org.planId] }} />
          <span className="font-label-sm text-label-sm font-semibold">{r.plan.name}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.org.subscriptionStatus,
      render: (r) => (
        <Badge tone={STATUS_TONE[r.org.subscriptionStatus]} dot>
          {titleCase(r.org.subscriptionStatus)}
        </Badge>
      ),
    },
    {
      key: 'team',
      header: 'Team',
      align: 'right',
      sortValue: (r) => r.team,
      render: (r) => <span className="tabular font-body-sm text-body-sm">{r.team}</span>,
      hideBelow: 'md' as const,
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
      key: 'gmv',
      header: 'GMV',
      align: 'right',
      sortValue: (r) => r.revenue,
      render: (r) => (
        <span className="tabular font-label-md text-label-md font-semibold">
          {formatMoney(r.revenue, r.org.currency, { compact: true })}
        </span>
      ),
    },
    {
      key: 'renews',
      header: 'Renews',
      align: 'right',
      sortValue: (r) => r.org.renewsAt ?? '',
      render: (r) => (
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          {r.org.renewsAt ? formatDate(r.org.renewsAt) : '—'}
        </span>
      ),
      hideBelow: 'lg' as const,
    },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-0.5">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Tenants</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Every restaurant on BiteFlow — plans, billing state and support actions
        </p>
      </header>

      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tenants in view" value={formatNumber(totals.tenants)} icon="storefront" />
        <MetricCard label="Contracted MRR" value={formatMoney(totals.mrr)} icon="payments" tone="success" />
        <MetricCard label="Orders" value={formatNumber(totals.orders)} icon="receipt_long" tone="info" />
        <MetricCard
          label="Gross order value"
          value={formatMoney(totals.gmv, 'INR', { compact: true })}
          icon="stacked_line_chart"
          tone="neutral"
        />
      </div>

      <Card padded={false}>
        <div className="border-b border-slate-200 p-space-lg">
          <Toolbar>
            <Input
              icon="search"
              placeholder="Search by name, slug or GSTIN…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-72"
            />
            <Select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as 'all' | PlanId)}
              options={[
                { value: 'all', label: 'All plans' },
                ...PLAN_LIST.map((p) => ({ value: p.id, label: p.name })),
              ]}
              className="sm:w-40"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={[
                { value: 'all', label: 'Any status' },
                { value: 'active', label: 'Active' },
                { value: 'trialing', label: 'Trialing' },
                { value: 'past_due', label: 'Past due' },
                { value: 'cancelled', label: 'Cancelled' },
                { value: 'expired', label: 'Expired' },
              ]}
              className="sm:w-40"
            />
            <span className="ml-auto font-label-sm text-label-sm text-on-surface-variant">
              {filtered.length} of {rows.length}
            </span>
          </Toolbar>
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.org.id}
          onRowClick={setSelected}
          empty={
            <div className="p-space-lg">
              <EmptyState
                icon="storefront"
                title="No tenants match those filters"
                description="Try a different plan, status or search term."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('')
                      setPlanFilter('all')
                      setStatusFilter('all')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          }
        />
      </Card>

      {/* -------------------------------------------------- tenant detail */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width="lg"
        title={selected?.org.name ?? ''}
        subtitle={selected ? `${BUSINESS_TYPE_LABELS[selected.org.businessType]} · /${selected.org.slug}` : ''}
        footer={
          selected && (
            <>
              <Button
                variant="secondary"
                icon="logout"
                onClick={() => onCancelSubscription(selected)}
                loading={working}
              >
                Cancel subscription
              </Button>
              <Button
                variant="destructive"
                icon="block"
                onClick={() => setSuspendTarget(selected)}
              >
                Suspend
              </Button>
              <Button icon="login" onClick={() => onEnterTenant(selected)}>
                Enter dashboard
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-space-lg p-space-xl">
            <div className="flex flex-wrap items-center gap-space-sm">
              <Badge tone={STATUS_TONE[selected.org.subscriptionStatus]} dot>
                {titleCase(selected.org.subscriptionStatus)}
              </Badge>
              <Badge tone="neutral" icon="workspace_premium">
                {selected.plan.name}
              </Badge>
              {selected.org.seededDemo && <Badge tone="info">Demo data</Badge>}
            </div>

            <div className="grid grid-cols-2 gap-space-md">
              {[
                { label: 'Orders', value: formatNumber(selected.orders) },
                { label: 'Gross value', value: formatMoney(selected.revenue, selected.org.currency, { compact: true }) },
                { label: 'Team members', value: String(selected.team) },
                { label: 'Tables', value: String(selected.tables) },
                { label: 'Customers', value: formatNumber(selected.customers) },
                { label: 'MRR', value: formatMoney(selected.plan.priceMonthly) },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-0.5 rounded-xl bg-surface-container-low p-space-md">
                  <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                    {stat.label}
                  </span>
                  <span className="tabular font-headline-sm text-headline-sm font-bold">{stat.value}</span>
                </div>
              ))}
            </div>

            <Divider />

            <div className="flex flex-col gap-space-md">
              <h3 className="font-headline-sm text-headline-sm">Account</h3>
              <dl className="flex flex-col gap-space-sm">
                {[
                  { term: 'Owner', detail: `${ownerOf(selected.org.id).name} · ${ownerOf(selected.org.id).email}` },
                  { term: 'GSTIN', detail: selected.org.gstNumber || 'Not provided' },
                  { term: 'Currency / locale', detail: `${selected.org.currency} · ${selected.org.language}` },
                  { term: 'Timezone', detail: selected.org.timezone },
                  { term: 'Signed up', detail: formatDate(selected.org.createdAt) },
                  {
                    term: 'Renews',
                    detail: selected.org.renewsAt
                      ? `${formatDate(selected.org.renewsAt)} (${relativeTime(selected.org.renewsAt)})`
                      : '—',
                  },
                ].map((row) => (
                  <div key={row.term} className="flex items-start justify-between gap-space-md">
                    <dt className="font-label-sm text-label-sm text-on-surface-variant">{row.term}</dt>
                    <dd className="text-right font-body-sm text-body-sm text-on-surface">{row.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <Divider />

            <div className="flex flex-col gap-space-md">
              <h3 className="font-headline-sm text-headline-sm">Change plan</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Changes take effect immediately and are pro-rated on the next invoice.
              </p>
              <div className="flex flex-col gap-space-sm">
                {PLAN_LIST.map((plan) => {
                  const current = plan.id === selected.org.planId
                  return (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between gap-space-md rounded-xl border border-slate-200 p-space-md"
                    >
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md font-semibold">{plan.name}</span>
                        <span className="font-label-xs text-label-xs text-on-surface-variant">
                          {formatMoney(plan.priceMonthly)}/mo · {formatNumber(plan.limits.maxTables)} tables ·{' '}
                          {formatNumber(plan.limits.maxMenuItems)} items
                        </span>
                      </div>
                      {current ? (
                        <Badge tone="success" dot>
                          Current
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onPlanChange(selected, plan.id)}
                          loading={working}
                        >
                          Switch
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <Divider />

            {/* Order number counter monitor */}
            <div className="flex flex-col gap-space-md">
              <h3 className="font-headline-sm text-headline-sm">Order numbering</h3>
              {counter ? (
                <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                      Next order number
                    </span>
                    <span className="font-headline-lg text-headline-lg font-extrabold tabular">
                      {counter.nextOrderNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                      Numbers issued
                    </span>
                    <span className="font-body-sm tabular text-on-surface-variant">
                      {counter.lastNumber - 1199} since onboarding
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                      Slug
                    </span>
                    <span className="font-body-sm tabular text-on-surface-variant">
                      /{counter.slug}
                    </span>
                  </div>
                  <div className="mt-space-sm rounded-lg bg-status-info-bg p-space-xs">
                    <span className="font-label-xs text-label-xs text-on-surface-variant">
                      The next QR order placed at this tenant will be number {counter.nextOrderNumber}.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    Loading order numbering info…
                  </span>
                </div>
              )}
            </div>

            <Divider />

            <div className="flex flex-col gap-space-sm">
              <h3 className="font-headline-sm text-headline-sm">Support tools</h3>
              <Button
                variant="secondary"
                icon="qr_code_2"
                block
                onClick={() => {
                  switchOrganization(selected.org.id)
                  navigate('/app/tables/qr')
                }}
              >
                Open QR generator for this tenant
              </Button>
              <Button
                variant="secondary"
                icon="receipt_long"
                block
                onClick={() => {
                  switchOrganization(selected.org.id)
                  navigate('/app/orders')
                }}
              >
                Inspect live orders
              </Button>
              <Button
                variant="ghost"
                icon="mail"
                block
                onClick={() => toast.info(`Emailing ${ownerOf(selected.org.id).email} is disabled in the prototype`)}
              >
                Email the owner
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        onConfirm={async () => {
          if (!suspendTarget) return
          setWorking(true)
          try {
            await api.updateOrganization(suspendTarget.org.id, { subscriptionStatus: 'cancelled' })
            toast.info(`${suspendTarget.org.name} suspended — QR ordering paused`)
            setSuspendTarget(null)
            setSelected(null)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not suspend this tenant')
          } finally {
            setWorking(false)
          }
        }}
        title="Suspend this tenant?"
        message={
          <>
            <strong>{suspendTarget?.org.name}</strong> will lose QR ordering and dashboard access immediately.
            Their data is retained and the account can be reactivated at any time.
          </>
        }
        confirmLabel="Suspend tenant"
        destructive
        loading={working}
      />
    </div>
  )
}
