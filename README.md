# LilyPond Composition Lab v0.1.2

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
