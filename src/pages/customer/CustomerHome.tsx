import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, FoodThumb, Icon, SearchInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import { publicBase } from '@/lib/publicRoutes'
import { useAppStore } from '@/store/AppStore'
import { useCart } from '@/store/CartStore'
import { foodEmoji, foodTileStyle, formatMoney } from '@/lib/format'
import { getLatestGuestOrder } from '@/lib/customerSession'
import type { Branding, MenuItem } from '@/lib/types'

export function CustomerHome() {
  const { slug = '', tableNumber } = useParams()
  const navigate = useNavigate()
  const cart = useCart()
  const { db } = useAppStore()
  const [query, setQuery] = useState('')

  const org = db.organizations.find((o) => o.slug === slug) ?? null
  const table = tableNumber
    ? db.tables.find(
        (t) => t.organizationId === org?.id && t.tableNumber.toLowerCase() === tableNumber.toLowerCase(),
      ) ?? null
    : null

  const menu = useMemo(
    () => db.menuItems.filter((m) => m.organizationId === org?.id),
    [db.menuItems, org?.id],
  )

  const featured = useMemo(
    () => menu.filter((m) => m.isChefPick || m.isTrending).slice(0, 6),
    [menu],
  )

  const popular = useMemo(() => menu.filter((m) => m.available).slice(0, 8), [menu])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return menu
      .filter((m) => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, menu])

  if (!org) return null

  const branding = org.branding
  const base = publicBase(slug, tableNumber)
  const latestOrder = getLatestGuestOrder(org.id)

  return (
    <div className="flex flex-col">
      {/* ------------------------------------------------------------ hero */}
      <div
        className="relative flex flex-col gap-space-md px-space-lg pb-space-xl pt-space-lg"
        style={{
          background: `linear-gradient(165deg, color-mix(in srgb, ${branding.primaryColor} 22%, #fff) 0%, #FFF8F6 100%)`,
        }}
      >
        <div className="flex flex-col gap-space-xs">
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold tracking-tight text-on-surface">
            {branding.heroHeadline || `Welcome to ${org.name}`}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {branding.heroSubcopy || branding.tagline}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-space-sm">
          {table ? (
            <Badge tone="brand" icon="table_restaurant">
              Ordering for {table.tableNumber}
            </Badge>
          ) : (
            <Badge tone="warning" icon="qr_code_scanner">
              Scan a table QR to order
            </Badge>
          )}
          <Badge tone={branding.isOpen ? 'success' : 'critical'} dot>
            {branding.isOpen ? 'Open now' : 'Closed'}
          </Badge>
        </div>

        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search dishes, drinks or ingredients"
          className="w-full"
        />

        {searchResults.length > 0 && (
          <Card className="flex flex-col divide-y divide-slate-100 p-0">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`${base}/menu/${item.id}`)}
                className="flex items-center gap-space-md p-space-md text-left hover:bg-surface-container-low"
              >
                <FoodThumb name={item.name} size={40} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-label-md text-label-md font-semibold text-on-surface">
                    {item.name}
                  </span>
                  <span className="truncate font-label-xs text-label-xs text-on-surface-variant">
                    {item.description}
                  </span>
                </span>
                <span
                  className="tabular font-label-md text-label-md font-bold"
                  style={{ color: branding.primaryColor }}
                >
                  {formatMoney(item.price, branding.currency)}
                </span>
              </button>
            ))}
          </Card>
        )}
      </div>

      {/* --------------------------------------------------- active order */}
      {latestOrder && (
        <div className="px-space-lg pb-space-md">
          <button
            type="button"
            onClick={() => navigate(`${base}/order/${latestOrder.orderId}`)}
            className="flex w-full items-center justify-between gap-space-md rounded-2xl bg-slate-900 p-space-md text-left"
          >
            <span className="flex items-center gap-space-md">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: branding.primaryColor }}
              >
                <Icon name="receipt_long" size={19} className="text-white" />
              </span>
              <span className="flex flex-col">
                <span className="font-label-sm text-label-sm font-bold text-white">
                  Order {latestOrder.orderNumber} in progress
                </span>
                <span className="font-label-xs text-label-xs text-slate-400">
                  Table {latestOrder.tableNumber ?? '—'} · tap to track
                </span>
              </span>
            </span>
            <Icon name="chevron_right" size={20} className="text-slate-400" />
          </button>
        </div>
      )}

      {/* -------------------------------------------------------- featured */}
      {featured.length > 0 && (
        <section className="flex flex-col gap-space-md pb-space-md">
          <div className="flex items-center justify-between px-space-lg">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Chef&apos;s picks</h3>
            <Link
              to={`${base}/menu`}
              className="flex items-center gap-0.5 font-label-sm text-label-sm font-semibold"
              style={{ color: branding.primaryColor }}
            >
              See all
              <Icon name="chevron_right" size={15} />
            </Link>
          </div>
          <div className="no-scrollbar flex gap-space-md overflow-x-auto px-space-lg">
            {featured.map((item) => (
              <DishCard key={item.id} item={item} base={base} branding={branding} />
            ))}
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- popular */}
      <section className="flex flex-col gap-space-md px-space-lg pb-space-lg">
        <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Popular right now</h3>
        {popular.length === 0 ? (
          <EmptyState
            icon="restaurant_menu"
            title="Menu coming soon"
            description="This restaurant has not published any dishes yet."
          />
        ) : (
          <div className="flex flex-col gap-space-md">
            {popular.map((item) => (
              <DishRow key={item.id} item={item} base={base} branding={branding} />
            ))}
          </div>
        )}
        <Link to={`${base}/menu`}>
          <Button block size="lg" iconRight="arrow_forward">
            Browse full menu
          </Button>
        </Link>
      </section>

      {/* ------------------------------------------------------ info card */}
      <section className="px-space-lg pb-space-lg">
        <Card className="flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
              About {org.name}
            </span>
            <span className="flex items-center gap-0.5 font-label-sm text-label-sm font-semibold text-on-surface-variant">
              <Icon name="star" size={14} filled className="text-status-warning" />
              {branding.rating.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col gap-space-xs">
            {[
              { icon: 'location_on', value: branding.address || 'Address not set' },
              { icon: 'call', value: branding.phone || 'Phone not set' },
              { icon: 'schedule', value: branding.isOpen ? 'Open now' : 'Currently closed' },
              {
                icon: 'receipt_long',
                value: `Tax ${branding.taxPercent}%${
                  branding.serviceChargePercent ? ` · service charge ${branding.serviceChargePercent}%` : ''
                }`,
              },
            ].map((row) => (
              <span key={row.icon} className="flex items-center gap-space-sm">
                <Icon name={row.icon} size={16} className="shrink-0 text-on-surface-variant" />
                <span className="font-body-sm text-body-sm text-on-surface-variant">{row.value}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-space-xs">
            <Badge tone="neutral">Dine-in</Badge>
            <Badge tone="neutral">Table service</Badge>
            <Badge tone="neutral">Card &amp; UPI</Badge>
          </div>
        </Card>
      </section>

      {cart.count > 0 && (
        <p className="px-space-lg text-center font-label-xs text-label-xs text-on-surface-variant">
          {cart.count} item{cart.count === 1 ? '' : 's'} waiting in your order
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ dish views */

export function DishCard({
  item,
  base,
  branding,
}: {
  item: MenuItem
  base: string
  branding: Branding
}) {
  return (
    <Link
      to={`${base}/menu/${item.id}`}
      className="flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-e1 transition-shadow hover:shadow-e2"
    >
      <span
        className="flex h-28 w-full items-center justify-center text-[42px]"
        style={foodTileStyle(item.name)}
      >
        {foodEmoji(item.name)}
      </span>
      <span className="flex flex-1 flex-col gap-0.5 p-space-md">
        <span className="line-clamp-2 font-label-md text-label-md font-semibold text-on-surface">
          {item.name}
        </span>
        <span className="font-label-xs text-label-xs text-on-surface-variant">
          {item.prepTimeMinutes} min
        </span>
        <span className="mt-auto flex items-center justify-between pt-space-xs">
          <span
            className="tabular font-label-md text-label-md font-bold"
            style={{ color: branding.primaryColor }}
          >
            {formatMoney(item.price, branding.currency)}
          </span>
          {item.isChefPick && <Badge tone="brand">Chef</Badge>}
        </span>
      </span>
    </Link>
  )
}

export function DishRow({
  item,
  base,
  branding,
}: {
  item: MenuItem
  base: string
  branding: Branding
}) {
  const navigate = useNavigate()
  return (
    <div className="flex items-start gap-space-md rounded-2xl border border-slate-200 bg-white p-space-md shadow-e1">
      <button type="button" onClick={() => navigate(`${base}/menu/${item.id}`)} className="shrink-0">
        <FoodThumb name={item.name} size={72} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-space-sm">
          <span className="font-label-md text-label-md font-bold text-on-surface">{item.name}</span>
          <span
            className="tabular shrink-0 font-label-md text-label-md font-bold"
            style={{ color: branding.primaryColor }}
          >
            {formatMoney(item.price, branding.currency)}
          </span>
        </div>
        <p className="line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">{item.description}</p>
        <div className="mt-space-xs flex flex-wrap items-center gap-space-xs">
          {item.isVegetarian && (
            <Badge tone="success" icon="eco">
              Veg
            </Badge>
          )}
          {item.isSpicy && (
            <Badge tone="critical" icon="local_fire_department">
              Spicy
            </Badge>
          )}
          {item.isTrending && <Badge tone="info">Trending</Badge>}
          {item.optionGroups.length > 0 && (
            <span className="font-label-xs text-label-xs text-on-surface-variant">Customisable</span>
          )}
          <button
            type="button"
            onClick={() => navigate(`${base}/menu/${item.id}`)}
            className={cn('ml-auto rounded-lg px-space-md py-1 font-label-xs text-label-xs font-bold text-white')}
            style={{ background: branding.primaryColor }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
