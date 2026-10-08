# Streetview Metingen v0.4.0 — Google Maps in de app + AHN DSM

## Wat is nieuw?

- **Open Google Maps in dit programma**: via een geïsoleerde ingebouwde Google Maps-browser kun je een locatie zoeken en Street View openen zonder steeds de iframe-code te kopiëren. De oude **Google-insluitlink** is er nog als fallback.
- **AHN DTM** (maaiveld) én **AHN DSM** (daken, bomen en andere bovenoppervlakken). De app kan de kijklijn indicatief snijden met het gekozen hoogteoppervlak.
- **Geschatte objecthoogte** als DSM–DTM op dezelfde meetlocatie (waar beide hoogtemodellen beschikbaar zijn). Dit is géén automatisch herkende of geverifieerde gebouwhoogte; bomen en andere structuren zitten eveneens in het DSM.
- Meegeëxporteerd in **CSV**: model, oppervlaktehoogte NAP, grondhoogte NAP en indicatief DSM–DTM.
- Google Maps-URLs in de ingebouwde browser kunnen cameralocatie en eventueel heading als *voorstel* invullen, zonder privé-Google API te benaderen. Kijkhoek, camerahoogte en FOV moet je nog handmatig bevestigen.

## Installatie

- **Streetview Metingen Setup 0.4.0.exe** — Windows-installatieprogramma.
- **Streetview Metingen 0.4.0.exe** — portable versie.

Google Maps en PDOK AHN vereisen internet. Geen Google Cloud-account, betaalaccount of eigen Maps API-sleutel nodig.

## Belangrijke beperkingen

De app maakt **geen officiële Google Maps/Street View API-integratie**. De ingebouwde browser kan op bepaalde systemen of door Google worden beperkt. Gebruik dan de bestaande knop **Alternatief: Google-insluitlink gebruiken**.

De werkelijke camerapositie, pitch, FOV en rotatie in de gewone Google Maps-site zijn niet betrouwbaar door de app uit te lezen; zichtbare cameracoördinaten en kijkrichting uit een URL zijn slechts suggesties. **De gebruiker moet de camerakalibratie controleren.** Na terugschakelen naar navigeren worden oude meetpunten gewist.

Het AHN DSM is een 2,5D raster, geen 3D-model met gevels. Bij dakranden en verticale objecten kan de straal/raster-interpolatie fictieve tussenoppervlakken opleveren. DSM kan ook bomen bevatten en is niet automatisch een gebouwhoogte. **Alle getoonde metingen zijn indicatief, geen landmeetkundig betrouwbare maten.**

De app en de gegevens zijn niet geschikt voor kabeluitzetting, constructie, vergunningen of kadastrale grenzen. Er is nog geen volledige visuele praktijktest met echte Street View-beelden verricht. De binaries zijn niet digitaal ondertekend.

Lees de [README](https://github.com/LukaStuurman/streetview-metingen#readme) voor meer informatie.
