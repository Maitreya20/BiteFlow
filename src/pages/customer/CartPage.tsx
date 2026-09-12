import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FoodThumb,
  Icon,
  Input,
  Textarea,
  useToast,
} from '@/components/ui'
import { useAppStore } from '@/store/AppStore'
import { useCart } from '@/store/CartStore'
import * as api from '@/data/api'
import { rememberOrder } from '@/lib/customerSession'
import { formatMoney } from '@/lib/format'
import type { OrderChannel } from '@/lib/types'

export function CartPage() {
  const { slug = '', tableNumber } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const cart = useCart()
  const { db, session } = useAppStore()

  const org = db.organizations.find((o) => o.slug === slug) ?? null
  const table = tableNumber
    ? db.tables.find(
        (t) => t.organizationId === org?.id && t.tableNumber.toLowerCase() === tableNumber.toLowerCase(),
      ) ?? null
    : null

  const [channel, setChannel] = useState<OrderChannel>(table ? 'dine_in' : 'takeaway')
  const [guestName, setGuestName] = useState(session?.user.fullName ?? '')
  const [allergyNote, setAllergyNote] = useState('')
  const [kitchenNote, setKitchenNote] = useState('')
  const [placing, setPlacing] = useState(false)

  if (!org) return null

  const branding = org.branding
  const base = `/r/${slug}`
  const currency = branding.currency
  const tax = Math.round((cart.subtotal * branding.taxPercent) / 100)
  const service = Math.round((cart.subtotal * branding.serviceChargePercent) / 100)
  const total = cart.subtotal + tax + service

  const placeOrder = async () => {
    if (!cart.lines.length) return
    setPlacing(true)
    try {
      const order = await api.placeOrder({
        organizationId: org.id,
        tableId: table?.id ?? null,
        tableNumber: table?.tableNumber ?? null,
        channel,
        customerId: null,
        customerName: guestName.trim() || 'Guest',
        items: cart.lines.map((line) => ({
          menuItemId: line.menuItemId,
          name: line.name,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          options: line.options,
          optionsTotal: line.optionsTotal,
          notes: line.notes,
        })),
        notes: '',
        allergyNote,
        kitchenNote,
        taxPercent: branding.taxPercent,
        serviceChargePercent: branding.serviceChargePercent,
      })

      rememberOrder({
        orderId: order.id,
        orderNumber: order.orderNumber,
        organizationId: org.id,
        tableNumber: order.tableNumber,
        placedAt: order.placedAt,
        total: order.total,
      })

      cart.clear()
      toast.success('Order placed 🎉', `${order.orderNumber} is with the kitchen.`)
      navigate(`${base}/order/${order.id}`)
    } catch (err) {
      toast.error('Could not place the order', err instanceof Error ? err.message : undefined)
    } finally {
      setPlacing(false)
    }
  }

  if (!cart.lines.length) {
    return (
      <div className="px-space-lg py-space-xl">
        <EmptyState
          icon="shopping_bag"
          title="Your order is empty"
          description="Browse the menu and add a dish to get started."
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
    <div className="flex flex-col gap-space-lg px-space-lg py-space-lg pb-40">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold tracking-tight text-on-surface">
          Your order
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {cart.count} item{cart.count === 1 ? '' : 's'}
          {table ? ` · served to ${table.tableNumber}` : ' · takeaway'}
        </p>
      </div>

      {/* ------------------------------------------------------- order type */}
      <div className="grid grid-cols-2 gap-space-sm">
        {([
          { value: 'dine_in' as OrderChannel, label: 'Dine in', icon: 'table_restaurant', hint: table ? table.tableNumber : 'Pick a table' },
          { value: 'takeaway' as OrderChannel, label: 'Takeaway', icon: 'shopping_bag', hint: 'Collect at counter' },
        ]).map((option) => {
          const active = channel === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setChannel(option.value)}
              aria-pressed={active}
              className="flex flex-col items-start gap-0.5 rounded-xl border-[1.5px] p-space-md text-left transition-colors"
              style={
                active
                  ? { borderColor: branding.primaryColor, background: `color-mix(in srgb, ${branding.primaryColor} 8%, white)` }
                  : { borderColor: '#E2E8F0', background: '#fff' }
              }
            >
              <span className="flex items-center gap-space-sm">
                <span style={active ? { color: branding.primaryColor } : undefined}>
                  <Icon name={option.icon} size={18} />
                </span>
                <span className="font-label-md text-label-md font-semibold text-on-surface">{option.label}</span>
              </span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">{option.hint}</span>
            </button>
          )
        })}
      </div>

      {/* ----------------------------------------------------------- lines */}
      <div className="flex flex-col gap-space-md">
        {cart.lines.map((line) => (
          <Card key={line.signature} className="flex flex-col gap-space-sm">
            <div className="flex items-start gap-space-md">
              <FoodThumb name={line.name} size={56} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-start justify-between gap-space-sm">
                  <span className="font-label-md text-label-md font-bold text-on-surface">{line.name}</span>
                  <span className="tabular shrink-0 font-label-md text-label-md font-bold text-on-surface">
                    {formatMoney((line.unitPrice + line.optionsTotal) * line.quantity, currency)}
                  </span>
                </div>
                {line.options.length > 0 && (
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    {line.options.join(' · ')}
                  </span>
                )}
                {line.notes && (
                  <span className="inline-flex w-fit items-center gap-1 rounded bg-status-warning-bg px-1.5 py-0.5 font-label-xs text-label-xs text-status-warning">
                    <Icon name="sticky_note_2" size={12} />
                    {line.notes}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-space-sm">
              <button
                type="button"
                onClick={() => cart.removeLine(line.signature)}
                className="flex items-center gap-1 font-label-xs text-label-xs font-semibold text-status-critical"
              >
                <Icon name="delete" size={15} />
                Remove
              </button>
              <span className="flex items-center gap-space-md">
                <button
                  type="button"
                  aria-label={`Decrease ${line.name}`}
                  onClick={() => cart.setQuantity(line.signature, line.quantity - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 hover:bg-surface-container-low"
                >
                  <Icon name="remove" size={16} />
                </button>
                <span className="tabular w-6 text-center font-label-md text-label-md font-bold">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Increase ${line.name}`}
                  onClick={() => cart.setQuantity(line.signature, line.quantity + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                  style={{ background: branding.primaryColor }}
                >
                  <Icon name="add" size={16} />
                </button>
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* ------------------------------------------------------- guest + notes */}
      <Card className="flex flex-col gap-space-md">
        <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Before you order</span>
        <Field label="Name for the order" hint="Helps staff call you when it's ready">
          <Input
            icon="person"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Your name"
          />
        </Field>
        <Field label="Allergy information" hint="Shown in red on the kitchen ticket">
          <Textarea
            rows={2}
            value={allergyNote}
            onChange={(e) => setAllergyNote(e.target.value)}
            placeholder="e.g. Severe peanut allergy"
          />
        </Field>
        <Field label="Kitchen note" hint="Preparation preferences">
          <Textarea
            rows={2}
            value={kitchenNote}
            onChange={(e) => setKitchenNote(e.target.value)}
            placeholder="e.g. Bring the mains together, please"
          />
        </Field>
      </Card>

      {/* ----------------------------------------------------------- totals */}
      <Card className="flex flex-col gap-space-xs">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Bill preview
        </span>
        <Row label="Subtotal" value={formatMoney(cart.subtotal, currency)} />
        <Row label={`Tax (${branding.taxPercent}%)`} value={formatMoney(tax, currency)} />
        {service > 0 && (
          <Row label={`Service charge (${branding.serviceChargePercent}%)`} value={formatMoney(service, currency)} />
        )}
        <div className="mt-space-xs flex items-center justify-between border-t border-slate-200 pt-space-sm">
          <span className="font-label-md text-label-md font-bold text-on-surface">Total payable</span>
          <span className="tabular font-headline-sm text-headline-sm font-bold text-on-surface">
            {formatMoney(total, currency)}
          </span>
        </div>
        <div className="flex items-center gap-space-xs pt-space-xs">
          <Badge tone="info" icon="verified">
            Prices in {currency}
          </Badge>
          {!branding.isOpen && (
            <Badge tone="critical" icon="block">
              Currently closed
            </Badge>
          )}
        </div>
      </Card>

      {!branding.isOpen && (
        <div className="flex items-start gap-space-sm rounded-xl bg-status-critical-bg p-space-md">
          <Icon name="info" size={17} className="mt-0.5 shrink-0 text-status-critical" />
          <span className="font-body-sm text-body-sm text-on-surface">
            {org.name} has paused ordering right now. You can still browse the menu — try again during
            service hours.
          </span>
        </div>
      )}

      {/* -------------------------------------------------------- sticky CTA */}
      <div className="pb-safe fixed bottom-0 left-1/2 z-30 w-full max-w-[560px] -translate-x-1/2 border-t border-slate-200 bg-surface-container-lowest/95 px-space-lg py-space-md backdrop-blur-xl">
        {!table && channel === 'dine_in' && (
          <p className="mb-space-xs text-center font-label-xs text-label-xs text-status-warning">
            No table detected — scan your table QR or switch to takeaway.
          </p>
        )}
        <Button
          block
          size="lg"
          icon="check_circle"
          loading={placing}
          disabled={!branding.isOpen}
          onClick={() => void placeOrder()}
        >
          Place order · {formatMoney(total, currency)}
        </Button>
        <p className="mt-space-xs text-center font-label-xs text-label-xs text-on-surface-variant">
          Payment is collected at the end of your meal in this prototype.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
      <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface">{value}</span>
    </div>
  )
}
