import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Divider,
  Drawer,
  EmptyState,
  Icon,
  Input,
  MetricCard,
  SegmentedControl,
  Select,
  Toolbar,
  useToast,
  type Column,
} from '@/components/ui'
import { useAppStore } from '@/store/AppStore'
import { ROLE_LABELS, type AuditLog, type Role } from '@/lib/types'
import { formatDateTime, formatNumber, relativeTime, titleCase } from '@/lib/format'

type Scope = 'all' | 'security' | 'billing' | 'operations' | 'catalog'

const CATEGORY_OF: Record<string, Scope> = {
  'tenant.created': 'security',
  'employee.invited': 'security',
  'employee.role_changed': 'security',
  'employee.removed': 'security',
  'organization.updated': 'security',
  'plan.changed': 'billing',
  'subscription.cancelled': 'billing',
  'order.created': 'operations',
  'order.status_changed': 'operations',
  'order.paid': 'operations',
  'table.status_changed': 'operations',
  'table.qr_regenerated': 'operations',
  'reservation.status_changed': 'operations',
  'menu.item_created': 'catalog',
  'menu.item_updated': 'catalog',
  'menu.item_deleted': 'catalog',
  'menu.imported': 'catalog',
  'branding.updated': 'catalog',
}

const PRIVILEGED: Role[] = ['super_admin', 'owner', 'manager']

const SCOPE_TONE: Record<Scope, 'neutral' | 'critical' | 'warning' | 'info' | 'success'> = {
  all: 'neutral',
  security: 'critical',
  billing: 'warning',
  operations: 'success',
  catalog: 'info',
}

const categoryOf = (action: string): Scope => CATEGORY_OF[action] ?? 'operations'

