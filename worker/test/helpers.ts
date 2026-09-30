import { vi } from 'vitest'
import { createDeps } from '../src/handler'
import type { EdgeCache } from '../src/cache'
import states from '../../test/fixtures/opensky-states.json'

export const ORIGIN = 'http://localhost:5173'
export const fixture = states

export function upstreamJson(body: unknown = states, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Deps with a fake clock and a stubbed upstream fetch. */
export function setup(route: (url: string) => Response | Promise<Response> = () => upstreamJson(), edge?: EdgeCache) {
  let t = Date.parse('2026-09-30T12:00:00Z')
  const fetch = vi.fn(async (input: RequestInfo | URL) => route(String(input)))
  const deps = createDeps({
    allowedOrigins: [ORIGIN],
    fetch: fetch as unknown as typeof globalThis.fetch,
    now: () => t,
    edge,
  })
  return { deps, fetch, advance: (ms: number) => (t += ms) }
}

export function get(path: string, init: RequestInit & { origin?: string } = {}): Request {
  const headers = new Headers(init.headers)
  if (init.origin) headers.set('Origin', init.origin)
  return new Request(`https://titan-api.example.workers.dev${path}`, { ...init, headers })
}

/** Minimal in-memory stand-in for caches.default. */
export function fakeEdge(): EdgeCache & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    async match(key) {
      const body = store.get(key.url)
      return body === undefined ? undefined : new Response(body)
    },
    async put(key, value) {
      store.set(key.url, await value.text())
    },
  }
}

export async function body(res: Response): Promise<any> {
  return res.json()
}
