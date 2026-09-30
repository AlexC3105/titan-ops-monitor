import { afterEach, describe, expect, it, vi } from 'vitest'
import { nwsWeatherAdapter } from './nwsWeather'
import points from '../../../test/fixtures/nws-points.json'
import forecast from '../../../test/fixtures/nws-forecast.json'
import { jsonResponse, stubFetch, stubHangingFetch } from '../../../test/fetchStub'

const FORECAST_URL = points.properties.forecast
const period = forecast.properties.periods[0]

function stubNws(overrides: { points?: unknown; forecast?: unknown; status?: number } = {}) {
  return stubFetch((url) => {
    if (overrides.status) return jsonResponse({}, overrides.status)
    if (url.includes('/points/')) return jsonResponse(overrides.points ?? points)
    if (url === FORECAST_URL) return jsonResponse(overrides.forecast ?? forecast)
    throw new Error(`unexpected url ${url}`)
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('nwsWeatherAdapter', () => {
  it('declares itself a live source', () => {
    expect(nwsWeatherAdapter.id).toBe('nws')
    expect(nwsWeatherAdapter.status).toBe('live')
  })

  it('parses a recorded points → forecast response into a live snapshot', async () => {
    const fetch = stubNws()
    const res = await nwsWeatherAdapter.fetch('tampa-bay')

    expect(res.status).toBe('live')
    expect(res.sourceId).toBe('nws')
    expect(res.data).toEqual({
      locationName: `${points.properties.relativeLocation.properties.city}, ${points.properties.relativeLocation.properties.state}`,
      temperature: period.temperature,
      temperatureUnit: period.temperatureUnit,
      windSpeed: period.windSpeed,
      windDirection: period.windDirection,
      shortForecast: period.shortForecast,
      observedAt: period.startTime,
    })
    // Region center is [lon, lat]; NWS wants lat,lon with 4 decimals.
    expect(fetch.mock.calls[0][0]).toBe('https://api.weather.gov/points/27.9506,-82.4572')
    expect(fetch.mock.calls[1][0]).toBe(FORECAST_URL)
  })

  it('falls back to mock data on an HTTP error', async () => {
    stubNws({ status: 503 })
    const res = await nwsWeatherAdapter.fetch('tampa-bay')

    expect(res.status).toBe('mock')
    expect(res.data?.locationName).toBe('Tampa, FL')
  })

  it('falls back to mock when the points response has no forecast URL', async () => {
    stubNws({ points: { properties: {} } })
    const res = await nwsWeatherAdapter.fetch('fl-gulf-coast')

    expect(res.status).toBe('mock')
    expect(res.data?.locationName).toBe('St. Petersburg, FL')
  })

  it('falls back to mock when the forecast has no periods', async () => {
    stubNws({ forecast: { properties: { periods: [] } } })
    const res = await nwsWeatherAdapter.fetch('tampa-bay')

    expect(res.status).toBe('mock')
  })

  it('times out after 7s and falls back to mock', async () => {
    vi.useFakeTimers()
    stubHangingFetch()
    const pending = nwsWeatherAdapter.fetch('tampa-bay')
    await vi.advanceTimersByTimeAsync(7000)
    const res = await pending

    expect(res.status).toBe('mock')
  })

  it('uses the default region for an unknown region id', async () => {
    const fetch = stubNws()
    await nwsWeatherAdapter.fetch('nowhere')

    expect(fetch.mock.calls[0][0]).toBe('https://api.weather.gov/points/27.9506,-82.4572')
  })
})
