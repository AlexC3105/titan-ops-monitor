import { describe, expect, it } from 'vitest'
import { adapterRegistry, createMockAdapter, registerAdapter } from './dataAdapters'

describe('adapter contract', () => {
  it('createMockAdapter serves its sample labelled as mock', async () => {
    const adapter = createMockAdapter('sample', { value: 42 })
    const res = await adapter.fetch('tampa-bay')

    expect(adapter.status).toBe('mock')
    expect(res).toMatchObject({ sourceId: 'sample', status: 'mock', data: { value: 42 } })
    expect(Number.isNaN(Date.parse(res.fetchedAt))).toBe(false)
  })

  it('registerAdapter stores adapters by id', () => {
    const adapter = createMockAdapter('registry-test', [])
    registerAdapter(adapter)
    expect(adapterRegistry.get('registry-test')).toBe(adapter)
  })
})
