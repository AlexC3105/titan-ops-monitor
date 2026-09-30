// TITAN domain types — shared across UI, stores, and services.
// Kept deliberately framework-agnostic so they can migrate to packages/types later.

export type Confidence = 'low' | 'medium' | 'high'

/** Lifecycle of a data feed. Mock-first: most layers start as 'mock'. */
export type FeedStatus = 'live' | 'mock' | 'inactive' | 'planned'

export type LayerCategory =
  | 'environment'
  | 'transport'
  | 'population'
  | 'utilities'
  | 'infrastructure'
  | 'events'

export interface Region {
  id: string
  name: string
  /** [lon, lat] */
  center: [number, number]
  /** [west, south, east, north] */
  bounds: [number, number, number, number]
  population: number
}

export interface DataLayer {
  id: string
  name: string
  category: LayerCategory
  status: FeedStatus
  /** Default visibility in World View. */
  enabledByDefault: boolean
  description: string
  /** How often the source updates when live. */
  cadence: 'realtime' | 'minutes' | 'hourly' | 'daily' | 'monthly' | 'historical'
}

export interface DataSource {
  id: string
  name: string
  category: LayerCategory
  status: FeedStatus
  cadence: DataLayer['cadence']
  provider: string
  notes?: string
}

// --- Scenario engine ---

export type Severity = 1 | 2 | 3 | 4 | 5

export type TimeHorizon = '24h' | '72h' | '7d' | '14d' | '30d'

export interface ScenarioInput {
  regionId: string
  eventType: string
  severity: Severity
  horizon: TimeHorizon
  /** Free-text user assumptions that nudge the heuristic. */
  assumptions?: string
}

export interface Outcome {
  id: string
  label: string
  /** 0–100 */
  probability: number
  affectedSystem: LayerCategory | 'economy' | 'governance'
  timeframe: string
}

export interface ScenarioResult {
  id: string
  createdAt: string
  input: ScenarioInput
  regionName: string
  eventLabel: string
  outcomes: Outcome[]
  confidence: Confidence
  drivers: string[]
  dataGaps: string[]
  /** Human-readable, explicitly probabilistic summary. */
  narrative: string
}

export interface SystemStatusItem {
  id: string
  label: string
  status: 'ok' | 'degraded' | 'offline'
  detail: string
}

// --- Live-world data (Phase 1) ---

/** Current-conditions snapshot from a weather adapter (e.g. NWS/NOAA). */
export interface WeatherSnapshot {
  locationName: string
  temperature: number
  temperatureUnit: 'F' | 'C'
  windSpeed: string
  windDirection: string
  shortForecast: string
  /** ISO timestamp of the underlying forecast/observation period. */
  observedAt: string
}

export type InfraKind = 'port' | 'bridge' | 'hospital' | 'airport' | 'shelter' | 'power'

/** A point-of-interest rendered on the infrastructure map layer. */
export interface InfraPoint {
  id: string
  name: string
  kind: InfraKind
  regionId: string
  /** [lon, lat] */
  coord: [number, number]
}

export type AlertSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown'

/** Active weather advisory from NWS. */
export interface WeatherAlert {
  id: string
  event: string
  severity: AlertSeverity
  urgency: string
  headline: string
  area: string
  expires: string
}

/** A tracked aircraft (OpenSky state vector, normalized). */
export interface Flight {
  id: string
  callsign: string
  /** [lon, lat] */
  coord: [number, number]
  /** True track in degrees (0 = north). */
  track: number
  /** Barometric altitude in meters, or null. */
  altitude: number | null
  /** Ground speed in m/s, or null. */
  velocity: number | null
  onGround: boolean
}
