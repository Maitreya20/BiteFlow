import { useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  Icon,
  Input,
  MetricCard,
  Modal,
  SearchInput,
  SegmentedControl,
  Select,
  Switch,
  useToast,
  type Column,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore, usePlanUsage } from '@/store/AppStore'
import * as api from '@/data/api'
import { formatDate, relativeTime } from '@/lib/format'
import { ROLE_CAPABILITIES, ROLE_LABELS, type Role } from '@/lib/types'
import type { EmployeeRow } from '@/store/AppStore'

const ASSIGNABLE: Role[] = ['owner', 'manager', 'cashier', 'chef', 'kitchen_staff', 'waiter']

const ROLE_TONES: Record<Role, 'brand' | 'info' | 'warning' | 'success' | 'neutral' | 'critical'> = {
  super_admin: 'critical',
  owner: 'brand',
  manager: 'info',
  cashier: 'success',
  chef: 'warning',
  kitchen_staff: 'neutral',
  waiter: 'info',
  customer: 'neutral',
}

const CAPABILITY_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  kitchen: 'Kitchen',
  tables: 'Tables',
  reservations: 'Reservations',
  menu: 'Menu',
  inventory: 'Inventory',
  customers: 'Customers',
  employees: 'Staff',
  analytics: 'Analytics',
  billing: 'Billing',
  settings: 'Settings',
  branding: 'Branding',
}

