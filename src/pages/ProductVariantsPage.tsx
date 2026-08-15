import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError, PUBLIC_WEB_URL } from '@/api/client'
import { CacheExplainer } from '@/components/CacheExplainer'
import { MutationResultPanel } from '@/components/MutationResultPanel'
import { VariantTable } from '@/components/VariantTable'
import type { VariantUpdateInput, VariantUpdateResult } from '@/domain/types'
import { adminQueryKeys } from '@/queries/query-keys'
import { useProduct } from '@/queries/use-product'
import { useRetryWebhook } from '@/queries/use-retry-webhook'
import { useUpdateVariant } from '@/queries/use-update-variant'
import { formatDateTime } from '@/lib/format'

export function ProductVariantsPage() {
  const { productSlug = '' } = useParams<{ productSlug: string }>()
  const queryClient = useQueryClient()

  const productQuery = useProduct(productSlug)
  const updateMutation = useUpdateVariant(productSlug)
  const retryMutation = useRetryWebhook()

  const [lastResult, setLastResult] = useState<VariantUpdateResult | null>(null)
  const [pendingVariantId, setPendingVariantId] = useState<string | null>(null)

  async function handleSave(variantId: string, patch: VariantUpdateInput): Promise<boolean> {
    setPendingVariantId(variantId)
    try {
      const response = await updateMutation.mutateAsync({ variantId, patch })
      setLastResult(response.data)
      return true
    } catch {
      // The error object itself is read from `updateMutation.error` and rendered inside
      // the still-open editor, next to the fields that caused it.
      return false
    } finally {
      setPendingVariantId(null)
    }
  }

  async function handleRetry(eventId: string) {
    const response = await retryMutation.mutateAsync(eventId)
    if (lastResult) {
      setLastResult({ ...lastResult, webhook: response.data.webhook })
    }
  }

  if (productQuery.isPending) {
    return <LoadingState />
  }

  if (productQuery.isError) {
    return (
      <ErrorState
        error={productQuery.error}
        onRetry={() => productQuery.refetch()}
        retrying={productQuery.isFetching}
      />
    )
  }

  const { product, category } = productQuery.data.data
  const { debug } = productQuery.data

  return (
    <div className="space-y-6">
      <nav aria-label="مسیر صفحه" className="text-xs text-ink-500">
        <Link to="/" className="hover:text-steel-700 hover:underline">
          فهرست محصولات
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink-700">{product.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{product.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            دسته: {category.name} · {product.variants.length} واریانت
          </p>
        </div>
        <a
          href={`${PUBLIC_WEB_URL}/product/${product.slug}`}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-ink-200 px-3 py-1.5 text-xs text-ink-700 transition hover:border-steel-500 hover:text-steel-700"
        >
          مشاهدهٔ صفحهٔ عمومی ↗
        </a>
      </header>

      {lastResult && (
        <MutationResultPanel
          result={lastResult}
          productSlug={product.slug}
          retrying={retryMutation.isPending}
          retryError={
            retryMutation.error instanceof Error ? retryMutation.error.message : null
          }
          onRetry={(eventId) => void handleRetry(eventId)}
        />
      )}

      <section
        aria-labelledby="variants-heading"
        className="overflow-hidden rounded-lg border border-ink-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-4 py-3">
          <h2 id="variants-heading" className="text-base font-bold text-ink-900">
            واریانت‌ها
          </h2>
          {updateMutation.isPending && (
            <span role="status" className="text-xs text-steel-700">
              در حال ارسال PATCH به Express…
            </span>
          )}
        </div>

        <VariantTable
          variants={product.variants}
          category={category}
          productSlug={product.slug}
          pendingVariantId={pendingVariantId}
          mutationError={updateMutation.error instanceof ApiError ? updateMutation.error : null}
          onSave={handleSave}
        />
      </section>

      {/* Query-state panel: proves the admin cache is a separate thing with its own clock. */}
      <section
        aria-labelledby="query-state-heading"
        className="rounded-lg border border-ink-200 bg-white p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="query-state-heading" className="text-base font-bold text-ink-900">
            وضعیت کش TanStack Query
          </h2>
          <button
            type="button"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: adminQueryKeys.product(productSlug) })
            }
            className="rounded border border-ink-200 px-3 py-1.5 text-xs text-ink-700 transition hover:border-steel-500 hover:text-steel-700"
          >
            invalidateQueries() دستی
          </button>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <Row
            label="کلید کوئری"
            value={JSON.stringify(adminQueryKeys.product(productSlug))}
            mono
          />
          <Row label="وضعیت" value={productQuery.status} />
          <Row label="در حال واکشی؟" value={productQuery.isFetching ? 'بله' : 'خیر'} />
          <Row
            label="آخرین واکشی موفق"
            value={formatDateTime(new Date(productQuery.dataUpdatedAt).toISOString())}
          />
          <Row label="شمارهٔ درخواست بک‌اند" value={String(debug.backendRequestNumber)} mono />
          <Row label="شمارهٔ درخواست این اندپوینت" value={String(debug.endpointRequestNumber)} mono />
        </dl>
        <p className="mt-3 text-xs leading-6 text-ink-500">
          این عددها مربوط به شمارندهٔ «خواندن ادمین» در Express هستند، نه «خواندن کاتالوگ». واکشی
          دوبارهٔ این صفحه هرگز در آمار ترافیک عمومی ظاهر نمی‌شود.
        </p>
      </section>

      <CacheExplainer />
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className={`text-ink-900 ${mono ? 'font-mono break-all' : ''}`}>{value}</dd>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="در حال بارگذاری محصول">
      <div className="h-8 w-64 animate-pulse rounded bg-ink-200" />
      <div className="h-64 animate-pulse rounded-lg border border-ink-200 bg-white" />
    </div>
  )
}

function ErrorState({
  error,
  onRetry,
  retrying,
}: {
  error: unknown
  onRetry: () => void
  retrying: boolean
}) {
  const message = error instanceof Error ? error.message : 'خطای ناشناخته'
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-6">
      <h1 className="text-lg font-bold text-red-900">دریافت محصول ناموفق بود</h1>
      <p className="mt-2 text-sm text-red-800">{message}</p>
      <p className="mt-2 text-xs text-red-700">
        معمولاً یعنی Express روی پورت ۴۰۰۰ اجرا نیست. آن را با{' '}
        <code className="font-mono">cd catalog-api &amp;&amp; pnpm dev</code> اجرا کنید.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="mt-4 rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-800 hover:bg-red-100 disabled:opacity-50"
      >
        {retrying ? 'در حال تلاش…' : 'تلاش دوباره'}
      </button>
    </div>
  )
}
