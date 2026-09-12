import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Icon,
  Input,
  Select,
  Switch,
  Textarea,
  useToast,
  SegmentedControl,
  ColorSwatchPicker,
} from '@/components/ui'
import { OnboardingShell, ONBOARDING_STEPS } from '@/components/layout/OnboardingShell'
import { GuestMenuPreview } from '@/components/GuestMenuPreview'
import { cn } from '@/lib/cn'
import { PLANS, PLAN_LIST } from '@/lib/plans'
import { CURRENCIES, FONT_OPTIONS, LANGUAGES, TIMEZONES } from '@/lib/constants'
import { BRAND_SWATCHES } from '@/store/theme'
import { formatMoney, slugify, uid } from '@/lib/format'
import * as api from '@/data/api'
import { useAppStore } from '@/store/AppStore'
import {
  BUSINESS_TYPE_LABELS,
  ROLE_LABELS,
  type Branding,
  type BusinessType,
  type MenuCategory,
  type MenuItem,
  type OnboardingDraft,
  type OnboardingStepId,
  type PlanId,
  type RestaurantTable,
  type Role,
} from '@/lib/types'

const DRAFT_KEY = 'biteflow.onboarding.v1'

const DEFAULT_BRANDING: Branding = {
  logoUrl: null,
  logoEmoji: '🍽️',
  primaryColor: '#EA580C',
  secondaryColor: '#0F172A',
  accentColor: '#F97316',
  fontFamily: 'Manrope',
  radiusScale: 'soft',
  buttonStyle: 'solid',
  cardStyle: 'elevated',
  menuLayout: 'grid',
  heroHeadline: '',
  heroSubcopy: '',
  heroImageUrl: null,
  tagline: '',
  address: '',
  phone: '',
  rating: 4.6,
  isOpen: true,
  currency: 'INR',
  taxPercent: 5,
  serviceChargePercent: 0,
}

function defaultDraft(): OnboardingDraft {
  return {
    account: { fullName: '', email: '', password: '' },
    restaurant: {
      name: '',
      slug: '',
      businessType: 'restaurant',
      gstNumber: '',
      currency: 'INR',
      language: 'en-IN',
      timezone: 'Asia/Kolkata',
      address: '',
      phone: '',
    },
    planId: 'growth',
    branding: DEFAULT_BRANDING,
    menuMethod: 'manual',
    tables: [
      { tableNumber: 'T-01', capacity: 2, zone: 'Indoor' },
      { tableNumber: 'T-02', capacity: 4, zone: 'Indoor' },
      { tableNumber: 'T-03', capacity: 4, zone: 'Indoor' },
      { tableNumber: 'T-04', capacity: 6, zone: 'Terrace' },
    ],
    staff: [],
  }
}

const SAMPLE_MENU: { category: string; icon: string; items: [string, string, number][] }[] = [
  {
    category: 'Starters',
    icon: 'tapas',
    items: [
      ['Crispy Lotus Stem', 'Honey chilli glaze, sesame, spring onion.', 340],
      ['Tandoori Mushroom', 'Yoghurt marinade, charred peppers, mint chutney.', 360],
    ],
  },
  {
    category: 'Mains',
    icon: 'restaurant_menu',
    items: [
      ['House Curry Bowl', 'Seasonal vegetables, coconut gravy, steamed rice.', 420],
      ['Grilled Chicken Plate', 'Charred chicken, herb butter, roasted potatoes.', 560],
    ],
  },
  {
    category: 'Desserts',
    icon: 'cake',
    items: [['Chocolate Fondant', 'Molten centre, vanilla bean ice cream.', 320]],
  },
  {
    category: 'Beverages',
    icon: 'local_cafe',
    items: [
      ['Cold Brew', '18-hour steep, over clear ice.', 220],
      ['Masala Chai', 'Assam leaf, ginger, cardamom.', 120],
    ],
  },
]

