// Two-tier cache for successful upstream responses only.
//
// 1. In-memory (per Worker isolate). Cheapest, but not shared between isolates,
//    and consecutive requests often land on different isolates.
// 2. Cloudflare edge cache (caches.default). Shared by isolates in the same
//    data centre (observed working on *.workers.dev), not replicated globally.
//
// Entries are keyed by a synthetic URL built from the validated region id, so
// equivalent requests always map to the same key.

export type CacheTier = 'HIT-MEMORY' | 'HIT-EDGE' | 'MISS'

export interface EdgeCache {
  match(key: Request): Promise<Response | undefined>
  put(key: Request, value: Response): Promise<void>
}

interface Entry {
  body: string
  expiresAt: number
}

export class ResponseCache {
  private readonly memory = new Map<string, Entry>()

  constructor(
    private readonly now: () => number,
    private readonly edge?: EdgeCache,
  ) {}

  /** Deterministic key from the route and its (already validated) parameter, if any. */
  static key(path: string, param?: [name: string, value: string]): string {
    const query = param ? `?${param[0]}=${encodeURIComponent(param[1])}` : ''
    return `https://titan-cache.internal${path}${query}`
  }

  async get(key: string): Promise<{ body: string; tier: Exclude<CacheTier, 'MISS'> } | null> {
    const hit = this.memory.get(key)
    if (hit) {
      if (hit.expiresAt > this.now()) return { body: hit.body, tier: 'HIT-MEMORY' }
      this.memory.delete(key)
    }
    if (this.edge) {
      const res = await this.edge.match(new Request(key))
      if (res) {
        // Not copied into memory: the edge entry may already be part-way through
        // its TTL, and re-arming a full TTL here would serve staler data.
        return { body: await res.text(), tier: 'HIT-EDGE' }
      }
    }
    return null
  }

  async put(key: string, body: string, ttlSeconds: number): Promise<void> {
    this.memory.set(key, { body, expiresAt: this.now() + ttlSeconds * 1000 })
    if (this.edge) {
      await this.edge.put(
        new Request(key),
        new Response(body, {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttlSeconds}` },
        }),
      )
    }
  }
}
