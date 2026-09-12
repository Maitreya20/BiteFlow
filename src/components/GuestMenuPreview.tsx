/**
 * Live guest-menu preview — design.md §19 requires the branding editor to show a
 * preview that "should resemble actual mobile restaurant menu".
 * Renders a device frame using only the draft branding values, so editors see the
 * change before saving.
 */
import { cn } from '@/lib/cn'
import { Icon } from '@/components/ui'
import { foodEmoji, foodTileStyle, formatMoney } from '@/lib/format'
import type { Branding, MenuCategory, MenuItem } from '@/lib/types'

const RADIUS: Record<Branding['radiusScale'], { card: string; button: string; chip: string }> = {
  sharp: { card: 'rounded-sm', button: 'rounded-sm', chip: 'rounded-sm' },
  soft: { card: 'rounded-xl', button: 'rounded-lg', chip: 'rounded-md' },
  round: { card: 'rounded-2xl', button: 'rounded-full', chip: 'rounded-full' },
}

const FONT_STACK: Record<Branding['fontFamily'], string> = {
  Manrope: "'Manrope', system-ui, sans-serif",
  Inter: "'Inter', system-ui, sans-serif",
  Sora: "'Manrope', system-ui, sans-serif",
  'DM Sans': "'Inter', system-ui, sans-serif",
  'Playfair Display': "'Manrope', system-ui, sans-serif",
}

interface PreviewItem {
  name: string
  price: number
  description: string
  tags?: string[]
  featured?: boolean
}

