# Projektstand – LilyPond Composition Lab
Stand: 25.10.2026 · **V1.2.11 als begrenztes Fehlerkorrektur-Update veröffentlicht**

## In Arbeit: V1.2.12 – Import-/Compilerdiagnose (noch nicht freigegeben)

- Ziel: identisches Compilerprotokoll bei drei unterschiedlich korrigierten Sonnet-5.5-Dateien untersuchen. Die vollständige Originaldatei funktioniert nach Nutzerangabe direkt in Hacklily.
- Entwicklungszweig: `fix/compile-source-diagnostics-20261025`, PR #2 (Entwurf).
- In `worker/index.js` implementiert: SHA-256, Länge und Anzahl der Pedalbefehle des empfangenen Originals und sämtlicher tatsächlich an Hacklily gesendeter Varianten. Ausgabe mit `LAB-SOURCE-TRACE` im Compilerprotokoll; keine kostenpflichtigen KI-Aufrufe.
- Bisher **keine** Bestätigung der Ursache. Die Daten können zwischen (1) veraltetem App-Arbeitsstand, (2) Fehler in der MIDI-Aufbereitung, (3) echtem Compilerfehler unterscheiden.
- Testfall: `die-alte-standuhr.ly` von Sonnet 5.5 und die Variante ohne Pedalbefehle (darin 0 `\\sustainOn/Off`).
- Zusätzlich implementiert (Commit `bff3c6b`): jeder manuelle Compile erhält eine neue Run-ID; alte Compileranzeige wird vor dem Aufruf gelöscht; während der Kompilierung veränderter Notentext kann kein veraltetes Ergebnis mehr übernehmen. Das ist eine Absicherung, **kein Nachweis für die eigentliche Pedal-Ursache**.
- Regressionstest in `tests/expression-playback.mjs` ergänzt (Commit `25ee1e2`): dieselbe LilyPond-Quelle mit und ohne Pedalbefehle; die Aufbereitung darf in der pedalfreien Fassung keinen Pedalbefehl erzeugen. Testcode ist auf GitHub, **Ausführung nicht bestätigt**.
- Unabhängiger Dateivergleich im lokalen Arbeitsbereich: Sonnet-Original SHA-256 `7a785e2760969cb8b7a13a14f432cecf6b5d0b3febed7ca503278f7f6035396b` mit 50 Pedalbefehlen; pedalfreie Fassung SHA-256 `aec33a82762a3333a50a757f2201f722ee57a46e868fff3a9a9626eb5b5ac082` mit 0. Ein identischer Fehlertext trotz Verschiedenheit verlangt Prüfung des im Worker tatsächlich eingehenden Codes.
- Zusätzlich `tests/workflow-ui.mjs` um Test für zwei aufeinanderfolgende Compile-Klicks mit/ohne Pedalmarkierungen ergänzt (Commit `3c9f772`): erwartet geänderten Quelltext, verschiedene Run-IDs und kein altes Compilerprotokoll.
- Tests hier nicht ausführbar: Repository-Klon im Container scheitert an fehlender DNS-Auflösung für GitHub; GitHub Actions-Läufe für den Zweig bisher nicht vorhanden. **Keine erfolgreiche Testausführung behaupten.**
- Noch offen: Ausführung von Regressionstests und realer Hacklily-Integrationstest; keine Veröffentlichung, kein produktiver Deploy. V1.2.11 bleibt aktuell.
- Nächster Schritt: den geladenen Quelltext und `LAB-SOURCE-TRACE` vergleichen, nachgewiesene Ursache beseitigen und die Tests erfolgreich ausführen.

## Quellen und Ziel

Zentrale Standards: https://github.com/wibem1/AI-Development-Standards/blob/main/DEVELOPMENT_STANDARDS.md. Projektregeln: `AGENTS.md`.

- Zielversion auf ausdrücklichen Folgeauftrag: **1.2.11**.
- GitHub-Ausgangsstand: `513d29c2434e872afd46176702b995ab1fabbb59` auf `fix/run-stale-timeout-20261025`, PR #1; alle parallel eingegangenen Korrekturen übernommen.
- Veröffentlicht: **1.2.11**, https://lilypond-composition-lab.wibem1.chatgpt.site.
- Erfolgreicher Produktionsdeploy: `appgdep_6ade0cb4de208191a8cb921a3458c08b`, Hosting-Quellcommit `336f402a936b0e83d26567bac0ea5b1d7dfb9f96`, Runtime-Environment-Revision weiterhin **1**.
- Vorhandene Hosting-Quelle `d802549e57291dd7c787fe1e35db96014a07743c` geöffnet und verglichen. Site-Identität, privater Zugriff, R2-Bindung und Runtime-Secret bleiben erhalten.