export function AdminAudit() {
  const { db } = useAppStore()
  const toast = useToast()

  const [scope, setScope] = useState<Scope>('all')
  const [query, setQuery] = useState('')
  const [tenantFilter, setTenantFilter] = useState<'all' | string>('all')
  const [selected, setSelected] = useState<AuditLog | null>(null)

  const tenantName = (organizationId: string | null) =>
    db.organizations.find((o) => o.id === organizationId)?.name ?? 'Platform'

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.auditLogs
      .filter((log) => (scope === 'all' ? true : categoryOf(log.action) === scope))
      .filter((log) => (tenantFilter === 'all' ? true : (log.organizationId ?? 'platform') === tenantFilter))
      .filter((log) =>
        q.length < 2
          ? true
          : log.summary.toLowerCase().includes(q) ||
            log.actorName.toLowerCase().includes(q) ||
            log.action.toLowerCase().includes(q),
      )
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  }, [db.auditLogs, scope, tenantFilter, query])

  const counts = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const today = db.auditLogs.filter((l) => new Date(l.createdAt).getTime() >= dayAgo)
    return {
      all: db.auditLogs.length,
      security: db.auditLogs.filter((l) => categoryOf(l.action) === 'security').length,
      billing: db.auditLogs.filter((l) => categoryOf(l.action) === 'billing').length,
      operations: db.auditLogs.filter((l) => categoryOf(l.action) === 'operations').length,
      catalog: db.auditLogs.filter((l) => categoryOf(l.action) === 'catalog').length,
      today: today.length,
      privileged: today.filter((l) => PRIVILEGED.includes(l.actorRole)).length,
      actors: new Set(today.map((l) => l.actorId)).size,
    }
  }, [db.auditLogs])

  const columns: Column<AuditLog>[] = [
    {
      key: 'time',
      header: 'When',
      sortValue: (l) => l.createdAt,
      render: (l) => (
        <div className="flex flex-col">
          <span className="font-label-sm text-label-sm font-semibold text-on-surface">
            {relativeTime(l.createdAt)}
          </span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            {formatDateTime(l.createdAt)}
          </span>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      sortValue: (l) => l.actorName,
      render: (l) => (
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-semibold text-on-surface">{l.actorName}</span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            {ROLE_LABELS[l.actorRole] ?? titleCase(l.actorRole)}
          </span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Event',
      sortValue: (l) => l.action,
      render: (l) => (
        <div className="flex flex-col gap-1">
          <span className="font-body-sm text-body-sm text-on-surface">{l.summary}</span>
          <span className="flex items-center gap-space-xs">
            <code className="rounded bg-surface-container-low px-1.5 py-0.5 font-mono text-[11px] text-on-surface-variant">
              {l.action}
            </code>
            <Badge tone={SCOPE_TONE[categoryOf(l.action)]}>{categoryOf(l.action)}</Badge>
          </span>
        </div>
      ),
    },
    {
      key: 'tenant',
      header: 'Tenant',
      sortValue: (l) => tenantName(l.organizationId),
      render: (l) => (
        <span className="font-body-sm text-body-sm text-on-surface-variant">{tenantName(l.organizationId)}</span>
      ),
      hideBelow: 'md' as const,
    },
    {
      key: 'ip',
      header: 'IP',
      render: (l) => (
        <span className="font-mono text-[11px] text-on-surface-variant">{l.ipAddress || '—'}</span>
      ),
      hideBelow: 'lg' as const,
    },
    {
      key: 'detail',
      header: '',
      align: 'right',
      render: (l) => (
        <Button size="sm" variant="ghost" icon="chevron_right" onClick={() => setSelected(l)}>
          Inspect
        </Button>
      ),
      sticky: true,
    },
  ]

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Audit Log</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Immutable, append-only record of every privileged action — prd.md §27
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Badge tone="success" dot>
            Retention 24 months
          </Badge>
          <Button variant="secondary" icon="download" onClick={() => toast.info('CSV export is queued (prototype)')}>
            Export CSV
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Events (24h)" value={formatNumber(counts.today)} icon="history" />
        <MetricCard
          label="Privileged actions"
          value={formatNumber(counts.privileged)}
          icon="admin_panel_settings"
          hint={`${counts.actors} distinct actors`}
          tone="warning"
        />
        <MetricCard
          label="Security events"
          value={formatNumber(counts.security)}
          icon="shield"
          hint="Tenant, role and staff changes"
          tone="info"
        />
        <MetricCard
          label="Billing events"
          value={formatNumber(counts.billing)}
          icon="receipt_long"
          hint="Plan changes and cancellations"
          tone="neutral"
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-space-md border-b border-slate-200 p-space-lg xl:flex-row xl:items-center xl:justify-between">
          <SegmentedControl
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'security', label: 'Security', count: counts.security },
              { value: 'billing', label: 'Billing', count: counts.billing },
              { value: 'operations', label: 'Operations', count: counts.operations },
              { value: 'catalog', label: 'Catalog', count: counts.catalog },
            ]}
          />
          <Toolbar>
            <Input
              icon="search"
              placeholder="Search summary, actor or event…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-72"
            />
            <Select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All tenants' },
                { value: 'platform', label: 'Platform' },
                ...db.organizations.map((o) => ({ value: o.id, label: o.name })),
              ]}
              className="sm:w-48"
            />
          </Toolbar>
        </div>

        <DataTable
          columns={columns}
          rows={scoped}
          rowKey={(l) => l.id}
          onRowClick={setSelected}
          empty={
            <div className="p-space-lg">
              <EmptyState
                icon="policy"
                title="No audit events match"
                description="Widen the category, tenant or search term to see more history."
              />
            </div>
          }
        />
      </Card>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width="md"
        title="Audit event"
        subtitle={selected ? `${selected.action} · ${relativeTime(selected.createdAt)}` : ''}
      >
        {selected && (
          <div className="flex flex-col gap-space-lg p-space-xl">
            <div className="flex flex-wrap items-center gap-space-sm">
              <Badge tone={SCOPE_TONE[categoryOf(selected.action)]}>{categoryOf(selected.action)}</Badge>
              <Badge tone="neutral" icon="schedule">
                {formatDateTime(selected.createdAt)}
              </Badge>
            </div>

            <p className="font-body-md text-body-md text-on-surface">{selected.summary}</p>

            <Divider />

            <dl className="flex flex-col gap-space-sm">
              {[
                { term: 'Event key', detail: selected.action },
                { term: 'Actor', detail: `${selected.actorName} (${ROLE_LABELS[selected.actorRole] ?? selected.actorRole})` },
                { term: 'Actor ID', detail: selected.actorId ?? '—' },
                { term: 'Tenant', detail: tenantName(selected.organizationId) },
                { term: 'Entity', detail: `${selected.entityType} · ${selected.entityId ?? 'n/a'}` },
                { term: 'Source IP', detail: selected.ipAddress || '—' },
              ].map((row) => (
                <div key={row.term} className="flex items-start justify-between gap-space-md">
                  <dt className="font-label-sm text-label-sm text-on-surface-variant">{row.term}</dt>
                  <dd className="text-right font-mono text-[12px] text-on-surface">{row.detail}</dd>
                </div>
              ))}
            </dl>

            <Divider />

            <div className="flex flex-col gap-space-sm">
              <h3 className="font-headline-sm text-headline-sm">Payload</h3>
              <pre className="scroll-slim overflow-x-auto rounded-xl bg-slate-950 p-space-md font-mono text-[12px] leading-relaxed text-slate-100">
{JSON.stringify(
  {
    id: selected.id,
    action: selected.action,
    entity: { type: selected.entityType, id: selected.entityId },
    organization_id: selected.organizationId,
    actor: { id: selected.actorId, role: selected.actorRole, name: selected.actorName },
    ip_address: selected.ipAddress,
    created_at: selected.createdAt,
  },
  null,
  2,
)}
              </pre>
              <span className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant">
                <Icon name="lock" size={13} />
                Hash-chained and tamper-evident; entries can never be edited or deleted.
              </span>
            </div>
          </div>
        )}
      </Drawer>

      <Card>
        <CardHeader
          title="Governance policy"
          subtitle="How BiteFlow protects platform and tenant data"
          icon="verified_user"
        />
        <div className="grid grid-cols-1 gap-space-md pt-space-md sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: 'key', title: 'Scoped access', body: 'Every query runs through RLS keyed on the active tenant.' },
            { icon: 'history', title: 'Append-only', body: 'Audit rows are insert-only; no UPDATE or DELETE grant exists.' },
            { icon: 'schedule', title: '24-month retention', body: 'Cold storage after 90 days, searchable through the API.' },
            { icon: 'notifications', title: 'Anomaly alerts', body: 'Privileged bursts and repeated failures page the on-call admin.' },
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-space-xs rounded-xl bg-surface-container-low p-space-md">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-lowest text-primary">
                <Icon name={item.icon} size={18} />
              </span>
              <span className="font-label-md text-label-md font-semibold text-on-surface">{item.title}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{item.body}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
