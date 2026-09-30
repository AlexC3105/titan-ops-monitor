import type { Confidence, FeedStatus } from '@/types'

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function percent(n: number): string {
  return `${Math.round(n)}%`
}

/** Tailwind text color for a confidence/probability value. */
export function probabilityTone(p: number): string {
  if (p >= 66) return 'text-confidence-high'
  if (p >= 40) return 'text-confidence-medium'
  return 'text-confidence-low'
}

export function confidenceTone(c: Confidence): string {
  return c === 'high'
    ? 'text-confidence-high'
    : c === 'medium'
      ? 'text-confidence-medium'
      : 'text-confidence-low'
}

export function statusTone(s: FeedStatus): string {
  switch (s) {
    case 'live':
      return 'text-confidence-high'
    case 'mock':
      return 'text-signal'
    case 'planned':
      return 'text-confidence-medium'
    case 'inactive':
      return 'text-slate-500'
  }
}

export function statusLabel(s: FeedStatus): string {
  return { live: 'Live', mock: 'Mock', planned: 'Planned', inactive: 'Inactive' }[s]
}
