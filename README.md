# Street View Metingen met AHN

Een webapp om direct in **Google Street View** punten en lijnen te tekenen. Met de optionele AHN-modus worden punten op het **digitale terreinmodel (DTM)** geprojecteerd, zodat hoogteverschillen in maaiveld meewegen. De gebruiker ziet horizontale en 3D-segmentlengtes en hoogtes in meters ten opzichte van **NAP**.

> **Indicatieve metingen, geen survey.** Het digitale terreinmodel is onafhankelijk van het Street View-beeld. De kijkrichting, camerahoogte boven maaiveld, de panorama-geometrie en het moment waarop foto en AHN zijn ingewonnen kunnen sterk afwijken. Het DTM bevat geen gevelhoogtes of betrouwbare punten op bruggen, muren, bomen of daken. Gebruik de gegevens niet om kabels uit te zetten, eigendomsgrenzen vast te stellen of bouwkundige maatvoering te bepalen.

## Starten

1. Maak een Google Cloud-project met facturering en schakel **Maps JavaScript API** in. Maak een API-sleutel met passende API- en HTTP-referrerrestricties.
2. Start een statische webserver in de repository, bijvoorbeeld `python -m http.server 8000`.
3. Open `http://localhost:8000`, vul de sleutel in en klik **Street View openen**.
4. Kies een locatie via breedte- en lengtegraad of navigeer in Street View.
5. **AHN-maaiveldhoogtes gebruiken (DTM)** staat standaard aan. De applicatie vraagt de **maaiveldhoogte bij de camera** bij PDOK op. Wacht tot de hoogte in **m NAP** wordt getoond.
6. Klik **Meetlijn** en vervolgens op zichtbare **grond** in Street View. Elke klik bepaalt een punt op het AHN-terreinprofiel langs de kijklijn (maximaal 150 m van de camera).
7. Resultaten tonen de **horizontale lengte**, de **3D-lengte van rechte lijnsegmenten**, de **hoogte van het laatst aangeklikte punt** en een **hoogteverschil**. Naast meetpunten staat de indicatieve NAP-hoogte.
8. Met **+ Nieuwe lijn**, **Ongedaan** en **Alle metingen wissen** beheer je de lijnen. Met **Navigeren** (of Escape) bedien je Street View weer.

De app vraagt een **camerahoogte boven lokaal maaiveld** in meters (standaard 2,5 m). Omdat Street View deze echte hoogte niet via de viewer opgeeft, blijft dit een onzekerheidsbron. Bij wijziging van de camerahoogte worden AHN-meetpunten gewist: klik opnieuw met de bijgewerkte aanname.

## AHN-dienst

De app gebruikt de publieke [PDOK AHN WMS](https://www.pdok.nl/ogc-webservices/-/article/actueel-hoogtebestand-nederland-ahn) (laag `dtm_05m`) met `GetFeatureInfo` voor maaiveldhoogtes in meters NAP. Er is **geen extra AHN-API-sleutel** nodig. De browser gebruikt deze webservice direct. Dit vereist dat de PDOK-dienst bereikbaar is en cross-origin verzoeken toestaat. Een fout of ontbrekende rasterwaarde wordt gemeld: **de applicatie valt niet stilzwijgend terug op vlak maaiveld**.

- **DTM** modelleert het maaiveld, met bebouwing en begroeiing verwijderd. Voor gevels/daken is geen correcte 3D-afstand mogelijk met alleen AHN-DTM en één Street View-foto.
- De camera wordt aangenomen op `AHN_camera + ingevoerde camerahoogte`.
- Een klik op het panorama wordt een kijkstraal vanuit de virtuele camera. Langs die straal worden lokaal verschillende AHN-hoogtes opgevraagd. Een eerste overgang van boven het terrein naar op/onder het terrein wordt verfijnd tot circa 0,5 meter *langs de grond*. Dit is de **monsterafstand van het algoritme**, geen beloofde meetnauwkeurigheid.
- Aangeklikte punten worden bewaard als lokale oost/noord/elevatiecoördinaten en opnieuw getekend bij draaien of zoomen binnen hetzelfde panorama.
- De **3D-lengte** is de som van **rechte** ruimtelijke lijnstukken tussen gekozen punten, **niet** de lengte van een pad dat de fijnere helling van de bodem exact volgt.
- Wanneer een panorama of camerastandplaats verandert, worden de meetpunten gewist en wordt het AHN-referentieniveau vernieuwd. Zo worden punten niet aan een verkeerde foto gekoppeld.
- Ontbrekende AHN-data kunnen voorkomen bij water, bruggen, objecten, aan landsgrenzen en in nieuwe of niet-ingewonnen gebieden.

De WMS `GetFeatureInfo`-aanroep vraagt alleen rasterwaardes op geselecteerde locaties. Voor grotere aantallen metingen of hoogfrequent profileren is een raster- of tileservice met lokale sampling efficiënter.

## Vlakke modus zonder AHN

Schakel **AHN-maaiveldhoogtes gebruiken** uit. De app gebruikt dan de oorspronkelijke aanname van een vlak maaiveld op de camerapositie. Deze modus werkt ook buiten Nederland, maar kent **geen** absolute NAP-hoogte of terreinhelling.

## Beperkingen

- Camerahoogte, hellingshoek, camera-oriëntatie, Street View-rendering en tijdsverschil tussen foto en AHN introduceren onzekerheid. Reken niet op decimeter- of centimeterprecisie.
- Er is geen 3D-dieptekaart in de gebruikte Google Street View API en geen automatische identificatie van grond tegenover muren/daken/vegetatie. Klik uitsluitend op vrij zichtbaar maaiveld.
- Het huidige terreinmodel kan kleine hoogteverschillen missen, vooral tussen bemonsterde meetpunten. De eerste gevonden terrein-kruising hoeft niet het object te zijn dat in het panorama wordt aangeklikt.
- De applicatie leest hoogtes bij PDOK via browser-`fetch` en slaat geen meetpunten permanent op.
- Google Maps API-gebruik kan betaald zijn; raadpleeg de Maps Platform-prijzen.

## Tests

Node.js 18+:

```sh
npm test
```

De tests controleren o.a. projectie, camerahoeken, opnieuw tekenen, PDOK-verzoekopbouw, hoogteparse, ontbrekende waarden, vlak terrein, hellingen, opgaande kijklijnen en 3D-afstand. De GitHub Actions-workflow voert de tests uit bij pushes en pull requests. Een volledige browsertest met echte Street View-API-sleutel en live PDOK-netwerkverkeer blijft nodig.

## Bestanden

```
index.html                Webinterface / AHN-keuze
styles.css                Layout en knoppen
src/app.mjs               Street View-bediening, meetpunten en resultaten
src/geometry.mjs          Panorama-geometrie en 3D-projectie
src/ahn.mjs               PDOK-WMS-client en ray/terrain-intersectie
test/*.test.mjs           Unit tests
```

Bronnen: [PDOK AHN](https://www.pdok.nl/ogc-webservices/-/article/actueel-hoogtebestand-nederland-ahn) en [Google Maps JavaScript Street View API](https://developers.google.com/maps/documentation/javascript/streetview).
