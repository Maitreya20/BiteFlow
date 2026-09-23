/**
 * Role switching, in the two shapes this app actually has.
 *
 * **Demo mode** — one click between the two seeded sessions. `owner@urbanbean.test`
 * and `admin@biteflow.com` are ordinary rows in the seed dataset (and in
 * supabase/seed.sql), so "switching role" is nothing more than another `signIn()`.
 * The session key is overwritten in place; no sign-out, no reload.
 *
 * **Live mode** — a *super-admin impersonation* flow. The client cannot promote
 * itself, so "view as the tenant owner" means asking the server for that owner's
 * session: `startImpersonation()` calls the `impersonate` Edge Function, which
 * derives the actor from the JWT, has Postgres re-check the `super_admin`
 * membership (writing an immutable audit row), and only then mints the target's
 * session with the service role key. It is time-boxed, and exiting hands the
 * actor's own token back.
 *
 * The control renders nothing for a caller who is not a platform super admin —
 * and even if that check were bypassed, the server would refuse.
 *
 * ## Accessibility
 *
 * Switching role replaces the entire screen, so a sighted user gets the feedback
 * for free (the route and shell change) and a screen reader user would get none.
 * Three things cover that:
 *
 *   • `announce()` — a polite message sent through the shared live region above
 *     the router, so it survives the navigation the switch causes;
 *   • `aria-keyshortcuts` plus a visible hint, so the shortcut is discoverable
 *     rather than folklore;
 *   • an `sr-only` readout of the current role, wired to the control with
 *     `aria-describedby`, so the state can be re-read at any time instead of
 *     only at the moment it changed.
 *
 * Success toasts were dropped in favour of the announcement: the toast region is
 * also `aria-live`, so keeping both made screen readers say it twice. Errors
 * still toast — those are not the same message twice.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Icon, SegmentedControl, useToast } from '@/components/ui'
import { IMPERSONATION_HOME, signIn } from '@/data/api'
import { announce } from '@/lib/announce'
import { DEMO_ACCOUNTS } from '@/lib/constants'
import { useAppStore } from '@/store/AppStore'

/** Recorded on the audit row; the reason a human typed would be better still. */
const IMPERSONATION_REASON = 'Entered from the platform admin console'

/** Toggling is a dev/demo affordance, so a modifier keeps it out of the way. */
const ROLE_SHORTCUT = 'Alt+Shift+R'

type DemoRoleKey = 'owner' | 'admin'

interface DemoRole {
  key: DemoRoleKey
  email: string
  /** Compact label for the header tabs. */
  short: string
  icon: string
  /** Where that role belongs after signing in. */
  home: string
}

const DEMO_ROLES: DemoRole[] = [
  { key: 'owner', email: 'owner@urbanbean.test', short: 'Owner', icon: 'storefront', home: '/app/dashboard' },
  { key: 'admin', email: 'admin@biteflow.com', short: 'Admin', icon: 'shield_person', home: '/admin' },
]

const accountFor = (email: string) => DEMO_ACCOUNTS.find((account) => account.email === email)

/** True when a keystroke belongs to whatever the user is typing into. */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable
  )
}

/**
 * Globally toggle the role. Deliberately narrow: never while typing, never from
 * inside a modal (the user is mid-task elsewhere), and never when there is no
 * single obvious target — a super admin who is not impersonating has to pick a
 * tenant, so the shortcut stays inert.
 */
function useRoleShortcut({ enabled, run }: { enabled: boolean; run: (() => void) | null }) {
  useEffect(() => {
    if (!enabled || !run) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || !event.shiftKey || event.repeat || !/^r$/i.test(event.key)) return
      // Real keyboard events target the focused element and bubble to the window,
      // so `target` is normally enough. Checking `activeElement` too covers events
      // that arrive pre-targeted (extensions, programmatic dispatch) and keeps the
      // "never steal a keystroke from a text field" promise unconditional.
      if (isTypingTarget(event.target) || isTypingTarget(document.activeElement)) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      event.preventDefault()
      run()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, run])
}

function useDemoRoleSwitch() {
  const { session, mode } = useAppStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState<DemoRoleKey | null>(null)

  const current = useMemo<DemoRoleKey | null>(() => {
    const email = session?.user.email?.toLowerCase()
    if (!email) return null
    return DEMO_ROLES.find((role) => role.email === email)?.key ?? null
  }, [session?.user.email])

  const switchTo = useCallback(
    async (key: DemoRoleKey) => {
      if (key === current) return
      const role = DEMO_ROLES.find((candidate) => candidate.key === key)
      const account = role ? accountFor(role.email) : undefined
      if (!role || !account) return

      setSwitching(key)
      try {
        await signIn(account.email, account.password)
        announce(`Acting as ${account.label}. Press ${ROLE_SHORTCUT} to switch roles.`)
        navigate(role.home)
      } catch (error) {
        toast.error('Could not switch demo role', error instanceof Error ? error.message : undefined)
      } finally {
        setSwitching(null)
      }
    },
    [current, navigate, toast],
  )

  const toggle = useCallback(() => {
    const other = DEMO_ROLES.find((role) => role.key !== current)
    if (other) void switchTo(other.key)
  }, [current, switchTo])

  return { enabled: mode === 'demo', current, switching, switchTo, toggle }
}

