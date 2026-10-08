# Streetview Metingen v0.6.2 — correctie beeldhoek en nauwkeurigheid

De gewone Google Maps-website gebruikt de `y`-beeldhoek over de beeldhoogte. De app berekende deze over de breedte, waardoor kijkstralen en RD-punten verkeerd lagen en de meetlaag bij een ander vensterformaat verschoof.

- Berekent Google Maps `y`-beeldhoeken verticaal bij klikken én terugtekenen.
- Behoudt horizontale projectie voor officiële `?fov=`-links en bestaande handmatige kalibratie.
- Toont de actieve beeldhoek-as; deze is ook handmatig aanpasbaar.
- Toont puntcoördinaten met dezelfde decimalen als de CSV: RD met twee en lat/lon met acht, zodat overnemen naar Street Smart geen extra afrondingsverschil geeft. Extra decimalen betekenen geen grotere meetnauwkeurigheid.
- Controleert vier vensterformaten met onafhankelijk analytisch bepaalde kijkstralen. Alle 65 tests slagen.

Bij twee duidelijk herkenbare punten naast Street Smart daalde de horizontale afwijking met vastgelegde Google-klikken en live AHN-hoogtes van 1,14/0,93 m naar 0,42/0,37 m. Een derde punt gaf 1,28 → 0,60 m met een Street Smart-waarschuwing voor te weinig waarnemingen. Een vierde, onzekere putvergelijking verbeterde niet en is uitgesloten. Dit betreft één locatie, opnames uit verschillende jaren en een aangenomen camerahoogte van 2,5 m; geen algemene nauwkeurigheidsgarantie.

Zet eerdere metingen opnieuw. Camerapositie, camerahoogte, actuele kijkstand, AHN en de gekozen klikpositie blijven van invloed. De app levert indicatieve metingen.
