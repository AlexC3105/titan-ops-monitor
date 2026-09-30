import type { AdapterResult, DataAdapter } from '@/services/dataAdapters'
import type { WeatherSnapshot } from '@/types'
import { getRegion } from '@/services/mock/regions'

// ─────────────────────────────────────────────────────────────────────────────
// NWS / NOAA weather adapter — the first REAL data feed (Phase 1).
//
// Live flow (https://api.weather.gov, no API key, CORS-enabled):
//   1. GET /points/{lat},{lon}      → forecast URL + relative location
//   2. GET {forecast}               → periods[0] = current/next period
// Falls back to a mock snapshot on any error/timeout so the UI degrades
// gracefully (status flips to 'mock'). Implements the shared DataAdapter<T>.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK: Record<string, Omit<WeatherSnapshot, 'observedAt'>> = {
  'tampa-bay': {
    locationName: 'Tampa, FL',
    temperature: 86,
    temperatureUnit: 'F',
    windSpeed: '9 mph',
    windDirection: 'SE',
    shortForecast: 'Partly sunny, isolated storms',
  },
  'fl-gulf-coast': {
    locationName: 'St. Petersburg, FL',
    temperature: 84,
    temperatureUnit: 'F',
    windSpeed: '11 mph',
    windDirection: 'SW',
    shortForecast: 'Scattered showers',
  },
}

function mockFor(regionId: string): WeatherSnapshot {
  const base = MOCK[regionId] ?? MOCK['tampa-bay']
  return { ...base, observedAt: new Date().toISOString() }
}

async function fetchJson(url: string, timeoutMs = 7000): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/geo+json' },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`NWS ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

export const nwsWeatherAdapter: DataAdapter<WeatherSnapshot> = {
  id: 'nws',
  status: 'live',
  async fetch(regionId: string): Promise<AdapterResult<WeatherSnapshot>> {
    const region = getRegion(regionId)
    const [lon, lat] = region.center
    try {
      const points = await fetchJson(
        `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      )
      const forecastUrl: string = points?.properties?.forecast
      if (!forecastUrl) throw new Error('No forecast URL')

      const loc = points?.properties?.relativeLocation?.properties
      const forecast = await fetchJson(forecastUrl)
      const p = forecast?.properties?.periods?.[0]
      if (!p) throw new Error('No forecast period')

      const snapshot: WeatherSnapshot = {
        locationName: loc?.city ? `${loc.city}, ${loc.state}` : region.name,
        temperature: p.temperature,
        temperatureUnit: p.temperatureUnit === 'C' ? 'C' : 'F',
        windSpeed: p.windSpeed ?? '—',
        windDirection: p.windDirection ?? '',
        shortForecast: p.shortForecast ?? '—',
        observedAt: p.startTime ?? new Date().toISOString(),
      }
      return { sourceId: 'nws', status: 'live', fetchedAt: new Date().toISOString(), data: snapshot }
    } catch {
      return { sourceId: 'nws', status: 'mock', fetchedAt: new Date().toISOString(), data: mockFor(regionId) }
    }
  },
}
