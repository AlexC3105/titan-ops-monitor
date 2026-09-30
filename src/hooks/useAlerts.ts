import { useEffect, useState } from 'react'
import type { FeedStatus, WeatherAlert } from '@/types'
import { nwsAlertsAdapter } from '@/services/adapters/nwsAlerts'

interface AlertsState {
  alerts: WeatherAlert[]
  status: FeedStatus
  loading: boolean
}

/** Fetches active NWS alerts for a region (live → mock fallback). */
export function useAlerts(regionId: string): AlertsState {
  const [state, setState] = useState<AlertsState>({ alerts: [], status: 'mock', loading: true })

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, loading: true }))
    nwsAlertsAdapter.fetch(regionId).then((res) => {
      if (!active) return
      setState({ alerts: res.data ?? [], status: res.status, loading: false })
    })
    return () => {
      active = false
    }
  }, [regionId])

  return state
}
