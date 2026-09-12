import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ColorSwatchPicker,
  ConfirmDialog,
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
import { GuestMenuPreview } from '@/components/GuestMenuPreview'
import { useAppStore } from '@/store/AppStore'
import * as api from '@/data/api'
import { BRAND_SWATCHES, applyBranding } from '@/store/theme'
import { FONT_OPTIONS } from '@/lib/constants'
import type { Branding } from '@/lib/types'

type PreviewSurface = 'menu' | 'item' | 'cart' | 'tracking'

const PRESETS: { name: string; description: string; branding: Partial<Branding> }[] = [
  {
    name: 'Ember cafe',
    description: 'Warm orange, soft corners — the BiteFlow default',
    branding: { primaryColor: '#EA580C', accentColor: '#F97316', secondaryColor: '#0F172A', fontFamily: 'Manrope', radiusScale: 'soft' },
  },
  {
    name: 'Brick tandoor',
    description: 'Deep red, sharp corners — for traditional kitchens',
    branding: { primaryColor: '#B91C1C', accentColor: '#F59E0B', secondaryColor: '#1C1917', fontFamily: 'Sora', radiusScale: 'sharp' },
  },
  {
    name: 'Garden bowls',
    description: 'Fresh green, round corners — light and modern',
    branding: { primaryColor: '#15803D', accentColor: '#84CC16', secondaryColor: '#14532D', fontFamily: 'DM Sans', radiusScale: 'round' },
  },
  {
    name: 'Midnight bar',
    description: 'Ink blue with a teal accent — evening service',
    branding: { primaryColor: '#1D4ED8', accentColor: '#0F766E', secondaryColor: '#0F172A', fontFamily: 'Inter', radiusScale: 'soft' },
  },
]

