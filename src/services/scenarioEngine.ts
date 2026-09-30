import type {
  Confidence,
  Outcome,
  ScenarioInput,
  ScenarioResult,
  Severity,
  TimeHorizon,
} from '@/types'
import { getRegion } from '@/services/mock/regions'
import { clamp } from '@/utils/format'

// ─────────────────────────────────────────────────────────────────────────────
// HEURISTIC scenario engine (Phase 3 stub).
//
// This is NOT a calibrated model. It is a transparent, deterministic heuristic
// that turns scenario inputs into *illustrative* probability bands so the UI and
// data contracts can be built and tested. Per TITAN's core rule, every output is
// framed as probabilistic, with confidence and explicit data gaps — never as a
// guaranteed prediction.
// ─────────────────────────────────────────────────────────────────────────────

export interface EventType {
  id: string
  label: string
  /** Layers/systems this event most directly perturbs. */
  drivers: string[]
}

export const EVENT_TYPES: EventType[] = [
  { id: 'hurricane', label: 'Hurricane landfall', drivers: ['storm track', 'population density', 'road capacity', 'utility exposure', 'storm surge'] },
  { id: 'bridge-closure', label: 'Major bridge closure', drivers: ['road capacity', 'detour distance', 'commuter volume', 'emergency access'] },
  { id: 'traffic-disruption', label: 'Major traffic disruption', drivers: ['corridor volume', 'rerouting capacity', 'time of day'] },
  { id: 'fuel-shortage', label: 'Fuel shortage', drivers: ['supply reserves', 'demand surge', 'resupply lead time'] },
  { id: 'port-slowdown', label: 'Port slowdown / closure', drivers: ['cargo throughput', 'inventory buffers', 'alternate routing'] },
  { id: 'utility-spike', label: 'Utility demand spike', drivers: ['peak load', 'generation headroom', 'heat index'] },
  { id: 'population-growth', label: 'Population growth surge', drivers: ['housing supply', 'road capacity', 'utility headroom'] },
]

interface OutcomeTemplate {
  label: string
  affectedSystem: Outcome['affectedSystem']
  base: number
  /** Probability added per severity step above 3 (and removed below). */
  perSeverity: number
  /** Soonest horizon this outcome meaningfully applies to. */
  earliest: TimeHorizon
  timeframe: string
}

const TEMPLATES: Record<string, OutcomeTemplate[]> = {
  hurricane: [
    { label: 'Major evacuation pressure', affectedSystem: 'population', base: 55, perSeverity: 11, earliest: '24h', timeframe: '0–48h before landfall' },
    { label: 'Fuel shortages along evacuation routes', affectedSystem: 'utilities', base: 44, perSeverity: 9, earliest: '72h', timeframe: 'within 72h' },
    { label: 'Hospital capacity stress', affectedSystem: 'infrastructure', base: 38, perSeverity: 8, earliest: '72h', timeframe: '24–96h' },
    { label: 'Regional power disruption > 5 days', affectedSystem: 'utilities', base: 30, perSeverity: 10, earliest: '7d', timeframe: 'post-landfall' },
    { label: 'Coastal storm-surge flooding', affectedSystem: 'environment', base: 42, perSeverity: 12, earliest: '24h', timeframe: 'at landfall' },
    { label: 'Supply-chain / port disruption', affectedSystem: 'economy', base: 35, perSeverity: 7, earliest: '7d', timeframe: '3–14 days' },
  ],
  'bridge-closure': [
    { label: 'Severe corridor congestion', affectedSystem: 'transport', base: 62, perSeverity: 9, earliest: '24h', timeframe: 'first 24h' },
    { label: 'Detour delays > 30 min', affectedSystem: 'transport', base: 50, perSeverity: 8, earliest: '24h', timeframe: 'peak hours' },
    { label: 'Reduced emergency response times', affectedSystem: 'governance', base: 28, perSeverity: 7, earliest: '24h', timeframe: 'ongoing' },
    { label: 'Local business revenue impact', affectedSystem: 'economy', base: 33, perSeverity: 6, earliest: '72h', timeframe: '3–14 days' },
  ],
  'traffic-disruption': [
    { label: 'Network-wide congestion spillover', affectedSystem: 'transport', base: 58, perSeverity: 9, earliest: '24h', timeframe: 'peak hours' },
    { label: 'Transit schedule degradation', affectedSystem: 'transport', base: 40, perSeverity: 7, earliest: '24h', timeframe: 'same day' },
    { label: 'Freight / delivery delays', affectedSystem: 'economy', base: 30, perSeverity: 6, earliest: '72h', timeframe: '1–3 days' },
  ],
  'fuel-shortage': [
    { label: 'Station-level outages', affectedSystem: 'utilities', base: 52, perSeverity: 10, earliest: '24h', timeframe: '24–72h' },
    { label: 'Price spikes', affectedSystem: 'economy', base: 47, perSeverity: 8, earliest: '24h', timeframe: 'days' },
    { label: 'Panic-buying amplification', affectedSystem: 'population', base: 38, perSeverity: 9, earliest: '24h', timeframe: '24–48h' },
    { label: 'Transport / logistics slowdown', affectedSystem: 'transport', base: 33, perSeverity: 7, earliest: '72h', timeframe: '2–7 days' },
  ],
  'port-slowdown': [
    { label: 'Supply-chain disruption', affectedSystem: 'economy', base: 50, perSeverity: 9, earliest: '72h', timeframe: '3–14 days' },
    { label: 'Goods / fuel delivery delays', affectedSystem: 'utilities', base: 40, perSeverity: 8, earliest: '7d', timeframe: '1–2 weeks' },
    { label: 'Regional price pressure', affectedSystem: 'economy', base: 30, perSeverity: 7, earliest: '7d', timeframe: '2+ weeks' },
  ],
  'utility-spike': [
    { label: 'Grid stress / load-shed risk', affectedSystem: 'utilities', base: 45, perSeverity: 11, earliest: '24h', timeframe: 'peak demand window' },
    { label: 'Localized outages', affectedSystem: 'utilities', base: 33, perSeverity: 9, earliest: '24h', timeframe: 'same day' },
    { label: 'Demand-response activation', affectedSystem: 'governance', base: 40, perSeverity: 6, earliest: '24h', timeframe: 'same day' },
  ],
  'population-growth': [
    { label: 'Housing supply pressure', affectedSystem: 'economy', base: 48, perSeverity: 6, earliest: '30d', timeframe: 'months' },
    { label: 'Road-capacity strain', affectedSystem: 'transport', base: 42, perSeverity: 7, earliest: '30d', timeframe: 'months' },
    { label: 'Utility-headroom erosion', affectedSystem: 'utilities', base: 36, perSeverity: 6, earliest: '30d', timeframe: 'months' },
  ],
}

