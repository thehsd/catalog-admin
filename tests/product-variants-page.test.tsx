import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductVariantsPage } from '@/pages/ProductVariantsPage'
import { adminQueryKeys } from '@/queries/query-keys'
import {
  createTestQueryClient,
  envelope,
  renderWithProviders,
  stubFetch,
  testCategory,
  testProduct,
  testVariant,
} from './test-utils'

const PRODUCT_ROUTE = '/products/zob-ahan-rebar/variants'
const ROUTE_PATH = '/products/:productSlug/variants'

function productResponse(price = testVariant.price) {
  return {
    status: 200,
    body: envelope({
      product: { ...testProduct, variants: [{ ...testVariant, price }] },
      category: testCategory,
    }),
  }
}

function successfulMutationResponse(price: number) {
  return {
    status: 200,
    body: envelope({
      updatedVariant: { ...testVariant, price, updatedAt: '2026-08-11T12:00:00.000Z' },
      product: testProduct,
      category: testCategory,
      webhook: {
        status: 'success',
        eventId: 'evt-abc-123',
        httpStatus: 200,
        duplicate: false,
        invalidatedTags: [
          'variant:prod-zob-ahan-rebar-size-12',
          'product:zob-ahan-rebar',
          'category:rebar',
        ],
        invalidatedPaths: [],
      },
    }),
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('admin product query', () => {
  it('reads the product from Express, not from Next.js', async () => {
    const { calls } = stubFetch({ 'GET /api/admin/products/zob-ahan-rebar': productResponse })

    renderWithProviders(<ProductVariantsPage />, { route: PRODUCT_ROUTE, path: ROUTE_PATH })

    expect(await screen.findByRole('heading', { name: 'میلگرد ذوب آهن' })).toBeInTheDocument()

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('http://localhost:4000/api/admin/products/zob-ahan-rebar')
    // Nothing in this application ever addresses the Next.js origin.
    expect(calls.every((call) => !call.url.includes(':3000'))).toBe(true)
  })

  it('renders a loading state and then the variant rows', async () => {
    stubFetch({ 'GET /api/admin/products/zob-ahan-rebar': productResponse })

    renderWithProviders(<ProductVariantsPage />, { route: PRODUCT_ROUTE, path: ROUTE_PATH })

    expect(screen.getByLabelText('در حال بارگذاری محصول')).toBeInTheDocument()
    expect(await screen.findByText('میلگرد ۱۲ ذوب آهن')).toBeInTheDocument()
  })

  it('shows an error state with a retry action when Express is unreachable', async () => {
    stubFetch({}) // every route 501s

    renderWithProviders(<ProductVariantsPage />, { route: PRODUCT_ROUTE, path: ROUTE_PATH })

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('دریافت محصول ناموفق بود')).toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: 'تلاش دوباره' })).toBeInTheDocument()
  })
})

describe('inline price edit', () => {
  it('sends exactly one PATCH containing only the changed field', async () => {
    const user = userEvent.setup()
    const { calls } = stubFetch({
      'GET /api/admin/products/zob-ahan-rebar': productResponse,
      'PATCH /api/admin/variants/prod-zob-ahan-rebar-size-12': () =>
        successfulMutationResponse(300_000_000),
    })

    renderWithProviders(<ProductVariantsPage />, { route: PRODUCT_ROUTE, path: ROUTE_PATH })

    await user.click(await screen.findByRole('button', { name: 'ویرایش' }))
    const priceInput = screen.getByLabelText('قیمت (ریال)')
    await user.clear(priceInput)
    await user.type(priceInput, '300000000')
    await user.click(screen.getByRole('button', { name: 'ذخیره' }))

    await waitFor(() => {
      expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(1)
    })

    const patch = calls.find((call) => call.method === 'PATCH')!
    expect(patch.url).toBe(
      'http://localhost:4000/api/admin/variants/prod-zob-ahan-rebar-size-12',
    )
    // A PATCH, not a PUT: availability and attributes are absent because they did not change.
    expect(patch.body).toEqual({ price: 300_000_000 })
  })

  it('disables save until something actually changes', async () => {
    const user = userEvent.setup()
    stubFetch({ 'GET /api/admin/products/zob-ahan-rebar': productResponse })

    renderWithProviders(<ProductVariantsPage />, { route: PRODUCT_ROUTE, path: ROUTE_PATH })

    await user.click(await screen.findByRole('button', { name: 'ویرایش' }))
    expect(screen.getByRole('button', { name: 'ذخیره' })).toBeDisabled()

    const priceInput = screen.getByLabelText('قیمت (ریال)')
    await user.clear(priceInput)
    await user.type(priceInput, '1')
    expect(screen.getByRole('button', { name: 'ذخیره' })).toBeEnabled()
  })

  it('closes the editor on cancel without sending anything', async () => {
    const user = userEvent.setup()
    const { calls } = stubFetch({ 'GET /api/admin/products/zob-ahan-rebar': productResponse })

    renderWithProviders(<ProductVariantsPage />, { route: PRODUCT_ROUTE, path: ROUTE_PATH })

    await user.click(await screen.findByRole('button', { name: 'ویرایش' }))
    await user.click(screen.getByRole('button', { name: 'انصراف' }))

    expect(screen.queryByLabelText('قیمت (ریال)')).not.toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  })

  it('offers only the attribute values the category defines', async () => {
    const user = userEvent.setup()
    stubFetch({ 'GET /api/admin/products/zob-ahan-rebar': productResponse })

    renderWithProviders(<ProductVariantsPage />, { route: PRODUCT_ROUTE, path: ROUTE_PATH })

    await user.click(await screen.findByRole('button', { name: 'ویرایش' }))

    const standard = screen.getByLabelText('استاندارد') as HTMLSelectElement
    const options = [...standard.options].map((option) => option.value)
    expect(options).toEqual(['', 'A2', 'A3'])
  })
})

