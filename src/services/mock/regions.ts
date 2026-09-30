import type { Region } from '@/types'

// Phase 2 first region: Tampa Bay / Florida Gulf Coast.
export const REGIONS: Region[] = [
  {
    id: 'tampa-bay',
    name: 'Tampa Bay, FL',
    center: [-82.4572, 27.9506],
    bounds: [-82.85, 27.6, -82.2, 28.25],
    population: 3_200_000,
  },
  {
    id: 'fl-gulf-coast',
    name: 'Florida Gulf Coast',
    center: [-82.6, 27.3],
    bounds: [-83.5, 26.0, -81.5, 29.0],
    population: 6_800_000,
  },
]

export const DEFAULT_REGION_ID = 'tampa-bay'

export function getRegion(id: string): Region {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0]
}
