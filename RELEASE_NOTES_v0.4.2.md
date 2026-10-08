# Streetview Metingen v0.4.2 — automatische camerakalibratie vanuit Google Maps-URL

## Nieuw

- De ingebouwde Google Maps-browser controleert automatisch ongeveer iedere **250 milliseconden** de zichtbare Street View-URL.
- Indien aanwezig werkt de app hierdoor **kijkrichting**, **hellingshoek**, **beeldhoek/zoom** en **panoramalocatie** bij, ook bij navigatie zonder volledige paginaherlading.
- Een aparte statusregel geeft aan of de URL voldoende cameragegevens bevat.
- Als de camerastand wijzigt, worden bestaande metingen uit veiligheid gewist; de gebruiker bevestigt de kalibratie opnieuw voordat er gemeten kan worden.
- Als alleen de kijkrichting of zoom wijzigt, wordt AHN niet onnodig opnieuw aangevraagd. Bij een echte locatiewijziging wel.
- Extra tests voor rotatie, pitch, zoom, cameraverplaatsing, ontbrekende waarden en niet-vertrouwde URL's.

## Belangrijke beperking

**Dit is geen gegarandeerde continue realtime cameratracking.** De normale Google Maps-website publiceert de camerastand niet altijd direct of bij iedere mouse-drag in de URL. Zonder een officiële Google Street View API met Google Cloud-sleutel kan de app daarom geen gegarandeerde camerastand per beeldframe uitlezen. De app synchroniseert zodra de **publieke browser-URL** verandert. Tijdens bewegingen die Google níét in de URL weergeeft, kunnen de velden tijdelijk of blijvend achterlopen. Bevestig de handmatige kalibratie vóór het meten.

De iframe-fallback kan niet live meekijken met de URL; daar blijven de cameravelden handmatig.

**Meetafstanden, DSM-objecthoogtes en AHN-snijpunten blijven indicatieve schattingen, niet geschikt voor landmeten, kabeluitzetting of constructies.** Er is geen geverifieerde Windows end-to-end test met het daadwerkelijk slepen van een Google Maps Street View-panorama.

## Download

- **Streetview Metingen Setup 0.4.2.exe** — Windows-installer.
- **Streetview Metingen 0.4.2.exe** — portable versie.

Sluit de oude app af voordat je v0.4.2 installeert of start.
