import { ResponseCache, type EdgeCache } from './cache'
import { fetchFlights, type UpstreamResult } from './opensky'
import { boundsFor } from './regions'

export const FLIGHTS_PATH = '/v1/flights'

/**
 * Flight positions are cached for 30 s. OpenSky's anonymous API updates state
 * vectors roughly every 10 s and allows a limited number of anonymous requests
 * per day, so 30 s keeps the map reasonably current while collapsing repeat
 * requests for the same region into one upstream call per window.
 */
export const FLIGHTS_TTL_SECONDS = 30

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
    cache: new ResponseCache(FLIGHTS_TTL_SECONDS, now, opts.edge),
    allowedOrigins: opts.allowedOrigins,
  }
}

const UPSTREAM_ERRORS: Record<Exclude<UpstreamResult, { ok: true }>['kind'], [number, string]> = {
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

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const url = new URL(req.url)

  if (url.pathname !== FLIGHTS_PATH) {
    return json(req, deps, 404, { error: 'not_found' })
  }

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

  const params = [...url.searchParams.keys()]
  if (params.length !== 1 || params[0] !== 'region' || url.searchParams.getAll('region').length !== 1) {
    return json(req, deps, 400, { error: 'invalid_parameters', expected: 'region' })
  }
  const regionId = url.searchParams.get('region') ?? ''
  const bbox = boundsFor(regionId)
  if (!bbox) {
    return json(req, deps, 400, { error: 'unknown_region' })
  }

  const key = ResponseCache.key(FLIGHTS_PATH, regionId)
  const cached = await deps.cache.get(key)
  if (cached) {
    return json(req, deps, 200, cached.body, { 'X-Titan-Cache': cached.tier })
  }

  const upstream = await fetchFlights(bbox, deps.fetch)
  if (!upstream.ok) {
    const [status, error] = UPSTREAM_ERRORS[upstream.kind]
    return json(req, deps, status, { error, region: regionId }, { 'X-Titan-Cache': 'MISS' })
  }

  const body = JSON.stringify({
    region: regionId,
    fetchedAt: new Date(deps.now()).toISOString(),
    upstreamTime: upstream.upstreamTime,
    count: upstream.flights.length,
    flights: upstream.flights,
  })
  await deps.cache.put(key, body)
  return json(req, deps, 200, body, { 'X-Titan-Cache': 'MISS' })
}
