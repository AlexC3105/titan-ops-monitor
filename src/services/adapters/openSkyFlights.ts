import type { AdapterResult, DataAdapter } from '@/services/dataAdapters'
import type { Flight } from '@/types'
import { fetchJson } from '@/services/http'
import { getRegion } from '@/services/mock/regions'

// Live flight positions from the OpenSky Network (key-less, rate-limited).
// State-vector array indices: 0 icao24, 1 callsign, 5 lon, 6 lat, 7 baro_alt,
// 8 on_ground, 9 velocity, 10 true_track. Falls back to mock on error/limit.

function mockFlights(regionId: string): Flight[] {
  const [lon, lat] = getRegion(regionId).center
  return [
    { id: 'mock1', callsign: 'SWA1234', coord: [lon + 0.08, lat + 0.05], track: 215, altitude: 2400, velocity: 180, onGround: false },
    { id: 'mock2', callsign: 'AAL88', coord: [lon - 0.06, lat + 0.09], track: 40, altitude: 6100, velocity: 230, onGround: false },
    { id: 'mock3', callsign: 'N512TB', coord: [lon - 0.03, lat - 0.04], track: 120, altitude: null, velocity: null, onGround: true },
  ]
}

export const openSkyFlightsAdapter: DataAdapter<Flight[]> = {
  id: 'opensky',
  status: 'live',
  async fetch(regionId: string): Promise<AdapterResult<Flight[]>> {
    const [w, s, e, n] = getRegion(regionId).bounds
    try {
      // Same-origin '/osky' path → Vite dev proxy (or a prod backend route).
      // Avoids OpenSky's same-origin-only CORS; 404s to mock fallback if absent.
      const data = await fetchJson(
        `/osky/api/states/all?lamin=${s}&lomin=${w}&lamax=${n}&lomax=${e}`,
        { timeoutMs: 12000 },
      )
      const states: any[] = Array.isArray(data?.states) ? data.states : []
      const flights: Flight[] = states
        .filter((a) => a[5] != null && a[6] != null)
        .slice(0, 60)
        .map((a) => ({
          id: a[0],
          callsign: (a[1] ?? '').trim() || a[0],
          coord: [a[5], a[6]] as [number, number],
          track: typeof a[10] === 'number' ? a[10] : 0,
          altitude: typeof a[7] === 'number' ? a[7] : null,
          velocity: typeof a[9] === 'number' ? a[9] : null,
          onGround: Boolean(a[8]),
        }))
      return { sourceId: 'opensky', status: 'live', fetchedAt: new Date().toISOString(), data: flights }
    } catch {
      return { sourceId: 'opensky', status: 'mock', fetchedAt: new Date().toISOString(), data: mockFlights(regionId) }
    }
  },
}
