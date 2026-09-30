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
- **National Hurricane Center** (`www.nhc.noaa.gov/CurrentStorms.json`) — active tropical systems: id, name, classification, position, intensity, pressure, movement, last update, advisory number. **live via the Worker** (`/v1/storms`, verified from Cloudflare); not yet displayed in the app. Forecast tracks / cones come from separate NHC GIS products (KMZ / shapefile) — *planned.*
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
