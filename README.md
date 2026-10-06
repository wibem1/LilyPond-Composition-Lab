# LilyPond Composition Lab v0.1.13

WebApp für Computer, Android und iPad. Direkter Ablauf: Auftrag → KI → editierbarer LilyPond-Code → Online-Kompilierung → eingebettete Notenansicht und MIDI-Wiedergabe. Kein vorgeschalteter Entwurf, keine Composition Engine, kein neues Zwischenformat.

## Übernommener Unterbau

Kompositionslabor v0.4.7, Quellstand `32e5b4c2f72e11b27e671ffb7a6b05db82dbfdab`: R2-Verlauf und Dateien, gemeinsamer letzter Arbeitsstand, AES-GCM-Schlüsselspeicherung, Diagnose-Download, OpenRouter-Modellkatalog, SpessaSynth AudioWorklet und TimGM6mb. Die bestehende Anwendung wurde nicht geändert. Dieses Projekt hat einen eigenen Datenspeicher und eigene Schlüssel; Schlüssel werden unter Verbindung neu eingegeben.

## V0.1

Auftrag und editierbare Zusatzangaben werden bei jedem KI-Aufruf vollständig gesendet. Modelle stammen aus dem aktuellen OpenRouter-Katalog. Kein erzwungenes niedriges Reasoning. Die KI liefert direkt LilyPond. Der Compiler prüft vor dem KI-Aufruf mit synthetischen Noten seine Erreichbarkeit. Der erzeugte Originalcode wird vor seiner Kompilierung gespeichert. Compilerfehler und Warnungen werden angezeigt; Warnungen allein sperren die MIDI-Ausgabe nicht. Keine automatische Reparatur und kein musikalisches Qualitätsversprechen.

Zum Kompilieren wird der Code an Hacklily übertragen. Notenseiten werden als SVG-Bilder eingebettet; MIDI kommt aus derselben Quelle. Der Player startet nur auf Klick, bietet Pause/Stopp/Position/Lautstärke und eigene SoundFonts. Importierte und erzeugte LilyPond-Dateien verwenden denselben Verlauf. Änderungen am Code machen alte Noten und MIDI ungültig bis zur Neukompilierung.

Diagnose: App-Version, Zeitpunkt, Auftrag, Systemprompt, Modell, Antwort, Tokenverbrauch, gemeldete USD-Kosten, Dauer, Compilerquelle und Compilerprotokoll, Fehler. Keine API-Schlüssel. Compilerfehler erhalten die KI-Ausgabe und ihren Verlaufseintrag. Verlauf, letzter Arbeitsstand, Dateien und Diagnosen sind dauerhaft und geräteübergreifend. Gleichzeitige Gerätebearbeitung hat keine Konfliktzusammenführung.

## Entwicklung und Prüfung

`npm ci`, `npm run build`, `node tests/webapp.mjs`, `node tests/player.mjs`, `npm run validate`.

Geprüft mit isoliertem Speicher und simulierten KI-/Renderer-Aufrufen auf Grundlage echter synthetischer Renderer-Fixtures: direktes Prompting, Schlüssel speichern/löschen, Diagnose ohne Schlüssel, Ergebnis bei Compilerfehler erhalten, SVG und MIDI, Verlauf/Arbeitsstand, Import-Speicherstruktur, Kostenstopp bei Renderer-Ausfall, Löschen und Assets. Playerprüfung: echte endliche hörbare PCM-Ausgabe, Font-Wechsel, Fehlererholung und Transportzustände. Artefakt exportiert Cloudflare-kompatibles default.fetch.

Kein kostenpflichtiger Live-KI-Aufruf, kein tatsächlicher Android-/iPad-Audiotest, keine musikalische Bewertung. Browser-WebMCP-Kontext hier nicht verfügbar; optionale Tools bleiben auf unterstützten Browsern beschränkt. Die echte Verbindung zum Online-Renderer wird beim Benutzen erneut vorgeprüft.

## Nächste Schritte

V0.2: Auswahl/Motiv und deterministische Transformationen. V0.3: KI-Varianten und Vergleich mit algorithmischen Varianten. Diese Funktionen sind in V0.1 noch nicht enthalten.

## Veröffentlichung

Private WebApp über Sites mit `BUCKET` (R2) und Runtime-Secret `LAB_KEY_ENCRYPTION_KEY` (Base64 eines zufälligen AES-256-Schlüssels). Kein API-Key oder Secret in diesem Repository. Manifest und Service Worker ermöglichen Start über ein App-Icon; Internet bleibt erforderlich. Service Worker speichert keine alten Oberflächen oder privaten API-Daten.

