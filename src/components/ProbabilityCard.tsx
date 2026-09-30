import type { Outcome } from '@/types'
import { probabilityTone } from '@/utils/format'

export function ProbabilityCard({ outcome }: { outcome: Outcome }) {
  const tone = probabilityTone(outcome.probability)
  const barColor =
    outcome.probability >= 66
      ? 'bg-confidence-high'
      : outcome.probability >= 40
        ? 'bg-confidence-medium'
        : 'bg-confidence-low'

  return (
    <div className="rounded-lg border border-base-700/60 bg-base-900/40 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-slate-200">{outcome.label}</span>
        <span className={`font-mono text-lg font-semibold tabular-nums ${tone}`}>
          {outcome.probability}%
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-base-700/50">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${outcome.probability}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className="capitalize">{outcome.affectedSystem}</span>
        <span>{outcome.timeframe}</span>
      </div>
    </div>
  )
}
