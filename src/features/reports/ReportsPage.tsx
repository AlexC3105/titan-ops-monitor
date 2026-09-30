import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { ProbabilityCard } from '@/components/ProbabilityCard'
import { ConfidenceBadge } from '@/components/Badge'
import { useScenarioStore } from '@/stores/useScenarioStore'

export function ReportsPage() {
  const { results, remove, clear } = useScenarioStore()
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Saved scenario analyses on this device. Every report is a probabilistic snapshot, not a forecast of record."
        actions={
          results.length > 0 && (
            <button
              onClick={clear}
              className="rounded-lg border border-base-700/60 bg-base-850 px-3 py-1.5 text-xs text-slate-300 hover:text-confidence-low"
            >
              Clear all
            </button>
          )
        }
      />

      {results.length === 0 ? (
        <Panel>
          <div className="py-10 text-center text-sm text-slate-500">
            No saved reports yet. Run a scenario to generate one.
          </div>
        </Panel>
      ) : (
        <div className="space-y-3">
          {results.map((r) => {
            const open = openId === r.id
            const top = r.outcomes[0]
            return (
              <Panel key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => setOpenId(open ? null : r.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100">{r.eventLabel}</span>
                      <ConfidenceBadge value={r.confidence} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {r.regionName} · sev {r.input.severity} · {r.input.horizon}
                      {top && ` · top: ${top.label} (${top.probability}%)`}
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-600">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                    <button
                      onClick={() => remove(r.id)}
                      className="text-xs text-slate-500 hover:text-confidence-low"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="mt-4 space-y-4 border-t border-base-700/50 pt-4">
                    <p className="text-sm leading-relaxed text-slate-300">{r.narrative}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {r.outcomes.map((o) => (
                        <ProbabilityCard key={o.id} outcome={o} />
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}
