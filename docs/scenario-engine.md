# TITAN — Scenario Engine

The scenario engine answers **"What happens if…?"** with a transparent, deterministic
**heuristic** in `src/services/scenarioEngine.ts`. It is a planning aid, **not a calibrated
predictive model**: its numbers are illustrative and have not been validated against real events.

## Input → Output contract

**Input** (`ScenarioInput`):

| Field         | Meaning                                              |
| ------------- | ---------------------------------------------------- |
| `regionId`    | Which region/twin to evaluate                        |
| `eventType`   | hurricane, bridge-closure, fuel-shortage, …          |
| `severity`    | 1 (minimal) → 5 (extreme)                            |
| `horizon`     | 24h · 72h · 7d · 14d · 30d                           |
| `assumptions` | free-text nudges (e.g. "early evacuation order")     |

**Output** (`ScenarioResult`):

- **Probable outcomes** — each with a probability (0–100), affected system, and timeframe
- **Confidence** — low / medium / high
- **Primary drivers** — what most influences the result
- **Data gaps** — missing inputs that would raise confidence
- **Narrative** — human-readable, explicitly probabilistic summary

## Example (actual engine output)

```
Scenario: hurricane landfall, Tampa Bay, severity 4, 72h horizon
Outcomes (heuristic, illustrative):
  - 65% major evacuation pressure
  - 54% coastal storm-surge flooding
  - 51% fuel shortages along evacuation routes
  - 47% hospital capacity stress
Confidence: low
Primary drivers: storm track, population density, road capacity, utility exposure, storm surge
Data gaps: observed storm track vs. forecast cone, evacuation compliance rates,
           live utility grid load, real-time shelter / capacity availability
```

## How the heuristic works

For the chosen event, a set of **outcome templates** (base probability, severity sensitivity,
earliest relevant horizon, affected system) is evaluated:

```
probability = clamp(
  base
  + (severity - 3) × perSeverity       // severity scaling around "moderate"
  + populationFactor (human systems)   // denser regions → more human-system strain
  + deterministicJitter(seed)          // stable per-input variation, not randomness
, 3, 95)
```

Outcomes below the selected horizon's relevance are filtered out; the rest are sorted by
probability. **Confidence** falls as data gaps and severity-extremity rise.

## Design rules

1. **Always probabilistic.** No outcome is ever presented as certain.
2. **Deterministic.** Same input → same output (seeded jitter), so results are explainable and
   testable.
3. **Transparent.** Drivers and data gaps are always shown — the model never hides its reasoning.
4. **UI-independent.** The engine is a pure function; the UI only renders its result.

Rules 2 and 1 are enforced by `src/services/scenarioEngine.test.ts` (determinism, bounds,
horizon filtering, severity monotonicity, probabilistic framing). Those tests check behaviour,
not real-world accuracy.

## Limitations

- Outcome templates, base rates and severity weights are hand-set, not fitted to data.
- The `assumptions` field is stored with the scenario but does not yet change the result.
- Calibration against historical events is future work; see [ROADMAP.md](../ROADMAP.md).
