# Festival Architect — Game Design (v2)

> Fictieve browsergame. Alle uitkomsten komen uit een **vereenvoudigd spelmodel**.
> Het is geen crowd-safetytool en geen evenementenadvies. Er worden geen uitspraken
> gedaan over veilige bezoekerscapaciteit. Incidenten, hulpposten en bedragen zijn
> verzonnen spelmechanieken.

## 1. Fantasie en kernlus

De speler organiseert een klein, fictief festival dat elk jaar terugkomt. Per editie
ontwerpt de speler het terrein, kiest het programma en de ticketprijs, en kijkt hoe
de bezoekers zich gedragen. Na afloop volgt een rapport met verbeterpunten en een
afrekening. Winst of verlies schuift door naar de volgende editie.

```
Editie N: ontwerpen → programma + ticketprijs → simuleren → rapport + afrekening
   ↓ kapitaal, ontwerp en reputatie schuiven door
Editie N+1: verbeterpunten doorvoeren → … → vergelijken met eerdere edities
```

Een **proefrun** draait hetzelfde, maar telt niet mee voor kapitaal of reputatie.
Zo kan de speler eerst uitproberen. Dezelfde layout, prijs, programma en seed geven
altijd hetzelfde resultaat.

## 2. Scenario

**"Bouw over meerdere edities een compact festival dat bezoekers tevreden houdt en geld oplevert."**

| Instelling           | Waarde                                  |
|----------------------|-----------------------------------------|
| Raster               | 32 × 24 tegels                          |
| Startkapitaal        | € 10.000                                |
| Max. bezoekers       | 150 (terreinlimiet van het spel)        |
| Festivalduur         | 240 spelminuten (14:00–18:00)           |
| Uitloop              | 30 spelminuten (tot 18:30)              |
| Aankomstvenster      | 14:00–15:30                             |
| Tijdsloten           | 14:20–15:20, 15:40–16:40, 17:00–18:00   |
| Standaard seed       | 2026                                    |

Het terrein bevat vaste obstakels (bomen, een vijver, rotsen).

> Bedragen zijn geschaald naar 150 bezoekers. Met de bedragen uit v1 (€ 60.000
> bouwbudget) kon geen enkel ontwerp winst maken, dus alle kosten zijn in v2 verlaagd.

## 3. Geld

### Vaste kosten per editie (huur inclusief bezetting)

| Voorziening        | Maat | Huur    | Capaciteit / bezetting       | Servicetijd | Max |
|--------------------|------|---------|------------------------------|-------------|-----|
| Ingang/uitgang     | 3×1  | € 400   | —                            | —           | 1   |
| Podium             | 5×3  | € 800   | publiekszone                 | —           | 2   |
| Eetkraam           | 2×2  | € 300   | 2 tegelijk                   | 3 min       | —   |
| Bar                | 3×2  | € 350   | 3 tappunten                  | 1 min       | —   |
| Toiletblok         | 3×2  | € 250   | 3 cabines                    | 2 min       | —   |
| Zitgebied          | 3×2  | € 120   | 6 zitplaatsen                | tot uitgerust | — |
| Merchandisestand   | 2×2  | € 250   | 2 tegelijk                   | 2 min       | —   |
| EHBO-post          | 2×2  | € 350   | 2 hulpverleners              | —           | —   |
| Beveiligingspost   | 2×1  | € 300   | 2 beveiligers                | —           | —   |
| Awarenesspost      | 2×1  | € 200   | 2 awarenessmedewerkers       | —           | —   |
| Pad (per tegel)    | 1×1  | € 5     | —                            | —           | —   |
| Gage per act       | —    | populariteit × € 40 | —                | —           | —   |

Voorzieningen en paden worden elke editie opnieuw gehuurd. Huur plus gages moeten
binnen het beschikbare kapitaal passen, anders kan de editie niet starten.

### Inkomsten

| Bron          | Verkoopprijs | Inkoop |
|---------------|--------------|--------|
| Ticket        | instelbaar € 10–100 | — |
| Eten          | € 8          | € 3    |
| Drank         | € 5          | € 1,50 |
| Merchandise   | € 20         | € 8    |

Verkoop telt pas als de bediening is afgerond.

### Afrekening

```
resultaat      = tickets + verkoop − inkoop − huur − gages
kapitaal(N+1)  = kapitaal(N) + resultaat(N)
```