## Was V1.2.11 enthält

Die getesteten Teilkorrekturen sind mit ausdrücklich offener Hosting-Grenze veröffentlicht. Die Oberfläche weist darauf hin, während langer Kompositionen geöffnet und verbunden zu bleiben. **Keine Zusage vollständiger Weiterverarbeitung nach längerem Browserabbruch.** Die frühere Freigabesperre bleibt für diese vollständige Entkopplung bestehen; dieses Update hat einen entsprechend begrenzten Umfang.

- 11-Minuten-Schwelle statt voreiliger Unterbrechung nach 90 Sekunden.
- Periodische, geordnete SSE-Kontrollstände auch bei Anbieter-Stille; DONE-Abschluss ohne Warten auf das Transportende; Modell, Anbieterkennung, UTF-8 und Kosten erhalten.
- Atomare R2-Reservierung für `/api/run-stream` über Isolates hinweg; unsichere Laufkennung wird nicht automatisch erneut ausgeführt.
- Bedingte Statusänderungen schützen abgeschlossene Ergebnisse vor veralteten Statuslesern.
- Fragmente bleiben nach nachfolgenden Verarbeitungsfehlern verfügbar; Diagnosefehler verbergen kein gespeichertes Ergebnis.
- Begrenzte Wiederherstellung bei ungültigen Statusdaten; unbestätigter Auftrag bleibt vorgemerkt.

## Tatsächliche Prüfung

- Dependency-Installation einschließlich festem Miniflare 4.20260730.0 erfolgreich.
- Nach Versionsanhebung: `npm run build`, `npm test` (**27 Testprogramme**) und `npm run validate` erfolgreich.
- Neuer Integrationstest `tests/worker-runtime.mjs` führt die ausgelieferten Module in tatsächlichem workerd mit lokalem R2 aus: atomare Reservierung, bedingte Schreibvorgänge, SSE-Sicherung während Stille, Ergebnis nach kurzem Clientabbruch und keine doppelte Ausführung.
- Derselbe Test lädt zusätzlich den exakten Deployment-Bundle und prüft aktuelle Oberfläche sowie unverändertes Lesen älterer Historien- und Arbeitsstanddaten.
- Weitere Prüfungen: Worker-API, DOM/UI, Auftragsabläufe, Wiederherstellung, harter Node-Runtime-Abbruch, Player, SoundFont, Sicherung, MIDI und Export mit vorhandenen Fixtures und simulierten Anbietern/Renderern.
- Erwartete workerd-Broken-Pipe-Meldung beim absichtlichen Leserabbruch; alle Ergebnis- und Speicherassertionen bestanden.
- Keine kostenpflichtigen KI-Anfragen; keine neue reale Gemini-Komposition oder iPad-/Android-Sicht-/Hörprüfung.
- Produktions-Smoke-Test nach Veröffentlichung bestanden: Startseite zeigt **V1.2.11**; `app-config.mjs`, `run-client.mjs`, Arbeitsstand, Verlauf, Schlüsselstatus und SoundFont-Einstellung liefern HTTP 200. Die SHA-256-Prüfsummen der Antworten für Arbeitsstand, Verlauf, Schlüsselstatus und SoundFont-Einstellung sind vor und nach Veröffentlichung identisch. Keine produktiven Daten geschrieben.

## Bekannte Grenze und nächster Schritt

Die ursprüngliche Diagnose und Produktionsprotokolle belegen: Browserabbruch 12:34:38.207 UTC, Worker-Ende `canceled` um 12:35:08.207 UTC nach insgesamt 166358 ms. Der Auslöser des ersten Transportabbruchs ist ungeklärt. HTTP-`waitUntil()` bietet nur bis zu 30 Sekunden Nachlauf. R2 speichert Kontrollstände, führt keine Aufträge aus. Lange Browserunterbrechungen können weiterhin den laufenden Aufruf verlieren.

Nächste Entwicklungsaufgabe: einen dauerhaft provisionierten Auftragsdienst anbinden und denselben vollständigen Auftrag nach mehr als 30 Sekunden Browserunterbrechung ohne weiteren bezahlten Aufruf im echten Hosting nachweisen. Die synchrone Kompatibilitätsroute `/api/run` muss dann ebenfalls denselben Auftragsdienst verwenden; sie ist noch nicht über Isolates hinweg idempotent.

Details: [V1.2.11](docs/release-1.2.11.md), [Untersuchung](docs/investigation-2026-10-25.md), [ursprünglicher Befund](docs/incident-2026-10-25.md). Keine Löschung, Migration oder Neuverschlüsselung produktiver Benutzerdaten; MIDI-Kompatibilitätskennung unverändert.
