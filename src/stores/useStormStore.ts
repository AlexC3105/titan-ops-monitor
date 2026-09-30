import { create } from 'zustand'
import type { FeedStatus, Storm, StormGeometry } from '@/types'
import { fetchStormGeometry, nhcStormsAdapter } from '@/services/adapters/nhcStorms'

// Active storms and the selected storm's forecast geometry, shared by both map
// renderers and the storm panel so each is fetched once. Not persisted: storm
// ids and advisories are short-lived.
interface StormState {
  storms: Storm[]
  status: FeedStatus
  loading: boolean
  loaded: boolean
  selectedStormId: string | null
  geometry: StormGeometry | null
  geometryLoading: boolean
  /** Fetch the active-storm list once (no auto-refresh yet). */
  load: () => Promise<void>
  /** Select a storm (or clear with null) and fetch its forecast geometry. */
  select: (id: string | null) => Promise<void>
  toggle: (id: string) => Promise<void>
}

export const useStormStore = create<StormState>()((set, get) => ({
  storms: [],
  status: 'live',
  loading: false,
  loaded: false,
  selectedStormId: null,
  geometry: null,
  geometryLoading: false,

  load: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true })
    const res = await nhcStormsAdapter.fetch('')
    set({ storms: res.data ?? [], status: res.status, loading: false, loaded: true })
  },

  select: async (id) => {
    set({ selectedStormId: id, geometry: null, geometryLoading: id !== null })
    if (id === null) return
    const geometry = await fetchStormGeometry(id)
    // Ignore a late response for a storm that is no longer selected.
    if (get().selectedStormId === id) set({ geometry, geometryLoading: false })
  },

  toggle: (id) => get().select(get().selectedStormId === id ? null : id),
}))
