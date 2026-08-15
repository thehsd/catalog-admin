import { useQuery } from '@tanstack/react-query'
import { fetchBackendStats, fetchWebhookEvents } from '@/api/debug'
import { adminQueryKeys } from './query-keys'

export function useBackendStats(options: { refetchIntervalMs?: number } = {}) {
  return useQuery({
    queryKey: adminQueryKeys.backendStats(),
    queryFn: fetchBackendStats,
    // Polling is safe here: Express classifies /api/debug/* as DEBUG traffic and keeps it
    // out of `total` and `catalogReads`, so watching the counters never moves them.
    ...(options.refetchIntervalMs ? { refetchInterval: options.refetchIntervalMs } : {}),
  })
}

export function useWebhookEvents(options: { refetchIntervalMs?: number } = {}) {
  return useQuery({
    queryKey: adminQueryKeys.webhookEvents(),
    queryFn: fetchWebhookEvents,
    ...(options.refetchIntervalMs ? { refetchInterval: options.refetchIntervalMs } : {}),
  })
}
