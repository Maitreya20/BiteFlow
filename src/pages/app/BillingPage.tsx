import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Icon,
  LimitMeter,
  Modal,
  SegmentedControl,
  useToast,
  type Column,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore, usePlanUsage } from '@/store/AppStore'
import * as api from '@/data/api'
import { formatDate, formatMoney, relativeTime } from '@/lib/format'
import { LIMIT_LABELS, PLAN_LIST, PLANS, nextPlanId } from '@/lib/plans'
import type { Invoice, PlanId } from '@/lib/types'

export function BillingPage() {
  const { organization, invoices, paymentMethods, role } = useAppStore()
  const { plan, usage } = usePlanUsage()
  const toast = useToast()

  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [changeOpen, setChangeOpen] = useState(false)
  const [targetPlan, setTargetPlan] = useState<PlanId>(organization?.planId ?? 'growth')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!organization) return null

  const currency = organization.branding.currency
  const isExpired = organization.subscriptionStatus === 'expired'
  const isCancelled = organization.subscriptionStatus === 'cancelled'
  const upgradeTo = nextPlanId(organization.planId)

  const canUpgrade = role === 'owner' || role === 'super_admin'

  const invoiceColumns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice',
      sortValue: (i) => i.invoiceNumber,
      render: (i) => (
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-semibold text-on-surface">{i.invoiceNumber}</span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">{i.periodLabel}</span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Issued',
      sortValue: (i) => i.issuedAt,
      render: (i) => (
        <span className="font-body-sm text-body-sm text-on-surface-variant">{formatDate(i.issuedAt)}</span>
      ),
      hideBelow: 'sm' as const,
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (i) => <Badge tone="neutral">{PLANS[i.planId].name}</Badge>,
      hideBelow: 'md' as const,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortValue: (i) => i.amount,
      render: (i) => (
        <span className="tabular font-label-md text-label-md font-bold text-on-surface">
          {formatMoney(i.amount, currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => (
        <Badge tone={i.status === 'paid' ? 'success' : i.status === 'pending' ? 'warning' : 'critical'} dot>
          {i.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sticky: true,
      render: () => (
        <Button
          size="sm"
          variant="ghost"
          icon="download"
          onClick={() => toast.info('PDF invoices are not generated in the prototype')}
        >
          PDF
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            Subscription &amp; Billing
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {plan.name} plan · renews {organization.renewsAt ? formatDate(organization.renewsAt) : '—'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <SegmentedControl
            value={cycle}
            onChange={setCycle}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly', icon: 'savings' },
            ]}
          />
          {canUpgrade && (
            <Button
              icon="upgrade"
              onClick={() => {
                setTargetPlan(upgradeTo ?? organization.planId)
                setChangeOpen(true)
              }}
            >
              {upgradeTo ? 'Upgrade plan' : 'Change plan'}
            </Button>
          )}
        </div>
      </header>

      {(isExpired || isCancelled) && (
        <Card
          className={cn(
            'flex flex-wrap items-center justify-between gap-space-md',
            isExpired ? 'border-status-critical/25 bg-status-critical-bg' : 'border-status-warning/25 bg-status-warning-bg',
          )}
        >
          <div className="flex items-center gap-space-md">
            <Icon
              name={isExpired ? 'error' : 'info'}
              size={22}
              className={isExpired ? 'text-status-critical' : 'text-status-warning'}
            />
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                {isExpired ? 'Your subscription has expired' : 'Your subscription is cancelled'}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {isExpired
                  ? 'QR ordering is paused for guests. Renew to resume service.'
                  : 'Access continues until the end of the paid period, then the account pauses.'}
              </span>
            </div>
          </div>
          <div className="flex gap-space-sm">
            <Button size="sm" icon="autorenew" onClick={() => toast.info('Renewal checkout is simulated in the prototype')}>
              Renew now
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setChangeOpen(true)}>
              View plans
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
        {/* ------------------------------------------------------ plan card */}
        <Card className="flex flex-col gap-space-lg">
          <div className="flex flex-wrap items-start justify-between gap-space-md">
            <div className="flex items-start gap-space-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary">
                <Icon name="workspace_premium" size={24} />
              </span>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-space-sm">
                  <h2 className="font-headline-md text-headline-md text-on-surface">{plan.name}</h2>
                  <Badge
                    tone={
                      organization.subscriptionStatus === 'active'
                        ? 'success'
                        : organization.subscriptionStatus === 'trialing'
                          ? 'info'
                          : 'critical'
                    }
                    dot
                  >
                    {organization.subscriptionStatus}
                  </Badge>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{plan.tagline}</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="tabular font-headline-lg text-headline-lg font-bold text-on-surface">
                {plan.priceMonthly ? formatMoney(cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly, currency) : 'Custom'}
              </span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">
                per {cycle === 'yearly' ? 'year' : 'month'}
              </span>
            </div>
          </div>

          <div className="grid gap-space-md sm:grid-cols-3">
            {[
              { label: 'Renews on', value: organization.renewsAt ? formatDate(organization.renewsAt) : '—', icon: 'event_repeat' },
              {
                label: 'Trial ends',
                value: organization.trialEndsAt ? relativeTime(organization.trialEndsAt) : '—',
                icon: 'hourglass_bottom',
              },
              { label: 'Payment method', value: paymentMethods[0] ? `${paymentMethods[0].brand} •••• ${paymentMethods[0].last4}` : 'None on file', icon: 'credit_card' },
            ].map((cell) => (
              <div key={cell.label} className="flex flex-col gap-0.5 rounded-xl bg-surface-container-low p-space-md">
                <span className="flex items-center gap-space-xs font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                  <Icon name={cell.icon} size={13} />
                  {cell.label}
                </span>
                <span className="truncate font-label-md text-label-md font-semibold capitalize text-on-surface">
                  {cell.value}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-space-sm">
            <Button
              variant="secondary"
              icon="credit_card"
              onClick={() => toast.info('Payment method updates happen in the billing portal')}
            >
              Manage payment method
            </Button>
            <Button
              variant="secondary"
              icon="receipt_long"
              onClick={() => toast.info('All invoices are listed below')}
            >
              Billing history
            </Button>
            {canUpgrade && organization.subscriptionStatus === 'active' && (
              <Button variant="danger-ghost" icon="cancel" onClick={() => setCancelOpen(true)}>
                Cancel subscription
              </Button>
            )}
          </div>
        </Card>

        {/* ------------------------------------------------------- usage */}
        <Card className="flex flex-col gap-space-lg">
          <CardHeader
            icon="speed"
            title="Plan usage"
            subtitle="Limits reset at the start of each billing period"
          />
          <div className="flex flex-col gap-space-lg">
            <LimitMeter label="Tables" used={usage.maxTables} limit={plan.limits.maxTables} />
            <LimitMeter label="Menu items" used={usage.maxMenuItems} limit={plan.limits.maxMenuItems} />
            <LimitMeter label="Employees" used={usage.maxEmployees} limit={plan.limits.maxEmployees} />
            <LimitMeter label="Orders this month" used={usage.maxOrdersPerMonth} limit={plan.limits.maxOrdersPerMonth} />
            <LimitMeter label="Customers" used={usage.maxCustomers} limit={plan.limits.maxCustomers} />
          </div>
          {upgradeTo && (
            <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md">
              <Icon name="trending_up" size={18} className="mt-0.5 shrink-0 text-primary" />
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                  Next tier: {PLANS[upgradeTo].name}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {PLANS[upgradeTo].limits.maxTables} tables, {PLANS[upgradeTo].limits.maxMenuItems} items and{' '}
                  {PLANS[upgradeTo].limits.maxEmployees} staff seats.
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------- plan cards */}
      <Card className="flex flex-col gap-space-lg">
        <CardHeader icon="sell" title="Available plans" subtitle="Switch instantly — limits apply immediately" />
        <div className="grid gap-space-md md:grid-cols-2 xl:grid-cols-4">
          {PLAN_LIST.map((p) => {
            const current = p.id === organization.planId
            return (
              <div
                key={p.id}
                className={cn(
                  'flex flex-col gap-space-sm rounded-2xl border-[1.5px] p-space-lg',
                  current ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">{p.name}</span>
                  {current ? (
                    <Badge tone="brand">Current</Badge>
                  ) : p.recommended ? (
                    <Badge tone="neutral">Popular</Badge>
                  ) : null}
                </div>
                <span className="tabular font-headline-md text-headline-md font-bold text-on-surface">
                  {p.priceMonthly ? formatMoney(cycle === 'yearly' ? p.priceYearly : p.priceMonthly, currency) : 'Custom'}
                  <span className="font-label-sm text-label-sm font-normal text-on-surface-variant">
                    /{cycle === 'yearly' ? 'yr' : 'mo'}
                  </span>
                </span>
                <ul className="flex flex-col gap-space-2xs">
                  {p.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-space-sm">
                      <Icon name="check_circle" size={15} className="mt-0.5 shrink-0 text-status-success" />
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  block
                  variant={current ? 'secondary' : 'primary'}
                  disabled={current || !canUpgrade}
                  onClick={() => {
                    setTargetPlan(p.id)
                    setChangeOpen(true)
                  }}
                >
                  {current ? 'Current plan' : p.priceMonthly ? 'Switch to this plan' : 'Contact sales'}
                </Button>
              </div>
            )
          })}
        </div>
      </Card>

      {/* -------------------------------------------------------- invoices */}
      <Card padded={false} className="flex flex-col overflow-hidden">
        <div className="p-space-lg">
          <CardHeader
            icon="receipt"
            title="Invoice history"
            subtitle={`${invoices.length} invoices · latest ${invoices[0] ? relativeTime(invoices[0].issuedAt) : '—'}`}
          />
        </div>
        <DataTable
          columns={invoiceColumns}
          rows={invoices}
          rowKey={(i) => i.id}
          empty={<EmptyState icon="receipt" title="No invoices yet" description="Your first invoice appears after the trial ends." />}
        />
      </Card>

      {/* --------------------------------------------------- change plan modal */}
      <Modal
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        title={`Switch to ${PLANS[targetPlan].name}`}
        description="Your limits change immediately. Billing is pro-rated on the next invoice."
        icon="upgrade"
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setChangeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={saving}
              onClick={async () => {
                setSaving(true)
                await api.changePlan(organization.id, targetPlan)
                setSaving(false)
                setChangeOpen(false)
                toast.success(`Now on ${PLANS[targetPlan].name}`, 'New limits are active.')
              }}
            >
              Confirm switch
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-space-lg">
          <div className="grid gap-space-md sm:grid-cols-2">
            <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Current · {plan.name}
              </span>
              <span className="tabular font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(plan.priceMonthly, currency)}
              </span>
            </div>
            <div className="flex flex-col gap-space-sm rounded-xl bg-ember-50 p-space-md">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-ember-700">
                New · {PLANS[targetPlan].name}
              </span>
              <span className="tabular font-headline-md text-headline-md font-bold text-on-surface">
                {PLANS[targetPlan].priceMonthly
                  ? formatMoney(PLANS[targetPlan].priceMonthly, currency)
                  : 'Custom'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-space-sm">
            <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Limit comparison
            </span>
            {(Object.keys(LIMIT_LABELS) as (keyof typeof LIMIT_LABELS)[])
              .filter((k) => k !== 'maxStorageMb')
              .map((key) => {
                const before = plan.limits[key]
                const after = PLANS[targetPlan].limits[key]
                return (
                  <div key={key} className="flex items-center justify-between border-b border-slate-100 pb-space-xs">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{LIMIT_LABELS[key]}</span>
                    <span className="flex items-center gap-space-sm">
                      <span className="tabular font-label-sm text-label-sm text-on-surface-variant">
                        {before >= 9999 ? '∞' : before.toLocaleString('en-IN')}
                      </span>
                      <Icon name="arrow_forward" size={14} className="text-on-surface-variant" />
                      <span
                        className={cn(
                          'tabular font-label-sm text-label-sm font-bold',
                          after > before ? 'text-status-success' : after < before ? 'text-status-critical' : 'text-on-surface',
                        )}
                      >
                        {after >= 9999 ? '∞' : after.toLocaleString('en-IN')}
                      </span>
                    </span>
                  </div>
                )
              })}
          </div>

          <div className="flex items-start gap-space-sm rounded-xl bg-status-info-bg p-space-md">
            <Icon name="info" size={17} className="mt-0.5 shrink-0 text-status-info" />
            <span className="font-body-sm text-body-sm text-on-surface">
              Downgrading below current usage will not delete data — you simply cannot add more until you
              are back under the limit.
            </span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => {
          await api.cancelSubscription(organization.id)
          setCancelOpen(false)
          toast.success('Subscription cancelled', 'Access continues until the period ends.')
        }}
        title="Cancel your subscription?"
        message={
          <>
            You keep access until <strong>{organization.renewsAt ? formatDate(organization.renewsAt) : 'the period ends'}</strong>,
            then QR ordering and the dashboard pause. Your data is retained.
          </>
        }
        confirmLabel="Cancel subscription"
        cancelLabel="Keep plan"
        destructive
      />
    </div>
  )
}
