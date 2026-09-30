import { useStormStore } from '@/stores/useStormStore'

/** Active NHC storms plus selection state (refreshed by the feed scheduler). */
export function useStorms(_enabled = true) {
  return useStormStore()
}
