# Festival Architect — Technische specificatie (v1)

## Stack

React 19 + TypeScript (strict) + Vite 6, Tailwind CSS 4, Canvas 2D, IndexedDB.
Tests met Vitest (+ `fake-indexeddb`). Geen backend, accounts, 3D of externe API's.

## Modules

| Map              | Verantwoordelijkheid                                   | Mag React/DOM gebruiken |
|------------------|--------------------------------------------------------|-------------------------|
| `src/model`      | Datamodel, catalogus, scenario, raster, layout-bewerkingen, plaatsingsvalidatie, bereikbaarheid | nee |
| `src/sim`        | RNG, pathfinding, regels, wachtrijen, bezoekerslogica, klok/runner, statistiek, rapport | nee |
| `src/render`     | Canvas-renderer — **leest** state, muteert nooit       | alleen Canvas           |
| `src/storage`    | IndexedDB-saves en validatie van savebestanden         | alleen IndexedDB        |
| `src/ui`         | React-interface                                        | ja                      |

Bestanden:

- `model/types.ts` — `TileGrid`, `Facility`, `Stage`, `FestivalLayout`, `Act`, `Performance`, `Program`, `ScenarioSettings`
- `model/catalog.ts` — voorzieningsdefinities, genres, fictieve acts
- `model/scenario.ts` — scenario, vaste obstakels, voorbeeldontwerp
- `model/grid.ts` — footprint, toegangstegel, publiekszone, indexering
- `model/placement.ts` — plaatsings- en padvalidatie
- `model/layout.ts` — immutabele bewerkingen en kosten
- `model/reachability.ts` — begaanbaarheidsraster, bereikbaarheid, uitleg, simulatievalidatie
- `sim/types.ts` — `Visitor`, `SimulationState`, `SimulationMetrics`, `FinalReport`
- `sim/rules.ts` — alle spelregelconstanten (komt overeen met GAME_DESIGN.md)
- `sim/rng.ts` — mulberry32, state als getal in `SimulationState`
- `sim/pathfinding.ts` — A*, Dijkstra-kostenveld, pad uit kostenveld
- `sim/clock.ts` — tick/minuut-conversie, klokweergave, actieve optredens
- `sim/queues.ts` — wachtrijsysteem
- `sim/visitors.ts` — behoeften, beslissen, bewegen, aankomst
- `sim/metrics.ts` — samples, heatmap, wachttijden
- `sim/simulation.ts` — `createSimulation`, `step`, `runToEnd`, `hashState`
- `sim/report.ts` — eindrapport en verbeterpunten
- `sim/runner.ts` — fixed-timestep runner (start/pauze/snelheid)

## Tijd

- Fixed timestep: **1 tick = 0,1 spelminuut**; 10 ticks per spelminuut.
- Totaal: (240 + 30) × 10 = 2.700 ticks.
- 1× = 10 ticks per seconde, 2× = 20, 4× = 40. Snelheid verandert alleen hoeveel
  ticks per echte seconde draaien, niet wat één tick doet.
- Update-loop (`SimulationRunner`, eigen `requestAnimationFrame`) en render-loop
  (`FestivalCanvas`, eigen `requestAnimationFrame`) zijn gescheiden. De renderer
  interpoleert posities met `alpha = accumulator / msPerTick`.
- Echte frametijd wordt per frame begrensd op 250 ms (geen inhaalspiraal).
- Pauze: de runner neemt geen tijd meer op → `tick` verandert niet.

## Determinisme

- Eén seeded RNG (`mulberry32`), state opgeslagen in `SimulationState.rng`.
- Vaste volgorde: aankomsten → festivaleinde → behoeften → wachtrijen → bezoekers
  (op id) → statistiek.
- Heap met invoegvolgnummer en vaste buurvolgorde (N, O, Z, W) → deterministische paden.
- Geen `Math.random`, `Date` of echte tijd binnen `src/sim`.
- `hashState()` levert een vingerafdruk voor tests.

## Tick-volgorde (`step`)

1. Bezoekers met `arrivalTick ≤ tick` verschijnen op de ingang (`Entering`).
2. Op `tick == festivalEnd`: alle aanwezigen → `Leaving` (uit rijen verwijderd).
3. Behoeften en tevredenheid bijwerken.
4. Wachtrijen: bediening aftellen, klaar → effect + beslissen; rij → bediening.
5. Bezoekers in id-volgorde: beslissen indien nodig, bewegen, kijken, rusten, wachtrij verlaten.
6. Elke spelminuut: sample (op terrein, tevredenheid, per podium, rijlengtes,
   zonder doel, drukste 3×3-venster) en heatmap ophogen.
7. `tick++`; klaar als `tick ≥ 2700` of (na festivaleinde en iedereen vertrokken).

## Validatie

**Plaatsing** (`validatePlacement`): binnen raster; toegangstegel binnen raster;
niet op obstakel; niet op pad; geen overlap; footprint niet op toegangstegel van
een ander; eigen toegangstegel niet onder een andere footprint of op obstakel;
ingang op de grens en naar binnen gericht; max. 1 ingang, max. 2 podia; budget.

**Pad** (`validatePathPaint`): alleen op gras, niet onder een voorziening, budget.

**Vóór simulatie** (`validateForSimulation`):
- Fouten (blokkeren): geen ingang, geen podium, geen bereikbaar podium, budget overschreden.
- Waarschuwingen: onbereikbare voorziening (met uitleg welk afgesloten gebied en
  wat het insluit), geen eetkraam, geen toilet, geen optredens, podium zonder optreden.

## Opslaan (IndexedDB)

Database `festival-architect`, store `saves`, sleutel = naam.

```ts
interface SaveFile {
  version: 1; name: string; savedAt: string;
  layout: FestivalLayout; program: Program; scenario: ScenarioSettings;
  seed: number; lastReport: FinalReport | null;
}
```

Een lopende simulatie wordt **niet** opgeslagen; na herladen start de simulatie
opnieuw vanaf het begin. Het huidige ontwerp wordt automatisch bewaard onder
`__autosave__`. Bij laden wordt de vorm gecontroleerd (`parseSave`).

## Acceptatiecriteria → tests

| # | Criterium                             | Test                                   |
|---|---------------------------------------|----------------------------------------|
| 1 | Ongeldige plaatsing geblokkeerd       | `tests/placement.test.ts`              |
| 2 | Bereikbaarheid vóór simulatie         | `tests/reachability.test.ts`           |
| 3 | Geldige routes                        | `tests/pathfinding.test.ts`, `tests/simulation.test.ts` |
| 4 | Wachtrijen correct                    | `tests/queues.test.ts`, `tests/simulation.test.ts` |
| 5 | Pauze stopt tijd                      | `tests/runner.test.ts`                 |
| 6 | Snelheid verandert regels niet        | `tests/runner.test.ts`                 |
| 7 | Reproduceerbaar                       | `tests/simulation.test.ts`             |
| 8 | Opslaan en herladen                   | `tests/storage.test.ts`                |
| 9 | Volledige run met 150 bezoekers       | `tests/simulation.test.ts`             |
| 10| Rapport helpt verbeteren              | `tests/report.test.ts`                 |
