import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'

const GUARDRAILS = [
  'Presents probabilistic analysis, never deterministic prophecy.',
  'Models groups and systems — never real individual people.',
  'Uses no sensitive personal data.',
  'Starts with safe civilian scenarios: weather, traffic, infrastructure, utilities, supply chain, emergency planning.',
  'Does not present military or conflict analysis as operational or tactical.',
]

const STATUS = [
  ['Implemented', 'Live NWS forecast + alerts, NHC tropical systems with official forecast track and cone, OpenSky flights in local dev, API Worker with validation and caching, feed health with auto-refresh, maps, saved settings, heuristic scenarios.'],
  ['Next', 'Public deployment, CARTO real-key verification, production flight-data access.'],
  ['Later', 'Additional regions and data sources. See ROADMAP.md in the repository.'],
]

export function AboutPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="About TITAN" />

      <Panel title="Operational intelligence for the Florida Gulf Coast">
        <p className="text-sm leading-relaxed text-slate-300">
          TITAN is an operational-awareness PWA. It ingests live public data (National Weather
          Service forecasts and alerts, OpenSky flight positions) through typed adapters that fall
          back to clearly labelled mock data when a feed is unavailable, shows it on a map, and
          offers a heuristic &ldquo;what if&hellip;&rdquo; scenario tool. The scenario tool is a
          planning aid, <em>not</em> a calibrated predictive model.
        </p>
        <p className="mt-3 rounded-lg border border-signal/20 bg-signal/5 p-3 text-sm text-slate-300">
          <span className="font-semibold text-signal">Core rule:</span> TITAN presents outcomes as
          probabilities with confidence levels and explicit data gaps — it never claims certainty.
        </p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Roadmap">
          <ol className="space-y-2.5">
            {STATUS.map(([title, desc]) => (
              <li key={title} className="flex gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-100">{title}</div>
                  <div className="text-xs text-slate-400">{desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Guardrails & ethics">
          <ul className="space-y-2 text-sm text-slate-300">
            {GUARDRAILS.map((g) => (
              <li key={g} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-confidence-high" />
                {g}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel>
        <p className="text-xs text-slate-500">
          Each feed shows whether its data is live or mock. Infrastructure markers, layers, and
          regions are static sample data. See <span className="font-mono text-slate-400">/docs</span>{' '}
          for architecture, data sources, the scenario engine, and ethics.
        </p>
      </Panel>
    </div>
  )
}
