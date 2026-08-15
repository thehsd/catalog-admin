import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { Fragment, useMemo, useState } from 'react'
import type { ApiError } from '@/api/client'
import { PUBLIC_WEB_URL } from '@/api/client'
import type { Category, Variant, VariantUpdateInput } from '@/domain/types'
import { formatDateTime, formatNumber, formatPrice } from '@/lib/format'
import { VariantEditRow } from './VariantEditRow'

const columnHelper = createColumnHelper<Variant>()

/**
 * The admin variant table: TanStack Table for the rows, inline editing for one row at a
 * time.
 *
 * Editing is single-row on purpose. Each save is one PATCH producing one webhook, which
 * keeps the request accounting in the Cache Lab legible — "one edit, one PATCH, one
 * webhook" is a claim you can check by counting lines in the Express terminal.
 */
export function VariantTable({
  variants,
  category,
  productSlug,
  pendingVariantId,
  mutationError,
  onSave,
}: {
  variants: Variant[]
  category: Category
  productSlug: string
  pendingVariantId: string | null
  mutationError: ApiError | null
  /** Resolves `true` when the write succeeded, which is when the editor may close. */
  onSave: (variantId: string, patch: VariantUpdateInput) => Promise<boolean>
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  const columns = useMemo(() => {
    const attributeColumns = category.attributes.map((attribute) =>
      columnHelper.accessor((row) => row.attributes[attribute.slug] ?? '—', {
        id: `attr-${attribute.slug}`,
        header: attribute.unit ? `${attribute.name} (${attribute.unit})` : attribute.name,
        cell: (info) => {
          const value = info.getValue()
          return typeof value === 'number' ? formatNumber(value) : String(value)
        },
      }),
    )

    return [
      columnHelper.accessor('name', {
        header: 'واریانت',
        cell: (info) => (
          <div>
            <span className="font-medium text-ink-900">{info.getValue()}</span>
            <a
              href={`${PUBLIC_WEB_URL}/product/${productSlug}/${info.row.original.slug}`}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block font-mono text-[11px] text-steel-600 hover:underline"
            >
              /product/{productSlug}/{info.row.original.slug} ↗
            </a>
          </div>
        ),
      }),
      ...attributeColumns,
      columnHelper.accessor('price', {
        header: 'قیمت',
        cell: (info) => (
          <span className={info.getValue() === null ? 'text-ink-500' : ''}>
            {formatPrice(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('available', {
        header: 'موجودی',
        cell: (info) => (
          <span
            className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs ${
              info.getValue() ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'
            }`}
          >
            {info.getValue() ? 'موجود' : 'ناموجود'}
          </span>
        ),
      }),
      columnHelper.accessor('updatedAt', {
        header: 'آخرین به‌روزرسانی',
        cell: (info) => (
          <time dateTime={info.getValue()} className="whitespace-nowrap text-xs text-ink-500">
            {formatDateTime(info.getValue())}
          </time>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'عملیات',
        cell: (info) => (
          <button
            type="button"
            onClick={() => setEditingId(info.row.original.id)}
            disabled={editingId !== null}
            className="rounded border border-ink-300 px-2.5 py-1 text-xs text-ink-700 transition hover:border-steel-500 hover:text-steel-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ویرایش
          </button>
        ),
      }),
    ]
  }, [category.attributes, productSlug, editingId])

  const table = useReactTable({
    data: variants,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (variants.length === 0) {
    return <p className="px-4 py-6 text-sm text-ink-500">این محصول هیچ واریانتی ندارد.</p>
  }

  const columnCount = table.getAllLeafColumns().length

  return (
    <div className="table-scroll">
      <table className="w-full min-w-[60rem] border-collapse text-sm">
        <caption className="sr-only">جدول واریانت‌های قابل ویرایش</caption>
        <thead className="bg-ink-100 text-right text-xs text-ink-700">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} scope="col" className="px-3 py-2 font-medium">
                  {header.column.getCanSort() ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex items-center gap-1 hover:text-steel-700"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span aria-hidden className="text-ink-300">
                        {{ asc: '▲', desc: '▼' }[header.column.getIsSorted() as string] ?? ''}
                      </span>
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <Fragment key={row.id}>
              <tr
                className={`border-t border-ink-200 ${
                  editingId === row.original.id ? 'bg-steel-50' : 'hover:bg-ink-50'
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>

              {editingId === row.original.id && (
                <VariantEditRow
                  variant={row.original}
                  category={category}
                  columnCount={columnCount}
                  pending={pendingVariantId === row.original.id}
                  error={mutationError}
                  onCancel={() => setEditingId(null)}
                  onSave={(patch) => {
                    // The editor stays open while the request is in flight and stays open
                    // on failure, so the API's validation errors are shown next to the
                    // inputs that caused them rather than after the form has vanished.
                    void onSave(row.original.id, patch).then((succeeded) => {
                      if (succeeded) setEditingId(null)
                    })
                  }}
                />
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
