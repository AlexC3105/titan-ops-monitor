import { nwsWeatherAdapter } from '@/services/adapters/nwsWeather'
import { nwsAlertsAdapter } from '@/services/adapters/nwsAlerts'
import { openSkyFlightsAdapter } from '@/services/adapters/openSkyFlights'
import { useAppStore } from '@/stores/useAppStore'
import { useFeedStore } from '@/stores/useFeedStore'
import { useStormStore } from '@/stores/useStormStore'
import type { FeedConfig, FeedId } from './health'
import { FeedScheduler, browserEnv, type FeedDefinition, type SchedulerEnv } from './scheduler'

const MIN = 60_000

/**
 * Per-feed cadence. Intervals are never shorter than the Worker cache TTL for
 * Worker-backed feeds (storms 300 s, flights 30 s), since polling faster would
 * only return the same cached response.
 */
export const FEED_CONFIGS: Record<FeedId, FeedConfig> = {
  // NWS gridpoint forecasts are issued roughly hourly.
  'nws-forecast': { id: 'nws-forecast', label: 'NWS forecast', intervalMs: 15 * MIN, retryBaseMs: 1 * MIN, maxBackoffMs: 30 * MIN },
  // Alerts can be issued at any time; NWS asks clients not to poll aggressively.
  'nws-alerts': { id: 'nws-alerts', label: 'NWS alerts', intervalMs: 3 * MIN, retryBaseMs: 1 * MIN, maxBackoffMs: 30 * MIN },
  // Matches the Worker's 300 s storm-list cache; advisories change every 3–6 h.
  'nhc-storms': { id: 'nhc-storms', label: 'NHC tropical systems', intervalMs: 5 * MIN, retryBaseMs: 1 * MIN, maxBackoffMs: 30 * MIN },
  // Matches the Worker's 30 s flights cache; only while the Flights layer is on.
  flights: { id: 'flights', label: 'Flights (OpenSky)', intervalMs: 30_000, retryBaseMs: 30_000, maxBackoffMs: 30 * MIN },
}

export const REGION_FEEDS: FeedId[] = ['nws-forecast', 'nws-alerts', 'flights']

function layerOn(id: string, fallback: boolean): boolean {
  return useAppStore.getState().layerVisibility[id] ?? fallback
}

export function feedDefinitions(): FeedDefinition[] {
  const feeds = useFeedStore.getState
  return [
    {
      config: FEED_CONFIGS['nws-forecast'],
      run: async () => {
        const regionId = useAppStore.getState().regionId
        const res = await nwsWeatherAdapter.fetch(regionId)
        feeds().applyResult('weather', { regionId, data: res.data, status: res.status })
        return { status: res.status }
      },
    },
    {
      config: FEED_CONFIGS['nws-alerts'],
      run: async () => {
        const regionId = useAppStore.getState().regionId
        const res = await nwsAlertsAdapter.fetch(regionId)
        feeds().applyResult('alerts', { regionId, data: res.data ?? [], status: res.status })
        return { status: res.status }
      },
    },
    {
      config: FEED_CONFIGS['nhc-storms'],
      enabled: () => layerOn('storms', true),
      run: () => useStormStore.getState().refresh(),
    },
    {
      config: FEED_CONFIGS.flights,
      enabled: () => layerOn('flights', false),
      run: async () => {
        const regionId = useAppStore.getState().regionId
        const res = await openSkyFlightsAdapter.fetch(regionId)
        feeds().applyResult('flights', { regionId, data: res.data ?? [], status: res.status })
        return { status: res.status }
      },
    },
  ]
}

let active: FeedScheduler | null = null

/** Start the app's feed scheduler; returns a stop function. */
export function startFeeds(env: SchedulerEnv = browserEnv()): () => void {
  const scheduler = new FeedScheduler(feedDefinitions(), env, (records, online) =>
    useFeedStore.getState().setHealth(records, online),
  )
  active = scheduler
  const unsubscribe = useAppStore.subscribe((s, prev) => {
    if (s.regionId !== prev.regionId) REGION_FEEDS.forEach((id) => void scheduler.reset(id))
    if (s.layerVisibility !== prev.layerVisibility) scheduler.sync()
  })
  scheduler.start()
  return () => {
    unsubscribe()
    scheduler.stop()
    if (active === scheduler) active = null
  }
}

/** Manual refresh from the UI. */
export function refreshFeed(id: FeedId): Promise<void> {
  return active ? active.refreshNow(id) : Promise.resolve()
}
