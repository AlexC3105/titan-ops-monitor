// Base URL of the TITAN API Worker (see worker/). The deployed Worker is public
// and credential-free, so its URL is safe to ship in the bundle. Override with
// VITE_TITAN_API_BASE, e.g. http://localhost:8787 when running `npm run dev:worker`.
export const DEFAULT_API_BASE = 'https://titan-api.titan-api-worker.workers.dev'

export function apiBase(env: { VITE_TITAN_API_BASE?: string } = import.meta.env): string {
  return (env.VITE_TITAN_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '')
}
