/**
 * Formatting helpers shared by server and client components.
 *
 * The timezone is pinned so a value formatted during server rendering and the same value
 * formatted after hydration produce identical strings. Without it, every timestamp on the
 * page is a hydration mismatch waiting to happen.
 */

const priceFormatter = new Intl.NumberFormat('fa-IR')
const dateTimeFormatter = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Asia/Tehran',
})

export function formatPrice(price: number | null): string {
  if (price === null) return 'تماس بگیرید'
  return `${priceFormatter.format(price)} ریال`
}

export function formatNumber(value: number | string): string {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? priceFormatter.format(numeric) : String(value)
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return dateTimeFormatter.format(date)
}
