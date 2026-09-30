/** Small fetch helper with timeout + JSON parsing, shared by live adapters. */
export async function fetchJson(
  url: string,
  opts: { timeoutMs?: number; accept?: string } = {},
): Promise<any> {
  const { timeoutMs = 7000, accept } = opts
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: accept ? { Accept: accept } : undefined,
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}
