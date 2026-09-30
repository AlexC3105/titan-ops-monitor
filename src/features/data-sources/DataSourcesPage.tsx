import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/Badge'
import { DATA_SOURCES } from '@/services/mock/dataSources'
import type { FeedStatus } from '@/types'
import { useNow } from '@/hooks/useNow'
import { useFeedStore } from '@/stores/useFeedStore'
import { FEED_CONFIGS } from '@/services/feeds/runtime'
import { ago, backoffDelay, healthState, staleAfterMs, type FeedId, type FeedRecord } from '@/services/feeds/health'
import { HealthChip, RefreshButton } from '@/components/FeedHealthPanel'

/** Catalog entries backed by a scheduled live feed. */
const FEED_FOR_SOURCE: Record<string, FeedId> = {
  nws: 'nws-forecast',
  'nws-alerts': 'nws-alerts',
  nhc: 'nhc-storms',
  opensky: 'flights',
}

function minutes(ms: number): string {
  return ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`
}

const ORDER: FeedStatus[] = ['live', 'mock', 'planned', 'inactive']

export function DataSourcesPage() {
  const now = useNow()
  const { records, online } = useFeedStore()
  const counts = DATA_SOURCES.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Sources"
        description="Catalog of data sources. Status is the integration state; live feeds also show their current runtime health (refreshed automatically, paused while the tab is hidden or offline)."
      />

      <div className="flex flex-wrap gap-2">
        {ORDER.map((s) => (
          <div
            key={s}
            className="flex items-center gap-2 rounded-lg border border-base-700/60 bg-base-850/60 px-3 py-1.5 text-sm"
          >
            <StatusBadge status={s} />
            <span className="text-slate-300">{counts[s] ?? 0}</span>
          </div>
        ))}
      </div>

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-base-700/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-4 font-medium">Source</th>
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium">Cadence</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Runtime health</th>
              <th className="py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-700/40">
            {DATA_SOURCES.map((d) => (
              <tr key={d.id} className="text-slate-300">
                <td className="py-2.5 pr-4">
                  <div className="font-medium text-slate-100">{d.name}</div>
                  <div className="text-[11px] text-slate-500">{d.provider}</div>
                </td>
                <td className="py-2.5 pr-4 capitalize text-slate-400">{d.category}</td>
                <td className="py-2.5 pr-4 capitalize text-slate-400">{d.cadence}</td>
                <td className="py-2.5 pr-4">
                  <StatusBadge status={d.status} />
                </td>
                <td className="py-2.5 pr-4 text-xs">
                  {FEED_FOR_SOURCE[d.id] ? (
                    <FeedHealthCell id={FEED_FOR_SOURCE[d.id]} now={now} online={online} record={records[FEED_FOR_SOURCE[d.id]]} />
                  ) : (
                    <span className="text-slate-600">Not scheduled</span>
                  )}
                </td>
                <td className="py-2.5 text-xs text-slate-500">{d.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

function FeedHealthCell({ id, record: r, now, online }: { id: FeedId; record: FeedRecord; now: number; online: boolean }) {
  const cfg = FEED_CONFIGS[id]
  const state = healthState(r, cfg, now)
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <HealthChip state={state} />
        {r.sourceStatus && state !== 'paused' && <span className="text-slate-500">serving {r.sourceStatus}</span>}
        <RefreshButton id={id} disabled={!online || r.inFlight || r.disabled} />
      </div>
      {state === 'paused' ? (
        <div className="text-slate-500">Paused — layer off</div>
      ) : (
        <>
          <div className="text-slate-500">
            Live data {ago(r.lastLiveAt, now)} · attempt {ago(r.lastAttemptAt, now)}
            {r.latencyMs !== null ? ` · ${r.latencyMs} ms` : ''}
          </div>
          <div className="text-slate-500">
            Every {minutes(cfg.intervalMs)} · stale after {minutes(staleAfterMs(cfg))}
            {r.consecutiveFailures > 0
              ? ` · ${r.consecutiveFailures} failed, next retry ≤ ${minutes(backoffDelay(r.consecutiveFailures, cfg))}`
              : ''}
          </div>
          {r.lastError && <div className="text-slate-400">{r.lastError}</div>}
        </>
      )}
    </div>
  )
}
