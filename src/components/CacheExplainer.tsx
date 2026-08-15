/**
 * The permanently visible explanation of the two caches.
 *
 * It is on the page rather than in the README because the confusion it prevents is a
 * confusion people have *while clicking Save* — "I invalidated the cache, why is the
 * public site still wrong?"
 */
export function CacheExplainer() {
  return (
    <section
      aria-labelledby="two-caches-heading"
      className="rounded-lg border border-ink-200 bg-white p-4"
    >
      <h2 id="two-caches-heading" className="text-base font-bold text-ink-900">
        دو کش مستقل که هیچ ربطی به هم ندارند
      </h2>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-ink-200 p-3">
          <h3 className="text-sm font-bold text-ink-900">۱. کش TanStack Query (همین مرورگر)</h3>
          <ul className="mt-2 space-y-1 text-xs leading-6 text-ink-700">
            <li>کجاست: حافظهٔ همین تب مرورگر.</li>
            <li>مالکش: پنل ادمین.</li>
            <li>
              چطور باطل می‌شود: <code className="font-mono">queryClient.invalidateQueries()</code>
            </li>
            <li>چه کسی می‌بیند: فقط همین کاربر، در همین تب.</li>
            <li>با رفرش صفحه: کاملاً از بین می‌رود.</li>
          </ul>
        </div>

        <div className="rounded border border-ink-200 p-3">
          <h3 className="text-sm font-bold text-ink-900">۲. کش سمت سرور Next.js (پورت ۳۰۰۰)</h3>
          <ul className="mt-2 space-y-1 text-xs leading-6 text-ink-700">
            <li>کجاست: پروسهٔ سرور Next.js، بیرون از این برنامه.</li>
            <li>مالکش: catalog-web.</li>
            <li>
              چطور باطل می‌شود: <code className="font-mono">revalidateTag()</code> در وبهوکی که
              Express می‌فرستد.
            </li>
            <li>چه کسی می‌بیند: همهٔ بازدیدکنندگان عمومی.</li>
            <li>با رفرش مرورگر: هیچ تغییری نمی‌کند.</li>
          </ul>
        </div>
      </div>

      <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
        <p className="font-bold">چیزی که باطل‌کردن یکی، با دیگری نمی‌کند</p>
        <p className="mt-1">
          <code className="font-mono">invalidateQueries()</code> فقط کش مرورگر همین پنل را باطل
          می‌کند و هیچ اثری روی کش سرور Next.js ندارد. برعکس هم درست است: وبهوک Express کش سرور
          Next.js را باطل می‌کند و هیچ کاری با کش این پنل ندارد. این دو در دو پروسهٔ جدا زندگی
          می‌کنند و مکانیزم مشترکی ندارند.
        </p>
        <p className="mt-1">
          <code className="font-mono">router.refresh()</code> هم راه‌حل نیست: آن یک API کلاینتی
          Next.js است، این برنامه اصلاً Next.js نیست، و حتی داخل Next.js هم فقط باعث رندر دوباره
          می‌شود، نه باطل‌شدن کش سرور.
        </p>
      </div>

      <p className="mt-3 text-xs leading-6 text-ink-500">
        جریان کامل یک ویرایش: پنل ادمین ← <code className="font-mono">PATCH</code> به Express ←
        Express اعتبارسنجی و ذخیره می‌کند ← Express وبهوک امضاشده را به Next.js می‌فرستد ← Next.js
        تگ‌ها را باطل می‌کند ← Express به پنل ادمین پاسخ می‌دهد ← پنل ادمین کش TanStack Query خودش
        را باطل می‌کند. مرورگر هیچ‌وقت راز وبهوک را نمی‌بیند و هیچ‌وقت مستقیماً با Next.js حرف
        نمی‌زند.
      </p>
    </section>
  )
}
