/**
 * Runtime tenant theming — prd.md §9 / design.md §19.
 *
 * Tenant colours map onto the `--bf-*` variables that `--color-primary` and friends
 * already reference in styles.css, so switching restaurant re-skins only the brand
 * surfaces while the slate operational scaffolding stays constant.
 */
import type { Branding } from '@/lib/types'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const int = Number.parseInt(full.slice(0, 6) || 'ea580c', 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`
}

/** Mix toward black — used for hover/pressed states. */
export function darken(hex: string, amount = 0.14): string {
  const { r, g, b } = hexToRgb(hex)
  return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}

export function lighten(hex: string, amount = 0.85): string {
  const { r, g, b } = hexToRgb(hex)
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

/** Relative luminance → pick black or white foreground for contrast (WCAG). */
export function readableOn(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  return luminance > 0.55 ? '#0F172A' : '#FFFFFF'
}

const RADIUS_SCALES: Record<Branding['radiusScale'], { sm: string; base: string; md: string; lg: string; xl: string }> = {
  sharp: { sm: '0.125rem', base: '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem' },
  soft: { sm: '0.25rem', base: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem' },
  round: { sm: '0.5rem', base: '0.875rem', md: '1.125rem', lg: '1.5rem', xl: '2rem' },
}

const FONT_STACKS: Record<Branding['fontFamily'], string> = {
  Manrope: "'Manrope', ui-sans-serif, system-ui, sans-serif",
  Inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
  'DM Sans': "'Inter', ui-sans-serif, system-ui, sans-serif",
  Sora: "'Manrope', ui-sans-serif, system-ui, sans-serif",
  'Playfair Display': "'Manrope', ui-sans-serif, system-ui, sans-serif",
}

/** Push branding onto the document root. Safe to call on every branding change. */
export function applyBranding(branding: Branding | null | undefined) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  if (!branding) {
    root.style.removeProperty('--bf-brand')
    root.style.removeProperty('--bf-brand-dark')
    root.style.removeProperty('--bf-on-brand')
    root.style.removeProperty('--bf-accent')
    root.style.removeProperty('--bf-radius')
    root.style.removeProperty('--bf-font')
    return
  }

  root.style.setProperty('--bf-brand', branding.primaryColor)
  root.style.setProperty('--bf-brand-dark', darken(branding.primaryColor, 0.16))
  root.style.setProperty('--bf-on-brand', readableOn(branding.primaryColor))
  root.style.setProperty('--bf-accent', branding.accentColor)
  root.style.setProperty('--bf-font', FONT_STACKS[branding.fontFamily] ?? FONT_STACKS.Manrope)

  const scale = RADIUS_SCALES[branding.radiusScale] ?? RADIUS_SCALES.soft
  root.style.setProperty('--radius-sm', scale.sm)
  root.style.setProperty('--radius-DEFAULT', scale.base)
  root.style.setProperty('--radius-md', scale.md)
  root.style.setProperty('--radius-lg', scale.lg)
  root.style.setProperty('--radius-xl', scale.xl)
}

/** Colour swatches offered in the branding editor. */
export const BRAND_SWATCHES = [
  { name: 'Ember', value: '#EA580C' },
  { name: 'Brick', value: '#B91C1C' },
  { name: 'Saffron', value: '#D97706' },
  { name: 'Basil', value: '#15803D' },
  { name: 'Teal', value: '#0F766E' },
  { name: 'Ocean', value: '#1D4ED8' },
  { name: 'Plum', value: '#7E22CE' },
  { name: 'Cocoa', value: '#78350F' },
  { name: 'Graphite', value: '#334155' },
  { name: 'Rose', value: '#BE123C' },
]
