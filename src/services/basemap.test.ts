import { describe, expect, it } from 'vitest'
import { CARTO_ATTRIBUTION, basemapConfig, rasterTileUrl } from './basemap'

const KEY = 'test-dummy-key'

describe('basemapConfig', () => {
  it('builds the CARTO Dark Matter raster template with the key', () => {
    const cfg = basemapConfig({ VITE_CARTO_BASEMAP_KEY: KEY })
    if (cfg.status !== 'ok') throw new Error('expected ok')
    expect(cfg.rasterTemplate).toBe(`https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${KEY}`)
    expect(rasterTileUrl(cfg.rasterTemplate, 9, 139, 218)).toBe(
      `https://basemaps.cartocdn.com/rastertiles/dark_all/9/139/218.png?key=${KEY}`,
    )
  })

  it('builds the MapLibre Dark Matter style URL with the same key', () => {
    const cfg = basemapConfig({ VITE_CARTO_BASEMAP_KEY: KEY })
    expect(cfg).toMatchObject({ styleUrl: `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json?key=${KEY}` })
  })

  it('trims and URL-encodes the key', () => {
    const cfg = basemapConfig({ VITE_CARTO_BASEMAP_KEY: '  a b&c ' })
    expect(cfg).toMatchObject({ styleUrl: expect.stringMatching(/\?key=a%20b%26c$/) })
  })

  it.each([undefined, '', '   '])('reports missing-key for %j so no tiles are requested', (key) => {
    expect(basemapConfig({ VITE_CARTO_BASEMAP_KEY: key })).toEqual({ status: 'missing-key' })
  })

  it('credits OpenStreetMap contributors and CARTO', () => {
    expect(CARTO_ATTRIBUTION).toContain('OpenStreetMap contributors')
    expect(CARTO_ATTRIBUTION).toContain('CARTO')
  })
})
