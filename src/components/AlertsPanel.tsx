import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/Badge'
import { useAlerts } from '@/hooks/useAlerts'
import type { AlertSeverity } from '@/types'

const SEV: Record<AlertSeverity, { tone: string; dot: string }> = {
  Extreme: { tone: 'text-confidence-low', dot: 'bg-confidence-low' },
  Severe: { tone: 'text-confidence-low', dot: 'bg-confidence-low' },
  Moderate: { tone: 'text-confidence-medium', dot: 'bg-confidence-medium' },
  Minor: { tone: 'text-signal', dot: 'bg-signal' },
  Unknown: { tone: 'text-slate-400', dot: 'bg-slate-500' },
}

/** Live active-advisory list backed by the NWS alerts adapter. */
export function AlertsPanel({ regionId, max = 5 }: { regionId: string; max?: number }) {
  const { alerts, status, loading } = useAlerts(regionId)

  return (
    <Panel
      title="Active alerts"
      subtitle="NWS / NOAA"
      actions={
        !loading && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{alerts.length}</span>
            <StatusBadge status={status} />
          </div>
        )
      }
    >
      {loading ? (
        <div className="flex h-16 items-center justify-center text-sm text-slate-500">
          Checking advisories…
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex h-16 items-center justify-center text-sm text-slate-500">
          No active alerts for this region.
        </div>
      ) : (
        <ul className="divide-y divide-base-700/40">
          {alerts.slice(0, max).map((a) => {
            const sev = SEV[a.severity]
            return (
              <li key={a.id} className="flex items-start gap-2.5 py-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sev.dot}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${sev.tone}`}>{a.event}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">
                      {a.severity}
                    </span>
                  </div>
                  {a.area && <div className="truncate text-xs text-slate-500">{a.area}</div>}
                </div>
              </li>
            )
          })}
          {alerts.length > max && (
            <li className="pt-2 text-xs text-slate-500">+{alerts.length - max} more…</li>
          )}
        </ul>
      )}
    </Panel>
  )
}
