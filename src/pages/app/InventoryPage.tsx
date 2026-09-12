import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  Icon,
  Input,
  MetricCard,
  Modal,
  ProgressBar,
  SearchInput,
  SegmentedControl,
  Select,
  useToast,
  type Column,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { formatDate, formatMoney, relativeTime, uid } from '@/lib/format'
import type { InventoryItem, InventoryStatus, InventoryUnit } from '@/lib/types'

const UNITS: InventoryUnit[] = ['kg', 'g', 'l', 'ml', 'pcs', 'packs', 'bottles']

function statusOf(item: InventoryItem): InventoryStatus {
  if (item.expiryDate && new Date(item.expiryDate).getTime() < Date.now()) return 'expired'
  if (item.currentStock <= item.lowStockThreshold * 0.5) return 'critical'
  if (item.currentStock <= item.lowStockThreshold) return 'low'
  return 'healthy'
}

const STATUS_TONES: Record<InventoryStatus, 'success' | 'warning' | 'critical' | 'neutral'> = {
  healthy: 'success',
  low: 'warning',
  critical: 'critical',
  expired: 'critical',
}

const STATUS_LABELS: Record<InventoryStatus, string> = {
  healthy: 'Healthy',
  low: 'Low stock',
  critical: 'Critical',
  expired: 'Expired',
}

