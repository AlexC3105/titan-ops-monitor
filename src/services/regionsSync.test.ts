import { describe, expect, it } from 'vitest'
import { REGIONS } from './mock/regions'
import { REGION_BOUNDS } from '../../worker/src/regions'

// The Worker keeps its own copy of region bounding boxes (clients send only a
// region id). This guards against the two lists drifting apart.
describe('app and Worker regions', () => {
  it('define the same region ids with the same bounds', () => {
    expect(Object.fromEntries(REGIONS.map((r) => [r.id, [...r.bounds]]))).toEqual(
      Object.fromEntries(Object.entries(REGION_BOUNDS).map(([id, b]) => [id, [...b]])),
    )
  })
})
