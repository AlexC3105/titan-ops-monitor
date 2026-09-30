# TITAN — Architecture

TITAN is a client-side React PWA plus a small Cloudflare Worker (`worker/`) that gives the browser
controlled server-side access to feeds it cannot call directly.

## Layers

| Concern | Location | Notes |
| --- | --- | --- |
| App shell, layout | `src/app`, `src/layouts`, `src/components` | Sidebar + top bar on desktop, bottom nav on mobile |
| Routing | `src/app/App.tsx`, `src/routes/navigation.ts` | react-router, 8 routes + not-found |
| Pages | `src/features/*` | One folder per route |
| Domain types | `src/types/index.ts` | Shared by adapters, engine, UI |
| Adapter contract | `src/services/dataAdapters.ts` | `DataAdapter<T>`, `AdapterResult<T>`, `FeedStatus` |
| Live adapters | `src/services/adapters/*` | NWS forecast, NWS alerts, OpenSky |
| API config | `src/services/apiConfig.ts` | Worker base URL (`VITE_TITAN_API_BASE` override) |
| API Worker | `worker/src/*` | Separate package, own tests and CI job |
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

## API Worker

Deployed at `https://titan-api.titan-api-worker.workers.dev` (Cloudflare Workers free tier, no secrets).

| Aspect | Behaviour |
| --- | --- |
| Routes | `GET /v1/flights?region=<id>` and `GET /v1/storms` (no parameters); any other path → 404, other methods → 405, `OPTIONS` → CORS preflight |
| Input | `/v1/flights`: exactly one parameter, `region`, which must be an allowlisted id; bounding boxes live server-side (`worker/src/regions.ts`). `/v1/storms`: no parameters at all. Clients cannot supply coordinates or URLs, so the Worker is not an open proxy |
| Upstream | Fixed URLs only: `opensky-network.org/api/states/all` (flights) and `www.nhc.noaa.gov/CurrentStorms.json` (storms); 8 s timeout |
| Output | Flights: `id, callsign, lon, lat, altitude, velocity, track, onGround` (max 60). Storms: `id, name, classification, lat, lon, intensity, pressure, movementDir, movementSpeed, lastUpdate, advisoryNumber` (values as published by NHC) |
| Errors | JSON `{ error }` with 400 / 404 / 405, and 502 / 503 / 504 for upstream failures; never cached |
| Cache | Successful responses only; one deterministic key per route (+ region). TTL 30 s for flights, 300 s for storms. Tier 1: in-memory per Worker isolate (not shared). Tier 2: `caches.default`, shared by isolates in the same Cloudflare data centre — observed working on `*.workers.dev`; global replication is not claimed. `X-Titan-Cache: MISS / HIT-MEMORY / HIT-EDGE` reports which served the request |
| CORS | Explicit origin allowlist (`ALLOWED_ORIGINS` in `wrangler.toml`); no credentials |

**Why 30 s (flights):** anonymous OpenSky data refreshes roughly every 10 s and anonymous requests
are limited per day, so a short window keeps positions current while collapsing repeat requests.

**Why 300 s (storms):** the NHC active-storm list changes when advisories are issued (typically
every 3–6 hours per system), so 5 minutes keeps new advisories visible quickly with at most one
upstream request per window.

**Current production status:**
- **Storms:** live. NHC responds to the Worker; production cache behaviour was measured on
  2026-09-30 (see "Production cache measurements" below). The app does not consume `/v1/storms`
  yet — that is the next milestone.
- **Flights:** requests reach the Worker and are validated correctly, but OpenSky does not respond
  to Cloudflare origins (8 s timeouts), and the alternatives tested either rate-limit Cloudflare
  or require requested access. The Worker returns 504/503 and the app falls back to labelled mock
  flights.

### Production cache measurements (`/v1/storms`, 2026-09-30)

Controlled sequential requests from one client to the deployed Worker (Cloudflare data centre
MIA). These are controlled measurements, not production traffic statistics.

| Sequence | Result |
| --- | --- |
| 1 (09:12:51 UTC) | request 1 `MISS` 0.24 s; requests 2–6 `HIT-EDGE` 0.073–0.088 s, same `fetchedAt` |
| TTL | 300 s |
| 2 (09:17:57 UTC, after expiry) | request 1 `MISS` 0.46 s with a new `fetchedAt` (upstream contacted again); requests 2–4 `HIT-EDGE` 0.083–0.089 s |

No `HIT-MEMORY` was observed: consecutive requests landed on different isolates and were served
by the shared edge cache. Failed upstream responses are never cached (covered by tests).

The flights adapter has two explicit modes (`flightsMode` in `openSkyFlights.ts`):
**dev-proxy** on the Vite dev server (browser → Vite `/osky` proxy → OpenSky) and **worker** in
production builds. Both share the Worker's state-vector normaliser.

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
(`test/fetchStub.ts`). Worker tests (`worker/test`) inject `fetch`, a fake clock and a fake edge
cache into the request handler, covering validation, routing, upstream failures, cache
hit/miss/expiry and CORS. A sync test keeps app and Worker region lists identical.