const HORIZON_ORDER: TimeHorizon[] = ['24h', '72h', '7d', '14d', '30d']

function horizonIncludes(horizon: TimeHorizon, earliest: TimeHorizon): boolean {
  return HORIZON_ORDER.indexOf(horizon) >= HORIZON_ORDER.indexOf(earliest)
}

// Small deterministic hash → jitter so the same input yields the same result.
function seededJitter(seed: string, index: number): number {
  let h = 2166136261
  const s = `${seed}:${index}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // map to roughly [-4, +4]
  return ((h >>> 0) % 9) - 4
}

function deriveConfidence(severity: Severity, gapCount: number): Confidence {
  // More data gaps and more extreme severity → lower confidence.
  const score = 6 - gapCount - Math.abs(severity - 3)
  if (score >= 4) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}

export function evaluateScenario(input: ScenarioInput): ScenarioResult {
  const region = getRegion(input.regionId)
  const event = EVENT_TYPES.find((e) => e.id === input.eventType) ?? EVENT_TYPES[0]
  const templates = TEMPLATES[event.id] ?? []
  const seed = `${input.regionId}|${input.eventType}|${input.severity}|${input.horizon}`

  // Larger populations modestly raise human-system outcomes.
  const popFactor = region.population > 4_000_000 ? 4 : region.population > 2_000_000 ? 2 : 0

  const outcomes: Outcome[] = templates
    .filter((t) => horizonIncludes(input.horizon, t.earliest))
    .map((t, i) => {
      const severityAdj = (input.severity - 3) * t.perSeverity
      const human = t.affectedSystem === 'population' || t.affectedSystem === 'infrastructure'
      const raw = t.base + severityAdj + (human ? popFactor : 0) + seededJitter(seed, i)
      return {
        id: `${event.id}-${i}`,
        label: t.label,
        probability: Math.round(clamp(raw, 3, 95)),
        affectedSystem: t.affectedSystem,
        timeframe: t.timeframe,
      }
    })
    .sort((a, b) => b.probability - a.probability)

  const dataGaps = buildDataGaps(event.id)
  const confidence = deriveConfidence(input.severity, dataGaps.length)

  return {
    id: `scn_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    input,
    regionName: region.name,
    eventLabel: event.label,
    outcomes,
    confidence,
    drivers: event.drivers,
    dataGaps,
    narrative: buildNarrative(event.label, region.name, input.severity, confidence, outcomes),
  }
}

function buildDataGaps(eventId: string): string[] {
  const common = ['live utility grid load', 'real-time shelter / capacity availability']
  const byEvent: Record<string, string[]> = {
    hurricane: ['observed storm track vs. forecast cone', 'evacuation compliance rates'],
    'bridge-closure': ['real-time detour traffic counts'],
    'fuel-shortage': ['terminal inventory levels'],
    'port-slowdown': ['live berth / queue telemetry'],
    'utility-spike': ['per-feeder load telemetry'],
  }
  return [...(byEvent[eventId] ?? []), ...common]
}

function buildNarrative(
  eventLabel: string,
  regionName: string,
  severity: Severity,
  confidence: Confidence,
  outcomes: Outcome[],
): string {
  const top = outcomes[0]
  const sevWord = ['minimal', 'minor', 'moderate', 'major', 'extreme'][severity - 1]
  const lead = top
    ? `the most likely strain is "${top.label.toLowerCase()}" (~${top.probability}%)`
    : 'no outcomes are modeled for this horizon'
  return (
    `For a ${sevWord} ${eventLabel.toLowerCase()} affecting ${regionName}, ${lead}. ` +
    `These are probabilistic estimates from a heuristic model at ${confidence} confidence — ` +
    `not guarantees. Treat them as planning signals, and weigh the listed data gaps before acting.`
  )
}
