import type { FeedStatus, WeatherAlert } from '@/types'
import { useFeedStore } from '@/stores/useFeedStore'

interface AlertsState {
  alerts: WeatherAlert[]
  status: FeedStatus
  loading: boolean
}

/** Active NWS alerts for a region, kept fresh by the feed scheduler (live → mock fallback). */
export function useAlerts(regionId: string): AlertsState {
  const a = useFeedStore((s) => s.alerts)
  if (!a || a.regionId !== regionId) return { alerts: [], status: 'mock', loading: true }
  return { alerts: a.data, status: a.status, loading: false }
}
