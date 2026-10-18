# MusicXML-Export · v0.1.46 · 17.10.2026

Datenfluss: aktueller Editor → `/api/export-musicxml` → `musicXmlCapture` → bestehender Hacklily-Compiler → `capturedMusic` → `musicXmlScore` → gespeicherte `.musicxml`-Datei → Download/Verlauf.

Der Export hat einen eigenen Datenweg. Er verwendet weder den Ausdrucks-MIDI-Zweig noch die Oktavkorrektur oder einen KI-Anbieter. Die vom Compiler gelesenen klingenden Tonhöhen bleiben unverändert; MusicXML-Oktavlinien ändern nur ihre Darstellung. Klavierhände erhalten getrennte Systeme und eindeutige Stimmen. Vorschläge haben in MusicXML keine reguläre Dauer; stille Vorschlags-Platzhalter werden nicht als zusätzliche Pausen exportiert. LilyPonds `InitialContextMusic` initialisiert Vorschläge und darf nicht als zweite Note ausgegeben werden.

Der Editor bleibt maßgeblich. Ändert er sich während des Exports, wird das Ergebnis nicht dem geänderten Arbeitsstand zugeordnet. Compilerfehler, unvollständige Strukturen und nicht unterstützte zeitliche Konstruktionen liefern einen erklärten Fehler statt einer vermeintlich vollständigen Datei. Unterstützbare Noten mit nicht übertragener Sonderangabe liefern einen sichtbaren Hinweis. Exportfehler verändern Code, MIDI und Notenbild nicht.

Präzise grafische Positionen und LilyPonds Seitenlayout sind nicht Teil dieses Exports. Textangaben erhalten ihren musikalischen Zeitpunkt über MusicXML-Offsets. Das Zielprogramm entscheidet über den endgültigen Satz.

Die XML-Struktur folgt der [MusicXML-4.0-Referenz](https://www.w3.org/2021/06/musicxml40/). Live- und aufgezeichnete Compilerprüfungen sowie XML-Schema und Rückkonvertierung prüfen Inhalt und Zeitachsen. Ein manueller Import in Scorelio oder MuseScore ist in dieser Umgebung nicht geprüft.
