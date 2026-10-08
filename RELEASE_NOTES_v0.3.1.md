# Streetview Metingen v0.3.1 — AHN-fix voor Windows

Deze update verhelpt de fout **`Failed to execute 'fetch' on 'Window'`** die in versie v0.3.0 optrad bij het ophalen van PDOK AHN-maaiveldhoogtes.

## Opgelost

- De standaard AHN-client roept browser-`fetch` nu aan met `globalThis` / `Window` als ontvanger. Daardoor ontstaat geen browser-`Illegal invocation` meer door de methode via de AHN-client aan te roepen.
- Een extra regressietest controleert deze fout bij iedere CI-run.
- De AHN-status in de Windows-interface toont nu de **concrete foutmelding** als de webservice toch faalt, zodat netwerk-, locatie- of serverproblemen beter te onderscheiden zijn.
- De overige functies van v0.3.0 blijven behouden: officiële Google Street View-insluitlinks zonder Google Cloud-account, handmatig gekalibreerde meetpunten en lijnen, AHN DTM-hoogtes in m NAP, 3D-/horizontale afstanden en CSV-export.

## Installeren

- **Streetview Metingen Setup 0.3.1.exe** — normale Windows-installatie.
- **Streetview Metingen 0.3.1.exe** — portable Windows-versie.

Sluit een draaiende oude versie en installeer de update, of gebruik de nieuwe portable executable.

## Let op

De meetresultaten blijven **indicatief**. De exacte Street View-camerageometrie is in een Google Maps-insluitframe niet van buitenaf uitleesbaar; handmatige kalibratie blijft vereist. AHN beschrijft maaiveldhoogtes, niet gebouwen, bomen of bovenleidingen. Een visuele praktijktest met gekalibreerde Street View-beelden blijft noodzakelijk voordat deze resultaten voor nauwkeurige toepassingen worden gebruikt.

De Windows-app is niet digitaal ondertekend en kan daarom een SmartScreen-waarschuwing opleveren. Voor de AHN- en Google-beelden is internet vereist.