Bij kapitaal ≤ € 0 is de reeks failliet; de speler start dan een nieuwe reeks.

### Vraag: hoeveel bezoekers komen er?

```
bezoekers = 150 × prijsfactor × line-upfactor × reputatiefactor   (afgerond, 10–150)
prijsfactor     = 1,2 − 0,01 × ticketprijs              (begrensd 0,15–1,0)
line-upfactor   = 0,85 + 0,04 × gemiddelde populariteit  (zonder acts: 0,8)
reputatiefactor = 1 + 0,01 × (tevredenheid vorige editie − 60)  (begrensd 0,75–1,25; editie 1: 1)
```

Als de vraag boven 150 uitkomt, is het festival **uitverkocht**. Een hogere prijs levert
dan meer op zonder bezoekers te verliezen. Het rapport rekent de ticketprijs (in stappen
van € 5) met de hoogste ticketomzet uit. Minder bezoekers betekent wel minder verkoop.

## 4. Programma

- Drie tijdsloten, maximaal twee podia → maximaal zes optredens.
- Per podium en tijdslot één fictieve act; elke act één keer per editie.
- Act: genre (pop, rock, elektronisch, folk), populariteit (1–10), gage.
- Populaire acts trekken meer bezoekers (line-upfactor) en meer kijkers, maar kosten meer.

## 5. Bezoekers — spelregels

Alle behoeften lopen van 0 tot 100. Tijd in spelminuten.

### Behoeften per spelminuut

| Behoefte      | Regel                                                                 |
|---------------|-----------------------------------------------------------------------|
| Honger        | +0,35 / min (niet tijdens bediening bij eetkraam)                    |
| Dorst         | +0,6 / min (niet tijdens bediening bij bar)                          |
| Toiletbehoefte| +0,45 / min (niet tijdens bediening bij toilet)                      |
| Energie       | lopen −0,35; kijken −0,25; wachtrij −0,15; zitten +4; staan rusten +0,5 |

Startwaarden (seeded): honger 0–35, dorst 0–30, toilet 0–30, energie 60–100, tevredenheid 50.

**Drempels** (zoeken bij het eerstvolgende beslismoment): honger ≥ 65, dorst ≥ 55, toilet ≥ 70, energie ≤ 30.
**Kritiek** (onderbreekt kijken of rusten direct): honger ≥ 90, dorst ≥ 90, toilet ≥ 90, energie ≤ 10.

### Tevredenheid per spelminuut

| Situatie                                  | Effect                           |
|-------------------------------------------|----------------------------------|
| Kijken naar act met eigen genre           | + populariteit × 0,035           |
| Kijken naar act met ander genre           | + populariteit × 0,012           |
| In de wachtrij staan                      | −0,25                            |
| Honger / dorst / toilet kritiek           | −0,4 / −0,4 / −0,5               |
| Energie kritiek                           | −0,3                             |
| Behoefte zonder bereikbare voorziening    | −0,3                             |
| Zitten in zitgebied                       | +0,1                             |
| Eten / drankje / toilet / merchandise (eenmalig) | +6 / +3 / +3 / +4         |
| Wachtrij verlaten na 20 min (eenmalig)    | −8                               |
| Zitgebied vol bij aankomst (eenmalig)     | −3                               |
| Hulp binnen 5 / binnen 10 / later (eenmalig) | +2 / −3 / −8                  |
| Melding niet geholpen (eenmalig)          | −15                              |

Tevredenheid < 15 bij een beslismoment → de bezoeker vertrekt vroegtijdig.

### State machine

```
Entering → (beslissen) → Walking → Watching | Queuing → BeingServed | Resting
                                    ↑______________________________________|
Elke niet-lopende toestand → BeingHelped (melding) → beslissen
Festival voorbij of tevredenheid < 15 → Leaving → (uitgang) → vertrokken
```

**Beslisvolgorde**
1. Festival voorbij → naar de uitgang.
2. Tevredenheid < 15 → vroegtijdig vertrekken.
3. Behoeften boven drempel, hoogste eerst (toilet, drank, eten, zitten): kies de voorziening
   met de laagste verwachte kosten = looptijd + (wachtenden + in bediening) / capaciteit × servicetijd.
   Geen bereikbare voorziening → markering "zonder bereikbaar doel".
