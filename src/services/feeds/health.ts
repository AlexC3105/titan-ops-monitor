import type { FeedStatus } from '@/types'

// Feed health: how a feed is *operating*, kept separate from the data's source
// status (live / mock / inactive). A mock fallback is never "healthy".

export type FeedId = 'nws-forecast' | 'nws-alerts' | 'nhc-storms' | 'flights'

export type FeedHealthState = 'healthy' | 'refreshing' | 'degraded' | 'stale' | 'unavailable' | 'paused'

export interface FeedConfig {
  id: FeedId
  label: string
  /** Normal refresh interval after a live result. */
  intervalMs: number
  /** First retry delay after a non-live result; doubles per consecutive failure. */
  retryBaseMs: number
  /** Upper bound for any retry delay. */
  maxBackoffMs: number
}

/** Data older than this many refresh intervals is stale. */
export const STALE_AFTER_INTERVALS = 3

export interface FeedRecord {
  id: FeedId
  /** Source status of the most recent result. */
  sourceStatus: FeedStatus | null
  inFlight: boolean
  lastAttemptAt: number | null
  /** Last result that carried live upstream data. */
  lastLiveAt: number | null
  latencyMs: number | null
  consecutiveFailures: number
  nextRefreshAt: number | null
  lastError: string | null
  /** Paused because the feed is disabled (e.g. its map layer is off). */
  disabled: boolean
}

export function emptyRecord(id: FeedId): FeedRecord {
  return {
    id,
    sourceStatus: null,
    inFlight: false,
    lastAttemptAt: null,
    lastLiveAt: null,
    latencyMs: null,
    consecutiveFailures: 0,
    nextRefreshAt: null,
    lastError: null,
    disabled: false,
  }
}

/**
 * Delay before retrying after `failures` consecutive non-live results:
 * retryBase × 2^(failures−1), capped at maxBackoff. Deterministic (no jitter);
 * simultaneous resumes are staggered by the scheduler instead.
 */
export function backoffDelay(failures: number, cfg: Pick<FeedConfig, 'retryBaseMs' | 'maxBackoffMs'>): number {
  if (failures <= 0) return 0
  return Math.min(cfg.maxBackoffMs, cfg.retryBaseMs * 2 ** Math.min(failures - 1, 30))
}

export function staleAfterMs(cfg: Pick<FeedConfig, 'intervalMs'>): number {
  return cfg.intervalMs * STALE_AFTER_INTERVALS
}

/**
 * - paused:      feed disabled (layer off)
 * - refreshing:  a request is in flight
 * - unavailable: no live data yet and the source is inactive / failed with nothing to show
 * - degraded:    showing fallback (mock) data, or last attempt failed while live data is still fresh
 * - stale:       the newest live data is older than STALE_AFTER_INTERVALS × interval
 * - healthy:     fresh live data and the last attempt succeeded
 */
export function healthState(r: FeedRecord, cfg: FeedConfig, now: number): FeedHealthState {
  if (r.disabled) return 'paused'
  if (r.inFlight) return 'refreshing'
  if (r.lastAttemptAt === null) return 'refreshing'
  if (r.lastLiveAt === null) return r.sourceStatus === 'mock' ? 'degraded' : 'unavailable'
  if (now - r.lastLiveAt > staleAfterMs(cfg)) return 'stale'
  return r.consecutiveFailures > 0 ? 'degraded' : 'healthy'
}

export const HEALTH_LABEL: Record<FeedHealthState, string> = {
  healthy: 'Healthy',
  refreshing: 'Refreshing',
  degraded: 'Degraded',
  stale: 'Stale',
  unavailable: 'Unavailable',
  paused: 'Paused',
}

/** Compact relative time: "just now", "45 s ago", "12 min ago", "3 h ago". */
export function ago(ts: number | null, now: number): string {
  if (ts === null) return '—'
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s} s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  return `${Math.round(m / 60)} h ago`
}
