import { useMemo, useState } from 'react'
import type { Category, Variant, VariantUpdateInput } from '@/domain/types'
import type { ApiError } from '@/api/client'
import { variantUpdateInputSchema } from '@/schemas/catalog.schemas'
import { formatPrice } from '@/lib/format'

/**
 * The inline edit form for one variant row.
 *
 * Two rules shape it:
 *
 *  1. It sends a *patch*, not the whole entity. Only fields the user actually changed are
 *     included, so an edit to a price cannot silently rewrite an attribute someone else
 *     changed a second earlier.
 *
 *  2. Attribute controls are generated from the CATEGORY DEFINITION, never free text. A
 *     variant may only carry attributes its category defines, with values that category
 *     allows — so the UI offers exactly those and nothing else. Express re-checks it all;
 *     this is the affordance, not the enforcement.
 */
export function VariantEditRow({
  variant,
  category,
  columnCount,
  pending,
  error,
  onCancel,
  onSave,
}: {
  variant: Variant
  category: Category
  columnCount: number
  pending: boolean
  error: ApiError | null
  onCancel: () => void
  onSave: (patch: VariantUpdateInput) => void
}) {
  const [price, setPrice] = useState<string>(variant.price === null ? '' : String(variant.price))
  const [available, setAvailable] = useState<boolean>(variant.available)
  const [attributes, setAttributes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      category.attributes.map((attribute) => [
        attribute.slug,
        variant.attributes[attribute.slug] === undefined
          ? ''
          : String(variant.attributes[attribute.slug]),
      ]),
    ),
  )
  const [localError, setLocalError] = useState<string | null>(null)

  /** Only what actually changed — that is what makes this a PATCH. */
  const patch = useMemo<VariantUpdateInput>(() => {
    const next: VariantUpdateInput = {}

    const trimmed = price.trim()
    const parsedPrice = trimmed === '' ? null : Number(trimmed)
    if (parsedPrice !== variant.price && !(trimmed !== '' && Number.isNaN(parsedPrice))) {
      next.price = parsedPrice
    }

    if (available !== variant.available) next.available = available

    const changedAttributes: Record<string, string | number> = {}
    for (const attribute of category.attributes) {
      const value = attributes[attribute.slug]
      if (value === undefined || value === '') continue
      const current = variant.attributes[attribute.slug]
      if (current === undefined || String(current) !== value) {
        // Send the value in the type the category declares, so `12` stays a number.
        const definition = attribute.values.find((candidate) => String(candidate.value) === value)
        changedAttributes[attribute.slug] = definition ? definition.value : value
      }
    }
    if (Object.keys(changedAttributes).length > 0) next.attributes = changedAttributes

    return next
  }, [price, available, attributes, variant, category])

  const hasChanges = Object.keys(patch).length > 0

  function handleSave() {
    setLocalError(null)

    const trimmed = price.trim()
    if (trimmed !== '' && Number.isNaN(Number(trimmed))) {
      setLocalError('قیمت باید عدد باشد')
      return
    }

    const parsed = variantUpdateInputSchema.safeParse(patch)
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? 'ورودی نامعتبر است')
      return
    }

    onSave(patch)
  }

  const fieldIssues = error?.issues ?? []

  return (
    <tr className="border-t-2 border-steel-500 bg-steel-50">
      <td colSpan={columnCount} className="px-3 py-4">
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            handleSave()
          }}
          aria-label={`ویرایش ${variant.name}`}
          /* Native constraint validation is switched off deliberately: its error bubbles
             are neither translatable nor RTL-aware, and silently refusing to submit is a
             dead end for the user. The same rules are enforced here with Zod (shown
             inline, in Persian) and again by Express, which is the real boundary. */
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor={`price-${variant.id}`}
                className="block text-xs font-medium text-ink-700"
              >
                قیمت (ریال)
              </label>
              <input
                id={`price-${variant.id}`}
                type="number"
                min={0}
                step="any"
                inputMode="numeric"
                value={price}
                disabled={pending}
                onChange={(changeEvent) => setPrice(changeEvent.target.value)}
                className="mt-1 w-full rounded border border-ink-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
                placeholder="خالی = تماس بگیرید"
              />
              <p className="mt-1 text-[11px] text-ink-500">فعلی: {formatPrice(variant.price)}</p>
            </div>

            <div>
              <span className="block text-xs font-medium text-ink-700">موجودی</span>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={available}
                  disabled={pending}
                  onChange={(changeEvent) => setAvailable(changeEvent.target.checked)}
                  className="size-4"
                />
                موجود است
              </label>
            </div>

            {category.attributes.map((attribute) => (
              <div key={attribute.id}>
                <label
                  htmlFor={`attr-${variant.id}-${attribute.slug}`}
                  className="block text-xs font-medium text-ink-700"
                >
                  {attribute.name}
                  {attribute.unit ? ` (${attribute.unit})` : ''}
                </label>
                <select
                  id={`attr-${variant.id}-${attribute.slug}`}
                  value={attributes[attribute.slug] ?? ''}
                  disabled={pending}
                  onChange={(changeEvent) =>
                    setAttributes((current) => ({
                      ...current,
                      [attribute.slug]: changeEvent.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-ink-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
                >
                  <option value="">— تعیین نشده —</option>
                  {attribute.values.map((value) => (
                    <option key={value.slug} value={String(value.value)}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {(localError || error) && (
            <div role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm">
              <p className="font-medium text-red-900">{localError ?? error?.message}</p>
              {fieldIssues.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-xs text-red-800">
                  {fieldIssues.map((issue, index) => (
                    <li key={`${issue.path}-${index}`}>
                      {issue.path ? `${issue.path}: ` : ''}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={pending || !hasChanges}
              className="rounded bg-steel-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-steel-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded border border-ink-300 px-4 py-1.5 text-sm text-ink-700 transition hover:border-ink-500 disabled:opacity-50"
            >
              انصراف
            </button>
            {!hasChanges && (
              <span className="text-xs text-ink-500">
                هنوز تغییری نداده‌اید. Express درخواست بدون تغییر را رد می‌کند.
              </span>
            )}
            {hasChanges && (
              <span className="text-xs text-ink-500">
                ارسال می‌شود:{' '}
                <code className="font-mono">{JSON.stringify(patch)}</code>
              </span>
            )}
          </div>
        </form>
      </td>
    </tr>
  )
}
