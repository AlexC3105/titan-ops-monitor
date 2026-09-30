import { useEffect } from 'react'
import { useStormStore } from '@/stores/useStormStore'

/** Active NHC storms plus selection state; triggers the one-time list fetch. */
export function useStorms(enabled = true) {
  const state = useStormStore()
  const load = useStormStore((s) => s.load)
  useEffect(() => {
    if (enabled) void load()
  }, [enabled, load])
  return state
}
