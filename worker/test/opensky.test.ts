import { describe, expect, it } from 'vitest'
import { MAX_FLIGHTS, normalizeStates } from '../src/opensky'

describe('normalizeStates', () => {
  it('returns [] for a null or malformed states array', () => {
    expect(normalizeStates(null)).toEqual([])
    expect(normalizeStates('nope')).toEqual([])
    expect(normalizeStates([null, 42, ['no-position']])).toEqual([])
  })

  it(`caps output at ${MAX_FLIGHTS} flights`, () => {
    const row = (i: number) => [`id${i}`, `CS${i}`, 'US', 0, 0, -82.5, 27.9, 1000, false, 200, 90]
    expect(normalizeStates(Array.from({ length: 75 }, (_, i) => row(i)))).toHaveLength(MAX_FLIGHTS)
  })

  it('uses null for unknown altitude and velocity and 0 for unknown track', () => {
    const [f] = normalizeStates([['abc', 'X ', 'US', 0, 0, -82.5, 27.9, null, true, null, null]])
    expect(f).toMatchObject({ altitude: null, velocity: null, track: 0, onGround: true, callsign: 'X' })
  })
})
