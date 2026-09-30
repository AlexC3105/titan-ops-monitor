import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenSkyAdapter, flightsMode } from './openSkyFlights'
import { apiBase } from '@/services/apiConfig'
import states from '../../../test/fixtures/opensky-states.json'
import { normalizeStates } from '../../../worker/src/opensky'
import { jsonResponse, stubFetch, stubHangingFetch } from '../../../test/fetchStub'

// The Worker's response for the recorded OpenSky fixture, built with the
// Worker's own normaliser so both halves of the contract are exercised.
const workerBody = {
  region: 'tampa-bay',
  fetchedAt: '2026-09-30T12:00:00.000Z',
  upstreamTime: states.time,
  count: 2,
  flights: normalizeStates(states.states),
}

afterEach(() => {
  vi.useRealTimers()
})

const openSkyFlightsAdapter = createOpenSkyAdapter('worker')

describe('openSkyFlightsAdapter (production: via Worker)', () => {
  it('declares itself a live source', () => {
    expect(openSkyFlightsAdapter.id).toBe('opensky')
    expect(openSkyFlightsAdapter.status).toBe('live')
  })

  it('requests the Worker flights endpoint by region id', async () => {
    const fetch = stubFetch(() => jsonResponse(workerBody))
    await openSkyFlightsAdapter.fetch('fl-gulf-coast')

    expect(fetch.mock.calls[0][0]).toBe(`${apiBase()}/v1/flights?region=fl-gulf-coast`)
  })

  it('sends the default region id for an unknown region', async () => {
    const fetch = stubFetch(() => jsonResponse(workerBody))
    await openSkyFlightsAdapter.fetch('nowhere')

    expect(fetch.mock.calls[0][0]).toBe(`${apiBase()}/v1/flights?region=tampa-bay`)
  })

  it('maps a Worker response into live flights', async () => {
    stubFetch(() => jsonResponse(workerBody))
    const res = await openSkyFlightsAdapter.fetch('tampa-bay')

    expect(res.status).toBe('live')
    expect(res.data).toHaveLength(2)
    expect(res.data?.[0]).toEqual({
      id: 'abc001',
      callsign: 'TEST101',
      coord: [states.states[0][5], states.states[0][6]],
      track: states.states[0][10],
      altitude: states.states[0][7],
      velocity: states.states[0][9],
      onGround: false,
    })
    expect(res.data?.[1].callsign).toBe('abc002')
  })

  it('treats an empty flights list as live with no flights', async () => {
    stubFetch(() => jsonResponse({ ...workerBody, count: 0, flights: [] }))
    const res = await openSkyFlightsAdapter.fetch('tampa-bay')

    expect(res.status).toBe('live')
    expect(res.data).toEqual([])
  })

  it('drops malformed flight entries', async () => {
    stubFetch(() => jsonResponse({ ...workerBody, flights: [...workerBody.flights, { id: 'x' }, null] }))
    const res = await openSkyFlightsAdapter.fetch('tampa-bay')

    expect(res.data).toHaveLength(2)
  })

  it.each([
    ['Worker upstream error (502)', () => jsonResponse({ error: 'upstream_error' }, 502)],
    ['rate limiting (503)', () => jsonResponse({ error: 'upstream_rate_limited' }, 503)],
    ['a malformed body', () => jsonResponse({ unexpected: true })],
  ])('falls back to labelled mock flights on %s', async (_name, route) => {
    stubFetch(route)
    const res = await openSkyFlightsAdapter.fetch('tampa-bay')

    expect(res.status).toBe('mock')
    expect(res.data?.map((f) => f.id)).toEqual(['mock1', 'mock2', 'mock3'])
  })

  it('times out after 12s and falls back to mock', async () => {
    vi.useFakeTimers()
    stubHangingFetch()
    const pending = openSkyFlightsAdapter.fetch('tampa-bay')
    await vi.advanceTimersByTimeAsync(11_999)
    await vi.advanceTimersByTimeAsync(1)

    expect((await pending).status).toBe('mock')
  })
})

describe('openSkyFlightsAdapter (local dev: via Vite proxy)', () => {
  const devAdapter = createOpenSkyAdapter('dev-proxy')

  it('queries the Vite /osky proxy with the region bounding box', async () => {
    const fetch = stubFetch(() => jsonResponse(states))
    await devAdapter.fetch('tampa-bay')

    expect(fetch.mock.calls[0][0]).toBe('/osky/api/states/all?lamin=27.6&lomin=-82.85&lamax=28.25&lomax=-82.2')
  })

  it('parses recorded OpenSky state vectors into live flights', async () => {
    stubFetch(() => jsonResponse(states))
    const res = await devAdapter.fetch('tampa-bay')

    expect(res.status).toBe('live')
    expect(res.data?.map((f) => f.callsign)).toEqual(['TEST101', 'abc002'])
  })

  it('falls back to labelled mock flights when the proxy fails', async () => {
    stubFetch(() => jsonResponse({}, 404))
    const res = await devAdapter.fetch('tampa-bay')

    expect(res.status).toBe('mock')
  })
})

describe('flightsMode', () => {
  it('uses the Vite proxy on the dev server', () => {
    expect(flightsMode({ DEV: true })).toBe('dev-proxy')
  })

  it('uses the Worker in production builds', () => {
    expect(flightsMode({ DEV: false })).toBe('worker')
  })

  it('uses the Worker in dev when a Worker URL is configured', () => {
    expect(flightsMode({ DEV: true, VITE_TITAN_API_BASE: 'http://localhost:8787' })).toBe('worker')
  })
})
