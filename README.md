# Streetview Metingen — Windows, Google Maps + AHN DTM/DSM

**Ontwikkelversie 0.7.0; gepubliceerde release 0.6.2.** Windows-desktopapp om originele Google Maps Street View-beelden te bekijken en indicatieve afstanden en hoogtes te schatten met de publieke PDOK/AHN-diensten. Geen Google Cloud-account, Google Maps API-sleutel of eigen Google-beeldopslag nodig.

## Luchtfotovenster en bewaarde correcties (in ontwikkeling)

**Open luchtfotokaart** opent een apart Windows-venster met de actuele PDOK RGB-luchtfoto. Meetpunten, lijnen en RD-coördinaten verschijnen direct. Kies **Locatie corrigeren** en sleep een herkenbaar punt naar zijn plek, of klik het punt en vul bekende RD X/Y in. **Bewaar locatie en kalibratie** bewaart de correctie lokaal voor volgende metingen vanuit hetzelfde panorama. Met **Wis correcties voor dit standpunt** herstel je de oorspronkelijke berekening.

De app leert de verschuiving uit je referentiepunten. Vanaf vier verspreide referenties kan hij ook schaal en richting leren, maar alleen als hij daarmee referentiepunten beter voorspelt die bij hun eigen voorspelling buiten de berekening zijn gehouden. Andere panorama's, hoogtemethodes, camerahoogtes en beeldhoek-assen gebruiken een eigen kalibratie. Er is geen vaste landelijke correctie. Gecorrigeerde X/Y en GPS blijven onderling consistent; Z blijft van de oorspronkelijke positie en de CSV bewaart de oorspronkelijke coördinaten.

Een bekende opname kun je openen door een volledige Street View-link uit de adresbalk te plakken. Bij officiële links met alleen een gevraagde locatie moet de echte panoramacamera eerst bekend zijn voordat je meet: het dichtstbijzijnde Google-standpunt kan verderop liggen.

De [ontwikkelcontrole van kaartkalibratie](docs/calibration-validation.md) beschrijft de resultaten en resterende praktijktests. Deze ontwikkeling is nog niet uitgebracht.

## Herstel beeldhoek en vensterformaat (v0.6.2)

De `y`-beeldhoek uit de gewone Google Maps-website werd over de vensterbreedte berekend. Bij vergelijking van herkenbare objecten op verschillende vensterformaten bleek dat deze website de hoogte gebruikt. De app past deze beeldhoek nu verticaal toe, zowel bij klikken als bij het terugtekenen van meetpunten. Officiële `?fov=`-links en handmatige kalibratie gebruiken standaard de horizontale beeldhoek; het veld **Beeldhoek gemeten over** toont welke as actief is.

Vier grondpunten zijn naast Street Smart gelegd. Met vastgelegde Google-klikken en live AHN-hoogtes daalde de berekende horizontale afwijking bij de twee duidelijk herkenbare referentiepunten (boomvoet en rechter paaltje) van 1,14 en 0,93 m naar 0,42 en 0,37 m. Het linker paaltje gaf 1,28 → 0,60 m, maar Street Smart meldde te weinig waarnemingen. De putvergelijking is uitgesloten: te weinig waarnemingen en geen zeker overeenkomstig beeldpunt; de afwijking werd daar niet kleiner. Dit is één locatie, met opnames uit verschillende jaren en een aangenomen camerahoogte van 2,5 m, geen algemene nauwkeurigheidsvalidatie.

65 regressietests controleren onder andere vier vensterformaten met analytisch bepaalde kijkstralen, verticale én horizontale projectie, en de bestaande AHN- en triangulatieberekeningen. Zet eerdere meetpunten opnieuw. De correctie vermindert deze projectiefout; camera-locatie, camerahoogte, AHN-resolutie, klikpositie en opnameverschillen blijven de uitkomst beïnvloeden.

## Herstel verre meetpunten (v0.6.1)

De kijkhoek uit een gewone Google Maps Street View-URL werd omgekeerd ingelezen: een omlaag gericht beeld werd als omhoog gericht berekend. Daardoor werden zichtbare grondpunten verder in beeld vaak geweigerd met *Geen AHN-terreinsnijpunt binnen 500 meter*, terwijl punten onderaan het beeld nog wel werkten. De omzetting is nu `pitch = tilt - 90`; positieve kijkhoeken zijn omhoog, negatieve omlaag. De officiële `?pitch=`-links en handmatige kalibratie behouden hun bestaande betekenis.

