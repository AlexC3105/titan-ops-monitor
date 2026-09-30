import { beforeEach, describe, expect, it } from 'vitest'
import { useFeedStore } from './useFeedStore'
import type { WeatherAlert } from '@/types'

const alert = (id: string): WeatherAlert => ({ id, event: 'Test', severity: 'Minor', urgency: 'Expected', headline: '', area: '', expires: '' })

beforeEach(() => {
  useFeedStore.setState(useFeedStore.getInitialState(), true)
})

describe('useFeedStore retention rule', () => {
  it('stores live results', () => {
    useFeedStore.getState().applyResult('alerts', { regionId: 'tampa-bay', data: [alert('a')], status: 'live' })
    expect(useFeedStore.getState().alerts).toMatchObject({ status: 'live', data: [{ id: 'a' }] })
  })

  it('keeps previous live data for the same region instead of a mock fallback', () => {
    const s = useFeedStore.getState()
    s.applyResult('alerts', { regionId: 'tampa-bay', data: [alert('real')], status: 'live' })
    s.applyResult('alerts', { regionId: 'tampa-bay', data: [alert('mock')], status: 'mock' })
    expect(useFeedStore.getState().alerts).toMatchObject({ status: 'live', data: [{ id: 'real' }] })
  })

  it('does not carry live data across regions', () => {
    const s = useFeedStore.getState()
    s.applyResult('alerts', { regionId: 'tampa-bay', data: [alert('real')], status: 'live' })
    s.applyResult('alerts', { regionId: 'fl-gulf-coast', data: [alert('mock')], status: 'mock' })
    expect(useFeedStore.getState().alerts).toMatchObject({ regionId: 'fl-gulf-coast', status: 'mock' })
  })

  it('stores mock data when no live data exists yet', () => {
    useFeedStore.getState().applyResult('flights', { regionId: 'tampa-bay', data: [], status: 'mock' })
    expect(useFeedStore.getState().flights).toMatchObject({ status: 'mock' })
  })
})
