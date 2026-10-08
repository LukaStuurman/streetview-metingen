# Streetview Metingen v0.6.0 — triangulatie vanuit meerdere Street View-opnamen

## Nieuwe functies

**Triangulatie met twee of meer Street View-camera's:** klik in meerdere panorama's **hetzelfde herkenbare objectdetail** aan. De app bewaart de kijkrichtingen bij navigeren en bepaalt met een kleinste-kwadratenoplossing de benaderde X/Y van hun snijpunt — zonder afhankelijk te zijn van het eerste AHN-oppervlaktesnijpunt.

- **Nieuw triangulatiedoel** start de opname van één object. **Meetpunten zetten** legt de eerste kijkstraal vast.
- Na elke vastgelegde waarneming kan je verder navigeren naar een naastgelegen Google Street View-standpunt. Kies daar opnieuw **Meetpunten zetten** en klik hetzelfde object.
- RD New X/Y (EPSG:28992), WGS84 lat/lon, camerabasis (maximale onderlinge afstand), snijhoek, RMS-lijnrestfout en voorbeeldgevoeligheid bij **1° kijkrichtingsfout**.
- Extra camerawaarnemingen verbeteren een consistent geometrisch model; een afwijkende waarneming wordt via de restfout zichtbaar. Zwakke cameraopstellingen (weinig verplaatsing, vrijwel parallelle kijklijnen) leveren een waarschuwing of geen resultaat.
- **Laatste kijkstraal wissen**, **Triangulatie afsluiten** en **Triangulatie CSV** met herkomst per panoramastandpunt.
- De automatische AHN-eerste-snijpuntmeting en **Afstand corrigeren** uit v0.5.1 blijven beschikbaar wanneer je geen triangulatiedoel hebt gestart.

## Camerahoogte Nederland

De standaardinstelling blijft **2,5 meter**, maar dit is een **onderzoeksaanname**, geen door Google bevestigde exacte hoogte van iedere Nederlandse Street View-auto. Onderzoeken naar boom-/straatbeeldmetingen nemen circa 2,5 m camerahoogte aan; opnamevoertuigen en generaties kunnen verschillen. Daarom blijft de hoogte handmatig instelbaar, met extra uitleg in de Windows-interface.

- [Google — How Street View works](https://www.google.com/streetview/how-it-works/)
- [Automated urban tree survey using Google street view images](https://www.tandfonline.com/doi/full/10.1080/22797254.2022.2162441)
- [UrbanVGGT — Camera Height Sensitivity](https://arxiv.org/abs/2603.22531)

**De X/Y-triangulatie heeft geen camerahoogte nodig.** Hoogte Z in NAP kan alleen indicatief worden afgeleid wanneer per waarneming AHN-hoogtes bij de camerastandplaatsen beschikbaar zijn. Een Z uit twee verschillende camerahoeken wordt in het resultaat apart vermeld; een ontbrekende hoogtereferentie levert géén verzonnen NAP.

## Belangrijke beperkingen

- **Geen automatische ontdekking van alle naastgelegen Google-panorama's**: dat is onderdeel van Google's officieel gedocumenteerde Maps JavaScript Street View-service waarvoor een Google Maps Platform-sleutel nodig is. De ingebouwde gewone Google Maps-weergave blijft **zonder Cloud-account of API-sleutel** werken; je navigeert zelf naar een naastgelegen panorama en markeert hetzelfde doelobject.
- De berekening berust op **benaderde camera-coördinaten en richting/beeldhoek**. Google publiceert niet bij ieder panorama de exacte pose in de gewone Maps-URL. Kleine hoekfouten maken vooral verre punten onnauwkeurig.
- De gevoeligheid bij 1° is een illustratie, **geen betrouwbaarheidsinterval of gecertificeerde nauwkeurigheid**.
- De gebruiker moet in elke opname exact **hetzelfde fysieke objectdetail** aanklikken.
- Geen beeld- of panorama-scraping, geen verborgen Google API's, geen fotogrammetrisch gevalideerde dieptemetingen.

De oplossing blijft indicatief en is **niet geschikt voor kadastraal werk, kabeluitzetting of exacte engineering**. Windows-binaries zijn niet digitaal ondertekend en vereisen internet voor Street View en AHN.

## Downloads

- **Streetview Metingen Setup 0.6.0.exe** — Windows-installer.
- **Streetview Metingen 0.6.0.exe** — portable Windows-app.