export function GuestMenuPreview({
  branding,
  categories,
  items,
  restaurantName,
  tableNumber = 'T-04',
  device = true,
  className,
}: {
  branding: Branding
  categories?: MenuCategory[]
  items?: MenuItem[]
  restaurantName: string
  tableNumber?: string | null
  device?: boolean
  className?: string
}) {
  const radius = RADIUS[branding.radiusScale] ?? RADIUS.soft
  const font = FONT_STACK[branding.fontFamily] ?? FONT_STACK.Manrope

  // Fall back to representative sample dishes when the tenant has no menu yet.
  const previewItems: PreviewItem[] =
    items && items.length
      ? items.slice(0, 3).map((m) => ({
          name: m.name,
          price: m.price,
          description: m.description,
          tags: m.isChefPick ? ['Chef pick'] : m.isTrending ? ['Trending'] : [],
          featured: m.isChefPick || m.isTrending,
        }))
      : [
          { name: 'Truffle Mushroom Risotto', price: 580, description: 'Wild mushrooms, aged parmesan, shaved truffle.', tags: ['Chef pick'], featured: true },
          { name: 'Woodfired Margherita', price: 490, description: 'San Marzano, buffalo mozzarella, basil.', tags: ['Vegetarian'] },
          { name: 'Cold Brew Hazelnut', price: 220, description: '18-hour steep, oat milk, clear ice.', tags: ['Trending'] },
        ]

  const previewCategories =
    categories && categories.length
      ? categories.map((c) => c.name)
      : ['Signature Coffee', 'All-Day Brunch', 'Bowls', 'Sweet Finish']

  const buttonStyle =
    branding.buttonStyle === 'outline'
      ? { background: 'transparent', color: branding.primaryColor, border: `1.5px solid ${branding.primaryColor}` }
      : branding.buttonStyle === 'pill'
        ? { background: branding.primaryColor, color: '#fff', borderRadius: 9999 }
        : { background: branding.primaryColor, color: '#fff' }

  const cardStyle =
    branding.cardStyle === 'flat'
      ? { background: `color-mix(in srgb, ${branding.primaryColor} 6%, #fff)`, border: 'none' }
      : branding.cardStyle === 'bordered'
        ? { background: '#fff', border: `1.5px solid color-mix(in srgb, ${branding.primaryColor} 24%, #E2E8F0)` }
        : { background: '#fff', border: '1px solid rgba(15,23,42,0.06)', boxShadow: 'var(--shadow-e1)' }

  const content = (
    <div className="flex flex-col bg-white" style={{ fontFamily: font }}>
      {/* Restaurant header */}
      <div
        className="relative flex flex-col gap-space-2xs px-space-lg pb-space-lg pt-space-xl"
        style={{
          background: `linear-gradient(160deg, color-mix(in srgb, ${branding.primaryColor} 16%, #fff) 0%, #fff 100%)`,
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="flex h-11 w-11 items-center justify-center text-[22px]"
            style={{ background: branding.primaryColor, borderRadius: radius.card === 'rounded-sm' ? 6 : 14 }}
          >
            {branding.logoEmoji}
          </span>
          {tableNumber && (
            <span
              className={cn('px-space-sm py-0.5 font-label-xs text-label-xs font-bold', radius.chip)}
              style={{ background: branding.primaryColor, color: '#fff' }}
            >
              {tableNumber}
            </span>
          )}
        </div>
        <h3 className="mt-space-sm font-headline-md text-headline-md font-extrabold text-slate-900">
          {branding.heroHeadline || restaurantName}
        </h3>
        <p className="font-body-sm text-body-sm text-slate-500">
          {branding.heroSubcopy || branding.tagline || 'Welcome to our menu'}
        </p>
        <div className="mt-space-xs flex items-center gap-space-sm">
          <span className="inline-flex items-center gap-0.5 font-label-xs text-label-xs font-semibold text-slate-600">
            <Icon name="star" size={12} filled className="text-amber-500" />
            {branding.rating.toFixed(1)}
          </span>
          <span className="font-label-xs text-label-xs font-semibold" style={{ color: branding.primaryColor }}>
            {branding.isOpen ? 'Open now' : 'Closed'}
          </span>
        </div>
      </div>

      {/* Search + chips */}
      <div className="flex flex-col gap-space-md px-space-lg py-space-md">
        <div className={cn('flex items-center gap-space-sm border border-slate-200 px-space-md py-space-sm', radius.button)}>
          <Icon name="search" size={16} className="text-slate-400" />
          <span className="font-body-sm text-body-sm text-slate-400">Search the menu…</span>
        </div>
        <div className="no-scrollbar flex gap-space-xs overflow-x-auto">
          {previewCategories.slice(0, 4).map((c, i) => (
            <span
              key={c}
              className={cn('shrink-0 px-space-md py-1 font-label-xs text-label-xs font-semibold', radius.chip)}
              style={
                i === 0
                  ? { background: branding.primaryColor, color: '#fff' }
                  : { background: `color-mix(in srgb, ${branding.primaryColor} 10%, #fff)`, color: branding.primaryColor }
              }
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Menu rows */}
      <div className="flex flex-col gap-space-md px-space-lg pb-space-lg">
        {previewItems.map((item) => (
          <div
            key={item.name}
            className={cn('flex gap-space-md p-space-md', radius.card)}
            style={cardStyle}
          >
            <span
              className={cn('flex h-16 w-16 shrink-0 items-center justify-center text-[26px]', radius.card)}
              style={foodTileStyle(item.name)}
            >
              {foodEmoji(item.name)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-start justify-between gap-space-sm">
                <span className="font-label-md text-label-md font-bold text-slate-900">{item.name}</span>
                <span className="tabular shrink-0 font-label-md text-label-md font-bold" style={{ color: branding.primaryColor }}>
                  {formatMoney(item.price, branding.currency)}
                </span>
              </div>
              <span className="line-clamp-2 font-body-sm text-body-sm text-slate-500">
                {item.description}
              </span>
              <div className="mt-auto flex items-center gap-space-xs pt-space-2xs">
                {item.tags?.map((t) => (
                  <span
                    key={t}
                    className={cn('px-space-xs py-0.5 font-label-xs text-label-xs font-semibold', radius.chip)}
                    style={{ background: `color-mix(in srgb, ${branding.primaryColor} 12%, #fff)`, color: branding.primaryColor }}
                  >
                    {t}
                  </span>
                ))}
                <button
                  type="button"
                  className={cn('ml-auto px-space-md py-1 font-label-xs text-label-xs font-bold', radius.button)}
                  style={buttonStyle}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Floating cart */}
      <div className="px-space-lg pb-space-lg">
        <div
          className={cn('flex items-center justify-between px-space-lg py-space-md', radius.card)}
          style={{ background: branding.primaryColor, color: '#fff' }}
        >
          <span className="flex items-center gap-space-sm">
            <Icon name="shopping_bag" size={18} />
            <span className="font-label-sm text-label-sm font-bold">3 items</span>
          </span>
          <span className="tabular font-label-md text-label-md font-bold">
            {formatMoney(1290, branding.currency)}
          </span>
        </div>
      </div>
    </div>
  )

  if (!device) return <div className={className}>{content}</div>

  return (
    <div className={cn('mx-auto w-full max-w-[340px]', className)}>
      <div className="rounded-[38px] border-[10px] border-slate-900 bg-slate-900 shadow-e3">
        <div className="overflow-hidden rounded-[28px] bg-white">
          <div className="flex items-center justify-center bg-white py-1.5">
            <span className="h-1.5 w-16 rounded-full bg-slate-900/15" />
          </div>
          <div className="scroll-slim max-h-[620px] overflow-y-auto">{content}</div>
        </div>
      </div>
      <p className="mt-space-sm text-center font-label-xs text-label-xs text-on-surface-variant">
        Live guest preview · {branding.fontFamily} · {branding.radiusScale} corners
      </p>
    </div>
  )
}
