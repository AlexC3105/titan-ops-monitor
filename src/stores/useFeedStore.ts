import { create } from 'zustand'
import type { FeedStatus, Flight, WeatherAlert, WeatherSnapshot } from '@/types'
import { emptyRecord, type FeedId, type FeedRecord } from '@/services/feeds/health'

// Latest data and operational health for the scheduled feeds.
//
// Retention rule: a non-live result (mock fallback / unavailable) never replaces
// live data already held for the same region. The last real observation stays
// visible and the feed's health shows it as degraded or stale instead.

export interface FeedData<T> {
  regionId: string
  data: T
  status: FeedStatus
}

type DataKey = 'weather' | 'alerts' | 'flights'

interface FeedState {
  records: Record<FeedId, FeedRecord>
  online: boolean
  weather: FeedData<WeatherSnapshot | null> | null
  alerts: FeedData<WeatherAlert[]> | null
  flights: FeedData<Flight[]> | null
  setHealth: (records: FeedRecord[], online: boolean) => void
  /** Store a result, applying the retention rule. */
  applyResult: <K extends DataKey>(key: K, next: NonNullable<FeedState[K]>) => void
}

const IDS: FeedId[] = ['nws-forecast', 'nws-alerts', 'nhc-storms', 'flights']

export const useFeedStore = create<FeedState>()((set, get) => ({
  records: Object.fromEntries(IDS.map((id) => [id, emptyRecord(id)])) as Record<FeedId, FeedRecord>,
  online: true,
  weather: null,
  alerts: null,
  flights: null,

  setHealth: (records, online) =>
    set({ records: { ...get().records, ...Object.fromEntries(records.map((r) => [r.id, r])) }, online }),

  applyResult: (key, next) => {
    const prev = get()[key]
    const keepPrevious = next.status !== 'live' && prev?.status === 'live' && prev.regionId === next.regionId
    if (!keepPrevious) set({ [key]: next } as Partial<FeedState>)
  },
}))
