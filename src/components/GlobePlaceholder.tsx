import { useAppStore } from '@/stores/useAppStore'
import { LAYERS } from '@/services/mock/layers'
import { REGIONS } from '@/services/mock/regions'

/**
 * Map/globe PLACEHOLDER. Phase 0 renders a graticule + active region marker and
 * active-layer chips. In Phase 1 this component is replaced by a MapLibre GL /
 * Deck.gl canvas without changing its props.
 */
export function GlobePlaceholder({ className = '' }: { className?: string }) {
  const { regionId, layerVisibility } = useAppStore()
  const region = REGIONS.find((r) => r.id === regionId) ?? REGIONS[0]
  const activeLayers = LAYERS.filter((l) => layerVisibility[l.id])

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-base-700/60 bg-base-950 ${className}`}
    >
      {/* Graticule */}
      <svg className="absolute inset-0 h-full w-full text-base-700/50" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Center marker */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <span className="relative flex h-4 w-4 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal/60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-signal" />
        </span>
        <div className="mt-3 font-mono text-xs text-slate-300">{region.name}</div>
        <div className="font-mono text-[10px] text-slate-500">
          {region.center[1].toFixed(2)}°, {region.center[0].toFixed(2)}°
        </div>
      </div>

      {/* Layer chips */}
      <div className="absolute left-3 top-3 flex max-w-[70%] flex-wrap gap-1.5">
        {activeLayers.length === 0 ? (
          <span className="rounded-md bg-base-900/80 px-2 py-1 text-[11px] text-slate-500">
            No active layers
          </span>
        ) : (
          activeLayers.map((l) => (
            <span
              key={l.id}
              className="rounded-md border border-base-700/60 bg-base-900/80 px-2 py-1 text-[11px] text-slate-300"
            >
              {l.name}
            </span>
          ))
        )}
      </div>

      {/* Caption */}
      <div className="absolute bottom-3 right-3 rounded-md bg-base-900/80 px-2 py-1 text-[10px] text-slate-500">
        Map unavailable · loading or WebGL not supported
      </div>
    </div>
  )
}
