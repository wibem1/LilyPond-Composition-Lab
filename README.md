# LilyPond Composition Lab v0.1.30

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

V0.1.14: Standard-Kompositionsbudget 64000 statt 8000 Tokens; alte 8000-Einstellungen werden auf 64000 angehoben, andere explizite Werte erhalten. Kein reasoning-Parameter in der Komposition. Bei finish_reason=length bleibt die Originalantwort samt Kosten im Verlauf/Arbeitsstand und als unvollständiger Download erhalten; keine Titelvergabe, Kompilierung oder Oktavreparatur des Fragments. Eindeutige Statusmeldung statt irreführendem fehlenden score-Block.

V0.1.15: Technische Oktavkorrektur beginnt mit kurzer Denkstufe low / 8000 Tokens für nummerierte Änderungen. Nur nach gescheiterter Quelltext-, Compiler-, Tonumfang- oder Registerprüfung folgt die tiefere Nachkorrektur medium / 24000. Maximal zwei Aufrufe, Original erhalten, alle Kosten und jetzt Antwortdauer protokolliert. Kompositionsaufruf und Prüfmaßstäbe unverändert.

Relative Einzelstimmen: KI liefert nur absolute Zieloktaven als Zahlenliste; die App berechnet die relativen Zeichen deterministisch einschließlich Akkordreferenzen. Beide Versuche verwenden hier low. Nicht unterstützte verschachtelte/gleichzeitige Konstruktionen behalten den bisherigen geprüften Reparaturpfad. Tatsächliche MIDI-Prüfung bleibt zwingend. Reale Diagnose 17d787: vier abgeschnittene medium-Antworten mit jeweils rund 23000 Denktokens und zusammen etwa neun Minuten; LilyPond selbst etwa vier Sekunden.

Echter Test der absoluten Zieloktaven auf 17d787: komplette Reparatur in 26,8 Sekunden statt etwa 4½ Minuten; Kosten 0,0058575 USD, MIDI 256 Noten C1–D6, Dauer 93,912984 s. Nur Oktavzeichen geändert. Reale Zahlenantwort und korrigierte Quelle als Regression gespeichert.

V0.1.16: Beim erfolgreichen Laden eines eigenen Soundfonts wird die Standardbank aus dem aktiven Synthesizer entfernt. Ein exakter GM-Treffer des Standards kann so keine eigenen Presets mit anderen Bank-/Programmnummern verdecken. Der Standard-Button lädt die Standardbank wieder; ungültige Dateien erhalten den bisherigen Klang, Ladefehler bleiben sichtbar. Während Dateieinlesen/Soundfont-Laden ist Start gesperrt, damit kein paralleler Standard-Ladevorgang ausgelöst wird.

V0.1.17 (07.10.2026): Erweiterte Ausdruckswiedergabe mit LilyPonds articulate.ly. Gedruckter score und separate MIDI-Fassung werden im selben Compilerlauf erzeugt; Originalcode und Notenbild bleiben erhalten. Bögen, Tenuto, Staccato, Akzente und Verzierungen werden im MIDI umgesetzt. Unmarkierte Noten werden nur um 1/16 gekürzt, um eine übermäßig abgesetzte Wiedergabe zu vermeiden. Bekannte ritardando/rallentando/accelerando/a-tempo-Textangaben werden auch in Markup erkannt. Ritardando/Accelerando wirken gemäß articulate als Tempowechsel, nicht als kontinuierliche Rampe; frei formulierte Ausdruckstexte werden nicht interpretiert. Dynamik bleibt LilyPonds notierter Dynamikverlauf, keine zufällige Humanisierung oder zusätzliche KI-Aufrufe. Eigene articulate-Setups werden respektiert. Bei fehlgeschlagener Erweiterung wird die normale MIDI-Fassung mit sichtbarer Warnung verwendet; Diagnose protokolliert Modus und Fehler. Bestehende MIDI-Dateien erhalten die Erweiterung durch „Neu kompilieren“.

V0.1.18 (07.10.2026): Allgemeine KI-Vorgaben verlangen musikalisch passende Dynamikverläufe, Artikulation, Phrasierungsbögen, instrumentgerechte Pedalangaben und Tempoveränderungen direkt in der Notation. Verzierungen bleiben eine musikalische Entscheidung. Unveränderte frühere Standardvorgaben werden beim Laden und serverseitig ergänzt; selbst bearbeitete Vorgaben bleiben erhalten. Kein zusätzlicher KI-Aufruf und keine Änderung vorhandener Kompositionen.

