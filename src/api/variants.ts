import { apiRequest, type Fetched } from './client'
import type { VariantUpdateInput } from '@/domain/types'
import {
  variantUpdateResultSchema,
  type VariantUpdateResultPayload,
} from '@/schemas/catalog.schemas'

/**
 * The one mutation this application performs.
 *
 * Note the destination: Express, on port 4000. NOT Next.js.
 *
 * The admin's job ends when Express answers. Everything that happens next — persisting,
 * building the event, delivering the webhook, invalidating the Next.js cache — happens
 * server-side, inside catalog-api, where a secret can be kept and where the write is
 * already durable before anything is announced.
 */
export function updateVariant(
  variantId: string,
  patch: VariantUpdateInput,
): Promise<Fetched<VariantUpdateResultPayload>> {
  return apiRequest(
    `/api/admin/variants/${encodeURIComponent(variantId)}`,
    variantUpdateResultSchema,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
}
