import { cn } from '@/lib/cn'

export interface IconProps {
  /** Material Symbols ligature name, e.g. "grid_view". */
  name: string
  size?: number
  filled?: boolean
  className?: string
  title?: string
}

/**
 * Material Symbols Outlined wrapper — the single icon system shared by every
 * screen (design.md §39: same icon style across all screens).
 */
export function Icon({ name, size = 18, filled = false, className, title }: IconProps) {
  return (
    <span
      aria-hidden={title ? undefined : true}
      aria-label={title}
      role={title ? 'img' : undefined}
      className={cn('material-symbols-outlined', filled && 'icon-filled', className)}
      style={{ fontSize: size, width: size, height: size }}
    >
      {name}
    </span>
  )
}
