import type { AdapterResult, DataAdapter } from '@/services/dataAdapters'
import type { GeoFeatureCollection, Storm, StormGeometry } from '@/types'
import { fetchJson } from '@/services/http'
import { apiBase } from '@/services/apiConfig'

// Active tropical systems from NOAA / National Hurricane Center, via the TITAN
// API Worker (worker/src/nhc.ts, nhcGis.ts). The Worker does all NHC-specific
// work — including unpacking the official forecast shapefiles — so the browser
// only ever receives small JSON / GeoJSON and never an upstream URL.
//
// There is deliberately no mock storm: if the feed is unavailable the result is
// 'inactive' with no data, and an empty list simply means no active storms.

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/** Map one Worker storm (see StormDTO in worker/src/nhc.ts) to the app type. */
export function toStorm(s: any): Storm | null {
  if (typeof s?.id !== 'string' || num(s.lon) === null || num(s.lat) === null) return null
  return {
    id: s.id,
    name: typeof s.name === 'string' ? s.name : s.id,
    classification: typeof s.classification === 'string' ? s.classification : '',
    coord: [s.lon, s.lat],
    intensityKt: num(s.intensity),
    pressureMb: num(s.pressure),
    movementDirDeg: num(s.movementDir),
    movementSpeedMph: num(s.movementSpeed),
    lastUpdate: str(s.lastUpdate),
    advisoryNumber: str(s.advisoryNumber),
  }
}

export const nhcStormsAdapter: DataAdapter<Storm[]> = {
  id: 'nhc-storms',
  status: 'live',
  async fetch(): Promise<AdapterResult<Storm[]>> {
    try {
      const data = await fetchJson(`${apiBase()}/v1/storms`, { timeoutMs: 12000 })
      if (!Array.isArray(data?.storms)) throw new Error('Malformed storms response')
      const storms = data.storms.map(toStorm).filter((s: Storm | null): s is Storm => s !== null)
      return { sourceId: 'nhc-storms', status: 'live', fetchedAt: new Date().toISOString(), data: storms }
    } catch {
      return { sourceId: 'nhc-storms', status: 'inactive', fetchedAt: new Date().toISOString(), data: null }
    }
  },
}

function featureCollection(v: any): GeoFeatureCollection | null {
  return v?.type === 'FeatureCollection' && Array.isArray(v.features) ? (v as GeoFeatureCollection) : null
}

/** Official NHC forecast track + cone for one active storm; null if unavailable. */
export async function fetchStormGeometry(stormId: string): Promise<StormGeometry | null> {
  try {
    const data = await fetchJson(`${apiBase()}/v1/storms/${encodeURIComponent(stormId)}/geometry`, {
      timeoutMs: 15000,
    })
    if (data?.stormId !== stormId) throw new Error('Malformed geometry response')
    return {
      stormId,
      advisoryNumber: str(data.advisoryNumber),
      issuance: str(data.issuance),
      track: featureCollection(data.track),
      cone: featureCollection(data.cone),
      ...(typeof data.reason === 'string' ? { reason: data.reason } : {}),
    }
  } catch {
    return null
  }
}
