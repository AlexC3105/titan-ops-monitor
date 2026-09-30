// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startFeeds, FEED_CONFIGS } from './runtime'
import type { SchedulerEnv } from './scheduler'
import { useAppStore } from '@/stores/useAppStore'
import { useFeedStore } from '@/stores/useFeedStore'
import { useStormStore } from '@/stores/useStormStore'
import { jsonResponse, stubFetch } from '../../../test/fetchStub'
import alerts from '../../../test/fixtures/nws-alerts.json'
import points from '../../../test/fixtures/nws-points.json'
import forecast from '../../../test/fixtures/nws-forecast.json'
import nhc from '../../../test/fixtures/nhc-current-storms.json'
import { normalizeStorms } from '../../../worker/src/nhc'

const env: SchedulerEnv = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  isVisible: () => true,
  isOnline: () => true,
  onVisibilityChange: () => () => {},
  onOnlineChange: () => () => {},
}

function routes() {
  return stubFetch((url) => {
    if (url.includes('/points/')) return jsonResponse(points)
    if (url === points.properties.forecast) return jsonResponse(forecast)
    if (url.includes('/alerts/active')) return jsonResponse(alerts)
    if (url.endsWith('/v1/storms')) return jsonResponse({ count: 2, storms: normalizeStorms(nhc.activeStorms) })
    return jsonResponse({}, 404)
  })
}
const calls = (fetch: ReturnType<typeof stubFetch>, part: string) => fetch.mock.calls.filter((c) => String(c[0]).includes(part)).length

let stop: (() => void) | undefined

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState(), true)
  useFeedStore.setState(useFeedStore.getInitialState(), true)
  useStormStore.setState(useStormStore.getInitialState(), true)
})
afterEach(() => {
  stop?.()
  vi.useRealTimers()
})

describe('feed runtime', () => {
  it('fetches every enabled feed at start and records health and data', async () => {
    const fetch = routes()
    stop = startFeeds(env)
    await vi.advanceTimersByTimeAsync(1_000)

    const { records, weather, alerts: a } = useFeedStore.getState()
    expect(records['nws-forecast']).toMatchObject({ sourceStatus: 'live', consecutiveFailures: 0 })
    expect(records['nws-alerts'].sourceStatus).toBe('live')
    expect(records['nhc-storms'].sourceStatus).toBe('live')
    expect(records.flights.disabled).toBe(true) // Flights layer is off by default
    expect(weather?.status).toBe('live')
    expect(a?.data.length).toBeGreaterThan(0)
    expect(useStormStore.getState().storms).toHaveLength(2)
    expect(calls(fetch, '/v1/flights')).toBe(0)
  })

  it('refreshes alerts on their own cadence', async () => {
    const fetch = routes()
    stop = startFeeds(env)
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(FEED_CONFIGS['nws-alerts'].intervalMs)
    expect(calls(fetch, '/alerts/active')).toBe(2)
    expect(calls(fetch, '/v1/storms')).toBe(1)
  })

  it('refetches region feeds immediately when the region changes', async () => {
    const fetch = routes()
    stop = startFeeds(env)
    await vi.advanceTimersByTimeAsync(1_000)
    useAppStore.getState().setRegion('fl-gulf-coast')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(calls(fetch, '/alerts/active')).toBe(2)
    expect(useFeedStore.getState().weather?.regionId).toBe('fl-gulf-coast')
  })

  it('starts polling flights when the Flights layer is switched on', async () => {
    const fetch = routes()
    stop = startFeeds(env)
    await vi.advanceTimersByTimeAsync(1_000)
    useAppStore.getState().setLayer('flights', true)
    await vi.advanceTimersByTimeAsync(0)
    expect(calls(fetch, 'flights') + calls(fetch, '/osky/')).toBe(1)
    expect(useFeedStore.getState().records.flights.disabled).toBe(false)
  })
})
