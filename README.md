# Festival Architect

Fictieve browsergame: organiseer een klein festival over meerdere edities. Ontwerp het
terrein, kies programma en ticketprijs, laat een vereenvoudigde bezoekerssimulatie draaien
en lees het rapport met afrekening. Winst of verlies schuift door naar de volgende editie;
vergelijk de edities om te zien of je het beter hebt gedaan.

> Alle uitkomsten komen uit een vereenvoudigd spelmodel. Dit is geen crowd-safetytool,
> geen evenementenadvies en doet geen uitspraken over veilige bezoekerscapaciteit.

## Starten

```bash
npm install
npm run dev        # ontwikkelserver op http://localhost:5173
npm run typecheck
npm run lint
npm test           # Vitest, 61 tests
npm run build      # productiebuild in dist/
```

## Spelen

1. **Terrein** — ingang op de rand, één of twee podia, eetkramen, bars, toiletten,
   zitgebieden, merchandise en hulpposten (EHBO, beveiliging, awareness); paden tekenen.
   `R` draait de toegang, `Esc` stopt een gereedschap, `Del` verwijdert de selectie.
   De dekkingslaag toont de aanlooptijd vanaf hulpposten. "Voorbeeldontwerp" laadt een startpunt.
2. **Programma** — ticketprijs (bepaalt het aantal bezoekers), acts per podium en tijdslot
   (gage hangt af van populariteit), seed. Kies "Proefrun" om uit te proberen of
   "Editie N draaien" om de editie vast te leggen.
3. **Simulatie** — start, pauze, 1×/2×/4×, reset. Het terrein is vergrendeld.
4. **Rapport** — verbeterpunten, afrekening, wachttijden, meldingen, podia, met verschillen
   ten opzichte van de vorige editie.
5. **Edities** — alle edities, verloop van kapitaal en tevredenheid, twee edities vergelijken,
   een eerder ontwerp terugzetten of een nieuwe reeks starten.

De reeks wordt in IndexedDB in je eigen browser bewaard. Een lopende simulatie wordt niet
opgeslagen.

## Documentatie

- [GAME_DESIGN.md](GAME_DESIGN.md) — spelregels en getallen
- [SPEC.md](SPEC.md) — architectuur, tick-volgorde, determinisme, validatie, saves
- [TASKS.md](TASKS.md) — voortgang, beperkingen, vervolgstappen
