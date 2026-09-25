import { Button, Icon } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/AppStore'
import type { ConnectionStatus } from '@/data/api'

/**
 * Staff-facing answer to "are these numbers live?".
 *
 * Four states, one place: the dashboard header.
 *   • Live       green  — realtime socket subscribed; Postgres changes stream in
 *   • Connecting amber  — socket requested or retrying after a drop
 *   • Offline    red    — CHANNEL_ERROR / TIMED_OUT; screen is stale by definition
 *   • Demo       grey   — no backend; data is local, synced across tabs only
 *
 * The offline state is the one that matters: a stale dashboard that claims
 * nothing is worse than one that admits it. That is why the chip grows a
 * Refresh action exactly when the status is degraded.
 */

const STATES: Record<
  ConnectionStatus,
  { label: string; hint: string; className: string; dot: string; pulse?: boolean }
> = {
  live: {
    label: 'Live',
    hint: 'Realtime connected — updates stream in automatically.',
    className: 'bg-status-success-bg text-status-success',
    dot: 'bg-status-success',
    pulse: true,
  },
  connecting: {
    label: 'Connecting…',
    hint: 'Connecting to realtime — retrying automatically.',
    className: 'bg-status-warning-bg text-status-warning',
    dot: 'bg-status-warning',
    pulse: true,
  },
  degraded: {
    label: 'Offline',
    hint: 'Realtime connection lost. The dashboard may be showing stale data — refresh to catch up.',
    className: 'bg-status-critical-bg text-status-critical',
    dot: 'bg-status-critical',
  },
  demo: {
    label: 'Demo',
    hint: 'Demo mode — sample data stored on this device, synced across open tabs. Connect Supabase for live multi-device ordering.',
    className: 'bg-surface-container-high text-on-surface-variant',
    dot: 'bg-on-surface-variant',
  },
}

export function ConnectionBadge({ className }: { className?: string }) {
  const { realtimeStatus, refresh } = useAppStore()
  const state = STATES[realtimeStatus]

  return (
    <span
      role="status"
      aria-label={`Connection: ${state.label}. ${state.hint}`}
      title={state.hint}
      className={cn(
        'inline-flex items-center gap-space-xs rounded-full px-space-md py-1',
        state.className,
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        {state.pulse && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', state.dot)} />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', state.dot)} />
      </span>
      <span className="font-label-xs text-label-xs font-semibold whitespace-nowrap">{state.label}</span>
      {realtimeStatus === 'degraded' && (
        <>
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => void refresh()}>
            Refresh
          </Button>
          <Icon name="wifi_off" size={14} className="opacity-70" />
        </>
      )}
    </span>
  )
}
