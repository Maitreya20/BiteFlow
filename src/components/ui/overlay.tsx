import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { Button } from './Button'

/* ------------------------------------------------------------------ utils */

function useLockBody(active: boolean) {
  useEffect(() => {
    if (!active) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [active])
}

function useEscape(active: boolean, onEscape?: () => void) {
  useEffect(() => {
    if (!active || !onEscape) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onEscape])
}

function Backdrop({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Close overlay"
      onClick={onClick}
      className="fixed inset-0 z-40 cursor-default bg-slate-950/45 backdrop-blur-[2px]"
    />
  )
}

/* ------------------------------------------------------------------ Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  icon,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: string
}) {
  useLockBody(open)
  useEscape(open, onClose)
  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-space-lg">
      <Backdrop onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'anim-sheet sm:anim-fade-up relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden',
          'rounded-t-2xl sm:rounded-2xl bg-surface-container-lowest shadow-e3',
          widths[size],
        )}
      >
        <header className="flex items-start justify-between gap-space-md border-b border-slate-200 px-space-xl py-space-lg">
          <div className="flex items-start gap-space-md">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                <Icon name={icon} size={20} />
              </span>
            )}
            <div className="flex flex-col gap-0.5">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
              {description && (
                <p className="font-body-sm text-body-sm text-on-surface-variant">{description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-slate-100"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="scroll-slim flex-1 overflow-y-auto px-space-xl py-space-lg">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-space-sm border-t border-slate-200 bg-surface-container-low px-space-xl py-space-md">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- Drawer */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
  side = 'right',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
  side?: 'right' | 'bottom'
}) {
  useLockBody(open)
  useEscape(open, onClose)
  if (!open) return null

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-[480px]', lg: 'sm:max-w-[620px]' }

  return (
    <div className="fixed inset-0 z-50 flex">
      <Backdrop onClick={onClose} />
      {side === 'right' ? (
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : 'Panel'}
          className={cn(
            'anim-drawer relative z-10 ml-auto flex h-full w-full flex-col bg-surface-container-lowest shadow-e3',
            widths[width],
          )}
        >
          <header className="flex items-start justify-between gap-space-md border-b border-slate-200 px-space-xl py-space-lg">
            <div className="flex flex-col gap-0.5 min-w-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{title}</h2>
              {subtitle && (
                <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-slate-100"
            >
              <Icon name="close" size={18} />
            </button>
          </header>
          <div className="scroll-slim flex-1 overflow-y-auto">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-space-sm border-t border-slate-200 bg-surface-container-low px-space-xl py-space-md">
              {footer}
            </footer>
          )}
        </aside>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          className="anim-sheet relative z-10 mt-auto flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-surface-container-lowest shadow-e3"
        >
          <header className="flex items-center justify-between gap-space-md border-b border-slate-200 px-space-lg py-space-md">
            <h2 className="font-headline-sm text-headline-sm">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-slate-100"
            >
              <Icon name="close" size={18} />
            </button>
          </header>
          <div className="pb-safe scroll-slim flex-1 overflow-y-auto p-space-lg">{children}</div>
          {footer && (
            <footer className="pb-safe border-t border-slate-200 p-space-lg">{footer}</footer>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------- ConfirmDialog */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="font-body-md text-body-md text-on-surface-variant">{message}</div>
    </Modal>
  )
}

/* ------------------------------------------------------------------- Toast */

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  body?: string
}

interface ToastApi {
  push: (tone: ToastTone, title: string, body?: string) => void
  success: (title: string, body?: string) => void
  error: (title: string, body?: string) => void
  info: (title: string, body?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TOAST_STYLES: Record<ToastTone, { icon: string; className: string }> = {
  success: { icon: 'check_circle', className: 'border-status-success/30 text-status-success' },
  error: { icon: 'error', className: 'border-status-critical/30 text-status-critical' },
  info: { icon: 'info', className: 'border-status-info/30 text-status-info' },
  warning: { icon: 'warning', className: 'border-status-warning/30 text-status-warning' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const push = useCallback((tone: ToastTone, title: string, body?: string) => {
    const id = ++counter.current
    setItems((prev) => [...prev.slice(-3), { id, tone, title, body }])
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4200)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, body) => push('success', title, body),
      error: (title, body) => push('error', title, body),
      info: (title, body) => push('info', title, body),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-space-lg right-space-lg z-[60] flex w-[min(92vw,360px)] flex-col gap-space-sm"
      >
        {items.map((item) => {
          const style = TOAST_STYLES[item.tone]
          return (
            <div
              key={item.id}
              className={cn(
                'anim-fade-up pointer-events-auto flex items-start gap-space-md rounded-xl border bg-surface-container-lowest p-space-md shadow-e3',
                style.className,
              )}
            >
              <Icon name={style.icon} size={20} className="mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  {item.title}
                </span>
                {item.body && (
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{item.body}</span>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-slate-100"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
