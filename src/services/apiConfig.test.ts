import { describe, expect, it } from 'vitest'
import { DEFAULT_API_BASE, apiBase } from './apiConfig'

describe('apiBase', () => {
  it('defaults to the deployed Worker', () => {
    expect(apiBase({})).toBe(DEFAULT_API_BASE)
  })

  it('honours VITE_TITAN_API_BASE and strips trailing slashes', () => {
    expect(apiBase({ VITE_TITAN_API_BASE: 'http://localhost:8787/' })).toBe('http://localhost:8787')
  })
})
