// Regions the Worker will query upstream for. Clients send only a region id;
// bounding boxes never come from the browser, so the Worker cannot be used to
// fetch arbitrary areas. Must stay in sync with src/services/mock/regions.ts
// in the app (enforced by src/services/regionsSync.test.ts).

/** [west, south, east, north] in degrees. */
export type BBox = readonly [number, number, number, number]

export const REGION_BOUNDS: Readonly<Record<string, BBox>> = {
  'tampa-bay': [-82.85, 27.6, -82.2, 28.25],
  'fl-gulf-coast': [-83.5, 26.0, -81.5, 29.0],
}

export function boundsFor(regionId: string): BBox | undefined {
  return Object.prototype.hasOwnProperty.call(REGION_BOUNDS, regionId)
    ? REGION_BOUNDS[regionId]
    : undefined
}
