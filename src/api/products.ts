import { apiRequest, type Fetched } from './client'
import {
  productListPayloadSchema,
  productPayloadSchema,
  type ProductListPayload,
  type ProductPayload,
} from '@/schemas/catalog.schemas'

/**
 * Admin reads.
 *
 * These hit `/api/admin/*`, which Express counts as ADMIN traffic rather than CATALOG
 * traffic. That separation is deliberate: an admin refetch is real backend load, but it
 * is not public-storefront load, and mixing them would make every cache experiment in
 * this project unreadable.
 */

export function fetchProductList(): Promise<Fetched<ProductListPayload>> {
  return apiRequest('/api/admin/products', productListPayloadSchema)
}

export function fetchAdminProduct(productSlug: string): Promise<Fetched<ProductPayload>> {
  return apiRequest(`/api/admin/products/${encodeURIComponent(productSlug)}`, productPayloadSchema)
}
