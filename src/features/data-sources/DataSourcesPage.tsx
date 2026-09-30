import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/Badge'
import { DATA_SOURCES } from '@/services/mock/dataSources'
import type { FeedStatus } from '@/types'

const ORDER: FeedStatus[] = ['live', 'mock', 'planned', 'inactive']

export function DataSourcesPage() {
  const counts = DATA_SOURCES.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Sources"
        description="Catalog of feeds powering the world model. Status reflects integration state — every source is mock-first until a real adapter is wired in."
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
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-base-700/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-4 font-medium">Source</th>
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium">Cadence</th>
              <th className="py-2 pr-4 font-medium">Status</th>
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
                <td className="py-2.5 text-xs text-slate-500">{d.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
