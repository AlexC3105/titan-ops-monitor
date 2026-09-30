import { describe, expect, it } from 'vitest'
import {
  boundsCenter, classificationLabel, coneRings, fitZoom, forecastPoints, formatMovement, formatPosition, geometryBounds, trackLines,
} from './stormGeometry'
import type { StormGeometry } from '@/types'
import recorded from '../../test/fixtures/worker-storm-geometry-al082026.json'

const geometry = recorded as unknown as StormGeometry

describe('storm geometry helpers', () => {
  it('extracts the official cone ring, centre line and forecast points unchanged', () => {
    const rings = coneRings(geometry.cone)
    expect(rings).toHaveLength(1)
    expect(rings[0]).toBe((geometry.cone!.features[0].geometry as { coordinates: number[][][] }).coordinates[0])
    expect(trackLines(geometry.track)).toHaveLength(1)
    const pts = forecastPoints(geometry.track)
    expect(pts.map((p) => p.tau)).toEqual([0, 12, 24, 36, 48, 60, 72])
    expect(pts[0]).toMatchObject({ coord: [-43.9, 33.5], maxWindKt: 35 })
  })

  it('returns empty collections for unavailable geometry', () => {
    expect(coneRings(null)).toEqual([])
    expect(trackLines(null)).toEqual([])
    expect(forecastPoints(null)).toEqual([])
    expect(geometryBounds(null)).toBeNull()
    expect(geometryBounds({ track: null, cone: null })).toBeNull()
  })

  it('computes bounds covering track and cone', () => {
    const [w, s, e, n] = geometryBounds(geometry)!
    for (const [lon, lat] of trackLines(geometry.track)[0]) {
      expect(lon).toBeGreaterThanOrEqual(w)
      expect(lon).toBeLessThanOrEqual(e)
      expect(lat).toBeGreaterThanOrEqual(s)
      expect(lat).toBeLessThanOrEqual(n)
    }
    expect(boundsCenter([-10, 0, 10, 20])).toEqual([0, 10])
  })

  it('fits a zoom level to the viewport and clamps it', () => {
    // 45° wide box in an 800×600 viewport: 2^z·256·(45/360) ≤ 720 → z = 4
    expect(fitZoom([-90, 0, -45, 20], 800, 600, 2, 12)).toBe(4)
    expect(fitZoom([-90, 0, -45, 20], 800, 600, 5, 12)).toBe(5)
    expect(fitZoom([-82.5, 27.9, -82.49, 27.91], 800, 600, 2, 9)).toBe(9)
  })

  it('labels only unambiguous NHC classifications and keeps other codes as-is', () => {
    expect(classificationLabel('TS')).toBe('Tropical Storm')
    expect(classificationLabel('HU')).toBe('Hurricane')
    expect(classificationLabel('PTC')).toBe('PTC')
  })

  it('formats position and movement with units', () => {
    expect(formatPosition([-43.9, 33.5])).toBe('33.5°N 43.9°W')
    expect(formatPosition([164.6, -22.4])).toBe('22.4°S 164.6°E')
    expect(formatMovement(120, 5)).toBe('120° at 5 mph')
    expect(formatMovement(null, null)).toBeNull()
    expect(formatMovement(90, 0)).toBe('Stationary')
  })
})
