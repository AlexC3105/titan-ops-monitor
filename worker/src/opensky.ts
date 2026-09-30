import type { BBox } from './regions'

// The only upstream this module talks to. Host and path are fixed; the query is
// built from a server-side bounding box.
export const OPENSKY_STATES_URL = 'https://opensky-network.org/api/states/all'
export const UPSTREAM_TIMEOUT_MS = 8000
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

export type UpstreamResult =
  | { ok: true; upstreamTime: number | null; flights: FlightDTO[] }
  | { ok: false; kind: 'timeout' | 'rate_limited' | 'http' | 'network' | 'invalid'; status?: number }

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

export async function fetchFlights(bbox: BBox, fetchImpl: typeof fetch): Promise<UpstreamResult> {
  let res: Response
  try {
    res = await fetchImpl(upstreamUrl(bbox), {
      headers: { Accept: 'application/json', 'User-Agent': 'titan-ops-monitor (github.com/AlexC3105/titan-ops-monitor)' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (err) {
    const name = (err as { name?: string } | null)?.name
    return { ok: false, kind: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network' }
  }
  if (res.status === 429) return { ok: false, kind: 'rate_limited', status: 429 }
  if (!res.ok) return { ok: false, kind: 'http', status: res.status }
  try {
    const body = (await res.json()) as { time?: unknown; states?: unknown }
    return {
      ok: true,
      upstreamTime: typeof body.time === 'number' ? body.time : null,
      flights: normalizeStates(body.states),
    }
  } catch {
    return { ok: false, kind: 'invalid' }
  }
}
