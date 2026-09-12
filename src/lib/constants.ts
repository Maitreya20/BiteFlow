import { isSupabaseConfigured } from './supabase'

/** Shown on the demo/marketing surfaces so the data source is never ambiguous. */
export const DEMO_MODE_NOTE = isSupabaseConfigured
  ? 'Running on your live Supabase project.'
  : 'Demo dataset — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to switch to live Supabase.'

/** Seed accounts that exist in both the demo dataset and supabase/seed.sql. */
export const DEMO_ACCOUNTS = [
  {
    label: 'Restaurant owner',
    email: 'owner@urbanbean.test',
    password: 'demo1234',
    description: 'Owns all three demo tenants — full tenant switcher access.',
  },
  {
    label: 'Platform super admin',
    email: 'admin@biteflow.com',
    password: 'demo1234',
    description: 'Platform-level screens: tenants, plans, subscriptions, audit.',
  },
] as const

export const CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee (₹)' },
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'GBP', label: 'GBP — Pound Sterling (£)' },
  { code: 'AED', label: 'AED — UAE Dirham (د.إ)' },
  { code: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
]

export const LANGUAGES = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { code: 'ar-AE', label: 'العربية (Arabic)' },
  { code: 'fr-FR', label: 'Français' },
]

export const TIMEZONES = [
  { code: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
  { code: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
  { code: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
  { code: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { code: 'America/New_York', label: 'America/New_York (ET)' },
  { code: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
]

export const FONT_OPTIONS = [
  { value: 'Manrope', label: 'Manrope — modern geometric', preview: 'The quick brown fox' },
  { value: 'Inter', label: 'Inter — neutral UI sans', preview: 'The quick brown fox' },
  { value: 'Sora', label: 'Sora — technical, wide', preview: 'The quick brown fox' },
  { value: 'DM Sans', label: 'DM Sans — friendly rounded', preview: 'The quick brown fox' },
  { value: 'Playfair Display', label: 'Playfair — editorial serif', preview: 'The quick brown fox' },
] as const

export const ORDER_STATUS_TONES = {
  pending: 'warning',
  accepted: 'info',
  preparing: 'warning',
  ready: 'success',
  served: 'info',
  completed: 'neutral',
  cancelled: 'critical',
} as const

export const TABLE_STATUS_TONES = {
  available: 'success',
  occupied: 'warning',
  reserved: 'info',
  cleaning: 'neutral',
} as const
