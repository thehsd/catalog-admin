import { describe, expect, it } from 'vitest'
import { resolveApiUrl } from '@/api/client'

/**
 * `VITE_API_BASE_URL` has two supported shapes, and both are load-bearing:
 *
 *   http://localhost:4000   direct cross-origin development
 *   /api                    the Docker deployment, same-origin through the Nginx proxy
 *
 * Getting the second one wrong produces `/api/api/...`, which Nginx forwards to a path
 * Express does not serve — a 404 that looks like a data problem and is really a URL
 * problem. This file pins the behaviour down.
 */
describe('resolveApiUrl', () => {
  it('appends the endpoint path to a cross-origin base', () => {
    expect(resolveApiUrl('http://localhost:4000', '/api/admin/products')).toBe(
      'http://localhost:4000/api/admin/products',
    )
  })

  it('does not repeat /api when the base is the same-origin proxy mount point', () => {
    expect(resolveApiUrl('/api', '/api/admin/products')).toBe('/api/admin/products')
    expect(resolveApiUrl('/api', '/api/debug/stats')).toBe('/api/debug/stats')
  })

  it('does not repeat /api when the base is an origin that already includes it', () => {
    expect(resolveApiUrl('http://localhost:4000/api', '/api/admin/products')).toBe(
      'http://localhost:4000/api/admin/products',
    )
  })

  it('tolerates a trailing slash on the base', () => {
    expect(resolveApiUrl('http://localhost:4000/', '/api/admin/products')).toBe(
      'http://localhost:4000/api/admin/products',
    )
    expect(resolveApiUrl('/api/', '/api/admin/products')).toBe('/api/admin/products')
  })

  it('leaves a path that is not under /api untouched', () => {
    // No endpoint in this application looks like this today; the assertion exists so the
    // collapse rule can never swallow a path it was not meant to touch.
    expect(resolveApiUrl('/api', '/health')).toBe('/api/health')
  })

  it('produces the exact URL the Docker deployment relies on', () => {
    // Browser → http://localhost:5173/api/admin/variants/… → Nginx → catalog-api:4000
    expect(resolveApiUrl('/api', '/api/admin/variants/prod-zob-ahan-rebar-size-12')).toBe(
      '/api/admin/variants/prod-zob-ahan-rebar-size-12',
    )
  })
})
