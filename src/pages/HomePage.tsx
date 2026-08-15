import { Link } from 'react-router'
import { API_BASE_URL, PUBLIC_WEB_URL } from '@/api/client'
import { CacheExplainer } from '@/components/CacheExplainer'
import { useProductList } from '@/queries/use-product'

export function HomePage() {
  const query = useProductList()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink-900">پنل ادمین کاتالوگ</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-500">
          این یک برنامهٔ React کاملاً جداگانه است که مستقیماً با Express روی{' '}
          <code className="font-mono">{API_BASE_URL}</code> حرف می‌زند. هیچ درخواستی از اینجا به
          Next.js نمی‌رود — نه برای خواندن، نه برای نوشتن، و به‌ویژه نه برای باطل‌کردن کش.
        </p>
      </header>

      {query.isPending && (
        <div className="h-40 animate-pulse rounded-lg border border-ink-200 bg-white" aria-busy="true" />
      )}

      {query.isError && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-6">
          <h2 className="text-base font-bold text-red-900">دریافت فهرست محصولات ناموفق بود</h2>
          <p className="mt-2 text-sm text-red-800">
            {query.error instanceof Error ? query.error.message : 'خطای ناشناخته'}
          </p>
          <p className="mt-2 text-xs text-red-700">
            Express را اجرا کنید: <code className="font-mono">cd catalog-api &amp;&amp; pnpm dev</code>
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-4 rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-800 hover:bg-red-100"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {query.isSuccess && (
        <section aria-labelledby="products-heading">
          <h2 id="products-heading" className="text-base font-bold text-ink-900">
            محصولات
          </h2>
          {query.data.data.products.length === 0 ? (
            <p className="mt-2 text-sm text-ink-500">هیچ محصولی ثبت نشده است.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {query.data.data.products.map((product) => (
                <li key={product.id}>
                  <Link
                    to={`/products/${product.slug}/variants`}
                    className="block h-full rounded-lg border border-ink-200 bg-white p-4 transition hover:border-steel-500"
                  >
                    <h3 className="text-sm font-bold text-ink-900">{product.name}</h3>
                    <p className="mt-1 text-xs text-ink-500">
                      دسته: {product.categorySlug ?? '—'} · {product.variantCount} واریانت
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-steel-600">
                      /products/{product.slug}/variants
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-lg border border-ink-200 bg-white p-4">
        <h2 className="text-base font-bold text-ink-900">سه برنامهٔ مستقل</h2>
        <ul className="mt-2 space-y-1 text-sm text-ink-700">
          <li>
            <code className="font-mono">catalog-api</code> — Express، پورت ۴۰۰۰ — مالک داده
          </li>
          <li>
            <code className="font-mono">catalog-admin</code> — همین برنامه، پورت ۵۱۷۳
          </li>
          <li>
            <code className="font-mono">catalog-web</code> — Next.js، پورت ۳۰۰۰ —{' '}
            <a
              href={`${PUBLIC_WEB_URL}/cache-lab`}
              target="_blank"
              rel="noreferrer"
              className="text-steel-600 hover:underline"
            >
              آزمایشگاه کش ↗
            </a>
          </li>
        </ul>
      </section>

      <CacheExplainer />
    </div>
  )
}
