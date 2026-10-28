# Festival Architect — Game Design

> Fictieve browsergame. Alle uitkomsten komen uit een **vereenvoudigd spelmodel**.
> Het is geen crowd-safetytool en geen evenementenadvies. Er worden geen uitspraken
> gedaan over veilige bezoekerscapaciteit.

## 1. Fantasie en kernlus

De speler is de terreinontwerper van een klein, fictief festival. Op een vast raster
legt de speler paden, podia en voorzieningen aan, stelt een programma samen en kijkt
daarna hoe 150 miniatuurbezoekers zich over het terrein bewegen.

```
Ontwerpen → Programma → Simuleren → Rapport lezen → Ontwerp aanpassen → (zelfde seed) opnieuw
```

De herhaalbare verbeterlus is het belangrijkste. Omdat dezelfde layout, hetzelfde
programma en dezelfde seed altijd hetzelfde resultaat geven, ziet de speler precies
wat één ontwerpwijziging oplevert.

## 2. Scenario

**"Ontwerp een compact festival binnen het beschikbare budget."**

| Instelling           | Waarde                                  |
|----------------------|-----------------------------------------|
| Raster               | 32 × 24 tegels                          |
| Bouwbudget           | € 60.000                                |
| Bezoekers            | 150 (instelbaar 10–150)                 |
| Festivalduur         | 240 spelminuten (14:00–18:00)           |
| Uitloop              | 30 spelminuten (tot 18:30)              |
| Aankomstvenster      | 14:00–15:30                             |
| Tijdsloten           | 14:20–15:20, 15:40–16:40, 17:00–18:00   |
| Standaard seed       | 2026                                    |

Het terrein bevat vaste obstakels (bomen, een vijver, rotsen). De speler kan deze
niet verplaatsen.

## 3. Terrein en voorzieningen

Tegeltypes: **gras** (begaanbaar, langzamer), **pad** (begaanbaar, sneller),
**obstakel** (niet begaanbaar).

| Voorziening     | Maat | Kosten   | Capaciteit        | Servicetijd | Max |
|-----------------|------|----------|-------------------|-------------|-----|
| Ingang/uitgang  | 3×1  | € 4.000  | —                 | —           | 1   |
| Podium          | 5×3  | € 15.000 | publiekszone      | —           | 2   |
| Eetkraam        | 2×2  | € 4.000  | 2 tegelijk        | 3 min       | —   |
| Toiletblok      | 3×2  | € 3.000  | 3 tegelijk        | 2 min       | —   |
| Zitgebied       | 3×2  | € 1.500  | 6 zitplaatsen     | tot uitgerust | — |
| Pad (per tegel) | 1×1  | € 50     | —                 | —           | —   |

- Elke voorziening heeft één **toegangstegel** direct naast de footprint, aan de
  kant waar hij naartoe gedraaid is (draaien met `R`).
- Voorzieningen zelf zijn niet begaanbaar. Alleen via de toegangstegel kom je erin.
- De ingang staat altijd op de terreingrens, met de toegang naar binnen gericht.
- Een podium heeft een **publiekszone** van 5 tegels diep en (breedte + 2) breed
  voor de toegangskant. Kijkers kiezen een vrije, bereikbare tegel in die zone.
- Verwijderen in bouwmodus geeft de volledige kosten terug.

## 4. Programma

- Drie tijdsloten, maximaal twee podia → maximaal zes optredens.
- Per podium en tijdslot kies je één fictieve act. Elke act mag één keer geboekt worden.
- Een act heeft een genre (pop, rock, elektronisch, folk) en een populariteit (1–10).
- Elke bezoeker heeft één voorkeursgenre.

## 5. Bezoekers — spelregels

Alle behoeften lopen van 0 tot 100. Tijd wordt gemeten in spelminuten.

### Behoeften per spelminuut

| Behoefte      | Regel                                                                 |
|---------------|-----------------------------------------------------------------------|
| Honger        | +0,35 / min (niet tijdens bediening bij eetkraam)                    |
| Toiletbehoefte| +0,45 / min (niet tijdens bediening bij toilet)                      |
| Energie       | lopen −0,35; kijken −0,25; wachtrij −0,15; zitten +4; staan rusten +0,5 |

