# Streetview Metingen v0.5.0 — Techbase-stijl + X/Y-meetpunten

De Windows-app heeft een vernieuwde Techbase-geïnspireerde, donkere interface met **oranje** en **rode** accenten. Meetpunten krijgen bovendien een eigen coördinatenoverzicht.

## Nieuw en aangepast

- Techbase oranje/rood voor knoppen, navigatie, meetpunten, lijnen, statusmeldingen en resultaten.
- Bij **ieder meetpunt** verschijnen **lokale X/Y** (meters vanaf de panoramacamera), **RD X/Y** (benadering in Rijksdriehoekscoördinaten, EPSG:28992), **Z in NAP** als AHN aanstaat, en de afgeleide lengte-/breedtegraad.
- Afgeronde RD X/Y en het puntnummer worden als label in de meetoverlay weergegeven.
- De CSV-export bevat nu expliciet `lokaal_X_meter`, `lokaal_Y_meter`, `RD_X_meter`, `RD_Y_meter`, `RD_EPSG`, naast eerdere AHN- en locatiegegevens.
- De verplichte checkbox **'Ik heb de cameracoördinaten ... gecontroleerd'** is verwijderd. Zodra de camera-velden geldig zijn en AHN indien ingeschakeld beschikbaar is, kun je meteen naar **Meetpunten zetten** schakelen.
- Extra tests voor de RD-benaderingsformule, lokaal X/Y, grenscontroles, Windows-verpakking en het ontbreken van de checkbox.

## Belangrijke beperkingen

**RD X/Y zijn niet daadwerkelijk ingemeten coördinaten.** De omzetting vanuit WGS84 gebruikt een handige polynomiale benadering in plaats van de officiële RDNAPTRANS-gridcorrecties. Bovendien worden de geografische punten geschat vanuit een perspectiefmodel van Google Street View en AHN-hoogtes.

De perspectief- en cameraonnauwkeurigheid kan aanzienlijk groter zijn dan het verschil tussen RD-transformaties. Gebruik de uitkomsten niet voor engineering-uitzetwerk, ontwerpen waar exacte kabelposities vereist zijn, kadastrale grenzen, constructieve maatvoering of andere landmeetkundige doeleinden.

Z in NAP komt alleen uit AHN DTM/DSM als AHN ingeschakeld is en de meting een oppervlakte raakt. Verticale gevels en obstakels zijn hiermee niet nauwkeurig te meten. Google Maps zonder API-sleutel levert geen gegarandeerde continu bijgewerkte camerastand. Controleer de cameragegevens dus zelf; alleen de extra bevestigingsklik is verwijderd.

## Windows-downloads

- **Streetview Metingen Setup 0.5.0.exe** — Windows-installer.
- **Streetview Metingen 0.5.0.exe** — portable Windows-app.

De app is niet digitaal ondertekend; Windows SmartScreen kan waarschuwen. Internet is vereist voor Google Maps/Street View en AHN.