export function InventoryPage() {
  const { inventory, organization } = useAppStore()
  const toast = useToast()

  const [statusFilter, setStatusFilter] = useState<'all' | InventoryStatus>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<InventoryItem | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [adjust, setAdjust] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState({
    ingredient: '',
    category: 'Produce',
    currentStock: '0',
    unit: 'kg' as InventoryUnit,
    lowStockThreshold: '1',
    unitCost: '0',
    supplier: '',
    expiryDate: '',
  })

  const currency = organization?.branding.currency ?? 'INR'

  const decorated = useMemo(
    () => inventory.map((item) => ({ item, status: statusOf(item) })),
    [inventory],
  )

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: inventory.length }
    decorated.forEach(({ status }) => {
      base[status] = (base[status] ?? 0) + 1
    })
    return base
  }, [decorated, inventory.length])

  const stockValue = inventory.reduce((s, i) => s + i.currentStock * i.unitCost, 0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return decorated.filter(({ item, status }) => {
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (!q) return true
      return item.ingredient.toLowerCase().includes(q) || item.supplier.toLowerCase().includes(q)
    })
  }, [decorated, statusFilter, query])

  const columns: Column<{ item: InventoryItem; status: InventoryStatus }>[] = [
    {
      key: 'ingredient',
      header: 'Ingredient',
      sortValue: (r) => r.item.ingredient,
      render: ({ item }) => (
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-semibold text-on-surface">{item.ingredient}</span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">{item.category}</span>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      sortValue: (r) => r.item.currentStock,
      render: ({ item, status }) => (
        <div className="flex min-w-[120px] flex-col items-end gap-space-xs">
          <span className="tabular font-label-md text-label-md font-semibold text-on-surface">
            {item.currentStock} {item.unit}
          </span>
          <ProgressBar
            value={item.currentStock}
            max={Math.max(item.lowStockThreshold * 3, item.currentStock)}
            tone={status === 'healthy' ? 'success' : status === 'low' ? 'warning' : 'critical'}
            className="w-24"
          />
        </div>
      ),
    },
    {
      key: 'threshold',
      header: 'Minimum',
      align: 'right',
      hideBelow: 'md' as const,
      render: ({ item }) => (
        <span className="tabular font-body-sm text-body-sm text-on-surface-variant">
          {item.lowStockThreshold} {item.unit}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      sortValue: (r) => r.item.supplier,
      render: ({ item }) => (
        <span className="font-body-sm text-body-sm text-on-surface">{item.supplier || '—'}</span>
      ),
      hideBelow: 'lg' as const,
    },
    {
      key: 'expiry',
      header: 'Expiry',
      sortValue: (r) => r.item.expiryDate ?? '',
      render: ({ item }) => (
        <span
          className={cn(
            'font-body-sm text-body-sm',
            item.expiryDate && new Date(item.expiryDate).getTime() - Date.now() < 7 * 864e5
              ? 'font-semibold text-status-critical'
              : 'text-on-surface-variant',
          )}
        >
          {item.expiryDate ? formatDate(item.expiryDate) : '—'}
        </span>
      ),
      hideBelow: 'lg' as const,
    },
    {
      key: 'status',
      header: 'Status',
      render: ({ status }) => (
        <Badge tone={STATUS_TONES[status]} dot>
          {STATUS_LABELS[status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sticky: true,
      render: ({ item }) => (
        <Button size="sm" variant="ghost" iconRight="chevron_right" onClick={() => setSelected(item)}>
          Manage
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Inventory</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {inventory.length} tracked ingredients · {formatMoney(stockValue, currency)} at cost on hand
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <SearchInput value={query} onChange={setQuery} placeholder="Search ingredient or supplier" className="w-full sm:w-72" />
          <Button icon="add" onClick={() => setAddOpen(true)}>
            Add Ingredient
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-space-lg lg:grid-cols-4">
        <MetricCard label="Total items" value={inventory.length} icon="inventory_2" tone="neutral" />
        <MetricCard label="Low stock" value={counts.low ?? 0} icon="warning_amber" tone="warning" />
        <MetricCard label="Critical" value={counts.critical ?? 0} icon="error" tone="warning" />
        <MetricCard label="Expiring soon" value={counts.expired ?? 0} icon="event_busy" tone="warning" />
      </section>

      <SegmentedControl
        value={statusFilter}
        onChange={setStatusFilter}
        className="overflow-x-auto"
        options={[
          { value: 'all' as const, label: 'All', count: counts.all },
          { value: 'healthy' as const, label: 'Healthy', count: counts.healthy ?? 0 },
          { value: 'low' as const, label: 'Low', count: counts.low ?? 0 },
          { value: 'critical' as const, label: 'Critical', count: counts.critical ?? 0 },
          { value: 'expired' as const, label: 'Expired', count: counts.expired ?? 0 },
        ]}
      />

      <Card padded={false} className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.item.id}
          onRowClick={(r) => setSelected(r.item)}
          empty={
            <EmptyState
              icon="inventory_2"
              title={query ? `Nothing matches “${query}”` : 'No ingredients tracked yet'}
              description="Add the ingredients you buy regularly so low-stock warnings fire before service."
              action={
                <Button icon="add" onClick={() => setAddOpen(true)}>
                  Add ingredient
                </Button>
              }
            />
          }
        />
      </Card>

      {/* ---------------------------------------------------- detail drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null)
          setAdjust({})
        }}
        title={selected?.ingredient ?? ''}
        subtitle={selected ? `${selected.category} · ${selected.supplier}` : ''}
        footer={
          selected ? (
            <div className="flex w-full items-center justify-between gap-space-sm">
              <span className="font-label-xs text-label-xs text-on-surface-variant">
                Last restocked {relativeTime(selected.lastRestockedAt)}
              </span>
              <Button
                size="sm"
                variant="secondary"
                icon="local_shipping"
                onClick={() => toast.info('Purchase orders are not part of the MVP')}
              >
                Raise purchase order
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="flex flex-col gap-space-lg p-space-xl">
            <div className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-low p-space-md">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Current stock
                </span>
                <Badge tone={STATUS_TONES[statusOf(selected)]}>{STATUS_LABELS[statusOf(selected)]}</Badge>
              </div>
              <span className="tabular font-headline-lg text-headline-lg font-bold text-on-surface">
                {selected.currentStock} {selected.unit}
              </span>
              <ProgressBar
                value={selected.currentStock}
                max={Math.max(selected.lowStockThreshold * 3, selected.currentStock)}
                tone={statusOf(selected) === 'healthy' ? 'success' : 'critical'}
              />
              <span className="font-label-xs text-label-xs text-on-surface-variant">
                Minimum {selected.lowStockThreshold} {selected.unit} ·{' '}
                {formatMoney(selected.unitCost, currency)} per {selected.unit}
              </span>
            </div>

            <div className="flex flex-col gap-space-sm">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Adjust stock
              </span>
              <div className="flex flex-wrap items-end gap-space-sm">
                <Field label="Amount" className="flex-1">
                  <Input
                    type="number"
                    placeholder={`e.g. 5`}
                    value={adjust[selected.id] ?? ''}
                    onChange={(e) => setAdjust((p) => ({ ...p, [selected.id]: e.target.value }))}
                  />
                </Field>
                <Button
                  icon="add"
                  variant="secondary"
                  disabled={!adjust[selected.id]}
                  onClick={async () => {
                    const delta = Number(adjust[selected.id])
                    if (!Number.isFinite(delta)) return
                    await api.adjustStock(selected.organizationId, selected.id, delta)
                    setSelected({ ...selected, currentStock: Math.max(0, selected.currentStock + delta) })
                    setAdjust((p) => ({ ...p, [selected.id]: '' }))
                    toast.success(`Restocked ${delta} ${selected.unit}`)
                  }}
                >
                  Restock
                </Button>
                <Button
                  icon="remove"
                  variant="secondary"
                  disabled={!adjust[selected.id]}
                  onClick={async () => {
                    const delta = -Math.abs(Number(adjust[selected.id]))
                    if (!Number.isFinite(delta)) return
                    await api.adjustStock(selected.organizationId, selected.id, delta)
                    setSelected({ ...selected, currentStock: Math.max(0, selected.currentStock + delta) })
                    setAdjust((p) => ({ ...p, [selected.id]: '' }))
                    toast.success(`Consumed ${Math.abs(delta)} ${selected.unit}`)
                  }}
                >
                  Consume
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-space-sm">
              {[
                { label: 'Unit cost', value: formatMoney(selected.unitCost, currency), icon: 'payments' },
                {
                  label: 'Value on hand',
                  value: formatMoney(selected.currentStock * selected.unitCost, currency),
                  icon: 'savings',
                },
                {
                  label: 'Expiry',
                  value: selected.expiryDate ? formatDate(selected.expiryDate) : 'No expiry',
                  icon: 'event',
                },
                { label: 'Supplier', value: selected.supplier || '—', icon: 'local_shipping' },
              ].map((cell) => (
                <div key={cell.label} className="flex flex-col gap-0.5 rounded-xl bg-surface-container-low p-space-md">
                  <span className="flex items-center gap-space-xs font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                    <Icon name={cell.icon} size={13} />
                    {cell.label}
                  </span>
                  <span className="truncate font-label-md text-label-md font-semibold text-on-surface">
                    {cell.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      {/* ---------------------------------------------------------- add item */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add an ingredient"
        description="Thresholds drive the low-stock alerts on the dashboard."
        icon="inventory_2"
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!draft.ingredient.trim()}
              onClick={async () => {
                await api.upsertInventoryItem({
                  id: uid('inv'),
                  organizationId: organization!.id,
                  ingredient: draft.ingredient.trim(),
                  category: draft.category,
                  currentStock: Number(draft.currentStock) || 0,
                  unit: draft.unit,
                  lowStockThreshold: Number(draft.lowStockThreshold) || 1,
                  unitCost: Number(draft.unitCost) || 0,
                  supplier: draft.supplier.trim(),
                  expiryDate: draft.expiryDate ? new Date(draft.expiryDate).toISOString() : null,
                  lastRestockedAt: new Date().toISOString(),
                })
                toast.success(`${draft.ingredient} added`)
                setDraft({ ...draft, ingredient: '', currentStock: '0', supplier: '', expiryDate: '' })
                setAddOpen(false)
              }}
            >
              Add ingredient
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-space-lg">
          <Field label="Ingredient" required>
            <Input
              icon="grocery"
              value={draft.ingredient}
              onChange={(e) => setDraft((p) => ({ ...p, ingredient: e.target.value }))}
              placeholder="Arabica Beans (House)"
            />
          </Field>
          <div className="grid gap-space-lg sm:grid-cols-2">
            <Field label="Category">
              <Select
                value={draft.category}
                onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                options={['Produce', 'Dairy', 'Dairy alt', 'Meat', 'Bakery', 'Pantry', 'Beverage', 'Spice', 'Grains', 'Specialty'].map(
                  (c) => ({ value: c, label: c }),
                )}
              />
            </Field>
            <Field label="Supplier">
              <Input
                icon="local_shipping"
                value={draft.supplier}
                onChange={(e) => setDraft((p) => ({ ...p, supplier: e.target.value }))}
                placeholder="Beanhouse Roasters"
              />
            </Field>
          </div>
          <div className="grid gap-space-lg sm:grid-cols-3">
            <Field label="Current stock">
              <Input
                type="number"
                value={draft.currentStock}
                onChange={(e) => setDraft((p) => ({ ...p, currentStock: e.target.value }))}
              />
            </Field>
            <Field label="Unit">
              <Select
                value={draft.unit}
                onChange={(e) => setDraft((p) => ({ ...p, unit: e.target.value as InventoryUnit }))}
                options={UNITS.map((u) => ({ value: u, label: u }))}
              />
            </Field>
            <Field label="Low-stock at">
              <Input
                type="number"
                value={draft.lowStockThreshold}
                onChange={(e) => setDraft((p) => ({ ...p, lowStockThreshold: e.target.value }))}
              />
            </Field>
          </div>
          <div className="grid gap-space-lg sm:grid-cols-2">
            <Field label={`Unit cost (${currency})`}>
              <Input
                type="number"
                value={draft.unitCost}
                onChange={(e) => setDraft((p) => ({ ...p, unitCost: e.target.value }))}
              />
            </Field>
            <Field label="Expiry date">
              <Input
                type="date"
                value={draft.expiryDate}
                onChange={(e) => setDraft((p) => ({ ...p, expiryDate: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