V0.1.19 (07.10.2026): Komponieren sendet sofort einen Antwortstrom mit Status und 10-Sekunden-Heartbeats. Auftragsstatus und Endergebnis werden unter der Kennung dauerhaft gespeichert. Browser holt nach Netzwerk-/Streamfehlern oder Neuladen denselben Auftrag ab; kein automatischer erneuter kostenpflichtiger KI-Aufruf. Lokale Vormerkung enthält nur Auftragskennung und Startdatum, keinen Schlüssel. Browser protokolliert Netzwerkfehler, HTTP/API-Fehler, offline/online, Wiederherstellungsversuche und JavaScript-Fehler; offline erfasste Ereignisse werden bei Rückkehr der Verbindung bzw. vor dem Diagnose-Download übertragen. Diagnose enthält Serverstart/Ende, Dauer und Auftragsstatus. Fehlende Server-Aktualisierung über 90 Sekunden wird als Unterbrechung mit unbekannter Ursache protokolliert. Bestehende synchrone API bleibt kompatibel. Heartbeats verhindern inaktive Verbindungen, garantieren aber kein unbegrenztes Weiterlaufen nach einem echten Abbruch: Cloudflare-Laufzeitgrenzen bleiben bestehen; bereits gespeicherter Originalcode im Verlauf bleibt erhalten. App schreibt während eines vorgemerkten Auftrags keinen veralteten Arbeitsstand zurück. Vorschläge mit grace/appoggiatura/acciaccatura werden jetzt im schnellen absoluten Oktavverfahren erfasst; komplexe Konstruktionen einschließlich afterGrace bleiben beim bisherigen Verfahren. Synthetische echte LilyPond-MIDI-Tests und simulierte Netzwerkunterbrechungen geprüft.


## Version 0.1.20 · 07.10.2026

Die Oktavverarbeitung erkennt nun `\relative { ... }` ohne Startton sowie Akzente `->`, die zuvor mit Akkordklammern verwechselt wurden. Der erste Ton wird wie in LilyPond absolut behandelt; weitere Töne und Akkordreferenzen werden rechnerisch aufgelöst. Bei stark driftenden, als absolute Tonhöhen geschriebenen Klavierstimmen kann die App die Oktavzeichen ohne KI-Aufruf neu codieren. Diese Erkennung ist bewusst eng: nur unterstützte sequenzielle Klavierblöcke ohne Startton, viele Oktavzeichen, grobe Bereichsverletzungen und eine durchgehend spielbare absolute Lesart. Unbetroffene Blöcke behalten ihre klingenden Lagen. Jede Korrektur wird anschließend anhand des erzeugten MIDI geprüft und nur bei bestandener Prüfung übernommen. Diagnose enthält Methode, Tonanzahl, Prüfung, Laufzeit und null kostenpflichtige Aufrufe; andere Fälle nutzen weiterhin die KI-Korrektur.

Der Denkaufwand beim Komponieren ist sichtbar wählbar. Die Weboberfläche startet mit „Kurz“ und fordert `reasoning.max_tokens=2048` an; das Notenausgabebudget bleibt unverändert. „Modellvorgabe“ sendet weiterhin keine Denkbegrenzung. Die Auswahl wird mit Arbeitsstand und Verlauf gespeichert und in der Diagnose protokolliert. Nicht jeder Anbieter setzt das Budget als harte Grenze um; garantierte Sekundenzeiten und unveränderte musikalische Qualität werden nicht behauptet. Bestehende API-Aufrufe ohne die neue Auswahl behalten die Modellvorgabe.


## Version 0.1.21 · 07.10.2026

Eigene SF2-Soundfonts werden nach erfolgreichem Laden als Datei im privaten App-Speicher gespeichert (seit v0.1.26 ohne feste Größenbegrenzung der App). Metadaten und aktive Auswahl bleiben bei Neuladen und Gerätewechsel erhalten. Beim ersten Abspielen lädt der Player den gespeicherten Klang; Audioinitialisierung bleibt an die Benutzeraktion gebunden. „Standard-SoundFont“ setzt die gespeicherte Auswahl zurück. Fehlgeschlagenes Speichern wird ausdrücklich angezeigt; eine unvollständige/ungültige Übertragung ersetzt die zuvor gespeicherte Datei nicht. Früher nur im Player geladene Dateien müssen einmal neu gewählt werden. Die Diagnose nennt die gespeicherte Soundfont-Auswahl.

