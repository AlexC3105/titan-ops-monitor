import { useState } from 'react'
import type { ReactNode } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { ProbabilityCard } from '@/components/ProbabilityCard'
import { ConfidenceBadge } from '@/components/Badge'
import { EVENT_TYPES } from '@/services/scenarioEngine'
import { REGIONS } from '@/services/mock/regions'
import { useAppStore } from '@/stores/useAppStore'
import { useScenarioStore } from '@/stores/useScenarioStore'
import type { ScenarioResult, Severity, TimeHorizon } from '@/types'

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: 1, label: '1 · Minimal' },
  { value: 2, label: '2 · Minor' },
  { value: 3, label: '3 · Moderate' },
  { value: 4, label: '4 · Major' },
  { value: 5, label: '5 · Extreme' },
]
const HORIZONS: TimeHorizon[] = ['24h', '72h', '7d', '14d', '30d']

export function ScenariosPage() {
  const regionId = useAppStore((s) => s.regionId)
  const run = useScenarioStore((s) => s.run)

  const [eventType, setEventType] = useState(EVENT_TYPES[0].id)
  const [severity, setSeverity] = useState<Severity>(4)
  const [horizon, setHorizon] = useState<TimeHorizon>('72h')
  const [assumptions, setAssumptions] = useState('')
  const [result, setResult] = useState<ScenarioResult | null>(null)

  function onRun() {
    setResult(run({ regionId, eventType, severity, horizon, assumptions }))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Scenarios"
        description="Ask “what happens if…”. Outputs are probabilistic planning signals from a heuristic model — never guaranteed predictions."
      />

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <Panel title="Scenario inputs">
          <div className="space-y-4">
            <Field label="Event type">
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-lg border border-base-700/60 bg-base-900 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-signal/60"
              >
                {EVENT_TYPES.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={`Severity · ${SEVERITIES[severity - 1].label.split('· ')[1]}`}>
              <input
                type="range"
                min={1}
                max={5}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value) as Severity)}
                className="w-full accent-signal"
              />
            </Field>

            <Field label="Time horizon">
              <div className="flex flex-wrap gap-1.5">
                {HORIZONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                      horizon === h
                        ? 'border-signal/60 bg-signal/10 text-signal'
                        : 'border-base-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Assumptions (optional)">
              <textarea
                value={assumptions}
                onChange={(e) => setAssumptions(e.target.value)}
                rows={3}
                placeholder="e.g. mandatory evacuation order issued early"
                className="w-full resize-none rounded-lg border border-base-700/60 bg-base-900 px-2.5 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-signal/60"
              />
            </Field>

            <button
              onClick={onRun}
              className="w-full rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-base-950 transition-colors hover:bg-signal-muted"
            >
              Run scenario
            </button>
            <p className="text-center text-[11px] text-slate-500">
              Region: {REGIONS.find((r) => r.id === regionId)?.name}
            </p>
          </div>
        </Panel>

        <div>
          {result ? (
            <ScenarioOutput result={result} />
          ) : (
            <Panel title="Probable outcomes">
              <div className="flex h-64 flex-col items-center justify-center text-center text-sm text-slate-500">
                <p className="max-w-sm">
                  Configure a scenario and run it to see probability bands, confidence, primary
                  drivers, and data gaps.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

function ScenarioOutput({ result }: { result: ScenarioResult }) {
  return (
    <div className="space-y-4">
      <Panel
        title={result.eventLabel}
        subtitle={result.regionName}
        actions={<ConfidenceBadge value={result.confidence} />}
      >
        <p className="mb-4 text-sm leading-relaxed text-slate-300">{result.narrative}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {result.outcomes.map((o) => (
            <ProbabilityCard key={o.id} outcome={o} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Primary drivers">
          <ul className="flex flex-wrap gap-1.5">
            {result.drivers.map((d) => (
              <li
                key={d}
                className="rounded-md border border-base-700/60 bg-base-900/40 px-2 py-1 text-xs text-slate-300"
              >
                {d}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Data gaps" subtitle="Lower these to raise confidence">
          <ul className="space-y-1.5 text-sm text-slate-300">
            {result.dataGaps.map((g) => (
              <li key={g} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-confidence-medium" />
                {g}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  )
}
