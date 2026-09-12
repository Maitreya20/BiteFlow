import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

const CONTROL =
  'w-full rounded-xl border-[1.5px] border-slate-200 bg-white text-on-surface placeholder:text-slate-400 ' +
  'transition-shadow focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_15%,transparent)] ' +
  'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed'

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn('flex flex-col gap-space-xs', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="font-label-sm text-label-sm font-semibold text-on-surface flex items-center gap-1"
        >
          {label}
          {required && (
            <span className="text-status-critical" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <span className="flex items-center gap-1 font-label-xs text-label-xs text-status-critical">
          <Icon name="error" size={13} />
          {error}
        </span>
      ) : (
        hint && <span className="font-label-xs text-label-xs text-on-surface-variant">{hint}</span>
      )}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: string
  suffix?: ReactNode
  invalid?: boolean
  controlSize?: 'md' | 'lg'
  /** Convenience wrapper so callers can skip <Field> for simple labelled inputs. */
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, suffix, invalid, controlSize = 'md', className, label, id, ...rest },
  ref,
) {
  const control = (
    <div className="relative flex items-center">
      {icon && (
        <Icon
          name={icon}
          size={18}
          className="absolute left-space-md text-on-surface-variant pointer-events-none"
        />
      )}
      <input
        ref={ref}
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL,
          controlSize === 'lg' ? 'h-12 px-space-lg' : 'h-[42px] px-space-md',
          'font-body-sm text-body-sm',
          icon && 'pl-10',
          Boolean(suffix) && 'pr-10',
          invalid && 'border-status-critical',
          className,
        )}
        {...rest}
      />
      {suffix && <span className="absolute right-space-md flex items-center">{suffix}</span>}
    </div>
  )

  if (!label) return control
  return (
    <div className="flex flex-col gap-space-xs">
      <label htmlFor={id} className="font-label-sm text-label-sm font-semibold text-on-surface">
        {label}
      </label>
      {control}
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(CONTROL, 'px-space-md py-space-sm font-body-sm text-body-sm resize-y', className)}
        {...rest}
      />
    )
  },
)

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string; disabled?: boolean }[]
  invalid?: boolean
  controlSize?: 'md' | 'lg'
  /** Convenience wrapper so callers can skip <Field> for simple labelled selects. */
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, invalid, controlSize = 'md', className, label, id, ...rest },
  ref,
) {
  const control = (
    <div className="relative">
      <select
        ref={ref}
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL,
          controlSize === 'lg' ? 'h-12' : 'h-[42px]',
          'appearance-none px-space-md pr-10 font-body-sm text-body-sm',
          invalid && 'border-status-critical',
          className,
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        size={18}
        className="pointer-events-none absolute right-space-md top-1/2 -translate-y-1/2 text-on-surface-variant"
      />
    </div>
  )

  if (!label) return control
  return (
    <div className="flex flex-col gap-space-xs">
      <label htmlFor={id} className="font-label-sm text-label-sm font-semibold text-on-surface">
        {label}
      </label>
      {control}
    </div>
  )
})

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  id?: string
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex items-start gap-space-md',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors',
          checked ? 'border-primary bg-primary' : 'border-slate-300 bg-slate-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
          style={{ width: 18, height: 18 }}
        />
      </button>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="font-label-md text-label-md text-on-surface">{label}</span>}
          {description && (
            <span className="font-body-sm text-body-sm text-on-surface-variant">{description}</span>
          )}
        </span>
      )}
    </label>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  disabled?: boolean
  id?: string
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex items-center gap-space-sm font-body-sm text-body-sm text-on-surface',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors',
          checked ? 'border-primary bg-primary' : 'border-slate-300 bg-white',
        )}
      >
        {checked && <Icon name="check" size={13} className="text-on-primary" />}
      </button>
      {label}
    </label>
  )
}

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  name,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; description?: string }[]
  name: string
  className?: string
}) {
  return (
    <div role="radiogroup" className={cn('flex flex-col gap-space-sm', className)}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <label
            key={opt.value}
            className={cn(
              'flex cursor-pointer items-start gap-space-md rounded-xl border-[1.5px] p-space-md transition-colors',
              active ? 'border-primary bg-ember-50' : 'border-slate-200 bg-white hover:bg-slate-50',
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={active}
              onChange={() => onChange(opt.value)}
            />
            <span
              className={cn(
                'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]',
                active ? 'border-primary bg-primary' : 'border-slate-300 bg-white',
              )}
            >
              {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-label-md text-label-md text-on-surface">{opt.label}</span>
              {opt.description && (
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {opt.description}
                </span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  onClear,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onClear?: () => void
}) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Icon
        name="search"
        size={18}
        className="absolute left-space-md text-on-surface-variant pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(CONTROL, 'h-[42px] pl-10 pr-10 font-body-sm text-body-sm')}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => (onClear ? onClear() : onChange(''))}
          className="absolute right-space-sm flex h-6 w-6 items-center justify-center rounded-md text-on-surface-variant hover:bg-slate-100"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  )
}

/** Branding editor colour picker (design.md §19). */
export function ColorSwatchPicker({
  value,
  onChange,
  swatches,
  label,
}: {
  value: string
  onChange: (value: string) => void
  swatches: { name: string; value: string }[]
  label: string
}) {
  return (
    <div className="flex flex-col gap-space-sm">
      <span className="font-label-sm text-label-sm font-semibold text-on-surface">{label}</span>
      <div className="flex flex-wrap items-center gap-space-xs">
        {swatches.map((s) => (
          <button
            key={s.value}
            type="button"
            title={s.name}
            aria-label={`${label}: ${s.name}`}
            onClick={() => onChange(s.value)}
            className={cn(
              'h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110',
              value.toLowerCase() === s.value.toLowerCase()
                ? 'border-slate-900 ring-2 ring-slate-900/15'
                : 'border-white shadow-e1',
            )}
            style={{ background: s.value }}
          />
        ))}
        <label className="relative ml-space-xs flex h-8 cursor-pointer items-center gap-space-xs rounded-lg border border-slate-300 bg-white px-space-sm font-label-xs text-label-xs">
          <Icon name="palette" size={15} />
          Custom
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={`${label} custom colour`}
          />
        </label>
        <span className="tabular font-label-xs text-label-xs text-on-surface-variant">{value}</span>
      </div>
    </div>
  )
}
