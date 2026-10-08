# Streetview Metingen v0.4.1 — Google Maps-cookiekeuze hersteld

## Opgelost

In v0.4.0 bleef de ingebouwde Google Maps-browser soms op het Google-cookievenster hangen. De knoppen **Alles accepteren** en **Alles weigeren** leidden naar Google's aparte toestemmingsdomein, maar de app blokkeerde die navigatie.

- Officiële Google Maps- en Google Consent-pagina's zijn nu toegestaan in de ingebouwde browser.
- Google's **eigen** cookiekeuze werkt met een permanente sessie zodat de voorkeur onthouden kan worden. De app accepteert of weigert **nooit** namens de gebruiker.
- Google-toestemmingsvensters die in een apart venster openen zijn toegestaan; andere pop-ups blijven geblokkeerd.
- Alleen waar nodig wordt Google de browsertoestemming tot opslag gegeven; camera, microfoon, locatie en overige machtigingen blijven geweigerd.
- Een **Google Maps opnieuw laden**-knop is toegevoegd voor foutafhandeling.
- Ook de iframe-terugvalmodus staat nu Google Consent-navigatie toe.
- Extra tests controleren de correcte consent-redirects en blokkeren onveilige URL's.

## Downloaden

- **Streetview Metingen Setup 0.4.1.exe** — Windows-installer.
- **Streetview Metingen 0.4.1.exe** — portable versie.

Sluit v0.4.0 af en start v0.4.1. Kies zelf op het Google-scherm **Alles accepteren** of **Alles weigeren** en klik, indien nodig, op **Google Maps opnieuw laden**.

## Nog te controleren

De navigatie- en cookiecorrecties zijn geautomatiseerd getest en de Windows-app is gebouwd via GitHub Actions. De daadwerkelijke acceptatie/weigering in een volledig geopende Google Maps-Windows-app is nog niet end-to-end bevestigd; externe Google-updates kunnen de consentstroom beïnvloeden.

De AHN DTM/DSM-metingen blijven indicatief en vereisen handmatige camerakalibratie. Geen nauwkeurige landmeetkunde of 3D-gevelmeting. Windows SmartScreen kan een waarschuwing geven omdat de app niet digitaal ondertekend is.
