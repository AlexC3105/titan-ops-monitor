import { fetchUpstreamJson, type UpstreamFailure } from './upstream'

// National Hurricane Center list of currently active tropical systems. Fixed
// official URL; an empty list is a valid response (no active storms).
export const NHC_CURRENT_STORMS_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json'

export interface StormDTO {
  id: string
  name: string
  /** NHC classification code, e.g. TD, TS, HU, PTC. */
  classification: string
  lat: number
  lon: number
  /** Values as published by NHC; null when missing or non-numeric. */
  intensity: number | null
  pressure: number | null
  movementDir: number | null
  movementSpeed: number | null
  /** ISO time of the latest NHC update for this system. */
  lastUpdate: string | null
  advisoryNumber: string | null
}

export type StormsResult = { ok: true; storms: StormDTO[] } | { ok: false; kind: UpstreamFailure }

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

export function normalizeStorms(list: unknown): StormDTO[] {
  if (!Array.isArray(list)) return []
  const storms: StormDTO[] = []
  for (const s of list) {
    if (!s || typeof s.id !== 'string') continue
    const lat = num(s.latitudeNumeric)
    const lon = num(s.longitudeNumeric)
    if (lat === null || lon === null) continue
    storms.push({
      id: s.id,
      name: typeof s.name === 'string' ? s.name : s.id,
      classification: typeof s.classification === 'string' ? s.classification : '',
      lat,
      lon,
      intensity: num(s.intensity),
      pressure: num(s.pressure),
      movementDir: num(s.movementDir),
      movementSpeed: num(s.movementSpeed),
      lastUpdate: typeof s.lastUpdate === 'string' ? s.lastUpdate : null,
      advisoryNumber: typeof s.publicAdvisory?.advNum === 'string' ? s.publicAdvisory.advNum : null,
    })
  }
  return storms
}

export async function fetchStorms(fetchImpl: typeof fetch): Promise<StormsResult> {
  const res = await fetchUpstreamJson(NHC_CURRENT_STORMS_URL, fetchImpl)
  if (!res.ok) return res
  const body = res.body as { activeStorms?: unknown } | null
  if (!body || typeof body !== 'object' || !Array.isArray(body.activeStorms)) return { ok: false, kind: 'invalid' }
  return { ok: true, storms: normalizeStorms(body.activeStorms) }
}
