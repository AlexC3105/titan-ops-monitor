import { afterEach, describe, expect, it, vi } from 'vitest'
import { nwsAlertsAdapter } from './nwsAlerts'
import alerts from '../../../test/fixtures/nws-alerts.json'
import { jsonResponse, stubFetch, stubHangingFetch } from '../../../test/fetchStub'

afterEach(() => {
  vi.useRealTimers()
})

describe('nwsAlertsAdapter', () => {
  it('declares itself a live source', () => {
    expect(nwsAlertsAdapter.id).toBe('nws-alerts')
    expect(nwsAlertsAdapter.status).toBe('live')
  })

  it('maps a recorded GeoJSON response into live alerts', async () => {
    const fetch = stubFetch(() => jsonResponse(alerts))
    const res = await nwsAlertsAdapter.fetch('tampa-bay')

    expect(res.status).toBe('live')
    expect(res.data).toHaveLength(alerts.features.length)
    const first = alerts.features[0].properties
    expect(res.data?.[0]).toEqual({
      id: first.id,
      event: first.event,
      severity: first.severity,
      urgency: first.urgency,
      headline: first.headline,
      area: first.areaDesc,
      expires: first.expires,
    })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.weather.gov/alerts/active?area=FL')
    expect(init?.headers).toEqual({ Accept: 'application/geo+json' })
  })

  it('normalises unrecognised severities to Unknown', async () => {
    const odd = { features: [{ properties: { id: 'x', event: 'Test', severity: 'Catastrophic' } }] }
    stubFetch(() => jsonResponse(odd))
    const res = await nwsAlertsAdapter.fetch('tampa-bay')

    expect(res.data?.[0].severity).toBe('Unknown')
  })

  it('caps the feed at 20 alerts', async () => {
    const many = {
      features: Array.from({ length: 25 }, (_, i) => ({
        properties: { ...alerts.features[0].properties, id: `a-${i}` },
      })),
    }
    stubFetch(() => jsonResponse(many))
    const res = await nwsAlertsAdapter.fetch('tampa-bay')

    expect(res.data).toHaveLength(20)
  })

  it('treats a response without features as live with no alerts', async () => {
    stubFetch(() => jsonResponse({ type: 'FeatureCollection' }))
    const res = await nwsAlertsAdapter.fetch('tampa-bay')

    expect(res.status).toBe('live')
    expect(res.data).toEqual([])
  })

  it('falls back to a labelled mock advisory on an HTTP error', async () => {
    stubFetch(() => jsonResponse({}, 500))
    const res = await nwsAlertsAdapter.fetch('tampa-bay')

    expect(res.status).toBe('mock')
    expect(res.data?.map((a) => a.id)).toEqual(['mock-coastal-flood'])
  })

  it('times out after 7s and falls back to mock', async () => {
    vi.useFakeTimers()
    stubHangingFetch()
    const pending = nwsAlertsAdapter.fetch('tampa-bay')
    await vi.advanceTimersByTimeAsync(7000)

    expect((await pending).status).toBe('mock')
  })
})
