import { ResponseCache, type EdgeCache } from './cache'
import { fetchFlights } from './opensky'
import { fetchStorms } from './nhc'
import { boundsFor } from './regions'
import type { UpstreamFailure } from './upstream'

export const FLIGHTS_PATH = '/v1/flights'
export const STORMS_PATH = '/v1/storms'

/**
 * Flight positions are cached for 30 s. OpenSky's anonymous API updates state
 * vectors roughly every 10 s and allows a limited number of anonymous requests
 * per day, so 30 s keeps the map reasonably current while collapsing repeat
 * requests for the same region into one upstream call per window.
 */
export const FLIGHTS_TTL_SECONDS = 30

/**
 * The NHC active-storm list changes when advisories are issued (typically every
 * 3–6 hours per system), so a 5-minute cache keeps new advisories visible within
 * minutes while making at most one upstream request per window.
 */
export const STORMS_TTL_SECONDS = 300

export interface Deps {
  fetch: typeof fetch
  now: () => number
  cache: ResponseCache
  allowedOrigins: readonly string[]
}

export function createDeps(opts: {
  allowedOrigins: readonly string[]
  fetch?: typeof fetch
  now?: () => number
  edge?: EdgeCache
}): Deps {
  const now = opts.now ?? Date.now
  return {
    fetch: opts.fetch ?? fetch,
    now,
    cache: new ResponseCache(now, opts.edge),
    allowedOrigins: opts.allowedOrigins,
  }
}

const UPSTREAM_ERRORS: Record<UpstreamFailure, [number, string]> = {
  timeout: [504, 'upstream_timeout'],
  rate_limited: [503, 'upstream_rate_limited'],
  http: [502, 'upstream_error'],
  network: [502, 'upstream_unreachable'],
  invalid: [502, 'upstream_invalid_response'],
}

function corsHeaders(req: Request, allowed: readonly string[]): Record<string, string> {
  const origin = req.headers.get('Origin')
  const headers: Record<string, string> = { Vary: 'Origin' }
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(
  req: Request,
  deps: Deps,
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(req, deps.allowedOrigins),
      ...extra,
    },
  })
}

type Built = { ok: true; body: Record<string, unknown> } | { ok: false; kind: UpstreamFailure; context?: Record<string, string> }

/** Serve from cache, or build from upstream and cache on success only. */
async function cached(
  req: Request,
  deps: Deps,
  key: string,
  ttlSeconds: number,
  build: () => Promise<Built>,
): Promise<Response> {
  const hit = await deps.cache.get(key)
  if (hit) return json(req, deps, 200, hit.body, { 'X-Titan-Cache': hit.tier })

  const result = await build()
  if (!result.ok) {
    const [status, error] = UPSTREAM_ERRORS[result.kind]
    return json(req, deps, status, { error, ...result.context }, { 'X-Titan-Cache': 'MISS' })
  }
  const body = JSON.stringify({ fetchedAt: new Date(deps.now()).toISOString(), ...result.body })
  await deps.cache.put(key, body, ttlSeconds)
  return json(req, deps, 200, body, { 'X-Titan-Cache': 'MISS' })
}

function badParams(req: Request, deps: Deps, expected: string): Response {
  return json(req, deps, 400, { error: 'invalid_parameters', expected })
}

async function flights(req: Request, url: URL, deps: Deps): Promise<Response> {
  const params = [...url.searchParams.keys()]
  if (params.length !== 1 || params[0] !== 'region' || url.searchParams.getAll('region').length !== 1) {
    return badParams(req, deps, 'region')
  }
  const regionId = url.searchParams.get('region') ?? ''
  const bbox = boundsFor(regionId)
  if (!bbox) return json(req, deps, 400, { error: 'unknown_region' })

  return cached(req, deps, ResponseCache.key(FLIGHTS_PATH, ['region', regionId]), FLIGHTS_TTL_SECONDS, async () => {
    const r = await fetchFlights(bbox, deps.fetch)
    if (!r.ok) return { ok: false, kind: r.kind, context: { region: regionId } }
    return { ok: true, body: { region: regionId, upstreamTime: r.upstreamTime, count: r.flights.length, flights: r.flights } }
  })
}

async function storms(req: Request, url: URL, deps: Deps): Promise<Response> {
  if ([...url.searchParams.keys()].length !== 0) return badParams(req, deps, 'none')

  return cached(req, deps, ResponseCache.key(STORMS_PATH), STORMS_TTL_SECONDS, async () => {
    const r = await fetchStorms(deps.fetch)
    if (!r.ok) return r
    return { ok: true, body: { count: r.storms.length, storms: r.storms } }
  })
}

const ROUTES: Record<string, (req: Request, url: URL, deps: Deps) => Promise<Response>> = {
  [FLIGHTS_PATH]: flights,
  [STORMS_PATH]: storms,
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const url = new URL(req.url)
  const route = Object.prototype.hasOwnProperty.call(ROUTES, url.pathname) ? ROUTES[url.pathname] : undefined
  if (!route) return json(req, deps, 404, { error: 'not_found' })

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(req, deps.allowedOrigins),
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    })
  }
  if (req.method !== 'GET') {
    return json(req, deps, 405, { error: 'method_not_allowed' }, { Allow: 'GET, OPTIONS' })
  }
  return route(req, url, deps)
}
