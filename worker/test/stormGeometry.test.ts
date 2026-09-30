import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { unzipSync, zipSync } from 'fflate'
import { GEOMETRY_TTL_SECONDS, handle } from '../src/handler'
import { MAX_ARCHIVE_BYTES, isAllowedProductUrl, parseForecastArchive } from '../src/nhcGis'
import { NHC_CURRENT_STORMS_URL } from '../src/nhc'
import { body as readBody, get, setup, upstreamJson } from './helpers'
import nhc from '../../test/fixtures/nhc-current-storms.json'

// Recorded official archive for AL082026 (Hanna), advisory 008.
const ARCHIVE = new Uint8Array(readFileSync(new URL('../../test/fixtures/nhc-al082026-5day-008.zip', import.meta.url)))
const HANNA = nhc.activeStorms[0]
const ARCHIVE_URL = HANNA.trackCone!.zipFile
const PATH = `/v1/storms/${HANNA.id}/geometry`

function zipResponse(bytes: Uint8Array = ARCHIVE, headers: Record<string, string> = {}) {
  return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/zip', ...headers } })
}

/** Rebuild the recorded archive with only some members (or extra ones). */
function archiveWith(keep: (name: string) => boolean, extra: Record<string, Uint8Array> = {}) {
  const members = unzipSync(ARCHIVE)
  return zipSync({ ...Object.fromEntries(Object.entries(members).filter(([n]) => keep(n))), ...extra })
}

function nhcRoutes(storms: unknown = nhc, archive: () => Response = () => zipResponse()) {
  return (url: string) => (url === NHC_CURRENT_STORMS_URL ? upstreamJson(storms) : url === ARCHIVE_URL ? archive() : upstreamJson({}, 404))
}

function withProduct(update: (s: typeof HANNA) => unknown) {
  return { activeStorms: [update(structuredClone(HANNA)), ...nhc.activeStorms.slice(1)] }
}

