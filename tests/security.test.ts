import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guardrails that no amount of careful review can enforce as reliably as a test.
 *
 * The rule being protected: the browser must never hold the revalidation secret, and must
 * never address the Next.js revalidation endpoint. Vite inlines every VITE_* variable into
 * the bundle it ships, so "there is no secret in this project" is a property of the source
 * tree, and can be checked as one.
 */

// `process.cwd()` rather than `import.meta.url`: these tests run in the jsdom
// environment, where `import.meta.url` is an http:// URL and cannot be resolved to a path.
const projectRoot = process.cwd()

function readAllSourceFiles(directory: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = []

  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) {
      results.push(...readAllSourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx|css|html)$/.test(entry)) continue
    results.push({ path: full.replace(projectRoot, ''), content: readFileSync(full, 'utf8') })
  }

  return results
}

const sourceFiles = readAllSourceFiles(join(projectRoot, 'src'))

describe('the browser bundle can never carry the revalidation secret', () => {
  it('declares no secret in .env.example', () => {
    const env = readFileSync(join(projectRoot, '.env.example'), 'utf8')

    expect(env).toContain('VITE_API_BASE_URL')
    expect(env).toContain('VITE_PUBLIC_WEB_URL')
    expect(env).not.toMatch(/VITE_[A-Z_]*SECRET/)
    expect(env).not.toContain('REVALIDATION_SECRET=')
    expect(env).not.toContain('local-development-secret')
  })

  it('never reads a secret-shaped env variable in source', () => {
    for (const file of sourceFiles) {
      expect(file.content, file.path).not.toMatch(/import\.meta\.env\.[A-Z_]*SECRET/)
      expect(file.content, file.path).not.toContain('REVALIDATION_SECRET')
      expect(file.content, file.path).not.toContain('local-development-secret')
    }
  })

  it('only ever reads the two public VITE_ variables', () => {
    const used = new Set<string>()
    for (const file of sourceFiles) {
      for (const match of file.content.matchAll(/import\.meta\.env\.(\w+)/g)) {
        used.add(match[1]!)
      }
    }
    expect([...used].sort()).toEqual(['VITE_API_BASE_URL', 'VITE_PUBLIC_WEB_URL'])
  })
})

describe('the admin never calls the Next.js revalidation endpoint', () => {
  /** Comments in this project discuss the webhook at length; only real code is scanned. */
  function stripComments(content: string): string {
    return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  }

  it('never builds a URL pointing at the revalidation endpoint', () => {
    // The UI *explains* the webhook (inside <code> elements) and the comments discuss it,
    // which is why this looks for the endpoint inside a string literal — the only form
    // that could actually become a request.
    for (const file of sourceFiles) {
      const code = stripComments(file.content)
      // Matches `'/api/revalidate'` and `` `${BASE}/api/revalidate` `` — a literal that
      // begins a URL — but not the endpoint's name appearing as JSX text.
      expect(code, file.path).not.toMatch(/["'`](\$\{[^}]*\})?\/api\/revalidate/)
    }
  })

  it('imports nothing from next/cache — this is not a Next.js application', () => {
    for (const file of sourceFiles) {
      const code = stripComments(file.content)
      expect(code, file.path).not.toMatch(/from\s+["']next\/cache["']/)
      expect(code, file.path).not.toMatch(/from\s+["']next["']/)
    }
  })

  it('builds every request URL from API_BASE_URL, never from PUBLIC_WEB_URL', () => {
    const client = readFileSync(join(projectRoot, 'src/api/client.ts'), 'utf8')

    // There is exactly one fetch call site in the application, and its URL is resolved
    // from API_BASE_URL — the Express base — and nothing else.
    expect(client).toContain('const url = resolveApiUrl(API_BASE_URL, path)')
    expect(client).toContain('await fetch(url, {')

    for (const file of sourceFiles) {
      for (const line of stripComments(file.content).split('\n')) {
        if (!line.includes('fetch(')) continue
        expect(line.includes('PUBLIC_WEB_URL'), `${file.path}: ${line.trim()}`).toBe(false)
        expect(line.includes(':3000'), `${file.path}: ${line.trim()}`).toBe(false)
      }
    }
  })

  it('uses PUBLIC_WEB_URL only to build links a human clicks', () => {
    const usages = sourceFiles.filter((file) => stripComments(file.content).includes('PUBLIC_WEB_URL'))
    expect(usages.length).toBeGreaterThan(0)

    for (const file of usages) {
      if (file.path.endsWith('src/api/client.ts')) continue // where it is declared

      for (const line of stripComments(file.content).split('\n')) {
        if (!line.includes('PUBLIC_WEB_URL')) continue
        if (line.trimStart().startsWith('import ')) continue

        // Every remaining appearance is an href, or plain text showing the URL to a reader.
        const isDisplayOnly =
          line.includes('href') || line.includes('{PUBLIC_WEB_URL}') || line.includes('`{')
        expect(isDisplayOnly, `${file.path}: ${line.trim()}`).toBe(true)
      }
    }
  })
})
