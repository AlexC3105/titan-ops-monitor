import type { InfraPoint } from '@/types'

// Mock infrastructure markers for the regional map layer. Approximate locations;
// replaced by an OSM/Overpass adapter in a later Phase 1 slice.
export const INFRA_POINTS: InfraPoint[] = [
  // Tampa Bay
  { id: 'port-tampa', name: 'Port Tampa Bay', kind: 'port', regionId: 'tampa-bay', coord: [-82.43, 27.917] },
  { id: 'skyway', name: 'Sunshine Skyway Bridge', kind: 'bridge', regionId: 'tampa-bay', coord: [-82.656, 27.62] },
  { id: 'howard-frankland', name: 'Howard Frankland Bridge', kind: 'bridge', regionId: 'tampa-bay', coord: [-82.591, 27.925] },
  { id: 'tgh', name: 'Tampa General Hospital', kind: 'hospital', regionId: 'tampa-bay', coord: [-82.459, 27.937] },
  { id: 'tpa', name: 'Tampa International Airport', kind: 'airport', regionId: 'tampa-bay', coord: [-82.533, 27.979] },
  { id: 'big-bend', name: 'Big Bend Power Station', kind: 'power', regionId: 'tampa-bay', coord: [-82.403, 27.795] },
  // Florida Gulf Coast (broader)
  { id: 'port-manatee', name: 'Port Manatee', kind: 'port', regionId: 'fl-gulf-coast', coord: [-82.563, 27.638] },
  { id: 'pie', name: 'St. Pete–Clearwater Airport', kind: 'airport', regionId: 'fl-gulf-coast', coord: [-82.687, 27.91] },
  { id: 'bayfront', name: 'Bayfront Health St. Petersburg', kind: 'hospital', regionId: 'fl-gulf-coast', coord: [-82.637, 27.77] },
  { id: 'sarasota-mem', name: 'Sarasota Memorial Hospital', kind: 'hospital', regionId: 'fl-gulf-coast', coord: [-82.527, 27.305] },
  { id: 'skyway-2', name: 'Sunshine Skyway Bridge', kind: 'bridge', regionId: 'fl-gulf-coast', coord: [-82.656, 27.62] },
]

export function getInfraPoints(regionId: string): InfraPoint[] {
  return INFRA_POINTS.filter((p) => p.regionId === regionId)
}