export function BrandingPage() {
  const { organization, menuItems, categories, role } = useAppStore()
  const toast = useToast()
  const [draft, setDraft] = useState<Branding | null>(organization?.branding ?? null)
  const [preview, setPreview] = useState<PreviewSurface>('menu')
  const [saving, setSaving] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    setDraft(organization?.branding ?? null)
  }, [organization?.branding])

  const canEdit = role === 'owner' || role === 'manager' || role === 'super_admin'

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(organization?.branding),
    [draft, organization?.branding],
  )

  const update = <K extends keyof Branding>(key: K, value: Branding[K]) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      // Preview the change on the console immediately, exactly as a guest would see it.
      applyBranding(next)
      return next
    })
  }

  if (!organisationExists(organization) || !draft) {
    return (
      <Card className="flex items-center gap-space-md">
        <Icon name="palette" size={20} className="text-on-surface-variant" />
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          Finish onboarding to configure branding.
        </span>
      </Card>
    )
  }

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...preset.branding }
      applyBranding(next)
      return next
    })
    toast.info(`${preset.name} preset applied`, 'Tweak the colours before saving.')
  }

  const save = async () => {
    setSaving(true)
    await api.updateBranding(organization!.id, draft)
    setSaving(false)
    toast.success('Branding saved', 'Guests see the new look on their next menu load.')
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
              Brand &amp; White-Label
            </h1>
            {dirty && <Badge tone="warning" dot>Unsaved changes</Badge>}
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            These settings shape the guest experience only — your operator console keeps the standard
            slate look.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Button variant="secondary" icon="restart_alt" disabled={!dirty} onClick={() => setResetOpen(true)}>
            Discard
          </Button>
          <Button icon="save" loading={saving} disabled={!dirty || !canEdit} onClick={() => void save()}>
            Save branding
          </Button>
        </div>
      </header>

      {!canEdit && (
        <Card className="flex items-center gap-space-md border-status-info/25 bg-status-info-bg">
          <Icon name="visibility" size={18} className="text-status-info" />
          <span className="font-body-sm text-body-sm text-on-surface">
            Your role can preview branding but not publish it. Ask an owner or manager to save changes.
          </span>
        </Card>
      )}

      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start">
        {/* ------------------------------------------------------------ editor */}
        <div className="flex flex-col gap-space-lg">
          <Card className="flex flex-col gap-space-md">
            <CardHeader
              icon="auto_awesome"
              title="Starting presets"
              subtitle="Jump to a look, then fine-tune below"
            />
            <div className="grid gap-space-sm sm:grid-cols-2">
              {PRESETS.map((preset) => {
                const active = draft.primaryColor.toLowerCase() === preset.branding.primaryColor?.toLowerCase()
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      'flex items-center gap-space-md rounded-xl border-[1.5px] p-space-md text-left transition-colors',
                      active ? 'border-primary bg-ember-50' : 'border-slate-200 hover:bg-surface-container-low',
                    )}
                  >
                    <span className="flex gap-0.5">
                      {[preset.branding.primaryColor, preset.branding.accentColor, preset.branding.secondaryColor].map(
                        (c, i) => (
                          <span
                            key={i}
                            className="h-8 w-4 rounded-sm first:rounded-l-lg last:rounded-r-lg"
                            style={{ background: c }}
                          />
                        ),
                      )}
                    </span>
                    <span className="flex flex-col">
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                        {preset.name}
                      </span>
                      <span className="font-label-xs text-label-xs text-on-surface-variant">
                        {preset.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="flex flex-col gap-space-lg">
            <CardHeader icon="image" title="Logo & identity" subtitle="Emoji mark for the prototype, or paste a logo URL" />
            <div className="flex flex-col gap-space-md">
              <div className="flex flex-wrap items-center gap-space-sm">
                {['🍽️', '☕', '🍛', '🥗', '🍕', '🍜', '🍰', '🍔', '🌮', '🥖', '🍣', '🥤'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => update('logoEmoji', emoji)}
                    aria-label={`Use ${emoji} as logo`}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl border-2 text-[22px] transition-transform hover:scale-105',
                      draft.logoEmoji === emoji ? 'border-primary' : 'border-slate-200',
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <Field label="Logo image URL" hint="Optional — overrides the emoji mark">
                <Input
                  icon="link"
                  placeholder="https://cdn.example.com/logo.png"
                  value={draft.logoUrl ?? ''}
                  onChange={(e) => update('logoUrl', e.target.value || null)}
                />
              </Field>
              <Field label="Tagline">
                <Input
                  icon="campaign"
                  value={draft.tagline}
                  onChange={(e) => update('tagline', e.target.value)}
                  placeholder="Specialty coffee & all-day brunch"
                />
              </Field>
            </div>
          </Card>

          <Card className="flex flex-col gap-space-lg">
            <CardHeader icon="palette" title="Colours" subtitle="Applied to buttons, chips, prices and the cart bar" />
            <ColorSwatchPicker
              label="Primary colour"
              value={draft.primaryColor}
              onChange={(v) => update('primaryColor', v)}
              swatches={BRAND_SWATCHES}
            />
            <ColorSwatchPicker
              label="Accent colour"
              value={draft.accentColor}
              onChange={(v) => update('accentColor', v)}
              swatches={BRAND_SWATCHES}
            />
            <ColorSwatchPicker
              label="Secondary colour"
              value={draft.secondaryColor}
              onChange={(v) => update('secondaryColor', v)}
              swatches={BRAND_SWATCHES}
            />
          </Card>

          <Card className="flex flex-col gap-space-lg">
            <CardHeader icon="text_fields" title="Typography & shape" subtitle="Font, corner radius, buttons and cards" />
            <div className="grid gap-space-lg sm:grid-cols-2">
              <Field label="Font family">
                <Select
                  value={draft.fontFamily}
                  onChange={(e) => update('fontFamily', e.target.value as Branding['fontFamily'])}
                  options={FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
                />
              </Field>
              <Field label="Corner radius">
                <Select
                  value={draft.radiusScale}
                  onChange={(e) => update('radiusScale', e.target.value as Branding['radiusScale'])}
                  options={[
                    { value: 'sharp', label: 'Sharp — editorial' },
                    { value: 'soft', label: 'Soft — balanced' },
                    { value: 'round', label: 'Round — friendly' },
                  ]}
                />
              </Field>
              <Field label="Button style">
                <Select
                  value={draft.buttonStyle}
                  onChange={(e) => update('buttonStyle', e.target.value as Branding['buttonStyle'])}
                  options={[
                    { value: 'solid', label: 'Solid fill' },
                    { value: 'outline', label: 'Outline' },
                    { value: 'pill', label: 'Pill' },
                  ]}
                />
              </Field>
              <Field label="Card style">
                <Select
                  value={draft.cardStyle}
                  onChange={(e) => update('cardStyle', e.target.value as Branding['cardStyle'])}
                  options={[
                    { value: 'elevated', label: 'Elevated with shadow' },
                    { value: 'flat', label: 'Flat tinted' },
                    { value: 'bordered', label: 'Outlined' },
                  ]}
                />
              </Field>
            </div>
            <div className="grid gap-space-lg sm:grid-cols-2">
              <Field label="Menu layout">
                <Select
                  value={draft.menuLayout}
                  onChange={(e) => update('menuLayout', e.target.value as Branding['menuLayout'])}
                  options={[
                    { value: 'grid', label: 'Grid — image led' },
                    { value: 'list', label: 'List — text led' },
                    { value: 'magazine', label: 'Magazine — editorial' },
                  ]}
                />
              </Field>
              <Field label="Rating shown to guests">
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={5}
                  value={draft.rating}
                  onChange={(e) => update('rating', Number(e.target.value))}
                />
              </Field>
            </div>
          </Card>

          <Card className="flex flex-col gap-space-lg">
            <CardHeader icon="campaign" title="Hero & storefront" subtitle="Copy and pricing shown on the guest menu" />
            <Field label="Hero headline">
              <Input
                icon="title"
                value={draft.heroHeadline}
                onChange={(e) => update('heroHeadline', e.target.value)}
                placeholder="Slow-roasted mornings, all day"
              />
            </Field>
            <Field label="Hero sub-copy">
              <Textarea
                rows={2}
                value={draft.heroSubcopy}
                onChange={(e) => update('heroSubcopy', e.target.value)}
                placeholder="Single-origin espresso, woodfired sourdough and all-day brunch."
              />
            </Field>
            <div className="grid gap-space-lg sm:grid-cols-3">
              <Field label="Tax %">
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={draft.taxPercent}
                  onChange={(e) => update('taxPercent', Number(e.target.value))}
                />
              </Field>
              <Field label="Service charge %">
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={draft.serviceChargePercent}
                  onChange={(e) => update('serviceChargePercent', Number(e.target.value))}
                />
              </Field>
              <Field label="Currency">
                <Select
                  value={draft.currency}
                  onChange={(e) => update('currency', e.target.value)}
                  options={['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((c) => ({ value: c, label: c }))}
                />
              </Field>
            </div>
            <Switch
              checked={draft.isOpen}
              onChange={(v) => update('isOpen', v)}
              label="Accepting orders"
              description="Guests see an Open badge. Turning this off pauses QR ordering for the whole restaurant."
            />
          </Card>
        </div>

        {/* ----------------------------------------------------------- preview */}
        <div className="flex flex-col gap-space-md lg:sticky lg:top-space-lg">
          <Card className="flex flex-col gap-space-md">
            <CardHeader
              icon="phone_iphone"
              title="Live guest preview"
              subtitle="Exactly what a diner sees after scanning a table code"
              badge={dirty ? <Badge tone="warning">Preview only</Badge> : <Badge tone="success">Saved</Badge>}
            />
            <SegmentedControl
              value={preview}
              onChange={setPreview}
              className="w-full"
              options={[
                { value: 'menu' as const, label: 'Menu' },
                { value: 'item' as const, label: 'Dish' },
                { value: 'cart' as const, label: 'Cart' },
                { value: 'tracking' as const, label: 'Tracking' },
              ]}
            />
          </Card>

          {preview === 'menu' ? (
            <GuestMenuPreview
              branding={draft}
              categories={categories}
              items={menuItems.slice(0, 3)}
              restaurantName={organization!.name}
              tableNumber="T-04"
            />
          ) : (
            <GuestSurfaceMock branding={draft} surface={preview} />
          )}

          <Card className="flex flex-col gap-space-sm">
            <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Preview notes
            </span>
            <ul className="flex flex-col gap-space-xs">
              {[
                'The editor re-skins the whole dashboard instantly so you can judge contrast in context.',
                'Guest preview reflects live menu items from your catalog.',
                'Discard restores the last saved configuration.',
              ].map((note) => (
                <li key={note} className="flex items-start gap-space-sm">
                  <Icon name="check_circle" size={15} className="mt-0.5 shrink-0 text-status-success" />
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{note}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          setDraft(organization!.branding)
          applyBranding(organization!.branding)
          setResetOpen(false)
          toast.info('Changes discarded')
        }}
        title="Discard unsaved branding?"
        message="Your editor returns to the last saved configuration. Nothing already published is affected."
        confirmLabel="Discard changes"
        destructive
      />
    </div>
  )
}

function organisationExists(org: unknown): boolean {
  return Boolean(org)
}

/* Compact mock surfaces so every guest screen is previewable from one editor. */
function GuestSurfaceMock({ branding, surface }: { branding: Branding; surface: PreviewSurface }) {
  const radius = branding.radiusScale === 'sharp' ? 'rounded-sm' : branding.radiusScale === 'round' ? 'rounded-2xl' : 'rounded-xl'

  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[38px] border-[10px] border-slate-900 bg-slate-900 shadow-e3">
      <div className="overflow-hidden rounded-[28px] bg-white">
        <div className="flex items-center justify-center py-1.5">
          <span className="h-1.5 w-16 rounded-full bg-slate-900/15" />
        </div>
        <div className="flex flex-col gap-space-md p-space-lg">
          {surface === 'item' && (
            <>
              <span
                className={cn('flex h-40 w-full items-center justify-center text-[56px]', radius)}
                style={{ background: `color-mix(in srgb, ${branding.primaryColor} 12%, #F8FAFC)` }}
              >
                🍕
              </span>
              <div className="flex flex-col gap-0.5">
                <h3 className="font-headline-md text-headline-md font-bold text-slate-900">
                  Woodfired Margherita
                </h3>
                <p className="font-body-sm text-body-sm text-slate-500">
                  Blistered crust, San Marzano, buffalo mozzarella, basil.
                </p>
                <span className="tabular font-headline-sm text-headline-sm font-bold" style={{ color: branding.primaryColor }}>
                  ₹490
                </span>
              </div>
              <div className="flex flex-col gap-space-xs">
                <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-400">
                  Size
                </span>
                {['Regular', 'Large', 'Sharing'].map((s, i) => (
                  <div
                    key={s}
                    className={cn('flex items-center justify-between border p-space-sm', radius)}
                    style={{
                      borderColor: i === 0 ? branding.primaryColor : '#E2E8F0',
                      background: i === 0 ? `color-mix(in srgb, ${branding.primaryColor} 8%, white)` : 'white',
                    }}
                  >
                    <span className="font-label-sm text-label-sm text-slate-700">{s}</span>
                    <span className="tabular font-label-xs text-label-xs text-slate-500">
                      {i === 0 ? '+₹0' : `+₹${i * 60}`}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={cn('py-space-sm font-label-md text-label-md font-bold text-white', radius)}
                style={{ background: branding.primaryColor }}
              >
                Add to cart · ₹490
              </button>
            </>
          )}

          {surface === 'cart' && (
            <>
              <h3 className="font-headline-sm text-headline-sm font-bold text-slate-900">Your order</h3>
              {[
                { name: 'Truffle Mushroom Risotto', qty: 2, price: 1160 },
                { name: 'Cold Brew Hazelnut', qty: 1, price: 220 },
              ].map((line) => (
                <div key={line.name} className={cn('flex items-center justify-between border border-slate-200 p-space-sm', radius)}>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm font-semibold text-slate-900">{line.name}</span>
                    <span className="font-label-xs text-label-xs text-slate-500">Large · Oat milk</span>
                  </div>
                  <div className="flex items-center gap-space-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200">
                      <Icon name="remove" size={13} />
                    </span>
                    <span className="tabular font-label-sm text-label-sm font-semibold">{line.qty}</span>
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                      style={{ background: branding.primaryColor }}
                    >
                      <Icon name="add" size={13} />
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex flex-col gap-space-2xs border-t border-slate-200 pt-space-sm">
                {[
                  ['Subtotal', '₹1,380'],
                  [`Tax (${branding.taxPercent}%)`, '₹69'],
                  ['Total', '₹1,449'],
                ].map(([label, value], i) => (
                  <div key={label} className="flex justify-between">
                    <span className={cn('font-body-sm text-body-sm', i === 2 ? 'font-bold text-slate-900' : 'text-slate-500')}>
                      {label}
                    </span>
                    <span className={cn('tabular', i === 2 ? 'font-label-md font-bold text-slate-900' : 'font-body-sm text-slate-500')}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={cn('py-space-sm font-label-md text-label-md font-bold text-white', radius)}
                style={{ background: branding.primaryColor }}
              >
                Place order · ₹1,449
              </button>
            </>
          )}

          {surface === 'tracking' && (
            <>
              <div className="flex flex-col items-center gap-space-2xs">
                <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-400">
                  Order
                </span>
                <span className="font-headline-lg text-headline-lg font-bold text-slate-900">BF-1042</span>
                <span className="font-label-xs text-label-xs text-slate-500">Table T-04 · 3 items</span>
              </div>
              <div className="flex flex-col gap-space-sm">
                {[
                  { label: 'Received', done: true },
                  { label: 'Accepted', done: true },
                  { label: 'Preparing', done: true, active: true },
                  { label: 'Ready', done: false },
                  { label: 'Served', done: false },
                ].map((step) => (
                  <div key={step.label} className="flex items-center gap-space-sm">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                      style={{
                        background: step.done ? branding.primaryColor : '#E2E8F0',
                        color: step.done ? '#fff' : '#94A3B8',
                      }}
                    >
                      <Icon name={step.done ? 'check' : 'more_horiz'} size={14} />
                    </span>
                    <span
                      className={cn(
                        'font-label-sm text-label-sm',
                        step.active ? 'font-bold text-slate-900' : 'text-slate-500',
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className={cn('flex flex-col gap-space-xs bg-slate-50 p-space-sm', radius)}>
                <span className="font-label-xs text-label-xs text-slate-500">Estimated ready in</span>
                <span className="tabular font-headline-md text-headline-md font-bold text-slate-900">12 min</span>
              </div>
              <button
                type="button"
                className={cn('border py-space-sm font-label-sm text-label-sm font-bold', radius)}
                style={{ borderColor: branding.primaryColor, color: branding.primaryColor }}
              >
                Need help?
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
