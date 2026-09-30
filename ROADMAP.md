# TITAN roadmap

This file separates what exists today from what is planned. Anything not listed under
**Implemented** should be treated as not built.

## Implemented

- React 18 + TypeScript + Vite PWA with 8 routes: Dashboard, World View, Layers, Scenarios,
  Data Sources, Reports, Settings, About.
- Typed data-adapter contract (`DataAdapter<T>` / `AdapterResult<T>`) with explicit
  `live` / `mock` / `planned` / `inactive` source status.
- Live adapters, each with a timeout and a labelled mock fallback:
  - NWS forecast (`api.weather.gov` points → forecast)
  - NWS active alerts (`api.weather.gov/alerts/active`)
  - OpenSky flight positions — live in **local development** (Vite dev proxy). Production builds
    go through the API Worker and currently fall back to mock (see Experimental).
- TITAN API Worker (Cloudflare Workers, `worker/`), deployed, with two fixed routes:
  - `GET /v1/storms` — live NOAA / NHC active storms, normalised; 300 s cache.
  - `GET /v1/storms/<id>/geometry` — official NHC forecast track, forecast points and cone for an
    active storm, converted server-side from NHC's shapefile archive to GeoJSON; cached per
    storm + advisory number.
  - `GET /v1/flights?region=<id>` — allowlisted region ids only (no client-supplied coordinates or
    URLs); 30 s cache.

  Fixed upstreams, parameter validation, 404/405 handling, CORS origin allowlist, 8 s upstream
  timeout, structured JSON errors, success-only caching (per-isolate memory + Cloudflare edge
  cache). Validation, CORS and cache MISS → HIT → expiry → MISS behaviour were verified against
  the deployed Worker.
- Two map renderers, switchable in Settings: MapLibre GL (WebGL) and a GPU-free raster-tile
  Web Mercator renderer.
- Tropical systems layer: active NHC storms as markers in both map renderers, a detail panel
  (NHC classification, position, wind in kt, pressure in mb, motion, advisory, last update) and the
  official forecast track, forecast points and cone for the selected storm, with NHC's cone caveat.
- CARTO Dark Matter basemap via one browser key (`VITE_CARTO_BASEMAP_KEY`) for both renderers:
  raster tiles (compatibility) and the vector style (MapLibre); clear notice and no tile requests
  when no key is set.
- Installable PWA (manifest + Workbox app-shell service worker).
- Settings and scenario history persisted to `localStorage`.
- Heuristic scenario engine: 7 event types, deterministic output, confidence levels and explicit
  data gaps.
- Automated tests (Vitest) using recorded, sanitised API fixtures; GitHub Actions CI running
  typecheck, tests and production build.

## Experimental

- **Scenario engine** — hand-set heuristic templates. A planning aid, not a calibrated or
  validated predictive model.
- **Static sample data** — infrastructure markers, map layers, regions and the data-source
  catalog are hard-coded samples.
- **Production flight data** — OpenSky, adsb.lol and airplanes.live were tested from Cloudflare;
  none currently serves shared cloud origins (timeout, rate limit, access-by-request). The Worker
  returns structured errors and the app shows labelled mock flights.

## Planned (next)

- Arrange production access with a flight-data provider (allowlisting or an issued key), then
  enable live flights through the existing Worker.
- Feed-health panel and auto-refresh (including the storm list).
- Feed-health panel: real fetch time, latency, live / mock / stale status per feed.
- Auto-refresh with per-feed intervals and backoff.
- Public deployment (Cloudflare Pages) with measured Lighthouse and bundle-size results.

## Later (not committed)

- Additional regions beyond the Florida Gulf Coast.
- Additional public sources (e.g. EIA grid demand, GDACS, AIS vessel positions).
- Calibrating scenario outputs against historical events.
