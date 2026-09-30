import { PageHeader } from '@/components/PageHeader'
import { RegionMap } from '@/components/RegionMap'
import { WeatherPanel } from '@/components/WeatherPanel'
import { AlertsPanel } from '@/components/AlertsPanel'
import { StormPanel } from '@/components/StormPanel'
import { StatusBadge } from '@/components/Badge'
import { useAppStore } from '@/stores/useAppStore'
import { LAYERS } from '@/services/mock/layers'

// Layers now backed by a real adapter.
const LIVE_LAYERS = new Set(['weather', 'flights', 'storms'])

export function WorldViewPage() {
  const { regionId, layerVisibility, toggleLayer } = useAppStore()

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="World View"
        description="Interactive map with toggleable live-world data layers. Weather and tropical systems are live NOAA feeds; remaining layers are mock-first."
      />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_19rem]">
        <RegionMap className="min-h-[24rem]" />

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <StormPanel />
          <WeatherPanel regionId={regionId} />
          <AlertsPanel regionId={regionId} />

          <div className="rounded-xl border border-base-700/60 bg-base-850/60 p-3">
            <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Layers
            </div>
            <ul className="space-y-1">
              {LAYERS.map((l) => {
                const on = layerVisibility[l.id]
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => toggleLayer(l.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                        on ? 'bg-signal/10 text-slate-100' : 'text-slate-400 hover:bg-base-800/60'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${on ? 'bg-signal' : 'bg-base-600'}`} />
                        {l.name}
                      </span>
                      <StatusBadge status={LIVE_LAYERS.has(l.id) ? 'live' : l.status} />
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 px-1 text-[11px] text-slate-500">
              Toggle <span className="text-slate-300">Infrastructure</span> to plot ports, bridges,
              hospitals, and facilities.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
