# Streetview Metingen v0.7.0

Deze versie voegt een apart Windows-luchtfotovenster toe en bewaart kaartcorrecties om volgende metingen vanuit hetzelfde Street View-standpunt bij te stellen.

- **Open luchtfotokaart:** actuele PDOK RGB-luchtfoto met dezelfde meetpunten, lijnen en RD-coördinaten als in Street View. Het venster kan op een tweede monitor staan.
- **Locatie corrigeren:** sleep een herkenbaar punt op de kaart of vul bekende RD X/Y in. De correctie wordt lokaal bewaard voor hetzelfde panorama, cameracoördinaat, hoogtemethode, camerahoogte en beeldhoek-as.
- Het leermechanisme gebruikt eerst een mediane verschuiving. Vanaf vier verspreide referentiepunten worden schaal en richting alleen aangepast als afzonderlijk weggelaten controlepunten daarmee minstens 20% beter worden voorspeld. Instabiele berekeningen behouden de verschuiving.
- Gecorrigeerde lokale X/Y, GPS en RD komen overeen. CSV bewaart ook de oorspronkelijke coördinaten en de correctiebron. Z blijft bij de oorspronkelijke positie en wordt zo aangeduid.
- Een volledige Street View-link kan rechtstreeks worden geopend. Een officiële link met alleen een gevraagde locatie wordt niet als bewezen panoramacamerapositie gebruikt; Google kan een andere opnameplaats kiezen.
- AHN-snijpunten vlak vóór een NoData-grens worden nauwkeuriger gezocht. Ontbrekende hoogtes worden niet verzonnen of overbrugd.

## Controle en bereik

76 automatische controles slagen. De Windows portable en installer worden op GitHub gebouwd; de ingepakte meet- en kalibratiebronnen worden tegen de geteste bron gecontroleerd.

In de echte Windows-app verbeterde een nieuw controlepunt in Amersfoort van circa 42 cm naar 14 cm verschil met Street Smart na correctie met één ander punt. Een herberekening van eerder vastgelegde Beek-klikken en AHN-uitkomsten gaf circa 37 cm naar 9 cm. Het Beek-resultaat is geen nieuwe kliktest in deze executable. Street Smart meldde bij de Amersfoort-referenties te weinig waarnemingen. Dit zijn lokale voorbeelden, geen landelijke nauwkeurigheidsvalidatie of vaste landelijke correctie. Meer locaties en de herstart/CSV-controle in de uiteindelijke executable blijven vervolgwerk.

## Downloads

- **Streetview Metingen 0.7.0.exe:** portable, direct starten.
- **Streetview Metingen Setup 0.7.0.exe:** Windows-installer.

Geen Google Cloud-account of API-sleutel nodig. Eerdere metingen opnieuw plaatsen; meetuitkomsten blijven indicatief.