export function EmployeesPage() {
  const { employees, organization } = useAppStore()
  const { plan, usage } = usePlanUsage()
  const toast = useToast()

  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<EmployeeRow | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<EmployeeRow | null>(null)
  const [invite, setInvite] = useState({ name: '', email: '', role: 'waiter' as Role })

  const atLimit = usage.maxEmployees >= plan.limits.maxEmployees

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return employees.filter((e) => {
      if (roleFilter !== 'all' && e.role !== roleFilter) return false
      if (!q) return true
      return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
    })
  }, [employees, roleFilter, query])

  const active = employees.filter((e) => e.status === 'active').length
  const invited = employees.filter((e) => e.status === 'invited').length

  const columns: Column<EmployeeRow>[] = [
    {
      key: 'person',
      header: 'Team member',
      sortValue: (e) => e.name,
      render: (e) => (
        <div className="flex items-center gap-space-sm">
          <Avatar name={e.name} size={34} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-label-md text-label-md font-semibold text-on-surface">{e.name}</span>
            <span className="truncate font-label-xs text-label-xs text-on-surface-variant">{e.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortValue: (e) => e.role,
      render: (e) => <Badge tone={ROLE_TONES[e.role]}>{ROLE_LABELS[e.role]}</Badge>,
    },
    {
      key: 'shift',
      header: 'Shift',
      render: (e) => <span className="font-body-sm text-body-sm text-on-surface-variant">{e.shift}</span>,
      hideBelow: 'md' as const,
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => (
        <Badge tone={e.status === 'active' ? 'success' : e.status === 'invited' ? 'info' : 'critical'} dot>
          {e.status === 'active' ? 'Active' : e.status === 'invited' ? 'Invited' : 'Suspended'}
        </Badge>
      ),
    },
    {
      key: 'lastActive',
      header: 'Last active',
      align: 'right',
      sortValue: (e) => e.lastActiveAt ?? '',
      render: (e) => (
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          {e.lastActiveAt ? relativeTime(e.lastActiveAt) : 'Never'}
        </span>
      ),
      hideBelow: 'lg' as const,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sticky: true,
      render: (e) => (
        <Button size="sm" variant="ghost" iconRight="chevron_right" onClick={() => setSelected(e)}>
          Manage
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Staff &amp; Roles</h1>
            <Badge tone={atLimit ? 'critical' : 'neutral'}>
              {usage.maxEmployees} / {plan.limits.maxEmployees} seats
            </Badge>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {active} active · {invited} invited · permissions enforced server-side
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <SearchInput value={query} onChange={setQuery} placeholder="Search name or email" className="w-full sm:w-64" />
          <Button icon="person_add" disabled={atLimit} onClick={() => setInviteOpen(true)}>
            Invite Employee
          </Button>
        </div>
      </header>

      {atLimit && (
        <Card className="flex flex-wrap items-center justify-between gap-space-md border-status-critical/25 bg-status-critical-bg">
          <div className="flex items-center gap-space-md">
            <Icon name="lock" size={20} className="text-status-critical" />
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                You've reached your staff limit
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                The {plan.name} plan includes {plan.limits.maxEmployees} seats.
              </span>
            </div>
          </div>
          <Button size="sm" iconRight="arrow_forward" onClick={() => (window.location.href = '/app/billing')}>
            View upgrade options
          </Button>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-space-lg lg:grid-cols-4">
        <MetricCard label="Team size" value={employees.length} icon="badge" tone="neutral" />
        <MetricCard label="Active" value={active} icon="check_circle" tone="success" />
        <MetricCard label="Invites pending" value={invited} icon="mark_email_unread" tone="info" />
        <MetricCard label="Roles in use" value={new Set(employees.map((e) => e.role)).size} icon="admin_panel_settings" tone="brand" />
      </section>

      <SegmentedControl
        value={roleFilter}
        onChange={setRoleFilter}
        className="overflow-x-auto"
        options={[
          { value: 'all' as const, label: 'All', count: employees.length },
          ...ASSIGNABLE.map((r) => ({
            value: r,
            label: ROLE_LABELS[r],
            count: employees.filter((e) => e.role === r).length,
          })),
        ]}
      />

      <Card padded={false} className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(e) => e.membershipId}
          onRowClick={setSelected}
          empty={
            <EmptyState
              icon="badge"
              title="No team members yet"
              description="Invite your manager, chef, cashier and waiters so each person sees only what they need."
              action={
                <Button icon="person_add" onClick={() => setInviteOpen(true)}>
                  Invite employee
                </Button>
              }
            />
          }
        />
      </Card>

      {/* permissions reference */}
      <Card className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-headline-sm text-headline-sm text-on-surface">Role permissions</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Reference for what each role can reach. Server-side checks mirror this matrix exactly.
            </p>
          </div>
          <Icon name="shield" size={22} className="text-on-surface-variant" />
        </div>
        <div className="scroll-slim overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-space-lg py-space-sm text-left font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-500">
                  Screen
                </th>
                {ASSIGNABLE.slice(1).map((role) => (
                  <th
                    key={role}
                    className="px-space-lg py-space-sm text-center font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(CAPABILITY_LABELS).map((cap) => (
                <tr key={cap} className="border-b border-slate-200/70">
                  <td className="px-space-lg py-space-sm font-body-sm text-body-sm font-medium text-on-surface">
                    {CAPABILITY_LABELS[cap]}
                  </td>
                  {ASSIGNABLE.slice(1).map((role) => (
                    <td key={role} className="px-space-lg py-space-sm text-center">
                      {ROLE_CAPABILITIES[role].includes(cap) ? (
                        <Icon name="check_circle" size={17} className="mx-auto text-status-success" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ------------------------------------------------------- detail drawer */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? `${ROLE_LABELS[selected.role]} · joined ${formatDate(selected.invitedAt)}` : ''}
        footer={
          selected ? (
            <div className="flex w-full items-center justify-between gap-space-sm">
              <Button
                size="sm"
                variant="secondary"
                icon="lock_reset"
                onClick={() => toast.info('Password resets are handled by Supabase Auth')}
              >
                Reset access
              </Button>
              <Button
                size="sm"
                variant="danger-ghost"
                icon="person_remove"
                disabled={selected.role === 'owner'}
                onClick={() => setRemoveTarget(selected)}
              >
                Remove from team
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="flex flex-col gap-space-lg p-space-xl">
            <div className="flex items-center gap-space-md rounded-2xl bg-surface-container-low p-space-md">
              <Avatar name={selected.name} size={52} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
                  {selected.name}
                </span>
                <span className="truncate font-body-sm text-body-sm text-on-surface-variant">
                  {selected.email}
                </span>
              </div>
              <Badge tone={ROLE_TONES[selected.role]} className="ml-auto">
                {ROLE_LABELS[selected.role]}
              </Badge>
            </div>

            {selected.role === 'owner' ? (
              <div className="flex items-start gap-space-sm rounded-xl bg-status-info-bg p-space-md">
                <Icon name="info" size={17} className="mt-0.5 shrink-0 text-status-info" />
                <span className="font-body-sm text-body-sm text-on-surface">
                  The organization owner always keeps full tenant access. Transfer ownership from Settings
                  before removing them.
                </span>
              </div>
            ) : (
              <Field label="Role" hint="Changing a role takes effect on that person's next page load">
                <Select
                  value={selected.role}
                  onChange={async (e) => {
                    const role = e.target.value as Role
                    await api.updateMembershipRole(selected.membershipId ?? '', selected.membershipId, role)
                    setSelected({ ...selected, role })
                    toast.success(`${selected.name} is now ${ROLE_LABELS[role]}`)
                  }}
                  options={ASSIGNABLE.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                />
              </Field>
            )}

            <div className="flex flex-col gap-space-sm">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Shift
              </span>
              <Select
                value={selected.shift}
                onChange={(e) => setSelected({ ...selected, shift: e.target.value })}
                options={[
                  'Morning (08:00 – 16:00)',
                  'Evening (16:00 – 00:00)',
                  'Full day',
                  'Weekends only',
                ].map((s) => ({ value: s, label: s }))}
              />
            </div>

            <div className="flex flex-col gap-space-sm">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Can access
              </span>
              <div className="flex flex-wrap gap-space-xs">
                {(ROLE_CAPABILITIES[selected.role] ?? []).includes('*')
                  ? Object.values(CAPABILITY_LABELS).map((label) => (
                      <Badge key={label} tone="success" icon="check">
                        {label}
                      </Badge>
                    ))
                  : (ROLE_CAPABILITIES[selected.role] ?? []).map((cap) => (
                      <Badge key={cap} tone="neutral">
                        {CAPABILITY_LABELS[cap] ?? cap}
                      </Badge>
                    ))}
              </div>
            </div>

            <div className="flex flex-col gap-space-sm">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Account
              </span>
              <div className="flex flex-col gap-space-xs rounded-xl bg-surface-container-low p-space-md">
                <span className="flex items-center justify-between font-body-sm text-body-sm">
                  <span className="text-on-surface-variant">Status</span>
                  <span className="font-semibold capitalize text-on-surface">{selected.status}</span>
                </span>
                <span className="flex items-center justify-between font-body-sm text-body-sm">
                  <span className="text-on-surface-variant">Invited</span>
                  <span className="font-semibold text-on-surface">{formatDate(selected.invitedAt)}</span>
                </span>
                <span className="flex items-center justify-between font-body-sm text-body-sm">
                  <span className="text-on-surface-variant">Last active</span>
                  <span className="font-semibold text-on-surface">
                    {selected.lastActiveAt ? relativeTime(selected.lastActiveAt) : 'Never'}
                  </span>
                </span>
              </div>
            </div>

            <Switch
              checked={selected.status === 'active'}
              onChange={(v) => {
                setSelected({ ...selected, status: v ? 'active' : 'suspended' })
                toast.info(v ? 'Access enabled' : 'Access suspended', 'Prototype does not persist this yet.')
              }}
              label="Account active"
              description="Suspended members cannot sign in until re-enabled."
            />
          </div>
        )}
      </Drawer>

      {/* ---------------------------------------------------------- invite modal */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a team member"
        description="They receive a sign-in link and see only the screens their role allows."
        icon="person_add"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!invite.email.trim()}
              onClick={async () => {
                await api.inviteEmployee({
                  organizationId: organization!.id,
                  email: invite.email.trim(),
                  name: invite.name.trim() || invite.email.split('@')[0],
                  role: invite.role,
                })
                toast.success(`Invite sent to ${invite.email}`, 'They appear as Invited until they accept.')
                setInvite({ name: '', email: '', role: 'waiter' })
                setInviteOpen(false)
              }}
            >
              Send invite
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-space-lg">
          <Field label="Full name">
            <Input
              icon="person"
              value={invite.name}
              onChange={(e) => setInvite((p) => ({ ...p, name: e.target.value }))}
              placeholder="Rahul Mehta"
            />
          </Field>
          <Field label="Work email" required>
            <Input
              icon="mail"
              type="email"
              value={invite.email}
              onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))}
              placeholder="rahul@restaurant.com"
            />
          </Field>
          <Field label="Role" hint="Determines which screens they can open">
            <Select
              value={invite.role}
              onChange={(e) => setInvite((p) => ({ ...p, role: e.target.value as Role }))}
              options={ASSIGNABLE.filter((r) => r !== 'owner').map((r) => ({
                value: r,
                label: `${ROLE_LABELS[r]} — ${
                  ROLE_CAPABILITIES[r].includes('*')
                    ? 'full access'
                    : ROLE_CAPABILITIES[r].map((c) => CAPABILITY_LABELS[c] ?? c).join(', ') || 'no access'
                }`,
              }))}
            />
          </Field>
          <div className="flex flex-wrap gap-space-xs rounded-xl bg-surface-container-low p-space-md">
            <span className="w-full font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {ROLE_LABELS[invite.role]} can reach
            </span>
            {ROLE_CAPABILITIES[invite.role].map((cap) => (
              <Badge key={cap} tone={cn(cap === '*' && 'success') as 'success' | 'neutral'}>
                {cap === '*' ? 'Everything' : CAPABILITY_LABELS[cap] ?? cap}
              </Badge>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (!removeTarget) return
          await api.removeMembership(removeTarget.membershipId ?? '', removeTarget.membershipId)
          toast.success(`${removeTarget.name} removed from the team`)
          setRemoveTarget(null)
          setSelected(null)
        }}
        title="Remove this team member?"
        message={
          <>
            <strong>{removeTarget?.name}</strong> loses access to {organization?.name} immediately. Their
            historical orders and audit entries are preserved.
          </>
        }
        confirmLabel="Remove member"
        destructive
      />
    </div>
  )
}