Dit is in de geopende Windows-app gecontroleerd door hetzelfde klikpunt vóór en na de hoekcorrectie te testen. Regressietests controleren de volledige URL-, klik- en snijpuntberekening voor grondpunten op 10, 25, 75, 200 en 450 meter, met en zonder AHN. Ook omhoog kijken en de drie herkende panorama-URL-types worden gecontroleerd.

Tijdelijke oplossing in v0.6.0: keer bij de automatisch ingelezen **Kijkhoek op/neer** het teken om voordat je gaat meten. Na draaien of verplaatsen kan v0.6.0 de verkeerde hoek opnieuw invullen. Eerder gemaakte metingen moeten opnieuw worden gezet; de afstand en hoogte kunnen door deze fout verkeerd zijn berekend.

## Eenvoudig beginnen (zonder iframe-code)

1. Start de Windows-app en klik op **Open Google Maps in dit programma** (de kaart wordt standaard al geopend).
2. Zoek je locatie in Google Maps en open een **Street View-foto** via de bekende blauwe lijnen of thumbnails.
3. Wanneer Google Maps een herkenbare Street View-URL toont, vult de app **breedtegraad, lengtegraad en eventueel kijkrichting** als *voorstel* in. Zo niet, vul ze handmatig in.
4. Controleer de zichtbare kijkrichting, kijkhoek, **beeldhoek en de bijbehorende breedte- of hoogte-as** en camerahoogte. De app kan de daadwerkelijke Street View-camerastand niet zonder API uitlezen. **Er is geen verplichte bevestigingscheckbox meer**: met geldige cameraparameters en eventueel geladen AHN kun je direct op **Meetpunten zetten** klikken. Controleer zelf of de camerastand nog bij het beeld past.
5. Kies onder **AHN-model** een van de volgende opties:
   - **DTM – maaiveld:** geen gebouwen en bomen; geschikt voor een ruwe grondmeting.
   - **DSM – daken, bomen en objecten:** inschatting op bovenoppervlakken. Als DTM op dezelfde plek beschikbaar is, zie je ook **DSM–DTM** als indicatie voor de hoogte *boven het lokale maaiveld*.
6. Klik op **Meetpunten zetten** en kies zichtbare **maaiveldpunten (DTM)** of **bovenoppervlakken (DSM)**. De beelden worden in meetmodus niet bediend, zodat de overlay niet ongemerkt verschuift.
7. Bij **Navigeren** worden bestaande meetpunten gewist; controleer na draaien, zoomen of verplaatsen de camerakalibratie opnieuw. Exporteer je meetpunten desgewenst naar CSV.

**Als de ingebouwde Google Maps-website door Google of het netwerk wordt geblokkeerd:** klik op **Alternatief: Google-insluitlink gebruiken**. Open in je reguliere browser Google Maps Street View, kies **Delen → Een kaart insluiten → HTML kopiëren**, plak die HTML en gebruik **Originele Street View tonen**. Deze optie blijft bestaan.

## Onderzoek: éénklik-beeldmatching met naburige panorama's

In `src/image-correspondence.mjs` staat een **afzonderlijke, geteste experimentele beeldmatcher** voor twee afbeeldingsbuffers waarvan de automatische verwerking is toegestaan. Deze werkt met het originele klikpunt, twee volledige bekende camerastandpunten en een geometrisch begrensde zoeklijn (epipolaire lijn). Hij vergelijkt kleine beeldgebieden met genormaliseerde kruiscorrelatie (NCC) en verschillende schalen.

De functie `matchAndTriangulateViews({source,target,sourcePoint,cameraA,cameraB})` kan **uit geschikte invoerbeelden** een beeldmatch vinden en via de al bestaande multi-view-triangulatie RD X/Y bepalen. Ze weigert onder meer:
- lage textuur (lucht, effen muren), slechte overeenkomst en dubbelzinnige patronen;
- een ongeldige beeldhoek, ontbrekende gemeenschappelijke camerahoogte en beelden die niet bij de projectie passen;
- onmogelijke of geometrisch ongunstige kijklijnsnijdingen.

**Nog geen gebruikersknop of volautomatische Street View:** de gewone Google Maps-browser levert geen gedocumenteerde, programmeerbare lijst van haar naburige panorama's, volledige betrouwbare camera-informatie of een voor externe beeldanalyse toegestane beeldbron. Electron `webview.capturePage()` en `webview.sendInputEvent()` bestaan technisch wel, maar automatisering van navigatie en screenshots in een Google Maps-website zou ongedocumenteerd en kwetsbaar zijn, en het afleiden van geografische infrastructuurgegevens uit de beelden wordt door de [Google Maps Platform EEA Terms](https://cloud.google.com/terms/maps-platform/eea) beperkt. Ook het feit dat beeldpixels slechts tijdelijk in het geheugen staan, verandert dit niet vanzelf.

