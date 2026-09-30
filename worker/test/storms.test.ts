import { describe, expect, it } from 'vitest'
import { handle, STORMS_TTL_SECONDS } from '../src/handler'
import { NHC_CURRENT_STORMS_URL, normalizeStorms } from '../src/nhc'
import { body as readBody, fakeEdge, get, setup, upstreamJson } from './helpers'
import nhc from '../../test/fixtures/nhc-current-storms.json'

const nhcRoute = () => upstreamJson(nhc)

describe('GET /v1/storms', () => {
  it('serves normalised active storms from the fixed NHC upstream', async () => {
    const { deps, fetch } = setup(nhcRoute)
    const res = await handle(get('/v1/storms'), deps)

    expect(res.status).toBe(200)
    const body = await readBody(res)
    const first = nhc.activeStorms[0]
    expect(body.count).toBe(nhc.activeStorms.length)
    expect(body.storms[0]).toEqual({
      id: first.id,
      name: first.name,
      classification: first.classification,
      lat: first.latitudeNumeric,
      lon: first.longitudeNumeric,
      intensity: Number(first.intensity),
      pressure: Number(first.pressure),
      movementDir: first.movementDir,
      movementSpeed: first.movementSpeed,
      lastUpdate: first.lastUpdate,
      advisoryNumber: first.publicAdvisory.advNum,
    })
    expect(fetch.mock.calls[0][0]).toBe(NHC_CURRENT_STORMS_URL)
  })

  it('treats an empty active-storm list as a valid response', async () => {
    const { deps } = setup(() => upstreamJson({ activeStorms: [] }))
    const res = await handle(get('/v1/storms'), deps)

    expect(res.status).toBe(200)
    expect(await readBody(res)).toMatchObject({ count: 0, storms: [] })
  })

  it.each(['/v1/storms?basin=al', '/v1/storms?url=https://evil.example'])('rejects any parameters: %s', async (path) => {
    const { deps, fetch } = setup(nhcRoute)
    const res = await handle(get(path), deps)

    expect(res.status).toBe(400)
    expect(await readBody(res)).toEqual({ error: 'invalid_parameters', expected: 'none' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps a response without activeStorms to 502', async () => {
    const { deps } = setup(() => upstreamJson({ unexpected: true }))
    const res = await handle(get('/v1/storms'), deps)

    expect(res.status).toBe(502)
    expect((await readBody(res)).error).toBe('upstream_invalid_response')
  })

  it('maps an upstream timeout to 504 and does not cache it', async () => {
    let fail = true
    const { deps, fetch } = setup(() => {
      if (fail) throw new DOMException('The operation timed out.', 'TimeoutError')
      return nhcRoute()
    })
    expect((await handle(get('/v1/storms'), deps)).status).toBe(504)

    fail = false
    const retry = await handle(get('/v1/storms'), deps)
    expect(retry.status).toBe(200)
    expect(retry.headers.get('X-Titan-Cache')).toBe('MISS')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it(`caches successes for ${STORMS_TTL_SECONDS}s`, async () => {
    const { deps, fetch, advance } = setup(nhcRoute)
    expect((await handle(get('/v1/storms'), deps)).headers.get('X-Titan-Cache')).toBe('MISS')

    advance(STORMS_TTL_SECONDS * 1000 - 1)
    expect((await handle(get('/v1/storms'), deps)).headers.get('X-Titan-Cache')).toBe('HIT-MEMORY')
    advance(1)
    expect((await handle(get('/v1/storms'), deps)).headers.get('X-Titan-Cache')).toBe('MISS')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps storms and flights in separate cache entries', async () => {
    const edge = fakeEdge()
    const { deps } = setup((url) => (url === NHC_CURRENT_STORMS_URL ? nhcRoute() : upstreamJson()), edge)
    await handle(get('/v1/storms'), deps)
    await handle(get('/v1/flights?region=tampa-bay'), deps)

    expect([...edge.store.keys()].sort()).toEqual([
      'https://titan-cache.internal/v1/flights?region=tampa-bay',
      'https://titan-cache.internal/v1/storms',
    ])
  })
})

describe('normalizeStorms', () => {
  it('skips entries without an id or numeric position and tolerates missing fields', () => {
    const storms = normalizeStorms([
      null,
      { name: 'No id', latitudeNumeric: 1, longitudeNumeric: 2 },
      { id: 'x1', latitudeNumeric: 'n/a', longitudeNumeric: 2 },
      { id: 'x2', latitudeNumeric: 10, longitudeNumeric: -50, intensity: 'n/a' },
    ])
    expect(storms).toEqual([
      {
        id: 'x2', name: 'x2', classification: '', lat: 10, lon: -50,
        intensity: null, pressure: null, movementDir: null, movementSpeed: null,
        lastUpdate: null, advisoryNumber: null,
      },
    ])
  })
})
