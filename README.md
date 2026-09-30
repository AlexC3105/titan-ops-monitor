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
| Tropical systems | Active NOAA / NHC storms as map markers with a detail panel (wind kt, pressure mb, motion, advisory); selecting a storm draws NHC's official forecast track, forecast points and cone of uncertainty in both renderers |
| App | React 18 + TypeScript, 8 routes, responsive shell with sidebar and mobile navigation |
| PWA | Installable; Workbox service worker caches the app shell |
| State | Region, layers, map mode and the last 50 scenario results persist in `localStorage` |
| Scenarios | 7 event types; deterministic heuristic outputs with confidence levels, drivers and explicit data gaps |
| API Worker | Cloudflare Worker (`worker/`) with fixed routes: `GET /v1/storms` (live NOAA / NHC active storms), `GET /v1/storms/<id>/geometry` (official NHC forecast track + cone, converted server-side from NHC's shapefile archive to GeoJSON) and `GET /v1/flights?region=<id>` (allowlisted regions only). Fixed upstreams, request validation, CORS allowlist, upstream timeout, structured JSON errors, success-only caching verified in production |
| Quality | 154 Vitest tests (75 app, 79 Worker) on recorded, sanitised fixtures; CI runs typecheck, tests and build for both |

## Data sources

| Source | Status | Notes |
| --- | --- | --- |
| NWS forecast (`api.weather.gov`) | live | points → gridpoint forecast, 7 s timeout |
| NWS active alerts | live | GeoJSON, severity normalised, capped at 20 |
| NOAA / NHC active storms + forecast track / cone | live via the Worker | storm list from `CurrentStorms.json`; track and cone from the forecast archive URL NHC publishes for each advisory |
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

### Basemap key

The map uses CARTO's Dark Matter basemap, which needs a free CARTO basemap key
([carto.com/basemaps/apikey](https://carto.com/basemaps/apikey)). The same key serves the raster
tiles (compatibility renderer) and the MapLibre vector style (interactive renderer).

```bash
cp .env.example .env.local    # .env.local is git-ignored
# then set VITE_CARTO_BASEMAP_KEY=<your key>
```

This is a **browser key**: Vite embeds it in the bundle and it appears in tile requests. Protect it
with CARTO's website (Referer) restrictions, not secrecy. CARTO requires a **separate key for
local development** (`localhost`, `127.0.0.1`), because a key that lists localhost cannot also list
public sites. Without a key the app still runs: the map shows a "Basemap not configured" notice
on a plain background and all data layers work. Tests and CI need no key.

To run the API Worker locally:

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
- **Basemap needs a CARTO key.** Without `VITE_CARTO_BASEMAP_KEY` the map shows a plain background
  (see "Basemap key").
- **Storm list is fetched once per page load** (no auto-refresh yet).
- **Florida only.** Regions and NWS area codes are currently Florida-specific.
- **No auto-refresh yet.** Feeds are fetched when the region changes.
- **Scenario numbers are illustrative.** Templates and weights are hand-set and uncalibrated.
- **Sample data.** Infrastructure markers and layer catalog are static.

## Attribution

Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors ©
[CARTO](https://carto.com/attributions). Weather data from the U.S.
[National Weather Service](https://www.weather.gov/). Tropical-cyclone data and forecast
track / cone products from the [NOAA National Hurricane Center](https://www.nhc.noaa.gov/)
(TITAN is independent and not endorsed by NOAA). Flight data from
[The OpenSky Network](https://opensky-network.org/).

## License

[MIT](LICENSE)
