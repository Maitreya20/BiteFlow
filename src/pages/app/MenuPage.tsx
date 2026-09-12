import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  FoodThumb,
  Icon,
  Input,
  Modal,
  SearchInput,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  Toolbar,
  useToast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore, usePlanUsage } from '@/store/AppStore'
import * as api from '@/data/api'
import { formatMoney, uid } from '@/lib/format'
import type { MenuCategory, MenuItem, MenuOptionGroup } from '@/lib/types'

const EMPTY_ITEM = (organizationId: string, categoryId: string, sortOrder: number): MenuItem => ({
  id: uid('item'),
  organizationId,
  categoryId,
  name: '',
  description: '',
  price: 0,
  imageUrl: null,
  prepTimeMinutes: 12,
  calories: 0,
  available: true,
  isChefPick: false,
  isTrending: false,
  isVegetarian: false,
  isSpicy: false,
  allergens: [],
  tags: [],
  optionGroups: [],
  sortOrder,
})

const ALLERGENS = ['Gluten', 'Dairy', 'Egg', 'Nuts', 'Soy', 'Fish', 'Shellfish', 'Sesame']

export function MenuPage() {
  const { menuItems, categories, organization } = useAppStore()
  const { plan, usage } = usePlanUsage()
  const toast = useToast()

  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', description: '', icon: 'restaurant_menu' })
  const [saving, setSaving] = useState(false)

  const currency = organization?.branding.currency ?? 'INR'
  const atLimit = usage.maxMenuItems >= plan.limits.maxMenuItems

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return menuItems.filter((item) => {
      if (activeCategory !== 'all' && item.categoryId !== activeCategory) return false
      if (!q) return true
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    })
  }, [menuItems, activeCategory, query])

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised'

  const saveItem = async (item: MenuItem) => {
    if (!item.name.trim()) {
      toast.error('A dish needs a name')
      return
    }
    if (!item.categoryId) {
      toast.error('Pick a category first')
      return
    }
    setSaving(true)
    await api.upsertMenuItem(item)
    setSaving(false)
    setEditing(null)
    toast.success('Menu updated', `${item.name} saved.`)
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Menu</h1>
            <Badge tone={atLimit ? 'critical' : 'neutral'}>
              {usage.maxMenuItems} / {plan.limits.maxMenuItems} items
            </Badge>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {categories.length} categories · {menuItems.filter((i) => !i.available).length} hidden from guests
          </p>
        </div>
        <Toolbar>
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: 'Grid', icon: 'grid_view' },
              { value: 'list', label: 'List', icon: 'list' },
            ]}
          />
          <Button variant="secondary" icon="category" onClick={() => setCategoryOpen(true)}>
            Add Category
          </Button>
          <Button
            icon="add"
            disabled={atLimit}
            onClick={() =>
              setEditing(EMPTY_ITEM(organization!.id, activeCategory !== 'all' ? activeCategory : categories[0]?.id ?? '', menuItems.length))
            }
          >
            Add Item
          </Button>
        </Toolbar>
      </header>

      {atLimit && (
        <Card className="flex flex-wrap items-center justify-between gap-space-md border-status-critical/25 bg-status-critical-bg">
          <div className="flex items-center gap-space-md">
            <Icon name="lock" size={20} className="text-status-critical" />
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                You've reached your menu item limit
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                The {plan.name} plan allows {plan.limits.maxMenuItems} items.
              </span>
            </div>
          </div>
          <Button size="sm" iconRight="arrow_forward" onClick={() => (window.location.href = '/app/billing')}>
            View upgrade options
          </Button>
        </Card>
      )}

      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:items-start">
        {/* ------------------------------------------------- category sidebar */}
        <Card padded={false} className="flex flex-col overflow-hidden">
          <div className="border-b border-slate-200 px-space-md py-space-sm">
            <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Categories
            </span>
          </div>
          <div className="flex flex-col p-space-xs">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={cn(
                'flex items-center justify-between rounded-lg px-space-md py-space-sm text-left transition-colors',
                activeCategory === 'all' ? 'bg-primary-container text-on-primary-container font-bold' : 'hover:bg-surface-container-low',
              )}
            >
              <span className="flex items-center gap-space-sm font-body-sm text-body-sm">
                <Icon name="apps" size={17} />
                All items
              </span>
              <span className="font-label-xs text-label-xs">{menuItems.length}</span>
            </button>
            {categories.map((cat) => {
              const count = menuItems.filter((m) => m.categoryId === cat.id).length
              return (
                <div key={cat.id} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'flex flex-1 items-center justify-between rounded-lg px-space-md py-space-sm text-left transition-colors',
                      activeCategory === cat.id ? 'bg-primary-container text-on-primary-container font-bold' : 'hover:bg-surface-container-low',
                    )}
                  >
                    <span className="flex items-center gap-space-sm font-body-sm text-body-sm">
                      <Icon name={cat.icon} size={17} />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="font-label-xs text-label-xs">{count}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${cat.name}`}
                    onClick={async () => {
                      await api.deleteCategory(cat.organizationId, cat.id)
                      if (activeCategory === cat.id) setActiveCategory('all')
                      toast.success(`${cat.name} removed`)
                    }}
                    className="ml-0.5 hidden h-7 w-7 items-center justify-center rounded-md text-on-surface-variant hover:text-status-critical group-hover:flex"
                  >
                    <Icon name="delete" size={15} />
                  </button>
                </div>
              )
            })}
            {!categories.length && (
              <p className="px-space-md py-space-md font-body-sm text-body-sm text-on-surface-variant">
                No categories yet.
              </p>
            )}
          </div>
        </Card>

        {/* -------------------------------------------------------- item list */}
        <div className="flex flex-col gap-space-md">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search dishes, descriptions or tags"
            className="w-full sm:max-w-md"
          />

          {filtered.length === 0 ? (
            <EmptyState
              icon="restaurant_menu"
              title={query ? `No dishes match “${query}”` : 'No menu items yet'}
              description={
                query
                  ? 'Try a different name, or clear the search.'
                  : 'Add your first menu item to start accepting orders.'
              }
              action={
                <Button
                  icon="add"
                  onClick={() =>
                    setEditing(
                      EMPTY_ITEM(
                        organization!.id,
                        activeCategory !== 'all' ? activeCategory : categories[0]?.id ?? '',
                        menuItems.length,
                      ),
                    )
                  }
                >
                  Add menu item
                </Button>
              }
            />
          ) : view === 'grid' ? (
            <div className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <Card key={item.id} className="flex flex-col gap-space-sm" interactive>
                  <div className="flex items-start justify-between gap-space-sm">
                    <FoodThumb name={item.name} imageUrl={item.imageUrl} size={56} />
                    <div className="flex flex-wrap justify-end gap-1">
                      {!item.available && <Badge tone="critical">Hidden</Badge>}
                      {item.isChefPick && <Badge tone="brand">Chef pick</Badge>}
                      {item.isTrending && <Badge tone="info">Trending</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-space-sm">
                      <h3 className="font-label-md text-label-md font-semibold text-on-surface">
                        {item.name}
                      </h3>
                      <span className="tabular shrink-0 font-label-md text-label-md font-bold text-on-surface">
                        {formatMoney(item.price, currency)}
                      </span>
                    </div>
                    <span className="font-label-xs text-label-xs text-on-surface-variant">
                      {categoryName(item.categoryId)}
                    </span>
                    <p className="line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">
                      {item.description || 'No description yet'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-space-xs">
                    {item.isVegetarian && <Badge tone="success" icon="eco">Veg</Badge>}
                    {item.isSpicy && <Badge tone="critical" icon="local_fire_department">Spicy</Badge>}
                    <span className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant">
                      <Icon name="timer" size={13} />
                      {item.prepTimeMinutes}m
                    </span>
                    {item.calories > 0 && (
                      <span className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant">
                        <Icon name="local_fire_department" size={13} />
                        {item.calories} kcal
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center gap-space-xs border-t border-slate-100 pt-space-sm">
                    <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(item)}>
                      Edit
                    </Button>
                    <Switch
                      checked={item.available}
                      onChange={async (v) => {
                        await api.upsertMenuItem({ ...item, available: v })
                        toast.success(v ? `${item.name} is live` : `${item.name} hidden from guests`)
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="delete"
                      className="ml-auto text-status-critical"
                      onClick={() => setDeleteTarget(item)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <div className="divide-y divide-slate-200">
                {filtered.map((item) => (
                  <div key={item.id} className="flex items-center gap-space-md px-space-lg py-space-md">
                    <FoodThumb name={item.name} size={44} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-space-sm">
                        <span className="truncate font-label-md text-label-md font-semibold text-on-surface">
                          {item.name}
                        </span>
                        {!item.available && <Badge tone="critical">Hidden</Badge>}
                        {item.isChefPick && <Badge tone="brand">Chef pick</Badge>}
                      </span>
                      <span className="truncate font-body-sm text-body-sm text-on-surface-variant">
                        {categoryName(item.categoryId)} · {item.description || 'No description'}
                      </span>
                    </div>
                    <span className="tabular font-label-md text-label-md font-bold text-on-surface">
                      {formatMoney(item.price, currency)}
                    </span>
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(item)}>
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------ item editor */}
      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.name ? `Edit ${editing.name}` : 'New menu item'}
        subtitle="Guests see exactly what you save here"
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button icon="save" loading={saving} onClick={() => editing && void saveItem(editing)}>
              Save item
            </Button>
          </>
        }
      >
        {editing && (
          <div className="flex flex-col gap-space-lg p-space-xl">
            <div className="flex items-center gap-space-lg rounded-2xl bg-surface-container-low p-space-md">
              <FoodThumb name={editing.name || 'New dish'} imageUrl={editing.imageUrl} size={72} rounded="rounded-2xl" />
              <div className="flex flex-col gap-space-xs">
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                  Dish thumbnail
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Prototype generates a deterministic tile from the dish name. Paste a photo URL below to
                  override it.
                </p>
                <Input
                  placeholder="https://…/dish.jpg"
                  value={editing.imageUrl ?? ''}
                  onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value || null })}
                />
              </div>
            </div>

            <Field label="Dish name" required>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Truffle Mushroom Risotto" />
            </Field>

            <Field label="Description">
              <Textarea
                rows={3}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="Carnaroli rice, wild mushrooms, aged parmesan, shaved fresh truffle."
              />
            </Field>

            <div className="grid gap-space-md sm:grid-cols-3">
              <Field label={`Price (${currency})`} required>
                <Input
                  type="number"
                  min={0}
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                />
              </Field>
              <Field label="Prep time (min)">
                <Input
                  type="number"
                  min={1}
                  value={editing.prepTimeMinutes}
                  onChange={(e) => setEditing({ ...editing, prepTimeMinutes: Number(e.target.value) })}
                />
              </Field>
              <Field label="Calories">
                <Input
                  type="number"
                  min={0}
                  value={editing.calories}
                  onChange={(e) => setEditing({ ...editing, calories: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Field label="Category" required>
              <Select
                value={editing.categoryId}
                onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                options={[
                  { value: '', label: 'Select a category…' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>

            <div className="flex flex-col gap-space-sm rounded-2xl border border-slate-200 p-space-md">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Dietary &amp; flags
              </span>
              <div className="grid gap-space-sm sm:grid-cols-2">
                <Switch
                  checked={editing.isVegetarian}
                  onChange={(v) => setEditing({ ...editing, isVegetarian: v })}
                  label="Vegetarian"
                  description="Shows a green leaf badge on the guest menu"
                />
                <Switch
                  checked={editing.isSpicy}
                  onChange={(v) => setEditing({ ...editing, isSpicy: v })}
                  label="Spicy"
                  description="Flags heat on the dish card"
                />
                <Switch
                  checked={editing.isChefPick}
                  onChange={(v) => setEditing({ ...editing, isChefPick: v })}
                  label="Chef pick"
                  description="Featured in the chef picks row"
                />
                <Switch
                  checked={editing.isTrending}
                  onChange={(v) => setEditing({ ...editing, isTrending: v })}
                  label="Trending"
                  description="Featured in the trending row"
                />
                <Switch
                  checked={editing.available}
                  onChange={(v) => setEditing({ ...editing, available: v })}
                  label="Available"
                  description="Turn off to hide without deleting"
                />
              </div>
              <div className="flex flex-col gap-space-sm pt-space-xs">
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">Allergens</span>
                <div className="flex flex-wrap gap-space-md">
                  {ALLERGENS.map((allergen) => (
                    <Checkbox
                      key={allergen}
                      checked={editing.allergens.includes(allergen)}
                      onChange={(checked) =>
                        setEditing({
                          ...editing,
                          allergens: checked
                            ? [...editing.allergens, allergen]
                            : editing.allergens.filter((a) => a !== allergen),
                        })
                      }
                      label={allergen}
                    />
                  ))}
                </div>
              </div>
            </div>

            <OptionGroupsEditor
              groups={editing.optionGroups}
              onChange={(groups) => setEditing({ ...editing, optionGroups: groups })}
            />
          </div>
        )}
      </Drawer>

      {/* -------------------------------------------------- category modal */}
      <Modal
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title="Add a category"
        description="Categories group dishes on the guest menu."
        icon="category"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCategoryOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newCategory.name.trim()}
              onClick={async () => {
                await api.upsertCategory({
                  id: uid('cat'),
                  organizationId: organization!.id,
                  name: newCategory.name.trim(),
                  description: newCategory.description,
                  icon: newCategory.icon,
                  sortOrder: categories.length,
                  isActive: true,
                })
                toast.success(`${newCategory.name} added`)
                setNewCategory({ name: '', description: '', icon: 'restaurant_menu' })
                setCategoryOpen(false)
              }}
            >
              Add category
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-space-lg">
          <Field label="Name" required>
            <Input
              value={newCategory.name}
              onChange={(e) => setNewCategory((p) => ({ ...p, name: e.target.value }))}
              placeholder="Signature Coffee"
            />
          </Field>
          <Field label="Description">
            <Input
              value={newCategory.description}
              onChange={(e) => setNewCategory((p) => ({ ...p, description: e.target.value }))}
              placeholder="House-roasted single origin"
            />
          </Field>
          <Field label="Icon">
            <div className="flex flex-wrap gap-space-xs">
              {['restaurant_menu', 'local_cafe', 'eco', 'cake', 'local_fire_department', 'rice_bowl', 'lunch_dining', 'icecream'].map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setNewCategory((p) => ({ ...p, icon }))}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-colors',
                    newCategory.icon === icon ? 'border-primary bg-ember-50' : 'border-slate-200',
                  )}
                  aria-label={icon}
                >
                  <Icon name={icon} size={19} />
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await api.deleteMenuItem(deleteTarget.organizationId, deleteTarget.id)
          toast.success(`${deleteTarget.name} archived`)
          setDeleteTarget(null)
        }}
        title="Delete this menu item?"
        message={
          <>
            <strong>{deleteTarget?.name}</strong> will be removed from the menu. Past orders keep their
            own snapshot of the line item.
          </>
        }
        confirmLabel="Delete item"
        destructive
      />
    </div>
  )
}

/* ------------------------------------------------------- option groups */

function OptionGroupsEditor({
  groups,
  onChange,
}: {
  groups: MenuOptionGroup[]
  onChange: (groups: MenuOptionGroup[]) => void
}) {
  const [draftName, setDraftName] = useState('')
  const [draftType, setDraftType] = useState<'single' | 'multi'>('single')

  const addGroup = () => {
    if (!draftName.trim()) return
    onChange([
      ...groups,
      { id: uid('og'), name: draftName.trim(), type: draftType, required: draftType === 'single', options: [] },
    ])
    setDraftName('')
  }

  return (
    <div className="flex flex-col gap-space-md rounded-2xl border border-slate-200 p-space-md">
      <div className="flex items-center justify-between">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Customisation &amp; add-ons
        </span>
        <Badge tone="neutral">{groups.length} groups</Badge>
      </div>

      {groups.map((group, gi) => (
        <div key={group.id} className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
          <div className="flex items-center justify-between gap-space-sm">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">{group.name}</span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">
                {group.type === 'single' ? 'Choose one' : 'Choose any'} · {group.options.length} options
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon="delete"
              className="text-status-critical"
              onClick={() => onChange(groups.filter((_, i) => i !== gi))}
            >
              Remove
            </Button>
          </div>
          <div className="flex flex-col gap-space-xs">
            {group.options.map((option, oi) => (
              <div key={option.id} className="flex items-center gap-space-sm">
                <Input
                  value={option.name}
                  onChange={(e) =>
                    onChange(
                      groups.map((g, i) =>
                        i === gi
                          ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, name: e.target.value } : o)) }
                          : g,
                      ),
                    )
                  }
                  placeholder="Option name"
                />
                <Input
                  type="number"
                  className="w-28"
                  value={option.priceDelta}
                  onChange={(e) =>
                    onChange(
                      groups.map((g, i) =>
                        i === gi
                          ? {
                              ...g,
                              options: g.options.map((o, j) =>
                                j === oi ? { ...o, priceDelta: Number(e.target.value) } : o,
                              ),
                            }
                          : g,
                      ),
                    )
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  icon="close"
                  aria-label="Remove option"
                  onClick={() =>
                    onChange(
                      groups.map((g, i) =>
                        i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              icon="add"
              onClick={() =>
                onChange(
                  groups.map((g, i) =>
                    i === gi
                      ? {
                          ...g,
                          options: [
                            ...g.options,
                            { id: uid('o'), name: '', priceDelta: 0, isDefault: g.options.length === 0 },
                          ],
                        }
                      : g,
                  ),
                )
              }
            >
              Add option
            </Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-space-sm">
        <Input
          className="min-w-[180px] flex-1"
          placeholder="New group name, e.g. Size"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
        />
        <Select
          className="w-40"
          value={draftType}
          onChange={(e) => setDraftType(e.target.value as 'single' | 'multi')}
          options={[
            { value: 'single', label: 'Choose one' },
            { value: 'multi', label: 'Choose any' },
          ]}
        />
        <Button variant="secondary" icon="add" onClick={addGroup}>
          Add group
        </Button>
      </div>
    </div>
  )
}
