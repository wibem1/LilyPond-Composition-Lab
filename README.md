# LilyPond Composition Lab · V1.2.0

Private WebApp für Computer, iPad und Android. Auftrag → KI → editierbarer LilyPond-Notentext → Partitur, Wiedergabe und Export. Veröffentlichungsdatum: 18.10.2026.

## Arbeiten mit der App

- **Komponieren:** Modell aus dem aktuellen OpenRouter-Katalog wählen, Auftrag eingeben und komponieren. Denkaufwand, eigene Vorgaben und Tokenbudget bleiben einstellbar.
- **Abgebrochene Komposition:** Empfangener Notentext wird während der Übertragung gesichert. Nach einem Verbindungsabbruch wird derselbe Auftrag abgeholt. Fragmente können mit den allgemeinen Bearbeitungsfunktionen erneut an die KI geschickt werden; das Original bleibt als eigene Fassung erhalten.
- **Komposition überarbeiten:** Den Änderungswunsch in das vorhandene Feld „Kompositionsauftrag“ schreiben. Der Button schickt ihn zusammen mit dem aktuellen Notentext an das gewählte Modell.
- **Korrigiere die Komposition:** Die KI prüft das ganze Stück selbstständig auf technische und musikalische Schwächen. Der Text im Auftragsfeld wird dabei nicht als Änderungswunsch verwendet. Kein Chat, kein zusätzliches Eingabefeld. Beide Bearbeitungen speichern eine neue Fassung mit Modell und Kosten; das Original bleibt erhalten.
- **Optional mit Idee:** Eine kurze Klangvorstellung zuerst prüfen und bearbeiten, anschließend zum vollständigen Stück ausarbeiten lassen.
- **Notentext:** LilyPond öffnen, bearbeiten, neu kompilieren oder an Hacklily übergeben. Compilerhinweise bleiben sichtbar; die allgemeinen KI-Bearbeitungen erhalten das Original im Verlauf.
- **Wiedergabe:** SoundFont-Player mit Pause, Position und Lautstärke. Eigene SF2-Dateien werden gespeichert und lokal zwischengespeichert. Gespeicherte MIDI-Dateien aus alten Erzeugungswegen werden vor dem Abspielen aktualisiert.
- **Export:** LilyPond, MIDI und MusicXML. Der MusicXML-Export verwendet die vom Compiler aufgelöste Notenstruktur, ohne KI-Aufruf; Grenzen und nicht übertragene Angaben werden gemeldet.
- **Verlauf:** Kompositionen, Ideen, Modelle, Kosten und Diagnosen. Sicherung und Wiederherstellung enthalten auch Notenseiten und MIDI; Schlüssel und SoundFonts sind ausgenommen.

## Aufbau

| Bereich | Zuständigkeit |
| --- | --- |
| `app/` | Oberfläche, gespeicherter Arbeitsstand und Interaktionen |
| `src/app-config.mjs` | Gemeinsame Versionsdaten und MIDI-Kompatibilitätskennung |
| `src/composition-defaults.mjs` | Einheitliche Vorgaben; gezielte Migration unveränderter alter Standards |
| `src/composition-workflow.mjs` | Direkter und zweistufiger KI-Ablauf, Denkaufwand, Schritte und Anfragevorschau |
| `src/midi-reader.mjs` | Ein gemeinsamer MIDI-Leser für Server und Player |
| `src/expression-playback.mjs`, `*-playback.mjs`, `voice-articulation.mjs` | Ausdruck und Verzierungen im getrennten MIDI-Zweig |
| `src/automatic-ottava.mjs`, `octave-repair.mjs`, `instrument-*.mjs` | Lesbare Notation und geprüfte Tonhöhenkorrektur |
| `src/musicxml-*.mjs` | Compilerstruktur und MusicXML-Ausgabe |
| `src/run-*.mjs`, `history-backup.mjs`, `soundfont-*.mjs` | Auftragswiederherstellung, Sicherung und Klangverwaltung |
| `worker/index.js` | API, OpenRouter/Hacklily, Speicherung und Diagnose |

Die Standardanweisungen werden nur an einer Stelle gepflegt. Eigene musikalische Vorgaben werden nicht als alte Standards ersetzt. Vorhandene Datenformate und gezielt benötigte Kompatibilitätswege bleiben erhalten.

## Prüfung und Build

```sh
npm ci
npm run build
npm test
npm run validate
```

Die automatisierten Programme prüfen unter anderem direkte und zweistufige Komposition, Modelle und Kosten, gespeicherte Arbeitsstände, Fehlerbehandlung, Wiederherstellung, MIDI-Synchronität, SoundFonts sowie MusicXML. Zusätzliche echte Compiler- und Rückkonvertierungsprüfungen sind in [MusicXML-Export](docs/musicxml-export.md) beschrieben. Die Oberfläche ordnet breite Fenster in zwei Spalten und kleinere Fenster in einer Spalte an; alle Bedienelemente bleiben im Dokument vorhanden.

Details zur Wiederherstellung und zu den Tests: [Wiederherstellung](docs/composition-recovery.md).

Bedienung und Datenfluss der allgemeinen Bearbeitungen: [Überarbeiten und Korrigieren](docs/release-1.2.md).

## Dienste und Veröffentlichung

Die Komposition verwendet OpenRouter. Notensatz, MIDI und MusicXML verwenden den Online-Compiler von Hacklily. Der private Sites-Datenspeicher hält Verlauf, Dateien und verschlüsselte Schlüssel. Verbindungsprüfung und Kompilierung starten keine kostenpflichtige KI-Komposition. Ein App-Icon mit eigenständiger Darstellung wird per Web-App-Installation unterstützt; Internet bleibt erforderlich.

Die vorhandene Site-Identität und Freigabe stehen in `.openai/hosting.json`. Das Runtime-Secret `LAB_KEY_ENCRYPTION_KEY` wird ausschließlich in der Hosting-Umgebung gehalten. Keine Schlüssel im Quellcode.

## V1.0 – Herbstputz

Doppelten MIDI-Leser und doppelte Standardvorgaben zusammengeführt, unbenutzte Prüfpfade und alte Styles entfernt, wiederholte Player-Zustandssteuerung vereinheitlicht. Die Oberfläche zeigt Auftrag, Modellwahl und Hauptaktionen unmittelbar; Optionen, Klangverwaltung und Diagnose sind kompakt aufklappbar. Historische Beschreibungen stehen im [Entwicklungsarchiv](docs/development-history-v0.1.md).
