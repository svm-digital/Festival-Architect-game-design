# Festival Architect — Taken

## Fase 0 — Basis
- [x] Projectmap inspecteren (leeg, geen bestaande code)
- [x] Vite + React + TS + Tailwind + Vitest + ESLint opzetten
- [x] GAME_DESIGN.md, SPEC.md, TASKS.md

## Fase 1 — Terrein
- [x] Datamodel en catalogus
- [x] Scenario met vaste obstakels
- [x] Footprint, toegangstegel, draaien
- [x] Plaatsingsvalidatie + padvalidatie
- [x] Bereikbaarheidsanalyse met uitleg
- [x] Simulatievalidatie

## Fase 2 — Beweging
- [x] Seeded RNG
- [x] A* en kostenvelden
- [x] Eén bezoeker naar één podium
- [x] Meerdere bezoekers, fixed timestep

## Fase 3 — Behoeften en wachtrijen
- [x] Behoeften en tevredenheid volgens regels
- [x] Wachtrijsysteem (FIFO, capaciteit, servicetijd, verlaten)
- [x] Zitgebieden

## Fase 4 — Programma, statistiek, rapport
- [x] Programma-editor
- [x] Live statistieken
- [x] Heatmap
- [x] Eindrapport met verbeterpunten

## Fase 5 — Saves en polish
- [x] IndexedDB-saves + autosave
- [x] Miniatuurstijl renderer, selectie- en bereikbaarheidslagen

## Fase 6 — Kwaliteit
- [x] Tests: plaatsing, bereikbaarheid, pathfinding, wachtrijen, determinisme, runner, opslag, rapport, volledige run (45 tests)
- [x] Typecheck, lint, tests, productiebuild

## Bekende beperkingen (v1)
- Een lopende simulatie wordt niet opgeslagen; na herladen start de run opnieuw.
- Geen undo/redo in de bouwmodus.
- Voorzieningen kunnen niet verplaatst worden; verwijderen (volledige terugbetaling) en opnieuw plaatsen.
- Bezoekers ontwijken drukte niet; drukte is alleen een indicator.
- Zitgebieden worden met de huidige regels weinig gebruikt (energie daalt langzaam).
- De piekmomenten noemen de dichtstbijzijnde voorziening (op middelpunt), niet het exacte knelpunt.

## Mogelijke volgende stappen
- Undo/redo en verplaatsen van voorzieningen
- Vergelijking tussen twee rapporten (vorige vs. huidige run)
- Heatmap per tijdvenster (slider) in plaats van alleen cumulatief
- Balans van energie en zitgebieden herzien
- Meerdere scenario's
