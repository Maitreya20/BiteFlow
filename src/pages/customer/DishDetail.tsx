import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, FoodThumb, Icon, Textarea, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { publicBase } from '@/lib/publicRoutes'
import { useAppStore } from '@/store/AppStore'
import { useCart } from '@/store/CartStore'
import { formatMoney } from '@/lib/format'
import type { MenuOption } from '@/lib/types'

export function DishDetail() {
  const { slug = '', itemId = '', tableNumber } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const cart = useCart()
  const { db } = useAppStore()

  const org = db.organizations.find((o) => o.slug === slug) ?? null
  const item = db.menuItems.find((m) => m.id === itemId) ?? null

  // Selection state: groupId → option ids
  const [selection, setSelection] = useState<Record<string, string[]>>(() => {
    if (!item) return {}
    const initial: Record<string, string[]> = {}
    item.optionGroups.forEach((group) => {
      if (group.type === 'single') {
        const def = group.options.find((o) => o.isDefault) ?? group.options[0]
        if (def) initial[group.id] = [def.id]
      } else {
        initial[group.id] = []
      }
    })
    return initial
  })
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const optionGroups = item?.optionGroups ?? []

  const { chosenOptions, optionsTotal, missingRequired } = useMemo(() => {
    if (!item) return { chosenOptions: [] as MenuOption[], optionsTotal: 0, missingRequired: [] as string[] }
    const chosen: MenuOption[] = []
    const missing: string[] = []

    optionGroups.forEach((group) => {
      const ids = selection[group.id] ?? []
      if (group.required && ids.length === 0) missing.push(group.name)
      group.options
        .filter((o) => ids.includes(o.id))
        .forEach((o) => chosen.push(o))
    })

    return {
      chosenOptions: chosen,
      optionsTotal: chosen.reduce((s, o) => s + o.priceDelta, 0),
      missingRequired: missing,
    }
  }, [item, optionGroups, selection])

  if (!org) return null
  if (!item) {
    return (
      <div className="px-space-lg py-space-xl">
        <EmptyState
          icon="no_meals"
          title="Dish not available"
          description="This item may have been removed from the menu."
          action={
            <Link to={`${publicBase(slug, tableNumber)}/menu`}>
              <Button icon="arrow_back">Back to menu</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const branding = org.branding
  const base = publicBase(slug, tableNumber)
  const unitTotal = item.price + optionsTotal
  const lineTotal = unitTotal * quantity

  const toggleOption = (groupId: string, optionId: string, type: 'single' | 'multi') => {
    setSelection((prev) => {
      const current = prev[groupId] ?? []
      if (type === 'single') return { ...prev, [groupId]: [optionId] }
      return {
        ...prev,
        [groupId]: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      }
    })
  }

  const addToCart = () => {
    if (missingRequired.length) {
      toast.error(`Choose ${missingRequired.join(', ')}`, 'Required options must be selected first.')
      return
    }
    cart.addLine({
      item,
      quantity,
      options: chosenOptions.map((o) => o.name),
      optionsTotal,
      notes,
    })
    toast.success(`${quantity}× ${item.name} added`, formatMoney(lineTotal, branding.currency))
    navigate(`${base}/menu`)
  }

  return (
    /* Bottom padding clears the fixed bottom nav (~64px) plus the sticky CTA bar. */
    <div className="flex flex-col pb-52">
      {/* ------------------------------------------------------- hero image */}
      <div
        className="relative flex h-56 items-center justify-center text-[84px]"
        style={{
          background: `linear-gradient(150deg, color-mix(in srgb, ${branding.primaryColor} 20%, #fff) 0%, color-mix(in srgb, ${branding.accentColor} 18%, #fff) 100%)`,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute left-space-md top-space-md flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-on-surface shadow-e1 backdrop-blur"
        >
          <Icon name="arrow_back" size={20} />
        </button>
        <FoodThumb name={item.name} size={140} rounded="rounded-3xl" className="shadow-e2" />
      </div>

      <div className="flex flex-col gap-space-lg px-space-lg py-space-lg">
        {/* ------------------------------------------------------- headline */}
        <div className="flex flex-col gap-space-xs">
          <div className="flex flex-wrap items-center gap-space-xs">
            {item.isChefPick && <Badge tone="brand" icon="military_tech">Chef&apos;s pick</Badge>}
            {item.isTrending && <Badge tone="info" icon="trending_up">Trending</Badge>}
            {item.isVegetarian && <Badge tone="success" icon="eco">Vegetarian</Badge>}
            {item.isSpicy && <Badge tone="critical" icon="local_fire_department">Spicy</Badge>}
          </div>
          <div className="flex items-start justify-between gap-space-md">
            <h1 className="font-headline-md text-headline-md font-extrabold text-on-surface">{item.name}</h1>
            <span className="tabular shrink-0 font-headline-md text-headline-md font-bold" style={{ color: branding.primaryColor }}>
              {formatMoney(item.price, branding.currency)}
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">{item.description}</p>
          <div className="flex flex-wrap items-center gap-space-md pt-space-2xs">
            <span className="flex items-center gap-space-xs font-label-xs text-label-xs text-on-surface-variant">
              <Icon name="timer" size={14} />
              {item.prepTimeMinutes} min prep
            </span>
            {item.calories > 0 && (
              <span className="flex items-center gap-space-xs font-label-xs text-label-xs text-on-surface-variant">
                <Icon name="local_fire_department" size={14} />
                {item.calories} kcal
              </span>
            )}
            {item.allergens.length > 0 && (
              <span className="flex items-center gap-space-xs font-label-xs text-label-xs text-on-surface-variant">
                <Icon name="warning" size={14} />
                Contains {item.allergens.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* --------------------------------------------------- option groups */}
        {optionGroups.map((group) => (
          <section key={group.id} className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-label-md text-label-md font-bold text-on-surface">{group.name}</h2>
              <Badge tone={group.required ? 'warning' : 'neutral'}>
                {group.required ? 'Required' : group.type === 'single' ? 'Choose one' : 'Optional'}
              </Badge>
            </div>
            <div className="flex flex-col gap-space-xs">
              {group.options.map((option) => {
                const active = (selection[group.id] ?? []).includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleOption(group.id, option.id, group.type)}
                    aria-pressed={active}
                    className={cn(
                      'flex items-center justify-between gap-space-md rounded-xl border-[1.5px] px-space-md py-space-md text-left transition-colors',
                      active ? 'bg-ember-50' : 'border-slate-200 bg-white hover:bg-surface-container-low',
                    )}
                    style={active ? { borderColor: branding.primaryColor } : undefined}
                  >
                    <span className="flex items-center gap-space-md">
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center border-[1.5px]',
                          group.type === 'single' ? 'rounded-full' : 'rounded-[5px]',
                          active ? 'text-white' : 'border-slate-300 bg-white',
                        )}
                        style={active ? { background: branding.primaryColor, borderColor: branding.primaryColor } : undefined}
                      >
                        {active && <Icon name="check" size={13} />}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface">{option.name}</span>
                    </span>
                    <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface-variant">
                      {option.priceDelta === 0
                        ? 'Included'
                        : `${option.priceDelta > 0 ? '+' : ''}${formatMoney(option.priceDelta, branding.currency)}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        {/* ------------------------------------------------------ instructions */}
        <section className="flex flex-col gap-space-sm">
          <h2 className="font-label-md text-label-md font-bold text-on-surface">
            Special instructions
          </h2>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies, preferences or anything the kitchen should know"
          />
        </section>

        {/* -------------------------------------------------------- quantity */}
        <Card className="flex items-center justify-between">
          <span className="font-label-md text-label-md font-semibold text-on-surface">Quantity</span>
          <span className="flex items-center gap-space-md">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 hover:bg-surface-container-low"
            >
              <Icon name="remove" size={18} />
            </button>
            <span className="tabular w-8 text-center font-headline-sm text-headline-sm font-bold">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white"
              style={{ background: branding.primaryColor }}
            >
              <Icon name="add" size={18} />
            </button>
          </span>
        </Card>

        {/* --------------------------------------------------------- summary */}
        <div className="flex flex-col gap-space-xs rounded-2xl bg-surface-container-low p-space-md">
          <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Item summary
          </span>
          <span className="flex justify-between font-body-sm text-body-sm">
            <span className="text-on-surface-variant">
              {item.name} × {quantity}
            </span>
            <span className="tabular text-on-surface">{formatMoney(item.price * quantity, branding.currency)}</span>
          </span>
          {chosenOptions.map((o) => (
            <span key={o.id} className="flex justify-between font-body-sm text-body-sm">
              <span className="text-on-surface-variant">{o.name}</span>
              <span className="tabular text-on-surface">
                {o.priceDelta === 0 ? '—' : formatMoney(o.priceDelta * quantity, branding.currency)}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------ sticky CTA */}
      {/* Sits above the fixed bottom nav — at bottom-0 the nav (z-40) overlays this
          bar (z-30) and steals every tap on the button. */}
      <div className="pb-safe fixed bottom-[68px] left-1/2 z-30 w-full max-w-[560px] -translate-x-1/2 rounded-t-2xl border-t border-slate-200 bg-surface-container-lowest/95 px-space-lg py-space-md shadow-e2 backdrop-blur-xl">
        <div className="mb-space-sm flex items-center justify-between">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {cart.count > 0 ? `${cart.count} already in your order` : 'Nothing in your order yet'}
          </span>
          <span className="tabular font-headline-sm text-headline-sm font-bold text-on-surface">
            {formatMoney(lineTotal, branding.currency)}
          </span>
        </div>
        <Button
          block
          size="lg"
          icon="add_shopping_cart"
          onClick={addToCart}
        >
          Add to cart · {formatMoney(lineTotal, branding.currency)}
        </Button>
        {missingRequired.length > 0 && (
          <p className="mt-space-xs text-center font-label-xs text-label-xs text-status-critical">
            Choose {missingRequired.join(', ')} to continue
          </p>
        )}
      </div>
    </div>
  )
}
