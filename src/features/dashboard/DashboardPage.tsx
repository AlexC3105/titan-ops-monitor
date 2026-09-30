import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { RegionMap } from '@/components/RegionMap'
import { ConfidenceBadge } from '@/components/Badge'
import { Icon } from '@/components/Icon'
import { useAppStore } from '@/stores/useAppStore'
import { useScenarioStore } from '@/stores/useScenarioStore'
import { LAYERS } from '@/services/mock/layers'
import { REGIONS } from '@/services/mock/regions'
import { DATA_SOURCES } from '@/services/mock/dataSources'
import { AlertsPanel } from '@/components/AlertsPanel'
import { compactNumber } from '@/utils/format'

const SYSTEM_STATUS = [
  { id: 'ingest', label: 'Data ingestion', status: 'ok', detail: '10 sources · mock' },
  { id: 'scenario', label: 'Scenario engine', status: 'ok', detail: 'heuristic v0' },
  { id: 'prediction', label: 'Prediction engine', status: 'offline', detail: 'Phase 4' },
  { id: 'sim', label: 'Simulation engine', status: 'offline', detail: 'Phase 4+' },
] as const

const DOT = { ok: 'bg-confidence-high', degraded: 'bg-confidence-medium', offline: 'bg-slate-500' }

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-base-700/60 bg-base-900/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-100">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export function DashboardPage() {
  const { regionId, layerVisibility } = useAppStore()
  const region = REGIONS.find((r) => r.id === regionId) ?? REGIONS[0]
  const activeLayers = LAYERS.filter((l) => layerVisibility[l.id])
  const liveSources = DATA_SOURCES.filter((d) => d.status === 'live').length
  const recent = useScenarioStore((s) => s.results.slice(0, 4))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Operational overview of the active region, live layers, and recent scenario analysis."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active region" value={region.name.split(',')[0]} sub={`pop. ${compactNumber(region.population)}`} />
        <Stat label="Active layers" value={`${activeLayers.length}/${LAYERS.length}`} sub="mock feeds" />
        <Stat label="Scenarios run" value={String(useScenarioStore.getState().results.length)} sub="this device" />
        <Stat label="Data sources" value={String(DATA_SOURCES.length)} sub={`${liveSources} live`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="World View"
          subtitle={`${region.name} · ${activeLayers.length} layers active`}
          className="lg:col-span-2"
          actions={
            <Link to="/world" className="text-xs text-signal hover:underline">
              Open →
            </Link>
          }
        >
          <RegionMap className="h-72" />
        </Panel>

        <Panel title="System status">
          <ul className="space-y-3">
            {SYSTEM_STATUS.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className={`h-2 w-2 rounded-full ${DOT[s.status]}`} />
                  {s.label}
                </span>
                <span className="text-xs text-slate-500">{s.detail}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <AlertsPanel regionId={regionId} />

      <Panel
        title="Recent scenarios"
        actions={
          <Link to="/scenarios" className="inline-flex items-center gap-1 text-xs text-signal hover:underline">
            <Icon name="scenarios" className="h-4 w-4" /> New scenario
          </Link>
        }
      >
        {recent.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            No scenarios yet. Head to{' '}
            <Link to="/scenarios" className="text-signal hover:underline">
              Scenarios
            </Link>{' '}
            to ask “what happens if…”.
          </div>
        ) : (
          <ul className="divide-y divide-base-700/40">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-200">{r.eventLabel}</div>
                  <div className="truncate text-xs text-slate-500">
                    {r.regionName} · {r.outcomes.length} outcomes
                  </div>
                </div>
                <ConfidenceBadge value={r.confidence} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
