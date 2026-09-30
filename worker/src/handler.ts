import { ResponseCache, type EdgeCache } from './cache'
import { fetchFlights } from './opensky'
import { fetchStorms, type StormProduct } from './nhc'
import { MAX_ARCHIVE_BYTES, isAllowedProductUrl, parseForecastArchive } from './nhcGis'
import { fetchUpstreamBytes } from './upstream'
import { boundsFor } from './regions'
import type { UpstreamFailure } from './upstream'

export const FLIGHTS_PATH = '/v1/flights'
export const STORMS_PATH = '/v1/storms'
const STORM_GEOMETRY_PATH = /^\/v1\/storms\/([^/]+)\/geometry$/
const STORM_ID = /^[a-z]{2}\d{6}$/
const STORM_PRODUCTS_KEY = ResponseCache.key('/v1/storms/_products')

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

/**
 * Forecast geometry is keyed by storm id + advisory number, so a new advisory is
 * always a new cache entry. The TTL only bounds how long an entry lingers.
 */
export const GEOMETRY_TTL_SECONDS = 6 * 60 * 60

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
  too_large: [502, 'upstream_response_too_large'],
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

type StormIndex =
  | { ok: true; publicBody: string; products: Record<string, StormProduct>; tier: 'MISS' | 'HIT-MEMORY' | 'HIT-EDGE' }
  | { ok: false; kind: UpstreamFailure }

/**
 * One NHC fetch fills two cache entries with the same TTL: the public storm list
 * and a server-only index of each storm's forecast archive URL.
 */
async function loadStorms(deps: Deps): Promise<StormIndex> {
  const listKey = ResponseCache.key(STORMS_PATH)
  const [list, products] = await Promise.all([deps.cache.get(listKey), deps.cache.get(STORM_PRODUCTS_KEY)])
  if (list && products) return { ok: true, publicBody: list.body, products: JSON.parse(products.body), tier: list.tier }

  const r = await fetchStorms(deps.fetch)
  if (!r.ok) return r
  const publicBody = JSON.stringify({ fetchedAt: new Date(deps.now()).toISOString(), count: r.storms.length, storms: r.storms })
  await deps.cache.put(listKey, publicBody, STORMS_TTL_SECONDS)
  await deps.cache.put(STORM_PRODUCTS_KEY, JSON.stringify(r.products), STORMS_TTL_SECONDS)
  return { ok: true, publicBody, products: r.products, tier: 'MISS' }
}

function upstreamError(req: Request, deps: Deps, kind: UpstreamFailure, context: Record<string, string> = {}): Response {
  const [status, error] = UPSTREAM_ERRORS[kind]
  return json(req, deps, status, { error, ...context }, { 'X-Titan-Cache': 'MISS' })
}

async function storms(req: Request, url: URL, deps: Deps): Promise<Response> {
  if ([...url.searchParams.keys()].length !== 0) return badParams(req, deps, 'none')
  const index = await loadStorms(deps)
  if (!index.ok) return upstreamError(req, deps, index.kind)
  return json(req, deps, 200, index.publicBody, { 'X-Titan-Cache': index.tier })
}

async function stormGeometry(req: Request, url: URL, deps: Deps, stormId: string): Promise<Response> {
  if ([...url.searchParams.keys()].length !== 0) return badParams(req, deps, 'none')
  if (!STORM_ID.test(stormId)) return json(req, deps, 400, { error: 'invalid_storm_id' })

  const index = await loadStorms(deps)
  if (!index.ok) return upstreamError(req, deps, index.kind)
  const product = Object.prototype.hasOwnProperty.call(index.products, stormId) ? index.products[stormId] : undefined
  if (!product) return json(req, deps, 404, { error: 'unknown_storm' })

  const archiveUrl = product.archiveUrl
  if (!archiveUrl || !isAllowedProductUrl(archiveUrl)) {
    return json(req, deps, 200, {
      stormId,
      advisoryNumber: product.advisoryNumber,
      issuance: null,
      track: null,
      cone: null,
      reason: 'product_unavailable',
    })
  }

  const key = ResponseCache.key(`/v1/storms/${stormId}/geometry`, ['advisory', product.advisoryNumber ?? 'none'])
  return cached(req, deps, key, GEOMETRY_TTL_SECONDS, async () => {
    const archive = await fetchUpstreamBytes(archiveUrl, deps.fetch, MAX_ARCHIVE_BYTES)
    if (!archive.ok) return { ok: false, kind: archive.kind, context: { stormId } }
    try {
      const geometry = await parseForecastArchive(archive.bytes)
      return {
        ok: true,
        body: { stormId, advisoryNumber: product.advisoryNumber, source: 'NOAA / National Hurricane Center', ...geometry },
      }
    } catch {
      return { ok: false, kind: 'invalid', context: { stormId } }
    }
  })
}

const ROUTES: Record<string, (req: Request, url: URL, deps: Deps) => Promise<Response>> = {
  [FLIGHTS_PATH]: flights,
  [STORMS_PATH]: storms,
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const url = new URL(req.url)
  const geometry = STORM_GEOMETRY_PATH.exec(url.pathname)
  const route = Object.prototype.hasOwnProperty.call(ROUTES, url.pathname)
    ? ROUTES[url.pathname]
    : geometry
      ? (r: Request, u: URL, d: Deps) => stormGeometry(r, u, d, geometry[1])
      : undefined
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
