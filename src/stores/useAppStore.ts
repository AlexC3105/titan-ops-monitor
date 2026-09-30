import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LAYERS } from '@/services/mock/layers'
import { DEFAULT_REGION_ID } from '@/services/mock/regions'

function defaultLayerVisibility(): Record<string, boolean> {
  return Object.fromEntries(LAYERS.map((l) => [l.id, l.enabledByDefault]))
}

export type MapMode = 'interactive' | 'compatibility'

interface AppState {
  regionId: string
  layerVisibility: Record<string, boolean>
  sidebarCollapsed: boolean
  /** 'interactive' = MapLibre/WebGL; 'compatibility' = raster-tile fallback (no GPU). */
  mapMode: MapMode
  setRegion: (id: string) => void
  toggleLayer: (id: string) => void
  setLayer: (id: string, visible: boolean) => void
  toggleSidebar: () => void
  resetLayers: () => void
  setMapMode: (mode: MapMode) => void
}

// Global UI/world state. Persisted so region + layer prefs survive reloads
// (foundation for "saved scenarios / layer toggles" in the brief).
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      regionId: DEFAULT_REGION_ID,
      layerVisibility: defaultLayerVisibility(),
      sidebarCollapsed: false,
      // Default to the GPU-free renderer so a map always shows; users can opt
      // into the WebGL map.
      mapMode: 'compatibility',
      setRegion: (id) => set({ regionId: id }),
      toggleLayer: (id) =>
        set((s) => ({ layerVisibility: { ...s.layerVisibility, [id]: !s.layerVisibility[id] } })),
      setLayer: (id, visible) =>
        set((s) => ({ layerVisibility: { ...s.layerVisibility, [id]: visible } })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      resetLayers: () => set({ layerVisibility: defaultLayerVisibility() }),
      setMapMode: (mode) => set({ mapMode: mode }),
    }),
    { name: 'titan.app' },
  ),
)