Om er een betrouwbare **éénklikfunctie** van te maken is een **geschikte, voor beeldanalyse gelicentieerde panorama-/camera-provider** nodig. Die provider moet minimaal naburige camerastandpunten met pose en renderbare beelden leveren. Totdat die bestaat, blijft `matchAndTriangulateViews` intern: er is **geen automatische Google Street View-matching** in de bestaande Windows-release. De module doet geen netwerkverzoeken, screenshots, permanente beeldopslag of website-automatisering.

## Triangulatie met meerdere naastgelegen Street View-opnamen (v0.6.0)

Een enkele Street View-kijkstraal bepaalt geen objectdiepte. Met twee of meer **verschillende camerastandpunten**, gericht op **precies hetzelfde herkenbare punt**, kun je de horizontale positie wél schatten via de snijding van kijkrichtingen. Deze modus gebruikt **de camera-locaties en de X/Y-richting van de aangeklikte pixels**, niet het eerste AHN-snijpunt; voor X/Y is camerahoogte niet nodig.

1. Ga via **Google Maps in dit programma** naar het eerste Street View-standpunt. Controleer coördinaten, camerakijkrichting, kijkhoek en zoom.
2. Klik **Nieuw triangulatiedoel**. Klik daarna **Meetpunten zetten** en klik **exact hetzelfde objectdetail** dat je later opnieuw zult aanwijzen (bijvoorbeeld één lantaarnpaalvoet).
3. De app slaat de waarneming op en schakelt terug naar **Navigeren**, zonder de eerder verzamelde triangulatie-kijkstralen weg te gooien.
4. Gebruik in de gewone Google Maps Street View-weergave de navigatiepijlen om een **andere opnamelocatie, bij voorkeur minstens 5–10 meter verderop**, te kiezen. Draai de camera terug naar hetzelfde objectdetail en controleer de cameragegevens.
5. Klik opnieuw op **Meetpunten zetten** en klik hetzelfde objectdetail. Zodra er twee bruikbare, niet-parallelle kijklijnen zijn, verschijnen **indicatieve RD X/Y (EPSG:28992)** en geografische coördinaten.
6. Herhaal voor een derde of vierde panorama. De app past een kleinste-kwadratenoplossing toe op de horizontale kijklijnen. Bekijk **camerabasis, snijhoek, restfout** en een geïllustreerde gevoeligheid voor **1 graad kijkrichtingsfout**; dit is géén statistisch betrouwbaarheidsinterval.
7. Export met **Triangulatie CSV**. **Laatste kijkstraal wissen** corrigeert een foutieve observatie; **Triangulatie afsluiten** bewaart het resultaat maar stopt het toevoegen van waarnemingen.

**Beperkingen:** zonder Maps Platform API-sleutel kan de app niet automatisch alle naastgelegen panorama's doorzoeken of zelf hetzelfde punt in hun foto's herkennen. Google publiceert een `StreetViewService` en `StreetViewPanoramaData.links` daarvoor uitsluitend als ondersteunde Maps JavaScript API. De bestaande keyless browser geeft niet altijd een exacte camerapositie of kijkrichting in de URL door. Daarom is dit **handmatig begeleide multi-view-triangulatie**, geen volautomatische fotogrammetrie. Ga niet uit van decimeter- of centimeterprecisie: gebruik dit niet voor werkelijke kabelposities, ontwerp/uitzetting of kadastrale grenzen.

### Hoogte van Google Street View-camera's in Nederland

Er bestaat **geen verifieerbare, voor alle Nederlandse Street View-auto's geldige vaste camerahoogte**. Google bevestigt dat het een camerasysteem op het dak van auto's gebruikt en ook andere opnameplatforms kent; het geeft geen uniforme meetwaarde voor alle beelden op deze site.

In een onderzoek naar stedelijke bomen werd **2,5 meter panoramacamerahoogte** aangenomen voor Google Street View. Ander onderzoek naar straatbeeldgeometrie gebruikt eveneens **2,5 meter als onderzoeksaanname** en vergelijkt 2,0–3,0 meter. Daarom is de standaard in de app **2,5 m boven lokaal maaiveld**, **zelf aanpasbaar**. Gebruik niet zonder controle de auto-standaard voor een Trekker, fiets, handcamera of afwijkende panoramaview.