V0.1.1: Schlüssel werden von kopierten Bearer-Präfixen, Zeilenumbrüchen und unsichtbaren Zeichen bereinigt. OpenRouter prüft die Anmeldung über GET /api/v1/key vor Speicherung und vor der Komposition; bei Ablehnung bleibt ein vorheriger gespeicherter Schlüssel erhalten. Verbindung prüfen startet keine Komposition. Fehlerprotokolle enthalten Providerstatus und Fehlermeldung, niemals den Schlüssel. Direkte Provider-Schlüssel werden mit eindeutiger Erklärung abgelehnt.

V0.1.2: Cloudflare-kompatibles redirect=manual für OpenRouter-Schlüsselprüfung und Komposition. HTTP-Weiterleitungen werden vor Antwortverarbeitung explizit abgebrochen, der Schlüssel wird nicht an andere Ziele weitergegeben. Regressionstest simuliert die Einschränkung der Worker-Laufzeit und einen HTTP-302-Fall.

V0.1.3: API-Schlüsselfeld als normales Textfeld mit ausgeschalteter Autokorrektur, Großschreibung und Autovervollständigung sowie Hinweisen an Passwortmanager. Kein password-Eingabefeld. Bereits verschlüsselt gespeicherte Schlüssel bleiben unverändert; die App liest den Schlüssel nicht in das Eingabefeld zurück. Browser-Verhalten auf Android ist nicht hier verifiziert.

V0.1.4: AudioWorklet mit 17 Stereoausgängen statt einem Ausgang mit 34 Kanälen. Player-Quelltext wird bei jedem Build frisch eingebunden. Regressionstest verwendet die echte SpessaSynth-Bibliothek mit simuliertem Browser-Kanallimit und prüft Initialisierung sowie alle Ausgangsverbindungen. Android-Wiedergabe ist hier nicht am Gerät verifiziert.

V0.1.5: Neue Kompositionen erhalten eine zusätzliche reine Titelanweisung mit bisherigen Namen. Wiederholte Titel bekommen als Rückfall eine freie Nummer; Header, Verlauf und Dateien verwenden denselben Titel. Musikalischer Systemprompt bleibt unverändert. Keine zusätzliche KI-Anfrage.

V0.1.6: Nummerierung als Ersatz für neue Titel entfernt. Bei Wiederholung wird dasselbe Modell gezielt nur nach einem neuen passenden Titel zur fertigen Partitur gefragt (maximal zwei Versuche). Nummerierte Varianten bisheriger Namen werden abgelehnt. Nur die Titelzuweisung im Header wird geändert; die originale KI-Antwort bleibt in der Diagnose. Zusätzliche Aufrufe und Kosten werden protokolliert und mitgerechnet. Bei Ausfall der Titelanfrage bleibt das Stück abspielbar und gespeichert, mit sichtbarem Hinweis auf den ursprünglichen Titel.

V0.1.7: Technische Standardvorgabe fordert eindeutige absolute Oktavnotation und Prüfung der Klavierlage. Unveränderte alte Standardprompts werden aktualisiert, eigene Bearbeitungen bleiben erhalten. Nach jeder MIDI-Kompilierung werden die klingenden Töne pro Instrument und aktivem GM-Programm geprüft. Grenzüberschreitungen erzeugen einen sichtbaren Hinweis mit Instrument, Ton und Zeitposition; unbekannte Profile werden als unvollständig geprüft gemeldet. Noten/MIDI werden nicht gesperrt und importierte Musik nicht umgeschrieben. Details und Referenzquellen: docs/instrument-ranges.md. Die konkrete Luna-Komposition vom Lauf 9f9f8827226b4896be0138cf3d02e6cb wird mit absoluter Bassnotation korrigiert und anhand der tatsächlich kompilierten MIDI geprüft.

V0.1.8: Instrumentennamen werden nur am ersten Notensystem der Partitur gedruckt. Wiederholungen auf weiteren Systemen und Folgeseiten werden im LilyPond-Layout unterdrückt, auch für markierte Namen und Klavier-/Instrumentengruppen. Quelltext, Instrumente und MIDI-Musik bleiben unverändert. Bestehende Stücke übernehmen die Darstellung beim erneuten Kompilieren.

