import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/Badge'
import { useWeather } from '@/hooks/useWeather'

/** Live current-conditions card backed by the NWS adapter. */
export function WeatherPanel({ regionId }: { regionId: string }) {
  const { snapshot, status, loading } = useWeather(regionId)

  return (
    <Panel
      title="Current conditions"
      subtitle="NWS / NOAA"
      actions={!loading && <StatusBadge status={status} />}
    >
      {loading || !snapshot ? (
        <div className="flex h-24 items-center justify-center text-sm text-slate-500">
          {loading ? 'Fetching live conditions…' : 'Unavailable'}
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-3xl font-semibold tabular-nums text-slate-100">
                {Math.round(snapshot.temperature)}°{snapshot.temperatureUnit}
              </div>
              <div className="mt-0.5 text-sm text-slate-300">{snapshot.shortForecast}</div>
              <div className="mt-0.5 text-xs text-slate-500">{snapshot.locationName}</div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div className="uppercase tracking-wider text-slate-500">Wind</div>
              <div className="text-sm text-slate-200">
                {snapshot.windSpeed} {snapshot.windDirection}
              </div>
            </div>
          </div>
          {status === 'mock' && (
            <p className="mt-3 rounded-md border border-base-700/50 bg-base-900/40 px-2 py-1.5 text-[11px] text-slate-500">
              Live feed unavailable — showing mock snapshot.
            </p>
          )}
        </div>
      )}
    </Panel>
  )
}
