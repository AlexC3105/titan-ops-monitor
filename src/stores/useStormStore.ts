import { create } from 'zustand'
import type { FeedStatus, Storm, StormGeometry } from '@/types'
import type { FeedRunResult } from '@/services/feeds/scheduler'
import { fetchStormGeometry, nhcStormsAdapter } from '@/services/adapters/nhcStorms'

// Active storms and the selected storm's forecast geometry, shared by both map
// renderers and the storm panel. Refreshed by the feed scheduler (see
// services/feeds/runtime.ts). Not persisted: storm ids and advisories are
// short-lived.
interface StormState {
  storms: Storm[]
  /** Source status of the storms currently shown ('live' once any live list has arrived). */
  status: FeedStatus
  loading: boolean
  loaded: boolean
  selectedStormId: string | null
  geometry: StormGeometry | null
  geometryLoading: boolean
  /**
   * Fetch the active-storm list. A failed refresh keeps the last live list.
   * The selected storm's geometry is refetched only when its advisory changes.
   */
  refresh: () => Promise<FeedRunResult>
  /** Select a storm (or clear with null) and fetch its forecast geometry. */
  select: (id: string | null) => Promise<void>
  toggle: (id: string) => Promise<void>
}

export const useStormStore = create<StormState>()((set, get) => ({
  storms: [],
  status: 'live',
  loading: true,
  loaded: false,
  selectedStormId: null,
  geometry: null,
  geometryLoading: false,

  refresh: async () => {
    set({ loading: !get().loaded })
    const res = await nhcStormsAdapter.fetch('')
    if (res.status !== 'live' || !res.data) {
      // Keep previously received live storms visible; health reports the failure.
      set({ loading: false, loaded: true, ...(get().loaded && get().status === 'live' ? {} : { storms: [], status: res.status }) })
      return { status: res.status }
    }
    set({ storms: res.data, status: 'live', loading: false, loaded: true })

    const { selectedStormId, geometry } = get()
    if (selectedStormId) {
      const current = res.data.find((s) => s.id === selectedStormId)
      if (!current) await get().select(null)
      else if (geometry && current.advisoryNumber !== geometry.advisoryNumber) await get().select(selectedStormId)
    }
    return { status: 'live' }
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
