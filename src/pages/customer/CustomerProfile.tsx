import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Card, Icon, ProgressBar, useToast } from '@/components/ui'
import { useAppStore } from '@/store/AppStore'
import { getGuestOrders } from '@/lib/customerSession'
import { formatMoney, formatDate } from '@/lib/format'
import type { Customer } from '@/lib/types'

export function CustomerProfile() {
  const { slug = '', tableNumber } = useParams()
  const { db, session } = useAppStore()
  const toast = useToast()

  const org = db.organizations.find((o) => o.slug === slug) ?? null
  const base = `/r/${slug}`

  const table = tableNumber
    ? db.tables.find(
        (t) => t.organizationId === org?.id && t.tableNumber.toLowerCase() === tableNumber.toLowerCase(),
      ) ?? null
    : null

  const orders = useMemo(() => {
    if (!org) return []
    return getGuestOrders(org.id)
      .map((ref) => db.orders.find((o) => o.id === ref.orderId))
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
  }, [db.orders, org])

  /** Match the signed-in profile to a tenant customer record when one exists. */
  const customer: Customer | null = useMemo(() => {
    if (!org || !session) return null
    return (
      db.customers.find(
        (c) =>
          c.organizationId === org.id &&
          (c.email.toLowerCase() === session.user.email.toLowerCase() ||
            c.name.toLowerCase() === session.user.fullName.toLowerCase()),
      ) ?? null
    )
  }, [db.customers, org, session])

  if (!org) return null

  const branding = org.branding
  const totalSpend = orders.reduce((s, o) => s + o.total, 0)
  const points = customer?.loyaltyPoints ?? Math.round(totalSpend / 10)
  const nextTier = customer?.tier === 'platinum' ? null : customer?.tier ?? 'bronze'
  const tierTarget = 40000
  const displayName = customer?.name ?? session?.user.fullName ?? 'Guest diner'

  return (
    <div className="flex flex-col gap-space-lg px-space-lg py-space-lg">
      {/* ------------------------------------------------------- identity */}
      <Card className="flex flex-col gap-space-md">
        <div className="flex items-center gap-space-md">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-[26px]"
            style={{ background: `color-mix(in srgb, ${branding.primaryColor} 14%, white)` }}
          >
            {branding.logoEmoji}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-headline-sm text-headline-sm font-bold text-on-surface">
              {displayName}
            </span>
            <span className="truncate font-label-xs text-label-xs text-on-surface-variant">
              {session?.user.email ?? 'Not signed in · guest session'}
            </span>
          </div>
          {customer && (
            <Badge tone="brand" className="ml-auto" icon="workspace_premium">
              {customer.tier}
            </Badge>
          )}
        </div>

        {table && (
          <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-space-md">
            <span className="flex items-center gap-space-sm">
              <Icon name="table_restaurant" size={17} className="text-on-surface-variant" />
              <span className="font-label-sm text-label-sm text-on-surface-variant">Current table</span>
            </span>
            <span className="font-label-md text-label-md font-bold text-on-surface">{table.tableNumber}</span>
          </div>
        )}

        {!session && (
          <div className="flex items-start gap-space-sm rounded-xl bg-status-info-bg p-space-md">
            <Icon name="info" size={17} className="mt-0.5 shrink-0 text-status-info" />
            <span className="font-body-sm text-body-sm text-on-surface">
              You're browsing as a guest — no account needed to order. Sign in to sync your loyalty points
              across devices.
            </span>
          </div>
        )}
      </Card>

      {/* --------------------------------------------------------- loyalty */}
      <Card
        className="flex flex-col gap-space-md"
        // Tint the loyalty card with the tenant brand.
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-space-sm font-headline-sm text-headline-sm font-bold text-on-surface">
            <span style={{ color: branding.primaryColor }}>
              <Icon name="loyalty" size={20} />
            </span>
            Loyalty
          </span>
          <span className="tabular font-headline-md text-headline-md font-bold" style={{ color: branding.primaryColor }}>
            {points.toLocaleString('en-IN')} pts
          </span>
        </div>
        {nextTier && (
          <>
            <ProgressBar value={totalSpend} max={tierTarget} />
            <span className="font-label-xs text-label-xs text-on-surface-variant">
              {formatMoney(Math.max(0, tierTarget - totalSpend), branding.currency)} more spend to unlock the
              next tier. You earn 10 points per {branding.currency === 'INR' ? '₹100' : '100'} spent at{' '}
              {org.name}.
            </span>
          </>
        )}
        <div className="grid grid-cols-3 gap-space-sm">
          {[
            { label: 'Orders', value: String(orders.length) },
            { label: 'Total spend', value: formatMoney(totalSpend, branding.currency, { compact: true }) },
            { label: 'Points', value: points.toLocaleString('en-IN') },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col rounded-xl bg-surface-container-low p-space-sm">
              <span className="tabular font-label-md text-label-md font-bold text-on-surface">{stat.value}</span>
              <span className="font-label-xs text-[10px] text-on-surface-variant">{stat.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ---------------------------------------------------- preferences */}
      {customer && customer.preferences.length > 0 && (
        <Card className="flex flex-col gap-space-sm">
          <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Your preferences
          </span>
          <div className="flex flex-wrap gap-space-xs">
            {customer.preferences.map((p) => (
              <Badge key={p} tone="brand">
                {p}
              </Badge>
            ))}
          </div>
          <p className="font-label-xs text-label-xs text-on-surface-variant">
            Tell your server about changes and we'll keep them on file.
          </p>
        </Card>
      )}

      {/* -------------------------------------------------------- actions */}
      <div className="flex flex-col gap-space-sm">
        <Link to={`${base}/orders`}>
          <Button block variant="secondary" icon="receipt_long" iconRight="chevron_right">
            Order history ({orders.length})
          </Button>
        </Link>
        <Link to={`${base}/menu`}>
          <Button block icon="restaurant_menu">
            Browse the menu
          </Button>
        </Link>
        <Button
          block
          variant="ghost"
          icon="support_agent"
          onClick={() => toast.info('Reach the team with the help button on any screen')}
        >
          Contact {org.name}
        </Button>
      </div>

      {/* ---------------------------------------------------- storefront */}
      <Card className="flex flex-col gap-space-sm">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          You're ordering from
        </span>
        <div className="flex items-center gap-space-md">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[22px]"
            style={{ background: `color-mix(in srgb, ${branding.primaryColor} 14%, white)` }}
          >
            {branding.logoEmoji}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-label-md text-label-md font-semibold text-on-surface">{org.name}</span>
            <span className="truncate font-label-xs text-label-xs text-on-surface-variant">
              {branding.address || branding.tagline}
            </span>
          </div>
          <Badge tone={branding.isOpen ? 'success' : 'critical'} className="ml-auto" dot>
            {branding.isOpen ? 'Open' : 'Closed'}
          </Badge>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-space-sm">
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            Guest since {formatDate(orders[orders.length - 1]?.placedAt ?? new Date().toISOString())}
          </span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            Powered by BiteFlow
          </span>
        </div>
      </Card>
    </div>
  )
}

export default CustomerProfile
