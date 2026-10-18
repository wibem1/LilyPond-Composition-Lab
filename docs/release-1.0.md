# Freigabe V1.0 · 18.10.2026

## Bereinigung

- Gemeinsamer MIDI-Leser für Server und Player; keine zweite Parserkopie und keine unbenutzten Ensemble-Prüfzweige im MIDI-Validierungsweg. Fehlerhafte MIDI-Ausgaben erhalten weiterhin das gültige Notenbild und eine verständliche Warnung.
- Gemeinsame Standardvorgaben und gezielte Migration alter, unveränderter Vorgaben. Die bisherigen musikalischen und technischen Anweisungen bleiben inhaltlich gleich; eigene Texte bleiben erhalten.
- Gemeinsame Release-Daten und MIDI-Kompatibilitätskennung. Das Update erzwingt keine neue MIDI-Erzeugung für bereits aktuelle Dateien.
- Wiederholte Sperr-/Freigabesteuerung beim Laden des Players vereinheitlicht.
- Veraltete Playerkopie aus dem Asset-Archiv und nicht mehr verwendete CSS-Klassen entfernt. SoundFonts, AudioWorklet, Symbole und zugehörige Lizenzen bleiben unverändert.
- Historische Patchbeschreibungen aus der aktuellen README ins Entwicklungsarchiv verschoben. Aktuelle Anleitung und Zuständigkeiten neu zusammengefasst.

## Oberfläche

Auftrag, Modell und Hauptaktionen sind unmittelbar sichtbar. Zusätzliche Vorgaben und Anfragevorschau, Klangverwaltung, Korrektur sowie Sicherung/Diagnose sind aufklappbar. Leere Statusfelder belegen keinen Platz. Alle bisherigen Bedienelemente sind weiterhin vorhanden und eindeutig beschriftet. Der feste HTML-Text wurde von 388 auf 219 Wörter reduziert; dynamische Status- und Fehlermeldungen bleiben erhalten.

Die Oberfläche nutzt ab 1180 Pixeln zwei Spalten. Kleinere Fenster haben eine Spalte; unter 700 Pixeln werden auch die Auswahlpaare untereinander angeordnet. Bedienelemente behalten eine Mindesthöhe von 44 Pixeln und Eingabefelder 16 Pixel Schriftgröße. Die Anfangsansicht und spätere freie Vergrößerung bleiben erhalten.

## Bewusst erhalten

Quellenbezogene Oktavkorrekturen, MIDI-Prüfung vor automatischen Oktavzeichen, getrennte Stimmenzustände für Vorschläge, zeitlich aktuelle MIDI-Dateien, SoundFont-Fehlererholung und Cache, Wiederherstellung unterbrochener Aufträge sowie Kompatibilität mit älteren gespeicherten Einträgen. Diese Stellen sind aktive Fehlerbehandlungen, keine überflüssigen Patches.

## Prüfung

`npm run build`, `npm test`, `npm run validate`: bestanden; 20 Testprogramme. Darunter Serverrouten, direkte/zweistufige Komposition, Korrektur, History/Workspace/Backup, Modell-/Kostenwahl, SoundFont und Player, Gänseliesel-Synchronität, MusicXML, Importgraph im Browser, Release-Daten und unveränderte ältere Vorgaben. Zusätzliche Regression: beschädigte MIDI-Daten verlieren kein gültiges Notenbild.

Kein kostenpflichtiger KI-Aufruf. Keine Änderungen an gespeicherten Kompositionen oder Schlüsseln. Die visuellen Breakpoints sind im CSS implementiert; eine echte Browser-/iPad-Sichtprüfung war in dieser Umgebung mangels Browser-QA-Werkzeug nicht verfügbar. Diese Einschränkung ist kein musikalischer oder gerätespezifischer Funktionstest.
