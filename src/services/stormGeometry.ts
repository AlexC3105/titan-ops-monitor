import type { GeoFeatureCollection, GeoGeometry, StormGeometry } from '@/types'

// Pure helpers shared by both map renderers. They only read NHC-supplied
// geometry; nothing here interpolates or reshapes forecast data.

/** NHC classification codes with an unambiguous plain-language name. Others are shown as the raw code. */
const CLASSIFICATION_NAMES: Record<string, string> = {
  TD: 'Tropical Depression',
  TS: 'Tropical Storm',
  HU: 'Hurricane',
  STD: 'Subtropical Depression',
  STS: 'Subtropical Storm',
}

export function classificationLabel(code: string): string {
  return CLASSIFICATION_NAMES[code] ?? code
}

export type Bounds = [west: number, south: number, east: number, north: number]

function eachPosition(g: GeoGeometry, fn: (lon: number, lat: number) => void) {
  switch (g.type) {
    case 'Point':
      fn(g.coordinates[0], g.coordinates[1])
      break
    case 'LineString':
      g.coordinates.forEach((p) => fn(p[0], p[1]))
      break
    case 'MultiLineString':
    case 'Polygon':
      g.coordinates.forEach((ring) => ring.forEach((p) => fn(p[0], p[1])))
      break
    case 'MultiPolygon':
      g.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach((p) => fn(p[0], p[1]))))
      break
  }
}

/** Bounding box of all track and cone geometry, or null if there is none. */
export function geometryBounds(geom: Pick<StormGeometry, 'track' | 'cone'> | null): Bounds | null {
  if (!geom) return null
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const fc of [geom.track, geom.cone]) {
    for (const f of fc?.features ?? []) {
      eachPosition(f.geometry, (lon, lat) => {
        w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat)
      })
    }
  }
  return Number.isFinite(w) ? [w, s, e, n] : null
}

/**
 * Largest integer Web Mercator zoom at which `bounds` fits a viewport of
 * width×height pixels (256 px tiles), clamped to [minZoom, maxZoom].
 */
export function fitZoom(bounds: Bounds, width: number, height: number, minZoom: number, maxZoom: number, padding = 40): number {
  const [w, s, e, n] = bounds
  const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)
  const spanX = Math.max((e - w) / 360, 1e-9)
  const spanY = Math.max(Math.abs(mercY(n) - mercY(s)), 1e-9)
  const usableW = Math.max(width - 2 * padding, 1)
  const usableH = Math.max(height - 2 * padding, 1)
  const z = Math.floor(Math.log2(Math.min(usableW / (256 * spanX), usableH / (256 * spanY))))
  return Math.min(maxZoom, Math.max(minZoom, z))
}

export function boundsCenter([w, s, e, n]: Bounds): [number, number] {
  return [(w + e) / 2, (s + n) / 2]
}

/** Outer and inner rings of every cone polygon. */
export function coneRings(cone: GeoFeatureCollection | null): number[][][] {
  const rings: number[][][] = []
  for (const f of cone?.features ?? []) {
    if (f.geometry.type === 'Polygon') rings.push(...f.geometry.coordinates)
    else if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates.forEach((p) => rings.push(...p))
  }
  return rings
}

/** Forecast centre line(s). */
export function trackLines(track: GeoFeatureCollection | null): number[][][] {
  const lines: number[][][] = []
  for (const f of track?.features ?? []) {
    if (f.geometry.type === 'LineString') lines.push(f.geometry.coordinates)
    else if (f.geometry.type === 'MultiLineString') lines.push(...f.geometry.coordinates)
  }
  return lines
}

export interface ForecastPoint {
  coord: [number, number]
  tau: number | null
  validTime: string | null
  maxWindKt: number | null
}

/** Forecast points in the order NHC supplied them. */
export function forecastPoints(track: GeoFeatureCollection | null): ForecastPoint[] {
  return (track?.features ?? [])
    .filter((f) => f.geometry.type === 'Point' && f.properties?.kind === 'forecast-point')
    .map((f) => {
      const p = f.properties ?? {}
      const c = (f.geometry as { coordinates: number[] }).coordinates
      return {
        coord: [c[0], c[1]] as [number, number],
        tau: typeof p.tau === 'number' ? p.tau : null,
        validTime: typeof p.validTime === 'string' ? p.validTime : null,
        maxWindKt: typeof p.maxWindKt === 'number' ? p.maxWindKt : null,
      }
    })
}

/** e.g. [-43.9, 33.5] → "33.5°N 43.9°W" */
export function formatPosition([lon, lat]: [number, number]): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew}`
}

/** e.g. (120, 5) → "120° at 5 mph"; null when NHC gives neither. */
export function formatMovement(dirDeg: number | null, speedMph: number | null): string | null {
  if (dirDeg === null && speedMph === null) return null
  if (speedMph === 0) return 'Stationary'
  const dir = dirDeg !== null ? `${dirDeg}°` : 'direction n/a'
  return speedMph !== null ? `${dir} at ${speedMph} mph` : dir
}
