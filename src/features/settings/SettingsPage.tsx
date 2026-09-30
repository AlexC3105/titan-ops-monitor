import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { useAppStore } from '@/stores/useAppStore'
import { useScenarioStore } from '@/stores/useScenarioStore'
import { REGIONS } from '@/services/mock/regions'

export function SettingsPage() {
  const { regionId, setRegion, resetLayers, mapMode, setMapMode } = useAppStore()
  const clearScenarios = useScenarioStore((s) => s.clear)

  function resetAll() {
    resetLayers()
    clearScenarios()
    localStorage.removeItem('titan.app')
    localStorage.removeItem('titan.scenarios')
    location.reload()
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Application preferences for this device." />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Default region">
          <select
            value={regionId}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full rounded-lg border border-base-700/60 bg-base-900 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-signal/60"
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Two Florida regions are available; more regions are planned.
          </p>
        </Panel>

        <Panel title="Appearance">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">Theme</span>
            <span className="rounded-md border border-base-700/60 bg-base-900 px-2.5 py-1 text-xs text-slate-400">
              Dark (default)
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Light mode and density options are planned. TITAN is dark-mode first.
          </p>
        </Panel>

        <Panel title="Map rendering">
          <div className="flex gap-2">
            {(['compatibility', 'interactive'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMapMode(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs ${
                  mapMode === m
                    ? 'border-signal/60 bg-signal/10 text-signal'
                    : 'border-base-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'compatibility' ? 'Compatibility (no GPU)' : 'Interactive (WebGL)'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Compatibility renders the map from raster tiles + markers and works on any device.
            Interactive uses MapLibre/WebGL for smooth vector zoom (requires WebGL support).
          </p>
        </Panel>

        <Panel title="Install">
          <p className="text-sm text-slate-300">
            TITAN is an installable PWA. Use your browser’s “Install app” / “Add to Home Screen”
            action to run it as a standalone app with an offline shell.
          </p>
        </Panel>

        <Panel title="Data & privacy">
          <p className="text-sm text-slate-300">
            All scenarios and preferences are stored locally in this browser. No personal or
            individual-level data is collected or modeled.
          </p>
          <button
            onClick={resetAll}
            className="mt-3 rounded-lg border border-confidence-low/40 bg-confidence-low/10 px-3 py-1.5 text-xs text-confidence-low hover:bg-confidence-low/20"
          >
            Reset all local data
          </button>
        </Panel>
      </div>
    </div>
  )
}
