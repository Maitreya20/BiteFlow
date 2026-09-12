import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Icon,
  SearchInput,
  SegmentedControl,
  Select,
  Switch,
  useToast,
} from '@/components/ui'
import { QrCode } from '@/components/QrCode'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { siteOrigin } from '@/lib/supabase'
import type { RestaurantTable } from '@/lib/types'

type Mode = 'single' | 'bulk'

export function QrGeneratorPage() {
  const { tables, organization } = useAppStore()
  const toast = useToast()

  const [mode, setMode] = useState<Mode>('single')
  const [selectedId, setSelectedId] = useState<string>(tables[0]?.id ?? '')
  const [bulkIds, setBulkIds] = useState<string[]>(tables.map((t) => t.id))
  const [query, setQuery] = useState('')
  const [size, setSize] = useState<'medium' | 'large'>('medium')
  const [showBranding, setShowBranding] = useState(true)
  const [showTableNumber, setShowTableNumber] = useState(true)
  const [withZone, setWithZone] = useState(true)
  const [regenerateTarget, setRegenerateTarget] = useState<RestaurantTable | null>(null)

  const org = organization
  const slug = org?.slug ?? ''

  const guestUrl = (table: RestaurantTable) =>
    `${siteOrigin()}/r/${slug}/table/${table.tableNumber.toLowerCase()}`

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tables
    return tables.filter(
      (t) => t.tableNumber.toLowerCase().includes(q) || t.zone.toLowerCase().includes(q),
    )
  }, [tables, query])

  const selected = tables.find((t) => t.id === selectedId) ?? tables[0] ?? null
  const bulkSelection = tables.filter((t) => bulkIds.includes(t.id))

  const copy = (table: RestaurantTable) => {
    void navigator.clipboard?.writeText(guestUrl(table))
    toast.success(`Link copied for ${table.tableNumber}`, guestUrl(table))
  }

  const download = (table: RestaurantTable) => {
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&margin=2&data=${encodeURIComponent(guestUrl(table))}`
    const link = document.createElement('a')
    link.href = src
    link.download = `${slug}-${table.tableNumber}-qr.png`
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Downloading ${table.tableNumber} QR`, 'High-resolution PNG at 1200px.')
  }

  const print = () => toast.info('Print dialog coming up', 'Use your browser print dialog to save as PDF.')

  if (!tables.length) {
    return (
      <EmptyState
        icon="qr_code_2"
        title="No tables to generate codes for"
        description="Add at least one table before generating QR codes."
        action={
          <Link to="/app/tables">
            <Button icon="add">Add tables</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
              Table QR Codes
            </h1>
            <Badge tone="brand" icon="qr_code_2">
              {tables.length} codes
            </Badge>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Each code points at <code className="rounded bg-surface-container-low px-1">/r/{slug}/table/&lt;table&gt;</code>{' '}
            and opens the guest menu with the table attached.
          </p>
        </div>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: 'single', label: 'Single', icon: 'qr_code' },
            { value: 'bulk', label: 'Bulk sheet', icon: 'print' },
          ]}
        />
      </header>

      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
        {/* --------------------------------------------------------- controls */}
        <div className="flex flex-col gap-space-lg">
          <Card className="flex flex-col gap-space-md">
            <span className="font-headline-sm text-headline-sm text-on-surface">Appearance</span>
            <Switch checked={showBranding} onChange={setShowBranding} label="Show restaurant branding" description="Logo, name and tagline on the printed card." />
            <Switch checked={showTableNumber} onChange={setShowTableNumber} label="Show table number" description="Large table label under the code." />
            <Switch checked={withZone} onChange={setWithZone} label="Include zone" description="Helps staff sort the printed sheet by area." />
            <Select
              label="Code size"
              value={size}
              onChange={(e) => setSize(e.target.value as typeof size)}
              options={[
                { value: 'medium', label: 'Medium — table tent (60mm)' },
                { value: 'large', label: 'Large — wall poster (120mm)' },
              ]}
            />
          </Card>

          <Card className="flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                {mode === 'single' ? 'Select a table' : 'Select tables'}
              </span>
              {mode === 'bulk' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setBulkIds(bulkIds.length === tables.length ? [] : tables.map((t) => t.id))
                  }
                >
                  {bulkIds.length === tables.length ? 'Clear all' : 'Select all'}
                </Button>
              )}
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder="Find a table or zone" />
            <div className="scroll-slim flex max-h-80 flex-col gap-space-2xs overflow-y-auto">
              {filtered.map((table) => {
                const active = mode === 'single' ? table.id === selected?.id : bulkIds.includes(table.id)
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() =>
                      mode === 'single'
                        ? setSelectedId(table.id)
                        : setBulkIds((prev) =>
                            prev.includes(table.id) ? prev.filter((id) => id !== table.id) : [...prev, table.id],
                          )
                    }
                    className={cn(
                      'flex items-center justify-between gap-space-sm rounded-lg border px-space-md py-space-sm text-left transition-colors',
                      active ? 'border-primary bg-ember-50' : 'border-slate-200 hover:bg-surface-container-low',
                    )}
                  >
                    <span className="flex items-center gap-space-sm">
                      {mode === 'bulk' && <Checkbox checked={active} onChange={() => {}} label="" />}
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        {table.tableNumber}
                      </span>
                      {withZone && (
                        <span className="font-label-xs text-label-xs text-on-surface-variant">
                          {table.zone}
                        </span>
                      )}
                    </span>
                    <span className="font-label-xs text-label-xs text-on-surface-variant">
                      {table.capacity} seats
                    </span>
                  </button>
                )
              })}
              {!filtered.length && (
                <p className="py-space-md text-center font-body-sm text-body-sm text-on-surface-variant">
                  No tables match “{query}”.
                </p>
              )}
            </div>
          </Card>

          <Card className="flex flex-col gap-space-sm">
            <span className="font-headline-sm text-headline-sm text-on-surface">Bulk actions</span>
            <Button
              variant="secondary"
              block
              icon="download"
              disabled={!bulkSelection.length}
              onClick={() => {
                bulkSelection.forEach((t, i) => setTimeout(() => download(t), i * 350))
                toast.success(`Preparing ${bulkSelection.length} downloads`)
              }}
            >
              Download selected ({bulkSelection.length})
            </Button>
            <Button variant="secondary" block icon="print" disabled={!bulkSelection.length} onClick={print}>
              Print printable sheet
            </Button>
            <Button
              variant="secondary"
              block
              icon="content_copy"
              disabled={!bulkSelection.length}
              onClick={() => {
                void navigator.clipboard?.writeText(
                  bulkSelection.map((t) => `${t.tableNumber}\t${guestUrl(t)}`).join('\n'),
                )
                toast.success('Table links copied', 'Paste into a spreadsheet or label printer.')
              }}
            >
              Copy all links
            </Button>
          </Card>
        </div>

        {/* ---------------------------------------------------------- preview */}
        <Card className="flex flex-col gap-space-lg">
          {mode === 'single' && selected ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Preview · {selected.tableNumber}
                </span>
                <div className="flex flex-wrap gap-space-xs">
                  <Button size="sm" variant="secondary" icon="content_copy" onClick={() => copy(selected)}>
                    Copy link
                  </Button>
                  <Button size="sm" variant="secondary" icon="download" onClick={() => download(selected)}>
                    Download
                  </Button>
                  <Button size="sm" variant="secondary" icon="print" onClick={print}>
                    Print
                  </Button>
                  <Button
                    size="sm"
                    variant="danger-ghost"
                    icon="refresh"
                    onClick={() => setRegenerateTarget(selected)}
                  >
                    Regenerate
                  </Button>
                </div>
              </div>

              <div className="flex flex-col items-center gap-space-lg rounded-2xl bg-surface-container-low p-space-xl">
                <QrCard
                  table={selected}
                  url={guestUrl(selected)}
                  restaurantName={org?.name ?? ''}
                  emoji={org?.branding.logoEmoji ?? '🍽️'}
                  primary={org?.branding.primaryColor ?? '#EA580C'}
                  size={size}
                  showBranding={showBranding}
                  showTableNumber={showTableNumber}
                  withZone={withZone}
                />
                <div className="flex flex-col items-center gap-space-xs text-center">
                  <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                    Destination URL
                  </span>
                  <code className="break-all rounded-lg bg-white px-space-md py-space-xs font-label-xs text-label-xs text-on-surface shadow-e1">
                    {guestUrl(selected)}
                  </code>
                </div>
              </div>

              <div className="grid gap-space-md sm:grid-cols-3">
                <StatRow label="QR token" value={selected.qrToken} />
                <StatRow label="Table" value={`${selected.tableNumber} · ${selected.zone}`} />
                <StatRow label="Capacity" value={`${selected.capacity} seats`} />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Printable sheet · {bulkSelection.length} codes
                </span>
                <Button size="sm" icon="print" onClick={print} disabled={!bulkSelection.length}>
                  Print sheet
                </Button>
              </div>

              {bulkSelection.length === 0 ? (
                <EmptyState icon="print" title="No tables selected" description="Pick tables on the left to build a print sheet." />
              ) : (
                <div className="print-sheet grid gap-space-md sm:grid-cols-2 xl:grid-cols-3">
                  {bulkSelection.map((table) => (
                    <QrCard
                      key={table.id}
                      table={table}
                      url={guestUrl(table)}
                      restaurantName={org?.name ?? ''}
                      emoji={org?.branding.logoEmoji ?? '🍽️'}
                      primary={org?.branding.primaryColor ?? '#EA580C'}
                      size="medium"
                      showBranding={showBranding}
                      showTableNumber={showTableNumber}
                      withZone={withZone}
                      compact
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(regenerateTarget)}
        onClose={() => setRegenerateTarget(null)}
        onConfirm={async () => {
          if (!regenerateTarget || !organization) return
          await api.regenerateQr(organization.id, regenerateTarget.id)
          setRegenerateTarget(null)
          toast.success('QR regenerated', 'The previous code still resolves — print a fresh copy when convenient.')
        }}
        title="Regenerate this QR code?"
        message={
          <>
            A new token is issued for <strong>{regenerateTarget?.tableNumber}</strong>. Previously
            printed codes keep working in the prototype, but you should reprint to stay current.
          </>
        }
        confirmLabel="Regenerate"
        destructive
      />
    </div>
  )
}

/* ------------------------------------------------------------------ card */

function QrCard({
  table,
  url,
  restaurantName,
  emoji,
  primary,
  size,
  showBranding,
  showTableNumber,
  withZone,
  compact,
}: {
  table: RestaurantTable
  url: string
  restaurantName: string
  emoji: string
  primary: string
  size: 'medium' | 'large'
  showBranding: boolean
  showTableNumber: boolean
  withZone: boolean
  compact?: boolean
}) {
  const px = size === 'large' ? 260 : compact ? 148 : 200

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-space-md rounded-2xl border border-slate-200 bg-white',
        compact ? 'p-space-md' : 'p-space-xl',
      )}
      style={{ borderTop: `4px solid ${primary}` }}
    >
      {showBranding && (
        <div className="flex flex-col items-center gap-space-xs text-center">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[20px]"
            style={{ background: `color-mix(in srgb, ${primary} 14%, white)` }}
          >
            {emoji}
          </span>
          <span className="font-headline-sm text-headline-sm font-bold text-slate-900">
            {restaurantName}
          </span>
        </div>
      )}

      <QrCode value={url} size={px} />

      {showTableNumber && (
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-label-xs text-label-xs font-bold uppercase tracking-[0.15em] text-slate-400">
            Table
          </span>
          <span
            className={cn('font-bold text-slate-900', compact ? 'text-headline-md' : 'text-headline-lg')}
          >
            {table.tableNumber}
          </span>
          {withZone && (
            <span className="font-label-xs text-label-xs text-slate-500">{table.zone} · {table.capacity} seats</span>
          )}
        </div>
      )}

      <span
        className="rounded-full px-space-md py-1 font-label-xs text-label-xs font-bold uppercase tracking-wider text-white"
        style={{ background: primary }}
      >
        Scan to Order
      </span>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface-container-low p-space-md">
      <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="truncate font-label-sm text-label-sm font-semibold text-on-surface">{value}</span>
    </div>
  )
}