Startwaarden (seeded): honger 0–35, toilet 0–30, energie 60–100, tevredenheid 50.

**Drempels** (zoeken bij het eerstvolgende beslismoment): honger ≥ 65, toilet ≥ 70, energie ≤ 30.
**Kritiek** (onderbreekt kijken of rusten direct): honger ≥ 90, toilet ≥ 90, energie ≤ 10.

### Tevredenheid per spelminuut

| Situatie                                  | Effect                           |
|-------------------------------------------|----------------------------------|
| Kijken naar act met eigen genre           | + populariteit × 0,035           |
| Kijken naar act met ander genre           | + populariteit × 0,012           |
| In de wachtrij staan                      | −0,25                            |
| Honger of toilet kritiek (per behoefte)   | −0,4 / −0,5                      |
| Energie kritiek                           | −0,3                             |
| Behoefte zonder bereikbare voorziening    | −0,3                             |
| Zitten in zitgebied                       | +0,1                             |
| Eten ontvangen / toilet bezocht (eenmalig)| +6 / +3                          |
| Wachtrij verlaten na 20 min (eenmalig)    | −8                               |
| Zitgebied vol bij aankomst (eenmalig)     | −3                               |

Tevredenheid < 15 bij een beslismoment → de bezoeker vertrekt vroegtijdig.

### State machine

```
Entering → (beslissen) → Walking → Watching | Queuing → BeingServed | Resting
                                    ↑______________________________________|
Festival voorbij of tevredenheid < 15 → Leaving → (uitgang) → vertrokken
```

**Beslismomenten**: na binnenkomst, na bediening, na rusten, als een act eindigt
zonder nieuwe act binnen 10 minuten, bij een kritieke behoefte, bij een volle
zitplaats of na het verlaten van een wachtrij. Tijdens het lopen wordt **niet**
opnieuw beslist (voorkomt voortdurend wisselen van bestemming).

**Beslisvolgorde**
1. Festival voorbij → naar de uitgang.
2. Tevredenheid < 15 → vroegtijdig vertrekken.
3. Behoeften boven drempel, hoogste eerst: kies de voorziening van dat type met de
   laagste verwachte kosten = looptijd + (wachtenden + in bediening) / capaciteit × servicetijd.
   Geen bereikbare voorziening → markering "zonder bereikbaar doel".
4. Een podium met een act die nu speelt of binnen 10 minuten begint:
   score = populariteit/10 × (1 bij eigen genre, anders 0,4) + toeval(0–0,25) − 0,004 × afstand.
5. Anders: rondslenteren naar een willekeurige bereikbare tegel (70% kans op een pad)
   en daar 3–8 minuten staand rusten.

### Wachtrijen

- Bezoeker sluit aan op de toegangstegel (logisch wachtrijpunt), FIFO.
- Elke tick: bediening loopt af → vrijgekomen plekken worden uit de rij gevuld.
- Na 20 minuten wachten verlaat de bezoeker de rij en mijdt deze voorziening 15 minuten.
- Bij vertrek (festival voorbij) wordt de bezoeker uit rij, bediening en zitplaats verwijderd.

### Beweging

- Raster, 4 richtingen, A*-pathfinding en kostenvelden (Dijkstra) per voorziening.
- Padtegel kost 1, grastegel 1,5 → bezoekers verkiezen paden.
- Snelheid: 3 tegels/min op pad, 2 tegels/min op gras.
- Geen botsingen of duwen. Meerdere bezoekers mogen op één tegel staan.
- Drukte wordt alleen als spelindicator getoond (heatmap, piekmomenten).

## 6. Inzichten

Live: bezoekers op terrein, gemiddelde tevredenheid, bezoekers per podium,
wachtrij per voorziening, bezoekers zonder bereikbaar doel, heatmap.

Eindrapport: gemiddelde wachttijd per voorziening, populairste podium, momenten met
hoge bezetting (3×3-tegelvenster), onbereikbare en onderbenutte voorzieningen,
budgetoverzicht en concrete verbeterpunten. Alles gelabeld als spelmodeluitkomst.

## 7. Buiten scope (v1)

Echte crowd-safetymodellering, 3D, multiplayer, tickets, weer, personeel, afval,
stroom, logistiek, echte artiesten, vrije terreinvormen, opslaan midden in een run.
