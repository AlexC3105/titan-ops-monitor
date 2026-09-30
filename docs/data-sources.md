# TITAN — Data Sources

Every source is **mock-first**. A source is integrated only when a real adapter implementing
`DataAdapter<T>` (`src/services/dataAdapters.ts`) replaces its mock. Status reflects
**integration state**, not data quality.

## Status legend

| Status     | Meaning                                              |
| ---------- | ---------------------------------------------------- |
| `live`     | Real adapter wired and serving data                  |
| `mock`     | Placeholder data; adapter contract in place          |
| `planned`  | Identified, not yet implemented                      |
| `inactive` | Needs credentials/keys or is paused                  |

## Cadence categories

`realtime` · `minutes` · `hourly` · `daily` · `monthly` · `historical`

## Candidate sources by category

### Environment / weather
- **NWS / NOAA** (`weather.gov`) — US weather + alerts. Free, key-less, CORS-enabled. Cadence: hourly. **live** (first real adapter: `src/services/adapters/nwsWeather.ts`, `points`→`forecast`, mock fallback on error).
- **National Hurricane Center** (`www.nhc.noaa.gov/CurrentStorms.json`) — active tropical systems: id, name, classification, position, intensity, pressure, movement, last update, advisory number. **live via the Worker** (`/v1/storms`), shown as map markers and a detail panel. Forecast track, forecast points and cone: **live** — the Worker fetches the shapefile archive URL that `CurrentStorms.json` publishes for the current advisory (`trackCone.zipFile`), and converts the `_lin` / `_pts` / `_pgn` layers to GeoJSON (`/v1/storms/<id>/geometry`). Source: [nhc.noaa.gov](https://www.nhc.noaa.gov/).
- **OpenWeather** — global, needs API key. *inactive.*

### Transport
- **OpenSky Network** — flight positions, free (rate-limited). **live in local development** via the Vite dev proxy. Production calls the TITAN API Worker (`worker/`), which queries OpenSky server-side; OpenSky does not currently answer requests from Cloudflare, so production falls back to mock (`src/services/adapters/openSkyFlights.ts`).
- **adsb.lol / airplanes.live** — evaluated as alternatives (2026-09). adsb.lol serves the needed fields but rate-limits Cloudflare origins; airplanes.live requires requesting API access. *Not integrated.*
- **TomTom / HERE Traffic** — road speeds/incidents, key required. *inactive.*
- **AISStream / MarineTraffic** — vessel AIS positions. *planned.*

### Population
- **US Census / ACS** — group-level density only, never individuals. *mock.*

### Utilities
- **EIA Grid Monitor** — regional electricity demand. *planned.*

### Infrastructure
- **OpenStreetMap / Overpass** — roads, bridges, ports, hospitals, shelters. *mock.*

### Events
- **NWS Alerts** (`weather.gov/alerts`) — active advisories by area. **live** (`src/services/adapters/nwsAlerts.ts`, mock fallback).
- **GDACS** — global disaster alerts. *planned.*
- Public advisory feeds — group-level signals only.

## Integration rules

1. **One adapter at a time.** Swapping a mock for a real feed must not touch UI components.
2. **Normalize at the adapter.** UI consumes typed `AdapterResult<T>`, not raw API shapes.
3. **Respect keys & limits.** Keys live in env vars, never in the repo. Rate-limit and cache.
4. **No personal data.** Population and social signals are aggregate/group-level only
   (see [ethics.md](./ethics.md)).
5. **Degrade gracefully.** `inactive`/`planned` sources render a placeholder, never a crash.

## Refresh cadence

Live feeds are refreshed automatically by the app's feed scheduler: NWS forecast every 15 min,
NWS alerts every 3 min, NHC tropical systems every 5 min, flights every 30 s (only while the
Flights layer is on). Failures back off exponentially to at most 30 min, and data is marked stale
after 3 missed intervals. Details: [architecture.md → Feed scheduling and health](./architecture.md#feed-scheduling-and-health).
