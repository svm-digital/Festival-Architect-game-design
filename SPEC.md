# Festival Architect — Technische specificatie (v2)

## Stack

React 19 + TypeScript (strict) + Vite 6, Tailwind CSS 4, Canvas 2D, IndexedDB.
Tests met Vitest (+ `fake-indexeddb`). Geen backend, accounts, 3D of externe API's.

## Modules

| Map              | Verantwoordelijkheid                                   | Mag React/DOM gebruiken |
|------------------|--------------------------------------------------------|-------------------------|
| `src/model`      | Datamodel, catalogus, scenario, raster, layout-bewerkingen, plaatsingsvalidatie, bereikbaarheid | nee |
| `src/sim`        | RNG, pathfinding, regels, wachtrijen, bezoekerslogica, incidenten, klok/runner, statistiek, rapport | nee |
| `src/game`       | Festivalreeks: edities vastleggen, kapitaal doorschuiven, vergelijken | nee |
| `src/render`     | Canvas-renderer — **leest** state, muteert nooit       | alleen Canvas           |
| `src/storage`    | IndexedDB-saves en validatie van savebestanden         | alleen IndexedDB        |
| `src/ui`         | React-interface                                        | ja                      |

Bestanden:

- `model/types.ts` — `TileGrid`, `Facility`, `Stage`, `FestivalLayout`, `Act`, `Performance`, `Program`, `ScenarioSettings`
- `model/catalog.ts` — voorzieningsdefinities en categorieën, productprijzen, genres, fictieve acts en gages
- `model/budget.ts` — huur van voorzieningen en paden, gages, kostenregels
- `model/economy.ts` — vraagregel (`computeDemand`), beste ticketprijs, afrekening (`settleEdition`)
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
- `sim/visitors.ts` — behoeften, beslissen, aankomst, verkoop bij afronding
- `sim/movement.ts` — beweging langs een pad (bezoekers en medewerkers)
- `sim/incidents.ts` — meldingen, toewijzing, medewerkers, dekkingslaag
- `game/campaign.ts` — `Campaign`, `EditionRecord`, `recordEdition`, `compareKpis`
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
- Vaste volgorde: aankomsten → festivaleinde → behoeften → meldingen → wachtrijen →
  bezoekers (op id) → medewerkers → statistiek.
- Heap met invoegvolgnummer en vaste buurvolgorde (N, O, Z, W) → deterministische paden.
- Geen `Math.random`, `Date` of echte tijd binnen `src/sim`.
- `hashState()` levert een vingerafdruk voor tests.

## Tick-volgorde (`step`)

1. Bezoekers met `arrivalTick ≤ tick` verschijnen op de ingang (`Entering`).
2. Op `tick == festivalEnd`: alle aanwezigen → `Leaving` (uit rijen verwijderd).
3. Behoeften en tevredenheid bijwerken.
4. Elke spelminuut (vóór festivaleinde): per bezoeker één RNG-trekking voor een melding.
5. Wachtrijen (eten, bar, toilet, merchandise): bediening aftellen, klaar → effect,
   verkoop + beslissen; rij → bediening.
6. Bezoekers in id-volgorde: beslissen indien nodig, bewegen, kijken, rusten, wachtrij verlaten.
7. Meldingen toewijzen aan de dichtstbijzijnde vrije medewerker (kostenveld per post);
   medewerkers lopen, helpen en keren terug.
8. Elke spelminuut: sample (op terrein, tevredenheid, per podium, rijlengtes, zonder doel,
   open meldingen, omzet, drukste 3×3-venster) en heatmap ophogen.
9. `tick++`; klaar als `tick ≥ 2700` of (na festivaleinde en iedereen vertrokken).

`SimulationInput` bevat naast ontwerp, programma, scenario en seed ook de vraag
(`DemandBreakdown`, met ticketprijs en bezoekersaantal) en het startkapitaal van de
editie. Het eindrapport bevat de afrekening (`EditionFinance`).

## Validatie

**Plaatsing** (`validatePlacement`): binnen raster; toegangstegel binnen raster;
niet op obstakel; niet op pad; geen overlap; footprint niet op toegangstegel van
een ander; eigen toegangstegel niet onder een andere footprint of op obstakel;
ingang op de grens en naar binnen gericht; max. 1 ingang, max. 2 podia; budget
(= kapitaal − gages, als parameter).

**Pad** (`validatePathPaint`): alleen op gras, niet onder een voorziening, budget.

**Vóór simulatie** (`validateForSimulation`):
- Fouten (blokkeren): geen ingang, geen podium, geen bereikbaar podium, huur + gages > kapitaal.
- Waarschuwingen: onbereikbare voorziening (met uitleg welk afgesloten gebied en
  wat het insluit), geen eetkraam/bar/toilet, geen EHBO-/beveiligings-/awarenesspost,
  geen optredens, podium zonder optreden.

## Opslaan (IndexedDB)

Database `festival-architect`, store `saves`, sleutel = naam.

```ts
interface SaveFile { version: 2; name: string; savedAt: string; campaign: Campaign }
interface Campaign {
  version: 2; name: string; scenarioId: string; startCapital: number;
  editions: EditionRecord[];   // ontwerp, programma, prijs, seed, rapport incl. afrekening
  draft: EditionDraft;         // concept voor de volgende editie
}
```

Een lopende simulatie wordt **niet** opgeslagen; na herladen start de simulatie
opnieuw vanaf het begin. De reeks wordt automatisch bewaard onder `__autosave__`.
Bij laden wordt de vorm gecontroleerd (`parseSave`); een v1-save (los ontwerp)
wordt omgezet naar een nieuwe reeks zonder edities.

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
| 10| Rapport helpt verbeteren              | `tests/report.test.ts`, `tests/campaign.test.ts` |
| v2| Economie: vraag en afrekening         | `tests/economy.test.ts`                |
| v2| Edities: kapitaal en reputatie doorschuiven, vergelijken | `tests/campaign.test.ts` |
| v2| Zorg en veiligheid: toewijzing, aanlooptijd, niet geholpen, dekking | `tests/incidents.test.ts` |
