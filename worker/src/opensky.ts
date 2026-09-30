import type { BBox } from './regions'
import { fetchUpstreamJson, type UpstreamFailure } from './upstream'

// The only upstream this module talks to. Host and path are fixed; the query is
// built from a server-side bounding box.
export const OPENSKY_STATES_URL = 'https://opensky-network.org/api/states/all'
export const MAX_FLIGHTS = 60

export interface FlightDTO {
  id: string
  callsign: string
  lon: number
  lat: number
  /** Barometric altitude in metres, null if unknown. */
  altitude: number | null
  /** Ground speed in m/s, null if unknown. */
  velocity: number | null
  /** True track in degrees clockwise from north. */
  track: number
  onGround: boolean
}

export type FlightsResult =
  | { ok: true; upstreamTime: number | null; flights: FlightDTO[] }
  | { ok: false; kind: UpstreamFailure }

export function upstreamUrl([w, s, e, n]: BBox): string {
  return `${OPENSKY_STATES_URL}?lamin=${s}&lomin=${w}&lamax=${n}&lomax=${e}`
}

// OpenSky state-vector indices: 0 icao24, 1 callsign, 5 lon, 6 lat,
// 7 baro_altitude, 8 on_ground, 9 velocity, 10 true_track.
export function normalizeStates(states: unknown): FlightDTO[] {
  if (!Array.isArray(states)) return []
  const flights: FlightDTO[] = []
  for (const s of states) {
    if (!Array.isArray(s) || typeof s[0] !== 'string') continue
    if (typeof s[5] !== 'number' || typeof s[6] !== 'number') continue
    const callsign = typeof s[1] === 'string' ? s[1].trim() : ''
    flights.push({
      id: s[0],
      callsign: callsign || s[0],
      lon: s[5],
      lat: s[6],
      altitude: typeof s[7] === 'number' ? s[7] : null,
      velocity: typeof s[9] === 'number' ? s[9] : null,
      track: typeof s[10] === 'number' ? s[10] : 0,
      onGround: s[8] === true,
    })
    if (flights.length === MAX_FLIGHTS) break
  }
  return flights
}

export async function fetchFlights(bbox: BBox, fetchImpl: typeof fetch): Promise<FlightsResult> {
  const res = await fetchUpstreamJson(upstreamUrl(bbox), fetchImpl)
  if (!res.ok) return res
  const body = res.body as { time?: unknown; states?: unknown } | null
  if (!body || typeof body !== 'object') return { ok: false, kind: 'invalid' }
  return {
    ok: true,
    upstreamTime: typeof body.time === 'number' ? body.time : null,
    flights: normalizeStates(body.states),
  }
}
