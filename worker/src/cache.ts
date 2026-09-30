// Two-tier cache for successful upstream responses only.
//
// 1. In-memory (per Worker isolate). Works everywhere, including *.workers.dev,
//    but is not shared between isolates or locations.
// 2. Cloudflare edge cache (caches.default). Shared per data centre, but it only
//    takes effect on zones with a custom domain; on *.workers.dev it is a no-op.
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
    private readonly ttlSeconds: number,
    private readonly now: () => number,
    private readonly edge?: EdgeCache,
  ) {}

  static key(path: string, regionId: string): string {
    return `https://titan-cache.internal${path}?region=${encodeURIComponent(regionId)}`
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

  async put(key: string, body: string): Promise<void> {
    this.memory.set(key, { body, expiresAt: this.now() + this.ttlSeconds * 1000 })
    if (this.edge) {
      await this.edge.put(
        new Request(key),
        new Response(body, {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${this.ttlSeconds}` },
        }),
      )
    }
  }
}
