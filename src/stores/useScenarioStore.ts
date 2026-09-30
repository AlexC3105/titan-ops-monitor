import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ScenarioInput, ScenarioResult } from '@/types'
import { evaluateScenario } from '@/services/scenarioEngine'

interface ScenarioState {
  results: ScenarioResult[]
  run: (input: ScenarioInput) => ScenarioResult
  remove: (id: string) => void
  clear: () => void
}

// Scenario history / saved reports. Persisted to localStorage as the Phase 0
// stand-in for a backend reports store.
export const useScenarioStore = create<ScenarioState>()(
  persist(
    (set) => ({
      results: [],
      run: (input) => {
        const result = evaluateScenario(input)
        set((s) => ({ results: [result, ...s.results].slice(0, 50) }))
        return result
      },
      remove: (id) => set((s) => ({ results: s.results.filter((r) => r.id !== id) })),
      clear: () => set({ results: [] }),
    }),
    { name: 'titan.scenarios' },
  ),
)
