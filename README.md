# Streetview Metingen — Windows, Google Maps + AHN DTM/DSM

**Versie 0.4.0 (ontwikkelversie).** Windows-desktopapp om originele Google Maps Street View-beelden te bekijken en indicatieve afstanden en hoogtes te schatten met de publieke PDOK/AHN-diensten. Geen Google Cloud-account, Google Maps API-sleutel of eigen Google-beeldopslag nodig.

## Eenvoudig beginnen (zonder iframe-code)

1. Start de Windows-app en klik op **Open Google Maps in dit programma** (de kaart wordt standaard al geopend).
2. Zoek je locatie in Google Maps en open een **Street View-foto** via de bekende blauwe lijnen of thumbnails.
3. Wanneer Google Maps een herkenbare Street View-URL toont, vult de app **breedtegraad, lengtegraad en eventueel kijkrichting** als *voorstel* in. Zo niet, vul ze handmatig in.
4. Controleer de zichtbare kijkrichting, kijkhoek, **horizontale beeldhoek** en camerahoogte. De app kan de daadwerkelijke Street View-camerastand niet zonder API uitlezen. Vink **Ik heb de cameragegevens gecontroleerd** aan.
5. Kies onder **AHN-model** een van de volgende opties:
   - **DTM – maaiveld:** geen gebouwen en bomen; geschikt voor een ruwe grondmeting.
   - **DSM – daken, bomen en objecten:** inschatting op bovenoppervlakken. Als DTM op dezelfde plek beschikbaar is, zie je ook **DSM–DTM** als indicatie voor de hoogte *boven het lokale maaiveld*.
6. Klik op **Meetpunten zetten** en kies zichtbare **maaiveldpunten (DTM)** of **bovenoppervlakken (DSM)**. De beelden worden in meetmodus niet bediend, zodat de overlay niet ongemerkt verschuift.
7. Bij **Navigeren** worden bestaande meetpunten gewist; controleer na draaien, zoomen of verplaatsen de camerakalibratie opnieuw. Exporteer je meetpunten desgewenst naar CSV.

**Als de ingebouwde Google Maps-website door Google of het netwerk wordt geblokkeerd:** klik op **Alternatief: Google-insluitlink gebruiken**. Open in je reguliere browser Google Maps Street View, kies **Delen → Een kaart insluiten → HTML kopiëren**, plak die HTML en gebruik **Originele Street View tonen**. Deze optie blijft bestaan.

## Wat betekent AHN 'gebouwen' precies?

