import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { Category, Product, Variant } from '@/domain/types'

/**
 * Test harness.
 *
 * `fetch` is stubbed rather than mocking the api layer, so the assertions cover the real
 * request URLs and methods. That matters here more than usual: the most important claims
 * this project makes are about *which application receives which request*, and mocking
 * one level higher would make those claims untestable.
 */

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options: { route?: string; path?: string; queryClient?: QueryClient } = {},
) {
  const queryClient = options.queryClient ?? createTestQueryClient()
  const path = options.path ?? '*'
  const route = options.route ?? '/'

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  return { ...render(ui, { wrapper: Wrapper }), queryClient }
}

// ---------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------

export const testCategory: Category = {
  id: 'cat-rebar',
  name: 'میلگرد',
  slug: 'rebar',
  attributes: [
    {
      id: 'attr-size',
      name: 'سایز',
      slug: 'size',
      unit: 'mm',
      filterable: true,
      values: [
        { label: '۸', slug: '8', value: 8 },
        { label: '۱۲', slug: '12', value: 12 },
      ],
    },
    {
      id: 'attr-standard',
      name: 'استاندارد',
      slug: 'standard',
      filterable: true,
      values: [
        { label: 'A2', slug: 'a2', value: 'A2' },
        { label: 'A3', slug: 'a3', value: 'A3' },
      ],
    },
  ],
}

export const testVariant: Variant = {
  id: 'prod-zob-ahan-rebar-size-12',
  productId: 'prod-zob-ahan-rebar',
  name: 'میلگرد ۱۲ ذوب آهن',
  slug: 'size-12',
  price: 246_000_000,
  currency: 'IRR',
  available: true,
  attributes: { size: 12, standard: 'A3' },
  updatedAt: '2026-08-01T08:00:00.000Z',
}

export const testProduct: Product = {
  id: 'prod-zob-ahan-rebar',
  categoryId: 'cat-rebar',
  name: 'میلگرد ذوب آهن',
  slug: 'zob-ahan-rebar',
  variants: [testVariant],
}

export const debugMetadata = {
  requestId: 'req-1',
  backendRequestNumber: 7,
  endpointRequestNumber: 2,
  generatedAt: '2026-08-11T10:00:00.000Z',
}

export function envelope<T>(data: T) {
  return { data, debug: debugMetadata }
}

export type StubbedCall = { url: string; method: string; body: unknown }

/**
 * A `fetch` double that records every call and answers from a routing table keyed by
 * `"<METHOD> <pathname>"`.
 */
export function stubFetch(
  routes: Record<string, () => { status?: number; body: unknown }>,
): { calls: StubbedCall[] } {
  const calls: StubbedCall[] = []

  const implementation = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, method, body })

    const pathname = new URL(url).pathname
    const handler = routes[`${method} ${pathname}`]
    if (!handler) {
      return new Response(JSON.stringify({ error: { code: 'NO_STUB', message: url } }), {
        status: 501,
        headers: { 'content-type': 'application/json' },
      })
    }

    const { status = 200, body: responseBody } = handler()
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  globalThis.fetch = implementation as unknown as typeof fetch
  return { calls }
}
