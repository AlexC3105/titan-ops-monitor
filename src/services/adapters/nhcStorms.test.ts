import { describe, expect, it } from 'vitest'
import { fetchStormGeometry, nhcStormsAdapter, toStorm } from './nhcStorms'
import { apiBase } from '@/services/apiConfig'
import nhc from '../../../test/fixtures/nhc-current-storms.json'
import geometry from '../../../test/fixtures/worker-storm-geometry-al082026.json'
import { normalizeStorms } from '../../../worker/src/nhc'
import { jsonResponse, stubFetch } from '../../../test/fetchStub'

// Worker /v1/storms body for the recorded NHC fixture, built with the Worker's normaliser.
const stormsBody = { fetchedAt: '2026-09-30T09:12:51.559Z', count: 2, storms: normalizeStorms(nhc.activeStorms) }
const hanna = nhc.activeStorms[0]

describe('nhcStormsAdapter', () => {
  it('requests the Worker storms endpoint', async () => {
    const fetch = stubFetch(() => jsonResponse(stormsBody))
    await nhcStormsAdapter.fetch('')
    expect(fetch.mock.calls[0][0]).toBe(`${apiBase()}/v1/storms`)
  })

  it('maps storms with explicit units', async () => {
    stubFetch(() => jsonResponse(stormsBody))
    const res = await nhcStormsAdapter.fetch('')

    expect(res.status).toBe('live')
    expect(res.data).toHaveLength(2)
    expect(res.data?.[0]).toEqual({
      id: hanna.id,
      name: hanna.name,
      classification: hanna.classification,
      coord: [hanna.longitudeNumeric, hanna.latitudeNumeric],
      intensityKt: Number(hanna.intensity),
      pressureMb: Number(hanna.pressure),
      movementDirDeg: hanna.movementDir,
      movementSpeedMph: hanna.movementSpeed,
      lastUpdate: hanna.lastUpdate,
      advisoryNumber: hanna.publicAdvisory.advNum,
    })
  })

  it('treats an empty list as live with no storms', async () => {
    stubFetch(() => jsonResponse({ ...stormsBody, count: 0, storms: [] }))
    const res = await nhcStormsAdapter.fetch('')
    expect(res).toMatchObject({ status: 'live', data: [] })
  })

  it('drops malformed storm entries', () => {
    expect(toStorm({ id: 'x' })).toBeNull()
    expect(toStorm(null)).toBeNull()
    expect(toStorm({ id: 'x', lon: 1, lat: 2 })).toMatchObject({ id: 'x', name: 'x', intensityKt: null })
  })

  it.each([
    ['a Worker error', () => jsonResponse({ error: 'upstream_timeout' }, 504)],
    ['a malformed body', () => jsonResponse({ nope: true })],
  ])('reports inactive with no data (never mock storms) on %s', async (_n, route) => {
    stubFetch(route)
    const res = await nhcStormsAdapter.fetch('')
    expect(res).toMatchObject({ status: 'inactive', data: null })
  })
})

describe('fetchStormGeometry', () => {
  it('returns the official track and cone for a storm', async () => {
    const fetch = stubFetch(() => jsonResponse(geometry))
    const g = await fetchStormGeometry('al082026')

    expect(fetch.mock.calls[0][0]).toBe(`${apiBase()}/v1/storms/al082026/geometry`)
    expect(g?.advisoryNumber).toBe('008')
    expect(g?.track?.features.length).toBe(8)
    expect(g?.cone?.features[0].geometry.type).toBe('Polygon')
  })

  it('passes through product_unavailable with null geometry', async () => {
    stubFetch(() => jsonResponse({ stormId: 'al082026', advisoryNumber: '008', issuance: null, track: null, cone: null, reason: 'product_unavailable' }))
    const g = await fetchStormGeometry('al082026')
    expect(g).toMatchObject({ track: null, cone: null, reason: 'product_unavailable' })
  })

  it('returns null for a response about another storm or an error', async () => {
    stubFetch(() => jsonResponse(geometry))
    expect(await fetchStormGeometry('ep152026')).toBeNull()
    stubFetch(() => jsonResponse({ error: 'unknown_storm' }, 404))
    expect(await fetchStormGeometry('al082026')).toBeNull()
  })
})
