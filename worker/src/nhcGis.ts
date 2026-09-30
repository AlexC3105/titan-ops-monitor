import { unzipSync } from 'fflate'
import { read } from 'shapefile'
import type { Feature, FeatureCollection, Geometry } from 'geojson'

// Official NHC forecast GIS archive (shapefile ZIP) → small GeoJSON for the app.
// The archive URL always comes from NHC's CurrentStorms.json, never from a
// client, and is still checked against a fixed host/path before fetching.

export const MAX_ARCHIVE_BYTES = 2_000_000
export const MAX_ENTRY_BYTES = 5_000_000
export const MAX_TOTAL_UNZIPPED_BYTES = 10_000_000

const LAYERS = ['lin', 'pgn', 'pts'] as const
type Layer = (typeof LAYERS)[number]
const ENTRY = /^[A-Za-z0-9-]+_5day_(lin|pgn|pts)\.(shp|dbf)$/

export function isAllowedProductUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === 'www.nhc.noaa.gov' &&
    url.port === '' &&
    url.username === '' &&
    url.search === '' &&
    /^\/gis\/forecast\/archive\/[A-Za-z0-9_-]+\.zip$/.test(url.pathname)
  )
}

type LayerFiles = Partial<Record<Layer, { shp: Uint8Array; dbf: Uint8Array }>>

/**
 * Unzip only the expected shapefile members, refusing oversized entries before
 * inflating them (declared size) and after (actual size).
 */
export function extractLayers(zip: Uint8Array): LayerFiles {
  let declared = 0
  const files = unzipSync(zip, {
    filter: (f) => {
      if (!ENTRY.test(f.name)) return false
      if (f.originalSize > MAX_ENTRY_BYTES) throw new Error(`archive entry too large: ${f.name}`)
      declared += f.originalSize
      if (declared > MAX_TOTAL_UNZIPPED_BYTES) throw new Error('archive too large when unzipped')
      return true
    },
  })
  const out: LayerFiles = {}
  let actual = 0
  for (const [name, bytes] of Object.entries(files)) {
    actual += bytes.byteLength
    if (bytes.byteLength > MAX_ENTRY_BYTES || actual > MAX_TOTAL_UNZIPPED_BYTES) {
      throw new Error('archive too large when unzipped')
    }
    const [, layer, ext] = ENTRY.exec(name) as RegExpExecArray
    const entry = (out[layer as Layer] ??= { shp: new Uint8Array(), dbf: new Uint8Array() })
    entry[ext as 'shp' | 'dbf'] = bytes
  }
  return out
}

export interface StormGeometry {
  issuance: string | null
  /** Forecast centre line (LineString) plus forecast points (Point); null if not supplied. */
  track: FeatureCollection | null
  /** Cone of uncertainty polygon(s); null if not supplied. */
  cone: FeatureCollection | null
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.trim()) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

/** NHC uses 9999 mb as a placeholder for an unknown forecast pressure. */
function pressure(v: unknown): number | null {
  const n = num(v)
  return n === null || n >= 9999 ? null : n
}

async function readLayer(files: LayerFiles, layer: Layer): Promise<Feature[]> {
  const f = files[layer]
  if (!f || f.shp.byteLength === 0) return []
  const fc = await read(f.shp, f.dbf.byteLength > 0 ? f.dbf : undefined, { encoding: 'utf-8' })
  return fc.features.filter((x): x is Feature<Geometry> => x.geometry != null)
}

export async function parseForecastArchive(zip: Uint8Array): Promise<StormGeometry> {
  const files = extractLayers(zip)
  if (!LAYERS.some((l) => files[l])) throw new Error('archive contains no forecast layers')

  const [lin, pgn, pts] = await Promise.all([readLayer(files, 'lin'), readLayer(files, 'pgn'), readLayer(files, 'pts')])

  const trackFeatures: Feature[] = [
    ...lin.map((f) => ({
      type: 'Feature' as const,
      geometry: f.geometry,
      properties: {
        kind: 'forecast-track',
        forecastPeriodHours: num(f.properties?.FCSTPRD),
        stormType: str(f.properties?.STORMTYPE),
      },
    })),
    ...pts.map((f) => ({
      type: 'Feature' as const,
      geometry: f.geometry,
      properties: {
        kind: 'forecast-point',
        tau: num(f.properties?.TAU),
        validTime: str(f.properties?.FLDATELBL),
        dateLabel: str(f.properties?.DATELBL),
        maxWindKt: num(f.properties?.MAXWIND),
        gustKt: num(f.properties?.GUST),
        pressureMb: pressure(f.properties?.MSLP),
        development: str(f.properties?.DVLBL),
        stormType: str(f.properties?.STORMTYPE),
      },
    })),
  ]
  const coneFeatures: Feature[] = pgn.map((f) => ({
    type: 'Feature' as const,
    geometry: f.geometry,
    properties: { kind: 'cone', forecastPeriodHours: num(f.properties?.FCSTPRD) },
  }))

  const issuance = str(lin[0]?.properties?.ADVDATE) ?? str(pgn[0]?.properties?.ADVDATE) ?? str(pts[0]?.properties?.ADVDATE)
  return {
    issuance,
    track: trackFeatures.length ? { type: 'FeatureCollection', features: trackFeatures } : null,
    cone: coneFeatures.length ? { type: 'FeatureCollection', features: coneFeatures } : null,
  }
}