function useImpersonation() {
  const { mode, db, impersonation, canImpersonate, startImpersonation, endImpersonation } = useAppStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)

  // A super admin can read every tenant (RLS), so this is the whole estate.
  const organizations = useMemo(
    () => [...db.organizations].sort((a, b) => a.name.localeCompare(b.name)),
    [db.organizations],
  )

  const enter = useCallback(
    async (organizationId: string) => {
      setBusy(organizationId)
      try {
        await startImpersonation(organizationId, IMPERSONATION_REASON)
        const name = organizations.find((o) => o.id === organizationId)?.name ?? 'the tenant'
        announce(
          `Impersonating ${name}. You now hold the tenant owner's access. Press ${ROLE_SHORTCUT} to exit.`,
        )
        navigate(IMPERSONATION_HOME)
      } catch (error) {
        toast.error('Could not impersonate tenant', error instanceof Error ? error.message : undefined)
      } finally {
        setBusy(null)
      }
    },
    [navigate, organizations, startImpersonation, toast],
  )

  const exit = useCallback(async () => {
    setBusy('exit')
    try {
      await endImpersonation()
      announce(`Impersonation ended. Acting as ${DEMO_ACCOUNTS[1].label}.`)
      navigate('/admin')
    } catch (error) {
      toast.error('Could not exit impersonation', error instanceof Error ? error.message : undefined)
    } finally {
      setBusy(null)
    }
  }, [endImpersonation, navigate, toast])

  return {
    enabled: mode === 'live' && (canImpersonate || impersonation !== null),
    impersonation,
    organizations,
    busy,
    enter,
    exit,
  }
}

/**
 * `tabs` renders the header shortcut (hidden below `md`, where the account menu
 * carries the same actions); `menu` renders the list inside the account menu.
 *
 * Only the `tabs` instance owns the global shortcut and the `aria-describedby`
 * readout: `menu` is a second rendering of the same controls inside a dropdown,
 * and registering a second key listener would toggle twice.
 */
