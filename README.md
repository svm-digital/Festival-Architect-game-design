# Festival Architect

Fictieve browsergame: ontwerp een klein festivalterrein, stel een programma samen en
laat een vereenvoudigde bezoekerssimulatie draaien. Lees het rapport, pas het ontwerp
aan en simuleer opnieuw met dezelfde seed.

> Alle uitkomsten komen uit een vereenvoudigd spelmodel. Dit is geen crowd-safetytool,
> geen evenementenadvies en doet geen uitspraken over veilige bezoekerscapaciteit.

## Starten

```bash
npm install
npm run dev        # ontwikkelserver op http://localhost:5173
npm run typecheck
npm run lint
npm test           # Vitest, 45 tests
npm run build      # productiebuild in dist/
```

## Spelen

1. **Terrein** — plaats een ingang op de rand, één of twee podia, eetkramen, toiletten
   en zitgebieden; teken paden. `R` draait de toegang, `Esc` stopt een gereedschap,
   `Del` verwijdert de selectie. Rood = ongeldig, met de reden in het paneel.
   "Voorbeeldontwerp" laadt een speelbaar startpunt.
2. **Programma** — kies per podium en tijdslot een fictieve act; stel seed en aantal
   bezoekers (max. 150) in.
3. **Simulatie** — start, pauze, 1×/2×/4×, reset. Het terrein is vergrendeld.
4. **Rapport** — wachttijden, podia, piekmomenten, onbereikbare en onderbenutte
   voorzieningen, budget en verbeterpunten.

Opslaan gebeurt in IndexedDB in je eigen browser. Een lopende simulatie wordt niet
opgeslagen.

## Documentatie

- [GAME_DESIGN.md](GAME_DESIGN.md) — spelregels en getallen
- [SPEC.md](SPEC.md) — architectuur, tick-volgorde, determinisme, validatie, saves
- [TASKS.md](TASKS.md) — voortgang, beperkingen, vervolgstappen
