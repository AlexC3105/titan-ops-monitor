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
| Live data | National Weather Service forecast and active alerts; OpenSky flight positions (local dev only — see limitations) |
| Adapter layer | `DataAdapter<T>` contract; every result carries `live` / `mock` status and a fetch time; timeouts fall back to clearly labelled mock data |
| Maps | MapLibre GL (WebGL) and a hand-written GPU-free Web Mercator tile renderer, switchable at runtime |
| App | React 18 + TypeScript, 8 routes, responsive shell with sidebar and mobile navigation |
| PWA | Installable; Workbox service worker caches the app shell |
| State | Region, layers, map mode and the last 50 scenario results persist in `localStorage` |
| Scenarios | 7 event types; deterministic heuristic outputs with confidence levels, drivers and explicit data gaps |
| Quality | 36 Vitest tests on recorded, sanitised API fixtures; CI runs typecheck, tests and build |

## Data sources

| Source | Status | Notes |
| --- | --- | --- |
| NWS forecast (`api.weather.gov`) | live | points → gridpoint forecast, 7 s timeout |
| NWS active alerts | live | GeoJSON, severity normalised, capped at 20 |
| OpenSky Network | live in dev only | needs a same-origin proxy; production falls back to mock |
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
adapters (src/services/adapters/*)  ──►  public APIs (NWS, OpenSky via dev proxy)
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
npm run dev        # http://localhost:5173 (includes the OpenSky dev proxy)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

No API keys or environment variables are needed.

## Tests

```bash
npm test           # Vitest, no network access required
npm run typecheck
```

Adapter tests replay recorded NWS and OpenSky responses (`test/fixtures/`, identifiers
sanitised) through a stubbed `fetch`, covering parsing, HTTP errors, timeouts, mock fallback
and status labelling. Scenario tests check determinism, bounds and framing — not accuracy.

## Known limitations

- **OpenSky only works on the dev server.** OpenSky does not allow cross-origin browser requests,
  so a production proxy is required (planned).
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
