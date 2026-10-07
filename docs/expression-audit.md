# Prüfung der musikalischen Wiedergabe – 7. Oktober 2026

Geprüft wurde die automatische Wiedergabe der App mit LilyPond 2.26, `articulate.ly`, den eigenen Triller-/Arpeggio-Erweiterungen und dem SpessaSynth-MIDI-Player. Das Notenbild und die MIDI-Wiedergabe werden separat erzeugt. Korrekte Darstellung bedeutet nicht automatisch korrekte Wiedergabe. Ein vollständiger Nachweis für jedes LilyPond-Zeichen, jede Kombination und jeden Soundfont liegt nicht vor.

## Ergebnis

| Zeichen / Anweisung | Tatsächliche Umsetzung | Bewertung / Grenze |
| --- | --- | --- |
| p, pp, mp, mf, f usw. | Verschiedene Anschlagsstärken; p=69, f=95 im Test | Wirksam; Klangwirkung abhängig vom Soundfont. Kein menschliches Phrasieren. |
| Crescendo / Decrescendo über mehrere Anschläge | Zwischenwerte der Anschlagsstärke; Test 69, 78, 86, 95 | Funktioniert zwischen definierten Dynamikmarken. |
| Crescendo / Decrescendo auf gehaltenem Ton | Keine kontinuierlichen Expression-Daten | Fehlt; besonders für Streicher und Bläser relevant. |
| Staccato / Staccatissimo / Portato / Tenuto | Dauerfaktoren 1/2, 1/4, 3/4, 1 | Plausible feste Näherung, keine universell vorgeschriebenen Proportionen. |
| Akzent / Marcato | Höherer Anschlag im Test | Wirksam, aber keine instrumentenspezifische Klangformung. |
| Bindebögen | Verbundene Noten ohne die normale Verkürzung; letzte Note kann verkürzt sein | Zeitliche Näherung; kein echter Bogenstrich, Atem oder Legato-Samplewechsel. |
| Haltebögen | Kein erneuter Anschlag | Getestet auch bei ganzen arpeggierten Akkorden. Teilbindungen / komplexe Stimmenwechsel nicht vollständig geprüft. |
| Sustain-Pedal | MIDI CC64 an/aus | Getestet auch zusammen mit Arpeggien. Keine realistische Halbpedal-/Resonanzmodellierung zugesichert. |
| Sostenuto / una corda | LilyPond-Pedalbefehle, vom Synthesizer abhängig | Nicht durch diese Hör-/MIDI-Prüfung zertifiziert; Klangwirkung gesondert prüfen. |
| Triller | Eigene Umsetzung mit Haupt-/Nebenton, Tonart bzw. expliziter Tonhöhe, variabler Geschwindigkeit, notierten Endungen | Automatischer Standard beginnt auf Hauptton; historische Interpretation nicht automatisch aus dem Stil ableitbar. |
| Mordent / Prall / Doppelschlag | Bibliotheksalgorithmen erzeugen zusätzliche Töne | Mordent und normaler Doppelschlag im MIDI geprüft; feste Näherung. Sonderformen und Ornament-Vorzeichen nicht vollständig abgedeckt. |
| Umgekehrter Doppelschlag (`reverseturn`) | Ein einzelner Hauptton im Test | Fehlt. |
| Arpeggio | Rasche auf-/absteigende Anschläge, Töne bleiben gehalten; verbundene Hände werden durchgehend gerollt | Neu in v0.1.23, mit echten MIDI-Daten getestet. Standard beginnt auf dem Schlag; vorgezogene/stilspezifische Ausführung nicht automatisch. |
| Nicht arpeggierter Akkord / Klammer | Gleichzeitiger Anschlag | Getestet. |
| Ausgeschriebenes und abgekürztes Tremolo | Wiederholte bzw. alternierende Noten | Beide Formen einschließlich `:16` mit `articulate` geprüft. |
| Metronomzahlen | Exakte Tempoereignisse | Wirksam. |
| ritardando / rallentando / accelerando | Ein einzelner Temposprung; normales rit. auf 60 %, poco auf 90 % | Musikalisch unzureichend: allmählicher Verlauf fehlt. |
| a tempo | Vorher gespeichertes Tempo | Im einfachen Test korrekt; verschachtelte Tempoänderungen nicht vollständig geprüft. |
| Fermate | Unveränderte Dauer | Fehlt: Ton/Pause müsste länger gehalten werden. |
| Glissando / Portamento | Nur notierte Endpunkte | Automatische Ausführung fehlt. |
| dolce, espressivo, cantabile, rubato, stringendo usw. | Freier Text wird nicht musikalisch interpretiert | Überwiegend nur Notenbild. Text „Swing“ erzeugt ebenfalls keinen Swing ohne explizite Umsetzung. |
| pizzicato, arco, sul ponticello, col legno, Dämpfer, Flageolett, Vibrato | Kein automatischer Wechsel der Spieltechnik im App-Code | Darstellung bzw. explizite MIDI-Instrument-/Klangsteuerung; nicht pauschal als hörbar unterstützt behandeln. |
| Atemzeichen / Zäsuren | `articulate` verwirft BreathingEvent | Keine verlässliche automatische Atempause; gesonderte Umsetzung nötig. |
| Fingersatz, Bogenrichtung, Probenzeichen | Keine Klangänderung erforderlich bzw. keine physische Ausführung modelliert | Nicht mit hörbarer Artikulation gleichsetzen. |

