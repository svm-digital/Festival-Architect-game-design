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
- [x] Tests: plaatsing, bereikbaarheid, pathfinding, wachtrijen, determinisme, runner, opslag, rapport, volledige run
- [x] Typecheck, lint, tests, productiebuild

## v2 — Edities en economie
- [x] Nieuwe voorzieningen: bar, merchandisestand, EHBO-post, beveiligingspost, awarenesspost
- [x] Dorst als behoefte; merchandise als vrije keuze
- [x] Meldingen + medewerkers als spelmechaniek, met dekkingslaag
- [x] Geld: huur per editie, gages, productverkoop met inkoop, ticketprijs
- [x] Vraagregel: prijs × line-up × reputatie, max 150 (uitverkocht)
- [x] Festivalreeks: edities vastleggen, kapitaal en reputatie doorschuiven, proefrun
- [x] Vergelijken: verschillen per kerncijfer, verloop per editie, twee edities naast elkaar
- [x] Statistieken: KPI-balk, compacter simulatiepaneel, rapport met tabbladen
- [x] Saves v2 (hele reeks) met omzetting van v1-saves
- [x] Tests: 61 (economie, reeks, meldingen, opslag v2, uitgebreide invarianten)

## Bekende beperkingen
- Een lopende simulatie wordt niet opgeslagen; na herladen start de run opnieuw.
- Geen undo/redo in de bouwmodus.
- Voorzieningen kunnen niet verplaatst worden; verwijderen (volledige terugbetaling) en opnieuw plaatsen.
- Bezoekers ontwijken drukte niet; drukte is alleen een indicator.
- Zitgebieden worden met de huidige regels weinig gebruikt (energie daalt langzaam).
- De piekmomenten noemen de dichtstbijzijnde voorziening (op middelpunt), niet het exacte knelpunt.
- Productprijzen staan vast; alleen de ticketprijs is instelbaar.
- Meldingen zijn een fictieve kansregel, geen model van echte incidenten.
- Een editie kan niet ongedaan worden gemaakt; alleen een nieuwe reeks starten.

## Mogelijke volgende stappen
- Undo/redo en verplaatsen van voorzieningen
- Productprijzen (drank, eten, merch) instelbaar maken
- Reeksdoelen (bijv. 5 edities, eindscore)
- Heatmap per tijdvenster (slider) in plaats van alleen cumulatief
- Balans van energie en zitgebieden herzien
- Meerdere scenario's
