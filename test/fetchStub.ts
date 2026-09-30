import { vi } from 'vitest'

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Replace global fetch with a stub; returns the mock so tests can inspect calls. */
export function stubFetch(route: Route) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => route(String(input), init))
  vi.stubGlobal('fetch', mock)
  return mock
}

/** A fetch that never resolves on its own and rejects only when its signal aborts. */
export function stubHangingFetch() {
  return stubFetch(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError')),
        )
      }),
  )
}
