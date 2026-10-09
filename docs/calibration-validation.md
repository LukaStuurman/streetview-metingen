# Kaartkalibratie — ontwikkelcontrole 9 oktober 2026

Het programma leert een registratie per panorama, cameracoördinaat, hoogtemethode, camerahoogte en beeldhoek-as. Draaien, zoomen en vensterformaat wisselen behouden de registratie zolang die context gelijk blijft. De meetgegevens worden niet gebruikt als vaste landelijke verschuiving of als standaardwijziging van de camerahoogte.

## Werkelijk waargenomen punten

| Locatie en controle | Afwijking vóór correctie | Na één andere referentie | Methode |
|---|---:|---:|---|
| Amersfoort, controlepunt bij deur | circa 0,42 m | circa 0,14 m | Nieuwe klik in echte Windows-app na opslaan van garagevoet als referentie; deurpunt zelf niet gecorrigeerd |
| Beek, rechter paaltje | circa 0,37 m | circa 0,09 m | Herberekening met bewaarde echte klikken en eerdere live AHN-uitkomsten; boomvoet als enige referentie |

Street Smart is op verzoek van de gebruiker de vergelijkingsbron. Amersfoort heeft twee handmatige Street Smart-waarnemingen per punt met de waarschuwing te weinig waarnemingen en een getoonde σXY van 0,10–0,11 m. In Beek gaf Street Smart voor deze twee punten σXY 0,06 m. Google en Street Smart hebben verschillende opnamedata. Onzekere objectcorrespondenties zijn uitgesloten. De cijfers tonen het effect op deze voorbeelden, geen landelijk nauwkeurigheidsbereik.

Amersfoort is getest met vlak maaiveld omdat AHN DTM bij de gekozen gevelvoeten geen bruikbaar snijpunt gaf. Het programma overbrugt zulke gaten niet met verzonnen hoogtes. De Beek-herberekening is geen nieuwe kliktest in de huidige executable.

## Algemene verbetering van het leren

- Bij één tot drie referenties: mediane verschuiving, zodat een enkele uitschieter tussen meerdere referenties minder invloed krijgt.
- Vanaf vier verspreide referenties: schaal en richting uitsluitend als een begrensde registratie zowel de pasfout als de voorspellingsfout met minstens 20% verlaagt ten opzichte van verschuiving. Voor de voorspellingscontrole wordt iedere referentie afzonderlijk weggelaten, de registratie opnieuw berekend en het weggelaten punt voorspeld.
- Instabiele geometrie, te grote schaal/hoek of slechtere voorspelling: behoud de mediane verschuiving. Dit is modelkeuze, geen garantie dat iedere volgende positie beter wordt.
- Correcties op een punt bewaren de oorspronkelijke RD- en lokale coördinaten. Gecorrigeerde lokale X/Y, GPS en RD beschrijven dezelfde positie; Z blijft bij de oorspronkelijke berekening en wordt als zodanig aangeduid.
- Opslag blijft lokaal en gescheiden per context; andere panorama's krijgen geen willekeurige verplaatsing.

Automatische controles omvatten een bekende schaal/rotatie met een ongebruikt vijfde punt, een foutieve verre referentie die een misleidende schaal zou veroorzaken, en overeenkomende lokale/GPS/RD-uitvoer op vier Nederlandse locaties. Die vier coördinaatcontroles zijn synthetisch, geen Street Smart-veldtest.

Nog nodig voor de landelijke praktijktest en release: meer punten en locaties in de echte Windows-app naast Street Smart, herstart en CSV in de uiteindelijke executable, en daarna publiceren op main met een Windows-release.
