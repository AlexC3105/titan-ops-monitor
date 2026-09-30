import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedScheduler, STAGGER_MS, type FeedDefinition, type FeedRunResult, type SchedulerEnv } from './scheduler'
import type { FeedConfig, FeedId } from './health'

function fakeEnv() {
  let visible = true
  let online = true
  const vis = new Set<() => void>()
  const net = new Set<() => void>()
  const env: SchedulerEnv = {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    isVisible: () => visible,
    isOnline: () => online,
    onVisibilityChange: (cb) => (vis.add(cb), () => vis.delete(cb)),
    onOnlineChange: (cb) => (net.add(cb), () => net.delete(cb)),
  }
  return {
    env,
    setVisible(v: boolean) { visible = v; vis.forEach((cb) => cb()) },
    setOnline(v: boolean) { online = v; net.forEach((cb) => cb()) },
    listeners: () => vis.size + net.size,
  }
}

const cfg = (id: FeedId, intervalMs: number): FeedConfig => ({ id, label: id, intervalMs, retryBaseMs: 1000, maxBackoffMs: 8000 })

/** A feed whose results are scripted; each run resolves after `latencyMs`. */
function feed(id: FeedId, intervalMs: number, results: FeedRunResult['status'][] = [], latencyMs = 0) {
  const run = vi.fn(async (): Promise<FeedRunResult> => {
    if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs))
    return { status: results.length ? results.shift()! : 'live' }
  })
  const def: FeedDefinition = { config: cfg(id, intervalMs), run }
  return { def, run }
}

let sched: FeedScheduler | undefined

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-30T12:00:00Z'))
})
afterEach(() => {
  sched?.stop()
  sched = undefined
  vi.useRealTimers()
})

