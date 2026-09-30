// Shared fetch for fixed upstream URLs: timeout, status mapping, JSON parsing.

export const UPSTREAM_TIMEOUT_MS = 8000
const USER_AGENT = 'titan-ops-monitor (github.com/AlexC3105/titan-ops-monitor)'

export type UpstreamFailure = 'timeout' | 'rate_limited' | 'http' | 'network' | 'invalid'

export type UpstreamJson = { ok: true; body: unknown } | { ok: false; kind: UpstreamFailure; status?: number }

export async function fetchUpstreamJson(url: string, fetchImpl: typeof fetch): Promise<UpstreamJson> {
  let res: Response
  try {
    res = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (err) {
    const name = (err as { name?: string } | null)?.name
    return { ok: false, kind: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network' }
  }
  if (res.status === 429) return { ok: false, kind: 'rate_limited', status: 429 }
  if (!res.ok) return { ok: false, kind: 'http', status: res.status }
  try {
    return { ok: true, body: await res.json() }
  } catch {
    return { ok: false, kind: 'invalid' }
  }
}
