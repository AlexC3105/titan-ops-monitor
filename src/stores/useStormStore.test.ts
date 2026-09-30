import { beforeEach, describe, expect, it } from 'vitest'
import { useStormStore } from './useStormStore'
import nhc from '../../test/fixtures/nhc-current-storms.json'
import geometry from '../../test/fixtures/worker-storm-geometry-al082026.json'
import { normalizeStorms } from '../../worker/src/nhc'
import { jsonResponse, stubFetch } from '../../test/fetchStub'

const storms = normalizeStorms(nhc.activeStorms)
const body = (list = storms) => ({ count: list.length, storms: list })

beforeEach(() => {
  useStormStore.setState(useStormStore.getInitialState(), true)
})

/** Route /v1/storms to `list()` and geometry requests to the recorded geometry. */
function routes(list: () => unknown = () => body()) {
  return stubFetch((url) => (url.endsWith('/v1/storms') ? jsonResponse(list()) : jsonResponse(geometry)))
}
const geometryCalls = (fetch: ReturnType<typeof stubFetch>) => fetch.mock.calls.filter((c) => String(c[0]).includes('/geometry')).length

describe('useStormStore', () => {
  it('refresh loads the storm list and reports live', async () => {
    routes()
    expect(await useStormStore.getState().refresh()).toEqual({ status: 'live' })
    expect(useStormStore.getState()).toMatchObject({ status: 'live', loaded: true, loading: false })
    expect(useStormStore.getState().storms.map((s) => s.id)).toEqual(['al082026', 'ep172026'])
  })

  it('keeps the last live storm list when a later refresh fails', async () => {
    routes()
    await useStormStore.getState().refresh()
    stubFetch(() => jsonResponse({ error: 'upstream_timeout' }, 504))
    expect(await useStormStore.getState().refresh()).toEqual({ status: 'inactive' })
    expect(useStormStore.getState()).toMatchObject({ status: 'live' })
    expect(useStormStore.getState().storms).toHaveLength(2)
  })

  it('reports inactive with no storms when the feed has never succeeded', async () => {
    stubFetch(() => jsonResponse({ error: 'upstream_timeout' }, 504))
    await useStormStore.getState().refresh()
    expect(useStormStore.getState()).toMatchObject({ status: 'inactive', storms: [], loaded: true })
  })

  it('does not refetch selected geometry when the advisory is unchanged', async () => {
    const fetch = routes()
    await useStormStore.getState().refresh()
    await useStormStore.getState().select('al082026')
    await useStormStore.getState().refresh()
    await useStormStore.getState().refresh()
    expect(geometryCalls(fetch)).toBe(1)
  })

  it('refetches selected geometry when NHC issues a new advisory', async () => {
    let list = storms
    const fetch = routes(() => body(list))
    await useStormStore.getState().refresh()
    await useStormStore.getState().select('al082026')
    list = storms.map((s) => (s.id === 'al082026' ? { ...s, advisoryNumber: '009' } : s))
    await useStormStore.getState().refresh()
    expect(geometryCalls(fetch)).toBe(2)
    expect(useStormStore.getState().selectedStormId).toBe('al082026')
  })

  it('clears the selection when the selected storm is no longer active', async () => {
    let list = storms
    routes(() => body(list))
    await useStormStore.getState().refresh()
    await useStormStore.getState().select('al082026')
    list = storms.filter((s) => s.id !== 'al082026')
    await useStormStore.getState().refresh()
    expect(useStormStore.getState()).toMatchObject({ selectedStormId: null, geometry: null })
  })

  it('selecting a storm fetches its geometry; toggling again clears it', async () => {
    routes()
    await useStormStore.getState().select('al082026')
    expect(useStormStore.getState().geometry?.stormId).toBe('al082026')
    await useStormStore.getState().toggle('al082026')
    expect(useStormStore.getState()).toMatchObject({ selectedStormId: null, geometry: null })
  })

  it('ignores a late geometry response after the selection changed', async () => {
    routes()
    const first = useStormStore.getState().select('al082026')
    await useStormStore.getState().select(null)
    await first
    expect(useStormStore.getState()).toMatchObject({ selectedStormId: null, geometry: null })
  })
})
