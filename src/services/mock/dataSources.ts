import type { DataSource } from '@/types'

// Catalog shown on the Data Sources screen. Status reflects integration state,
// not data quality. Everything is mock until a real adapter lands.
export const DATA_SOURCES: DataSource[] = [
  { id: 'nws', name: 'NWS / NOAA', category: 'environment', status: 'live', cadence: 'hourly', provider: 'weather.gov', notes: 'Live: current conditions via points→forecast. Falls back to mock on error.' },
  { id: 'nws-alerts', name: 'NWS Alerts', category: 'events', status: 'live', cadence: 'realtime', provider: 'weather.gov', notes: 'Live active advisories by area. Mock fallback on error.' },
  { id: 'nhc', name: 'National Hurricane Center', category: 'environment', status: 'live', cadence: 'hourly', provider: 'nhc.noaa.gov', notes: 'Active tropical systems plus official forecast track and cone, via the TITAN API Worker.' },
  { id: 'openweather', name: 'OpenWeather', category: 'environment', status: 'inactive', cadence: 'minutes', provider: 'openweathermap.org', notes: 'Requires API key.' },
  { id: 'tomtom', name: 'TomTom Traffic', category: 'transport', status: 'inactive', cadence: 'minutes', provider: 'developer.tomtom.com', notes: 'Requires API key.' },
  { id: 'opensky', name: 'OpenSky Network', category: 'transport', status: 'live', cadence: 'realtime', provider: 'opensky-network.org', notes: 'Live flight positions by bbox (rate limited). Mock fallback.' },
  { id: 'aisstream', name: 'AISStream', category: 'transport', status: 'planned', cadence: 'minutes', provider: 'aisstream.io', notes: 'Vessel AIS positions.' },
  { id: 'census', name: 'US Census / ACS', category: 'population', status: 'mock', cadence: 'monthly', provider: 'census.gov', notes: 'Group-level density only.' },
  { id: 'eia', name: 'EIA Grid Monitor', category: 'utilities', status: 'planned', cadence: 'hourly', provider: 'eia.gov', notes: 'Regional electricity demand.' },
  { id: 'osm', name: 'OpenStreetMap', category: 'infrastructure', status: 'mock', cadence: 'historical', provider: 'openstreetmap.org', notes: 'Roads, bridges, facilities.' },
  { id: 'gdacs', name: 'GDACS', category: 'events', status: 'planned', cadence: 'realtime', provider: 'gdacs.org', notes: 'Global disaster alerts.' },
]
