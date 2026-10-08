# Street View Metingen

Een kleine, dependency-vrije webapp om **meetpunten en meetlijnen direct bovenop Google Street View** te plaatsen. Bij draaien en zoomen blijven de punten aan hun geschatte locatie in hetzelfde panorama gekoppeld.

> **Let op:** dit is een **indicatieve grondmeting** op basis van perspectief, een ingestelde camerahoogte en een vlak maaiveld. Google Street View verstrekt via de gebruikte Maps JavaScript API geen nauwkeurige diepte per aangeklikte pixel. Metingen op gebouwen, muren, bomen en ander verticaal oppervlak zijn niet geldig. Gebruik de uitkomst nooit voor landmeten, uitzetten, kabelregistratie of kadastrale/juridische afstanden.

## Starten

1. Maak in Google Cloud een project met facturering. Schakel de **Maps JavaScript API** in en maak een API-sleutel. Beperk die sleutel bij voorkeur tot de gebruikte website/HTTP-referrer en de Maps JavaScript API.
2. Host de map lokaal met bijvoorbeeld `python -m http.server 8000` (of een andere statische webserver).
3. Open `http://localhost:8000` in je browser. Vul de eigen API-sleutel in en klik **Street View openen**. De sleutel wordt niet opgeslagen door deze app; hij is zoals gebruikelijk voor browser-API's zichtbaar in netwerkverkeer.
4. Vul eventueel breedte- en lengtegraad in en kies **Ga naar locatie**.
5. Navigeer naar de juiste foto, kies **Meetlijn** en klik op zichtbare **vlakke grond** om meetpunten te plaatsen. Vanaf twee punten verschijnen lijn en segmentafstand in meters.
6. Kies **+ Nieuwe lijn** om zonder verbinding met de vorige een nieuwe lijn te starten. **Ongedaan** en **Alle metingen wissen** beheren de punten. **Navigeren** geeft de Street View-bediening terug; **Escape** werkt ook. Tijdens meten kun je met het muiswiel in-/uitzoomen.
7. Pas **Geschatte camerahoogte** aan (standaard **2,5 m**) als je de echte cameraopstelling kent. De afstand wordt automatisch opnieuw berekend.

De metingen worden uit veiligheid bij wisselen van panorama of camerapositie gewist; ze zijn niet opgeslagen in een database en worden bij herladen niet bewaard.

## Hoe werkt het?

Een klik in de panoramaviewer geeft een 2D-schermpositie. Uit de actuele Google Street View-heading, pitch, zoom en viewergrootte wordt een kijkstraal (3D) geconstrueerd via een perspectiefmodel. De horizontale beeldhoek wordt benaderd met `180° / 2^zoom`.

Omdat een enkel beeld **geen afstand tot het aangeklikte object** vastlegt, nemen we aan dat:

- Het aangeklikte punt op het **zelfde horizontale maaiveld** ligt als waarboven de camera zich bevindt.
- De camera zich op de handmatig ingevoerde hoogte `h` boven dit vlak bevindt.
- De panorama-renderer voldoende overeenkomt met het gebruikte perspectiefmodel.

Voor een straal `(east, north, up)` wordt het snijpunt met het maaiveld berekend:

```text
t = -h / up            (alleen bij up < 0)
P = (t * east, t * north)
afstand(A,B) = hypot(A.east - B.east, A.north - B.north)
```

De wereldrichting van de straal wordt opgeslagen, niet de schermpixel. Daardoor kunnen de punten opnieuw naar het scherm worden geprojecteerd wanneer je binnen **hetzelfde panorama** draait of zoomt. Metingen verder dan **150 m** van de camera, boven de horizon of bij een extreem brede FOV worden geweigerd.

### Nauwkeurigheid en beperkingen

- Afstanden zijn **schattingen**. Fouten kunnen aanzienlijk zijn door camerahoogte, helling, panorama-levelling, stitching, beeldhoek en klikprecisie.
- **Geen verticale hoogtemeting** of afstand over gevels, stoepranden, obstakels of hoogteverschillen. Een klik op een gevel levert hooguit het snijpunt van die beeldstraal met een hypothetische vlakke grond.
- Nauwkeurige 3D-metingen vergen gekalibreerde camerageometrie en betrouwbare diepte-informatie, een 3D-pointcloud of meerdere gekalibreerde cameraposities met triangulatie.
- In deze versie kun je punten na plaatsen niet slepen; gebruik **Ongedaan** en klik opnieuw.
- Google Maps Platform kan kosten in rekening brengen voor gebruik van de viewer. Controleer de actuele prijzen en voorwaarden.

## Tests

De geometrie is een zelfstandig ES-module zonder npm-afhankelijkheden. Met **Node.js 18+**:

```sh
npm test
```

De tests controleren camerahoek, ray-ground-intersectie, headings, reprojectie tijdens draaien/zoomen, het uitsluiten van horizon/hemel en schaling met camerahoogte. Een GitHub Actions-workflow voert deze tests uit bij pushes en pull requests.

## Structuur

```
index.html                Interface
styles.css                Responsive uiterlijk
src/app.mjs               Interactie met Google StreetViewPanorama
src/geometry.mjs          Projectie, grondpunten en afstand
test/geometry.test.mjs    Geometrietests
```

Gebouwd met de officiële [Maps JavaScript API / Street View](https://developers.google.com/maps/documentation/javascript/streetview).
