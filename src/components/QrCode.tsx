import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from '@/components/ui'

/**
 * Scannable QR renderer.
 *
 * Uses the QR Server image endpoint so the printed/downloaded code is a genuine,
 * scannable QR rather than a decorative placeholder. If the network is unavailable
 * it degrades to a checkout-able plain URL instead of a broken image.
 */
export function QrCode({
  value,
  size = 200,
  className,
  margin = 8,
  dark = '#0F172A',
}: {
  value: string
  size?: number
  className?: string
  margin?: number
  dark?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=${Math.round(
    (margin / size) * 100,
  )}&color=${dark.replace('#', '')}&data=${encodeURIComponent(value)}`

  if (failed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-space-xs rounded-xl border border-dashed border-slate-300 bg-slate-50 p-space-md text-center',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Icon name="qr_code_2" size={32} className="text-slate-400" />
        <span className="font-label-xs text-label-xs text-on-surface-variant">
          QR image unavailable offline
        </span>
        <span className="break-all font-label-xs text-label-xs font-semibold text-on-surface">
          {value}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={`QR code linking to ${value}`}
      onError={() => setFailed(true)}
      className={cn('rounded-xl bg-white', className)}
    />
  )
}