describe('FeedScheduler', () => {
  it('runs every feed at start (staggered) and then at its own interval', async () => {
    const a = feed('nws-alerts', 60_000)
    const b = feed('nhc-storms', 300_000)
    sched = new FeedScheduler([a.def, b.def], fakeEnv().env)
    sched.start()

    await vi.advanceTimersByTimeAsync(0)
    expect(a.run).toHaveBeenCalledTimes(1)
    expect(b.run).toHaveBeenCalledTimes(0)
    await vi.advanceTimersByTimeAsync(STAGGER_MS)
    expect(b.run).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(a.run).toHaveBeenCalledTimes(2)
    expect(b.run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(240_000)
    expect(a.run).toHaveBeenCalledTimes(6)
    expect(b.run).toHaveBeenCalledTimes(2)
  })

  it('never runs the same feed twice concurrently; manual refresh joins the in-flight request', async () => {
    const a = feed('nws-alerts', 60_000, [], 5_000)
    sched = new FeedScheduler([a.def], fakeEnv().env)
    sched.start()
    await vi.advanceTimersByTimeAsync(0)
    const p1 = sched.refreshNow('nws-alerts')
    const p2 = sched.refreshNow('nws-alerts')
    expect(a.run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5_000)
    await Promise.all([p1, p2])
    expect(sched.snapshot()[0]).toMatchObject({ inFlight: false, latencyMs: 5_000, sourceStatus: 'live' })
  })

  it('manual refresh runs immediately and restarts the interval', async () => {
    const a = feed('nws-alerts', 60_000)
    sched = new FeedScheduler([a.def], fakeEnv().env)
    sched.start()
    await vi.advanceTimersByTimeAsync(30_000)
    await sched.refreshNow('nws-alerts')
    expect(a.run).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(a.run).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(a.run).toHaveBeenCalledTimes(3)
  })

  it('backs off exponentially on non-live results, caps the delay, and resets on success', async () => {
    const a = feed('flights', 30_000, ['mock', 'mock', 'mock', 'mock', 'mock', 'live'])
    sched = new FeedScheduler([a.def], fakeEnv().env)
    sched.start()
    await vi.advanceTimersByTimeAsync(0) // run 1 → mock, retry in 1 s
    const delays: number[] = []
    for (let i = 0; i < 5; i++) {
      const rec = sched.snapshot()[0]
      delays.push(rec.nextRefreshAt! - Date.now())
      await vi.advanceTimersByTimeAsync(rec.nextRefreshAt! - Date.now())
    }
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 8_000])
    expect(sched.snapshot()[0]).toMatchObject({ consecutiveFailures: 0, sourceStatus: 'live' })
    expect(sched.snapshot()[0].nextRefreshAt! - Date.now()).toBe(30_000)
  })

  it('records a thrown run as an unavailable result with its error', async () => {
    const def: FeedDefinition = { config: cfg('nhc-storms', 300_000), run: vi.fn().mockRejectedValue(new Error('boom')) }
    sched = new FeedScheduler([def], fakeEnv().env)
    sched.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(sched.snapshot()[0]).toMatchObject({ sourceStatus: 'inactive', consecutiveFailures: 1, lastError: 'boom' })
  })

  it('pauses while the tab is hidden and catches up on due feeds when visible again', async () => {
    const f = fakeEnv()
    const a = feed('nws-alerts', 60_000)
    const b = feed('nhc-storms', 300_000)
    sched = new FeedScheduler([a.def, b.def], f.env)
    sched.start()
    await vi.advanceTimersByTimeAsync(STAGGER_MS)
    f.setVisible(false)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(a.run).toHaveBeenCalledTimes(1)
    expect(b.run).toHaveBeenCalledTimes(1)

    f.setVisible(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(a.run).toHaveBeenCalledTimes(2)
    expect(b.run).toHaveBeenCalledTimes(1) // staggered, not simultaneous
    await vi.advanceTimersByTimeAsync(STAGGER_MS)
    expect(b.run).toHaveBeenCalledTimes(2)
  })

  it('on becoming visible, waits for feeds that are not yet due', async () => {
    const f = fakeEnv()
    const b = feed('nhc-storms', 300_000)
    sched = new FeedScheduler([b.def], f.env)
    sched.start()
    await vi.advanceTimersByTimeAsync(0)
    f.setVisible(false)
    await vi.advanceTimersByTimeAsync(60_000)
    f.setVisible(true)
    await vi.advanceTimersByTimeAsync(239_999)
    expect(b.run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(b.run).toHaveBeenCalledTimes(2)
  })

  it('stops retrying while offline and resumes with a staggered refresh when back online', async () => {
    const f = fakeEnv()
    const a = feed('nws-alerts', 60_000, ['mock', 'mock', 'mock', 'mock'])
    const b = feed('nhc-storms', 300_000)
    sched = new FeedScheduler([a.def, b.def], f.env)
    sched.start()
    await vi.advanceTimersByTimeAsync(STAGGER_MS)
    f.setOnline(false)
    await vi.advanceTimersByTimeAsync(20 * 60_000)
    expect(a.run).toHaveBeenCalledTimes(1)
    await sched.refreshNow('nws-alerts') // manual refresh is ignored offline
    expect(a.run).toHaveBeenCalledTimes(1)

    f.setOnline(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(a.run).toHaveBeenCalledTimes(2)
    expect(b.run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(STAGGER_MS)
    expect(b.run).toHaveBeenCalledTimes(2)
  })

  it('does not schedule disabled feeds and starts them when enabled', async () => {
    let on = false
    const fl = feed('flights', 30_000)
    sched = new FeedScheduler([{ ...fl.def, enabled: () => on }], fakeEnv().env)
    sched.start()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fl.run).not.toHaveBeenCalled()
    expect(sched.snapshot()[0].disabled).toBe(true)

    on = true
    sched.sync()
    await vi.advanceTimersByTimeAsync(0)
    expect(fl.run).toHaveBeenCalledTimes(1)
    on = false
    sched.sync()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fl.run).toHaveBeenCalledTimes(1)
  })

  it('reset discards an in-flight result from before the reset and refetches', async () => {
    const results: FeedRunResult['status'][] = ['mock', 'live']
    const a = feed('nws-forecast', 900_000, results, 1_000)
    sched = new FeedScheduler([a.def], fakeEnv().env)
    sched.start()
    await vi.advanceTimersByTimeAsync(500) // first run in flight
    void sched.reset('nws-forecast')
    await vi.advanceTimersByTimeAsync(500) // first run finishes → discarded, second starts
    expect(sched.snapshot()[0].consecutiveFailures).toBe(0)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(a.run).toHaveBeenCalledTimes(2)
    expect(sched.snapshot()[0]).toMatchObject({ sourceStatus: 'live', consecutiveFailures: 0 })
  })

  it('stop() clears timers and listeners', async () => {
    const f = fakeEnv()
    const a = feed('nws-alerts', 60_000)
    sched = new FeedScheduler([a.def], f.env)
    sched.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(f.listeners()).toBe(2)
    sched.stop()
    expect(f.listeners()).toBe(0)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(a.run).toHaveBeenCalledTimes(1)
  })
})
