import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Divider,
  Field,
  Icon,
  Input,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  useToast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { resetDemoData } from '@/data/api'
import { CURRENCIES, DEMO_MODE_NOTE, LANGUAGES, TIMEZONES } from '@/lib/constants'
import { BUSINESS_TYPE_LABELS, ROLE_CAPABILITIES, ROLE_LABELS, type BusinessType } from '@/lib/types'
import { slugify } from '@/lib/format'

type Section =
  | 'profile'
  | 'business'
  | 'notifications'
  | 'roles'
  | 'integrations'
  | 'security'
  | 'danger'

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'profile', label: 'Restaurant profile', icon: 'storefront' },
  { id: 'business', label: 'Business & tax', icon: 'receipt_long' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'roles', label: 'Roles & permissions', icon: 'admin_panel_settings' },
  { id: 'integrations', label: 'Integrations', icon: 'extension' },
  { id: 'security', label: 'Security', icon: 'shield' },
  { id: 'danger', label: 'Danger zone', icon: 'warning' },
]

export function SettingsPage() {
  const { organization, session, role, mode, notifications } = useAppStore()
  const toast = useToast()
  const [section, setSection] = useState<Section>('profile')
  const [saving, setSaving] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const [profile, setProfile] = useState({
    name: organization?.name ?? '',
    slug: organization?.slug ?? '',
    businessType: (organization?.businessType ?? 'restaurant') as BusinessType,
    gstNumber: organization?.gstNumber ?? '',
    address: organization?.branding.address ?? '',
    phone: organization?.branding.phone ?? '',
  })

  const [tax, setTax] = useState({
    currency: organization?.currency ?? 'INR',
    language: organization?.language ?? 'en-IN',
    timezone: organization?.timezone ?? 'Asia/Kolkata',
    taxPercent: organization?.branding.taxPercent ?? 5,
    serviceChargePercent: organization?.branding.serviceChargePercent ?? 0,
    pricesIncludeTax: false,
  })

  const [prefs, setPrefs] = useState({
    newOrders: true,
    serviceRequests: true,
    reservations: true,
    lowStock: true,
    dailyDigest: true,
    subscriptionAlerts: true,
    soundAlerts: false,
  })

  useEffect(() => {
    if (!organization) return
    setProfile({
      name: organization.name,
      slug: organization.slug,
      businessType: organization.businessType,
      gstNumber: organization.gstNumber,
      address: organization.branding.address,
      phone: organization.branding.phone,
    })
    setTax({
      currency: organization.currency,
      language: organization.language,
      timezone: organization.timezone,
      taxPercent: organization.branding.taxPercent,
      serviceChargePercent: organization.branding.serviceChargePercent,
      pricesIncludeTax: false,
    })
  }, [organization])

  if (!organization) return null

  const canEdit = role === 'owner' || role === 'super_admin'

  const saveProfile = async () => {
    setSaving(true)
    await api.updateOrganization(organization.id, {
      name: profile.name,
      slug: slugify(profile.slug),
      businessType: profile.businessType,
      gstNumber: profile.gstNumber,
    })
    await api.updateBranding(organization.id, {
      ...organization.branding,
      address: profile.address,
      phone: profile.phone,
    })
    setSaving(false)
    toast.success('Restaurant profile updated')
  }

  const saveTax = async () => {
    setSaving(true)
    await api.updateOrganization(organization.id, {
      currency: tax.currency,
      language: tax.language,
      timezone: tax.timezone,
    })
    await api.updateBranding(organization.id, {
      ...organization.branding,
      currency: tax.currency,
      taxPercent: tax.taxPercent,
      serviceChargePercent: tax.serviceChargePercent,
    })
    setSaving(false)
    toast.success('Business settings saved')
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-0.5">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">Settings</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {organization.name} · {BUSINESS_TYPE_LABELS[organization.businessType]} · {organization.id}
        </p>
      </header>

      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:items-start">
        {/* ------------------------------------------------------ section nav */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-col p-space-xs">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  'flex items-center gap-space-sm rounded-lg px-space-md py-space-sm text-left font-body-sm text-body-sm transition-colors',
                  section === s.id
                    ? 'bg-primary-container text-on-primary-container font-bold'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
                  s.id === 'danger' && section !== 'danger' && 'text-status-critical',
                )}
              >
                <Icon name={s.icon} size={17} />
                {s.label}
              </button>
            ))}
          </div>
        </Card>

        {/* -------------------------------------------------------- sections */}
        <div className="flex flex-col gap-space-lg">
          {section === 'profile' && (
            <Card className="flex flex-col gap-space-lg">
              <CardHeader icon="storefront" title="Restaurant profile" subtitle="Shown on receipts and the guest menu" />
              <div className="grid gap-space-lg sm:grid-cols-2">
                <Field label="Restaurant name" required>
                  <Input
                    icon="storefront"
                    value={profile.name}
                    onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Guest link" hint={`/r/${profile.slug}`}>
                  <Input
                    icon="link"
                    value={profile.slug}
                    onChange={(e) => setProfile((p) => ({ ...p, slug: slugify(e.target.value) }))}
                    disabled={!canEdit}
                  />
                </Field>
              </div>
              <Field label="Business type">
                <Select
                  value={profile.businessType}
                  onChange={(e) => setProfile((p) => ({ ...p, businessType: e.target.value as BusinessType }))}
                  disabled={!canEdit}
                  options={Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                />
              </Field>
              <Field label="Address">
                <Textarea
                  rows={2}
                  value={profile.address}
                  onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                  disabled={!canEdit}
                />
              </Field>
              <div className="grid gap-space-lg sm:grid-cols-2">
                <Field label="Contact phone">
                  <Input
                    icon="call"
                    value={profile.phone}
                    onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="GSTIN">
                  <Input
                    icon="receipt_long"
                    value={profile.gstNumber}
                    onChange={(e) => setProfile((p) => ({ ...p, gstNumber: e.target.value.toUpperCase() }))}
                    disabled={!canEdit}
                  />
                </Field>
              </div>
              <Button icon="save" loading={saving} disabled={!canEdit} onClick={() => void saveProfile()}>
                Save profile
              </Button>
            </Card>
          )}

          {section === 'business' && (
            <Card className="flex flex-col gap-space-lg">
              <CardHeader icon="receipt_long" title="Business & tax" subtitle="Currency, locale and tax behaviour for billing" />
              <div className="grid gap-space-lg sm:grid-cols-2">
                <Field label="Currency">
                  <Select
                    value={tax.currency}
                    onChange={(e) => setTax((p) => ({ ...p, currency: e.target.value }))}
                    options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Language">
                  <Select
                    value={tax.language}
                    onChange={(e) => setTax((p) => ({ ...p, language: e.target.value }))}
                    options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Timezone">
                  <Select
                    value={tax.timezone}
                    onChange={(e) => setTax((p) => ({ ...p, timezone: e.target.value }))}
                    options={TIMEZONES.map((t) => ({ value: t.code, label: t.label }))}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Tax rate %">
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={tax.taxPercent}
                    onChange={(e) => setTax((p) => ({ ...p, taxPercent: Number(e.target.value) }))}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Service charge %" hint="Set to 0 to disable">
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={tax.serviceChargePercent}
                    onChange={(e) => setTax((p) => ({ ...p, serviceChargePercent: Number(e.target.value) }))}
                    disabled={!canEdit}
                  />
                </Field>
              </div>
              <Switch
                checked={tax.pricesIncludeTax}
                onChange={(v) => setTax((p) => ({ ...p, pricesIncludeTax: v }))}
                label="Menu prices include tax"
                description="When on, the guest sees inclusive pricing instead of a separate tax line."
              />
              <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                <Icon name="calculate" size={17} className="mt-0.5 shrink-0 text-primary" />
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  A bill of ₹1,000 will show ₹{tax.taxPercent * 10} tax and ₹
                  {tax.serviceChargePercent * 10} service charge, total ₹
                  {1000 + tax.taxPercent * 10 + tax.serviceChargePercent * 10}.
                </span>
              </div>
              <Button icon="save" loading={saving} disabled={!canEdit} onClick={() => void saveTax()}>
                Save business settings
              </Button>
            </Card>
          )}

          {section === 'notifications' && (
            <Card className="flex flex-col gap-space-lg">
              <CardHeader icon="notifications" title="Notifications" subtitle="Choose what reaches your team" />
              <div className="flex flex-col gap-space-md">
                <Switch
                  checked={prefs.newOrders}
                  onChange={(v) => setPrefs((p) => ({ ...p, newOrders: v }))}
                  label="New orders"
                  description="Alert when a QR order is placed"
                />
                <Switch
                  checked={prefs.serviceRequests}
                  onChange={(v) => setPrefs((p) => ({ ...p, serviceRequests: v }))}
                  label="Service requests"
                  description="Guest pressed the help button"
                />
                <Switch
                  checked={prefs.reservations}
                  onChange={(v) => setPrefs((p) => ({ ...p, reservations: v }))}
                  label="Reservation updates"
                  description="New, changed or cancelled bookings"
                />
                <Switch
                  checked={prefs.lowStock}
                  onChange={(v) => setPrefs((p) => ({ ...p, lowStock: v }))}
                  label="Low inventory"
                  description="Ingredient dropped below its threshold"
                />
                <Switch
                  checked={prefs.dailyDigest}
                  onChange={(v) => setPrefs((p) => ({ ...p, dailyDigest: v }))}
                  label="Daily analytics digest"
                  description="Morning summary of yesterday's trade"
                />
                <Switch
                  checked={prefs.subscriptionAlerts}
                  onChange={(v) => setPrefs((p) => ({ ...p, subscriptionAlerts: v }))}
                  label="Subscription warnings"
                  description="Renewal, trial ending and limit notices"
                />
                <Switch
                  checked={prefs.soundAlerts}
                  onChange={(v) => setPrefs((p) => ({ ...p, soundAlerts: v }))}
                  label="Sound alerts on KDS"
                  description="Audible chime when a new ticket lands"
                />
              </div>

              <Divider />

              <div className="flex flex-col gap-space-sm">
                <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Recent notifications ({notifications.length})
                </span>
                <div className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                  {notifications.slice(0, 5).map((n) => (
                    <div key={n.id} className="flex items-start gap-space-sm p-space-md">
                      <Icon name="notifications" size={16} className="mt-0.5 shrink-0 text-primary" />
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm font-semibold text-on-surface">{n.title}</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">{n.body}</span>
                      </div>
                      {!n.read && <Badge tone="brand" className="ml-auto">New</Badge>}
                    </div>
                  ))}
                  {!notifications.length && (
                    <p className="p-space-md font-body-sm text-body-sm text-on-surface-variant">
                      No notifications yet.
                    </p>
                  )}
                </div>
              </div>

              <Button
                icon="save"
                onClick={() => toast.success('Notification preferences saved', 'Prototype stores these locally.')}
                disabled={!canEdit}
              >
                Save preferences
              </Button>
            </Card>
          )}

          {section === 'roles' && (
            <Card className="flex flex-col gap-space-lg">
              <CardHeader
                icon="admin_panel_settings"
                title="Roles & permissions"
                subtitle="What each role can reach. Enforced server-side, not just hidden in the UI."
              />
              <div className="scroll-slim overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-space-lg py-space-sm text-left font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-500">
                        Role
                      </th>
                      <th className="px-space-lg py-space-sm text-left font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-500">
                        Accessible screens
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(ROLE_CAPABILITIES).map(([r, caps]) => (
                      <tr key={r} className="border-b border-slate-200/70">
                        <td className="px-space-lg py-space-md">
                          <Badge tone={r === 'owner' || r === 'super_admin' ? 'brand' : 'neutral'}>
                            {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                          </Badge>
                        </td>
                        <td className="px-space-lg py-space-md">
                          {caps.includes('*') ? (
                            <span className="font-body-sm text-body-sm font-semibold text-status-success">
                              Full tenant access
                            </span>
                          ) : caps.length === 0 ? (
                            <span className="font-body-sm text-body-sm text-on-surface-variant">
                              No operator screens
                            </span>
                          ) : (
                            <span className="flex flex-wrap gap-space-xs">
                              {caps.map((c) => (
                                <span
                                  key={c}
                                  className="rounded bg-surface-container-low px-space-sm py-0.5 font-label-xs text-label-xs capitalize text-on-surface-variant"
                                >
                                  {c}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-start gap-space-sm rounded-xl bg-status-info-bg p-space-md">
                <Icon name="shield" size={17} className="mt-0.5 shrink-0 text-status-info" />
                <span className="font-body-sm text-body-sm text-on-surface">
                  Manage individual team members from Staff &amp; Roles. Client-side role checks are a
                  convenience only — every request is re-verified on the server.
                </span>
              </div>
            </Card>
          )}

          {section === 'integrations' && (
            <Card className="flex flex-col gap-space-lg">
              <CardHeader icon="extension" title="Integrations" subtitle="Connect BiteFlow to the tools you already use" />
              <div className="grid gap-space-md sm:grid-cols-2">
                {[
                  { name: 'Supabase', description: 'Database, auth and realtime backend', icon: 'database', connected: mode === 'live', status: mode === 'live' ? 'Connected' : 'Not configured' },
                  { name: 'Razorpay', description: 'India-first payment gateway', icon: 'payments', connected: false, status: 'Simulated' },
                  { name: 'Stripe', description: 'International card payments', icon: 'credit_card', connected: false, status: 'Not connected' },
                  { name: 'WhatsApp Business', description: 'Order and reservation notifications', icon: 'chat', connected: false, status: 'Planned' },
                  { name: 'Zoho Books', description: 'Accounting sync per tenant', icon: 'account_balance', connected: false, status: 'Planned' },
                  { name: 'Google Business', description: 'Pull reviews and opening hours', icon: 'reviews', connected: false, status: 'Planned' },
                ].map((integration) => (
                  <div
                    key={integration.name}
                    className="flex items-start justify-between gap-space-md rounded-xl border border-slate-200 p-space-md"
                  >
                    <div className="flex items-start gap-space-md">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                        <Icon name={integration.icon} size={20} />
                      </span>
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md font-semibold text-on-surface">
                          {integration.name}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {integration.description}
                        </span>
                      </div>
                    </div>
                    <Badge tone={integration.connected ? 'success' : 'neutral'}>{integration.status}</Badge>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                <Icon name="api" size={17} className="mt-0.5 shrink-0 text-primary" />
                <span className="font-body-sm text-body-sm text-on-surface-variant">{DEMO_MODE_NOTE}</span>
              </div>
            </Card>
          )}

          {section === 'security' && (
            <Card className="flex flex-col gap-space-lg">
              <CardHeader icon="shield" title="Security" subtitle="Session, access and audit posture" />
              <div className="grid gap-space-md sm:grid-cols-2">
                {[
                  { label: 'Signed in as', value: session?.user.email ?? '—', icon: 'person' },
                  { label: 'Role on this tenant', value: ROLE_LABELS[role], icon: 'badge' },
                  { label: 'Backend', value: mode === 'live' ? 'Supabase (live)' : 'Demo dataset', icon: 'database' },
                  { label: 'Tenant isolation', value: 'Row-level security', icon: 'lock' },
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

              <div className="flex flex-col gap-space-sm">
                <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Enforced controls
                </span>
                <div className="grid gap-space-sm sm:grid-cols-2">
                  {[
                    'Server-side authorization on every mutation',
                    'Tenant isolation at the database layer',
                    'Granular RBAC per role',
                    'Input validation on all forms',
                    'Audit logging of privileged actions',
                    'Signed payment webhooks',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-space-sm">
                      <Icon name="check_circle" size={16} className="mt-0.5 shrink-0 text-status-success" />
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Divider />

              <div className="flex flex-wrap gap-space-sm">
                <Button variant="secondary" icon="password" onClick={() => toast.info('Password changes go through Supabase Auth')}>
                  Change password
                </Button>
                <Button variant="secondary" icon="devices" onClick={() => toast.info('Session management is post-MVP')}>
                  Active sessions
                </Button>
                <Button variant="secondary" icon="history" onClick={() => toast.info('View the full audit log under Platform admin → Audit')}>
                  Audit log
                </Button>
              </div>
            </Card>
          )}

          {section === 'danger' && (
            <Card className="flex flex-col gap-space-lg border-status-critical/30">
              <CardHeader
                icon="warning"
                title="Danger zone"
                subtitle="Irreversible actions — these affect live guest ordering"
              />
              <div className="flex flex-col gap-space-md">
                <div className="flex flex-wrap items-center justify-between gap-space-md rounded-xl border border-slate-200 p-space-md">
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      Pause guest ordering
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Stops new QR orders without touching your menu or tables. Existing bills stay open.
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    icon="pause_circle"
                    onClick={async () => {
                      await api.updateBranding(organization.id, { ...organization.branding, isOpen: false })
                      toast.success('Guest ordering paused')
                    }}
                  >
                    Pause ordering
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-space-md rounded-xl border border-slate-200 p-space-md">
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      Reset prototype data
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Restores the three seeded demo tenants and clears local changes. Demo mode only.
                    </span>
                  </div>
                  <Button variant="secondary" icon="restart_alt" disabled={mode === 'live'} onClick={() => setResetOpen(true)}>
                    Reset data
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-space-md rounded-xl border border-status-critical/30 bg-status-critical-bg p-space-md">
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md font-semibold text-on-surface">
                      Delete this restaurant
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Removes the tenant, menu, tables, orders and staff access permanently.
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    icon="delete_forever"
                    disabled={!canEdit}
                    onClick={() =>
                      toast.error(
                        'Tenant deletion is disabled in the prototype',
                        'Deleting a live tenant requires a confirmation flow and a cooling-off period.',
                      )
                    }
                  >
                    Delete tenant
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          await resetDemoData()
          setResetOpen(false)
          toast.success('Demo data reset', 'Three tenants restored with fresh demo orders.')
        }}
        title="Reset all prototype data?"
        message="Every local change — new tenants, menu edits, orders and branding — is discarded and the seed dataset is restored."
        confirmLabel="Reset everything"
        destructive
      />
    </div>
  )
}
