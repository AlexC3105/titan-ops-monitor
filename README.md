# TITAN — Operational Intelligence Monitor

[![CI](https://github.com/AlexC3105/titan-ops-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexC3105/titan-ops-monitor/actions/workflows/ci.yml)

TITAN is a developing operational-awareness PWA for the Tampa Bay / Florida Gulf Coast region.
It pulls live public data through typed adapters, shows it on a map, and offers a heuristic
"what happens if…" scenario tool for planning discussions.

> **Status:** early and actively developed. The scenario tool is a heuristic planning aid —
> **not a calibrated predictive model**. See [ROADMAP.md](ROADMAP.md) for what is built and
> what is planned.

_Screenshots and a live demo link will be added with the first public deployment._

## What works today

| Area | Implemented |
| --- | --- |
| Live data | National Weather Service forecast and active alerts (direct from the browser); OpenSky flight positions in local development |
| Adapter layer | `DataAdapter<T>` contract; every result carries `live` / `mock` status and a fetch time; timeouts fall back to clearly labelled mock data |
| Maps | MapLibre GL (WebGL) and a hand-written GPU-free Web Mercator tile renderer, switchable at runtime |
| App | React 18 + TypeScript, 8 routes, responsive shell with sidebar and mobile navigation |
| PWA | Installable; Workbox service worker caches the app shell |
| State | Region, layers, map mode and the last 50 scenario results persist in `localStorage` |
| Scenarios | 7 event types; deterministic heuristic outputs with confidence levels, drivers and explicit data gaps |
| API Worker | Cloudflare Worker (`worker/`) with two fixed routes: `GET /v1/storms` (live NOAA / NHC active storms) and `GET /v1/flights?region=<id>` (allowlisted regions only). Fixed upstreams, request validation, CORS allowlist, upstream timeout, structured JSON errors, success-only caching verified in production |
| Quality | 95 Vitest tests (49 app, 46 Worker) on recorded, sanitised fixtures; CI runs typecheck, tests and build for both |

## Data sources

| Source | Status | Notes |
| --- | --- | --- |
| NWS forecast (`api.weather.gov`) | live | points → gridpoint forecast, 7 s timeout |
| NWS active alerts | live | GeoJSON, severity normalised, capped at 20 |
| NOAA / NHC active storms | live via the Worker | `/v1/storms`; not yet shown in the app (next milestone) |
| OpenSky Network | live in local dev; mock in production | dev: Vite proxy. Production: via the Worker, but see limitations |
| Infrastructure, layers, regions | static sample data | hard-coded |

Full catalog, including planned sources: [docs/data-sources.md](docs/data-sources.md).

## Architecture

```
UI routes (src/features/*)
   │  read hooks + Zustand stores
   ▼
hooks (useWeather, useAlerts, useFlights)
   │  call adapters on region change
   ▼
adapters (src/services/adapters/*)
   ├──► NWS forecast + alerts            (direct, browser-safe CORS)
   └──► flights
          local dev:   Vite /osky proxy ──► OpenSky
          production:  TITAN API Worker ──► OpenSky
                       (region id → fixed bbox, validation, cache, timeout)
   │  normalise to typed AdapterResult<T>; on error/timeout → labelled mock
   ▼
scenario engine (pure function)      stores (persisted to localStorage)
```

More detail: [docs/architecture.md](docs/architecture.md) ·
[docs/scenario-engine.md](docs/scenario-engine.md) · [docs/ethics.md](docs/ethics.md)

## Run locally

Requires Node 22+.

```bash
npm ci
npm run dev        # http://localhost:5173 (flights via the local OpenSky dev proxy)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

No API keys or environment variables are needed. To run the API Worker locally:

```bash
npm --prefix worker ci
npm run dev:worker                                   # http://localhost:8787
VITE_TITAN_API_BASE=http://localhost:8787 npm run dev   # app → local Worker
```

## Tests

```bash
npm test                     # app tests (Vitest), no network access required
npm run typecheck
npm --prefix worker test     # Worker tests
npm --prefix worker run check   # bundle + validate wrangler.toml, no deploy
```

Adapter tests replay recorded NWS and OpenSky responses (`test/fixtures/`, identifiers
sanitised) through a stubbed `fetch`, covering parsing, HTTP errors, timeouts, mock fallback
and status labelling. Scenario tests check determinism, bounds and framing — not accuracy.

## Known limitations

- **No live flights in production yet.** The Worker is deployed and working, but the public
  flight-data providers evaluated (OpenSky, adsb.lol, airplanes.live) block or throttle requests
  from shared cloud/serverless networks. Production therefore shows labelled mock flights until
  provider access is arranged. Local development still gets live OpenSky data.
- **Storm data is not in the UI yet.** The Worker serves live NHC storms; map markers, details
  and forecast tracks/cones are the next milestone.
- **Florida only.** Regions and NWS area codes are currently Florida-specific.
- **No auto-refresh yet.** Feeds are fetched when the region changes.
- **Scenario numbers are illustrative.** Templates and weights are hand-set and uncalibrated.
- **Sample data.** Infrastructure markers and layer catalog are static.

## Attribution

Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors ©
[CARTO](https://carto.com/attributions). Weather data from the U.S.
[National Weather Service](https://www.weather.gov/). Flight data from
[The OpenSky Network](https://opensky-network.org/).

## License

[MIT](LICENSE)
