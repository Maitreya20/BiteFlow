import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { Skeleton } from './primitives'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  width?: string
  hideBelow?: 'sm' | 'md' | 'lg'
  /** Sticky right-hand action column (design.md §31). */
  sticky?: boolean
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  loading,
  rowClassName,
  density = 'comfortable',
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: ReactNode
  loading?: boolean
  rowClassName?: (row: T) => string
  density?: 'comfortable' | 'compact'
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv)) * factor
    })
  }, [rows, sort, columns])

  const hideClass = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }

  if (loading) {
    return (
      <div className="flex flex-col gap-space-sm p-space-lg">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    )
  }

  if (!rows.length && empty) return <>{empty}</>

  return (
    <div className="scroll-slim w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => {
              const active = sort?.key === col.key
              return (
                <th
                  key={col.key}
                  scope="col"
                  style={{ width: col.width }}
                  className={cn(
                    'px-space-lg py-space-sm text-left font-label-xs text-label-xs font-bold uppercase tracking-wider text-slate-500',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.hideBelow && hideClass[col.hideBelow],
                    col.sticky && 'sticky right-0 bg-slate-50',
                  )}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((prev) =>
                          prev?.key === col.key
                            ? { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                            : { key: col.key, dir: 'asc' },
                        )
                      }
                      className={cn(
                        'inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-800',
                        col.align === 'right' && 'flex-row-reverse',
                        active && 'text-slate-900',
                      )}
                    >
                      {col.header}
                      <Icon
                        name={active ? (sort!.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        size={13}
                      />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onRowClick(row)
                      }
                    }
                  : undefined
              }
              className={cn(
                'border-b border-slate-200/70 transition-colors',
                onRowClick && 'cursor-pointer hover:bg-slate-50/80 focus-visible:bg-slate-50',
                density === 'compact' ? 'h-12' : 'h-[52px]',
                rowClassName?.(row),
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-space-lg py-space-sm font-body-sm text-body-sm text-on-surface',
                    col.align === 'right' && 'text-right tabular',
                    col.align === 'center' && 'text-center',
                    col.hideBelow && hideClass[col.hideBelow],
                    col.sticky && 'sticky right-0 bg-surface-container-lowest',
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
