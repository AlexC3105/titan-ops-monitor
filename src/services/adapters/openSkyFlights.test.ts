import { afterEach, describe, expect, it, vi } from 'vitest'
import { openSkyFlightsAdapter } from './openSkyFlights'
import states from '../../../test/fixtures/opensky-states.json'
import { jsonResponse, stubFetch, stubHangingFetch } from '../../../test/fetchStub'

afterEach(() => {
  vi.useRealTimers()
})

describe('openSkyFlightsAdapter', () => {
  it('declares itself a live source', () => {
    expect(openSkyFlightsAdapter.id).toBe('opensky')
    expect(openSkyFlightsAdapter.status).toBe('live')
  })

  it('queries the same-origin proxy path with the region bounding box', async () => {
    const fetch = stubFetch(() => jsonResponse(states))
    await openSkyFlightsAdapter.fetch('tampa-bay')

    expect(fetch.mock.calls[0][0]).toBe(
      '/osky/api/states/all?lamin=27.6&lomin=-82.85&lamax=28.25&lomax=-82.2',
    )
  })

  it('parses recorded state vectors and drops aircraft without a position', async () => {
    stubFetch(() => jsonResponse(states))
    const res = await openSkyFlightsAdapter.fetch('tampa-bay')

    expect(res.status).toBe('live')
    expect(res.data).toHaveLength(2)
    const [a, b] = res.data!
    expect(a).toEqual({
      id: 'abc001',
      callsign: 'TEST101',
      coord: [states.states[0][5], states.states[0][6]],
      track: states.states[0][10],
      altitude: states.states[0][7],
      velocity: states.states[0][9],
      onGround: false,
    })
    // Blank callsign falls back to the ICAO24 address.
    expect(b.callsign).toBe('abc002')
  })

  it('treats a null states array as live with no flights', async () => {
    stubFetch(() => jsonResponse({ time: 0, states: null }))
    const res = await openSkyFlightsAdapter.fetch('tampa-bay')

    expect(res.status).toBe('live')
    expect(res.data).toEqual([])
  })

  it('falls back to mock flights when the proxy route is missing (404)', async () => {
    stubFetch(() => jsonResponse({}, 404))
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
