# Streetview Metingen v0.3.0 — Windows

Eerste Windows-desktoprelease met **originele Google Street View-beelden via de officiële Google Maps-insluitlink**, zonder eigen Google Cloud-account of API-sleutel.

## Downloads

- **Streetview Metingen Setup 0.3.0.exe** — Windows-installer.
- **Streetview Metingen 0.3.0.exe** — portable Windows-app zonder installatie.

Deze builds zijn gemaakt met Electron voor Windows x64. Voor het gebruik van de originele Google Street View-beelden en de PDOK/AHN-hoogtegegevens is internet nodig.

## Functies

- Originele Google Street View in een apart desktopvenster via Google Maps **Delen → Een kaart insluiten**.
- Meetpunten, meetlijnen en horizontale afstanden bovenop de weergave.
- PDOK AHN DTM-maaiveldhoogtes (m NAP), indicatieve 3D-lijnsegmenten en hoogteverschillen.
- Meerdere lijnen, ongedaan maken, metingen wissen en exporteren naar CSV.
- Geen Google Cloud-account of Maps API-sleutel nodig.

## Gebruiksaanwijzing

1. Start de portable app of installeer met de Setup-versie.
2. Open [Google Maps](https://www.google.com/maps), ga naar een Street View-panorama en kies **Delen → Een kaart insluiten → HTML kopiëren**.
3. Plak de officiële `<iframe ...>`-code in de desktopapp en laad het panorama.
4. Controleer de cameracoördinaten, kijkrichting, hellingshoek, beeldhoek en camerahoogte. Bevestig de handmatige kalibratie.
5. Kies **Meetpunten zetten** en klik op maaiveldpunten. AHN is standaard ingeschakeld; gebruik desgewenst **Export CSV**.

## Beperkingen en waarschuwingen

- Dit is een **experimentele, indicatieve meetmethode**, geen landmeetkundig instrument. De echte Google Street View-camera is in de ingesloten weergave niet uitleesbaar. Daarom moeten de cameragegevens handmatig worden gekalibreerd en worden punten bij terugschakelen naar navigatie gewist.
- AHN DTM geeft maaiveldhoogtes, **geen hoogtes op gevels, bomen, daken of bovenleidingen**. Google Street View en AHN zijn onafhankelijk ingemeten; kalibratie-, tijds- en perspectiefverschillen kunnen grote fouten opleveren.
- De desktopapp is niet digitaal ondertekend met een uitgeverscertificaat; Windows SmartScreen kan een waarschuwing geven.
- Alleen officiële Google Maps-insluitlinks worden gebruikt; de app slaat geen Google-panoramabeelden op.
- Geteste broncode/Windows-build: commit `950867d4fc29aa8c4b0b54f7f500eb8ef1d532e3`; [geslaagde Windows-build](https://github.com/LukaStuurman/streetview-metingen/actions/runs/37747516447). De 20 automatische tests zijn geslaagd. Een afzonderlijke visuele validatie met echte panorama's is nog niet uitgevoerd.

Voor meer informatie: [README](https://github.com/LukaStuurman/streetview-metingen#readme).
