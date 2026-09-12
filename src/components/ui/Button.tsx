import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'danger-ghost' | 'dark'
type Size = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: string
  iconRight?: string
  loading?: boolean
  block?: boolean
  children?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-container active:shadow-inner disabled:bg-slate-200 disabled:text-slate-400 shadow-sm',
  secondary:
    'bg-surface-container-lowest text-slate-800 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:text-slate-400 disabled:bg-slate-50',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300',
  destructive: 'bg-status-critical text-white hover:brightness-95 disabled:bg-slate-200 disabled:text-slate-400',
  'danger-ghost':
    'bg-transparent text-status-critical border border-status-critical/30 hover:bg-status-critical-bg',
  dark: 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-space-md text-label-sm gap-space-xs rounded-lg',
  md: 'h-10 px-space-lg text-label-md gap-space-sm rounded-xl',
  lg: 'h-12 px-space-xl text-label-md gap-space-sm rounded-xl',
  icon: 'h-9 w-9 rounded-lg justify-center',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, loading, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all',
        'disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />
      )}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  )
})
