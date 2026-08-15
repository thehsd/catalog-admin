import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-8 text-center">
      <h1 className="text-lg font-bold text-ink-900">صفحه پیدا نشد</h1>
      <p className="mt-2 text-sm text-ink-500">این مسیر در پنل ادمین وجود ندارد.</p>
      <p className="mt-4">
        <Link to="/" className="text-sm text-steel-600 hover:underline">
          بازگشت به فهرست محصولات
        </Link>
      </p>
    </div>
  )
}
