## Offene Korrektur vom 17.11.2026 – MIDI-Instrumente bei LilyPond-Import

- Branch `fix/midi-instrument-names-20261117`, PR #4; **noch nicht veröffentlicht**, bisherige Produktionsversion bleibt V1.2.11.
- Fehlerbeispiel: OpenCraft `Elisabethanische_Serenade.ly` schreibt `instrumentName = "Violine"`, jedoch kein `midiInstrument`; analog Klavier-Notenzeilen.
- Implementierung: `ensureMidiInstruments` in `src/notation-layout.mjs` ergänzt eindeutige MIDI-Instrumente für benannte Staff-Kontexte sowie die Kinder eines als Klavier bezeichneten PianoStaff. Explizite Zuordnungen werden nicht überschrieben. Beim Kompilieren und bei der optionalen Ottava-Neukompilierung verwendet; angepasster Quelltext wird zurückgegeben.
- Verifiziert: unmittelbarer Test mit dem betroffenen LilyPond-Score-Skelett (Violine plus zwei Klavierzeilen), Idempotenz und Schutz expliziter Instrumentangaben bestanden. Regressionstest `tests/midi-instrument-names.mjs` auf GitHub gesichert.
- **Noch offen:** vollständiges `npm test`, `npm run build`, `npm run validate`, echte Hacklily-MIDI-Kompilierung sowie SoundFont-Hörtest. GitHub-PR meldete noch keine Workflow-Checks. Vor Integration/Release Version auf 1.2.12 anheben und diese Prüfungen durchführen. Keine Produktionsfreigabe ohne Nachweis.

# Projektstand – LilyPond Composition Lab
Stand: 25.10.2026 · **V1.2.11 als begrenztes Fehlerkorrektur-Update veröffentlicht**

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