Die zusätzliche MIDI-Fassung erzeugt Triller mit einer Zielrate von ungefähr acht Einzeltönen pro Sekunde, unabhängig vom Stücktempo. Die Anzahl wird auf vollständige Tonpaare gerundet; sehr kurze Triller behalten die Mindestzahl des LilyPond-Moduls. Notenbild, Stücktempo, Dynamik, übrige Verzierungen und Autoren mit eigener articulate-Konfiguration bleiben erhalten. Vorhandene MIDI-Dateien benötigen einmal „Neu kompilieren“, ohne KI-Aufruf. Die Diagnose/Kompilierantwort kennzeichnet die neue Standardrate, ohne sie rückwirkend für ältere MIDI-Dateien zu behaupten.


### Automatische Oktavverarbeitung ohne KI ab 0.1.21

Alle kostenpflichtigen KI-Korrekturaufrufe für Oktavlagen sind entfernt. Der separate Korrekturbutton entfällt. Nach einer Komposition und bei jedem Kompilieren wird das MIDI geprüft und bei Bereichs- oder Registerverletzungen eine rein rechnerische Korrektur versucht. Unterstützt werden auflösbare sequenzielle relative Blöcke (mit/ohne Startton) und absolute Notation. Die App bevorzugt eine quellennahe Korrektur. Bei kumulativer Drift in `\\relative` wird geprüft, ob relative Oktavmarker (`'`/`,`) die Stimme über Taktgrenzen fortlaufend aus ihrem Register treiben. Dann werden ausschließlich vollständige notierte Takte oktaviert; sämtliche Intervalle und die Kontur innerhalb jedes Taktes bleiben unverändert. Die Taktlagen werden so gewählt, dass der gesamte Block im Instrumentenumfang bleibt und die fortlaufende Registerdrift deutlich kleiner wird. Eine einheitliche Oktavverschiebung einer ganzen Stimme bleibt als sichere zweite Möglichkeit erhalten. Einzelne MIDI-Töne werden nicht mehr unabhängig in den spielbaren Bereich geklemmt. Eindeutig erkennbare absolute Schreibweise in relativen Klavierblöcken wird weiterhin gesondert neu codiert. Instrumente aus einfachen benannten Staff-Stimmen werden mit den tatsächlich kompilierten Instrumentenprofilen abgeglichen; bei uneindeutiger Zuordnung, unbekanntem Tonumfang oder komplexen nicht unterstützten Konstruktionen bleibt das Original mit konkreter Fehlermeldung erhalten. Es findet kein KI-Fallback statt.

Eine rechnerische Bereichskorrektur belegt Spielbarkeit der Tonhöhen, nicht die musikalisch beabsichtigte Oktave. Notennamen, Rhythmus, Tempo und Ausdruckszeichen werden nicht verändert. Jede Kandidatenfassung wird erneut kompiliert und nur mit bestandener MIDI- und Registerprüfung übernommen. Diagnose protokolliert Methode, Änderungen, Laufzeit, Annahme/Ablehnung und `paidCalls: 0`. Die bestehende Reparatur-API bleibt für Kompatibilität verfügbar, benötigt aber weder Modell noch Schlüssel. Bereits entstandene historische Kosten werden korrekt weiter angezeigt; neue Oktavprüfungen/-korrekturen verursachen keine KI-Kosten.


## Version 0.1.22 · 07.10.2026

Die Trillerwiedergabe ersetzt die feste Rate aus 0.1.21 durch eine tempoabhängige Interpretation: Zielwert 4–10 Anschläge pro Sekunde, gerundete Tonanzahl innerhalb der notierten Dauer. Lange Triller beginnen mit längeren Tönen, beschleunigen sanft und schließen auf dem Hauptton. Kurze Triller können wegen der notwendigen drei Töne schneller ausfallen. Kein zusätzliches Tempoereignis wird erzeugt. Dies ist eine Ausführungsentscheidung der App, keine allgemeingültige historische Regel.

Standard ist der Hauptnotenanfang. `\labTrillFromUpper { c'2\trill }` ermöglicht den historischen Nebennotenanfang, `\labTrillFromMain` den ausdrücklichen Hauptnotenanfang. Ein vorausgehender Vorschlag auf der Hauptnote lässt den Wechsel mit der oberen Note beginnen; ein oberer Vorschlag wird durch den Hauptton fortgesetzt. Eine automatische Stilerkennung findet nicht statt.

