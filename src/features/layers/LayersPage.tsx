import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/Badge'
import { useAppStore } from '@/stores/useAppStore'
import { LAYERS } from '@/services/mock/layers'

const CATEGORY_LABEL: Record<string, string> = {
  environment: 'Environment',
  transport: 'Transport',
  population: 'Population',
  utilities: 'Utilities',
  infrastructure: 'Infrastructure',
  events: 'Events',
}

export function LayersPage() {
  const { layerVisibility, toggleLayer, resetLayers } = useAppStore()
  const grouped = LAYERS.reduce<Record<string, typeof LAYERS>>((acc, l) => {
    ;(acc[l.category] ??= []).push(l)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <PageHeader
        title="Layers"
        description="Manage which data layers render in World View. Each layer maps to a modular adapter that a real feed can replace."
        actions={
          <button
            onClick={resetLayers}
            className="rounded-lg border border-base-700/60 bg-base-850 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100"
          >
            Reset defaults
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(grouped).map(([cat, layers]) => (
          <Panel key={cat} title={CATEGORY_LABEL[cat] ?? cat}>
            <ul className="space-y-2">
              {layers.map((l) => {
                const on = layerVisibility[l.id]
                return (
                  <li
                    key={l.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-base-700/50 bg-base-900/40 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-100">{l.name}</span>
                        <StatusBadge status={l.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{l.description}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-600">
                        {l.cadence}
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={on}
                      aria-label={`Toggle ${l.name}`}
                      onClick={() => toggleLayer(l.id)}
                      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                        on ? 'bg-signal' : 'bg-base-700'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          on ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  )
}
