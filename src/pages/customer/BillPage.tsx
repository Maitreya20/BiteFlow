import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Icon, Modal, RadioGroup, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { publicBase } from '@/lib/publicRoutes'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { getGuestOrders } from '@/lib/customerSession'
import { formatMoney, formatTime } from '@/lib/format'
import type { Order } from '@/lib/types'

type PayMethod = 'upi' | 'card' | 'cash' | 'wallet'
type Stage = 'method' | 'processing' | 'success' | 'failure'

const METHODS: { value: PayMethod; label: string; description: string; icon: string }[] = [
  { value: 'upi', label: 'UPI', description: 'Pay by any UPI app — instant confirmation', icon: 'qr_code_2' },
  { value: 'card', label: 'Card', description: 'Credit or debit card at the table', icon: 'credit_card' },
  { value: 'cash', label: 'Cash', description: 'Settle with your server in cash', icon: 'payments' },
  { value: 'wallet', label: 'Wallet', description: 'Restaurant wallet balance', icon: 'account_balance_wallet' },
]

export function BillPage() {
  const { slug = '', tableNumber } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { db } = useAppStore()

  const [payOpen, setPayOpen] = useState(false)
  const [method, setMethod] = useState<PayMethod>('upi')
  const [stage, setStage] = useState<Stage>('method')

  const org = db.organizations.find((o) => o.slug === slug) ?? null
  const base = publicBase(slug, tableNumber)

  const bill = useMemo<Order | null>(() => {
    if (!org) return null
    const refs = getGuestOrders(org.id)
    const orders = refs
      .map((ref) => db.orders.find((o) => o.id === ref.orderId))
      .filter((o): o is Order => Boolean(o))
    // Prefer the newest unpaid order; otherwise show the most recent one.
    return (
      orders.find((o) => o.paymentStatus === 'unpaid' && o.status !== 'cancelled') ?? orders[0] ?? null
    )
  }, [db.orders, org])

  if (!org) return null

  const branding = org.branding
  const currency = branding.currency

  if (!bill) {
    return (
      <div className="px-space-lg py-space-xl">
        <EmptyState
          icon="request_quote"
          title="No bill to show"
          description="Place an order from your table and the bill will appear here."
          action={
            <Link to={`${base}/menu`}>
              <Button icon="restaurant_menu">Browse the menu</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const isPaid = bill.paymentStatus === 'paid'
  const settled = isPaid || bill.status === 'completed'

  const startPayment = async () => {
    setStage('processing')
    await new Promise((r) => setTimeout(r, 1100))
    try {
      await api.payOrder(bill.id, method)
      setStage('success')
      toast.success('Payment successful', `${bill.orderNumber} settled.`)
    } catch {
      setStage('failure')
    }
  }

  return (
    <div className="flex flex-col gap-space-lg px-space-lg py-space-lg">
      {/* ------------------------------------------------------ bill header */}
      <Card className="flex flex-col gap-space-sm">
        <div className="flex items-start justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-[22px]"
              style={{ background: `color-mix(in srgb, ${branding.primaryColor} 14%, white)` }}
            >
              {branding.logoEmoji}
            </span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-bold text-on-surface">{org.name}</span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">
                {branding.address || branding.tagline}
              </span>
            </div>
          </div>
          <Badge tone={settled ? 'success' : 'warning'} dot>
            {settled ? 'Settled' : 'Payment due'}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-space-sm border-t border-slate-200 pt-space-sm">
          {[
            { label: 'Bill no.', value: bill.orderNumber },
            { label: 'Table', value: bill.tableNumber ?? 'Takeaway' },
            { label: 'Time', value: formatTime(bill.placedAt) },
          ].map((cell) => (
            <div key={cell.label} className="flex flex-col">
              <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                {cell.label}
              </span>
              <span className="font-label-sm text-label-sm font-semibold text-on-surface">{cell.value}</span>
            </div>
          ))}
        </div>
        {org.gstNumber && (
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            GSTIN {org.gstNumber}
          </span>
        )}
      </Card>

      {/* ----------------------------------------------------------- items */}
      <Card className="flex flex-col gap-space-sm">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Items
        </span>
        {bill.items.map((line) => (
          <div key={line.id} className="flex items-start justify-between gap-space-md">
            <div className="flex min-w-0 flex-col">
              <span className="font-body-sm text-body-sm text-on-surface">
                {line.quantity}× {line.name}
              </span>
              {line.options.length > 0 && (
                <span className="font-label-xs text-label-xs text-on-surface-variant">
                  {line.options.join(' · ')}
                </span>
              )}
            </div>
            <span className="tabular shrink-0 font-label-sm text-label-sm font-semibold text-on-surface">
              {formatMoney(line.lineTotal, currency)}
            </span>
          </div>
        ))}
      </Card>

      {/* ---------------------------------------------------------- totals */}
      <Card className="flex flex-col gap-space-xs">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Bill summary
        </span>
        <Row label="Subtotal" value={formatMoney(bill.subtotal, currency)} />
        <Row label={`Tax (${branding.taxPercent}%)`} value={formatMoney(bill.taxAmount, currency)} />
        {bill.serviceCharge > 0 && (
          <Row
            label={`Service charge (${branding.serviceChargePercent}%)`}
            value={formatMoney(bill.serviceCharge, currency)}
          />
        )}
        {bill.discount > 0 && (
          <Row label="Discount" value={`−${formatMoney(bill.discount, currency)}`} tone="success" />
        )}
        <div className="mt-space-xs flex items-center justify-between border-t border-slate-200 pt-space-sm">
          <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Total</span>
          <span className="tabular font-headline-md text-headline-md font-bold text-on-surface">
            {formatMoney(bill.total, currency)}
          </span>
        </div>
      </Card>

      {/* -------------------------------------------------------- payment */}
      {settled ? (
        <Card className="flex flex-col items-center gap-space-sm border-status-success/30 bg-status-success-bg py-space-lg text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-status-success">
            <Icon name="check_circle" size={26} />
          </span>
          <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
            This bill is settled
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Paid via {bill.paymentMethod ?? 'cash'} · reference {bill.orderNumber}
          </span>
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={() => toast.info('Receipt PDF is not generated in the prototype')}
          >
            Download receipt
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-space-sm">
          <Button block size="lg" icon="payments" onClick={() => setPayOpen(true)}>
            Pay bill · {formatMoney(bill.total, currency)}
          </Button>
          <p className="text-center font-label-xs text-label-xs text-on-surface-variant">
            Payment is processed by a provider-agnostic gateway. Razorpay or Stripe drop in behind this
            same flow.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-space-sm">
        <Button variant="secondary" icon="support_agent" onClick={() => toast.info('Use the help button to call a server')}>
          Ask a question
        </Button>
        <Button variant="ghost" icon="add" onClick={() => navigate(`${base}/menu`)}>
          Order more
        </Button>
      </div>

      {/* --------------------------------------------------- payment modal */}
      <Modal
        open={payOpen}
        onClose={() => {
          if (stage === 'processing') return
          setPayOpen(false)
          setStage('method')
        }}
        title={
          stage === 'success'
            ? 'Payment successful'
            : stage === 'failure'
              ? 'Payment failed'
              : 'Choose a payment method'
        }
        description={
          stage === 'method'
            ? `${bill.orderNumber} · ${formatMoney(bill.total, currency)}`
            : undefined
        }
        icon={stage === 'success' ? 'check_circle' : stage === 'failure' ? 'error' : 'payments'}
        size="sm"
        footer={
          stage === 'method' ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setPayOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" icon="lock" onClick={() => void startPayment()}>
                Pay {formatMoney(bill.total, currency)}
              </Button>
            </>
          ) : stage === 'success' ? (
            <Button
              size="sm"
              icon="done_all"
              onClick={() => {
                setPayOpen(false)
                setStage('method')
              }}
            >
              Done
            </Button>
          ) : stage === 'failure' ? (
            <Button size="sm" variant="secondary" icon="refresh" onClick={() => setStage('method')}>
              Try another method
            </Button>
          ) : undefined
        }
      >
        {stage === 'method' && (
          <RadioGroup
            name="payment-method"
            value={method}
            onChange={setMethod}
            options={METHODS.map((m) => ({
              value: m.value,
              label: m.label,
              description: m.description,
            }))}
          />
        )}

        {stage === 'processing' && (
          <div className="flex flex-col items-center gap-space-md py-space-xl">
            <span
              className="h-12 w-12 animate-spin rounded-full border-[3px] border-t-transparent"
              style={{ borderColor: branding.primaryColor, borderTopColor: 'transparent' }}
            />
            <span className="font-label-md text-label-md font-medium text-on-surface">
              Contacting the payment gateway…
            </span>
            <span className="font-label-xs text-label-xs text-on-surface-variant">
              Do not close this screen
            </span>
          </div>
        )}

        {stage === 'success' && (
          <div className="flex flex-col items-center gap-space-sm py-space-lg text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-status-success-bg text-status-success">
              <Icon name="check_circle" size={34} />
            </span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
              {formatMoney(bill.total, currency)} paid
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {bill.orderNumber} · {METHODS.find((m) => m.value === method)?.label}
            </span>
            <span className="font-label-xs text-label-xs text-on-surface-variant">
              A receipt has been emailed to the address on this device.
            </span>
            <div
              className={cn('mt-space-xs rounded-xl p-space-md text-left')}
              style={{ background: `color-mix(in srgb, ${branding.primaryColor} 8%, white)` }}
            >
              <span className="font-label-xs text-label-xs text-on-surface-variant">Reference</span>
              <p className="font-label-sm text-label-sm font-bold text-on-surface">
                {bill.orderNumber}-{method.toUpperCase()}
              </p>
            </div>
          </div>
        )}

        {stage === 'failure' && (
          <div className="flex flex-col items-center gap-space-sm py-space-lg text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-status-critical-bg text-status-critical">
              <Icon name="error" size={34} />
            </span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
              That method didn't go through
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Nothing has been charged. Try another method or ask your server for help.
            </span>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
      <span
        className={cn(
          'tabular font-label-sm text-label-sm font-semibold',
          tone === 'success' ? 'text-status-success' : 'text-on-surface',
        )}
      >
        {value}
      </span>
    </div>
  )
}
