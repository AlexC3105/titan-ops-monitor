import { describe, expect, it } from 'vitest'
import { backoffDelay, emptyRecord, healthState, staleAfterMs, type FeedConfig, type FeedRecord } from './health'

const cfg: FeedConfig = { id: 'nws-alerts', label: 'NWS alerts', intervalMs: 180_000, retryBaseMs: 60_000, maxBackoffMs: 1_800_000 }
const NOW = 10_000_000
const rec = (over: Partial<FeedRecord>): FeedRecord => ({ ...emptyRecord('nws-alerts'), lastAttemptAt: NOW - 1000, ...over })

describe('backoffDelay', () => {
  it('doubles from the retry base and caps at the maximum', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 99].map((f) => backoffDelay(f, cfg))).toEqual([
      0, 60_000, 120_000, 240_000, 480_000, 960_000, 1_800_000, 1_800_000,
    ])
  })
})

describe('healthState', () => {
  it('is healthy with fresh live data and no failures', () => {
    expect(healthState(rec({ sourceStatus: 'live', lastLiveAt: NOW - 1000 }), cfg, NOW)).toBe('healthy')
  })

  it('is degraded when serving mock fallback data, never healthy', () => {
    expect(healthState(rec({ sourceStatus: 'mock', consecutiveFailures: 1 }), cfg, NOW)).toBe('degraded')
  })

  it('is degraded when the last attempt failed but live data is still fresh', () => {
    expect(healthState(rec({ sourceStatus: 'mock', lastLiveAt: NOW - 60_000, consecutiveFailures: 1 }), cfg, NOW)).toBe('degraded')
  })

  it(`is stale once live data is older than 3 intervals (${staleAfterMs(cfg) / 60_000} min here)`, () => {
    expect(healthState(rec({ sourceStatus: 'mock', lastLiveAt: NOW - staleAfterMs(cfg), consecutiveFailures: 3 }), cfg, NOW)).toBe('degraded')
    expect(healthState(rec({ sourceStatus: 'mock', lastLiveAt: NOW - staleAfterMs(cfg) - 1, consecutiveFailures: 3 }), cfg, NOW)).toBe('stale')
  })

  it('is unavailable with no data at all', () => {
    expect(healthState(rec({ sourceStatus: 'inactive', consecutiveFailures: 1 }), cfg, NOW)).toBe('unavailable')
  })

  it('is refreshing before the first result or while a request is in flight, and paused when disabled', () => {
    expect(healthState(emptyRecord('nws-alerts'), cfg, NOW)).toBe('refreshing')
    expect(healthState(rec({ inFlight: true, lastLiveAt: NOW }), cfg, NOW)).toBe('refreshing')
    expect(healthState({ ...emptyRecord('nws-alerts'), disabled: true }, cfg, NOW)).toBe('paused')
  })
})