## Nachweis und Quellen

Synthetische Quellen und echte Compiler-MIDI-Dateien: `tests/fixtures/expression-audit.*`, `arpeggio.*`, vorhandene `expression.*` und `trill-musical.*`. Automatisierte Prüfungen: `tests/expression-audit.mjs`, `arpeggio-playback.mjs`, `expression-playback.mjs`. Diese Tests prüfen MIDI-Ereignisse, nicht die subjektive Klangqualität sämtlicher Soundfonts. Keine kostenpflichtige KI-Komposition für diese Prüfung.

Primärquellen:

- [LilyPond 2.26: Supported notation for MIDI](https://lilypond.org/doc/v2.26/Documentation/notation/supported-notation-for-midi): Unterscheidung Standard-MIDI und `articulate`.
- [Unsupported notation for MIDI](https://lilypond.org/doc/v2.26/Documentation/notation/unsupported-notation-for-midi): Grenzen des Standardexports. `articulate` hebt manche davon auf, weshalb zusätzlich tatsächliche MIDI-Daten geprüft wurden.
- [Enhancing MIDI output](https://lilypond.org/doc/v2.26/Documentation/notation/enhancing-midi-output): Erweiterungen und Einschränkungen der Dauerverkürzung.
- [Controlling MIDI dynamics](https://lilypond.org/doc/v2.26/Documentation/notation/controlling-midi-dynamics): Dynamikwerte und Interpolation.
- [Piano / Pedals](https://lilypond.org/doc/v2.26/Documentation/notation/piano): Sustain, Sostenuto und una corda.
- [MEI Tempo](https://music-encoding.org/guidelines/v5/elements/tempo.html): rit./accel. als kontinuierliche Tempoänderung.
- [MEI Fermata](https://music-encoding.org/guidelines/v5/elements/fermata.html): Verlängerung des notierten Wertes.
- [MEI Arpeggio](https://music-encoding.org/guidelines/v5/elements/arpeg.html): Richtung, Nicht-Arpeggio und Verbindungen.
- [Douglas Niedt: Arpeggios](https://douglasniedt.com/ornaments-arpeggios.html): rasche aufeinanderfolgende Anschläge mit gehaltenen Akkordtönen; Zeitpunkt und Geschwindigkeit sind kontextabhängig.

Priorität für weitere Änderungen: kontinuierliche Tempokurven, Fermaten mit synchronem Ensemble, gehaltene Dynamik bei tragenden Instrumenten, zusätzliche Ornamentformen, anschließend instrumentenspezifische Spieltechniken. Keine dieser offenen Funktionen wird durch die Veröffentlichung von v0.1.23 als erledigt erklärt.
