import { beforeEach, describe, expect, it } from 'vitest'
import { useStormStore } from './useStormStore'
import nhc from '../../test/fixtures/nhc-current-storms.json'
import geometry from '../../test/fixtures/worker-storm-geometry-al082026.json'
import { normalizeStorms } from '../../worker/src/nhc'
import { jsonResponse, stubFetch } from '../../test/fetchStub'

const stormsBody = { count: 2, storms: normalizeStorms(nhc.activeStorms) }

beforeEach(() => {
  useStormStore.setState(useStormStore.getInitialState(), true)
})

function routes() {
  return stubFetch((url) => (url.endsWith('/v1/storms') ? jsonResponse(stormsBody) : jsonResponse(geometry)))
}

describe('useStormStore', () => {
  it('loads the storm list once', async () => {
    const fetch = routes()
    await Promise.all([useStormStore.getState().load(), useStormStore.getState().load()])
    await useStormStore.getState().load()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(useStormStore.getState()).toMatchObject({ status: 'live', loaded: true, loading: false })
    expect(useStormStore.getState().storms.map((s) => s.id)).toEqual(['al082026', 'ep172026'])
  })

  it('selecting a storm fetches its geometry; toggling again clears it', async () => {
    routes()
    await useStormStore.getState().select('al082026')
    expect(useStormStore.getState()).toMatchObject({ selectedStormId: 'al082026', geometryLoading: false })
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

  it('records an unavailable feed as inactive with no storms', async () => {
    stubFetch(() => jsonResponse({ error: 'upstream_timeout' }, 504))
    await useStormStore.getState().load()
    expect(useStormStore.getState()).toMatchObject({ status: 'inactive', storms: [] })
  })
})