- Bron: [Google — How Street View works](https://www.google.com/streetview/how-it-works/)
- Bron: [Google Maps — Street View Service (panorama's en links)](https://developers.google.com/maps/documentation/javascript/streetview)
- Bron: [Automated urban tree survey using ... Google Street View images (2022)](https://www.tandfonline.com/doi/full/10.1080/22797254.2022.2162441)
- Bron: [UrbanVGGT — Camera Height Sensitivity (2026)](https://arxiv.org/abs/2603.22531)

Bij triangulatie zijn **X/Y onafhankelijk van camerahoogte**; alleen de geschatte **Z** gebruikt de richtingshoek, AHN-hoogte bij de camerastandpunten en een aannemelijke camerahoogte. Als AHN ontbreekt, wordt geen Z in NAP berekend.

## Waarom een ver Street View-punt dichterbij kan worden geplaatst (v0.5.1)

De app kan uit een enkele Street View-foto geen echte **afstand tot het aangeklikte object** afleiden. De 3D-berekening projecteert een kijkstraal en zoekt in de AHN DTM/DSM de **eerste** plek waar die straal een oppervlak raakt. Een dichterbij gelegen straatvlak, boom of dak (in DSM) kan daarom eerder worden geraakt dan het verre object waar je op klikt. Dit is geen fout in de RD-projectie: de X/Y-coördinaten worden berekend vanuit die al onjuist gekozen afstand.

**Verbeteringen v0.5.1:**

1. Het bereik van de automatische AHN-snijding en de vlakke grondberekening is vergroot van **150 naar 500 m**.
2. Bij ieder meetpunt zie je **Afstand tot camera** en **Bepaling**: *Eerste AHN-snijpunt* of *Vlakke grond*.
3. Met **Afstand corrigeren** kun je de **werkelijke horizontale afstand**, als je die uit een andere bron kent, invullen. De positie wordt exact op dezelfde kijkstraal naar die afstand verplaatst en lokale X/Y en benaderde RD X/Y worden opnieuw berekend.
4. De Z-waarde van een handmatig gecorrigeerd punt wordt uit **camerahoogte en kijkstraal** afgeleid, **niet rechtstreeks uit AHN**. Het programma toont bij een beschikbare AHN-waarde de afwijking tussen die kijkstraalhoogte en het oppervlak op de nieuwe locatie.
5. Bij een kijkstraal dicht langs de horizon verschijnt een waarschuwing dat een kleine fout in camerakanteling/beeldhoek grote verschillen in afstand en X/Y veroorzaakt.
6. De CSV-export vermeldt voortaan de gebruikte afstand, de bepaling van de diepte en of Z uit AHN of de kijkstraal komt.

**Belangrijk:** *Afstand corrigeren* maakt geen automatische dieptemeting mogelijk. Zonder bekende afstand, georeferentiepunten of een echte Street View-dieptebron blijft de objectlocatie onzeker. Er worden **geen externe of verborgen Google-diepte-API's** gebruikt. Ook de handmatig gecorrigeerde RD-coördinaten zijn hooguit indicatief: het resultaat hangt af van de camerakalibratie.

## Techbase-kleuren en puntcoördinaten (v0.5.0)

De Windows-app gebruikt een donker Techbase-geïnspireerd thema met **oranje als primaire kleur** en **rood voor accenten, meetlijnen en waarschuwingen**. Het kleurenpalet wordt met CSS-variabelen beheerd in `desktop-google/styles.css`.

Na het plaatsen van een meetpunt verschijnt onder **Meetpunten en coördinaten** een kaartje met:

- **X lokaal en Y lokaal (m):** oostelijke en noordelijke afstand vanaf de actuele Street View-camera; de camera ligt op (0, 0).
- **RD X en RD Y (m):** benaderde Rijksdriehoekscoördinaten in **EPSG:28992 (RD New)**, berekend vanuit de geschatte WGS84-positie van het meetpunt.
- **Z in NAP (m):** alleen als AHN actief is; anders toont de app geen verzonnen hoogte.

De naam van het punt en afgeronde RD-coördinaten worden ook naast het punt in de meet-overlay getoond. Bij iedere CSV-export worden lat/lon, lokale X/Y, RD X/Y, gebruikte AHN-laag en eventuele Z-waarden opgenomen. Buiten het RD-gebied blijven RD-velden leeg.

De RD-omrekening is een **polynomiale benadering** (zie `src/rd.mjs`) en gebruikt **niet** de officiële, op correctiegrids gebaseerde RDNAPTRANS-methode. Belangrijker nog: camerakalibratie, Street View-perspectief en AHN hebben eigen onzekerheden; ook numeriek plausibele RD-coördinaten zijn daarom **niet** geschikt voor uitzet- of GIS-registratie als werkelijk ingemeten posities.

**De vorige knop `Ik heb de cameracoördinaten ... gecontroleerd` is verwijderd.** Geldige velden en eventueel een geladen AHN-waarde volstaan om de meetmodus te openen. Controleer wel de werkelijke camerastand; zonder juiste kalibratie kan geen betrouwbare coördinaat worden bepaald.

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

## Street View zichtbaar maar camerastand niet gevonden (v0.4.3)

De gewone Google Maps-website kan Street View tonen zonder de actuele panoramacamerastand in het adres van de ingebouwde browser te zetten. De app kan dit adres wel lezen, maar heeft **geen toegang tot Googles interne viewer** en kan heading, pitch en zoom niet uit het beeld alleen reconstrueren.

De URL-herkenning ondersteunt vanaf v0.4.3 ook panorama-adressen met `1a` en `2a` en de door Google beschreven [Maps URL voor Street View](https://developers.google.com/maps/documentation/urls/get-started#street-view-examples) (`map_action=pano` met `viewpoint`, `heading`, `pitch`, `fov`). Dit is geen rechtstreekse uitlezing van de daadwerkelijke camera.

Gebruik **Diagnose Street View-camerastand** onder Google Maps openen. Daar zie je het **exacte adres dat de app via Electron ontvangt** en waarom de camerapositie al dan niet wordt herkend. Kies **Controleer URL opnieuw** na het openen van Street View. Wanneer het adres ook na draaien of bewegen géén cameraparameters bevat, is automatische cameratracking via deze route onmogelijk. Gebruik dan handmatige kalibratie of een officiële Google Maps JavaScript StreetViewPanorama-API-integratie met Cloud API-sleutel. De app slaat geen Google-beelden op.

## Camerastand automatisch bijwerken bij rondkijken (v0.4.2)

Bij de ingebouwde Google Maps-weergave controleert de desktopapp **vier keer per seconde** de zichtbare navigatie-URL van de normale Google Maps-site. De app reageert ook op Electron-navigatiegebeurtenissen.

Als Google in die URL een Street View-camerastand publiceert, worden **breedtegraad, lengtegraad, kijkrichting (heading), hellingshoek (pitch), beeldhoek (FOV/zoom) en de beeldhoek-as** opnieuw ingevuld. Bij een gewijzigde camerastand worden eventuele oude metingen verwijderd. Daarna kun je direct meten zodra geldige cameragegevens beschikbaar zijn. Bij verplaatsing van het panorama wordt de AHN-maaiveldhoogte opnieuw opgevraagd; bij alleen draaien/zoomen gebeurt geen onnodige AHN-netwerkaanvraag.

**Beperking: dit is URL-synchronisatie, géén volledige realtime-camera-API.** Google kan tijdens slepen de URL niet veranderen of pas na afloop bijwerken; sommige panoramabewegingen blijven daarom onzichtbaar voor de app. Er is geen ondersteunde manier om zonder Google Maps Platform/Street View API de interne Google Maps-camerastand iedere frame uit te lezen. De getoonde URL-waarden blijven indicatief. Controleer de uitlijning vóór het meten; daarvoor is geen aparte bevestigingsklik nodig. Google Cloud-vrije Street View via de gewone browser blijft behouden.

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
- `src/rd.mjs`: indicatieve WGS84 → RD New (EPSG:28992), inclusief lokale X/Y per meetpunt.
- `src/triangulation.mjs`: X/Y-triangulatie met meerdere kijklijnen, camerabasis, restfout en hoekgevoeligheid.
- `test/*.test.mjs`: camerageometrie, Google Maps-URLs, AHN DTM/DSM, no-data en browser fetch-context.
- `scripts/smoke-ahn.mjs`: netwerkcontrole van DTM/DSM en browser-CORS.

Bronnen: [PDOK AHN](https://service.pdok.nl/rws/ahn/wms/v1_0?SERVICE=WMS&REQUEST=GetCapabilities), [Google Maps delen en insluiten](https://support.google.com/maps/answer/7101463?hl=nl), [Electron-webweergaven](https://www.electronjs.org/docs/latest/tutorial/web-embeds), [Google Maps Platform Embed API](https://developers.google.com/maps/documentation/embed/quickstart).