Die Nebennote folgt der Tonart; `\pitchedTrill ... \startTrillSpan <Ton>` hat Vorrang und bleibt auch während des Trillerspanners erhalten. Tonart- und Trillerspannerzustände werden pro gleichzeitiger Stimme getrennt. Bei einem Akkord trillert nur der höchste Ton, die übrigen werden gehalten. Ein ausgeschriebener `\afterGrace`-Nachschlag wird mit moderater Dauer berücksichtigt; ein nicht notierter Nachschlag wird nicht erfunden. Vorzeichen allein als grafisches Markup werden nicht als klingender Trillerton interpretiert; dafür muss der Ton ausdrücklich angegeben sein.

Das gedruckte Notenbild bleibt erhalten. MIDI-Dateien im Verlauf werden nicht rückwirkend geändert; einmal **Neu kompilieren** übernimmt die neue Wiedergabe ohne KI-Kosten. Eigene `articulate.ly`-Konfigurationen bleiben maßgeblich. Die Diagnose nennt `musical-v2` und die Zielwerte. Reale LilyPond-2.26-MIDI-Tests prüfen Haupt-/Nebennotenanfang, Tonarten, expliziten chromatischen Trillerton, gehaltene Akkordtöne, Vorschläge, Nachschlag, kurze Triller, Trillerspanner, unabhängige Stimmen sowie unveränderte Tempo- und Taktlängen.