describe('successful mutation', () => {
  it('shows the write result and the webhook result as two separate outcomes', async () => {
    const user = userEvent.setup()
    stubFetch({
      'GET /api/admin/products/zob-ahan-rebar': productResponse,
      'PATCH /api/admin/variants/prod-zob-ahan-rebar-size-12': () =>
        successfulMutationResponse(300_000_000),
    })

    renderWithProviders(<ProductVariantsPage />, { route: PRODUCT_ROUTE, path: ROUTE_PATH })

    await user.click(await screen.findByRole('button', { name: 'ویرایش' }))
    await user.clear(screen.getByLabelText('قیمت (ریال)'))
    await user.type(screen.getByLabelText('قیمت (ریال)'), '300000000')
    await user.click(screen.getByRole('button', { name: 'ذخیره' }))

    expect(await screen.findByText('۱. نوشتن در دیتااستور: موفق')).toBeInTheDocument()
    expect(
      await screen.findByText('۲. وبهوک باطل‌سازی کش Next.js: موفق'),
    ).toBeInTheDocument()

    // The tags Next.js reported back are surfaced verbatim.
    expect(screen.getByText('category:rebar')).toBeInTheDocument()
    expect(screen.getByText('product:zob-ahan-rebar')).toBeInTheDocument()
    expect(screen.getByText('evt-abc-123')).toBeInTheDocument()
  })

  it('invalidates the admin query cache after a successful mutation', async () => {
    const user = userEvent.setup()
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    stubFetch({
      'GET /api/admin/products/zob-ahan-rebar': productResponse,
      'PATCH /api/admin/variants/prod-zob-ahan-rebar-size-12': () =>
        successfulMutationResponse(300_000_000),
    })

    renderWithProviders(<ProductVariantsPage />, {
      route: PRODUCT_ROUTE,
      path: ROUTE_PATH,
      queryClient,
    })

    await user.click(await screen.findByRole('button', { name: 'ویرایش' }))
    await user.clear(screen.getByLabelText('قیمت (ریال)'))
    await user.type(screen.getByLabelText('قیمت (ریال)'), '300000000')
    await user.click(screen.getByRole('button', { name: 'ذخیره' }))

    await waitFor(() => {
      const invalidatedKeys = invalidateSpy.mock.calls.map((call) =>
        JSON.stringify(call[0]?.queryKey),
      )
      expect(invalidatedKeys).toContain(
        JSON.stringify(adminQueryKeys.product('zob-ahan-rebar')),
      )
      expect(invalidatedKeys).toContain(JSON.stringify(adminQueryKeys.backendStats()))
      expect(invalidatedKeys).toContain(JSON.stringify(adminQueryKeys.webhookEvents()))
    })
  })
})

