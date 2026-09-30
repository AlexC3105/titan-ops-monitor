import type { FeedStatus, Flight } from '@/types'
import { useFeedStore } from '@/stores/useFeedStore'

interface FlightsState {
  flights: Flight[]
  status: FeedStatus
  loading: boolean
}

const EMPTY: FlightsState = { flights: [], status: 'mock', loading: false }

/** Flights for a region while the Flights layer is on (the scheduler only polls then). */
export function useFlights(regionId: string, enabled: boolean): FlightsState {
  const f = useFeedStore((s) => s.flights)
  if (!enabled) return EMPTY
  if (!f || f.regionId !== regionId) return { ...EMPTY, loading: true }
  return { flights: f.data, status: f.status, loading: false }
}