Grundlagen: [Music and the Bassoon, University of Texas, Unit 44](https://www.musicandthebassoon.org/50-units/unit-44), [MEI Trill](https://music-encoding.org/guidelines/v5/elements/trill.html), [Henle: C. P. E. Bach, Hinweise zur Aufführungspraxis](https://www.henle.de/media/ab/53/5a/1697725708/0555-1697725708-sync.pdf).

### v0.1.23 – Arpeggien, Kostenverlauf und Ausdrucksprüfung

Arpeggiozeichen werden im separaten MIDI-Score als rasch aufeinanderfolgende, gehaltene Akkordtöne gespielt. Auf-/Abwärtsrichtung, einmalige Einstellungen, verbundene oder unabhängige Klavierhände, Nicht-Arpeggio-Klammern sowie kurze Notenwerte sind berücksichtigt. Ganze gebundene Akkorde und Pedalwechsel sind mit Compiler-MIDI getestet. Beginn standardmäßig auf dem Schlag; keine automatische historische Interpretation.

Kosten werden je Verlaufseintrag gespeichert und in der Liste sowie beim Laden angezeigt. Alte Einträge ohne erfasste Kosten zeigen „Kosten nicht erfasst“; sie übernehmen keine Kosten der vorher geladenen Komposition.

Die [Ausdrucksprüfung](docs/expression-audit.md) dokumentiert getestete Funktionen, feste Näherungen und offene Lücken. Insbesondere kontinuierliche Tempoänderungen, Fermaten, Dynamik auf gehaltenen Tönen, Glissando und manche Ornamentformen sind noch nicht vollständig umgesetzt.


### v0.1.24 – quellennahe Oktavkorrektur

Die frühere Einzelton-Korrektur bei stark entgleister relativer Notation ist entfernt. Die App erkennt nun kumulative Oktavdrift in sequenziellen `\\relative`-Blöcken und verschiebt bei eindeutiger Evidenz nur vollständige notierte Takte um ganze Oktaven. Dadurch bleiben die Intervalle und die Kontur innerhalb jedes Taktes exakt erhalten. Die Korrektur wird nur übernommen, wenn alle Takte im Instrumentenumfang liegen und die Registerdrift deutlich reduziert wird; andernfalls bleibt das Original erhalten. Eine gleichmäßige Oktavverschiebung der vollständigen Stimme ist weiterhin zulässig, weil sie ebenfalls Intervalle und Kontur unverändert lässt. Regressionstest: Diagnose-Lauf `0d1db3d2b0884ebbb5d591dd5ca122a1` mit der entgleisten Mozart-Begleitstimme.

### v0.1.25 – alte Oktavkorrekturen wiederherstellen

„Neu kompilieren“ erkennt die exakt gespeicherte Ausgabe der früheren Einzeltonkorrektur (`mechanical-instrument-range`) anhand einer akzeptierten Korrektur im Diagnoseprotokoll. Nur bei unverändertem Quelltext wird das davor protokollierte Original erneut quellenbezogen korrigiert und kompiliert. Die neue Fassung wird ausschließlich nach bestandener MIDI- und Registerprüfung übernommen; eigene Änderungen werden nicht ersetzt. Kein zusätzlicher KI-Aufruf. Regressionstests verwenden die vollständige Mozart-Diagnose samt Auftakt und prüfen Basstonlage, unveränderte rechte Hand, Intervalle innerhalb der Takte und den Neukompilierungsweg.

### v0.1.26 – Soundfonts ohne 64-MB-Grenze

Die feste 64-MB-Sperre ist sowohl beim Auswählen als auch beim Speichern entfernt. Die vollständige SF2-Struktur wird weiterhin geprüft; ungültige Dateien ersetzen keinen gespeicherten Klang. Regressionstest: eine gültige RIFF/SF2-Datei über 64 MiB wird mit Content-Length gespeichert und unverändert zurückgelesen. Praktische Grenzen ergeben sich weiterhin aus Arbeitsspeicher und Hosting, nicht aus einer festen Dateigrenze in der App.

### v0.1.27 – große Soundfonts speicherschonend hochladen

Die Oberfläche überträgt SF2-Dateien in aufeinanderfolgenden 8-MiB-Teilen über die native R2-Multipart-API und zeigt den Fortschritt. Der Server hält nur einen Teil im Speicher; RIFF/SF2-Header werden über Teilgrenzen hinweg geprüft. Erst nach vollständiger Prüfung und Abschluss wird der gespeicherte Klang ersetzt. Fehler und abgebrochene Uploads erhalten die bisherige Auswahl. Der Player lädt den Soundfont weiterhin im Browser; dessen verfügbarer Arbeitsspeicher bleibt maßgeblich. Prüfung: 160-MiB-Datei über die tatsächliche Worker-Route mit maximal 8 MiB pro Anfrage, Datenintegrität, Fehler/Abbruch, unvollständige und ungültige Dateien sowie die echte Browser-Uploadfunktion.

Grundlage: https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/

### v0.1.28 – Soundfont lokal behalten und vorladen

Der aktive eigene Soundfont wird zusätzlich auf dem jeweiligen Gerät in CacheStorage gespeichert. Beim Öffnen prüft die App die Servermetadaten und verwendet bei identischem Speicherzeitpunkt und gleicher Größe die lokalen Bytes; der Download beginnt andernfalls bereits im Hintergrund mit Prozentanzeige. Eine lokal gewählte Datei befüllt den Cache nach erfolgreichem Cloud-Speichern unmittelbar. Audioinitialisierung und Wiedergabe beginnen weiterhin erst auf Klick. Versionsänderungen am Klang, der Wechsel auf Standard und unvollständige Übertragungen werden berücksichtigt. Bei nicht verfügbarem lokalen Speicher bleibt Netzladen möglich; Browser können lokale Daten bei Speicherknappheit entfernen. Playerfehler werden in der Diagnose erfasst. Geprüft: neuer App-Start ohne Download, exakte Bytes, geänderte Klangversion, gemeinsames Vorladen/Abspielen, Fortschritt, alte parallele Downloads, fehlender Speicher und unvollständige Datei.

### v0.1.29 – verwendete KI im Kompositionscode

Neue vollständige Kompositionen enthalten das Modell aus der API-Antwort (ersatzweise das angeforderte Modell) als KI-Modell-Kommentar und im Komponistenfeld aller Header. Die unveränderte Originalantwort bleibt im Diagnoseprotokoll erhalten. Verlauf, Arbeitsstand und LilyPond-Download übernehmen denselben gekennzeichneten Code; reine Neukompilierungen und importierte Dateien werden nicht umetikettiert. Kein zusätzlicher KI-Aufruf.

### v0.1.30 – kurzes Denken bei Sonnet 5.5

Die Diagnose e7bdcb78 zeigte 27.323 Denktokens trotz angefordertem 2.048-Token-Denkbudget. Für `anthropic/claude-sonnet-5.5` (einschließlich datierter/Router-Varianten) sendet „Kurz“ jetzt `reasoning.effort=low`, den dokumentierten Regler für adaptives Denken, statt des alten Tokenbudgets. „Modellvorgabe“ sendet weiterhin keine Denksteuerung. Andere Modelle behalten ihre bisherige Behandlung. Notenausgabebudget, Kompositionsauftrag und Systemprompt bleiben unverändert. Die Hilfe beschreibt die modellabhängige Steuerung; die Diagnose protokolliert den tatsächlich gesendeten Parameter. Simulierte Worker-Tests prüfen beide Sonnet-Einstellungen, unveränderte Prompts/Budgets und gespeicherte Auswahl. Es wurde kein kostenpflichtiger Vergleichslauf ausgeführt; Einsparung und musikalische Qualität müssen am nächsten echten Ergebnis verglichen werden.

Grundlagen: https://platform.claude.com/docs/en/build-with-claude/effort und https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
