// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useScenarioStore } from './useScenarioStore'
import type { ScenarioInput } from '@/types'

const input: ScenarioInput = {
  regionId: 'tampa-bay',
  eventType: 'fuel-shortage',
  severity: 2,
  horizon: '24h',
  assumptions: '',
}

beforeEach(() => {
  localStorage.clear()
  useScenarioStore.setState(useScenarioStore.getInitialState(), true)
})

describe('useScenarioStore', () => {
  it('adds new results to the front of the history and persists them', () => {
    const first = useScenarioStore.getState().run(input)
    const second = useScenarioStore.getState().run({ ...input, severity: 4 })

    expect(useScenarioStore.getState().results.map((r) => r.id)).toEqual([second.id, first.id])
    const saved = JSON.parse(localStorage.getItem('titan.scenarios') ?? 'null')?.state
    expect(saved.results).toHaveLength(2)
  })

  it('keeps only the 50 most recent results', () => {
    for (let i = 0; i < 55; i++) useScenarioStore.getState().run(input)
    expect(useScenarioStore.getState().results).toHaveLength(50)
  })

  it('removes a single result and clears all results', () => {
    const a = useScenarioStore.getState().run(input)
    const b = useScenarioStore.getState().run(input)

    useScenarioStore.getState().remove(a.id)
    expect(useScenarioStore.getState().results.map((r) => r.id)).toEqual([b.id])
    useScenarioStore.getState().clear()
    expect(useScenarioStore.getState().results).toEqual([])
  })
})
