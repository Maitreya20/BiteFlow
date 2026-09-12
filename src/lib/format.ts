/** Presentation helpers shared by every screen. */

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SGD: 'S$',
}

export function currencySymbol(code = 'INR'): string {
  return CURRENCY_SYMBOLS[code] ?? code + ' '
}

/** ₹42,850 — Indian grouping for INR, standard otherwise. */
export function formatMoney(amount: number, currency = 'INR', opts?: { compact?: boolean; decimals?: boolean }) {
  const symbol = currencySymbol(currency)
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)

  if (opts?.compact) {
    if (abs >= 10_000_000) return `${sign}${symbol}${(abs / 10_000_000).toFixed(1)}Cr`
    if (abs >= 100_000) return `${sign}${symbol}${(abs / 100_000).toFixed(1)}L`
    if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}k`
  }

  const decimals = opts?.decimals ? 2 : 0
  return (
    sign +
    symbol +
    abs.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  )
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-IN')
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const mins = Math.round(diff / 60_000)
  if (!Number.isFinite(mins)) return '—'
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Elapsed clock used by KDS tickets and table timers. */
export function elapsed(iso: string | null | undefined): string {
  if (!iso) return '00:00'
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const totalSecs = Math.floor(diff / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  const hours = Math.floor(mins / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(mins % 60)}:${pad(secs)}`
  return `${pad(mins)}:${pad(secs)}`
}

export function elapsedMinutes(iso: string | null | undefined): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

/** ISO string offset from now — used to build believable demo timestamps. */
export function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

export function fromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

/** Deterministic warm gradient + emoji tile so food imagery never 404s. */
const FOOD_EMOJI: { keys: string[]; emoji: string }[] = [
  { keys: ['pizza', 'margherita', 'pepperoni'], emoji: '🍕' },
  { keys: ['burger', 'slider', 'sandwich'], emoji: '🍔' },
  { keys: ['risotto', 'rice', 'biryani', 'pulao', 'bowl'], emoji: '🍚' },
  { keys: ['pasta', 'linguine', 'penne', 'spaghetti'], emoji: '🍝' },
  { keys: ['salad', 'greens', 'quinoa', 'kale'], emoji: '🥗' },
  { keys: ['coffee', 'latte', 'espresso', 'americano', 'brew', 'cappuccino'], emoji: '☕' },
  { keys: ['tea', 'chai', 'matcha'], emoji: '🍵' },
  { keys: ['cake', 'tiramisu', 'brownie', 'dessert', 'cheesecake', 'pudding'], emoji: '🍰' },
  { keys: ['taco', 'burrito', 'quesadilla', 'nacho'], emoji: '🌮' },
  { keys: ['sushi', 'maki', 'roll', 'nigiri'], emoji: '🍣' },
  { keys: ['soup', 'bisque', 'broth', 'shorba'], emoji: '🍜' },
  { keys: ['wings', 'chicken', 'tikka', 'kebab', 'tandoori', 'paneer'], emoji: '🍗' },
  { keys: ['smoothie', 'juice', 'shake', 'lassi', 'mocktail'], emoji: '🥤' },
  { keys: ['pancake', 'waffle', 'toast', 'croissant', 'bagel'], emoji: '🥞' },
  { keys: ['curry', 'masala', 'dal', 'gravy'], emoji: '🍛' },
  { keys: ['fries', 'nuggets', 'starters', 'pakora', 'samosa'], emoji: '🍟' },
  { keys: ['ice', 'gelato', 'sorbet', 'sundae'], emoji: '🍨' },
  { keys: ['bread', 'naan', 'roti', 'garlic'], emoji: '🥖' },
]

export function foodEmoji(name: string): string {
  const lower = name.toLowerCase()
  for (const entry of FOOD_EMOJI) {
    if (entry.keys.some((k) => lower.includes(k))) return entry.emoji
  }
  return '🍽️'
}

/** Stable hash so the same dish always gets the same tile colour. */
function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h << 5) - h + value.charCodeAt(i)
  return Math.abs(h)
}

export function foodTileStyle(name: string): { background: string } {
  const h = hash(name)
  const hue = h % 60 // warm 0–60 band keeps everything appetising
  const sat = 72 + (h % 14)
  const light = 82 + (h % 8)
  return {
    background: `linear-gradient(140deg, hsl(${hue} ${sat}% ${light}%) 0%, hsl(${(hue + 22) % 60} ${sat}% ${light - 14}%) 100%)`,
  }
}

/** Colour ramp for avatars. */
export function avatarStyle(name: string): { background: string; color: string } {
  const h = hash(name) % 360
  return {
    background: `hsl(${h} 62% 92%)`,
    color: `hsl(${h} 62% 28%)`,
  }
}