export function OnboardingFlow() {
  const { step: stepParam } = useParams<{ step?: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { session, db, switchOrganization, role } = useAppStore()

  const step: OnboardingStepId = useMemo(() => {
    const found = ONBOARDING_STEPS.find((s) => s.id === stepParam)
    return found?.id ?? 'account'
  }, [stepParam])

  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const base = defaultDraft()
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) Object.assign(base, JSON.parse(raw))
    } catch {
      /* ignore */
    }
    const planParam = params.get('plan') as PlanId | null
    if (planParam && PLANS[planParam]) base.planId = planParam
    return base
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [importText, setImportText] = useState('')
  const [newStaff, setNewStaff] = useState<{ email: string; name: string; role: Role }>({
    email: '',
    name: '',
    role: 'manager',
  })

  /* Seed the account step from a signed-in session. */
  useEffect(() => {
    if (!session) return
    setDraft((prev) => ({
      ...prev,
      account: {
        ...prev.account,
        fullName: prev.account.fullName || session.user.fullName,
        email: prev.account.email || session.user.email,
      },
    }))
  }, [session])

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* ignore */
    }
  }, [draft])

  const orgName = draft.restaurant.name || 'Your restaurant'
  const previewBranding: Branding = {
    ...draft.branding,
    currency: draft.restaurant.currency,
    tagline: draft.branding.tagline || BUSINESS_TYPE_LABELS[draft.restaurant.businessType],
    address: draft.restaurant.address,
    phone: draft.restaurant.phone,
  }

  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step)

  const goTo = (target: OnboardingStepId) => {
    setErrors({})
    navigate(`/onboarding/${target}`)
  }

  const updateRestaurant = <K extends keyof OnboardingDraft['restaurant']>(
    key: K,
    value: OnboardingDraft['restaurant'][K],
  ) =>
    setDraft((prev) => {
      const restaurant = { ...prev.restaurant, [key]: value }
      // Keep the slug in lockstep with the name until the user edits it directly.
      if (key === 'name' && (prev.restaurant.slug === '' || prev.restaurant.slug === slugify(prev.restaurant.name))) {
        restaurant.slug = slugify(String(value))
      }
      return { ...prev, restaurant }
    })

  const updateBranding = <K extends keyof Branding>(key: K, value: Branding[K]) =>
    setDraft((prev) => ({ ...prev, branding: { ...prev.branding, [key]: value } }))

  /* -------------------------------------------------------------- validation */

  const validate = (target: OnboardingStepId): boolean => {
    const next: Record<string, string> = {}

    if (target === 'account') {
      if (!draft.account.fullName.trim()) next.fullName = 'Your name is required'
      if (!draft.account.email.trim()) next.email = 'An email is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.account.email)) next.email = 'Check the email format'
      if (!draft.account.password) next.password = 'Choose a password'
      else if (draft.account.password.length < 8) next.password = 'Minimum 8 characters'
    }

    if (target === 'restaurant') {
      if (!draft.restaurant.name.trim()) next.name = 'Your restaurant needs a name'
      if (!draft.restaurant.slug.trim()) next.slug = 'A web address is required'
      if (draft.restaurant.gstNumber && !/^[0-9A-Z]{15}$/i.test(draft.restaurant.gstNumber))
        next.gstNumber = 'GSTIN should be 15 characters'
      if (!draft.restaurant.address.trim()) next.address = 'Guests need to find you'
    }

    if (target === 'menu') {
      if (menuCategories.length === 0) next.menu = 'Add at least one category, or load the sample menu'
      if (menuItems.length === 0) next.menu = 'Add at least one dish'
    }

    if (target === 'tables') {
      if (draft.tables.length === 0) next.tables = 'Add at least one table to generate QR codes'
      const numbers = draft.tables.map((t) => t.tableNumber.trim())
      if (new Set(numbers).size !== numbers.length) next.tables = 'Table numbers must be unique'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const nextStep = (skipValidation = false) => {
    if (!skipValidation && !validate(step)) {
      toast.error('Check the highlighted fields')
      return
    }
    const next = ONBOARDING_STEPS[currentIndex + 1]
    if (next) goTo(next.id)
  }

  const prevStep = () => {
    const prev = ONBOARDING_STEPS[currentIndex - 1]
    if (prev) goTo(prev.id)
  }

  /* ------------------------------------------------------------ draft menu */

  const [menuCategories, setMenuCategories] = useState<{ name: string; icon: string }[]>([])
  const [menuItems, setMenuItems] = useState<{ name: string; price: number; category: string; description: string }[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [newItem, setNewItem] = useState({ name: '', price: '', category: '', description: '' })

  const loadSampleMenu = () => {
    setMenuCategories(SAMPLE_MENU.map((c) => ({ name: c.category, icon: c.icon })))
    setMenuItems(
      SAMPLE_MENU.flatMap((c) =>
        c.items.map(([name, description, price]) => ({
          name,
          description,
          price,
          category: c.category,
        })),
      ),
    )
    toast.success('Sample menu loaded', 'Edit or remove anything before launching.')
  }

  const parseImport = () => {
    const rows = importText
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean)
    const parsed: { name: string; price: number; category: string; description: string }[] = []
    const categories = new Set<string>()
    const skipped: string[] = []

    rows.forEach((row) => {
      const parts = row.split(/[,;\t]/).map((p) => p.trim())
      if (parts.length < 2) {
        skipped.push(row)
        return
      }
      const name = parts[0]
      const price = Number(parts[1].replace(/[^\d.]/g, ''))
      const category = parts[2] || 'Imported'
      if (!name || !Number.isFinite(price)) {
        skipped.push(row)
        return
      }
      categories.add(category)
      parsed.push({ name, price, category, description: parts[3] || '' })
    })

    if (!parsed.length) {
      setErrors({ menu: 'No valid rows found. Use: Item name, price, category, description' })
      toast.error('Nothing imported', 'Check the format and try again.')
      return
    }

    setMenuCategories(Array.from(categories).map((name) => ({ name, icon: 'restaurant_menu' })))
    setMenuItems(parsed)
    setErrors({})
    toast.success(`Imported ${parsed.length} items`, skipped.length ? `${skipped.length} rows skipped` : undefined)
  }

  /* --------------------------------------------------------------- launch */

  const launch = async () => {
    setSaving(true)
    try {
      const org = await api.createOrganization({
        name: draft.restaurant.name,
        slug: draft.restaurant.slug || slugify(draft.restaurant.name),
        businessType: draft.restaurant.businessType,
        gstNumber: draft.restaurant.gstNumber,
        currency: draft.restaurant.currency,
        language: draft.restaurant.language,
        timezone: draft.restaurant.timezone,
        address: draft.restaurant.address,
        phone: draft.restaurant.phone,
        planId: draft.planId,
        branding: previewBranding,
      })

      // Categories + items
      const categoryIds = new Map<string, string>()
      for (const [i, cat] of menuCategories.entries()) {
        const category: MenuCategory = {
          id: uid('cat'),
          organizationId: org.id,
          name: cat.name,
          description: '',
          icon: cat.icon,
          sortOrder: i,
          isActive: true,
        }
        await api.upsertCategory(category)
        categoryIds.set(cat.name, category.id)
      }
      for (const [i, item] of menuItems.entries()) {
        const menuItem: MenuItem = {
          id: uid('item'),
          organizationId: org.id,
          categoryId: categoryIds.get(item.category) ?? '',
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: null,
          prepTimeMinutes: 12,
          calories: 0,
          available: true,
          isChefPick: false,
          isTrending: false,
          isVegetarian: false,
          isSpicy: false,
          allergens: [],
          tags: ['New'],
          optionGroups: [],
          sortOrder: i,
        }
        await api.upsertMenuItem(menuItem)
      }

      // Tables
      for (const [i, t] of draft.tables.entries()) {
        const table: RestaurantTable = {
          id: uid('tbl'),
          organizationId: org.id,
          branchId: `br_${org.slug}_main`,
          tableNumber: t.tableNumber,
          capacity: t.capacity,
          status: 'available',
          assignedWaiterId: null,
          assignedWaiterName: null,
          currentBill: 0,
          occupiedSince: null,
          qrToken: `${org.slug}-${t.tableNumber.toLowerCase()}-${1000 + i}`,
          zone: t.zone,
          posX: i % 6,
          posY: Math.floor(i / 6),
        }
        await api.upsertTable(table)
      }

      // Staff
      for (const member of draft.staff) {
        if (!member.email.trim()) continue
        await api.inviteEmployee({
          organizationId: org.id,
          email: member.email,
          name: member.name || member.email.split('@')[0],
          role: member.role,
        })
      }

      switchOrganization(org.id)
      localStorage.removeItem(DRAFT_KEY)
      toast.success('Restaurant launched 🎉', `${org.name} is live on the ${PLANS[org.planId].name} plan.`)
      navigate('/app/dashboard')
    } catch (err) {
      toast.error('Launch failed', err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  /* ---------------------------------------------------------------- render */

  const existingSlugs = db.organizations.map((o) => o.slug)
  const slugTaken = existingSlugs.includes(draft.restaurant.slug) && draft.restaurant.slug !== ''

  const checklist = [
    { label: 'Restaurant profile', done: Boolean(draft.restaurant.name && draft.restaurant.address), step: 'restaurant' as OnboardingStepId },
    { label: 'Branding', done: Boolean(draft.branding.primaryColor), step: 'branding' as OnboardingStepId },
    { label: 'Menu', done: menuItems.length > 0, step: 'menu' as OnboardingStepId },
    { label: 'Tables', done: draft.tables.length > 0, step: 'tables' as OnboardingStepId },
    { label: 'QR codes', done: draft.tables.length > 0, step: 'tables' as OnboardingStepId },
    { label: 'Staff invited', done: draft.staff.length > 0, step: 'staff' as OnboardingStepId },
  ]

  return (
    <OnboardingShell
      step={step}
      title={STEP_COPY[step].title}
      description={STEP_COPY[step].description}
      aside={
        step === 'restaurant' || step === 'branding' || step === 'menu' || step === 'launch' ? (
          step === 'restaurant' ? (
            <Card className="flex flex-col gap-space-md">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Live preview
              </span>
              <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-lg">
                <div className="flex items-center gap-space-md">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-[24px]"
                    style={{ background: `color-mix(in srgb, ${draft.branding.primaryColor} 16%, white)` }}
                  >
                    {draft.branding.logoEmoji}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-headline-sm text-headline-sm font-bold text-on-surface">
                      {orgName}
                    </span>
                    <span className="font-label-xs text-label-xs text-on-surface-variant">
                      {BUSINESS_TYPE_LABELS[draft.restaurant.businessType]}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-space-xs">
                  {[
                    { icon: 'location_on', value: draft.restaurant.address || 'Add an address' },
                    { icon: 'call', value: draft.restaurant.phone || 'Add a phone number' },
                    { icon: 'payments', value: draft.restaurant.currency },
                    { icon: 'schedule', value: draft.restaurant.timezone },
                  ].map((row) => (
                    <div key={row.icon} className="flex items-center gap-space-sm">
                      <Icon name={row.icon} size={15} className="text-primary" />
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-space-sm rounded-xl bg-white p-space-sm">
                  <Icon name="link" size={15} className="text-on-surface-variant" />
                  <span className="truncate font-label-xs text-label-xs text-on-surface-variant">
                    /r/{draft.restaurant.slug || 'your-restaurant'}/table/T-01
                  </span>
                </div>
              </div>
            </Card>
          ) : (
            <GuestMenuPreview
              branding={previewBranding}
              restaurantName={orgName}
              tableNumber={draft.tables[0]?.tableNumber ?? null}
              items={
                menuItems.length
                  ? menuItems.slice(0, 3).map(
                      (m, i) =>
                        ({
                          id: `preview_${i}`,
                          name: m.name,
                          price: m.price,
                          description: m.description || 'Description pending',
                          isChefPick: false,
                          isTrending: false,
                        }) as unknown as MenuItem,
                    )
                  : undefined
              }
            />
          )
        ) : undefined
      }
      footer={
        <>
          <Button variant="ghost" icon="arrow_back" onClick={prevStep} disabled={currentIndex === 0}>
            Back
          </Button>
          {step === 'launch' ? (
            <div className="flex items-center gap-space-sm">
              <Button
                variant="secondary"
                onClick={() => {
                  const demoOrg = db.organizations[0]
                  if (!demoOrg) {
                    toast.error('No demo tenant available', 'Create a restaurant instead.')
                    return
                  }
                  switchOrganization(demoOrg.id)
                  navigate('/app/dashboard')
                }}
              >
                Explore demo instead
              </Button>
              <Button size="lg" icon="rocket_launch" loading={saving} onClick={() => void launch()}>
                Launch Restaurant
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-space-sm">
              <Button
                variant="ghost"
                onClick={() => nextStep(true)}
                disabled={step === 'account' || step === 'restaurant'}
              >
                Skip for now
              </Button>
              <Button iconRight="arrow_forward" onClick={() => nextStep()}>
                Save &amp; continue
              </Button>
            </div>
          )}
        </>
      }
    >
      {/* ------------------------------------------------------ Step 1: account */}
      {step === 'account' && (
        <Card className="flex flex-col gap-space-lg">
          <div className="flex items-start gap-space-md rounded-xl bg-surface-container-low p-space-md">
            <Icon name="info" size={18} className="mt-0.5 shrink-0 text-status-info" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {session
                ? 'You are already signed in — we pre-filled your details, adjust anything you like.'
                : 'This creates your BiteFlow account. You will be signed in straight away.'}
            </p>
          </div>
          <Field label="Full name" error={errors.fullName} required htmlFor="ob-name">
            <Input
              id="ob-name"
              icon="person"
              controlSize="lg"
              placeholder="Aarav Mehta"
              value={draft.account.fullName}
              invalid={Boolean(errors.fullName)}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, account: { ...prev.account, fullName: e.target.value } }))
              }
            />
          </Field>
          <Field label="Email" error={errors.email} required htmlFor="ob-email">
            <Input
              id="ob-email"
              type="email"
              icon="mail"
              controlSize="lg"
              placeholder="you@restaurant.com"
              value={draft.account.email}
              invalid={Boolean(errors.email)}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, account: { ...prev.account, email: e.target.value } }))
              }
            />
          </Field>
          <Field label="Password" error={errors.password} hint="Minimum 8 characters" required htmlFor="ob-password">
            <Input
              id="ob-password"
              type="password"
              icon="lock"
              controlSize="lg"
              placeholder="••••••••"
              value={draft.account.password}
              invalid={Boolean(errors.password)}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, account: { ...prev.account, password: e.target.value } }))
              }
            />
          </Field>
        </Card>
      )}

      {/* --------------------------------------------------- Step 2: restaurant */}
      {step === 'restaurant' && (
        <Card className="flex flex-col gap-space-lg">
          <Field label="Restaurant name" error={errors.name} required htmlFor="ob-rname">
            <Input
              id="ob-rname"
              icon="storefront"
              controlSize="lg"
              placeholder="Urban Bean Cafe"
              value={draft.restaurant.name}
              invalid={Boolean(errors.name)}
              onChange={(e) => updateRestaurant('name', e.target.value)}
            />
          </Field>

          <Field
            label="Web address"
            error={errors.slug ?? (slugTaken ? 'That address is already taken' : null)}
            hint={`Your guest link will be /r/${draft.restaurant.slug || 'your-restaurant'}/table/T-01`}
            required
            htmlFor="ob-slug"
          >
            <Input
              id="ob-slug"
              icon="link"
              controlSize="lg"
              placeholder="urban-bean-cafe"
              value={draft.restaurant.slug}
              invalid={Boolean(errors.slug) || slugTaken}
              onChange={(e) => updateRestaurant('slug', slugify(e.target.value))}
            />
          </Field>

          <div className="grid gap-space-lg sm:grid-cols-2">
            <Field label="Business type" required htmlFor="ob-type">
              <Select
                id="ob-type"
                controlSize="lg"
                value={draft.restaurant.businessType}
                onChange={(e) => updateRestaurant('businessType', e.target.value as BusinessType)}
                options={Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="GSTIN" error={errors.gstNumber} hint="Optional for now" htmlFor="ob-gst">
              <Input
                id="ob-gst"
                icon="receipt_long"
                controlSize="lg"
                placeholder="29AABCT1332L1Z5"
                value={draft.restaurant.gstNumber}
                invalid={Boolean(errors.gstNumber)}
                onChange={(e) => updateRestaurant('gstNumber', e.target.value.toUpperCase())}
              />
            </Field>
          </div>

          <Field label="Address" error={errors.address} required htmlFor="ob-address">
            <Textarea
              id="ob-address"
              rows={2}
              placeholder="18 Maple Lane, Downtown"
              value={draft.restaurant.address}
              onChange={(e) => updateRestaurant('address', e.target.value)}
            />
          </Field>

          <Field label="Contact phone" htmlFor="ob-phone">
            <Input
              id="ob-phone"
              icon="call"
              controlSize="lg"
              placeholder="+91 98200 41120"
              value={draft.restaurant.phone}
              onChange={(e) => updateRestaurant('phone', e.target.value)}
            />
          </Field>

          <div className="grid gap-space-lg sm:grid-cols-3">
            <Field label="Currency" htmlFor="ob-currency">
              <Select
                id="ob-currency"
                controlSize="lg"
                value={draft.restaurant.currency}
                onChange={(e) => updateRestaurant('currency', e.target.value)}
                options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
              />
            </Field>
            <Field label="Language" htmlFor="ob-language">
              <Select
                id="ob-language"
                controlSize="lg"
                value={draft.restaurant.language}
                onChange={(e) => updateRestaurant('language', e.target.value)}
                options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
              />
            </Field>
            <Field label="Timezone" htmlFor="ob-tz">
              <Select
                id="ob-tz"
                controlSize="lg"
                value={draft.restaurant.timezone}
                onChange={(e) => updateRestaurant('timezone', e.target.value)}
                options={TIMEZONES.map((t) => ({ value: t.code, label: t.label }))}
              />
            </Field>
          </div>
        </Card>
      )}

      {/* --------------------------------------------------------- Step 3: plan */}
      {step === 'plan' && (
        <div className="flex flex-col gap-space-lg">
          <div className="grid gap-space-md md:grid-cols-2">
            {PLAN_LIST.map((plan) => {
              const selected = draft.planId === plan.id
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, planId: plan.id }))}
                  aria-pressed={selected}
                  className={cn(
                    'flex flex-col gap-space-sm rounded-2xl border-[1.5px] bg-white p-space-lg text-left transition-all',
                    selected ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      {plan.name}
                    </span>
                    {plan.recommended && <Badge tone="brand">Recommended</Badge>}
                    {selected && !plan.recommended && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                        <Icon name="check" size={15} />
                      </span>
                    )}
                  </div>
                  <span className="flex items-baseline gap-1">
                    {plan.priceMonthly ? (
                      <>
                        <span className="tabular font-headline-md text-headline-md font-bold">
                          {formatMoney(plan.priceMonthly)}
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">/month</span>
                      </>
                    ) : (
                      <span className="font-headline-md text-headline-md font-bold">Custom</span>
                    )}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{plan.bestFor}</span>
                  <ul className="flex flex-col gap-space-2xs">
                    {plan.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-space-sm">
                        <Icon name="check_circle" size={15} className="mt-0.5 shrink-0 text-status-success" />
                        <span className="font-body-sm text-body-sm text-on-surface-variant">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-space-xs grid grid-cols-3 gap-space-sm border-t border-slate-200 pt-space-sm">
                    {[
                      { k: 'Tables', v: plan.limits.maxTables },
                      { k: 'Items', v: plan.limits.maxMenuItems },
                      { k: 'Staff', v: plan.limits.maxEmployees },
                    ].map((s) => (
                      <div key={s.k} className="flex flex-col">
                        <span className="tabular font-label-md text-label-md font-bold text-on-surface">
                          {s.v >= 9999 ? '∞' : s.v}
                        </span>
                        <span className="font-label-xs text-label-xs text-on-surface-variant">{s.k}</span>
                      </div>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex items-start gap-space-md rounded-xl bg-status-success-bg p-space-md">
            <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-status-success" />
            <p className="font-body-sm text-body-sm text-on-surface">
              14-day free trial on {PLANS[draft.planId].name}. No card required, cancel any time from
              Subscription &amp; Billing.
            </p>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------- Step 4: branding */}
      {step === 'branding' && (
        <div className="flex flex-col gap-space-lg">
          <Card className="flex flex-col gap-space-lg">
            <div className="flex flex-col gap-space-sm">
              <span className="font-label-sm text-label-sm font-semibold text-on-surface">Logo</span>
              <div className="flex flex-wrap items-center gap-space-sm">
                {['🍽️', '☕', '🍛', '🥗', '🍕', '🍜', '🍰', '🍔', '🌮', '🥖'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => updateBranding('logoEmoji', emoji)}
                    aria-label={`Logo ${emoji}`}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl border-2 text-[22px] transition-transform hover:scale-105',
                      draft.branding.logoEmoji === emoji ? 'border-primary' : 'border-slate-200',
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <ColorSwatchPicker
              label="Primary colour"
              value={draft.branding.primaryColor}
              onChange={(v) => updateBranding('primaryColor', v)}
              swatches={BRAND_SWATCHES}
            />
            <ColorSwatchPicker
              label="Accent colour"
              value={draft.branding.accentColor}
              onChange={(v) => updateBranding('accentColor', v)}
              swatches={BRAND_SWATCHES}
            />
            <ColorSwatchPicker
              label="Secondary colour"
              value={draft.branding.secondaryColor}
              onChange={(v) => updateBranding('secondaryColor', v)}
              swatches={BRAND_SWATCHES}
            />

            <div className="grid gap-space-lg sm:grid-cols-2">
              <Field label="Menu font" htmlFor="ob-font">
                <Select
                  id="ob-font"
                  value={draft.branding.fontFamily}
                  onChange={(e) => updateBranding('fontFamily', e.target.value as Branding['fontFamily'])}
                  options={FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
                />
              </Field>
              <Field label="Corner radius" htmlFor="ob-radius">
                <Select
                  id="ob-radius"
                  value={draft.branding.radiusScale}
                  onChange={(e) => updateBranding('radiusScale', e.target.value as Branding['radiusScale'])}
                  options={[
                    { value: 'sharp', label: 'Sharp — editorial' },
                    { value: 'soft', label: 'Soft — balanced' },
                    { value: 'round', label: 'Round — friendly' },
                  ]}
                />
              </Field>
              <Field label="Button style" htmlFor="ob-button">
                <Select
                  id="ob-button"
                  value={draft.branding.buttonStyle}
                  onChange={(e) => updateBranding('buttonStyle', e.target.value as Branding['buttonStyle'])}
                  options={[
                    { value: 'solid', label: 'Solid fill' },
                    { value: 'outline', label: 'Outline' },
                    { value: 'pill', label: 'Pill' },
                  ]}
                />
              </Field>
              <Field label="Card style" htmlFor="ob-card">
                <Select
                  id="ob-card"
                  value={draft.branding.cardStyle}
                  onChange={(e) => updateBranding('cardStyle', e.target.value as Branding['cardStyle'])}
                  options={[
                    { value: 'elevated', label: 'Elevated with shadow' },
                    { value: 'flat', label: 'Flat tinted' },
                    { value: 'bordered', label: 'Outlined' },
                  ]}
                />
              </Field>
            </div>

            <Field label="Hero headline" hint="Shown at the top of your guest menu" htmlFor="ob-hero">
              <Input
                id="ob-hero"
                icon="campaign"
                placeholder="Slow-roasted mornings, all day"
                value={draft.branding.heroHeadline}
                onChange={(e) => updateBranding('heroHeadline', e.target.value)}
              />
            </Field>
            <Field label="Hero sub-copy" htmlFor="ob-herosub">
              <Textarea
                id="ob-herosub"
                rows={2}
                placeholder="Single-origin espresso, woodfired sourdough and all-day brunch."
                value={draft.branding.heroSubcopy}
                onChange={(e) => updateBranding('heroSubcopy', e.target.value)}
              />
            </Field>

            <div className="grid gap-space-lg sm:grid-cols-2">
              <Field label="Tax %" htmlFor="ob-tax">
                <Input
                  id="ob-tax"
                  type="number"
                  min={0}
                  max={30}
                  value={draft.branding.taxPercent}
                  onChange={(e) => updateBranding('taxPercent', Number(e.target.value))}
                />
              </Field>
              <Field label="Service charge %" htmlFor="ob-service">
                <Input
                  id="ob-service"
                  type="number"
                  min={0}
                  max={20}
                  value={draft.branding.serviceChargePercent}
                  onChange={(e) => updateBranding('serviceChargePercent', Number(e.target.value))}
                />
              </Field>
            </div>

            <Switch
              checked={draft.branding.isOpen}
              onChange={(v) => updateBranding('isOpen', v)}
              label="Currently accepting orders"
              description="Guests see an Open badge; turning this off blocks new QR orders."
            />
          </Card>
        </div>
      )}

      {/* --------------------------------------------------------- Step 5: menu */}
      {step === 'menu' && (
        <div className="flex flex-col gap-space-lg">
          <SegmentedControl
            value={draft.menuMethod}
            onChange={(v) => setDraft((prev) => ({ ...prev, menuMethod: v }))}
            options={[
              { value: 'manual', label: 'Add manually', icon: 'edit' },
              { value: 'import', label: 'Import menu', icon: 'upload_file' },
            ]}
          />

          {errors.menu && (
            <div className="flex items-center gap-space-sm rounded-xl border border-status-critical/25 bg-status-critical-bg p-space-md">
              <Icon name="error" size={18} className="text-status-critical" />
              <span className="font-body-sm text-body-sm text-on-surface">{errors.menu}</span>
            </div>
          )}

          {draft.menuMethod === 'import' ? (
            <Card className="flex flex-col gap-space-md">
              <div className="flex items-start gap-space-md rounded-xl bg-surface-container-low p-space-md">
                <Icon name="info" size={18} className="mt-0.5 shrink-0 text-status-info" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                    One item per line
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Format: <code className="rounded bg-white px-1">Item name, price, category, description</code>
                  </span>
                </div>
              </div>
              <Textarea
                rows={8}
                placeholder={'Crispy Lotus Stem, 340, Starters, Honey chilli glaze\nHouse Curry Bowl, 420, Mains, Coconut gravy'}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="font-mono text-[13px]"
              />
              <div className="flex flex-wrap gap-space-sm">
                <Button icon="upload" onClick={parseImport}>
                  Import rows
                </Button>
                <Button variant="secondary" icon="auto_awesome" onClick={loadSampleMenu}>
                  Use a sample menu
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-space-lg">
              <Card className="flex flex-col gap-space-md">
                <span className="font-headline-sm text-headline-sm text-on-surface">Categories</span>
                <div className="flex flex-wrap gap-space-xs">
                  {menuCategories.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-space-xs rounded-full bg-surface-container-high px-space-md py-1 font-label-sm text-label-sm font-semibold text-on-surface"
                    >
                      {c.name}
                      <button
                        type="button"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => {
                          setMenuCategories((prev) => prev.filter((x) => x.name !== c.name))
                          setMenuItems((prev) => prev.filter((i) => i.category !== c.name))
                        }}
                        className="text-on-surface-variant hover:text-status-critical"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </span>
                  ))}
                  {!menuCategories.length && (
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      No categories yet.
                    </span>
                  )}
                </div>
                <div className="flex gap-space-sm">
                  <Input
                    icon="category"
                    placeholder="Category name, e.g. Starters"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    icon="add"
                    onClick={() => {
                      if (!newCategory.trim()) return
                      setMenuCategories((prev) => [
                        ...prev,
                        { name: newCategory.trim(), icon: 'restaurant_menu' },
                      ])
                      setNewCategory('')
                    }}
                  >
                    Add
                  </Button>
                </div>
              </Card>

              <Card className="flex flex-col gap-space-md">
                <span className="font-headline-sm text-headline-sm text-on-surface">Dishes</span>
                <div className="grid gap-space-sm sm:grid-cols-2">
                  <Input
                    icon="restaurant"
                    placeholder="Dish name"
                    value={newItem.name}
                    onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                  />
                  <Input
                    icon="payments"
                    type="number"
                    placeholder="Price"
                    value={newItem.price}
                    onChange={(e) => setNewItem((p) => ({ ...p, price: e.target.value }))}
                  />
                </div>
                <Select
                  value={newItem.category}
                  onChange={(e) => setNewItem((p) => ({ ...p, category: e.target.value }))}
                  options={[
                    { value: '', label: 'Select a category…' },
                    ...menuCategories.map((c) => ({ value: c.name, label: c.name })),
                  ]}
                />
                <Input
                  icon="notes"
                  placeholder="Short description (optional)"
                  value={newItem.description}
                  onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                />
                <div className="flex flex-wrap gap-space-sm">
                  <Button
                    icon="add"
                    disabled={!newItem.name.trim() || !newItem.price || !newItem.category}
                    onClick={() => {
                      setMenuItems((prev) => [
                        ...prev,
                        {
                          name: newItem.name.trim(),
                          price: Number(newItem.price),
                          category: newItem.category,
                          description: newItem.description,
                        },
                      ])
                      setNewItem({ name: '', price: '', category: newItem.category, description: '' })
                    }}
                  >
                    Add dish
                  </Button>
                  <Button variant="secondary" icon="auto_awesome" onClick={loadSampleMenu}>
                    Load sample menu
                  </Button>
                </div>

                {menuItems.length > 0 && (
                  <div className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200">
                    {menuItems.map((item, i) => (
                      <div key={`${item.name}-${i}`} className="flex items-center justify-between gap-space-sm px-space-md py-space-sm">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-label-sm text-label-sm font-semibold text-on-surface">
                            {item.name}
                          </span>
                          <span className="font-label-xs text-label-xs text-on-surface-variant">
                            {item.category}
                          </span>
                        </div>
                        <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface">
                          {formatMoney(item.price, draft.restaurant.currency)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => setMenuItems((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-on-surface-variant hover:text-status-critical"
                        >
                          <Icon name="delete" size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------- Step 6: tables */}
      {step === 'tables' && (
        <div className="flex flex-col gap-space-lg">
          {errors.tables && (
            <div className="flex items-center gap-space-sm rounded-xl border border-status-critical/25 bg-status-critical-bg p-space-md">
              <Icon name="error" size={18} className="text-status-critical" />
              <span className="font-body-sm text-body-sm text-on-surface">{errors.tables}</span>
            </div>
          )}

          <Card className="flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <span className="font-headline-sm text-headline-sm text-on-surface">Floor layout</span>
              <Badge tone="brand" icon="table_restaurant">
                {draft.tables.length} tables
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-space-sm sm:grid-cols-4 lg:grid-cols-5">
              {draft.tables.map((t, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-space-2xs rounded-xl border border-slate-200 bg-surface-container-low p-space-sm"
                >
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    {t.tableNumber}
                  </span>
                  <span className="flex items-center gap-0.5 font-label-xs text-label-xs text-on-surface-variant">
                    <Icon name="group" size={12} />
                    {t.capacity}
                  </span>
                  <span className="font-label-xs text-[10px] text-on-surface-variant">{t.zone}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${t.tableNumber}`}
                    onClick={() => setDraft((prev) => ({ ...prev, tables: prev.tables.filter((_, idx) => idx !== i) }))}
                    className="mt-space-2xs text-on-surface-variant hover:text-status-critical"
                  >
                    <Icon name="delete" size={15} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-space-md">
            <span className="font-headline-sm text-headline-sm text-on-surface">Add tables</span>
            <div className="grid gap-space-sm sm:grid-cols-3">
              <Select
                value="1"
                onChange={(e) => {
                  const count = Number(e.target.value)
                  setDraft((prev) => {
                    const start = prev.tables.length + 1
                    const additions = Array.from({ length: count }, (_, i) => ({
                      tableNumber: `T-${String(start + i).padStart(2, '0')}`,
                      capacity: 4,
                      zone: 'Indoor' as const,
                    }))
                    return { ...prev, tables: [...prev.tables, ...additions] }
                  })
                }}
                options={[
                  { value: '1', label: 'Add 1 table' },
                  { value: '2', label: 'Add 2 tables' },
                  { value: '4', label: 'Add 4 tables' },
                  { value: '6', label: 'Add 6 tables' },
                ]}
              />
              <Button
                variant="secondary"
                icon="auto_awesome"
                onClick={() =>
                  setDraft((prev) => {
                    const start = prev.tables.length + 1
                    return {
                      ...prev,
                      tables: [
                        ...prev.tables,
                        ...Array.from({ length: 12 - prev.tables.length }, (_, i) => ({
                          tableNumber: `T-${String(start + i).padStart(2, '0')}`,
                          capacity: 4,
                          zone: 'Indoor' as const,
                        })),
                      ].slice(0, 12),
                    }
                  })
                }
              >
                Build a 12-table floor
              </Button>
              <Button
                variant="secondary"
                icon="qr_code_2"
                onClick={() => {
                  validate('tables')
                  toast.success('QR codes ready', 'They are generated and printable after launch.')
                }}
              >
                Preview QR codes
              </Button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Each table gets a permanent QR pointing at{' '}
              <code className="rounded bg-surface-container-low px-1">
                /r/{draft.restaurant.slug || 'your-restaurant'}/table/T-01
              </code>
              . You can regenerate or reprint any code later.
            </p>
          </Card>
        </div>
      )}

      {/* -------------------------------------------------------- Step 7: staff */}
      {step === 'staff' && (
        <div className="flex flex-col gap-space-lg">
          <Card className="flex flex-col gap-space-md">
            <span className="font-headline-sm text-headline-sm text-on-surface">Invite your team</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Each role only sees the screens it needs. You can change roles later from Staff &amp; Roles.
            </p>
            <div className="grid gap-space-sm sm:grid-cols-2">
              <Input
                icon="person"
                placeholder="Full name"
                value={newStaff.name}
                onChange={(e) => setNewStaff((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                icon="mail"
                type="email"
                placeholder="name@restaurant.com"
                value={newStaff.email}
                onChange={(e) => setNewStaff((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <Select
              value={newStaff.role}
              onChange={(e) => setNewStaff((p) => ({ ...p, role: e.target.value as Role }))}
              options={(['manager', 'chef', 'kitchen_staff', 'waiter', 'cashier'] as Role[]).map((r) => ({
                value: r,
                label: ROLE_LABELS[r],
              }))}
            />
            <Button
              variant="secondary"
              icon="person_add"
              disabled={!newStaff.email.trim()}
              onClick={() => {
                setDraft((prev) => ({
                  ...prev,
                  staff: [...prev.staff, { ...newStaff, name: newStaff.name || newStaff.email.split('@')[0] }],
                }))
                setNewStaff({ email: '', name: '', role: newStaff.role })
                toast.success('Invite queued')
              }}
            >
              Add invite
            </Button>
          </Card>

          {draft.staff.length > 0 ? (
            <Card className="flex flex-col divide-y divide-slate-200 p-0">
              {draft.staff.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-space-sm p-space-md">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-label-sm text-label-sm font-semibold text-on-surface">
                      {s.name}
                    </span>
                    <span className="truncate font-label-xs text-label-xs text-on-surface-variant">
                      {s.email}
                    </span>
                  </div>
                  <Badge tone="neutral">{ROLE_LABELS[s.role]}</Badge>
                  <button
                    type="button"
                    aria-label={`Remove ${s.name}`}
                    onClick={() => setDraft((prev) => ({ ...prev, staff: prev.staff.filter((_, idx) => idx !== i) }))}
                    className="text-on-surface-variant hover:text-status-critical"
                  >
                    <Icon name="delete" size={17} />
                  </button>
                </div>
              ))}
            </Card>
          ) : (
            <EmptyInvites />
          )}
        </div>
      )}

      {/* ------------------------------------------------------ Step 8: launch */}
      {step === 'launch' && (
        <div className="flex flex-col gap-space-lg">
          <Card className="flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <span className="font-headline-sm text-headline-sm text-on-surface">Launch checklist</span>
              <Badge tone={checklist.every((c) => c.done) ? 'success' : 'warning'}>
                {checklist.filter((c) => c.done).length}/{checklist.length} complete
              </Badge>
            </div>
            <div className="flex flex-col divide-y divide-slate-200">
              {checklist.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => goTo(item.step)}
                  className="flex items-center justify-between gap-space-sm py-space-sm text-left hover:opacity-80"
                >
                  <span className="flex items-center gap-space-md">
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full',
                        item.done ? 'bg-status-success-bg text-status-success' : 'bg-surface-container-high text-on-surface-variant',
                      )}
                    >
                      <Icon name={item.done ? 'check' : 'more_horiz'} size={16} />
                    </span>
                    <span className="font-label-md text-label-md text-on-surface">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-space-xs font-label-xs text-label-xs text-primary">
                    {item.done ? 'Review' : 'Complete'}
                    <Icon name="chevron_right" size={15} />
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-space-md">
            <span className="font-headline-sm text-headline-sm text-on-surface">Summary</span>
            <div className="grid gap-space-md sm:grid-cols-2">
              <SummaryRow label="Restaurant" value={draft.restaurant.name || '—'} />
              <SummaryRow label="Guest link" value={`/r/${draft.restaurant.slug || '—'}`} />
              <SummaryRow label="Plan" value={`${PLANS[draft.planId].name} · 14-day trial`} />
              <SummaryRow label="Menu" value={`${menuItems.length} dishes · ${menuCategories.length} categories`} />
              <SummaryRow label="Tables" value={`${draft.tables.length} with QR codes`} />
              <SummaryRow label="Team" value={draft.staff.length ? `${draft.staff.length} invited` : 'Just you for now'} />
            </div>
          </Card>

          <div className="flex items-start gap-space-md rounded-xl bg-status-success-bg p-space-md">
            <Icon name="rocket_launch" size={20} className="mt-0.5 shrink-0 text-status-success" />
            <p className="font-body-sm text-body-sm text-on-surface">
              Launching creates your tenant workspace, menu, tables and QR codes in one step. You can
              change anything afterwards from the dashboard.
            </p>
          </div>
        </div>
      )}
    </OnboardingShell>
  )
}

/* ------------------------------------------------------------- sub-components */

function EmptyInvites() {
  return (
    <Card className="flex items-center gap-space-md">
      <Icon name="group_add" size={20} className="text-on-surface-variant" />
      <span className="font-body-sm text-body-sm text-on-surface-variant">
        No invites yet — you can skip this and add your team from Staff &amp; Roles later.
      </span>
    </Card>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface-container-low p-space-md">
      <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="truncate font-label-md text-label-md font-semibold text-on-surface">{value}</span>
    </div>
  )
}

const STEP_COPY: Record<OnboardingStepId, { title: string; description: string }> = {
  account: { title: 'Create your account', description: 'This becomes the owner login for your restaurant workspace.' },
  restaurant: { title: 'Tell us about your restaurant', description: 'These details appear on your guest menu, receipts and tax documents.' },
  plan: { title: 'Choose a plan', description: 'Start on a 14-day trial. Limits scale with your plan, and you can change it any time.' },
  branding: { title: 'Make it look like you', description: 'Colours, type and shape apply to your guest menu instantly — watch the preview update.' },
  menu: { title: 'Build your menu', description: 'Add categories and dishes by hand, or paste a list and import in one go.' },
  tables: { title: 'Set up your tables', description: 'Each table gets its own QR code so orders arrive with the right table attached.' },
  staff: { title: 'Invite your team', description: 'Give everyone the access they need — nothing more. Roles are enforced server-side.' },
  launch: { title: 'You are ready to launch', description: 'Review the checklist, then take your restaurant live.' },
}

export { SAMPLE_MENU }
