import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Icon } from '@/components/ui'
import type { OnboardingStepId } from '@/lib/types'

export const ONBOARDING_STEPS: { id: OnboardingStepId; label: string; icon: string }[] = [
  { id: 'account', label: 'Account', icon: 'person' },
  { id: 'restaurant', label: 'Restaurant', icon: 'storefront' },
  { id: 'plan', label: 'Plan', icon: 'sell' },
  { id: 'branding', label: 'Branding', icon: 'palette' },
  { id: 'menu', label: 'Menu', icon: 'restaurant_menu' },
  { id: 'tables', label: 'Tables', icon: 'table_restaurant' },
  { id: 'staff', label: 'Staff', icon: 'badge' },
  { id: 'launch', label: 'Launch', icon: 'rocket_launch' },
]

export function OnboardingShell({
  step,
  children,
  aside,
  footer,
  title,
  description,
}: {
  step: OnboardingStepId
  children: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  title: string
  description?: string
}) {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-slate-200 bg-surface-container-lowest">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-space-md px-space-lg py-space-md">
          <Link to="/" className="flex items-center gap-space-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Icon name="restaurant" size={20} />
            </span>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight">BiteFlow</span>
          </Link>
          <span className="font-label-sm text-label-sm text-on-surface-variant">Setup your restaurant</span>
          <Link
            to="/app/dashboard"
            className="font-label-sm text-label-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            Skip setup
          </Link>
        </div>

        {/* Progress indicator — prd.md §8 */}
        <div className="mx-auto w-full max-w-[1200px] px-space-lg pb-space-md">
          <ol className="no-scrollbar flex items-center gap-space-xs overflow-x-auto">
            {ONBOARDING_STEPS.map((s, i) => {
              const done = i < currentIndex
              const active = i === currentIndex
              return (
                <li key={s.id} className="flex flex-1 items-center gap-space-xs">
                  <div className="flex min-w-0 flex-col items-center gap-space-xs" style={{ minWidth: 68 }}>
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full border-2 text-label-sm font-bold transition-colors',
                        done && 'border-status-success bg-status-success text-white',
                        active && 'border-primary bg-primary text-on-primary',
                        !done && !active && 'border-slate-300 bg-white text-slate-400',
                      )}
                      aria-current={active ? 'step' : undefined}
                    >
                      {done ? <Icon name="check" size={17} /> : <Icon name={s.icon} size={17} />}
                    </span>
                    <span
                      className={cn(
                        'hidden truncate font-label-xs text-label-xs sm:block',
                        active ? 'font-bold text-on-surface' : 'text-on-surface-variant',
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < ONBOARDING_STEPS.length - 1 && (
                    <span
                      className={cn(
                        'mb-5 h-0.5 flex-1 rounded-full',
                        done ? 'bg-status-success' : 'bg-slate-200',
                      )}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </header>

      <main className="flex-1">
        <div
          className={cn(
            'mx-auto grid w-full max-w-[1200px] gap-space-2xl px-space-lg py-space-2xl',
            aside ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : 'max-w-3xl',
          )}
        >
          <div className="flex flex-col gap-space-xl">
            <div className="flex flex-col gap-space-2xs">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-primary">
                Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
              </span>
              <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">{title}</h1>
              {description && (
                <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
              )}
            </div>
            {children}
          </div>
          {aside && <aside className="lg:sticky lg:top-space-lg lg:self-start">{aside}</aside>}
        </div>
      </main>

      {footer && (
        <footer className="sticky bottom-0 border-t border-slate-200 bg-surface-container-lowest/95 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-space-md px-space-lg py-space-md">
            {footer}
          </div>
        </footer>
      )}
    </div>
  )
}
