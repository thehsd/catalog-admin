import { apiRequest, type Fetched } from './client'
import {
  requestStatsSchema,
  retryWebhookPayloadSchema,
  webhookEventsPayloadSchema,
  type RetryWebhookPayload,
  type WebhookEventsPayload,
} from '@/schemas/catalog.schemas'
import type { RequestStats } from '@/domain/types'

/** Instrumentation. Express classifies all of these as DEBUG and excludes them from `total`. */

export function fetchBackendStats(): Promise<Fetched<RequestStats>> {
  return apiRequest('/api/debug/stats', requestStatsSchema)
}

export function fetchWebhookEvents(): Promise<Fetched<WebhookEventsPayload>> {
  return apiRequest('/api/debug/webhook-events', webhookEventsPayloadSchema)
}

/**
 * Retry a failed delivery — the MVP's stand-in for `php artisan queue:retry`.
 *
 * The admin asks EXPRESS to retry. It does not, and cannot, deliver the webhook itself:
 * the browser has no secret, and the whole point of the architecture is that only the
 * backend may invalidate the frontend's cache.
 *
 * The retry reuses the original eventId, which is what lets Next.js recognise a
 * redelivery of something that already landed and answer `duplicate: true`.
 */
export function retryWebhook(eventId: string): Promise<Fetched<RetryWebhookPayload>> {
  return apiRequest(
    `/api/debug/retry-webhook/${encodeURIComponent(eventId)}`,
    retryWebhookPayloadSchema,
    { method: 'POST' },
  )
}
