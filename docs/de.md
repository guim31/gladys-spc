# Unwetterausblick (SPC)

Die konvektiven Ausblicke des **Storm Prediction Center** (SPC) der NOAA für dein Haus, in Gladys: die
Unwetterrisiko-Kategorie für heute, morgen und übermorgen sowie die Wahrscheinlichkeiten für Tornados, Hagel und
schwere Sturmböen für heute und morgen. Mit Szenenauslösern und einem Dashboard-Widget.

> **Kein amtlicher Warndienst.** Die Ausblicke sind Vorhersagen für die kommenden Tage. Für aktuelle Vorwarnungen
> und Warnungen folge dem National Weather Service (die Integration
> [National Weather Service](https://github.com/William-De71/gladys-national-weather-service) bringt sie in
> Gladys), einem NOAA Weather Radio und deinen örtlichen Behörden.

Nicht mit der NOAA oder dem National Weather Service verbunden.

## Was du bekommst

- **Ein Gerät pro Haus** in Gladys, das in den angrenzenden USA liegt.
- Die **SPC-Kategorie** für heute, morgen und übermorgen: 0 (kein Unwetterrisiko oder nur gewöhnliche Gewitter),
  1 Marginal, 2 Gering (Slight), 3 Erhöht (Enhanced), 4 Mäßig (Moderate), 5 Hoch (High).
- Die **Wahrscheinlichkeit** (%) eines Tornados, von Hagel ab 2,5 cm und von Böen ab 93 km/h im Umkreis von 40 km
  (25 Meilen) um das Haus, heute und morgen; für übermorgen die Wahrscheinlichkeit eines beliebigen Unwetters.
- Die **bedingte Intensitätsgruppe** (0 bis 3) jedes Phänomens: Je höher, desto heftiger könnten die Gewitter
  werden (starke Tornados, sehr großer Hagel, zerstörerische Böen). Seit 2026 ersetzt diese Gruppe die schraffierten
  „signifikanten“ Flächen.
- Ein **Zusammenfassungssatz**, zum Beispiel „Unwetterrisiko heute: Gering (Tornado 5 %, Hagel 15 %, Böen 15 %);
  morgen: 3 · Erhöht“.
- Drei **Szenenauslöser** und ein **Dashboard-Widget**.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Der **Standort deines Hauses** in Gladys (Einstellungen → Häuser), in den angrenzenden USA. Alaska, Hawaii,
  Puerto Rico und andere Länder deckt das SPC nicht ab.
- Internetzugang für Gladys. Weder Konto noch Schlüssel.

## Konfiguration

### Einstellungen

| Einstellung                | Standard    | Wirkung                                                                          |
| -------------------------- | ----------- | -------------------------------------------------------------------------------- |
| Sprache der Funktionsnamen | Französisch | Namen der Funktionen neuer Geräte, Sprache der Zusammenfassung und der Variablen |

Bei der Installation fragt die Integration nach dem **Standort deiner Häuser**, liest deren Koordinaten aus
Gladys und prüft die SPC-Flächen **im Container**. Dein Standort wird an niemanden gesendet. Öffne dann den Tab
**Entdecken** der Integration und lege das Gerät deines Hauses an. Ein später hinzugefügtes oder verschobenes Haus
erscheint nach einer neuen Suche im Tab „Entdecken“.

## Geräte

| Funktion                                    | Typ  | Wert                                                  |
| ------------------------------------------- | ---- | ----------------------------------------------------- |
| Unwetterrisiko heute / morgen / in 2 Tagen  | Zahl | SPC-Kategorie, 0 bis 5                                |
| Tornado- / Hagel- / Böen-Wahrscheinlichkeit | %    | Heute und morgen, im Umkreis von 40 km                |
| Unwetter in 2 Tagen                         | %    | Beliebiges Unwetter, übermorgen                       |
| Intensitätsgruppe …                         | Zahl | Bedingte Intensitätsgruppe des Phänomens, 0 bis 3     |
| Unwetterausblick                            | Text | Zusammenfassungssatz in der Sprache der Einstellungen |

Die Kategorien sind Zahlen (nicht das „Risiko“-Abzeichen von Gladys, das nur vier Stufen kennt), sodass eine
Szenenbedingung wie „Risiko heute ≥ 2“ funktioniert. „Heute“ ist der konvektive Tag des SPC, von 12 Uhr UTC bis
12 Uhr UTC am nächsten Morgen. Antwortet das SPC nicht, wird nichts veröffentlicht: Die letzten Werte altern einfach.

## Dashboard-Widget

**Unwetterausblick**: für das gewählte Haus (sonst das erste) eine Zeile pro Tag mit seiner Kategorie, nach der
SPC-Skala eingefärbt, soweit die Palette von Gladys reicht (grün Marginal, gelb Gering und Erhöht, rot Mäßig und
Hoch, blau für gewöhnliche Gewitter), eine Überschrift ab Gering, die Tornado-, Hagel- und Böen-Wahrscheinlichkeiten
für heute und morgen (mit der höchsten Intensitätsgruppe, „CIG2“), die Ausgabezeit und eine Schaltfläche zu den
SPC-Ausblicken. Wahrscheinlichkeiten und Schaltfläche haben je eine Einstellung zum Ausblenden.

## Szenenauslöser

- **Unwetterrisiko erreicht eine Kategorie**: Ein neuer Ausblick hebt die Kategorie eines Tages auf die gewählte
  Stufe (1 bis 5) oder höher, einmal, beim Überschreiten nach oben. Filter: Haus, Tag (heute, morgen, in 2 Tagen).
- **Unwetterrisiko hochgestuft**: Ein neuer Ausblick stuft die Kategorie eines bereits vorhergesagten Tages hoch,
  egal auf welche Stufe.
- **Tornado-Wahrscheinlichkeit erreicht eine Stufe**: Die Tornado-Wahrscheinlichkeit von heute oder morgen erreicht
  die gewählte Stufe (2 bis 60 %).

Derselbe Kalendertag wird von einem Ausblick zum nächsten verfolgt: Hat Tag 3 schon Erhöht angekündigt, löst der
bestätigende Tag 2 nichts aus. Variablen: Haus, Tag, Datum, Kategorie und ihr Name, Zusammenfassung; die vorherige
Kategorie bei einer Hochstufung; Wahrscheinlichkeit und Intensitätsgruppe bei einem Tornado. Die allerersten nach
der Installation gelesenen Ausblicke setzen nur die Referenz und lösen nichts aus.

## Szenenbeispiele

- Wenn das Risiko für morgen Gering erreicht, sende „Unwetterrisiko morgen: {{level_name}}“ an die Familie.
- Wenn die Tornado-Wahrscheinlichkeit für heute 10 % erreicht, schalte das Flurlicht auf Orange und sende eine
  Nachricht.
- Jeden Morgen um 7 Uhr: Ist das Risiko heute 3 oder mehr, lies die Zusammenfassung laut vor.

## Datenquellen, Lizenz und Kontingente

- [Konvektive Ausblicke des SPC](https://www.spc.noaa.gov/products/outlook/), NOAA / National Weather Service,
  gemeinfrei (Werk der US-Regierung). Alle 15 Minuten gelesen: elf kleine GeoJSON-Dateien mit bedingten Anfragen,
  sodass eine seit dem letzten Zyklus unveränderte Datei nur eine 304-Antwort ohne Inhalt kostet. Das SPC gibt den
  Ausblick für Tag 1 fünfmal täglich heraus, für Tag 2 zweimal und für Tag 3 ein- oder zweimal.

## Fehlerbehebung

- **„Kein Haus in Gladys hat einen Standort“**: Lege den Standort deines Hauses unter Einstellungen → Häuser fest
  und suche dann im Tab „Entdecken“ erneut.
- **„Kein Haus liegt in den angrenzenden USA“**: Das SPC deckt nur die 48 angrenzenden Bundesstaaten ab.
- Der Verbindungsstatus meldet, dass die Ausblicke nicht lesbar sind: Die SPC-Website ist nicht erreichbar. Bis sie
  wieder antwortet, wird nichts veröffentlicht; neuer Versuch alle 15 Minuten.

## Grenzen

- Eine Vorhersage der kommenden Tage, keine Warnung: Gewitter können auch außerhalb der vom SPC gezeichneten Flächen
  entstehen.
- Ohne laufenden Unwettertag entwickelt: Die Tests nutzen die echten Ausblicke vom 27. April 2026 (Risiko Mäßig) und
  vom 7. November 2026. Rückmeldungen willkommen.
- Die Wahrscheinlichkeit eines Phänomens gilt, wie das SPC sie definiert, für 40 km um das Haus, nicht für das Haus
  selbst.
