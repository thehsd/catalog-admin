import { useMutation, useQueryClient } from '@tanstack/react-query'
import { retryWebhook } from '@/api/debug'
import { adminQueryKeys } from './query-keys'

/**
 * Ask Express to re-deliver a failed webhook.
 *
 * The admin never delivers it itself — it has no secret, and the Next.js webhook only
 * accepts calls from a server that holds one. This mutation is a request to the backend
 * to try its queue item again, which is exactly what `queue:retry` is in Laravel.
 */
export function useRetryWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (eventId: string) => retryWebhook(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.webhookEvents() })
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.backendStats() })
    },
  })
}