4. Podium met een act die nu speelt of binnen 10 min begint:
   score = populariteit/10 × (1 bij eigen genre, anders 0,4) + toeval(0–0,25) − 0,004 × afstand.
5. Vrij moment: als nog geen merchandise gekocht en tevredenheid ≥ 55: 35% kans om
   naar de beste merchandisestand te gaan (één aankoop per bezoeker).
6. Anders: rondslenteren naar een willekeurige bereikbare tegel (70% kans op een pad)
   en daar 3–8 minuten staand rusten.

Tijdens het lopen wordt niet opnieuw beslist.

### Wachtrijen

- FIFO op de toegangstegel; capaciteit en vaste servicetijd per voorziening.
- Na 20 minuten wachten verlaat de bezoeker de rij en mijdt deze voorziening 15 minuten.
- Bij vertrek of een melding wordt de bezoeker uit rij, bediening en zitplaats verwijderd.

### Beweging

- Raster, 4 richtingen, A* en kostenvelden. Pad kost 1, gras 1,5.
- Bezoekers: 3 tegels/min op pad, 2 op gras. Medewerkers: 4 tegels/min, kortste aantal tegels.
- Geen botsingen of duwen. Drukte is alleen een spelindicator.

## 6. Zorg en veiligheid (fictieve spelmechaniek)

Elke spelminuut trekt het spel per aanwezige bezoeker (niet bij binnenkomen, vertrekken,
bediening of al geholpen worden) één keer of er een melding ontstaat:

| Soort    | Basiskans/min | Extra kans                                            | Post             | Hulptijd |
|----------|---------------|-------------------------------------------------------|------------------|----------|
| Medisch  | 0,0003        | +0,002 bij energie < 15; +0,001 bij dorst > 90        | EHBO-post        | 6 min    |
| Conflict | 0,0002        | +0,0015 bij tevredenheid < 30; +0,001 na ≥ 10 min in de rij | Beveiligingspost | 4 min |
| Welzijn  | 0,0003        | +0,0006 bij energie < 25; +0,0006 bij tevredenheid < 35 | Awarenesspost  | 8 min    |

- De dichtstbijzijnde **vrije** medewerker van het juiste type loopt naar de bezoeker,
  helpt een vaste tijd en loopt terug.
- Geen vrije medewerker: de melding wacht. Na 20 min is ze "niet geholpen".
- Geen bereikbare post van dat type: na 10 min "niet geholpen".
- Na medische hulp heeft de bezoeker minstens 50 energie.
- De **dekkingslaag** in de bouwmodus toont per tegel de aanlooptijd vanaf de dichtstbijzijnde post:
  ≤ 3 min groen, ≤ 6 min geel, langer rood.

## 7. Edities en vergelijken

- Elke voltooide (niet-proef)run wordt een editie met ontwerp, programma, prijs, seed,
  rapport en afrekening.
- De volgende editie start met het kapitaal en het ontwerp van de vorige. De reputatie
  hangt af van de tevredenheid van de vorige editie.
- Het rapport vergelijkt elke editie met de vorige: ▲ beter, ▼ slechter, per kerncijfer.
- Het tabblad Edities toont alle edities, het verloop van kapitaal, tevredenheid en
  bezoekers, en een vergelijking tussen twee gekozen edities.
- Een eerdere editie kan als concept worden teruggezet.

Kerncijfers: resultaat, kapitaal na afloop, omzet, kosten, bezoekers, ticketprijs,
tevredenheid, gemiddelde wachttijd, niet geholpen meldingen, gemiddelde aanlooptijd hulp,
vroeg vertrokken.

## 8. Inzichten

Live (KPI-balk + paneel): klok, bezoekers, tevredenheid, omzet (per bron), open meldingen,
zonder doel, wachtrijen per voorziening, bezetting van hulpposten, kijkers per podium, heatmap.

Rapport (tabbladen): Overzicht (verbeterpunten, verloop, kerncijfers met verschillen),
Geld (afrekening en ticketvraag), Voorzieningen (wachttijd, gebruik, omzet, piekmomenten),
Zorg (meldingen en posten), Programma (podia, acts, gages).

## 9. Buiten scope

Echte crowd-safetymodellering, 3D, multiplayer, echte ticketverkoop, weer, personeelsroosters,
afval, stroom, logistiek, echte artiesten, vrije terreinvormen, opslaan midden in een run.
