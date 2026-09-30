import type { FeedStatus, WeatherSnapshot } from '@/types'
import { useFeedStore } from '@/stores/useFeedStore'

interface WeatherState {
  snapshot: WeatherSnapshot | null
  status: FeedStatus
  loading: boolean
}

/** Current conditions for a region, kept fresh by the feed scheduler (live → mock fallback). */
export function useWeather(regionId: string): WeatherState {
  const w = useFeedStore((s) => s.weather)
  if (!w || w.regionId !== regionId) return { snapshot: null, status: 'mock', loading: true }
  return { snapshot: w.data, status: w.status, loading: false }
}
