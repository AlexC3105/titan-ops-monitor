import type { Confidence, FeedStatus } from '@/types'
import { confidenceTone, statusLabel, statusTone } from '@/utils/format'

const DOT: Record<FeedStatus, string> = {
  live: 'bg-confidence-high',
  mock: 'bg-signal',
  planned: 'bg-confidence-medium',
  inactive: 'bg-slate-500',
}

export function StatusBadge({ status }: { status: FeedStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-base-700/60 bg-base-900/60 px-2 py-0.5 text-[11px] font-medium">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      <span className={statusTone(status)}>{statusLabel(status)}</span>
    </span>
  )
}

export function ConfidenceBadge({ value }: { value: Confidence }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-base-700/60 bg-base-900/60 px-2 py-0.5 text-[11px] font-medium capitalize ${confidenceTone(value)}`}
    >
      {value} confidence
    </span>
  )
}
