# catalog-admin

Standalone React + Vite admin SPA for the steel catalog. It talks **directly to Express**,
and never to Next.js.

This is a **self-contained project** with its own `package.json`, lockfile, tsconfig, env
files, tests and scripts. It imports nothing from its sibling projects and does not depend
on Next.js in any way.

Runs on **http://localhost:5173**.

```bash
pnpm install
cp .env.example .env
pnpm dev        # port 5173
pnpm build      # tsc --noEmit && vite build
pnpm preview
pnpm test       # vitest + jsdom (19 tests)
pnpm lint
pnpm typecheck
```

> `pnpm-workspace.yaml` here is **not** a workspace definition — no `packages:` key, no
> link to any sibling. pnpm 11 uses that filename for per-project settings.

---

## Routes

| Route | Page |
|---|---|
| `/` | product list, links to each product's variants |
| `/products/:productSlug/variants` | variant table with inline editing |
| `/debug` | Express request counters + webhook delivery history |

---

## Direct communication with Express

```
React Admin  ──PATCH──▶  Express (:4000)  ──webhook──▶  Next.js (:3000)
```

Every request this application makes goes to `VITE_API_BASE_URL`. `src/api/client.ts` has
the only `fetch` call site in the codebase, and it interpolates `API_BASE_URL`.

Mutations are **not** proxied through Next.js. Next.js is a *reader* of this catalog, not a
mutation boundary, and routing writes through it would invert that relationship — the
storefront would become a dependency of the admin, and an outage of the public site would
take down the ability to edit prices.

`VITE_PUBLIC_WEB_URL` exists solely to build "view this on the public site" hyperlinks a
human clicks.

---

## The TanStack Query cache

Query keys are namespaced under `admin` (`src/queries/query-keys.ts`):

```ts
export const adminQueryKeys = {
  productList:  ()                   => ['admin', 'products'] as const,
  product:      (productSlug: string)=> ['admin', 'product', productSlug] as const,
  backendStats: ()                   => ['admin', 'debug', 'backend-stats'] as const,
  webhookEvents:()                   => ['admin', 'debug', 'webhook-events'] as const,
}
```

Even the namespace is a hint: these keys address entries in **one** cache — an in-memory
object inside this browser tab. It is per-user, per-tab, and gone on refresh.

After a successful mutation (`src/queries/use-update-variant.ts`):

```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: adminQueryKeys.product(productSlug) })
  queryClient.invalidateQueries({ queryKey: adminQueryKeys.backendStats() })
  queryClient.invalidateQueries({ queryKey: adminQueryKeys.webhookEvents() })
}
```

`onSuccess` **only**. A rejected mutation invalidates nothing: refetching after a failed
write would replace good local state with identical server state and hide the fact that
nothing happened. There is a test for that.

---

## Why `invalidateQueries` affects only this browser

| | TanStack Query (here) | Next.js server cache (catalog-web) |
|---|---|---|
| Where it lives | memory of this browser tab | the Next.js server process, port 3000 |
| Who sees it | one admin, in one tab | every public visitor |
| Invalidated by | `queryClient.invalidateQueries()` | `revalidateTag()` inside the webhook |
| Survives a page refresh | no | yes |
| Reachable from the other | **no** | **no** |

They share no mechanism, no process and no vocabulary. `['admin','product','zob-ahan-rebar']`
is a TanStack Query key; `product:zob-ahan-rebar` is a Next.js cache tag. Nothing
translates between them.

Two things this application never claims:

- `router.refresh()` does not invalidate the Next.js server cache. It is a client API that
  re-renders. (This is not a Next.js application, so it does not even have it.)
- `invalidateQueries` has no effect on what public visitors see.

**Experiment F proves it.** Set `WEBHOOK_DISABLED=1` in `catalog-api`, edit a price, and
watch this screen show the new value while the public page keeps serving the old one.
Measured:

```
admin read (what invalidateQueries refetches) = 123,456,000   ← fresh
public /steel/rebar/size-12                   = 777,000,000   ← old, still cached
```

The `CacheExplainer` component keeps this on screen permanently, because the confusion it
prevents is one people have *while clicking Save*.

---

## Why the admin never calls the Next.js webhook

