import { useAppStore } from '@/stores/useAppStore'
import { REGIONS } from '@/services/mock/regions'
import { Icon } from '@/components/Icon'
import { compactNumber } from '@/utils/format'

export function TopBar() {
  const { regionId, setRegion, toggleSidebar } = useAppStore()
  const region = REGIONS.find((r) => r.id === regionId) ?? REGIONS[0]

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-base-700/60 bg-base-900/70 px-4 backdrop-blur">
      <button
        onClick={toggleSidebar}
        className="rounded-lg p-2 text-slate-400 hover:bg-base-800/60 hover:text-slate-100"
        aria-label="Toggle sidebar"
      >
        <Icon name="menu" />
      </button>

      <div className="flex items-center gap-2 text-slate-300">
        <Icon name="pin" className="h-4 w-4 text-signal" />
        <label htmlFor="region" className="sr-only">
          Active region
        </label>
        <select
          id="region"
          value={regionId}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-lg border border-base-700/60 bg-base-850 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-signal/60"
        >
          {REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <span className="hidden text-xs text-slate-500 sm:inline">
          pop. {compactNumber(region.population)}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-base-700/60 bg-base-900/60 px-2.5 py-1 text-[11px] text-slate-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-confidence-high" />
          Systems nominal
        </span>
      </div>
    </header>
  )
}
