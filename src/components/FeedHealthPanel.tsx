import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/Badge'
import { useNow } from '@/hooks/useNow'
import { useFeedStore } from '@/stores/useFeedStore'
import { FEED_CONFIGS, refreshFeed } from '@/services/feeds/runtime'
import { HEALTH_LABEL, ago, healthState, type FeedHealthState, type FeedId } from '@/services/feeds/health'

// Local operational visibility for TITAN's live feeds. Nothing leaves the browser.

const TONE: Record<FeedHealthState, string> = {
  healthy: 'text-confidence-high',
  refreshing: 'text-signal',
  degraded: 'text-confidence-medium',
  stale: 'text-confidence-medium',
  unavailable: 'text-slate-400',
  paused: 'text-slate-500',
}

export const FEED_ORDER: FeedId[] = ['nws-forecast', 'nws-alerts', 'nhc-storms', 'flights']

export function HealthChip({ state }: { state: FeedHealthState }) {
  return <span className={`text-xs font-medium ${TONE[state]}`}>{HEALTH_LABEL[state]}</span>
}

export function RefreshButton({ id, disabled }: { id: FeedId; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => void refreshFeed(id)}
      disabled={disabled}
      title="Refresh now"
      aria-label={`Refresh ${FEED_CONFIGS[id].label}`}
      className="rounded px-1.5 text-xs text-slate-400 hover:bg-base-800 hover:text-slate-200 disabled:opacity-40"
    >
      ↻
    </button>
  )
}

export function FeedHealthPanel() {
  const now = useNow()
  const { records, online } = useFeedStore()

  return (
    <Panel title="Feed health" subtitle={online ? 'Auto-refresh on' : 'Offline — refresh paused'}>
      <ul className="space-y-2">
        {FEED_ORDER.map((id) => {
          const r = records[id]
          const state = healthState(r, FEED_CONFIGS[id], now)
          return (
            <li key={id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="truncate text-slate-200">{FEED_CONFIGS[id].label}</div>
                <div className="text-[11px] text-slate-500">
                  {state === 'paused' ? 'Layer off' : `Live data ${ago(r.lastLiveAt, now)}`}
                  {r.latencyMs !== null && state !== 'paused' ? ` · ${r.latencyMs} ms` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.sourceStatus && state !== 'paused' && <StatusBadge status={r.sourceStatus} />}
                <HealthChip state={state} />
                <RefreshButton id={id} disabled={!online || r.inFlight || r.disabled} />
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
