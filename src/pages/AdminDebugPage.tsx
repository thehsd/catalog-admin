import { API_BASE_URL } from '@/api/client'
import { useBackendStats, useWebhookEvents } from '@/queries/use-debug'
import { useRetryWebhook } from '@/queries/use-retry-webhook'
import { formatDateTime } from '@/lib/format'

/**
 * Backend request counters and webhook delivery history.
 *
 * Both queries poll. That is safe because Express classifies `/api/debug/*` as DEBUG
 * traffic and keeps it out of `total` and `catalogReads` — the instrument does not move
 * the needle it is reading.
 */
export function AdminDebugPage() {
  const statsQuery = useBackendStats({ refetchIntervalMs: 4000 })
  const eventsQuery = useWebhookEvents({ refetchIntervalMs: 4000 })
  const retryMutation = useRetryWebhook()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink-900">اشکال‌زدایی بک‌اند</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-500">
          شمارنده‌ها و تاریخچهٔ وبهوک، مستقیماً از{' '}
          <code className="font-mono">{API_BASE_URL}</code>. این درخواست‌ها به‌عنوان ترافیک debug
          شمرده می‌شوند و روی آمار «خواندن کاتالوگ» اثر نمی‌گذارند.
        </p>
      </header>

      <section
        aria-labelledby="stats-heading"
        className="rounded-lg border border-ink-200 bg-white p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="stats-heading" className="text-base font-bold text-ink-900">
            شمارنده‌های درخواست Express
          </h2>
          <span className="text-xs text-ink-500">
            {statsQuery.isFetching ? 'در حال به‌روزرسانی…' : 'هر ۴ ثانیه به‌روزرسانی می‌شود'}
          </span>
        </div>

        {statsQuery.isPending && <div className="mt-3 h-24 animate-pulse rounded bg-ink-100" />}

        {statsQuery.isError && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {statsQuery.error instanceof Error ? statsQuery.error.message : 'خطای ناشناخته'}
          </p>
        )}

        {statsQuery.isSuccess && (
          <>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ['کل درخواست‌ها', statsQuery.data.data.total],
                  ['خواندن کاتالوگ (عمومی)', statsQuery.data.data.catalogReads],
                  ['خواندن ادمین', statsQuery.data.data.adminReads],
                  ['تغییرات (PATCH)', statsQuery.data.data.mutations],
                  ['تلاش وبهوک', statsQuery.data.data.webhookAttempts],
                  ['وبهوک موفق', statsQuery.data.data.webhookSuccesses],
                  ['وبهوک ناموفق', statsQuery.data.data.webhookFailures],
                  ['درخواست debug', statsQuery.data.data.debugReads],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded border border-ink-200 p-3">
                  <dt className="text-xs text-ink-500">{label}</dt>
                  <dd className="mt-1 text-lg font-bold text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="table-scroll mt-4">
              <table className="w-full min-w-[26rem] border-collapse text-sm">
                <thead className="bg-ink-100 text-right text-xs text-ink-700">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      متد و مسیر
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      تعداد
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statsQuery.data.data.byMethodAndRoute)
                    .sort((a, b) => b[1] - a[1])
                    .map(([route, count]) => (
                      <tr key={route} className="border-t border-ink-200">
                        <td className="px-3 py-1.5 font-mono text-xs">{route}</td>
                        <td className="px-3 py-1.5">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-ink-500">
              آخرین درخواست:{' '}
              {statsQuery.data.data.lastRequestAt
                ? formatDateTime(statsQuery.data.data.lastRequestAt)
                : '—'}
            </p>
          </>
        )}
      </section>

      <section
        aria-labelledby="events-heading"
        className="rounded-lg border border-ink-200 bg-white p-4"
      >
        <h2 id="events-heading" className="text-base font-bold text-ink-900">
          تاریخچهٔ تحویل وبهوک
        </h2>
        <p className="mt-1 text-xs leading-6 text-ink-500">
          هر ردیف یک رویداد در «صندوق خروجی» Express است. دکمهٔ «تلاش دوباره» از Express می‌خواهد
          همان رویداد را دوباره بفرستد — با همان eventId، که همان چیزی است که باعث می‌شود Next.js
          تحویل تکراری را تشخیص دهد.
        </p>

        {eventsQuery.isPending && <div className="mt-3 h-24 animate-pulse rounded bg-ink-100" />}

        {eventsQuery.isSuccess && eventsQuery.data.data.webhookDisabled && (
          <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            ارسال وبهوک هم‌اکنون با <code className="font-mono">WEBHOOK_DISABLED=1</code> غیرفعال
            است (آزمایش F).
          </p>
        )}

        {eventsQuery.isSuccess && eventsQuery.data.data.events.length === 0 && (
          <p className="mt-3 text-sm text-ink-500">هنوز رویدادی ثبت نشده است.</p>
        )}

        {eventsQuery.isSuccess && eventsQuery.data.data.events.length > 0 && (
          <ul className="mt-3 space-y-2">
            {eventsQuery.data.data.events.map((event) => {
              const last = event.attempts[event.attempts.length - 1]
              return (
                <li key={event.eventId} className="rounded border border-ink-200 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 ${
                        event.status === 'success'
                          ? 'bg-emerald-50 text-emerald-700'
                          : event.status === 'skipped'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {event.status === 'success'
                        ? 'موفق'
                        : event.status === 'skipped'
                          ? 'ارسال‌نشده'
                          : 'ناموفق'}
                    </span>
                    <span className="font-mono">{event.event}</span>
                    <span className="text-ink-500">{formatDateTime(event.createdAt)}</span>
                    <span className="text-ink-500">{event.attempts.length} تلاش</span>
                    {last?.duplicate && (
                      <span className="rounded bg-steel-100 px-2 py-0.5 text-steel-700">
                        duplicate: true
                      </span>
                    )}
                  </div>

                  <p className="mt-1 font-mono text-[11px] break-all text-ink-500">
                    eventId={event.eventId}
                  </p>
                  <p className="mt-1 text-ink-700">
                    واریانت <code className="font-mono">{event.payload.variantId}</code> · محصول{' '}
                    <code className="font-mono">{event.payload.productSlug}</code> · دسته{' '}
                    <code className="font-mono">{event.payload.categorySlug}</code> · فیلدها:{' '}
                    {event.payload.changedFields.join('، ')}
                  </p>

                  {last?.invalidatedTags && last.invalidatedTags.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {last.invalidatedTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-steel-100 px-1.5 py-0.5 font-mono text-[11px] text-steel-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </p>
                  )}

                  {last?.error && <p className="mt-1 text-red-700">خطا: {last.error}</p>}

                  {event.status !== 'success' && (
                    <button
                      type="button"
                      onClick={() => retryMutation.mutate(event.eventId)}
                      disabled={retryMutation.isPending}
                      className="mt-2 rounded border border-ink-300 px-2.5 py-1 text-[11px] text-ink-700 transition hover:border-steel-500 hover:text-steel-700 disabled:opacity-50"
                    >
                      {retryMutation.isPending ? 'در حال تلاش…' : 'تلاش دوبارهٔ ارسال'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
