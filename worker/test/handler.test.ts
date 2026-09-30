import { describe, expect, it } from 'vitest'
import { handle, FLIGHTS_TTL_SECONDS } from '../src/handler'
import { OPENSKY_STATES_URL } from '../src/opensky'
import { ORIGIN, body as readBody, fakeEdge, fixture, get, setup, upstreamJson } from './helpers'

describe('routing and validation', () => {
  it('serves normalised flights for an allowlisted region', async () => {
    const { deps, fetch } = setup()
    const res = await handle(get('/v1/flights?region=tampa-bay'), deps)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/^application\/json/)
    const body = await readBody(res)
    expect(body).toMatchObject({ region: 'tampa-bay', upstreamTime: fixture.time, count: 2 })
    expect(body.flights[0]).toEqual({
      id: 'abc001',
      callsign: 'TEST101',
      lon: fixture.states[0][5],
      lat: fixture.states[0][6],
      altitude: fixture.states[0][7],
      velocity: fixture.states[0][9],
      track: fixture.states[0][10],
      onGround: false,
    })
    // Blank callsign falls back to ICAO24; the row without a position is dropped.
    expect(body.flights[1].callsign).toBe('abc002')
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toBe(`${OPENSKY_STATES_URL}?lamin=27.6&lomin=-82.85&lamax=28.25&lomax=-82.2`)
  })

  it.each([
    ['missing region', '/v1/flights'],
    ['duplicate region', '/v1/flights?region=tampa-bay&region=fl-gulf-coast'],
    ['extra parameter', '/v1/flights?region=tampa-bay&extended=1'],
    ['client-supplied bounding box', '/v1/flights?lamin=0&lomin=0&lamax=90&lomax=180'],
  ])('rejects %s with 400 and never calls upstream', async (_name, path) => {
    const { deps, fetch } = setup()
    const res = await handle(get(path), deps)

    expect(res.status).toBe(400)
    expect(await readBody(res)).toEqual({ error: 'invalid_parameters', expected: 'region' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['', 'atlantis', '__proto__', 'constructor', '../../etc', 'TAMPA-BAY'])(
    'rejects unknown region %j',
    async (region) => {
      const { deps, fetch } = setup()
      const res = await handle(get(`/v1/flights?region=${encodeURIComponent(region)}`), deps)

      expect(res.status).toBe(400)
      expect(await readBody(res)).toEqual({ error: 'unknown_region' })
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it.each(['/', '/v1', '/v1/flights/extra', '/api/states/all', '/https://evil.example/'])(
    'returns 404 JSON for unsupported path %s',
    async (path) => {
      const { deps, fetch } = setup()
      const res = await handle(get(path), deps)

      expect(res.status).toBe(404)
      expect(await readBody(res)).toEqual({ error: 'not_found' })
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it.each(['POST', 'PUT', 'DELETE'])('rejects %s with 405', async (method) => {
    const { deps } = setup()
    const res = await handle(get('/v1/flights?region=tampa-bay', { method }), deps)

    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toBe('GET, OPTIONS')
  })
})

describe('upstream failures', () => {
  it.each([
    [500, 502, 'upstream_error'],
    [404, 502, 'upstream_error'],
    [429, 503, 'upstream_rate_limited'],
  ])('maps upstream HTTP %i to %i %s', async (upstreamStatus, status, error) => {
    const { deps } = setup(() => upstreamJson({}, upstreamStatus))
    const res = await handle(get('/v1/flights?region=tampa-bay'), deps)

    expect(res.status).toBe(status)
    expect(await readBody(res)).toEqual({ error, region: 'tampa-bay' })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('maps a network failure to 502', async () => {
    const { deps } = setup(() => {
      throw new TypeError('fetch failed')
    })
    const res = await handle(get('/v1/flights?region=tampa-bay'), deps)

    expect(res.status).toBe(502)
    expect((await readBody(res)).error).toBe('upstream_unreachable')
  })

  it('maps an upstream timeout to 504', async () => {
    const { deps } = setup(() => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    })
    const res = await handle(get('/v1/flights?region=tampa-bay'), deps)

    expect(res.status).toBe(504)
    expect((await readBody(res)).error).toBe('upstream_timeout')
  })

  it('maps a non-JSON upstream body to 502', async () => {
    const { deps } = setup(() => new Response('<html>maintenance</html>', { status: 200 }))
    const res = await handle(get('/v1/flights?region=tampa-bay'), deps)

    expect(res.status).toBe(502)
    expect((await readBody(res)).error).toBe('upstream_invalid_response')
  })
})

describe('caching', () => {
  it('fetches upstream on a miss and serves the equivalent request from cache', async () => {
    const { deps, fetch } = setup()
    const first = await handle(get('/v1/flights?region=tampa-bay'), deps)
    const second = await handle(get('/v1/flights?region=tampa-bay'), deps)

    expect(first.headers.get('X-Titan-Cache')).toBe('MISS')
    expect(second.headers.get('X-Titan-Cache')).toBe('HIT-MEMORY')
    expect(await second.text()).toBe(await first.text())
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('keeps separate entries per region', async () => {
    const { deps, fetch } = setup()
    await handle(get('/v1/flights?region=tampa-bay'), deps)
    const other = await handle(get('/v1/flights?region=fl-gulf-coast'), deps)

    expect(other.headers.get('X-Titan-Cache')).toBe('MISS')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it(`expires entries after ${FLIGHTS_TTL_SECONDS}s`, async () => {
    const { deps, fetch, advance } = setup()
    await handle(get('/v1/flights?region=tampa-bay'), deps)

    advance(FLIGHTS_TTL_SECONDS * 1000 - 1)
    expect((await handle(get('/v1/flights?region=tampa-bay'), deps)).headers.get('X-Titan-Cache')).toBe('HIT-MEMORY')
    advance(1)
    expect((await handle(get('/v1/flights?region=tampa-bay'), deps)).headers.get('X-Titan-Cache')).toBe('MISS')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not cache failed upstream responses', async () => {
    let fail = true
    const { deps, fetch } = setup(() => (fail ? upstreamJson({}, 500) : upstreamJson()))
    expect((await handle(get('/v1/flights?region=tampa-bay'), deps)).status).toBe(502)

    fail = false
    const retry = await handle(get('/v1/flights?region=tampa-bay'), deps)
    expect(retry.status).toBe(200)
    expect(retry.headers.get('X-Titan-Cache')).toBe('MISS')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('writes successes to the edge cache and serves from it when memory is cold', async () => {
    const edge = fakeEdge()
    const a = setup(undefined, edge)
    await handle(get('/v1/flights?region=tampa-bay'), a.deps)
    expect(edge.store.size).toBe(1)

    // A second isolate (fresh memory) sharing the same edge cache.
    const b = setup(undefined, edge)
    const res = await handle(get('/v1/flights?region=tampa-bay'), b.deps)
    expect(res.headers.get('X-Titan-Cache')).toBe('HIT-EDGE')
    expect(b.fetch).not.toHaveBeenCalled()
  })

  it('never writes errors to the edge cache', async () => {
    const edge = fakeEdge()
    const { deps } = setup(() => upstreamJson({}, 503), edge)
    await handle(get('/v1/flights?region=tampa-bay'), deps)

    expect(edge.store.size).toBe(0)
  })
})

describe('CORS', () => {
  it('echoes an allowlisted origin', async () => {
    const { deps } = setup()
    const res = await handle(get('/v1/flights?region=tampa-bay', { origin: ORIGIN }), deps)

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull()
    expect(res.headers.get('Vary')).toBe('Origin')
  })

  it('omits CORS headers for other origins', async () => {
    const { deps } = setup()
    const res = await handle(get('/v1/flights?region=tampa-bay', { origin: 'https://evil.example' }), deps)

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('answers preflight for allowlisted origins', async () => {
    const { deps, fetch } = setup()
    const res = await handle(get('/v1/flights?region=tampa-bay', { method: 'OPTIONS', origin: ORIGIN }), deps)

    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
    expect(fetch).not.toHaveBeenCalled()
  })
})
