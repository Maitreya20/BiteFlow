import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Checkbox, Field, Icon, Input, useToast } from '@/components/ui'
import { signIn, signUp } from '@/data/api'
import { isSupabaseConfigured } from '@/lib/supabase'
import { PLANS } from '@/lib/plans'
import { cn } from '@/lib/cn'
import { DEMO_MODE_NOTE } from '@/lib/constants'
import type { PlanId } from '@/lib/types'

const PROOF = [
  { icon: 'qr_code_2', title: 'QR ordering out of the box', copy: 'Every table gets a permanent, printable code.' },
  { icon: 'soup_kitchen', title: 'Kitchen board included', copy: 'On Growth and above — accept, prepare, ready, done.' },
  { icon: 'insights', title: 'Numbers from day one', copy: 'Revenue, peak hours and menu engineering from your first order.' },
  { icon: 'shield', title: 'Your data stays yours', copy: 'Every tenant is isolated with row-level security.' },
]

export function SignupPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const presetPlan = (params.get('plan') as PlanId | null) ?? 'growth'
  const plan = PLANS[presetPlan] ?? PLANS.growth

  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [terms, setTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.fullName.trim()) next.fullName = 'Tell us who to greet'
    if (!form.email.trim()) next.email = 'An email address is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'That email looks incomplete'
    if (!form.password) next.password = 'Choose a password'
    else if (form.password.length < 8) next.password = 'Use at least 8 characters'
    if (!terms) next.terms = 'Please accept the terms to continue'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      if (isSupabaseConfigured) {
        await signUp(form)
      } else {
        // Demo mode: create the local session then walk the wizard.
        await signUp(form)
        await signIn(form.email, form.password)
      }
      toast.success('Account created', 'Now let\'s set up your restaurant.')
      navigate(`/onboarding/restaurant?plan=${presetPlan}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed'
      toast.error('Could not create your account', message)
      setErrors({ email: message })
    } finally {
      setLoading(false)
    }
  }

  const strength = (() => {
    const p = form.password
    let score = 0
    if (p.length >= 8) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    return score
  })()

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* ------------------------------------------------------------- Form */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 bg-surface-container-lowest px-space-lg py-space-md lg:border-0 lg:bg-transparent">
          <Link to="/" className="flex items-center gap-space-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Icon name="restaurant" size={20} />
            </span>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight">BiteFlow</span>
          </Link>
          <Link to="/login" className="font-label-sm text-label-sm font-semibold text-on-surface-variant hover:text-on-surface">
            Already have an account?
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-space-lg py-space-2xl">
          <form onSubmit={submit} className="flex w-full max-w-[440px] flex-col gap-space-lg" noValidate>
            <div className="flex flex-col gap-space-xs">
              <Badge tone="brand" icon="rocket_launch">
                Step 1 · Account
              </Badge>
              <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
                Start your free trial
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                14 days of {plan.name}, no card required. You'll pick your restaurant details next.
              </p>
            </div>

            <Field label="Your full name" error={errors.fullName} required htmlFor="su-name">
              <Input
                id="su-name"
                icon="person"
                controlSize="lg"
                autoComplete="name"
                placeholder="Aarav Mehta"
                value={form.fullName}
                invalid={Boolean(errors.fullName)}
                onChange={(e) => update('fullName', e.target.value)}
              />
            </Field>

            <Field label="Work email" error={errors.email} required htmlFor="su-email">
              <Input
                id="su-email"
                type="email"
                icon="mail"
                controlSize="lg"
                autoComplete="email"
                placeholder="you@restaurant.com"
                value={form.email}
                invalid={Boolean(errors.email)}
                onChange={(e) => update('email', e.target.value)}
              />
            </Field>

            <Field
              label="Password"
              error={errors.password}
              hint="At least 8 characters with a number or symbol"
              required
              htmlFor="su-password"
            >
              <Input
                id="su-password"
                type={showPassword ? 'text' : 'password'}
                icon="lock"
                controlSize="lg"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.password}
                invalid={Boolean(errors.password)}
                onChange={(e) => update('password', e.target.value)}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="text-on-surface-variant hover:text-on-surface"
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={18} />
                  </button>
                }
              />
            </Field>

            {form.password && (
              <div className="flex items-center gap-space-xs">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors',
                      strength >= i
                        ? strength <= 2
                          ? 'bg-status-warning'
                          : 'bg-status-success'
                        : 'bg-slate-200',
                    )}
                  />
                ))}
                <span className="font-label-xs text-label-xs text-on-surface-variant">
                  {strength <= 2 ? 'Weak' : strength === 3 ? 'Good' : 'Strong'}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-space-xs">
              <Checkbox
                checked={terms}
                onChange={setTerms}
                id="su-terms"
                label={
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    I agree to the{' '}
                    <Link to="/about" className="font-semibold text-primary hover:underline">
                      terms of service
                    </Link>{' '}
                    and privacy policy.
                  </span>
                }
              />
              {errors.terms && (
                <span className="flex items-center gap-1 font-label-xs text-label-xs text-status-critical">
                  <Icon name="error" size={13} />
                  {errors.terms}
                </span>
              )}
            </div>

            <Button type="submit" size="lg" block loading={loading} iconRight="arrow_forward">
              Create account
            </Button>

            {!isSupabaseConfigured && (
              <p className="text-center font-label-xs text-label-xs text-on-surface-variant">
                {DEMO_MODE_NOTE}
              </p>
            )}
          </form>
        </div>
      </div>

      {/* ----------------------------------------------------------- Value panel */}
      <div className="relative hidden flex-1 overflow-hidden bg-slate-950 lg:flex lg:max-w-[560px]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-tertiary/20 blur-3xl" />

        <div className="relative flex flex-1 flex-col justify-between p-space-2xl">
          <div className="flex flex-col gap-space-lg">
            <span className="inline-flex w-fit items-center gap-space-xs rounded-full bg-white/10 px-space-md py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-200">
                Live in one afternoon
              </span>
            </span>
            <h2 className="font-headline-lg text-headline-lg tracking-tight text-white">
              Everything your restaurant needs to take its first QR order today.
            </h2>
            <div className="flex flex-col gap-space-md">
              {PROOF.map((item) => (
                <div key={item.title} className="flex items-start gap-space-md">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                    <Icon name={item.icon} size={19} />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md font-semibold text-white">{item.title}</span>
                    <span className="font-body-sm text-body-sm text-slate-400">{item.copy}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-space-md">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-space-md">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-slate-400">
                  Your starting plan
                </span>
                <Badge tone="brand">{plan.name}</Badge>
              </div>
              <p className="mt-space-xs font-body-sm text-body-sm text-slate-300">{plan.tagline}</p>
              <div className="mt-space-md grid grid-cols-3 gap-space-sm">
                {[
                  { k: 'Tables', v: plan.limits.maxTables },
                  { k: 'Menu items', v: plan.limits.maxMenuItems },
                  { k: 'Staff', v: plan.limits.maxEmployees },
                ].map((s) => (
                  <div key={s.k} className="flex flex-col">
                    <span className="tabular font-headline-sm text-headline-sm font-bold text-white">
                      {s.v}
                    </span>
                    <span className="font-label-xs text-label-xs text-slate-400">{s.k}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-space-sm">
              <Icon name="lock" size={15} className="text-slate-400" />
              <span className="font-label-xs text-label-xs text-slate-400">
                Tenant-isolated with Postgres row-level security.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
