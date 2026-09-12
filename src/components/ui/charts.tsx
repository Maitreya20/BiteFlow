/**
 * Chart primitives — deliberately dependency-free SVG.
 * design.md §17 asks for charts that are "simple and readable"; §1 warns against
 * too many charts, so these four cover every analytics surface.
 */
import { useId, useState } from 'react'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'

export interface ChartPoint {
  label: string
  value: number
  highlight?: boolean
  note?: string
}

/* ------------------------------------------------------------------ Bar */

export function BarChart({
  data,
  height = 224,
  currency = 'INR',
  className,
  valueFormatter,
}: {
  data: ChartPoint[]
  height?: number
  currency?: string
  className?: string
  valueFormatter?: (value: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const fmt = valueFormatter ?? ((v: number) => formatMoney(v, currency, { compact: true }))

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end gap-1.5 sm:gap-2.5" style={{ height }}>
        {data.map((point, i) => {
          const pct = Math.max(2, (point.value / max) * 100)
          const active = hover === i
          return (
            <div
              key={point.label + i}
              className="group relative flex h-full flex-1 flex-col items-center justify-end gap-space-xs"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {point.note && (
                <span
                  className={cn(
                    'absolute -top-1 hidden whitespace-nowrap rounded bg-primary px-1.5 py-0.5 font-label-xs text-label-xs font-semibold text-on-primary shadow-sm sm:block',
                    point.highlight && 'sm:block',
                  )}
                  style={{ display: point.highlight ? undefined : 'none' }}
                >
                  {point.note}
                </span>
              )}
              <span
                className={cn(
                  'tabular rounded px-1 font-label-xs text-label-xs text-on-surface-variant transition-opacity',
                  active ? 'opacity-100' : 'opacity-0',
                )}
              >
                {fmt(point.value)}
              </span>
              <div
                className={cn(
                  'w-full max-w-[30px] rounded-t-md transition-colors',
                  point.highlight ? 'bg-primary' : active ? 'bg-ember-500' : 'bg-surface-container-highest',
                )}
                style={{ height: `${pct}%` }}
                role="img"
                aria-label={`${point.label}: ${fmt(point.value)}`}
              />
              <span
                className={cn(
                  'font-label-xs text-label-xs',
                  point.highlight ? 'font-bold text-primary' : 'text-on-surface-variant',
                )}
              >
                {point.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- Line */

export function LineChart({
  data,
  height = 200,
  currency = 'INR',
  className,
}: {
  data: ChartPoint[]
  height?: number
  currency?: string
  className?: string
}) {
  const gradientId = useId()
  const [hover, setHover] = useState<number | null>(null)
  if (!data.length) return null

  const width = 640
  const padY = 16
  const max = Math.max(1, ...data.map((d) => d.value))
  const min = Math.min(...data.map((d) => d.value), 0)
  const range = max - min || 1
  const stepX = data.length > 1 ? width / (data.length - 1) : width

  const points = data.map((d, i) => ({
    x: i * stepX,
    y: padY + (1 - (d.value - min) / range) * (height - padY * 2),
    ...d,
  }))

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${path} L${width} ${height} L0 ${height} Z`

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label="Trend chart"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={path}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? 5 : 3}
              fill="var(--color-surface-container-lowest)"
              stroke="var(--color-primary)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={p.x - stepX / 2}
              y={0}
              width={stepX}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      <div className="mt-space-xs flex justify-between">
        {data.map((d, i) => (
          <span
            key={d.label + i}
            className={cn(
              'font-label-xs text-label-xs',
              hover === i ? 'font-bold text-primary' : 'text-on-surface-variant',
              data.length > 8 && i % 2 === 1 && 'hidden sm:inline',
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
      {hover !== null && data[hover] && (
        <p className="mt-space-xs text-center font-label-xs text-label-xs text-on-surface">
          <span className="font-semibold">{data[hover].label}</span>
          <span className="text-on-surface-variant">
            {' · '}
            {formatMoney(data[hover].value, currency, { compact: true })}
          </span>
        </p>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Donut */

export function DonutChart({
  segments,
  size = 168,
  thickness = 22,
  centerLabel,
  centerValue,
  className,
}: {
  segments: { label: string; value: number; color: string }[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
  className?: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} role="img" aria-label="Distribution chart">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-surface-container-highest)"
            strokeWidth={thickness}
          />
          {segments.map((seg) => {
            const length = (seg.value / total) * circumference
            const dash = `${length} ${circumference - length}`
            const el = (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            )
            offset += length
            return el
          })}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerValue && (
          <span className="tabular font-headline-md text-headline-md text-on-surface">{centerValue}</span>
        )}
        {centerLabel && (
          <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
            {centerLabel}
          </span>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Sparkline */

export function Sparkline({
  values,
  className,
  height = 32,
  width = 96,
}: {
  values: number[]
  className?: string
  height?: number
  width?: number
}) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const stepX = width / (values.length - 1)
  const points = values.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('overflow-visible text-primary', className)}
      aria-hidden
    >
      <path d={`${path} L${width} ${height} L0 ${height} Z`} fill="currentColor" fillOpacity="0.08" />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
