# Streetview Metingen v0.5.1 — verre meetpunten en RD-coördinaten

Deze update verbetert de berekening en transparantie van meetpunten die in Street View **verder weg lijken** dan de positie die de app uitrekent.

## Oorzaak

De eerdere berekening gebruikte het **eerste snijpunt** van een kijkstraal met AHN DTM/DSM. Dit is niet altijd hetzelfde als het object in de foto: een zichtbare verre gevel, boom of dak kan *achter* een eerder snijpunt liggen. Daardoor zijn de lokale X/Y en daarop gebaseerde RD X/Y te dichtbij.

De RD New-omrekening is **niet** de oorzaak van de dieptefout: hij rekent een reeds geschatte geografische locatie naar RD X/Y om.

## Wat is verbeterd

- Het bereik voor automatische maaiveld-/AHN-snijpunten is verruimd van **150 naar 500 meter**.
- Per punt staat nu **Afstand tot camera**, plus of die automatisch is gevonden of handmatig is opgegeven.
- Met **Afstand corrigeren** voer je, als je deze uit een andere bron kent, de **horizontale afstand camera–punt** in meters in. De app schuift het gemeten punt langs de oorspronkelijke camerakijkstraal naar deze afstand en rekent lokale X/Y en RD X/Y opnieuw uit.
- De gecorrigeerde Z-waarde volgt de **kijkstraal**; dit is niet automatisch een AHN-hoogte op de positie. De app controleert het hoogteverschil met DTM/DSM waar mogelijk en meldt afwijkingen.
- Een extra waarschuwing verschijnt bij klikken dichtbij de horizon, omdat kleine fouten in kijkhoek, FOV en camerahoogte daar grote XY-afwijkingen kunnen geven.
- De CSV bevat de afstand, herkomst van de diepte, bron van Z en eventuele afwijking van AHN.
- Uitgebreide regressietests voor 200–300m distant rays, een voorliggende AHN-obstructie, perspectiefherprojectie, RD-verplaatsing en invoergrenzen.

## Belangrijke beperking

**De app kan zonder echte Street View-dieptegegevens niet automatisch bepalen hoe ver het zichtbaar aangeklikte object is.** Een eerste snijpunt met AHN is een terrein-/oppervlakteschatting, geen fotogrammetrische dieptemeting. Een handmatige afstandscorrectie is alleen nuttig wanneer de afstand uit een onafhankelijke bron bekend is; willekeurig een getal invullen maakt de coördinaten niet nauwkeuriger.

Ook de automatische én handmatig gecorrigeerde **RD X/Y blijven indicatief**, afhankelijk van camerakalibratie en AHN. Gebruik deze niet voor kabeluitzetting, ontwerpmaatvoering of andere landmeetkundige doeleinden.

## Downloads

- **Streetview Metingen Setup 0.5.1.exe** — Windows-installer.
- **Streetview Metingen 0.5.1.exe** — portable Windows-app.