export function RoleSwitcher({ presentation = 'tabs' }: { presentation?: 'tabs' | 'menu' }) {
  const demo = useDemoRoleSwitch()
  const live = useImpersonation()
  const primary = presentation !== 'menu'

  // Stable identity: the hook re-registers its listener whenever `run` changes,
  // and this component re-renders on every store update.
  const exitImpersonation = useCallback(() => {
    void live.exit()
  }, [live.exit])

  // In live mode the only one-keystroke action with an unambiguous target is
  // leaving the tenant; entering one needs a tenant choice.
  const shortcutRun = live.enabled
    ? live.impersonation
      ? exitImpersonation
      : null
    : demo.enabled
      ? demo.toggle
      : null
  useRoleShortcut({ enabled: primary && shortcutRun !== null, run: shortcutRun })

  const readout = live.impersonation
    ? `Impersonating ${live.impersonation.organizationName} as ${live.impersonation.targetEmail}. Press ${ROLE_SHORTCUT} to exit.`
    : live.enabled
      ? 'Platform super admin. Choose a tenant to impersonate.'
      : demo.current
        ? `Acting as ${accountFor(DEMO_ROLES.find((r) => r.key === demo.current)?.email ?? '')?.label ?? demo.current}. Press ${ROLE_SHORTCUT} to switch.`
        : ''

  const describedBy = primary && readout ? 'role-switcher-status' : undefined

  if (live.enabled) {
    return (
      <>
        {primary && <StatusReadout id="role-switcher-status" text={readout} />}
        {presentation === 'menu' ? (
          <LiveMenu {...live} />
        ) : (
          <LiveHeader {...live} describedBy={describedBy} />
        )}
      </>
    )
  }

  if (!demo.enabled) return null

  if (presentation === 'menu') {
    return (
      <>
        <div className="border-t border-slate-200 py-space-xs">
          <span className="block px-space-md pb-1 pt-space-xs font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Demo session
          </span>
          {DEMO_ROLES.map((role) => {
            const account = accountFor(role.email)
            if (!account) return null
            const active = role.key === demo.current
            const busy = demo.switching === role.key

            return (
              <button
                key={role.key}
                type="button"
                disabled={busy}
                onClick={() => void demo.switchTo(role.key)}
                className="flex w-full items-start gap-space-sm px-space-md py-space-sm text-left hover:bg-surface-container-low disabled:opacity-60"
              >
                <Icon name={role.icon} size={17} className="mt-0.5 shrink-0 text-primary" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {account.label}
                  </span>
                  <span className="font-label-xs text-label-xs text-on-surface-variant">
                    {account.description}
                  </span>
                </span>
                <Icon
                  name={active ? 'check' : 'login'}
                  size={16}
                  className="mt-0.5 shrink-0 text-primary"
                  title={active ? 'Current session' : undefined}
                />
              </button>
            )
          })}
          <p className="px-space-md pt-space-xs font-label-xs text-label-xs text-on-surface-variant">
            Keyboard: <kbd className="font-semibold">{ROLE_SHORTCUT}</kbd> switches roles
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      {primary && <StatusReadout id="role-switcher-status" text={readout} />}
      <div className="hidden md:block">
        <SegmentedControl
          size="sm"
          label="Switch demo role"
          keyShortcuts={ROLE_SHORTCUT}
          describedBy={describedBy}
          // `none` is deliberately not an option, so a signed-up demo account shows
          // both tabs as inactive instead of misrepresenting the current role.
          value={demo.current ?? 'none'}
          onChange={(next) => {
            if (next !== 'none') void demo.switchTo(next)
          }}
          options={DEMO_ROLES.map((role) => ({
            value: role.key,
            label: role.short,
            icon: role.icon,
          }))}
        />
      </div>
    </>
  )
}

/**
 * The role is otherwise only conveyed by *which* tab looks pressed — invisible to
 * a screen reader, and unpickable once focus has moved on. This makes the state
 * re-readable at any time; it is not a live region, so it never shouts.
 */
function StatusReadout({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="sr-only">
      {text}
    </p>
  )
}

type LiveSwitcher = ReturnType<typeof useImpersonation>

function LiveHeader({
  impersonation,
  organizations,
  busy,
  enter,
  exit,
  describedBy,
}: LiveSwitcher & { describedBy?: string }) {
  if (impersonation) {
    return (
      <div className="hidden md:block">
        <Button
          size="sm"
          variant="danger-ghost"
          icon="logout"
          loading={busy === 'exit'}
          aria-keyshortcuts={ROLE_SHORTCUT}
          aria-describedby={describedBy}
          onClick={() => void exit()}
        >
          Exit impersonation
        </Button>
      </div>
    )
  }

  return (
    <div className="hidden md:block">
      <label htmlFor="impersonate-tenant" className="sr-only">
        Impersonate tenant
      </label>
      <select
        id="impersonate-tenant"
        value=""
        disabled={busy !== null}
        aria-describedby={describedBy}
        onChange={(event) => {
          if (event.target.value) void enter(event.target.value)
        }}
        className="h-8 rounded-lg border border-slate-300 bg-surface-container-lowest px-space-sm font-label-sm text-label-sm font-semibold text-slate-800 disabled:opacity-60"
      >
        <option value="" disabled>
          View as tenant…
        </option>
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function LiveMenu({ impersonation, organizations, busy, enter, exit }: LiveSwitcher) {
  if (impersonation) {
    return (
      <div className="border-t border-slate-200 py-space-xs">
        <span className="block px-space-md pb-1 pt-space-xs font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Impersonating
        </span>
        <p className="px-space-md pb-space-xs font-label-xs text-label-xs text-on-surface-variant">
          {impersonation.organizationName} · {impersonation.targetEmail}
        </p>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void exit()}
          className="flex w-full items-center gap-space-sm px-space-md py-space-sm text-left font-body-sm text-body-sm text-status-critical hover:bg-status-critical-bg disabled:opacity-60"
        >
          <Icon name="logout" size={17} /> Exit impersonation
        </button>
        <p className="px-space-md pt-space-xs font-label-xs text-label-xs text-on-surface-variant">
          Keyboard: <kbd className="font-semibold">{ROLE_SHORTCUT}</kbd> exits
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-slate-200 py-space-xs">
      <span className="block px-space-md pb-1 pt-space-xs font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
        Impersonate tenant
      </span>
      {organizations.map((organization) => (
        <button
          key={organization.id}
          type="button"
          disabled={busy !== null}
          onClick={() => void enter(organization.id)}
          className="flex w-full items-start gap-space-sm px-space-md py-space-sm text-left hover:bg-surface-container-low disabled:opacity-60"
        >
          <Icon name="storefront" size={17} className="mt-0.5 shrink-0 text-primary" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-label-sm text-label-sm font-semibold text-on-surface">
              {organization.name}
            </span>
            <span className="font-label-xs text-label-xs text-on-surface-variant">
              Sign in as the tenant owner, audited
            </span>
          </span>
          <Icon name="login" size={16} className="mt-0.5 shrink-0 text-primary" />
        </button>
      ))}
      {!organizations.length && (
        <p className="px-space-md py-space-sm font-label-xs text-label-xs text-on-surface-variant">
          No tenants visible.
        </p>
      )}
    </div>
  )
}
