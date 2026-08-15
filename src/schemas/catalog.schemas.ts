import { z } from 'zod'

/** Express is an external system; nothing it returns is trusted before it is parsed. */

export const attributeValueSchema = z.object({
  label: z.string().min(1),
  slug: z.string().min(1),
  value: z.union([z.string(), z.number()]),
})

export const categoryAttributeDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  unit: z.string().optional(),
  filterable: z.boolean(),
  values: z.array(attributeValueSchema),
})

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  attributes: z.array(categoryAttributeDefinitionSchema),
})

export const variantSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  price: z.number().nullable(),
  currency: z.literal('IRR'),
  available: z.boolean(),
  attributes: z.record(z.string(), z.union([z.string(), z.number()])),
  updatedAt: z.string().min(1),
})

export const productSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  variants: z.array(variantSchema),
})

export const apiDebugMetadataSchema = z.object({
  requestId: z.string().min(1),
  backendRequestNumber: z.number().int().nonnegative(),
  endpointRequestNumber: z.number().int().nonnegative(),
  generatedAt: z.string().min(1),
})

export function apiResponseSchema<T extends z.ZodType>(data: T) {
  return z.object({ data, debug: apiDebugMetadataSchema })
}

export const productPayloadSchema = z.object({
  product: productSchema,
  category: categorySchema,
})

export const productListPayloadSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      categoryId: z.string(),
      categorySlug: z.string().nullable(),
      variantCount: z.number().int().nonnegative(),
    }),
  ),
  categories: z.array(categorySchema),
})

export const webhookResultSummarySchema = z.object({
  status: z.enum(['success', 'failed', 'skipped']),
  eventId: z.string().min(1),
  httpStatus: z.number().optional(),
  duplicate: z.boolean().optional(),
  invalidatedTags: z.array(z.string()).optional(),
  invalidatedPaths: z.array(z.string()).optional(),
  error: z.string().optional(),
})

export const variantUpdateResultSchema = z.object({
  updatedVariant: variantSchema,
  product: productSchema,
  category: categorySchema,
  webhook: webhookResultSummarySchema,
})

export const requestStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  byMethodAndRoute: z.record(z.string(), z.number()),
  catalogReads: z.number().int().nonnegative(),
  adminReads: z.number().int().nonnegative(),
  mutations: z.number().int().nonnegative(),
  webhookAttempts: z.number().int().nonnegative(),
  webhookSuccesses: z.number().int().nonnegative(),
  webhookFailures: z.number().int().nonnegative(),
  debugReads: z.number().int().nonnegative(),
  startedAt: z.string(),
  resetAt: z.string(),
  lastRequestAt: z.string().nullable(),
})

export const webhookAttemptSchema = z.object({
  attemptNumber: z.number().int().positive(),
  attemptedAt: z.string(),
  durationMs: z.number(),
  status: z.enum(['success', 'failed', 'skipped']),
  httpStatus: z.number().optional(),
  duplicate: z.boolean().optional(),
  invalidatedTags: z.array(z.string()).optional(),
  invalidatedPaths: z.array(z.string()).optional(),
  error: z.string().optional(),
})

export const webhookEventRecordSchema = z.object({
  eventId: z.string(),
  event: z.literal('variant.updated'),
  payload: z.object({
    eventId: z.string(),
    event: z.literal('variant.updated'),
    occurredAt: z.string(),
    variantId: z.string(),
    variantSlug: z.string(),
    productId: z.string(),
    productSlug: z.string(),
    categoryId: z.string(),
    categorySlug: z.string(),
    changedFields: z.array(z.string()),
  }),
  createdAt: z.string(),
  status: z.enum(['success', 'failed', 'skipped']),
  attempts: z.array(webhookAttemptSchema),
})

export const webhookEventsPayloadSchema = z.object({
  events: z.array(webhookEventRecordSchema),
  webhookDisabled: z.boolean(),
})

export const retryWebhookPayloadSchema = z.object({
  event: webhookEventRecordSchema,
  attempt: webhookAttemptSchema,
  webhook: webhookResultSummarySchema,
})

/**
 * Client-side mirror of the API's PATCH contract.
 *
 * Validating here is a UX affordance — it turns "negative price" into an inline message
 * instead of a round trip. It is emphatically NOT a security control: Express re-validates
 * everything, because anything a browser checks, a browser can be made to skip.
 */
export const variantUpdateInputSchema = z
  .object({
    price: z.number().nonnegative('قیمت نمی‌تواند منفی باشد').nullable().optional(),
    available: z.boolean().optional(),
    attributes: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'اسلاگ باید فقط حروف کوچک انگلیسی، رقم و خط تیره باشد')
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'هیچ تغییری برای ذخیره وجود ندارد',
  })

export type ProductPayload = z.infer<typeof productPayloadSchema>
export type ProductListPayload = z.infer<typeof productListPayloadSchema>
export type VariantUpdateResultPayload = z.infer<typeof variantUpdateResultSchema>
export type WebhookEventsPayload = z.infer<typeof webhookEventsPayloadSchema>
export type RetryWebhookPayload = z.infer<typeof retryWebhookPayloadSchema>