It cannot hold the secret, so it must not be trusted with the job.

Vite inlines every `VITE_*` variable into the JavaScript it ships. A secret in `.env` here
would be a secret published to every visitor of the admin origin — and to anyone who opens
devtools. `.env.example` therefore contains no secret and never can.

The correct boundary is Express: a server, where secrets can actually be kept, and which
already had to be trusted because it owns the data. So the admin PATCHes Express, Express
persists, and Express calls Next.js.

`tests/security.test.ts` enforces this as a property of the source tree:

- `.env.example` declares no secret-shaped variable
- no source file reads `import.meta.env.*SECRET`
- exactly two `VITE_` variables are ever read: `VITE_API_BASE_URL`, `VITE_PUBLIC_WEB_URL`
- no source file builds a URL pointing at `/api/revalidate`
- no source file imports from `next` or `next/cache`
- no `fetch` call interpolates `PUBLIC_WEB_URL` or `:3000`

Verified on the built bundle too: `grep -r 'local-development-secret' dist/` → 0 files.

---

## Mutation and retry UI

The edit form sends a **patch**, not the whole entity — only fields the user actually
changed. So editing a price cannot silently rewrite an attribute someone else changed a
second earlier. Attribute controls are generated from the **category definition**, never
free text, so the UI can only offer values the category allows. Express re-validates all of
it; the client checks are an affordance, not a control.

Native constraint validation is switched off (`noValidate`): its bubbles are neither
translatable nor RTL-aware, and silently refusing to submit is a dead end. The same rules
run through Zod and are shown inline in Persian.

After a save, `MutationResultPanel` reports **two independent outcomes**, because they can
and do diverge:

```ts
{
  updatedVariant: Variant,
  webhook: {
    status: 'success' | 'failed' | 'skipped',
    eventId: string,
    httpStatus?: number,
    duplicate?: boolean,
    invalidatedTags?: string[],
    invalidatedPaths?: string[],
    error?: string,
  }
}
```

1. **The write** — always durable once Express answers 200.
2. **The invalidation** — may fail.

A failed webhook does not undo the write. The data is correct in the backend and the public
site is showing a stale copy of it: a different problem, with a different fix. The panel
says so and offers **Retry**, which asks *Express* to re-deliver the event — the admin
cannot deliver it itself.

The retry reuses the original `eventId`, which is what lets Next.js recognise a redelivery
of something that already landed and answer `duplicate: true` without invalidating twice.

`/debug` shows the full outbox with a Retry button on every failed event, plus the live
Express counters (polled every 4s — safe, because Express classifies `/api/debug/*` as
debug traffic that never counts toward `catalogReads`).

---

## UI

Persian RTL throughout, responsive, self-hosted Yekan Bakh FaNum so the chrome's digits
match `Intl.NumberFormat('fa-IR')` output. Explicit loading, error and empty states on
every screen; TanStack Table v8 for the variant rows with sortable columns; accessible
labelled controls, `role="alert"` for errors, `aria-busy` skeletons.

The product page also shows a TanStack Query state panel — query key, status, fetching
flag, last successful fetch, and the backend request numbers — so the admin's own cache is
visible and obviously separate from the Next.js one.

---

## Tests

`pnpm test` — 19 tests. `fetch` is stubbed rather than the api layer, so assertions cover
real request URLs and methods. That matters here more than usual: this project's central
claims are about *which application receives which request*.

Covered: admin product query going to Express and never to `:3000` · loading and error
states · inline price edit sending exactly one PATCH containing only the changed field ·
save disabled until something changes · cancel sending nothing · attribute options limited
to category-defined values · successful mutation showing write and webhook as separate
outcomes with the tags Next.js reported · `invalidateQueries` called for product, stats and
webhook keys after success · **no invalidation after a failed mutation** · API validation
errors rendered next to the fields · client-side negative-price rejection before any
request · webhook failure status displayed alongside a successful write · retry going to
Express's retry endpoint · and the security scans above.

---

## Environment

```ini
VITE_API_BASE_URL=http://localhost:4000
VITE_PUBLIC_WEB_URL=http://localhost:3000
```

There is no revalidation secret here, and there never can be. See above.