V0.1.9: Der ursprüngliche freie Standardprompt ist wiederhergestellt. Der später ergänzte Zwang zu absoluter Oktavnotation entfällt; gespeicherte unveränderte technische Standardprompts werden automatisch zurückgesetzt, eigene Systemvorgaben bleiben erhalten. Die Prüfung der tatsächlichen MIDI-Tonhöhen gegen den Instrumententonumfang bleibt aktiv. Eine musikalische Qualitätsverbesserung ist damit noch nicht nachgewiesen.

V0.1.10: Der Kompositionsaufruf enthält wieder exakt zwei Nachrichten (Systemtext und Auftrag), wie in v0.1.0. Die Titelsperrliste wird ausschließlich nach dem Komponieren verwendet. Bei erkannten Tonumfangfehlern folgt höchstens ein gesonderter technischer KI-Aufruf. Seine Antwort wird nur übernommen, wenn ausschließlich Oktavzeichen geändert wurden und die neu kompilierte MIDI-Datei sämtliche hinterlegten Tonumfänge einhält. Fehlgeschlagene Korrekturen erhalten das Original und die Warnung. Kosten und Prüfergebnisse stehen vollständig in der Diagnose. Neu kompilieren bleibt ohne KI-Aufruf. Musikalische Qualitätsverbesserung ist nicht garantiert.

V0.1.11: Zusätzlich zum äußersten spielbaren Tonumfang prüft die App länger anhaltende hohe Cellolagen. App-Regel: mindestens vier aufeinanderfolgende Noten oberhalb G4 über mindestens acht Sekunden lösen eine Registerprüfung und beim Komponieren eine technische Oktavkorrektur aus. Das ist eine auf Nutzerwunsch gewählte Registerregel, kein allgemeines Verbot hoher Cellotöne. Einzelne Spitzentöne und ausdrücklich beauftragte hohe Lagen bleiben zulässig. Die Korrektur muss Quelltextvergleich, Tonumfang- und Registerprüfung bestehen; sonst bleiben Original und Warnung erhalten. Die freien Kompositionsvorgaben bleiben unverändert.

V0.1.12: Reale Diagnose: Gemini verbrauchte 7677 von 7996 Ausgabetokens fürs Denken; die technische Volltextkorrektur wurde abgeschnitten. Die Reparatur liefert jetzt kurze JSON-Änderungen und erhält bei verbleibenden Fehlern einmal die konkreten Compiler-/MIDI-Prüfergebnisse zur Nachkorrektur (höchstens zwei Aufrufe), die eindeutig und überlappungsfrei im Original angewendet werden. Nur diese technische Anfrage verwendet reasoning.effort=low und 8000 Tokens; der Kompositionsaufruf bleibt unverändert. Quelltext-, Tonumfang- und Registerprüfung gelten weiterhin. Die Quelltextprüfung erkennt auch die gültigen Tonaliase es und as; deren Fehlen hatte eine tatsächlich korrekte Nachkorrektur fälschlich abgewiesen. Gescheiterte Reparaturen werden ausdrücklich als fehlerhaft angezeigt. „Oktavfehler beheben“ prüft und repariert auch bereits vorhandene Stücke; Kosten und Originalquelle bleiben in der Diagnose.

V0.1.13: Diagnose c43b07ef: ungültige JSON-Escapes und weiterhin kumulative Oktavdrift. Technische Reparatur verwendet nummerierte Tonpositionen und ganzzahlige neue Oktavzeichen statt mehrfach escapeter Quelltextausschnitte. Relative Tonhöhenregeln sind ausdrücklich erklärt; technische Denkstufe medium mit 24000 Gesamttokens (8000 wurden im echten Test vom Denken aufgebraucht), Komposition unverändert. Quelltext-, echte MIDI-Tonumfang- und Registerprüfung bleiben verbindlich vor Übernahme. Legacy-Textänderungen bleiben für gespeicherte Regressionen lesbar.

Echter v0.1.13-Test mit Gemini 3.8 Flash auf Diagnose c43b07ef: erste vollständige Korrektur mit 24000 Tokens akzeptiert, Kosten 0,0920715 USD, 140 MIDI-Noten E1–C6, Dauer 31,304304 s bei 92 BPM / 16 Takten 3/4. Nur Oktavzeichen geändert; Notennamen, Rhythmus und übriger Quelltext geschützt. 22968 Denktokens zeigen, dass diese technische Korrektur mehrere Minuten dauern kann. Ergebnis im bestehenden Verlauf und Arbeitsstand gespeichert. Reale Modellantwort als Regressionstest gespeichert.
