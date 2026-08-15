import type { z } from 'zod'
import type { ApiDebugMetadata } from '@/domain/types'
import { apiResponseSchema } from '@/schemas/catalog.schemas'

/**
 * The HTTP client. Every request in this application goes to Express, directly.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE MUST NEVER CONTAIN
 * ─────────────────────────────────────────────────────────────────────────────────────
 *  • The Next.js origin. The admin does not call Next.js at all — not for reads, not for
 *    writes, and above all not for `/api/revalidate`.
 *  • The revalidation secret. Vite inlines every VITE_* variable into the browser bundle,
 *    so a secret here would be published to every visitor. Cache invalidation is Express's
 *    job precisely because Express is a server and can keep one.
 *
 * `VITE_PUBLIC_WEB_URL` is the one Next.js-related value present, and it is used solely to
 * build hyperlinks a human can click.
 */

export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'
).replace(/\/$/, '')

export const PUBLIC_WEB_URL: string = (
  import.meta.env.VITE_PUBLIC_WEB_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')

/** Every endpoint in this application lives under Express's `/api` mount point. */
const API_PREFIX = '/api'

/**
 * Joins the configured base with an endpoint path.
 *
 * `VITE_API_BASE_URL` answers "where is Express from the browser's point of view", and
 * that has two legitimately different shapes:
 *
 *   http://localhost:4000   cross-origin, direct — `pnpm dev` against a local Express.
 *                           Express answers on :4000 and CORS applies.
 *   /api                    same-origin, proxied — the Docker deployment. The browser asks
 *                           the Nginx container that served this SPA, and Nginx forwards
 *                           `/api/*` to `http://catalog-api:4000/api/*`. No CORS involved,
 *                           and the browser never needs to resolve a Docker DNS name,
 *                           which it could not do anyway.
 *
 * The second shape already *is* the prefix, so repeating it would produce `/api/api/...`.
 * Collapsing the overlap here keeps both configurations working from one code path, and
 * keeps every call site written the way Express actually documents its routes.
 */
export function resolveApiUrl(base: string, path: string): string {
  const trimmed = base.replace(/\/$/, '')
  return trimmed.endsWith(API_PREFIX) && path.startsWith(`${API_PREFIX}/`)
    ? `${trimmed}${path.slice(API_PREFIX.length)}`
    : `${trimmed}${path}`
}

export type ApiIssue = { path: string; message: string }

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** Field-level issues from Express, rendered next to the inputs that caused them. */
  get issues(): ApiIssue[] {
    if (!Array.isArray(this.details)) return []
    return this.details.flatMap((issue) => {
      if (!issue || typeof issue !== 'object') return []
      const record = issue as Record<string, unknown>
      const path =
        typeof record.path === 'string'
          ? record.path
          : typeof record.attributeSlug === 'string'
            ? record.attributeSlug
            : ''
      const message = typeof record.message === 'string' ? record.message : ''
      return message ? [{ path, message }] : []
    })
  }
}

export type Fetched<T> = {
  data: T
  debug: ApiDebugMetadata
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<Fetched<T>> {
  const url = resolveApiUrl(API_BASE_URL, path)

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    })
  } catch (error) {
    // Almost always "Express is not running", a CORS rejection, or — in the Docker
    // deployment — an Nginx proxy that cannot reach `catalog-api`.
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      `ارتباط با Express (${url}) برقرار نشد: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  const text = await response.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new ApiError(response.status, 'INVALID_JSON', 'پاسخ سرور JSON معتبر نبود')
  }

  if (!response.ok) {
    const body = json as { error?: { code?: string; message?: string; details?: unknown } } | null
    throw new ApiError(
      response.status,
      body?.error?.code ?? `HTTP_${response.status}`,
      body?.error?.message ?? `${response.status} ${response.statusText}`,
      body?.error?.details,
    )
  }

  const parsed = apiResponseSchema(schema).safeParse(json)
  if (!parsed.success) {
    throw new ApiError(
      502,
      'INVALID_RESPONSE_SHAPE',
      `پاسخ Express با قرارداد سازگار نبود: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
      parsed.error.issues,
    )
  }

  return { data: parsed.data.data as T, debug: parsed.data.debug }
}
