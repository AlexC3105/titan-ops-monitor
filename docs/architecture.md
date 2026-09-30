# TITAN — Architecture

TITAN is a single client-side React application. There is no backend yet; a small caching proxy
is the next planned piece (see [ROADMAP.md](../ROADMAP.md)).

## Layers

| Concern | Location | Notes |
| --- | --- | --- |
| App shell, layout | `src/app`, `src/layouts`, `src/components` | Sidebar + top bar on desktop, bottom nav on mobile |
| Routing | `src/app/App.tsx`, `src/routes/navigation.ts` | react-router, 8 routes + not-found |
| Pages | `src/features/*` | One folder per route |
| Domain types | `src/types/index.ts` | Shared by adapters, engine, UI |
| Adapter contract | `src/services/dataAdapters.ts` | `DataAdapter<T>`, `AdapterResult<T>`, `FeedStatus` |
| Live adapters | `src/services/adapters/*` | NWS forecast, NWS alerts, OpenSky |
| HTTP helper | `src/services/http.ts` | `fetch` + `AbortController` timeout + JSON |
| Sample data | `src/services/mock/*` | Regions, layers, infrastructure, source catalog |
| Scenario engine | `src/services/scenarioEngine.ts` | Pure, deterministic heuristic |
| State | `src/stores/*` | Zustand with `persist` → `localStorage` |
| Data hooks | `src/hooks/*` | Fetch on region change, expose loading + result |

## Data flow

1. A page reads the current region from `useAppStore`.
2. A hook (e.g. `useWeather`) calls the adapter's `fetch(regionId)`.
3. The adapter calls the public API with a timeout, then normalises the response into a typed
   `AdapterResult<T>` with `status: 'live'`.
4. On any HTTP error, timeout or malformed payload it returns region-appropriate sample data with
   `status: 'mock'`, so the UI always renders and always says which it is showing.

## Maps

- **Interactive:** MapLibre GL with CARTO raster tiles, lazy-loaded as its own chunk.
- **Compatibility (default):** `StaticMap.tsx` computes Web Mercator tile coordinates itself and
  positions `<img>` tiles and DOM markers, so a map renders on devices without WebGL.
- The chosen mode is persisted and can be switched in Settings or on the map.

## PWA

`vite-plugin-pwa` generates the manifest and a Workbox service worker that precaches the app
shell. Live data is not cached offline yet.

## Testing

Vitest (`vitest.config.ts`) runs in Node; store tests opt into jsdom for `localStorage`.
Network access is never needed: adapter tests replay recorded fixtures through a stubbed `fetch`
(`test/fetchStub.ts`).
