// CARTO Dark Matter basemap, shared by both renderers. One CARTO basemap key
// serves both the raster tiles (compatibility renderer) and the MapLibre vector
// style (interactive renderer).
//
// The key is a *browser* key: Vite inlines VITE_* values into the bundle and it
// appears in every tile request. It is protected by CARTO's per-key website
// (Referer) restrictions, not by secrecy. CARTO requires a separate key for
// localhost; see README → "Basemap key".

export const CARTO_ATTRIBUTION = '© OpenStreetMap contributors © CARTO'

const RASTER_TEMPLATE = 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png'
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export type BasemapConfig =
  | {
      status: 'ok'
      /** Raster tile URL template ({z}/{x}/{y}) including the key. */
      rasterTemplate: string
      /** MapLibre style.json URL including the key. */
      styleUrl: string
    }
  | { status: 'missing-key' }

export function basemapConfig(env: { VITE_CARTO_BASEMAP_KEY?: string } = import.meta.env): BasemapConfig {
  const key = env.VITE_CARTO_BASEMAP_KEY?.trim()
  if (!key) return { status: 'missing-key' }
  const q = `?key=${encodeURIComponent(key)}`
  return { status: 'ok', rasterTemplate: `${RASTER_TEMPLATE}${q}`, styleUrl: `${STYLE_URL}${q}` }
}

/** Fill a raster template for one tile. */
export function rasterTileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
}
