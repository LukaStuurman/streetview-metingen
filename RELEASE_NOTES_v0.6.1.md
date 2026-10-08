# Streetview Metingen v0.6.1 — herstel kijkhoek en verre meetpunten

De Google Maps Street View-kijkhoek werd in gewone `/maps/@...t`-adressen met het verkeerde teken omgezet. Bij omlaag kijken berekende de app een omhoog gerichte camera. Daardoor konden vooral punten onderaan het beeld worden geplaatst; grondpunten verder weg werden vaak ten onrechte geweigerd.

- Herstelt de omzetting naar `pitch = tilt - 90`.
- Verduidelijkt het kijkhoekveld: positief omhoog, negatief omlaag.
- Behoudt de betekenis van handmatig ingevulde kijkhoeken en officiële `?pitch=`-links.
- Voegt regressietests toe voor grondpunten van 10 tot 450 meter via vlakke grond én AHN, omhoog kijken en alle herkende panorama-URL-types.

Gecontroleerd in de geopende Windows-app: hetzelfde punt dat met de verkeerde hoek werd geweigerd, werd met de gecorrigeerde hoek direct geplaatst. Alle 63 tests slagen.

Zet eerdere metingen opnieuw. De correctie herstelt de klikgeometrie; de bestaande afhankelijkheid van actuele cameragegevens en de eerste AHN-oppervlaksnijding blijft gelden.
