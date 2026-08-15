/**
 * TanStack Query keys.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THESE KEYS ADDRESS — AND WHAT THEY DO NOT
 * ─────────────────────────────────────────────────────────────────────────────────────
 * These name entries in ONE cache: the in-memory TanStack Query cache inside this browser
 * tab. It is per-user, per-tab, and gone on refresh.
 *
 * `queryClient.invalidateQueries({ queryKey: adminQueryKeys.product(slug) })` marks that
 * browser-local entry stale and refetches it. It has no effect whatsoever on:
 *   • another admin's browser tab
 *   • the Next.js server cache on port 3000
 *   • anything a public visitor sees
 *
 * The Next.js cache is invalidated by Express's webhook, on the server, and by nothing
 * else. Two caches, two owners, two invalidation mechanisms — see CacheExplainer.tsx.
 *
 * The `admin` prefix is a further hint: even the *namespace* of these keys belongs to
 * this application. Next.js cache tags (`product:zob-ahan-rebar`) are a different
 * vocabulary in a different process.
 */
export const adminQueryKeys = {
  productList: () => ['admin', 'products'] as const,

  product: (productSlug: string) => ['admin', 'product', productSlug] as const,

  backendStats: () => ['admin', 'debug', 'backend-stats'] as const,

  webhookEvents: () => ['admin', 'debug', 'webhook-events'] as const,
} as const
