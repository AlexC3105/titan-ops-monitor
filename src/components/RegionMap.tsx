import { lazy, Suspense } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { StaticMap } from '@/components/StaticMap'
import { GlobePlaceholder } from '@/components/GlobePlaceholder'

// MapLibre/WebGL map is code-split; only loaded when interactive mode is on.
const MapView = lazy(() => import('@/components/MapView').then((m) => ({ default: m.MapView })))

/**
 * Region map with a renderer toggle:
 *  - 'compatibility' (default): StaticMap — raster tiles + DOM markers, no GPU.
 *  - 'interactive': MapView — MapLibre/WebGL (smooth vector zoom, needs WebGL).
 * The toggle lets anyone switch if their GPU can't composite WebGL.
 */
export function RegionMap({ className = '' }: { className?: string }) {
  const mapMode = useAppStore((s) => s.mapMode)
  const setMapMode = useAppStore((s) => s.setMapMode)
  const interactive = mapMode === 'interactive'

  return (
    <div className={`relative ${className}`}>
      {interactive ? (
        <Suspense fallback={<GlobePlaceholder className="h-full w-full" />}>
          <MapView className="h-full w-full" />
        </Suspense>
      ) : (
        <StaticMap className="h-full w-full" />
      )}

      <button
        onClick={() => setMapMode(interactive ? 'compatibility' : 'interactive')}
        title={
          interactive
            ? 'Map blank? Switch to the GPU-free compatibility renderer.'
            : 'Switch to the WebGL interactive map (smooth vector zoom).'
        }
        className="absolute bottom-2 left-2 z-20 rounded-md border border-base-700/60 bg-base-900/85 px-2 py-1 text-[11px] text-slate-300 backdrop-blur hover:text-slate-100"
      >
        {interactive ? '⚙ Compatibility mode' : '◎ Interactive map'}
      </button>
    </div>
  )
}
