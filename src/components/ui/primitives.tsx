import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { avatarStyle, foodEmoji, foodTileStyle, initials } from '@/lib/format'

/* -------------------------------------------------------------------- Card */

export function Card({
  children,
  className,
  as: Tag = 'div',
  padded = true,
  interactive = false,
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'aside'
  padded?: boolean
  interactive?: boolean
}) {
  return (
    <Tag
      className={cn(
        'rounded-2xl bg-surface-container-lowest border border-slate-200/80 shadow-e1',
        padded && 'p-space-lg',
        interactive && 'transition-shadow hover:shadow-e2',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  badge,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: string
  action?: ReactNode
  badge?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-space-md', className)}>
      <div className="flex items-start gap-space-md min-w-0">
        {icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary">
            <Icon name={icon} size={20} />
          </span>
        )}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-space-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{title}</h2>
            {badge}
          </div>
          {subtitle && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-space-xs">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------- Badge */

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'critical'
  | 'info'
  | 'slate'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-container-high text-on-surface-variant',
  brand: 'bg-ember-100 text-ember-700',
  success: 'bg-status-success-bg text-status-success',
  warning: 'bg-status-warning-bg text-status-warning',
  critical: 'bg-status-critical-bg text-status-critical',
  info: 'bg-status-info-bg text-status-info',
  slate: 'bg-slate-900 text-white',
}

export function Badge({
  children,
  tone = 'neutral',
  icon,
  dot,
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  icon?: string
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-space-xs py-0.5 font-label-xs text-label-xs font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  )
}

/* --------------------------------------------------------------- Empty/Error */

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-space-sm rounded-2xl border border-dashed border-slate-300 bg-surface-container-lowest px-space-xl py-space-3xl text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-low text-primary">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
      {description && (
        <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">{description}</p>
      )}
      {action && <div className="pt-space-xs">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description = "We couldn't load this data.",
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-space-sm rounded-2xl border border-status-critical/25 bg-status-critical-bg px-space-xl py-space-2xl text-center',
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-status-critical">
        <Icon name="error" size={22} />
      </span>
      <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
      <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-space-xs rounded-lg bg-status-critical px-space-lg py-space-xs font-label-sm text-label-sm font-semibold text-white"
        >
          Try again
        </button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-slate-200/70',
        'after:absolute after:inset-0 after:animate-[bf-shimmer_1.4s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent',
        className,
      )}
    />
  )
}

export function SkeletonCard() {
  return (
    <Card className="flex flex-col gap-space-md">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-full" />
    </Card>
  )
}

/* -------------------------------------------------------------- Meters */

export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  className,
  label,
}: {
  value: number
  max?: number
  tone?: 'brand' | 'success' | 'warning' | 'critical'
  className?: string
  label?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const tones = {
    brand: 'bg-primary',
    success: 'bg-status-success',
    warning: 'bg-status-warning',
    critical: 'bg-status-critical',
  }
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-container-highest', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** Plan-usage meter used on Billing + limit states (design.md §18, §35). */
export function LimitMeter({
  label,
  used,
  limit,
  unit,
}: {
  label: string
  used: number
  limit: number
  unit?: string
}) {
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
  const tone = pct >= 95 ? 'critical' : pct >= 75 ? 'warning' : 'brand'
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex items-baseline justify-between">
        <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
        <span className="tabular font-label-sm text-label-sm font-semibold text-on-surface">
          {used.toLocaleString('en-IN')}
          {unit ?? ''}
          <span className="text-on-surface-variant font-normal">
            {' / '}
            {limit >= 9999 ? '∞' : limit.toLocaleString('en-IN')}
            {unit ?? ''}
          </span>
        </span>
      </div>
      <ProgressBar value={used} max={limit} tone={tone} label={label} />
      {pct >= 90 && limit < 9999 && (
        <span className="font-label-xs text-label-xs text-status-critical">
          {pct >= 100 ? 'Limit reached — upgrade to continue' : `${pct}% of plan limit used`}
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Avatar */

export function Avatar({
  name,
  size = 36,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const style = avatarStyle(name)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-label-sm text-label-sm font-bold',
        className,
      )}
      style={{ ...style, width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name) || '?'}
    </span>
  )
}

/** Food imagery: real photo when available, otherwise a deterministic warm tile. */
export function FoodThumb({
  name,
  imageUrl,
  className,
  size = 56,
  rounded = 'rounded-xl',
  emojiSize,
}: {
  name: string
  imageUrl?: string | null
  className?: string
  size?: number
  rounded?: string
  emojiSize?: number
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        className={cn('shrink-0 object-cover', rounded, className)}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center', rounded, className)}
      style={{ ...foodTileStyle(name), width: size, height: size }}
      aria-hidden
    >
      <span style={{ fontSize: emojiSize ?? size * 0.5, lineHeight: 1 }}>{foodEmoji(name)}</span>
    </span>
  )
}

/* ------------------------------------------------------------------- Misc */

export function StatDelta({ value, label }: { value: number; label?: string }) {
  const positive = value >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-label-xs text-label-xs font-semibold',
        positive ? 'text-status-success' : 'text-status-critical',
      )}
    >
      <Icon name={positive ? 'trending_up' : 'trending_down'} size={15} />
      {positive ? '+' : ''}
      {value.toFixed(1)}%
      {label && <span className="text-on-surface-variant font-normal">{label}</span>}
    </span>
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-slate-200', className)} />
}

/** Metric card — design.md §7 / §31. */
export function MetricCard({
  label,
  value,
  icon,
  delta,
  hint,
  tone = 'brand',
  progress,
  footer,
}: {
  label: string
  value: ReactNode
  icon: string
  delta?: number
  hint?: ReactNode
  tone?: 'brand' | 'info' | 'warning' | 'success' | 'neutral'
  progress?: { value: number; max: number }
  footer?: ReactNode
}) {
  const toneClasses = {
    brand: 'bg-surface-container-low text-primary',
    info: 'bg-status-info-bg text-status-info',
    warning: 'bg-status-warning-bg text-status-warning',
    success: 'bg-status-success-bg text-status-success',
    neutral: 'bg-surface-container-high text-on-surface',
  }
  return (
    <Card className="flex flex-col justify-between gap-space-md" interactive>
      <div className="flex items-start justify-between gap-space-sm">
        <div className="flex flex-col gap-1 min-w-0">
          <SectionLabel>{label}</SectionLabel>
          <span className="tabular font-mono-metric text-mono-metric text-on-surface truncate">
            {value}
          </span>
        </div>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            toneClasses[tone],
          )}
        >
          <Icon name={icon} size={22} />
        </span>
      </div>
      <div className="flex flex-col gap-space-xs">
        {progress && <ProgressBar value={progress.value} max={progress.max} />}
        {delta !== undefined && <StatDelta value={delta} label={hint as string} />}
        {delta === undefined && hint && (
          <span className="font-body-sm text-body-sm text-on-surface-variant">{hint}</span>
        )}
        {footer}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------- Tabs */

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; icon?: string; count?: number }[]
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl bg-surface-container-low p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-label-sm text-label-sm font-semibold transition-colors whitespace-nowrap',
              size === 'sm' ? 'px-space-sm py-1' : 'px-space-md py-1.5',
              active
                ? 'bg-surface-container-lowest text-on-surface shadow-e1'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {opt.icon && <Icon name={opt.icon} size={15} />}
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 font-label-xs text-label-xs',
                  active ? 'bg-primary text-on-primary' : 'bg-surface-container-highest',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-space-sm', className)}>{children}</div>
  )
}
