import { PUBLIC_WEB_URL } from '@/api/client'
import type { VariantUpdateResult } from '@/domain/types'
import { formatDateTime, formatPrice } from '@/lib/format'

/**
 * What happened after the last save.
 *
 * Two independent outcomes are reported side by side, because they can and do diverge:
 *
 *   1. the WRITE  — Express persisted the variant. Always durable once it says 200.
 *   2. the WEBHOOK — Express told Next.js to drop some cache entries. May fail.
 *
 * A failed webhook does not undo the write. The data is correct in the backend and the
 * public site is showing a stale copy of it, which is a different problem with a
 * different fix (retry), and the UI has to say so plainly rather than showing one green
 * checkmark for both.
 */
export function MutationResultPanel({
  result,
  productSlug,
  retrying,
  retryError,
  onRetry,
}: {
  result: VariantUpdateResult
  productSlug: string
  retrying: boolean
  retryError: string | null
  onRetry: (eventId: string) => void
}) {
  const { updatedVariant, webhook } = result
  const succeeded = webhook.status === 'success'

  return (
    <section
      aria-labelledby="mutation-result-heading"
      className="rounded-lg border border-ink-200 bg-white"
    >
      <h2
        id="mutation-result-heading"
        className="border-b border-ink-200 px-4 py-3 text-base font-bold text-ink-900"
      >
        نتیجهٔ آخرین ذخیره
      </h2>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {/* ---- 1. the write --------------------------------------------------------- */}
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
          <h3 className="text-sm font-bold text-emerald-900">۱. نوشتن در دیتااستور: موفق</h3>
          <dl className="mt-2 space-y-1 text-xs text-emerald-900">
            <Line label="واریانت" value={updatedVariant.name} />
            <Line label="شناسه" value={updatedVariant.id} mono />
            <Line label="قیمت جدید" value={formatPrice(updatedVariant.price)} />
            <Line label="موجودی" value={updatedVariant.available ? 'موجود' : 'ناموجود'} />
            <Line label="زمان به‌روزرسانی" value={formatDateTime(updatedVariant.updatedAt)} />
          </dl>
          <p className="mt-2 text-[11px] leading-5 text-emerald-800">
            این نوشتن پیش از هر تلاشی برای ارسال وبهوک انجام و ماندگار شده است. اگر ذخیره‌سازی شکست
            بخورد، هیچ وبهوکی ارسال نمی‌شود.
          </p>
        </div>

        {/* ---- 2. the webhook ------------------------------------------------------- */}
        <div
          className={`rounded border p-3 ${
            succeeded
              ? 'border-emerald-200 bg-emerald-50'
              : webhook.status === 'skipped'
                ? 'border-amber-300 bg-amber-50'
                : 'border-red-300 bg-red-50'
          }`}
        >
          <h3
            className={`text-sm font-bold ${
              succeeded
                ? 'text-emerald-900'
                : webhook.status === 'skipped'
                  ? 'text-amber-900'
                  : 'text-red-900'
            }`}
          >
            ۲. وبهوک باطل‌سازی کش Next.js:{' '}
            {succeeded ? 'موفق' : webhook.status === 'skipped' ? 'ارسال نشد' : 'ناموفق'}
          </h3>

          <dl className="mt-2 space-y-1 text-xs">
            <Line label="شناسهٔ رویداد" value={webhook.eventId} mono />
            {webhook.httpStatus !== undefined && (
              <Line label="کد HTTP" value={String(webhook.httpStatus)} />
            )}
            {webhook.duplicate !== undefined && (
              <Line label="تکراری بود؟" value={webhook.duplicate ? 'بله' : 'خیر'} />
            )}
          </dl>

          {webhook.invalidatedTags && webhook.invalidatedTags.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-bold">تگ‌هایی که Next.js باطل کرد</p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {webhook.invalidatedTags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-steel-700"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {webhook.invalidatedPaths && webhook.invalidatedPaths.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-bold">مسیرهای باطل‌شده</p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {webhook.invalidatedPaths.map((path) => (
                  <li
                    key={path}
                    className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-steel-700"
                  >
                    {path}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {webhook.error && (
            <p className="mt-2 rounded bg-white/60 p-2 font-mono text-[11px] break-all text-red-800">
              {webhook.error}
            </p>
          )}

          {!succeeded && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => onRetry(webhook.eventId)}
                disabled={retrying}
                className="rounded border border-red-400 bg-white px-3 py-1.5 text-xs font-medium text-red-800 transition hover:bg-red-100 disabled:opacity-50"
              >
                {retrying ? 'در حال تلاش دوباره…' : 'تلاش دوبارهٔ ارسال وبهوک'}
              </button>
              {retryError && <p className="mt-1 text-[11px] text-red-800">{retryError}</p>}
              <p className="mt-2 text-[11px] leading-5 text-red-800">
                داده در بک‌اند درست است، اما صفحات عمومی هنوز نسخهٔ کش‌شدهٔ قدیمی را نشان می‌دهند.
                این وضعیت با «برگرداندن تغییر» درست نمی‌شود؛ با «ارسال دوبارهٔ رویداد» درست می‌شود.
              </p>
            </div>
          )}

          {succeeded && (
            <p className="mt-2 text-[11px] leading-5 text-emerald-800">
              Next.js این ورودی‌های کش را «کهنه» علامت زد. هیچ درخواست GET جدیدی همین حالا به
              Express نمی‌رود؛ هر صفحه در اولین بازدید بعدی خودش یک بار داده می‌گیرد.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-ink-200 px-4 py-3 text-xs">
        <p className="text-ink-500">بررسی روی سایت عمومی:</p>
        <ul className="mt-1 flex flex-wrap gap-3">
          <li>
            <a
              href={`${PUBLIC_WEB_URL}/product/${productSlug}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-steel-600 hover:underline"
            >
              /product/{productSlug} ↗
            </a>
          </li>
          <li>
            <a
              href={`${PUBLIC_WEB_URL}/product/${productSlug}/${updatedVariant.slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-steel-600 hover:underline"
            >
              /product/{productSlug}/{updatedVariant.slug} ↗
            </a>
          </li>
          <li>
            <a
              href={`${PUBLIC_WEB_URL}/cache-lab`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-steel-600 hover:underline"
            >
              /cache-lab ↗
            </a>
          </li>
        </ul>
      </div>
    </section>
  )
}

function Line({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <dt className="opacity-70">{label}:</dt>
      <dd className={mono ? 'font-mono break-all' : ''}>{value}</dd>
    </div>
  )
}
