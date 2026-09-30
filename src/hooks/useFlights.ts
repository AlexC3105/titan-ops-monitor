import { useEffect, useState } from 'react'
import type { FeedStatus, Flight } from '@/types'
import { openSkyFlightsAdapter } from '@/services/adapters/openSkyFlights'

interface FlightsState {
  flights: Flight[]
  status: FeedStatus
  loading: boolean
}

const EMPTY: FlightsState = { flights: [], status: 'mock', loading: false }

/** Fetches live flights only while `enabled` (the Flights layer is on). */
export function useFlights(regionId: string, enabled: boolean): FlightsState {
  const [state, setState] = useState<FlightsState>(EMPTY)

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY)
      return
    }
    let active = true
    setState((s) => ({ ...s, loading: true }))
    openSkyFlightsAdapter.fetch(regionId).then((res) => {
      if (!active) return
      setState({ flights: res.data ?? [], status: res.status, loading: false })
    })
    return () => {
      active = false
    }
  }, [regionId, enabled])

  return state
}
