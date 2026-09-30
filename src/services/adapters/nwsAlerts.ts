import type { AdapterResult, DataAdapter } from '@/services/dataAdapters'
import type { AlertSeverity, WeatherAlert } from '@/types'
import { fetchJson } from '@/services/http'

// Live NWS active-alerts feed (key-less, CORS). Queried by NWS "area" (state),
// which both current regions map to. Falls back to a mock advisory on error.

const AREA_BY_REGION: Record<string, string> = {
  'tampa-bay': 'FL',
  'fl-gulf-coast': 'FL',
}

const SEVERITIES: AlertSeverity[] = ['Extreme', 'Severe', 'Moderate', 'Minor']

function normSeverity(s: unknown): AlertSeverity {
  return SEVERITIES.includes(s as AlertSeverity) ? (s as AlertSeverity) : 'Unknown'
}

const MOCK_ALERTS: WeatherAlert[] = [
  {
    id: 'mock-coastal-flood',
    event: 'Coastal Flood Advisory',
    severity: 'Moderate',
    urgency: 'Expected',
    headline: 'Coastal Flood Advisory in effect for Tampa Bay shoreline (mock).',
    area: 'Pinellas; Hillsborough',
    expires: new Date(Date.now() + 6 * 3600_000).toISOString(),
  },
]

export const nwsAlertsAdapter: DataAdapter<WeatherAlert[]> = {
  id: 'nws-alerts',
  status: 'live',
  async fetch(regionId: string): Promise<AdapterResult<WeatherAlert[]>> {
    const area = AREA_BY_REGION[regionId] ?? 'FL'
    try {
      const data = await fetchJson(`https://api.weather.gov/alerts/active?area=${area}`, {
        accept: 'application/geo+json',
      })
      const features: any[] = Array.isArray(data?.features) ? data.features : []
      const alerts: WeatherAlert[] = features.slice(0, 20).map((f, i) => {
        const p = f?.properties ?? {}
        return {
          id: p.id ?? f?.id ?? `alert-${i}`,
          event: p.event ?? 'Alert',
          severity: normSeverity(p.severity),
          urgency: p.urgency ?? 'Unknown',
          headline: p.headline ?? p.event ?? '',
          area: p.areaDesc ?? '',
          expires: p.expires ?? '',
        }
      })
      return { sourceId: 'nws-alerts', status: 'live', fetchedAt: new Date().toISOString(), data: alerts }
    } catch {
      return { sourceId: 'nws-alerts', status: 'mock', fetchedAt: new Date().toISOString(), data: MOCK_ALERTS }
    }
  },
}
