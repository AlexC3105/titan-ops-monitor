import { Panel } from '@/components/Panel'
import { StatusBadge } from '@/components/Badge'
import { useStorms } from '@/hooks/useStorms'
import { classificationLabel, formatMovement, formatPosition } from '@/services/stormGeometry'
import type { Storm } from '@/types'

// Active tropical systems from NOAA / NHC. Shows only fields NHC publishes, with
// units as published (wind in knots, pressure in mb, motion in mph).

const CONE_NOTE =
  'The NHC cone represents the probable track area of the tropical cyclone center; it does not represent the storm’s total size or all hazardous impacts.'

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-slate-200">{value ?? '—'}</dd>
    </div>
  )
}

function StormDetails({ storm }: { storm: Storm }) {
  const { geometry, geometryLoading } = useStorms()
  const forecast =
    geometry?.stormId !== storm.id
      ? null
      : geometry.track || geometry.cone
        ? `Advisory ${geometry.advisoryNumber ?? '—'}${geometry.issuance ? ` · ${geometry.issuance}` : ''}`
        : 'No forecast track/cone published'

  return (
    <div className="mt-2 rounded-lg border border-base-700/60 bg-base-900/60 p-3 text-xs">
      <div className="mb-1 text-sm font-semibold text-slate-100">
        {classificationLabel(storm.classification)} {storm.name}
      </div>
      <dl>
        <Row label="Classification (NHC)" value={storm.classification || null} />
        <Row label="Position" value={formatPosition(storm.coord)} />
        <Row label="Max sustained wind" value={storm.intensityKt !== null ? `${storm.intensityKt} kt` : null} />
        <Row label="Min pressure" value={storm.pressureMb !== null ? `${storm.pressureMb} mb` : null} />
        <Row label="Movement" value={formatMovement(storm.movementDirDeg, storm.movementSpeedMph)} />
        <Row label="Advisory" value={storm.advisoryNumber} />
        <Row label="Last update" value={storm.lastUpdate ? new Date(storm.lastUpdate).toUTCString().replace(' GMT', ' UTC') : null} />
        <Row label="Forecast" value={geometryLoading ? 'Loading…' : forecast ?? 'Unavailable'} />
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-slate-400">{CONE_NOTE}</p>
    </div>
  )
}

export function StormPanel() {
  const { storms, status, loading, selectedStormId, toggle } = useStorms()
  const selected = storms.find((s) => s.id === selectedStormId) ?? null

  return (
    <Panel
      title="Tropical systems"
      subtitle="NOAA / National Hurricane Center"
      actions={
        !loading && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{storms.length}</span>
            <StatusBadge status={status} />
          </div>
        )
      }
    >
      {loading ? (
        <div className="flex h-12 items-center justify-center text-sm text-slate-500">Checking NHC…</div>
      ) : status !== 'live' ? (
        <div className="flex h-12 items-center justify-center text-sm text-slate-500">Storm feed unavailable.</div>
      ) : storms.length === 0 ? (
        <div className="flex h-12 items-center justify-center text-sm text-slate-500">No active tropical systems.</div>
      ) : (
        <ul className="space-y-1">
          {storms.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => void toggle(s.id)}
                aria-pressed={s.id === selectedStormId}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${
                  s.id === selectedStormId ? 'bg-signal/10 text-slate-100' : 'text-slate-300 hover:bg-base-800/60'
                }`}
              >
                <span>
                  <span className="font-mono text-xs text-slate-400">{s.classification}</span> {s.name}
                </span>
                <span className="text-xs text-slate-500">{s.intensityKt !== null ? `${s.intensityKt} kt` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && <StormDetails storm={selected} />}
      <p className="mt-2 text-[10px] text-slate-500">
        Data: NOAA / National Hurricane Center (nhc.noaa.gov). Select a system to show its official forecast track
        and cone on the map.
      </p>
    </Panel>
  )
}
