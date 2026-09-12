import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, EmptyState, Icon, SearchInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import { DishRow } from './CustomerHome'
import { formatMoney } from '@/lib/format'

type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'fastest'

export function CustomerMenu() {
  const { slug = '' } = useParams()
  const { db } = useAppStore()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [filters, setFilters] = useState<{ veg: boolean; spicy: boolean; fast: boolean }>({
    veg: false,
    spicy: false,
    fast: false,
  })
  const [sort, setSort] = useState<SortKey>('recommended')

  const org = db.organizations.find((o) => o.slug === slug) ?? null
  const base = `/r/${slug}`

  const categories = useMemo(
    () =>
      db.categories
        .filter((c) => c.organizationId === org?.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [db.categories, org?.id],
  )

  const menu = useMemo(
    () => db.menuItems.filter((m) => m.organizationId === org?.id && m.available),
    [db.menuItems, org?.id],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = menu.filter((item) => {
      if (activeCategory !== 'all' && item.categoryId !== activeCategory) return false
      if (filters.veg && !item.isVegetarian) return false
      if (filters.spicy && !item.isSpicy) return false
      if (filters.fast && item.prepTimeMinutes > 10) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.join(' ').toLowerCase().includes(q)
      )
    })

    switch (sort) {
      case 'price_asc':
        return [...list].sort((a, b) => a.price - b.price)
      case 'price_desc':
        return [...list].sort((a, b) => b.price - a.price)
      case 'fastest':
        return [...list].sort((a, b) => a.prepTimeMinutes - b.prepTimeMinutes)
      default:
        return list
    }
  }, [menu, activeCategory, filters, query, sort])

  if (!org) return null

  const branding = org.branding
  const grouped =
    activeCategory === 'all' && sort === 'recommended' && !query
      ? categories.map((cat) => ({
          category: cat,
          items: filtered.filter((i) => i.categoryId === cat.id),
        }))
      : null

  return (
    <div className="flex flex-col">
      {/* sticky controls */}
      <div className="sticky top-[73px] z-20 flex flex-col gap-space-sm border-b border-slate-200/70 bg-background/95 px-space-lg py-space-md backdrop-blur-xl">
        <SearchInput value={query} onChange={setQuery} placeholder="Search the menu" />

        <div className="no-scrollbar -mx-space-lg flex gap-space-xs overflow-x-auto px-space-lg">
          <Chip
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
            primary={branding.primaryColor}
          >
            All ({menu.length})
          </Chip>
          {categories.map((cat) => {
            const count = menu.filter((m) => m.categoryId === cat.id).length
            if (!count) return null
            return (
              <Chip
                key={cat.id}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                primary={branding.primaryColor}
                icon={cat.icon}
              >
                {cat.name} ({count})
              </Chip>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-space-xs">
          <Chip active={filters.veg} onClick={() => setFilters((f) => ({ ...f, veg: !f.veg }))} primary={branding.primaryColor} icon="eco">
            Veg
          </Chip>
          <Chip active={filters.spicy} onClick={() => setFilters((f) => ({ ...f, spicy: !f.spicy }))} primary={branding.primaryColor} icon="local_fire_department">
            Spicy
          </Chip>
          <Chip active={filters.fast} onClick={() => setFilters((f) => ({ ...f, fast: !f.fast }))} primary={branding.primaryColor} icon="bolt">
            Ready fast
          </Chip>
          <label className="ml-auto flex items-center gap-space-xs font-label-xs text-label-xs text-on-surface-variant">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort menu"
              className="rounded-lg border border-slate-200 bg-white px-space-sm py-1 font-label-xs text-label-xs text-on-surface"
            >
              <option value="recommended">Recommended</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="fastest">Quickest to prepare</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-space-lg px-space-lg py-space-lg">
        {filtered.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="No dishes match those filters"
            description="Try clearing the search box or turning off a filter."
          />
        ) : grouped ? (
          grouped
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <section key={group.category.id} className="flex flex-col gap-space-md">
                <div className="flex items-center gap-space-sm">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: `color-mix(in srgb, ${branding.primaryColor} 12%, white)`,
                      color: branding.primaryColor,
                    }}
                  >
                    <Icon name={group.category.icon} size={17} />
                  </span>
                  <div className="flex flex-col">
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      {group.category.name}
                    </h2>
                    {group.category.description && (
                      <span className="font-label-xs text-label-xs text-on-surface-variant">
                        {group.category.description}
                      </span>
                    )}
                  </div>
                  <Badge tone="neutral" className="ml-auto">
                    {group.items.length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-space-md">
                  {group.items.map((item) => (
                    <DishRow key={item.id} item={item} base={base} branding={branding} />
                  ))}
                </div>
              </section>
            ))
        ) : (
          <div className="flex flex-col gap-space-md">
            <span className="font-label-xs text-label-xs text-on-surface-variant">
              {filtered.length} dish{filtered.length === 1 ? '' : 'es'} · {formatMoney(
                Math.min(...filtered.map((f) => f.price)),
                branding.currency,
                { compact: true },
              )}{' '}
              and up
            </span>
            {filtered.map((item) => (
              <DishRow key={item.id} item={item} base={base} branding={branding} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
  primary,
  icon,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  primary: string
  icon?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-space-md py-1 font-label-xs text-label-xs font-semibold transition-colors',
        !active && 'border-slate-200 bg-white text-on-surface-variant hover:bg-surface-container-low',
      )}
      style={
        active
          ? { background: primary, borderColor: primary, color: '#fff' }
          : undefined
      }
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  )
}
