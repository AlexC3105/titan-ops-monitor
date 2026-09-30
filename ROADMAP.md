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
  - OpenSky flight positions — **local development only** (Vite dev proxy); production builds
    fall back to mock until a proxy exists.
- Two map renderers, switchable in Settings: MapLibre GL (WebGL) and a GPU-free raster-tile
  Web Mercator renderer.
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

## Planned (next)

- Server-side caching proxy (Cloudflare Worker) so OpenSky and other non-CORS feeds work in
  production.
- National Hurricane Center storm data (tracks / cones) on the map.
- Feed-health panel: real fetch time, latency, live / mock / stale status per feed.
- Auto-refresh with per-feed intervals and backoff.
- Public deployment (Cloudflare Pages) with measured Lighthouse and bundle-size results.

## Later (not committed)

- Additional regions beyond the Florida Gulf Coast.
- Additional public sources (e.g. EIA grid demand, GDACS, AIS vessel positions).
- Calibrating scenario outputs against historical events.
