import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Icon,
  Input,
  MetricCard,
  SegmentedControl,
  Select,
  useToast,
  type Column,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { elapsed, formatMoney, relativeTime, uid } from '@/lib/format'
import {
  SERVICE_REQUEST_LABELS,
  TABLE_STATUS_LABELS,
  type RestaurantTable,
  type TableStatus,
} from '@/lib/types'
import { guestTableUrl } from '@/lib/publicRoutes'
import { useTicker } from '@/lib/hooks'

const STATUS_TONES: Record<TableStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  available: 'success',
  occupied: 'warning',
  reserved: 'info',
  cleaning: 'neutral',
}

const STATUS_STYLES: Record<TableStatus, string> = {
  available: 'border-status-success/40 bg-status-success-bg hover:border-status-success',
  occupied: 'border-status-warning/40 bg-status-warning-bg hover:border-status-warning',
  reserved: 'border-status-info/40 bg-status-info-bg hover:border-status-info',
  cleaning: 'border-slate-300 bg-slate-100 hover:border-slate-400',
}

type View = 'grid' | 'floor' | 'list'

export function TablesPage() {
  const { tables, orders, serviceRequests, organization, employees } = useAppStore()
  const toast = useToast()
  const navigate = useNavigate()
  useTicker(1000)

  const [view, setView] = useState<View>('grid')
  const [statusFilter, setStatusFilter] = useState<'all' | TableStatus>('all')
  const [zoneFilter, setZoneFilter] = useState<'all' | string>('all')
  const [selected, setSelected] = useState<RestaurantTable | null>(null)
  const [resetTarget, setResetTarget] = useState<RestaurantTable | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newTable, setNewTable] = useState({ tableNumber: '', capacity: '4', zone: 'Indoor' })

  const currency = organization?.branding.currency ?? 'INR'
  const zones = useMemo(() => [...new Set(tables.map((t) => t.zone))], [tables])

  const counts = useMemo(() => {
    const base = { available: 0, occupied: 0, reserved: 0, cleaning: 0 }
    tables.forEach((t) => {
      base[t.status] += 1
    })
    return base
  }, [tables])

  const openBills = tables.reduce((s, t) => s + t.currentBill, 0)

  const filtered = useMemo(
    () =>
      tables.filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false
        if (zoneFilter !== 'all' && t.zone !== zoneFilter) return false
        return true
      }),
    [tables, statusFilter, zoneFilter],
  )

  const waiters = employees.filter((e) => e.role === 'waiter' || e.role === 'manager' || e.role === 'owner')

  const pendingRequests = serviceRequests.filter((s) => s.status === 'pending')

  const changeStatus = async (table: RestaurantTable, status: TableStatus) => {
    await api.updateTableStatus(table.organizationId, table.id, status)
    toast.success(`${table.tableNumber} set to ${TABLE_STATUS_LABELS[status]}`)
  }

  const columns: Column<RestaurantTable>[] = [
    {
      key: 'table',
      header: 'Table',
      sortValue: (t) => Number(t.tableNumber.replace(/\D/g, '')),
      render: (t) => (
        <div className="flex items-center gap-space-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-high font-label-sm text-label-sm font-bold text-on-surface">
            {t.tableNumber.replace('T-', '')}
          </span>
          <div className="flex flex-col">
            <span className="font-label-md text-label-md font-semibold text-on-surface">{t.tableNumber}</span>
            <span className="font-label-xs text-label-xs text-on-surface-variant">{t.zone}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Seats',
      align: 'center',
      sortValue: (t) => t.capacity,
      render: (t) => (
        <span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-on-surface">
          <Icon name="group" size={15} className="text-on-surface-variant" />
          {t.capacity}
        </span>
      ),
      hideBelow: 'sm' as const,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (t) => t.status,
      render: (t) => (
        <Badge tone={STATUS_TONES[t.status]} dot>
          {TABLE_STATUS_LABELS[t.status]}
        </Badge>
      ),
    },
    {
      key: 'waiter',
      header: 'Waiter',
      render: (t) =>
        t.assignedWaiterName ? (
          <span className="flex items-center gap-space-sm">
            <Avatar name={t.assignedWaiterName} size={26} />
            <span className="font-body-sm text-body-sm text-on-surface">{t.assignedWaiterName}</span>
          </span>
        ) : (
          <span className="font-body-sm text-body-sm text-on-surface-variant">Unassigned</span>
        ),
      hideBelow: 'md' as const,
    },
    {
      key: 'timer',
      header: 'Occupied',
      align: 'right',
      hideBelow: 'lg' as const,
      render: (t) =>
        t.occupiedSince ? (
          <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface">
            {elapsed(t.occupiedSince)}
          </span>
        ) : (
          <span className="font-body-sm text-body-sm text-on-surface-variant">—</span>
        ),
    },
    {
      key: 'bill',
      header: 'Current bill',
      align: 'right',
      sortValue: (t) => t.currentBill,
      render: (t) =>
        t.currentBill > 0 ? (
          <span className="font-label-md text-label-md font-bold text-on-surface">
            {formatMoney(t.currentBill, currency)}
          </span>
        ) : (
          <span className="font-body-sm text-body-sm text-on-surface-variant">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sticky: true,
      render: (t) => (
        <Button size="sm" variant="ghost" iconRight="chevron_right" onClick={() => setSelected(t)}>
          Manage
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            Tables &amp; Floor
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {counts.occupied} occupied · {counts.available} available ·{' '}
            {formatMoney(openBills, currency)} in open bills
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: 'Grid', icon: 'grid_view' },
              { value: 'floor', label: 'Floor', icon: 'map' },
              { value: 'list', label: 'List', icon: 'list' },
            ]}
          />
          <Button variant="secondary" icon="qr_code_2" onClick={() => navigate('/app/tables/qr')}>
            QR codes
          </Button>
          <Button icon="add" onClick={() => setAddOpen(true)}>
            Add Table
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-space-lg lg:grid-cols-4">
        <MetricCard label="Total tables" value={tables.length} icon="table_restaurant" tone="neutral" />
        <MetricCard label="Occupied" value={counts.occupied} icon="person" tone="warning" progress={{ value: counts.occupied, max: tables.length || 1 }} />
        <MetricCard label="Available" value={counts.available} icon="check_circle" tone="success" />
        <MetricCard label="Reserved" value={counts.reserved} icon="event_seat" tone="info" />
      </section>

      {/* Service request rail */}
      {pendingRequests.length > 0 && (
        <Card className="flex flex-col gap-space-sm border-status-critical/25 bg-status-critical-bg">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-space-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-status-critical">
                <Icon name="notifications_active" size={18} />
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">
                {pendingRequests.length} guest request{pendingRequests.length === 1 ? '' : 's'} waiting
              </span>
            </span>
            <Badge tone="critical" dot>
              Live
            </Badge>
          </div>
          <div className="flex flex-wrap gap-space-sm">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-space-sm rounded-xl bg-white p-space-sm shadow-e1"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-highest font-label-sm text-label-sm font-bold text-primary">
                  {request.tableNumber}
                </span>
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {SERVICE_REQUEST_LABELS[request.type]}
                  </span>
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    {relativeTime(request.createdAt)}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    await api.updateServiceRequestStatus(request.id, 'completed', 'You')
                    toast.success(`${request.tableNumber} acknowledged`)
                  }}
                >
                  Acknowledge
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-space-sm">
        <SegmentedControl
          value={statusFilter}
          onChange={setStatusFilter}
          className="overflow-x-auto"
          options={[
            { value: 'all' as const, label: 'All', count: tables.length },
            { value: 'available' as const, label: 'Available', count: counts.available },
            { value: 'occupied' as const, label: 'Occupied', count: counts.occupied },
            { value: 'reserved' as const, label: 'Reserved', count: counts.reserved },

            { value: 'cleaning' as const, label: 'Cleaning', count: counts.cleaning },
          ]}
        />
        {zones.length > 1 && (
          <Select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            options={[{ value: 'all', label: 'All zones' }, ...zones.map((z) => ({ value: z, label: z }))]}
            className="w-40"
          />
        )}
      </div>

      {/* ------------------------------------------------------------- views */}
      {view === 'list' ? (
        <Card padded={false} className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(t) => t.id}
            onRowClick={setSelected}
            empty={<EmptyState icon="table_restaurant" title="No tables match this filter" description="Try another status or zone." />}
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-space-sm sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {filtered.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelected(table)}
              className={cn(
                'flex flex-col gap-space-xs rounded-2xl border-2 p-space-md text-left transition-all',
                STATUS_STYLES[table.status],
              )}
            >
              <div className="flex items-start justify-between">
                <span className="font-headline-md text-headline-md font-bold text-on-surface">
                  {table.tableNumber}
                </span>
                <Badge tone={STATUS_TONES[table.status]} dot>
                  {TABLE_STATUS_LABELS[table.status]}
                </Badge>
              </div>
              <span className="flex items-center gap-space-xs font-label-xs text-label-xs text-on-surface-variant">
                <Icon name="group" size={14} />
                {table.capacity} seats · {table.zone}
              </span>
              {table.occupiedSince && (
                <span className="tabular flex items-center gap-space-xs font-label-xs text-label-xs font-semibold text-on-surface">
                  <Icon name="schedule" size={13} />
                  {elapsed(table.occupiedSince)}
                </span>
              )}
              <div className="mt-auto flex items-end justify-between pt-space-xs">
                {table.assignedWaiterName ? (
                  <Avatar name={table.assignedWaiterName} size={26} />
                ) : (
                  <span className="font-label-xs text-label-xs text-on-surface-variant">No waiter</span>
                )}
                {table.currentBill > 0 && (
                  <span className="tabular font-label-md text-label-md font-bold text-on-surface">
                    {formatMoney(table.currentBill, currency, { compact: true })}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col gap-space-lg">
          <div className="flex items-center justify-between">
            <span className="font-headline-sm text-headline-sm text-on-surface">Floor plan</span>
            <span className="font-label-xs text-label-xs text-on-surface-variant">
              Drag-free prototype layout · zones grouping from setup
            </span>
          </div>
          {zones.map((zone) => (
            <div key={zone} className="flex flex-col gap-space-sm">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {zone}
              </span>
              <div className="grid grid-cols-2 gap-space-md rounded-2xl border border-dashed border-slate-300 bg-surface-container-low p-space-md sm:grid-cols-4 lg:grid-cols-6">
                {filtered
                  .filter((t) => t.zone === zone)
                  .map((table) => (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelected(table)}
                      className={cn(
                        'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border-2 transition-all',
                        STATUS_STYLES[table.status],
                      )}
                    >
                      <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                        {table.tableNumber}
                      </span>
                      <span className="flex items-center gap-0.5 font-label-xs text-[10px] text-on-surface-variant">
                        <Icon name="group" size={11} />
                        {table.capacity}
                      </span>
                      {table.occupiedSince && (
                        <span className="tabular font-label-xs text-[10px] font-semibold text-on-surface">
                          {elapsed(table.occupiedSince)}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          {!filtered.length && (
            <EmptyState icon="map" title="Nothing on the floor" description="Adjust the filters above." />
          )}
        </Card>
      )}

      {/* ---------------------------------------------------- table drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.tableNumber} · ${selected.zone}` : ''}
        subtitle={selected ? `${selected.capacity} seats · ${TABLE_STATUS_LABELS[selected.status]}` : ''}
        footer={
          selected ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-space-sm">
              <Button
                size="sm"
                variant="secondary"
                icon="qr_code_2"
                onClick={() => {
                  setSelected(null)
                  navigate('/app/tables/qr')
                }}
              >
                View QR
              </Button>
              <Button size="sm" variant="danger-ghost" icon="restart_alt" onClick={() => setResetTarget(selected)}>
                Reset table
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <TableDetail
            table={selected}
            slug={organization?.slug ?? ''}
            currency={currency}
            waiters={waiters}
            orders={orders.filter((o) => o.tableId === selected.id)}
            onStatusChange={(status) => void changeStatus(selected, status)}
            onAssign={async (waiterId, waiterName) => {
              await api.assignWaiter(selected.organizationId, selected.id, waiterId, waiterName)
              toast.success(waiterName ? `${waiterName} assigned to ${selected.tableNumber}` : 'Waiter unassigned')
            }}
          />
        )}
      </Drawer>

      {/* ------------------------------------------------------- add table */}
      <Drawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a table"
        subtitle="Generate the QR code straight after creating it"
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              icon="add"
              disabled={!newTable.tableNumber.trim()}
              onClick={async () => {
                if (tables.some((t) => t.tableNumber.toLowerCase() === newTable.tableNumber.trim().toLowerCase())) {
                  toast.error('That table number already exists')
                  return
                }
                const orgId = organization!.id
                const index = tables.length
                await api.upsertTable({
                  id: uid('tbl'),
                  organizationId: orgId,
                  branchId: `br_${organization!.slug}_main`,
                  tableNumber: newTable.tableNumber.trim().toUpperCase(),
                  capacity: Number(newTable.capacity),
                  status: 'available',
                  assignedWaiterId: null,
                  assignedWaiterName: null,
                  currentBill: 0,
                  occupiedSince: null,
                  qrToken: `${organization!.slug}-${newTable.tableNumber.toLowerCase().trim()}-${1000 + index}`,
                  zone: newTable.zone as RestaurantTable['zone'],
                  posX: index % 6,
                  posY: Math.floor(index / 6),
                })
                toast.success(`${newTable.tableNumber.toUpperCase()} added`)
                setNewTable({ tableNumber: '', capacity: '4', zone: 'Indoor' })
                setAddOpen(false)
              }}
            >
              Create table
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-space-lg p-space-xl">
          <Input
            label="Table number"
            icon="tag"
            placeholder="T-25"
            value={newTable.tableNumber}
            onChange={(e) => setNewTable((p) => ({ ...p, tableNumber: e.target.value }))}
            controlSize="lg"
          />
          <Select
            label="Seats"
            value={newTable.capacity}
            onChange={(e) => setNewTable((p) => ({ ...p, capacity: e.target.value }))}
            options={[2, 3, 4, 6, 8, 10, 12].map((n) => ({ value: String(n), label: `${n} seats` }))}
          />
          <Select
            label="Zone"
            value={newTable.zone}
            onChange={(e) => setNewTable((p) => ({ ...p, zone: e.target.value }))}
            options={['Indoor', 'Terrace', 'Private', 'Bar'].map((z) => ({ value: z, label: z }))}
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        onConfirm={async () => {
          if (!resetTarget) return
          await api.updateTableStatus(resetTarget.organizationId, resetTarget.id, 'available')
          setResetTarget(null)
          setSelected(null)
          toast.success('Table reset to available')
        }}
        title="Reset this table?"
        message={
          <>
            <strong>{resetTarget?.tableNumber}</strong> will be marked available and its running bill of{' '}
            {formatMoney(resetTarget?.currentBill ?? 0, currency)} cleared. Open orders are not cancelled.
          </>
        }
        confirmLabel="Reset table"
        destructive
      />
    </div>
  )
}

/* ------------------------------------------------------------ table detail */

function TableDetail({
  table,
  slug,
  currency,
  waiters,
  orders,
  onStatusChange,
  onAssign,
}: {
  table: RestaurantTable
  slug: string
  currency: string
  waiters: { membershipId: string; name: string; role: string }[]
  orders: { id: string; orderNumber: string; status: string; total: number; placedAt: string }[]
  onStatusChange: (status: TableStatus) => void
  onAssign: (waiterId: string | null, waiterName: string | null) => Promise<void>
}) {
  const guestUrl = guestTableUrl(slug, table.tableNumber)

  return (
    <div className="flex flex-col gap-space-lg p-space-xl">
      <div className="grid grid-cols-2 gap-space-sm">
        {[
          { label: 'Status', value: TABLE_STATUS_LABELS[table.status], icon: 'sensors' },
          { label: 'Seats', value: `${table.capacity}`, icon: 'group' },
          {
            label: 'Occupied for',
            value: table.occupiedSince ? elapsed(table.occupiedSince) : '—',
            icon: 'schedule',
          },
          { label: 'Running bill', value: formatMoney(table.currentBill, currency), icon: 'receipt' },
        ].map((cell) => (
          <div key={cell.label} className="flex flex-col gap-0.5 rounded-xl bg-surface-container-low p-space-md">
            <span className="flex items-center gap-space-xs font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
              <Icon name={cell.icon} size={13} />
              {cell.label}
            </span>
            <span className="tabular font-headline-sm text-headline-sm font-bold text-on-surface">
              {cell.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-space-sm">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Change status
        </span>
        <div className="flex flex-wrap gap-space-xs">
          {(Object.keys(TABLE_STATUS_LABELS) as TableStatus[]).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === table.status ? 'primary' : 'secondary'}
              onClick={() => onStatusChange(status)}
            >
              {TABLE_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-space-sm">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Assigned waiter
        </span>
        {table.assignedWaiterName ? (
          <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-space-md">
            <span className="flex items-center gap-space-sm">
              <Avatar name={table.assignedWaiterName} size={32} />
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                {table.assignedWaiterName}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => void onAssign(null, null)}>
              Unassign
            </Button>
          </div>
        ) : (
          <Select
            value=""
            onChange={(e) => {
              const member = waiters.find((w) => w.membershipId === e.target.value)
              if (member) void onAssign(member.membershipId, member.name)
            }}
            options={[
              { value: '', label: 'Select a team member…' },
              ...waiters.map((w) => ({ value: w.membershipId, label: `${w.name} (${w.role})` })),
            ]}
          />
        )}
      </div>

      <div className="flex flex-col gap-space-sm">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Orders at this table
        </span>
        {orders.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No orders yet — share the table QR to start one.
          </p>
        ) : (
          orders.slice(0, 5).map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-space-sm"
            >
              <span className="flex flex-col">
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {order.orderNumber}
                </span>
                <span className="font-label-xs text-label-xs capitalize text-on-surface-variant">
                  {order.status} · {relativeTime(order.placedAt)}
                </span>
              </span>
              <span className="tabular font-label-md text-label-md font-bold text-on-surface">
                {formatMoney(order.total, currency)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-space-sm">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Guest QR link
        </span>
        <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-space-sm">
          <Icon name="link" size={16} className="shrink-0 text-on-surface-variant" />
          <span className="truncate font-label-xs text-label-xs text-on-surface-variant">{guestUrl}</span>
          <Button
            size="sm"
            variant="ghost"
            icon="content_copy"
            onClick={() => void navigator.clipboard?.writeText(guestUrl)}
          >
            Copy
          </Button>
        </div>
      </div>
    </div>
  )
}
