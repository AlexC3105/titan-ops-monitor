import type { AdapterResult, DataAdapter } from '@/services/dataAdapters'
import type { Flight } from '@/types'
import { fetchJson } from '@/services/http'
import { apiBase } from '@/services/apiConfig'
import { getRegion } from '@/services/mock/regions'
import { normalizeStates, type FlightDTO } from '../../../worker/src/opensky'

// Live flight positions from the OpenSky Network. The browser cannot call
// OpenSky directly (no cross-origin access), so there are two explicit paths:
//
// - 'dev-proxy'  (vite dev server): browser → Vite /osky proxy → OpenSky.
//                Parsed with the same normaliser the Worker uses.
// - 'worker'     (production builds): browser → TITAN API Worker → OpenSky.
//                The Worker holds the region bounding boxes and caches results.
//
// Either path falls back to clearly labelled mock flights on any error or
// timeout. OpenSky currently does not answer requests from Cloudflare, so in
// production this fallback is the expected behaviour until provider access is
// arranged (see ROADMAP.md).

export type FlightsMode = 'worker' | 'dev-proxy'

/** Dev server without an explicit Worker URL → Vite proxy; otherwise → Worker. */
export function flightsMode(env: { DEV?: boolean; VITE_TITAN_API_BASE?: string }): FlightsMode {
  return env.DEV && !env.VITE_TITAN_API_BASE ? 'dev-proxy' : 'worker'
}

function mockFlights(regionId: string): Flight[] {
  const [lon, lat] = getRegion(regionId).center
  return [
    { id: 'mock1', callsign: 'SWA1234', coord: [lon + 0.08, lat + 0.05], track: 215, altitude: 2400, velocity: 180, onGround: false },
    { id: 'mock2', callsign: 'AAL88', coord: [lon - 0.06, lat + 0.09], track: 40, altitude: 6100, velocity: 230, onGround: false },
    { id: 'mock3', callsign: 'N512TB', coord: [lon - 0.03, lat - 0.04], track: 120, altitude: null, velocity: null, onGround: true },
  ]
}

function toFlight(f: FlightDTO): Flight {
  return {
    id: f.id,
    callsign: f.callsign,
    coord: [f.lon, f.lat],
    track: f.track,
    altitude: f.altitude,
    velocity: f.velocity,
    onGround: f.onGround,
  }
}

function isFlightDTO(f: any): f is FlightDTO {
  return typeof f?.id === 'string' && typeof f?.lon === 'number' && typeof f?.lat === 'number'
}

async function fetchViaWorker(regionId: string): Promise<FlightDTO[]> {
  const data = await fetchJson(`${apiBase()}/v1/flights?region=${encodeURIComponent(regionId)}`, {
    timeoutMs: 12000,
  })
  if (!Array.isArray(data?.flights)) throw new Error('Malformed flights response')
  return data.flights.filter(isFlightDTO)
}

async function fetchViaDevProxy(regionId: string): Promise<FlightDTO[]> {
  const [w, s, e, n] = getRegion(regionId).bounds
  const data = await fetchJson(`/osky/api/states/all?lamin=${s}&lomin=${w}&lamax=${n}&lomax=${e}`, {
    timeoutMs: 12000,
  })
  return normalizeStates(data?.states)
}

export function createOpenSkyAdapter(mode: FlightsMode): DataAdapter<Flight[]> {
  return {
    id: 'opensky',
    status: 'live',
    async fetch(regionId: string): Promise<AdapterResult<Flight[]>> {
      const region = getRegion(regionId)
      try {
        const flights = mode === 'worker' ? await fetchViaWorker(region.id) : await fetchViaDevProxy(region.id)
        return { sourceId: 'opensky', status: 'live', fetchedAt: new Date().toISOString(), data: flights.map(toFlight) }
      } catch {
        return { sourceId: 'opensky', status: 'mock', fetchedAt: new Date().toISOString(), data: mockFlights(region.id) }
      }
    },
  }
}

export const openSkyFlightsAdapter = createOpenSkyAdapter(flightsMode(import.meta.env))
