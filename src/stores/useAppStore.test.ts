// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './useAppStore'
import { LAYERS } from '@/services/mock/layers'

function persisted() {
  return JSON.parse(localStorage.getItem('titan.app') ?? 'null')?.state
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState(), true)
})

describe('useAppStore', () => {
  it('starts on the default region with the GPU-free map and default layers', () => {
    const s = useAppStore.getState()
    expect(s.regionId).toBe('tampa-bay')
    expect(s.mapMode).toBe('compatibility')
    expect(s.layerVisibility).toEqual(Object.fromEntries(LAYERS.map((l) => [l.id, l.enabledByDefault])))
  })

  it('toggles, sets and resets layer visibility', () => {
    const id = LAYERS[0].id
    const initial = useAppStore.getState().layerVisibility[id]

    useAppStore.getState().toggleLayer(id)
    expect(useAppStore.getState().layerVisibility[id]).toBe(!initial)
    useAppStore.getState().setLayer(id, true)
    expect(useAppStore.getState().layerVisibility[id]).toBe(true)
    useAppStore.getState().resetLayers()
    expect(useAppStore.getState().layerVisibility[id]).toBe(initial)
  })

  it('persists region and map mode to localStorage', () => {
    useAppStore.getState().setRegion('fl-gulf-coast')
    useAppStore.getState().setMapMode('interactive')

    expect(persisted()).toMatchObject({ regionId: 'fl-gulf-coast', mapMode: 'interactive' })
  })

  it('rehydrates saved settings on reload', async () => {
    localStorage.setItem(
      'titan.app',
      JSON.stringify({ state: { regionId: 'fl-gulf-coast', mapMode: 'interactive' }, version: 0 }),
    )
    await useAppStore.persist.rehydrate()

    expect(useAppStore.getState().regionId).toBe('fl-gulf-coast')
    expect(useAppStore.getState().mapMode).toBe('interactive')
  })
})
