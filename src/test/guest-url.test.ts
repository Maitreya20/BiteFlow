// @vitest-environment-options {"url": "https://biteflow-test.vercel.app/"}
import { afterEach, describe, expect, it, vi } from 'vitest'
import { guestTableUrl, publicBase } from '@/lib/publicRoutes'
import { siteOrigin } from '@/lib/supabase'

/**
 * The value that ends up inside a printed QR code is decided in two places, and
 * both of them previously got it wrong in the same deployment:
 *
 *   1. `VITE_PUBLIC_SITE_URL` shipped as an unedited template
 *      (`https://your-public-domain.example`), which `siteOrigin()` trusted, so
 *      every code encoded a domain that does not exist.
 *   2. The path it built (`/r/:slug/table/:tableNumber`) matched no route, so
 *      even a resolvable domain landed the diner on the marketing page.
 *
 * (2) is covered by `qr-route.test.tsx`. These tests pin (1), evaluated as if the
 * app were served from a real deployment host rather than localhost.
 */

const DEPLOYED = 'https://biteflow-test.vercel.app'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('publicBase', () => {
  it('makes the table part of the path when one is known', () => {
    expect(publicBase('urban-bean-cafe', 'T-01')).toBe('/r/urban-bean-cafe/table/T-01')
  })

  it('omits the table segment when there is no table', () => {
    expect(publicBase('urban-bean-cafe')).toBe('/r/urban-bean-cafe')
    expect(publicBase('urban-bean-cafe', '')).toBe('/r/urban-bean-cafe')
    expect(publicBase('urban-bean-cafe', '   ')).toBe('/r/urban-bean-cafe')
  })
})

describe('guestTableUrl', () => {
  it('lowercases the table so one table has one stable link', () => {
    expect(guestTableUrl('urban-bean-cafe', 'T-01')).toBe(`${DEPLOYED}/r/urban-bean-cafe/table/t-01`)
  })

  it('does not double the slash when the origin has a trailing one', () => {
    expect(guestTableUrl('urban-bean-cafe', 'T-02', `${DEPLOYED}/`)).toBe(
      `${DEPLOYED}/r/urban-bean-cafe/table/t-02`,
    )
  })

  it('trims a table label that arrived with whitespace', () => {
    expect(guestTableUrl('urban-bean-cafe', ' T-03 ')).toBe(
      `${DEPLOYED}/r/urban-bean-cafe/table/t-03`,
    )
  })
})

describe('siteOrigin', () => {
  it('ignores an unedited placeholder and uses the origin we are actually served from', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://your-public-domain.example')

    expect(siteOrigin()).toBe(DEPLOYED)
  })

  it('treats an empty value as unset', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', '   ')

    expect(siteOrigin()).toBe(DEPLOYED)
  })

  it('honours a real configured domain, including without a scheme-hosted default', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://order.biteflow.app/')

    expect(siteOrigin()).toBe('https://order.biteflow.app')
  })

  it('refuses a localhost value in a deployed build, which would send diners to their own device', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'http://localhost:5173')

    expect(siteOrigin()).toBe(DEPLOYED)
  })
})
