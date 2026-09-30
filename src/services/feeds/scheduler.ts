import type { FeedStatus } from '@/types'
import { backoffDelay, emptyRecord, type FeedConfig, type FeedId, type FeedRecord } from './health'

// One scheduler for all live feeds: per-feed intervals, no overlapping requests,
// bounded exponential backoff, pause while the tab is hidden or the browser is
// offline, and staggered catch-up when it comes back (no request stampede).

export interface FeedRunResult {
  status: FeedStatus
  error?: string
}

export interface FeedDefinition {
  config: FeedConfig
  /** Fetch and store the feed's data; report the source status of the result. */
  run: () => Promise<FeedRunResult>
  /** Feeds that are switched off (e.g. map layer hidden) are not scheduled. */
  enabled?: () => boolean
}

export interface SchedulerEnv {
  now: () => number
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
  isVisible: () => boolean
  isOnline: () => boolean
  onVisibilityChange: (cb: () => void) => () => void
  onOnlineChange: (cb: () => void) => () => void
}

export function browserEnv(): SchedulerEnv {
  return {
    now: () => Date.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
    isVisible: () => document.visibilityState !== 'hidden',
    isOnline: () => navigator.onLine !== false,
    onVisibilityChange: (cb) => {
      document.addEventListener('visibilitychange', cb)
      return () => document.removeEventListener('visibilitychange', cb)
    },
    onOnlineChange: (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
  }
}

/** Gap between feeds that become due at the same moment (resume, reconnect). */
export const STAGGER_MS = 300

export class FeedScheduler {
  private readonly feeds = new Map<FeedId, FeedDefinition>()
  private readonly records = new Map<FeedId, FeedRecord>()
  private readonly timers = new Map<FeedId, unknown>()
  private readonly running = new Map<FeedId, Promise<void>>()
  /** Bumped by reset(); results from an older generation are discarded. */
  private readonly generation = new Map<FeedId, number>()
  private unsubscribe: (() => void)[] = []
  private started = false

  constructor(
    defs: FeedDefinition[],
    private readonly env: SchedulerEnv,
    private readonly onChange: (records: FeedRecord[], online: boolean) => void = () => {},
  ) {
    for (const d of defs) {
      this.feeds.set(d.config.id, d)
      this.records.set(d.config.id, emptyRecord(d.config.id))
      this.generation.set(d.config.id, 0)
    }
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.unsubscribe = [
      this.env.onVisibilityChange(() => this.resumeOrPause()),
      this.env.onOnlineChange(() => this.resumeOrPause()),
    ]
    this.resumeOrPause()
  }

  stop(): void {
    this.started = false
    this.unsubscribe.forEach((u) => u())
    this.unsubscribe = []
    for (const id of this.feeds.keys()) this.clearTimer(id)
  }

  snapshot(): FeedRecord[] {
    return [...this.records.values()].map((r) => ({ ...r }))
  }

  online(): boolean {
    return this.env.isOnline()
  }

  /** Run a feed now (manual refresh). Joins an in-flight request instead of duplicating it. */
  refreshNow(id: FeedId): Promise<void> {
    const inFlight = this.running.get(id)
    if (inFlight) return inFlight
    const def = this.feeds.get(id)
    if (!def || !this.isEnabled(def) || !this.env.isOnline()) return Promise.resolve()
    this.clearTimer(id)
    return this.run(id)
  }

  /** Forget a feed's state (e.g. region changed) and refetch it. */
  reset(id: FeedId): Promise<void> {
    this.generation.set(id, (this.generation.get(id) ?? 0) + 1)
    this.clearTimer(id)
    this.records.set(id, { ...emptyRecord(id), inFlight: this.running.has(id) })
    this.emit()
    return this.running.get(id) ?? this.refreshNow(id)
  }

  /** Re-evaluate enabled() for every feed (call after toggling a layer). */
  sync(): void {
    for (const [id, def] of this.feeds) {
      const rec = this.records.get(id)!
      const enabled = this.isEnabled(def)
      if (!enabled && !rec.disabled) {
        this.clearTimer(id)
        this.records.set(id, { ...emptyRecord(id), disabled: true })
        this.generation.set(id, (this.generation.get(id) ?? 0) + 1)
      } else if (enabled && rec.disabled) {
        this.records.set(id, emptyRecord(id))
        if (this.canSchedule()) void this.refreshNow(id)
      }
    }
    this.emit()
  }

  private isEnabled(def: FeedDefinition): boolean {
    return def.enabled ? def.enabled() : true
  }

  private canSchedule(): boolean {
    return this.started && this.env.isVisible() && this.env.isOnline()
  }

  private clearTimer(id: FeedId): void {
    const t = this.timers.get(id)
    if (t !== undefined) this.env.clearTimeout(t)
    this.timers.delete(id)
  }

  private schedule(id: FeedId, delayMs: number): void {
    this.clearTimer(id)
    const rec = this.records.get(id)!
    rec.nextRefreshAt = this.env.now() + delayMs
    if (!this.canSchedule()) return
    this.timers.set(
      id,
      this.env.setTimeout(() => {
        this.timers.delete(id)
        void this.refreshNow(id)
      }, delayMs),
    )
  }

  /** Hidden or offline → stop timers. Visible and online → run due feeds, staggered. */
  private resumeOrPause(): void {
    if (!this.canSchedule()) {
      for (const id of this.feeds.keys()) this.clearTimer(id)
      this.emit()
      return
    }
    const now = this.env.now()
    let due = 0
    for (const [id, def] of this.feeds) {
      if (!this.isEnabled(def)) {
        this.records.get(id)!.disabled = true
        continue
      }
      if (this.running.has(id)) continue
      const next = this.records.get(id)!.nextRefreshAt
      if (next === null || next <= now) this.schedule(id, due++ * STAGGER_MS)
      else this.schedule(id, next - now)
    }
    this.emit()
  }

  private run(id: FeedId): Promise<void> {
    const def = this.feeds.get(id)!
    const gen = this.generation.get(id)
    const started = this.env.now()
    const rec = this.records.get(id)!
    rec.inFlight = true
    rec.lastAttemptAt = started
    rec.nextRefreshAt = null
    this.emit()

    const p = (async () => {
      let result: FeedRunResult
      try {
        result = await def.run()
      } catch (err) {
        result = { status: 'inactive', error: err instanceof Error ? err.message : 'request failed' }
      }
      this.running.delete(id)
      if (this.generation.get(id) !== gen) {
        // Reset while in flight: discard this result and fetch again.
        this.records.get(id)!.inFlight = false
        if (!this.records.get(id)!.disabled) void this.refreshNow(id)
        return
      }
      const r = this.records.get(id)!
      const now = this.env.now()
      r.inFlight = false
      r.latencyMs = now - started
      r.sourceStatus = result.status
      if (result.status === 'live') {
        r.lastLiveAt = now
        r.consecutiveFailures = 0
        r.lastError = null
        this.schedule(id, def.config.intervalMs)
      } else {
        r.consecutiveFailures += 1
        r.lastError = result.error ?? (result.status === 'mock' ? 'Upstream unavailable; using fallback data' : 'Feed unavailable')
        this.schedule(id, backoffDelay(r.consecutiveFailures, def.config))
      }
      this.emit()
    })()
    this.running.set(id, p)
    return p
  }

  private emit(): void {
    this.onChange(this.snapshot(), this.env.isOnline())
  }
}
