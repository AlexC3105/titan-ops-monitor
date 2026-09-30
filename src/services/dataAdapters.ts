import type { FeedStatus } from '@/types'

// Modular data-adapter contract. Every live data source eventually implements
// this so a mock can be swapped for a real API without touching the UI.
export interface DataAdapter<T> {
  id: string
  status: FeedStatus
  /** Returns the latest snapshot for the given region. */
  fetch(regionId: string): Promise<AdapterResult<T>>
}

export interface AdapterResult<T> {
  sourceId: string
  status: FeedStatus
  fetchedAt: string
  /** Null when the feed is inactive/planned — UI should show a placeholder. */
  data: T | null
}

/**
 * Build a mock adapter from a static sample. Real adapters live under
 * src/services/adapters/ and replace these one id at a time.
 */
export function createMockAdapter<T>(id: string, sample: T): DataAdapter<T> {
  return {
    id,
    status: 'mock',
    async fetch(): Promise<AdapterResult<T>> {
      return {
        sourceId: id,
        status: 'mock',
        fetchedAt: new Date().toISOString(),
        data: sample,
      }
    },
  }
}

/** Registry placeholder — real adapters register here as they come online. */
export const adapterRegistry = new Map<string, DataAdapter<unknown>>()

export function registerAdapter(adapter: DataAdapter<unknown>): void {
  adapterRegistry.set(adapter.id, adapter)
}
