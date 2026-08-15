/**
 * Domain types for catalog-admin.
 *
 * A third independent copy — see the note in catalog-api and catalog-web. These are the
 * *admin's* view of the contract, which is why this file has mutation and webhook-result
 * types that catalog-web has no use for, and no cache-tag types at all.
 *
 * Every response from Express is parsed with the Zod schemas in `src/schemas/` before it
 * reaches a component, which is what keeps the three copies from drifting apart.
 */

export type AttributeValue = {
  label: string
  slug: string
  value: string | number
}

export type CategoryAttributeDefinition = {
  id: string
  name: string
  slug: string
  unit?: string
  filterable: boolean
  values: AttributeValue[]
}

export type Category = {
  id: string
  name: string
  slug: string
  description?: string
  attributes: CategoryAttributeDefinition[]
}

export type Variant = {
  id: string
  productId: string
  name: string
  slug: string
  price: number | null
  currency: 'IRR'
  available: boolean
  attributes: Record<string, string | number>
  updatedAt: string
}

export type Product = {
  id: string
  categoryId: string
  name: string
  slug: string
  description?: string
  variants: Variant[]
}

export type ApiDebugMetadata = {
  requestId: string
  backendRequestNumber: number
  endpointRequestNumber: number
  generatedAt: string
}

/** What the admin may change on a variant. */
export type VariantUpdateInput = {
  price?: number | null
  available?: boolean
  attributes?: Record<string, string | number>
  slug?: string
}

/**
 * The webhook block Express returns with a successful mutation.
 *
 * This is the admin's only window onto the Next.js cache. The admin cannot observe that
 * cache, cannot invalidate it, and does not own it — it can only see the report of what
 * Express asked Next.js to do on its behalf.
 */
export type WebhookResultSummary = {
  status: 'success' | 'failed' | 'skipped'
  eventId: string
  httpStatus?: number
  duplicate?: boolean
  invalidatedTags?: string[]
  invalidatedPaths?: string[]
  error?: string
}

export type VariantUpdateResult = {
  updatedVariant: Variant
  product: Product
  category: Category
  webhook: WebhookResultSummary
}

export type RequestStats = {
  total: number
  byMethodAndRoute: Record<string, number>
  catalogReads: number
  adminReads: number
  mutations: number
  webhookAttempts: number
  webhookSuccesses: number
  webhookFailures: number
  debugReads: number
  startedAt: string
  resetAt: string
  lastRequestAt: string | null
}

export type WebhookAttempt = {
  attemptNumber: number
  attemptedAt: string
  durationMs: number
  status: 'success' | 'failed' | 'skipped'
  httpStatus?: number
  duplicate?: boolean
  invalidatedTags?: string[]
  invalidatedPaths?: string[]
  error?: string
}

export type WebhookEventRecord = {
  eventId: string
  event: 'variant.updated'
  payload: {
    eventId: string
    event: 'variant.updated'
    occurredAt: string
    variantId: string
    variantSlug: string
    productId: string
    productSlug: string
    categoryId: string
    categorySlug: string
    changedFields: string[]
  }
  createdAt: string
  status: 'success' | 'failed' | 'skipped'
  attempts: WebhookAttempt[]
}
