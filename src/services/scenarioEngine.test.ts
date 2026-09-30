import { describe, expect, it } from 'vitest'
import { EVENT_TYPES, evaluateScenario } from './scenarioEngine'
import type { ScenarioInput } from '@/types'

// These tests pin down the heuristic's *behaviour* (determinism, bounds,
// filtering, framing). They say nothing about real-world accuracy: the engine
// is an illustrative planning aid, not a calibrated model.

const base: ScenarioInput = {
  regionId: 'tampa-bay',
  eventType: 'hurricane',
  severity: 3,
  horizon: '72h',
  assumptions: '',
}

function stable(input: ScenarioInput) {
  const { id: _id, createdAt: _createdAt, ...rest } = evaluateScenario(input)
  return rest
}

describe('evaluateScenario', () => {
  it('is deterministic for identical inputs (ignoring id and timestamp)', () => {
    expect(stable(base)).toEqual(stable(base))
  })

  it('handles every supported event type with bounded, sorted, integer probabilities', () => {
    for (const event of EVENT_TYPES) {
      const res = evaluateScenario({ ...base, eventType: event.id, horizon: '30d' })
      expect(res.eventLabel).toBe(event.label)
      expect(res.drivers).toEqual(event.drivers)
      expect(res.outcomes.length).toBeGreaterThan(0)
      for (const o of res.outcomes) {
        expect(Number.isInteger(o.probability)).toBe(true)
        expect(o.probability).toBeGreaterThanOrEqual(3)
        expect(o.probability).toBeLessThanOrEqual(95)
      }
      const probs = res.outcomes.map((o) => o.probability)
      expect(probs).toEqual([...probs].sort((a, b) => b - a))
    }
  })

  it('only includes outcomes whose earliest horizon has been reached', () => {
    const count = (horizon: ScenarioInput['horizon']) =>
      evaluateScenario({ ...base, horizon }).outcomes.length
    expect(count('24h')).toBe(2)
    expect(count('72h')).toBe(4)
    expect(count('7d')).toBe(6)
    expect(evaluateScenario({ ...base, eventType: 'population-growth', horizon: '7d' }).outcomes).toEqual([])
  })

  it('never lowers an outcome probability when severity increases', () => {
    const byLabel = (severity: ScenarioInput['severity']) =>
      Object.fromEntries(
        evaluateScenario({ ...base, severity, horizon: '30d' }).outcomes.map((o) => [o.label, o.probability]),
      )
    const low = byLabel(1)
    const high = byLabel(5)
    for (const label of Object.keys(low)) expect(high[label]).toBeGreaterThanOrEqual(low[label])
  })

  it('lowers confidence as severity becomes extreme and data gaps grow', () => {
    expect(evaluateScenario({ ...base, eventType: 'population-growth' }).confidence).toBe('high')
    expect(evaluateScenario({ ...base, eventType: 'bridge-closure' }).confidence).toBe('medium')
    expect(evaluateScenario({ ...base, severity: 5 }).confidence).toBe('low')
  })

  it('falls back to the first event type for an unknown event id', () => {
    const res = evaluateScenario({ ...base, eventType: 'meteor-strike' })
    expect(res.eventLabel).toBe(EVENT_TYPES[0].label)
  })

  it('always frames results as heuristic estimates, never guarantees', () => {
    const res = evaluateScenario(base)
    expect(res.narrative).toMatch(/heuristic model/)
    expect(res.narrative).toMatch(/not guarantees/)
    expect(res.dataGaps.length).toBeGreaterThan(0)
  })
})
