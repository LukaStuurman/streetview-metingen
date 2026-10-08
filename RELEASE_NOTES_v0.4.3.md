# Streetview Metingen v0.4.3 — Street View-camera niet herkend

Deze Windows-update richt zich op de melding **"Geen Street View-camerastand in de huidige Google Maps-URL"** terwijl Street View in de app is geopend.

## Aangepast

- Herkent ook `1a`- en `2a`-panoramalinks, naast de bestaande `3a`-links.
- Herkent Google's gedocumenteerde Maps-URL met `api=1&map_action=pano&viewpoint=...&heading=...&pitch=...&fov=...`.
- Onder **Open Google Maps** is een uitklapbare **Diagnose Street View-camerastand** toegevoegd. Deze toont het echte adres van de ingebouwde Google Maps-browser en waarom de app het al dan niet kan uitlezen.
- Knop **Controleer URL opnieuw** leest het huidige adres opnieuw.
- Geen valse standaardcameracoördinaten als de URL onvoldoende data bevat.
- Tests voor nieuwe URL-formaten en situaties zonder camerainformatie.

## Belangrijke beperking

Als Google Street View alleen **intern in de Google Maps-webpagina** draait zonder de adresbalk te wijzigen, is de camerastand **niet uit de URL te achterhalen**. Continu URL controleren maakt dit niet oplosbaar. De app kan niet garanderen dat iedere rotatie of zoombeweging wordt opgepikt. Voor volledig betrouwbare realtime tracking is een officieel ondersteunde Google Street View-integratie met Google Maps API-sleutel nodig.

**De meetresultaten blijven indicatief.** Handmatige kalibratie blijft nodig voor de meetfunctie. Er is geen visuele end-to-end bevestiging op de computer van de gebruiker.

## Downloads

- `Streetview Metingen Setup 0.4.3.exe`: Windows-installer
- `Streetview Metingen 0.4.3.exe`: portable versie
