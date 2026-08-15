import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateVariant } from '@/api/variants'
import type { VariantUpdateInput } from '@/domain/types'
import { adminQueryKeys } from './query-keys'

/**
 * The variant update mutation.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THE TWO CACHES, AND WHY ONLY ONE OF THEM IS INVALIDATED HERE
 * ═══════════════════════════════════════════════════════════════════════════════════
 * On success this hook calls `queryClient.invalidateQueries(...)`. That refreshes the
 * TanStack Query cache — an in-memory object inside THIS browser tab. Nothing else.
 *
 * It does not, and cannot, touch the Next.js server cache. That cache lives in a
 * different process, on a different port, in a different application, and it is
 * invalidated by exactly one thing: the webhook Express sends after it has persisted the
 * write.
 *
 * The proof is Experiment F: disable the webhook, save a price, and watch this screen
 * show the new value (because `invalidateQueries` worked) while the public page keeps
 * serving the old one (because nothing invalidated the server cache).
 *
 * `router.refresh()` would not help either — that is a Next.js client API, this is not a
 * Next.js application, and even inside Next.js it re-renders rather than invalidating the
 * server cache.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */
export function useUpdateVariant(productSlug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ variantId, patch }: { variantId: string; patch: VariantUpdateInput }) =>
      updateVariant(variantId, patch),

    // `onSuccess` only — a rejected mutation must invalidate nothing. Refetching after a
    // failed write would just replace good local state with the same unchanged server
    // state, hiding the fact that nothing happened.
    onSuccess: () => {
      // 1. This product's rows in THIS browser.
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.product(productSlug) })

      // 2. The debug panels, so the request counters and the new webhook event appear
      //    without a manual reload.
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.backendStats() })
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.webhookEvents() })

      // 3. …and that is the complete list. There is deliberately no third-party call, no
      //    fetch to :3000, and no revalidation request. See the block comment above.
    },
  })
}