describe('failed mutation', () => {
  it('shows the API validation error and does NOT invalidate any query', async () => {
    const user = userEvent.setup()
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    stubFetch({
      'GET /api/admin/products/zob-ahan-rebar': productResponse,
      'PATCH /api/admin/variants/prod-zob-ahan-rebar-size-12': () => ({
        status: 422,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'داده‌های ارسالی معتبر نیست',
            details: [{ path: 'price', message: 'قیمت نمی‌تواند منفی باشد' }],
          },
        },
      }),
    })

    renderWithProviders(<ProductVariantsPage />, {
      route: PRODUCT_ROUTE,
      path: ROUTE_PATH,
      queryClient,
    })

    await user.click(await screen.findByRole('button', { name: 'ویرایش' }))
    await user.clear(screen.getByLabelText('قیمت (ریال)'))
    await user.type(screen.getByLabelText('قیمت (ریال)'), '5')
    await user.click(screen.getByRole('button', { name: 'ذخیره' }))

    // The editor stays open, with the server's message beside the field that caused it.
    expect(await screen.findByText('داده‌های ارسالی معتبر نیست')).toBeInTheDocument()
    expect(screen.getByText(/قیمت نمی‌تواند منفی باشد/)).toBeInTheDocument()
    expect(screen.getByLabelText('قیمت (ریال)')).toBeInTheDocument()

    // Nothing was written, so nothing may be invalidated — a refetch here would only
    // overwrite good local state with identical server state and hide the failure.
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) =>
      JSON.stringify(call[0]?.queryKey),
    )
    expect(invalidatedKeys).not.toContain(
      JSON.stringify(adminQueryKeys.product('zob-ahan-rebar')),
    )

    // And no result panel: there is no successful write to report.
    expect(screen.queryByText('نتیجهٔ آخرین ذخیره')).not.toBeInTheDocument()
  })

  it('rejects a negative price client-side before any request is sent', async () => {
    const user = userEvent.setup()
    const { calls } = stubFetch({ 'GET /api/admin/products/zob-ahan-rebar': productResponse })

    renderWithProviders(<ProductVariantsPage />, { route: PRODUCT_ROUTE, path: ROUTE_PATH })

    await user.click(await screen.findByRole('button', { name: 'ویرایش' }))
    await user.clear(screen.getByLabelText('قیمت (ریال)'))
    await user.type(screen.getByLabelText('قیمت (ریال)'), '-5')
    await user.click(screen.getByRole('button', { name: 'ذخیره' }))

    expect(await screen.findByText('قیمت نمی‌تواند منفی باشد')).toBeInTheDocument()
    // A convenience, not a control: Express validates the same rule independently.
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  })
})

describe('webhook failure and retry', () => {
  it('reports a failed webhook alongside a successful write, and retries via Express', async () => {
    const user = userEvent.setup()
    const { calls } = stubFetch({
      'GET /api/admin/products/zob-ahan-rebar': productResponse,
      'PATCH /api/admin/variants/prod-zob-ahan-rebar-size-12': () => ({
        status: 200,
        body: envelope({
          updatedVariant: { ...testVariant, price: 300_000_000 },
          product: testProduct,
          category: testCategory,
          webhook: {
            status: 'failed',
            eventId: 'evt-failed-1',
            error: 'fetch failed: ECONNREFUSED 127.0.0.1:3000',
          },
        }),
      }),
      'POST /api/debug/retry-webhook/evt-failed-1': () => ({
        status: 200,
        body: envelope({
          event: {
            eventId: 'evt-failed-1',
            event: 'variant.updated',
            payload: {
              eventId: 'evt-failed-1',
              event: 'variant.updated',
              occurredAt: '2026-08-11T12:00:00.000Z',
              variantId: testVariant.id,
              variantSlug: 'size-12',
              productId: testProduct.id,
              productSlug: 'zob-ahan-rebar',
              categoryId: 'cat-rebar',
              categorySlug: 'rebar',
              changedFields: ['price'],
            },
            createdAt: '2026-08-11T12:00:00.000Z',
            status: 'success',
            attempts: [
              {
                attemptNumber: 2,
                attemptedAt: '2026-08-11T12:01:00.000Z',
                durationMs: 12,
                status: 'success',
                httpStatus: 200,
                duplicate: false,
                invalidatedTags: ['category:rebar'],
                invalidatedPaths: [],
              },
            ],
          },
          attempt: {
            attemptNumber: 2,
            attemptedAt: '2026-08-11T12:01:00.000Z',
            durationMs: 12,
            status: 'success',
            httpStatus: 200,
          },
          webhook: {
            status: 'success',
            eventId: 'evt-failed-1',
            httpStatus: 200,
            duplicate: false,
            invalidatedTags: ['category:rebar'],
            invalidatedPaths: [],
          },
        }),
      }),
    })

    renderWithProviders(<ProductVariantsPage />, { route: PRODUCT_ROUTE, path: ROUTE_PATH })

    await user.click(await screen.findByRole('button', { name: 'ویرایش' }))
    await user.clear(screen.getByLabelText('قیمت (ریال)'))
    await user.type(screen.getByLabelText('قیمت (ریال)'), '300000000')
    await user.click(screen.getByRole('button', { name: 'ذخیره' }))

    // The write succeeded; the invalidation did not. Both are reported.
    expect(await screen.findByText('۱. نوشتن در دیتااستور: موفق')).toBeInTheDocument()
    expect(await screen.findByText('۲. وبهوک باطل‌سازی کش Next.js: ناموفق')).toBeInTheDocument()
    expect(screen.getByText(/ECONNREFUSED/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'تلاش دوبارهٔ ارسال وبهوک' }))

    expect(await screen.findByText('۲. وبهوک باطل‌سازی کش Next.js: موفق')).toBeInTheDocument()

    // The retry went to EXPRESS, which owns the secret — not to the Next.js webhook.
    const retry = calls.find((call) => call.url.includes('retry-webhook'))!
    expect(retry.url).toBe('http://localhost:4000/api/debug/retry-webhook/evt-failed-1')
    expect(retry.method).toBe('POST')
  })
})
