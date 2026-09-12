import { useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  Icon,
  Input,
  MetricCard,
  Modal,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { formatDate, relativeTime, uid } from '@/lib/format'
import type { Reservation, ReservationStatus } from '@/lib/types'

const STATUS_TONES: Record<ReservationStatus, 'neutral' | 'info' | 'success' | 'critical' | 'warning'> = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'neutral',
  cancelled: 'critical',
  no_show: 'critical',
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
}

type View = 'list' | 'calendar'

export function ReservationsPage() {
  const { reservations, tables, organization } = useAppStore()
  const toast = useToast()

  const [view, setView] = useState<View>('list')
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().slice(0, 10))
  const [statusFilter, setStatusFilter] = useState<'all' | ReservationStatus>('all')
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)
  const [draft, setDraft] = useState({
    customerName: '',
    phone: '',
    email: '',
    date: new Date().toISOString().slice(0, 10),
    time: '19:30',
    guests: 4,
    tableId: '',
    specialRequest: '',
  })

  const filtered = useMemo(
    () =>
      reservations.filter((r) => {
        if (dateFilter && r.date !== dateFilter) return false
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        return true
      }),
    [reservations, dateFilter, statusFilter],
  )

  const covers = filtered
    .filter((r) => r.status !== 'cancelled' && r.status !== 'no_show')
    .reduce((s, r) => s + r.guests, 0)

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: filtered.length }
    filtered.forEach((r) => {
      base[r.status] = (base[r.status] ?? 0) + 1
    })
    return base
  }, [filtered])

  const setStatus = async (reservation: Reservation, status: ReservationStatus) => {
    await api.updateReservationStatus(reservation.organizationId, reservation.id, status)
    toast.success(`${reservation.customerName} · ${STATUS_LABELS[status]}`)
  }

  const upcomingDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const iso = d.toISOString().slice(0, 10)
      return {
        iso,
        label: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
        day: d.getDate(),
        count: reservations.filter((r) => r.date === iso).length,
      }
    })
  }, [reservations])

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Reservations</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {filtered.length} bookings · {covers} covers for {formatDate(dateFilter)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'Day list', icon: 'list' },
              { value: 'calendar', label: 'Calendar', icon: 'calendar_month' },
            ]}
          />
          <Button icon="add" onClick={() => setAddOpen(true)}>
            New Reservation
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-space-lg lg:grid-cols-4">
        <MetricCard label="Bookings" value={filtered.length} icon="book_online" tone="neutral" />
        <MetricCard label="Covers" value={covers} icon="group" tone="brand" />
        <MetricCard label="Confirmed" value={counts.confirmed ?? 0} icon="check_circle" tone="success" />
        <MetricCard label="Awaiting" value={counts.pending ?? 0} icon="schedule" tone="warning" />
      </section>

      {/* day strip */}
      <Card className="flex flex-col gap-space-sm">
        <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Next 7 days
        </span>
        <div className="flex flex-wrap gap-space-sm">
          {upcomingDays.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setDateFilter(d.iso)}
              className={cn(
                'flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl border px-space-sm py-space-xs transition-colors',
                dateFilter === d.iso
                  ? 'border-primary bg-ember-50'
                  : 'border-slate-200 hover:bg-surface-container-low',
              )}
            >
              <span className="font-label-xs text-label-xs text-on-surface-variant">{d.label}</span>
              <span className="font-headline-sm text-headline-sm font-bold text-on-surface">{d.day}</span>
              <span className="font-label-xs text-[10px] text-on-surface-variant">{d.count} booked</span>
            </button>
          ))}
        </div>
      </Card>

      <SegmentedControl
        value={statusFilter}
        onChange={setStatusFilter}
        className="overflow-x-auto"
        options={[
          { value: 'all' as const, label: 'All', count: counts.all },
          { value: 'pending' as const, label: 'Pending', count: counts.pending ?? 0 },
          { value: 'confirmed' as const, label: 'Confirmed', count: counts.confirmed ?? 0 },
          { value: 'completed' as const, label: 'Completed', count: counts.completed ?? 0 },
          { value: 'cancelled' as const, label: 'Cancelled', count: counts.cancelled ?? 0 },
          { value: 'no_show' as const, label: 'No show', count: counts.no_show ?? 0 },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon="book_online"
          title="No reservations for this date"
          description="Bookings appear here as guests reserve online or your team adds them at the desk."
          action={
            <Button icon="add" onClick={() => setAddOpen(true)}>
              Add reservation
            </Button>
          }
        />
      ) : view === 'list' ? (
        <div className="flex flex-col gap-space-sm">
          {filtered.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center gap-space-md" interactive>
              <span className="flex h-12 w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-container-low">
                <span className="tabular font-label-md text-label-md font-bold text-on-surface">{r.time}</span>
                <span className="font-label-xs text-[10px] text-on-surface-variant">{r.guests} guests</span>
              </span>
              <span className="flex min-w-[160px] flex-1 items-center gap-space-md">
                <Avatar name={r.customerName} size={36} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-label-md text-label-md font-semibold text-on-surface">
                    {r.customerName}
                  </span>
                  <span className="truncate font-label-xs text-label-xs text-on-surface-variant">
                    {r.phone} · {r.tableNumber ?? 'No table assigned'}
                  </span>
                </span>
              </span>
              {r.specialRequest && (
                <span className="hidden max-w-[240px] items-center gap-space-xs rounded-lg bg-status-warning-bg px-space-sm py-1 lg:flex">
                  <Icon name="sticky_note_2" size={14} className="shrink-0 text-status-warning" />
                  <span className="truncate font-label-xs text-label-xs text-on-surface">
                    {r.specialRequest}
                  </span>
                </span>
              )}
              <Badge tone={STATUS_TONES[r.status]} dot>
                {STATUS_LABELS[r.status]}
              </Badge>
              <div className="flex flex-wrap items-center gap-space-xs">
                {r.status === 'pending' && (
                  <Button size="sm" icon="check" onClick={() => void setStatus(r, 'confirmed')}>
                    Confirm
                  </Button>
                )}
                {r.status === 'confirmed' && (
                  <Button size="sm" icon="done_all" onClick={() => void setStatus(r, 'completed')}>
                    Seated
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon="edit" onClick={() => setSelected(r)}>
                  Manage
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col gap-space-md">
          <span className="font-headline-sm text-headline-sm text-on-surface">
            Service timeline · {formatDate(dateFilter)}
          </span>
          <div className="flex flex-col gap-space-md">
            {Array.from({ length: 7 }, (_, i) => 17 + i).map((hour) => {
              const slot = filtered.filter((r) => Number(r.time.split(':')[0]) === hour)
              return (
                <div key={hour} className="flex gap-space-md">
                  <span className="tabular w-16 shrink-0 pt-1 font-label-sm text-label-sm font-semibold text-on-surface-variant">
                    {hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                  <div className="flex flex-1 flex-wrap gap-space-sm rounded-xl border border-dashed border-slate-300 bg-surface-container-low p-space-sm">
                    {slot.length === 0 ? (
                      <span className="font-label-xs text-label-xs text-on-surface-variant">Available</span>
                    ) : (
                      slot.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelected(r)}
                          className={cn(
                            'flex flex-col items-start gap-0.5 rounded-lg border px-space-sm py-space-xs text-left transition-colors',
                            r.status === 'confirmed'
                              ? 'border-status-success/40 bg-status-success-bg'
                              : r.status === 'pending'
                                ? 'border-status-warning/40 bg-status-warning-bg'
                                : 'border-slate-200 bg-white',
                          )}
                        >
                          <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                            {r.customerName}
                          </span>
                          <span className="font-label-xs text-[10px] text-on-surface-variant">
                            {r.guests} guests · {r.time} · {r.tableNumber ?? 'TBA'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------ detail drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.customerName ?? ''}
        subtitle={selected ? `${selected.guests} guests · ${selected.time} on ${formatDate(selected.date)}` : ''}
        footer={
          selected ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-space-sm">
              <Button size="sm" variant="secondary" icon="phone" onClick={() => toast.info('Calling is not wired up in the prototype')}>
                Call guest
              </Button>
              <div className="flex flex-wrap gap-space-xs">
                <Button size="sm" variant="secondary" onClick={() => void setStatus(selected, 'no_show')}>
                  No show
                </Button>
                <Button size="sm" variant="danger-ghost" onClick={() => setCancelTarget(selected)}>
                  Cancel
                </Button>
                <Button size="sm" icon="check" onClick={() => void setStatus(selected, 'confirmed')}>
                  Confirm
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="flex flex-col gap-space-lg p-space-xl">
            <div className="flex items-center gap-space-md rounded-2xl bg-surface-container-low p-space-md">
              <Avatar name={selected.customerName} size={48} />
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  {selected.customerName}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Booked {relativeTime(selected.createdAt)}
                </span>
              </div>
              <Badge tone={STATUS_TONES[selected.status]} className="ml-auto" dot>
                {STATUS_LABELS[selected.status]}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-space-sm">
              {[
                { label: 'Date', value: formatDate(selected.date), icon: 'event' },
                { label: 'Time', value: selected.time, icon: 'schedule' },
                { label: 'Guests', value: String(selected.guests), icon: 'group' },
                { label: 'Table', value: selected.tableNumber ?? 'Unassigned', icon: 'table_restaurant' },
              ].map((cell) => (
                <div key={cell.label} className="flex flex-col gap-0.5 rounded-xl bg-surface-container-low p-space-md">
                  <span className="flex items-center gap-space-xs font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                    <Icon name={cell.icon} size={13} />
                    {cell.label}
                  </span>
                  <span className="font-label-md text-label-md font-semibold text-on-surface">{cell.value}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-space-sm">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Contact
              </span>
              <div className="flex flex-col gap-space-xs">
                <span className="flex items-center gap-space-sm font-body-sm text-body-sm text-on-surface">
                  <Icon name="call" size={16} className="text-on-surface-variant" />
                  {selected.phone}
                </span>
                <span className="flex items-center gap-space-sm font-body-sm text-body-sm text-on-surface">
                  <Icon name="mail" size={16} className="text-on-surface-variant" />
                  {selected.email}
                </span>
              </div>
            </div>

            {selected.specialRequest && (
              <div className="flex flex-col gap-space-sm">
                <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Special request
                </span>
                <div className="flex items-start gap-space-sm rounded-xl bg-status-warning-bg p-space-md">
                  <Icon name="sticky_note_2" size={17} className="mt-0.5 shrink-0 text-status-warning" />
                  <span className="font-body-sm text-body-sm text-on-surface">{selected.specialRequest}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-space-sm">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Assign a table
              </span>
              <Select
                value={selected.tableId ?? ''}
                onChange={async (e) => {
                  const table = tables.find((t) => t.id === e.target.value)
                  await api.upsertReservation({
                    ...selected,
                    tableId: table?.id ?? null,
                    tableNumber: table?.tableNumber ?? null,
                  })
                  setSelected({ ...selected, tableId: table?.id ?? null, tableNumber: table?.tableNumber ?? null })
                  toast.success(table ? `Table ${table.tableNumber} reserved` : 'Table unassigned')
                }}
                options={[
                  { value: '', label: 'No table assigned' },
                  ...tables.map((t) => ({
                    value: t.id,
                    label: `${t.tableNumber} · ${t.capacity} seats · ${t.status}`,
                  })),
                ]}
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* ----------------------------------------------------------- add form */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New reservation"
        description="Capture the booking now, assign a table when the floor is set."
        icon="book_online"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!draft.customerName.trim() || !draft.phone.trim()}
              onClick={async () => {
                const table = tables.find((t) => t.id === draft.tableId)
                await api.upsertReservation({
                  id: uid('res'),
                  organizationId: organization!.id,
                  customerName: draft.customerName.trim(),
                  phone: draft.phone.trim(),
                  email: draft.email.trim() || '—',
                  date: draft.date,
                  time: draft.time,
                  guests: draft.guests,
                  tableId: table?.id ?? null,
                  tableNumber: table?.tableNumber ?? null,
                  status: 'pending',
                  specialRequest: draft.specialRequest,
                  createdAt: new Date().toISOString(),
                })
                toast.success('Reservation added', `${draft.customerName} · ${draft.time}`)
                setDraft({ ...draft, customerName: '', phone: '', email: '', specialRequest: '' })
                setAddOpen(false)
              }}
            >
              Save reservation
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-space-lg">
          <Field label="Guest name" required>
            <Input
              icon="person"
              value={draft.customerName}
              onChange={(e) => setDraft((p) => ({ ...p, customerName: e.target.value }))}
              placeholder="Ananya Sharma"
            />
          </Field>
          <div className="grid gap-space-lg sm:grid-cols-2">
            <Field label="Phone" required>
              <Input
                icon="call"
                value={draft.phone}
                onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+91 98450 11223"
              />
            </Field>
            <Field label="Email">
              <Input
                icon="mail"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                placeholder="guest@example.com"
              />
            </Field>
          </div>
          <div className="grid gap-space-lg sm:grid-cols-3">
            <Field label="Date" required>
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
              />
            </Field>
            <Field label="Time" required>
              <Input
                type="time"
                value={draft.time}
                onChange={(e) => setDraft((p) => ({ ...p, time: e.target.value }))}
              />
            </Field>
            <Field label="Guests" required>
              <Input
                type="number"
                min={1}
                max={30}
                value={draft.guests}
                onChange={(e) => setDraft((p) => ({ ...p, guests: Number(e.target.value) }))}
              />
            </Field>
          </div>
          <Field label="Table" hint="Optional — you can assign it later">
            <Select
              value={draft.tableId}
              onChange={(e) => setDraft((p) => ({ ...p, tableId: e.target.value }))}
              options={[
                { value: '', label: 'Assign later' },
                ...tables.map((t) => ({ value: t.id, label: `${t.tableNumber} · ${t.capacity} seats` })),
              ]}
            />
          </Field>
          <Field label="Special request">
            <Textarea
              rows={2}
              value={draft.specialRequest}
              onChange={(e) => setDraft((p) => ({ ...p, specialRequest: e.target.value }))}
              placeholder="Window seating if possible."
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return
          await setStatus(cancelTarget, 'cancelled')
          setCancelTarget(null)
          setSelected(null)
        }}
        title="Cancel this reservation?"
        message={
          <>
            <strong>{cancelTarget?.customerName}</strong> will be marked cancelled. The guest is not
            notified automatically in the prototype.
          </>
        }
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        destructive
      />
    </div>
  )
}
