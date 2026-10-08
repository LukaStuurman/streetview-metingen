# Streetview Metingen — Google zonder Cloud-account (desktop)

Dit is een **Windows-desktopversie** die echte Google Street View-beelden toont met de officiële functie **Google Maps → Delen → Een kaart insluiten**. Een **Google Cloud-account, API-sleutel of billingconfiguratie is niet nodig** om een door Google gemaakte embed-link te gebruiken. Google Maps, AHN/PDOK en het internet moeten bereikbaar zijn.

> Dit is **geen officiële Google Street View API-integratie**, geen reverse-engineering van Google-beelden en geen reproductie van Google Earth Pro. De applicatie gebruikt alleen de embed-HTML die Google Maps zelf verstrekt en plaatst een lokale transparante meetlaag in het eigen programmavenster.

## Starten

### Windows-executable

1. Open de [GitHub Actions-build](https://github.com/LukaStuurman/streetview-metingen/actions/workflows/desktop-windows.yml) en open een geslaagde workflow-run.
2. Download onder **Artifacts** de Windows-app-bundel en pak deze uit.
3. Start de portable `.exe` of het installatieprogramma.
4. Ga in je browser naar [Google Maps](https://www.google.com/maps) en schakel naar de gewenste Street View-foto.
5. Gebruik **Delen → Een kaart insluiten → HTML kopiëren**. Plak de complete `<iframe ...></iframe>` HTML in de desktopapp en kies **Originele Street View tonen**.
6. De app leest uit sommige door Google gegenereerde URLs cameracoördinaten en heading als *voorstel*; deze zijn niet altijd beschikbaar of correct. Controleer de positie, **kalibreer heading, pitch en horizontale beeldhoek** op het zichtbare beeld en vink aan dat je de camerainstellingen hebt gecontroleerd. Zonder deze expliciete bevestiging start de meetfunctie niet. Bij ontbrekende coördinaten moeten die eerst handmatig worden ingevuld. De standaardwaarden zijn alleen aannames.
7. Kies optioneel **AHN-maaiveldhoogtes** voor hoogteverschillen. AHN-terreinhoogtes worden zonder sleutel live bij PDOK opgevraagd.
8. Kies **Meetpunten zetten**, plaats punten op zichtbare grond en lees de geschatte horizontale afstand, rechte 3D-lengte en AHN-hoogte af.
9. Gebruik **Export CSV** om alleen berekende meetpunten op te slaan, niet de Google-afbeeldingen.

### Voor ontwikkelaars

Installeer Node.js 20 of nieuwer, ga naar de repository en gebruik:

```sh
npm install
npm run desktop
npm test
npm run dist:win
```

De standaard webapp (origineel vanaf de basisbranch) is nog beschikbaar via `index.html`, maar **die** gebruikt nog de officiële Google Maps JavaScript API met sleutel. Start voor de nieuwe accountvrije versie specifiek `npm run desktop`.

## Belangrijke beperkingen

- **Het Google-frame is cross-origin.** De software kan, zonder officiële API, niet uitlezen waarheen je binnen het Google-frame draait of inzoomt. In meetmodus is het iframe daarom tegen muisklikken vergrendeld. Zodra je teruggaat naar Navigeren, wist het programma de vorige punten om geen schijnprecisie te tonen.
- Een Google Maps embed wordt getoond **zoals Google hem levert**, inclusief logo en attributie. Alleen de originele door Google verstrekte insluitcode wordt geaccepteerd. **Niet** zelf de kaartbeelden downloaden, tegels onderscheppen, onderschepte Google-interne API's gebruiken of Google-UI aanpassen.
- **Handmatige camerakalibratie is vereist.** Coördinaten in een Google embed-link zijn niet gegarandeerd de exacte camerapositie en de weergegeven blikrichting is zonder API niet verifieerbaar. Een achteraf verdraaide/ingezoomde iframe-inhoud kan NIET automatisch met de overlay worden gesynchroniseerd.
- Het AHN DTM modelleert **maaiveld** in meters t.o.v. NAP. Voor gevels, bovenleidingen, bomen, brugdekken en daken werkt de terrein-gebaseerde snijpuntmeting niet. Camera- en hoekfouten kunnen grote afstandsfouten veroorzaken.
- De 3D-lengte telt rechte 3D-lijnsegmenten tussen gemeten punten op, niet de exacte lengte langs het terrein.
- **Geen landmeetkundige nauwkeurigheid, geen zakelijke/kadastrale/constructieve maatvoering.** Behandel ieder resultaat als een grove, niet-gevalideerde schatting.
- De installatie en webbeveiliging hangen af van versies van Google Maps en Electron. Als Google de insluitfunctie wijzigt, kan deze aanpak stoppen met werken. In de niet-ingelogde Google Maps-viewer hoeft niet iedere foto beschikbaar te zijn.

## Projectbestanden

- `desktop-google/main.cjs`: minimale, beveiligde Electron-shell.
- `desktop-google/index.html`: Windows-interface en originele Google Maps-iframe.
- `desktop-google/app.mjs`: meetpunten, AHN, projectie, export.
- `desktop-google/measurement-helpers.mjs`: strikte validatie van Google-share-links.
- `src/ahn.mjs`: openbare PDOK AHN DTM via GetFeatureInfo.
- `src/geometry.mjs`: projectiegeometrie.
- `test/google-embed.test.mjs`: tests voor Google insluit-URL's en kalibratie.

## Waarom Google Earth Pro niet exact hetzelfde doet

Google Earth Pro heeft wel lijn-/pad-/3D-meetfuncties in de 3D-wereld. De Street View-panoramaweergave staat los van dat driedimensionale coördinatensysteem; Google Earth Pro schakelt zijn eigen ruler daarom uit in Street View. De hier getoonde overlay is dus een zelfstandige **experimentele** meetfunctie, geen kopie van een landmeetfunctie in Google Earth Pro.

Bronnen:
- [Google Maps: kaart delen/insluiten](https://support.google.com/maps/answer/7101463?hl=nl)
- [Google Earth Pro: afstanden en hoogtes meten](https://support.google.com/earth/answer/148134?hl=en)
- [Google Earth-community: ruler uitgeschakeld in Street View](https://support.google.com/earth/thread/182832422/ruler-greyed-out-in-street-view-in-google-earth)
- [Google Earth en Street View gebruiksvoorwaarden](https://maps.google.com/intl/en_all/help/terms_maps-earth/)