- [AHN](https://www.ahn.nl/) is hoogte-informatie. Het **DSM** geeft de hoogtes van daken, bomen en andere bovengrondse objecten; het **DTM** modelleert uitsluitend het maaiveld.
- De app **herkent niet** of een verhoogd DSM-punt een pand, boom of een ander object is. DSM–DTM is dus geen automatisch geverifieerde gebouwhoogte.
- AHN is een **2,5D-hoogteraster**, geen volledig 3D-mesh: verticale gevels, ramen, kabels en onderkanten zijn niet betrouwbaar meetbaar.
- Bij scherpe dakranden maakt de berekening een interpolatie tussen rasterpunten en kijkstralen. Daardoor kan een snijpunt een fictief tussenoppervlak zijn; controleer alle hoogtes en verwacht geen centimeter- of decimeterprecisie.
- DTM-referentiehoogte bij de camera plus **handmatig ingestelde camerahoogte** blijft nodig, ook bij de DSM-modus.

## Problemen met Google-cookiepagina

In **v0.4.0** konden de knoppen **Alles accepteren** en **Alles weigeren** vastlopen: de interne browser verbood navigatie naar `consent.google.com` of blokkeerde de opslagtoestemming. Dit is in **v0.4.1** hersteld.

- Open **Google Maps in dit programma**. Kies op Google's eigen cookiepagina zelf **Alles accepteren** of **Alles weigeren**. De app kiest **niet automatisch** en verandert je voorkeur niet.
- De keuze wordt opgeslagen binnen de permanente Google Maps-browsergegevens van dit programma. Als Maps alsnog op het toestemmingsscherm blijft, klik **Google Maps opnieuw laden**.
- Google kan soms een apart toestemmingsvenster openen. Alleen een officieel Google-toestemmingsadres is in deze aparte browser toegestaan; dezelfde cookiesessie wordt gebruikt.
- Gebruik bij een niet-werkende ingebouwde browser de bestaande alternatieve Google Maps-insluitlink. De app blijft afhankelijk van veranderingen aan Google's website en cookiesystemen.

## Camerastand automatisch bijwerken bij rondkijken (v0.4.2)

Bij de ingebouwde Google Maps-weergave controleert de desktopapp **vier keer per seconde** de zichtbare navigatie-URL van de normale Google Maps-site. De app reageert ook op Electron-navigatiegebeurtenissen.

Als Google in die URL een Street View-camerastand publiceert, worden **breedtegraad, lengtegraad, kijkrichting (heading), hellingshoek (pitch) en horizontale beeldhoek (FOV/zoom)** opnieuw ingevuld. Bij een gewijzigde camerastand worden eventuele oude metingen verwijderd en moet de gebruiker de nieuwe kalibratie bevestigen voordat er weer wordt gemeten. Bij verplaatsing van het panorama wordt de AHN-maaiveldhoogte opnieuw opgevraagd; bij alleen draaien/zoomen gebeurt geen onnodige AHN-netwerkaanvraag.

**Beperking: dit is URL-synchronisatie, géén volledige realtime-camera-API.** Google kan tijdens slepen de URL niet veranderen of pas na afloop bijwerken; sommige panoramabewegingen blijven daarom onzichtbaar voor de app. Er is geen ondersteunde manier om zonder Google Maps Platform/Street View API de interne Google Maps-camerastand iedere frame uit te lezen. De getoonde URL-waarden blijven indicatief. Controleer de uitlijning en bevestig vóór het meten de kalibratie. Google Cloud-vrije Street View via de gewone browser blijft behouden.

De iframe-fallback deelt zelfs geen live navigatie-URL: daarin blijven de cameravelden handmatig.

## Grenzen van de Google-integratie

De app toont de gewone publieke **Google Maps-website** in een geïsoleerde Electron-webweergave. Dit is **geen officiële Maps JavaScript/Street View API-integratie**. De webweergave is een experimentele desktopfunctie; Google kan delen ervan blokkeren of wijzigen. De app gebruikt geen interne Google Maps-API, onderschept geen beelden en slaat geen panoramategels op.

Omdat de camera in Google Maps niet via een ondersteunde externe interface beschikbaar is, worden Google-URL-coördinaten en heading alleen als **hints** gebruikt. Je moet cameracoördinaten, pitch, FOV en hoogte zelf controleren. De overlay kan **niet automatisch** meebewegen wanneer je een panorama draait of zoomt.

**Meetresultaten zijn indicatief. Gebruik deze tool niet voor constructieve berekeningen, kabeluitzetting, vergunningen, kadastrale grenzen of ander landmeetkundig werk.**

## Windows installeren / bouwen

Download de nieuwste Windows portable app of installer vanaf [GitHub Releases](https://github.com/LukaStuurman/streetview-metingen/releases). Voor ontwikkelaars:

```sh
npm install
npm test
npm run desktop
npm run dist:win
```

Node.js 20 of nieuwer. De oudere `index.html`-webvariant gebruikt nog steeds de Google Maps JavaScript API met eigen sleutel; de **Windows-desktopapp** wordt gestart via `npm run desktop`.

## Techniek en tests

- `desktop-google/main.cjs`: Electron desktop en beperkte externe gastbrowser.
- `desktop-google/app.mjs`: navigeren, handmatig kalibreren, meetpunten, AHN DSM/DTM, CSV.
- `desktop-google/measurement-helpers.mjs`: veilige Google Maps-links en optionele URL-camerahints.
- `src/ahn.mjs`: openbare PDOK AHN WMS GetFeatureInfo met DTM `dtm_05m` / DSM `dsm_05m` en afzonderlijke caches.
- `src/geometry.mjs`: perspectiefmodel en snijpunt tussen kijkstraal en hoogteoppervlak.
- `test/*.test.mjs`: camerageometrie, Google Maps-URLs, AHN DTM/DSM, no-data en browser fetch-context.
- `scripts/smoke-ahn.mjs`: netwerkcontrole van DTM/DSM en browser-CORS.

Bronnen: [PDOK AHN](https://service.pdok.nl/rws/ahn/wms/v1_0?SERVICE=WMS&REQUEST=GetCapabilities), [Google Maps delen en insluiten](https://support.google.com/maps/answer/7101463?hl=nl), [Electron-webweergaven](https://www.electronjs.org/docs/latest/tutorial/web-embeds), [Google Maps Platform Embed API](https://developers.google.com/maps/documentation/embed/quickstart).
