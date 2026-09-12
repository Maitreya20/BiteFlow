import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Checkbox, Field, Icon, Input, useToast } from '@/components/ui'
import { signIn } from '@/data/api'
import { DEMO_ACCOUNTS, DEMO_MODE_NOTE } from '@/lib/constants'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAppStore } from '@/store/AppStore'

export function LoginPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { session, ready } = useAppStore()
  const [email, setEmail] = useState(isSupabaseConfigured ? '' : DEMO_ACCOUNTS[0].email)
  const [password, setPassword] = useState(isSupabaseConfigured ? '' : DEMO_ACCOUNTS[0].password)
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (ready && session) {
    navigate('/app/dashboard', { replace: true })
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Enter your email address')
      return
    }
    if (!password) {
      setError('Enter your password')
      return
    }

    setLoading(true)
    try {
      await signIn(email.trim(), password)
      toast.success('Welcome back', 'Session restored.')
      navigate('/app/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
      toast.error('Sign in failed', err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = async (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email)
    setPassword(account.password)
    setLoading(true)
    try {
      await signIn(account.email, account.password)
      toast.success(`Signed in as ${account.label}`)
      navigate(account.email.startsWith('admin') ? '/admin' : '/app/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between border-b border-slate-200 bg-surface-container-lowest px-space-lg py-space-md">
        <Link to="/" className="flex items-center gap-space-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
            <Icon name="restaurant" size={20} />
          </span>
          <span className="font-headline-sm text-headline-sm font-bold tracking-tight">BiteFlow</span>
        </Link>
        <Link to="/signup">
          <Button size="sm" variant="secondary">
            Create account
          </Button>
        </Link>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-space-lg py-space-2xl">
        <div className="pointer-events-none absolute -right-32 -top-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-tertiary/10 blur-3xl" />

        <div className="relative w-full max-w-[420px]">
          <Card className="flex flex-col gap-space-lg">
            <div className="flex flex-col gap-0.5">
              <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
                Welcome back
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Sign in to your restaurant workspace.
              </p>
            </div>

            <form className="flex flex-col gap-space-lg" onSubmit={submit} noValidate>
              <Field label="Email address" htmlFor="login-email">
                <Input
                  id="login-email"
                  type="email"
                  icon="mail"
                  autoComplete="email"
                  placeholder="you@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field label="Password" htmlFor="login-password">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  icon="lock"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

              <div className="flex items-center justify-between">
                <Checkbox checked={remember} onChange={setRemember} label="Remember me" id="remember" />
                <Link to="/contact" className="font-label-sm text-label-sm font-semibold text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="flex items-start gap-space-sm rounded-xl border border-status-critical/25 bg-status-critical-bg p-space-md">
                  <Icon name="error" size={18} className="mt-0.5 shrink-0 text-status-critical" />
                  <span className="font-body-sm text-body-sm text-on-surface">{error}</span>
                </div>
              )}

              <Button type="submit" size="lg" block loading={loading} iconRight="arrow_forward">
                Sign in
              </Button>
            </form>

            <div className="flex items-center gap-space-sm">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
                or continue with
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-space-sm">
              {['google', 'apple'].map((provider) => (
                <Button
                  key={provider}
                  variant="secondary"
                  block
                  icon={provider === 'google' ? 'g_translate' : 'devices'}
                  onClick={() =>
                    toast.info(
                      `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not enabled in the prototype`,
                      'Use email and password, or a demo account below.',
                    )
                  }
                >
                  {provider === 'google' ? 'Google' : 'Apple'}
                </Button>
              ))}
            </div>

            <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
              New to BiteFlow?{' '}
              <Link to="/signup" className="font-semibold text-primary hover:underline">
                Create your restaurant
              </Link>
            </p>

            {!isSupabaseConfigured && (
              <div className="flex flex-col gap-space-sm rounded-xl border border-slate-200 bg-surface-container-low p-space-md">
                <div className="flex items-center gap-space-xs">
                  <Icon name="info" size={16} className="text-status-info" />
                  <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Demo accounts
                  </span>
                </div>
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    disabled={loading}
                    onClick={() => void quickLogin(account)}
                    className="flex items-start justify-between gap-space-sm rounded-lg bg-white p-space-sm text-left transition-colors hover:bg-surface-container-lowest disabled:opacity-60"
                  >
                    <span className="flex flex-col">
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                        {account.label}
                      </span>
                      <span className="font-label-xs text-label-xs text-on-surface-variant">
                        {account.email} · {account.password}
                      </span>
                    </span>
                    <Icon name="login" size={18} className="mt-0.5 shrink-0 text-primary" />
                  </button>
                ))}
                <p className="font-label-xs text-label-xs text-on-surface-variant">{DEMO_MODE_NOTE}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
