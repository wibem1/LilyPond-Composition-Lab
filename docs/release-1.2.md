# V1.2.0 · 18.10.2026

## Bedienung

Direkt unter „Stück komponieren“ stehen zwei Aktionen für den aktuellen Notentext, unabhängig davon, ob er gerade erzeugt, aus dem Verlauf geöffnet oder als LilyPond-Datei importiert wurde:

| Aktion | Vorhandenes Feld „Kompositionsauftrag“ | Ergebnis |
| --- | --- | --- |
| Stück komponieren | Auftrag für ein neues Stück | Neue Komposition |
| Komposition überarbeiten | Änderungswunsch, auch Ergänzung oder Fortsetzung | Neue Fassung des geöffneten Stücks |
| Korrigiere die Komposition | Wird für den KI-Korrekturauftrag ignoriert | Die KI entscheidet selbst über sinnvolle technische und musikalische Verbesserungen |

Keine weitere Texteingabe und kein Chat. Das bisherige Korrekturfeld, „Fehler korrigieren“ und der besondere Vervollständigungsbutton sind aus der Oberfläche entfernt. Ohne geöffnete Noten sind die beiden Bearbeitungen deaktiviert. Das ausgewählte Modell und der ausgewählte Denkaufwand gelten für den zusätzlichen KI-Aufruf.

Die automatische Korrektur erhält die tragende Idee, den Charakter, Titel und Besetzung. Bei der gezielten Überarbeitung sind die Änderungswünsche maßgeblich. Ausgegeben wird die vollständige neue Partitur; die KI führt ihre Prüfung intern durch und gibt keinen separaten Analysebericht aus. Eine bereits überzeugende Passage muss nicht verändert werden.

## Module und Datenfluss

1. `app/app.mjs` liest den aktuellen Editorinhalt und die gewählte Aktion. Bei „Überarbeiten“ ist ein Änderungswunsch im vorhandenen Auftragsfeld erforderlich. Der aktuelle Stand wird vor dem Aufruf gesichert.
2. `worker/index.js` prüft den gespeicherten Stand, das Modell, den Schlüssel und die Erreichbarkeit des Compilers. Ein veralteter Notentext oder fehlender Änderungswunsch verhindert den kostenpflichtigen Aufruf.
3. `src/composition-revision.mjs` erstellt genau einen Auftrag: entweder mit dem Änderungswunsch oder zur selbstständigen Korrektur. Beide enthalten den vollständigen aktuellen LilyPond-Text. Allgemeine musikalische Vorgaben bleiben wirksam; alte Anweisungen für eine Neukomposition werden bereinigt.
4. Die KI-Antwort wird während der Übertragung gesichert. Die neue Historienfassung erhält eine eigene Kennung und einen Verweis auf das Original. Das Original wird vom Bearbeitungsaufruf nicht überschrieben.
5. LilyPond prüft Syntax, Notensatz, MIDI und Tonumfang. Eine zweite Compilerstruktur-Prüfung kontrolliert gleiche Gesamtdauern der Systeme. Fehler und unvollständige Antworten bleiben sichtbar und gespeichert.
6. Verlauf und Arbeitsstand erhalten Modell, Denkaufwand, Kosten und Bearbeitungsstufen. Die Verlaufsliste kennzeichnet die neuen Fassungen als „Überarbeitet“ oder „Korrigiert“.

Die alten Serveroperationen für bereits laufende Korrekturen und Fortsetzungen bleiben kompatibel; sie benötigen keine zusätzlichen sichtbaren Bedienelemente. Die allgemeinen Aktionen dürfen Musik entsprechend dem Auftrag verändern. Unveränderlichkeit einzelner Stimmen ist dabei eine Anweisung an die KI, keine generelle Garantie eines bitgenauen Ergebnisses. Das gesicherte Original ermöglicht jederzeit die Rückkehr.

## Prüfung

Alle 22 Testprogramme prüfen weiterhin die bisherigen Funktionen. Zusätzliche API- und UI-Fälle prüfen das gemeinsame Auftragsfeld, automatische Korrektur ohne Änderungsauftrag, explizites Ignorieren eines vorhandenen Auftragstexts beim automatischen Aufruf, aktuelle und geladene Noten, Modell/Denkaufwand, genau einen KI-Aufruf, neue Fassungen, erhaltene Originale, Kosten, Neuladen, fehlende Aufträge, veraltete Quellen, abgeschnittene Antworten und ungleich lange Stimmen.

Browserinteraktionen werden mit dem tatsächlichen App-Modul in einem DOM-Testmodell geprüft. Eine echte Sicht- oder Hörprüfung auf iPad und Android erfolgt hier nicht. Build und ESM-Prüfung sind Voraussetzung der Veröffentlichung. Die private Sichtbarkeit sowie die vorhandenen Arbeitsstände und Dateien werden durch die Veröffentlichung nicht geändert.
