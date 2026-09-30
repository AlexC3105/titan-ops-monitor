import { useEffect, useState } from 'react'
import type { FeedStatus, WeatherSnapshot } from '@/types'
import { nwsWeatherAdapter } from '@/services/adapters/nwsWeather'

interface WeatherState {
  snapshot: WeatherSnapshot | null
  status: FeedStatus
  loading: boolean
}

/** Fetches current conditions for a region via the NWS adapter (live → mock fallback). */
export function useWeather(regionId: string): WeatherState {
  const [state, setState] = useState<WeatherState>({
    snapshot: null,
    status: 'mock',
    loading: true,
  })

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, loading: true }))
    nwsWeatherAdapter.fetch(regionId).then((res) => {
      if (!active) return
      setState({ snapshot: res.data, status: res.status, loading: false })
    })
    return () => {
      active = false
    }
  }, [regionId])

  return state
}
