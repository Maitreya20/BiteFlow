import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Icon,
  Input,
  MetricCard,
  ProgressBar,
  SegmentedControl,
  Toolbar,
  useToast,
  type Column,
} from '@/components/ui'
import { STATUS_TONE, useTenantRows, type TenantRow } from './AdminOverview'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { PLANS, PLAN_LIST, TRIAL_DAYS } from '@/lib/plans'
import { formatDate, formatMoney, formatNumber, relativeTime, titleCase } from '@/lib/format'
import type { PlanId } from '@/lib/types'

type Filter = 'all' | 'active' | 'trialing' | 'at_risk'

export function AdminSubscriptions() {
  const { db, switchOrganization } = useAppStore()
  const rows = useTenantRows()
  const toast = useToast()
  const navigate = useNavigate()

  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<TenantRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<TenantRow | null>(null)
  const [working, setWorking] = useState(false)

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => r.org.subscriptionStatus === 'active').length,
      trialing: rows.filter((r) => r.org.subscriptionStatus === 'trialing').length,
      at_risk: rows.filter((r) => ['past_due', 'cancelled', 'expired'].includes(r.org.subscriptionStatus)).length,
    }),
    [rows],
  )

  const subscriptions = useMemo(
    () =>
      rows
        .filter((r) => {
          if (filter === 'all') return true
          if (filter === 'at_risk') return ['past_due', 'cancelled', 'expired'].includes(r.org.subscriptionStatus)
          return r.org.subscriptionStatus === filter
        })
        .filter((r) => (query.trim().length < 2 ? true : r.org.name.toLowerCase().includes(query.trim().toLowerCase())))
        .sort((a, b) => +new Date(a.org.renewsAt ?? 0) - +new Date(b.org.renewsAt ?? 0)),
    [rows, filter, query],
  )

  const financials = useMemo(() => {
    const active = rows.filter((r) => r.org.subscriptionStatus === 'active')
    const mrr = active.reduce((s, r) => s + r.plan.priceMonthly, 0)
    const trialing = rows.filter((r) => r.org.subscriptionStatus === 'trialing')
    const pipeline = trialing.reduce((s, r) => s + r.plan.priceMonthly, 0)
    const atRiskMrr = rows
      .filter((r) => ['past_due', 'cancelled'].includes(r.org.subscriptionStatus))
      .reduce((s, r) => s + r.plan.priceMonthly, 0)
    return {
      mrr,
      arr: mrr * 12,
      pipeline,
      atRiskMrr,
      churn: rows.length ? (counts.at_risk / rows.length) * 100 : 0,
    }
  }, [rows, counts.at_risk])

  const invoicesFor = (orgId: string) => db.invoices.filter((i) => i.organizationId === orgId)

  const onReactivate = async (row: TenantRow) => {
    setWorking(true)
    try {
      await api.changePlan(row.org.id, row.org.planId)
      toast.success(`${row.org.name} reactivated on the ${row.plan.name} plan`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reactivate')
    } finally {
      setWorking(false)
    }
  }

  const onExtendTrial = async (row: TenantRow) => {
    setWorking(true)
    try {
      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      await api.updateOrganization(row.org.id, {
        subscriptionStatus: 'trialing',
        trialEndsAt,
        renewsAt: trialEndsAt,
      })
      toast.success(`${row.org.name}'s trial extended by ${TRIAL_DAYS} days`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not extend the trial')
    } finally {
      setWorking(false)
    }
  }

  const onPlanChange = async (row: TenantRow, planId: PlanId) => {
    setWorking(true)
    try {
      await api.changePlan(row.org.id, planId)
      toast.success(`${row.org.name} moved to ${PLANS[planId].name}`)
      setSelected((prev) => (prev && prev.org.id === row.org.id ? { ...prev, plan: PLANS[planId] } : prev))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change the plan')
    } finally {
      setWorking(false)
    }
  }

  const columns: Column<TenantRow>[] = [
    {
      key: 'tenant',
      header: 'Subscription',
      sortValue: (r) => r.org.name,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-semibold text-on-surface">{r.org.name}</span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            {r.plan.name} · {formatMoney(r.plan.priceMonthly)}/mo
          </span>
        </div>
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
      key: 'renews',
      header: 'Renews / ends',
      sortValue: (r) => r.org.renewsAt ?? '',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-body-sm text-body-sm text-on-surface">
            {formatDate(r.org.renewsAt ?? r.org.trialEndsAt)}
          </span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            {relativeTime(r.org.renewsAt ?? r.org.trialEndsAt)}
          </span>
        </div>
      ),
      hideBelow: 'sm' as const,
    },
    {
      key: 'health',
      header: 'Billing health',
      render: (r) => {
        const invoices = invoicesFor(r.org.id)
        const paid = invoices.filter((i) => i.status === 'paid').length
        const ratio = invoices.length ? (paid / invoices.length) * 100 : 100
        return (
          <div className="flex w-32 flex-col gap-1">
            <ProgressBar
              value={ratio}
              tone={ratio >= 95 ? 'success' : ratio >= 75 ? 'warning' : 'critical'}
              label="Invoices paid"
            />
            <span className="font-label-xs text-label-xs text-on-surface-variant">
              {paid}/{invoices.length || 0} paid
            </span>
          </div>
        )
      },
      hideBelow: 'md' as const,
    },
    {
      key: 'orders',
      header: 'Usage',
      align: 'right',
      sortValue: (r) => r.orders,
      render: (r) => (
        <span className="tabular font-label-sm text-label-sm">
          {formatNumber(r.orders)}
          <span className="font-normal text-on-surface-variant">
            {' / '}
            {formatNumber(r.plan.limits.maxOrdersPerMonth)}
          </span>
        </span>
      ),
      hideBelow: 'lg' as const,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-space-xs">
          {(r.org.subscriptionStatus === 'cancelled' || r.org.subscriptionStatus === 'expired') && (
            <Button size="sm" variant="secondary" onClick={() => onReactivate(r)} loading={working}>
              Reactivate
            </Button>
          )}
          {r.org.subscriptionStatus === 'past_due' && (
            <Button size="sm" variant="secondary" onClick={() => toast.info('Retrying the latest charge…')}>
              Retry charge
            </Button>
          )}
          <Button size="sm" variant="ghost" icon="chevron_right" onClick={() => setSelected(r)}>
            Manage
          </Button>
        </div>
      ),
      sticky: true,
    },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-0.5">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Subscriptions</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Recurring revenue, trials and dunning across every tenant
        </p>
      </header>

      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="MRR" value={formatMoney(financials.mrr)} icon="payments" tone="success" />
        <MetricCard label="ARR" value={formatMoney(financials.arr, 'INR', { compact: true })} icon="query_stats" />
        <MetricCard
          label="Trial pipeline"
          value={formatMoney(financials.pipeline)}
          icon="hourglass_top"
          hint={`${counts.trialing} tenants trialling`}
          tone="info"
        />
        <MetricCard
          label="At-risk MRR"
          value={formatMoney(financials.atRiskMrr)}
          icon="warning"
          hint={`${counts.at_risk} accounts · churn risk`}
          tone={counts.at_risk > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-space-md border-b border-slate-200 p-space-lg xl:flex-row xl:items-center xl:justify-between">
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'active', label: 'Active', count: counts.active },
              { value: 'trialing', label: 'Trials', count: counts.trialing },
              { value: 'at_risk', label: 'At risk', count: counts.at_risk },
            ]}
          />
          <Toolbar>
            <Input
              icon="search"
              placeholder="Search tenants…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-64"
            />
            <Button variant="secondary" icon="download">
              Export
            </Button>
          </Toolbar>
        </div>

        <DataTable
          columns={columns}
          rows={subscriptions}
          rowKey={(r) => r.org.id}
          empty={
            <div className="p-space-lg">
              <EmptyState
                icon="autorenew"
                title="Nothing in this bucket"
                description="Subscriptions will appear here as tenants move through their billing lifecycle."
              />
            </div>
          }
        />
      </Card>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width="md"
        title={selected?.org.name ?? ''}
        subtitle={selected ? `${selected.plan.name} · ${titleCase(selected.org.subscriptionStatus)}` : ''}
        footer={
          selected && (
            <>
              <Button
                variant="secondary"
                icon="hourglass_top"
                onClick={() => onExtendTrial(selected)}
                loading={working}
              >
                Extend trial
              </Button>
              <Button variant="destructive" icon="cancel" onClick={() => setCancelTarget(selected)}>
                Cancel
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
              <Badge tone="info">{formatMoney(selected.plan.priceMonthly)}/mo</Badge>
            </div>

            <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
              <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                Billing period
              </span>
              <span className="font-body-sm text-body-sm text-on-surface">
                {selected.org.subscriptionStatus === 'trialing'
                  ? `Trial ends ${formatDate(selected.org.trialEndsAt)}`
                  : `Renews ${formatDate(selected.org.renewsAt)}`}
              </span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">
                {relativeTime(selected.org.renewsAt ?? selected.org.trialEndsAt)}
              </span>
            </div>

            <div className="flex flex-col gap-space-md">
              <h3 className="font-headline-sm text-headline-sm">Change plan</h3>
              <div className="grid grid-cols-2 gap-space-sm">
                {PLAN_LIST.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    disabled={plan.id === selected.org.planId || working}
                    onClick={() => onPlanChange(selected, plan.id)}
                    className="flex flex-col items-start gap-0.5 rounded-xl border border-slate-200 p-space-md text-left transition-colors hover:border-primary hover:bg-surface-container-low disabled:border-primary/40 disabled:bg-primary-container/40"
                  >
                    <span className="font-label-md text-label-md font-semibold">{plan.name}</span>
                    <span className="font-label-xs text-label-xs text-on-surface-variant">
                      {plan.priceMonthly === 0 ? 'Custom' : `${formatMoney(plan.priceMonthly)}/mo`}
                    </span>
                    {plan.id === selected.org.planId && (
                      <span className="pt-1 font-label-xs text-label-xs font-semibold text-primary">Current</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-space-sm">
              <h3 className="font-headline-sm text-headline-sm">Invoice history</h3>
              {invoicesFor(selected.org.id).length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">No invoices issued yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-slate-200">
                  {invoicesFor(selected.org.id).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between gap-space-sm py-space-sm">
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm font-semibold">{invoice.invoiceNumber}</span>
                        <span className="font-label-xs text-label-xs text-on-surface-variant">
                          {invoice.periodLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-space-sm">
                        <span className="tabular font-label-sm text-label-sm font-semibold">
                          {formatMoney(invoice.amount)}
                        </span>
                        <Badge tone={invoice.status === 'paid' ? 'success' : invoice.status === 'pending' ? 'warning' : 'critical'}>
                          {invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              block
              icon="storefront"
              onClick={() => {
                switchOrganization(selected.org.id)
                navigate('/app/billing')
              }}
            >
              Open tenant billing page
            </Button>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return
          setWorking(true)
          try {
            await api.cancelSubscription(cancelTarget.org.id)
            toast.info(`${cancelTarget.org.name}'s subscription cancelled at period end`)
            setCancelTarget(null)
            setSelected(null)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not cancel')
          } finally {
            setWorking(false)
          }
        }}
        title="Cancel this subscription?"
        message={
          <>
            The tenant keeps access until <strong>{formatDate(cancelTarget?.org.renewsAt)}</strong>, then moves to
            read-only. Data is retained for 90 days.
          </>
        }
        confirmLabel="Cancel subscription"
        destructive
        loading={working}
      />

      <Card className="flex flex-col gap-space-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-space-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-low text-primary">
            <Icon name="info" size={18} />
          </span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Dunning runs automatically: a failed charge triggers 3 retries over 9 days before the account moves to
            past due.
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <Badge tone="warning" dot>
            {financials.churn.toFixed(0)}% accounts at risk
          </Badge>
        </div>
      </Card>
    </div>
  )
}