describe('GET /v1/storms/:id/geometry', () => {
  it('fetches the archive URL published by NHC and returns normalised track and cone', async () => {
    const { deps, fetch } = setup(nhcRoutes())
    const res = await handle(get(PATH), deps)

    expect(res.status).toBe(200)
    const body = await readBody(res)
    expect(body).toMatchObject({
      stormId: HANNA.id,
      advisoryNumber: HANNA.trackCone!.advNum,
      source: 'NOAA / National Hurricane Center',
      issuance: '900 AM GMT Wed Sep 30 2026',
    })
    const kinds = body.track.features.map((f: any) => `${f.geometry.type}:${f.properties.kind}`)
    expect(kinds[0]).toBe('LineString:forecast-track')
    expect(kinds.filter((k: string) => k === 'Point:forecast-point')).toHaveLength(7)
    expect(body.cone.features).toHaveLength(1)
    expect(body.cone.features[0].geometry.type).toBe('Polygon')
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([NHC_CURRENT_STORMS_URL, ARCHIVE_URL])
  })

  it.each(['AL082026', 'al08202', 'al0820261', 'al082026%2F..', '%61l082026'])('rejects malformed storm id %j', async (id) => {
    const { deps, fetch } = setup(nhcRoutes())
    const res = await handle(get(`/v1/storms/${id}/geometry`), deps)

    expect(res.status).toBe(400)
    expect(await readBody(res)).toEqual({ error: 'invalid_storm_id' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['..', '%2e%2e'])('normalises path traversal %j away from every route', async (seg) => {
    const { deps, fetch } = setup(nhcRoutes())
    const res = await handle(get(`/v1/storms/${seg}/geometry`), deps)

    expect(res.status).toBe(404)
    expect(await readBody(res)).toEqual({ error: 'not_found' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects storms that are not currently active', async () => {
    const { deps, fetch } = setup(nhcRoutes())
    const res = await handle(get('/v1/storms/al992026/geometry'), deps)

    expect(res.status).toBe(404)
    expect(await readBody(res)).toEqual({ error: 'unknown_storm' })
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([NHC_CURRENT_STORMS_URL])
  })

  it.each([`${PATH}?url=https://evil.example/x.zip`, `${PATH}?advisory=007`])('accepts no query parameters: %s', async (path) => {
    const { deps, fetch } = setup(nhcRoutes())
    const res = await handle(get(path), deps)

    expect(res.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports product_unavailable when NHC lists no forecast archive', async () => {
    const { deps, fetch } = setup(nhcRoutes(withProduct((s) => ({ ...s, trackCone: null, forecastTrack: null }))))
    const res = await handle(get(PATH), deps)

    expect(res.status).toBe(200)
    expect(await readBody(res)).toMatchObject({ stormId: HANNA.id, track: null, cone: null, reason: 'product_unavailable' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('never fetches an archive URL outside the NHC GIS archive path', async () => {
    const evil = withProduct((s) => ({ ...s, trackCone: { ...s.trackCone, zipFile: 'https://evil.example/gis/forecast/archive/x.zip' } }))
    const { deps, fetch } = setup(nhcRoutes(evil))
    const res = await handle(get(PATH), deps)

    expect(await readBody(res)).toMatchObject({ reason: 'product_unavailable' })
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([NHC_CURRENT_STORMS_URL])
  })

  it('caches geometry per advisory and refetches when the advisory changes', async () => {
    let storms: unknown = nhc
    const { deps, fetch, advance } = setup((url) => nhcRoutes(storms)(url))
    expect((await handle(get(PATH), deps)).headers.get('X-Titan-Cache')).toBe('MISS')
    expect((await handle(get(PATH), deps)).headers.get('X-Titan-Cache')).toBe('HIT-MEMORY')
    expect(fetch.mock.calls.filter((c) => c[0] === ARCHIVE_URL)).toHaveLength(1)

    // Storm list expires and NHC now reports advisory 009 (same archive bytes here).
    storms = withProduct((s) => ({ ...s, trackCone: { ...s.trackCone, advNum: '009' } }))
    advance(301_000)
    const next = await handle(get(PATH), deps)
    expect(next.headers.get('X-Titan-Cache')).toBe('MISS')
    expect((await readBody(next)).advisoryNumber).toBe('009')
    expect(fetch.mock.calls.filter((c) => c[0] === ARCHIVE_URL)).toHaveLength(2)
  })

  it(`keeps geometry for up to ${GEOMETRY_TTL_SECONDS / 3600} h while the advisory is unchanged`, async () => {
    const { deps, advance } = setup(nhcRoutes())
    await handle(get(PATH), deps)
    advance(GEOMETRY_TTL_SECONDS * 1000 - 1)
    // The storm list itself has expired and is refetched; geometry is still cached.
    expect((await handle(get(PATH), deps)).headers.get('X-Titan-Cache')).toBe('HIT-MEMORY')
  })

  it.each([
    ['a corrupt archive', () => zipResponse(new TextEncoder().encode('not a zip file'))],
    ['an archive without forecast layers', () => zipResponse(archiveWith(() => false, { 'readme.txt': new Uint8Array([1]) }))],
    ['an upstream 404', () => upstreamJson({}, 404)],
  ])('returns 502 for %s and does not cache it', async (_name, archive) => {
    let broken = true
    const { deps, fetch } = setup((url) => nhcRoutes(nhc, broken ? archive : () => zipResponse())(url))
    const res = await handle(get(PATH), deps)
    expect(res.status).toBe(502)
    expect(await readBody(res)).toMatchObject({ stormId: HANNA.id })

    broken = false
    const retry = await handle(get(PATH), deps)
    expect(retry.status).toBe(200)
    expect(fetch.mock.calls.filter((c) => c[0] === ARCHIVE_URL)).toHaveLength(2)
  })

  it('refuses archives larger than the download limit', async () => {
    const { deps } = setup(nhcRoutes(nhc, () => zipResponse(ARCHIVE, { 'Content-Length': String(MAX_ARCHIVE_BYTES + 1) })))
    const res = await handle(get(PATH), deps)

    expect(res.status).toBe(502)
    expect((await readBody(res)).error).toBe('upstream_response_too_large')
  })
})

describe('parseForecastArchive', () => {
  it('returns a null cone when the polygon layer is missing', async () => {
    const g = await parseForecastArchive(archiveWith((n) => !n.includes('_pgn.')))
    expect(g.cone).toBeNull()
    expect(g.track?.features.length).toBeGreaterThan(0)
  })

  it('returns a null track when line and point layers are missing', async () => {
    const g = await parseForecastArchive(archiveWith((n) => n.includes('_pgn.')))
    expect(g.track).toBeNull()
    expect(g.cone?.features).toHaveLength(1)
  })

  it('preserves forecast-point attributes and maps NHC pressure placeholder 9999 to null', async () => {
    const g = await parseForecastArchive(ARCHIVE)
    const first = g.track!.features.find((f) => f.properties?.kind === 'forecast-point')!
    expect(first.properties).toMatchObject({ tau: 0, maxWindKt: 35, gustKt: 45, pressureMb: 1006, stormType: 'TS' })
    expect(g.track!.features.every((f) => f.properties?.pressureMb !== 9999)).toBe(true)
  })

  it('ignores unexpected archive members', async () => {
    const g = await parseForecastArchive(archiveWith(() => true, { '../../evil.shp': new Uint8Array(10), 'x_5day_lin.exe': new Uint8Array(10) }))
    expect(g.track).not.toBeNull()
  })

  it('rejects entries whose uncompressed size exceeds the limit (zip bomb)', async () => {
    const bomb = zipSync({ 'bomb_5day_pgn.shp': new Uint8Array(6_000_000) }, { level: 9 })
    expect(bomb.byteLength).toBeLessThan(MAX_ARCHIVE_BYTES)
    await expect(parseForecastArchive(bomb)).rejects.toThrow(/too large/)
  })
})

describe('isAllowedProductUrl', () => {
  it.each([
    [ARCHIVE_URL, true],
    ['http://www.nhc.noaa.gov/gis/forecast/archive/al082026_5day_008.zip', false],
    ['https://nhc.noaa.gov.evil.example/gis/forecast/archive/a.zip', false],
    ['https://www.nhc.noaa.gov:8443/gis/forecast/archive/a.zip', false],
    ['https://user@www.nhc.noaa.gov/gis/forecast/archive/a.zip', false],
    ['https://www.nhc.noaa.gov/gis/forecast/archive/../../secret.zip', false],
    ['https://www.nhc.noaa.gov/gis/forecast/archive/a.zip?x=1', false],
    ['https://www.nhc.noaa.gov/storm_graphics/api/AL082026_008adv_CONE.kmz', false],
    ['not a url', false],
  ])('%s → %s', (url, ok) => {
    expect(isAllowedProductUrl(url)).toBe(ok)
  })
})
