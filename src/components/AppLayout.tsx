import { Link, NavLink, Outlet } from 'react-router'
import { API_BASE_URL, PUBLIC_WEB_URL } from '@/api/client'

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <Link to="/" className="font-bold text-ink-900">
            پنل ادمین کاتالوگ
          </Link>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'font-medium text-steel-700' : 'text-ink-700 hover:text-steel-700'
            }
          >
            محصولات
          </NavLink>
          <NavLink
            to="/debug"
            className={({ isActive }) =>
              isActive ? 'font-medium text-steel-700' : 'text-ink-700 hover:text-steel-700'
            }
          >
            اشکال‌زدایی
          </NavLink>
          <a
            href={`${PUBLIC_WEB_URL}/cache-lab`}
            target="_blank"
            rel="noreferrer"
            className="mr-auto rounded border border-ink-200 px-2 py-1 text-xs text-ink-700 hover:border-steel-500 hover:text-steel-700"
          >
            آزمایشگاه کش Next.js ↗
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 text-xs leading-6 text-ink-500">
        برنامهٔ مستقل React + Vite. بک‌اند: <code className="font-mono">{API_BASE_URL}</code> · سایت
        عمومی: <code className="font-mono">{PUBLIC_WEB_URL}</code>
        <br />
        این برنامه هیچ‌گاه <code className="font-mono">/api/revalidate</code> را صدا نمی‌زند و راز
        وبهوک را در اختیار ندارد.
      </footer>
    </div>
  )
}
