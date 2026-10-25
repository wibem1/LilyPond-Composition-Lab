# Projektstand – LilyPond Composition Lab
Stand: 25.10.2026 · Korrekturkandidat, Veröffentlichung von **1.2.1 gesperrt**

## Verbindliche Quellen
- Zentrale Regeln: https://github.com/wibem1/AI-Development-Standards/blob/main/DEVELOPMENT_STANDARDS.md
- Projektregeln: `AGENTS.md`; technische Einzelheiten und Testergebnisse: `docs/investigation-2026-10-25.md`.
- Aktuell veröffentlicht: **1.2.0**, https://lilypond-composition-lab.wibem1.chatgpt.site
- Parallel eingetroffener Korrekturcommit `144d4c938f4c90f4eacf3cae988e67d1e0fc671b` wurde integriert; dessen Prüfung auf hartes Runtime-Ende und ungültige Statusantworten bleiben erhalten.
- Arbeitsbranch: `fix/run-stale-timeout-20261025`, PR #1. Ausgangscommit: `18635f60021979681a2cb1fa1b4741fefe559285`.
- Bestehende Hosting-Quelle `d802549e57291dd7c787fe1e35db96014a07743c` abgeholt und verglichen: gegenüber GitHub nur die neuen Projektanweisungen, Projektstanddatei und bisherige Timeoutkorrektur/Regressionstest unterschiedlich. Keine Änderung der Site-Identität, Freigabe, Runtime-Secrets oder gespeicherter Benutzerdaten vorgenommen.

## Nachgewiesene Fehlerursache
Die Originaldiagnose `Diagnose-80f91019ea8f486b992680af0b48049e.json` und aktuelle Produktionslogs wurden gelesen. Browserabbruch 12:34:38.207 UTC; die Serveranfrage wurde um 12:35:08.207 UTC mit `outcome: canceled` beendet (166358 ms gesamte Laufzeit). Das passt genau zur dokumentierten Cloudflare-Grenze von 30 Sekunden für `waitUntil()` nach Verbindungsabbruch. Eine Statusabfrage startet diese Serverausführung nicht neu. Die anschließende 90-Sekunden-Erkennung war zusätzlich zu früh. Der ursprüngliche Auslöser der Browser-Netzwerkunterbrechung ist weiterhin nicht belegt.

## Implementiert und mit Simulation getestet
- Bisherige 11-Minuten-Schwelle übernommen; drei ältere Testprogramme an den tatsächlichen neuen Grenzwert angepasst.
- Atomare, persistente R2-Auftragsreservierung im Streaming-Endpunkt verhindert doppelte Ausführung derselben Kennung über getrennte Serverinstanzen hinweg; unveränderliche Reservierung bleibt auch bei fehlender Statusdatei erhalten. Speicherfehler starten keinen KI-Aufruf.
- Bedingte Statusänderungen verhindern, dass eine veraltete Statusabfrage ein inzwischen gespeichertes Ergebnis überschreibt.
- Kleine SSE-Textfragmente werden auch während anschließender Anbieter-Stille gesichert; DONE beendet den Leser ohne Warten auf den Transportabschluss; Anbieterkennung, UTF-8, Kosten und Teilantworten bleiben erhalten.
- Gesicherte Teilantworten werden auch nach nachfolgenden Verarbeitungsfehlern angeboten. Fehler im Abschlussprotokoll verbergen kein gespeichertes Ergebnis. Ein fehlgeschlagener Ergebnisspeichervorgang wird nicht als Erfolg ausgegeben.
- Ein unbestätigter Browserauftrag bleibt vorgemerkt, statt nach fünf unbekannten Statusantworten einen neuen Auftrag zuzulassen.

## Tatsächliche Prüfungen
- `npm ci`: erfolgreich.
- `npm run build`: erfolgreich.
- `npm test`: **26 Testprogramme bestanden**, einschließlich Worker-API-, Wiederherstellungs-, unabhängiger Modulinstanz-/Reservierungs-, Provider-SSE-, DOM/UI-, Player-, Backup- und Exportprüfungen.
- `npm run validate`: erfolgreich, erzeugter Worker ist gültiges ESM mit `default.fetch`.
- `git diff --check`: erfolgreich.
- Zusätzlich: echter Node-Worker-Thread hart beendet; nur gespeichertes Fragment wiederhergestellt, kein automatischer Provider-Neustart. Das simuliert den Runtime-Verlust, nicht Cloudflare selbst.
- **Keine kostenpflichtigen KI-Aufrufe**, kein produktiver Kompositionsauftrag und kein neuer Produktionsdeploy.
- Anbieter/Renderer/R2 werden in den Integrationstests simuliert; vorhandene echte MIDI-/Compilerantworten sind gespeicherte Fixtures, keine hier neu ausgeführten LilyPond-/Gemini-Aufrufe. Node-DOM-Testmodell ist kein echter Safari-/Android-Test.

## Konkreter Freigabeblocker und nächster Schritt
Der aktuelle HTTP-Worker mit R2 ist **kein browserunabhängiger Auftragsprozessor**. Er kann einen langen KI-Aufruf nach dem 30-Sekunden-Fenster verlieren. Die verfügbaren Sites-Werkzeuge und der dokumentierte Hosting-Vertrag stellen für dieses Projekt keine Provisionierung einer Queue, eines Workflows oder eines Durable-Object-Auftragsdienstes bereit; auch die Anschluss-Suche lieferte keinen passenden Cloudflare-Verwaltungsanschluss. R2 speichert Daten, führt aber keine Aufträge aus.

**Nächster Schritt:** Einen tatsächlich bereitgestellten Hintergrund-Auftragsdienst an die bestehende Site anbinden; bezahlte Stufen vor Aufruf dauerhaft reservieren und unsichere Stufen niemals automatisch erneut bezahlen. Danach mit simuliertem Anbieter in der echten Hosting-Laufzeit Verbindung für mehr als 30 Sekunden trennen, Browser neu laden und dasselbe vollständige Ergebnis ohne zweiten Anbieteraufruf nachweisen. Erst dann auf **1.2.1** erhöhen, erneut bauen/testen und auf derselben Site veröffentlichen. Die bisherigen grünen Node-Tests erfüllen dieses Freigabekriterium ausdrücklich nicht. PR bleibt Entwurf; kein Merge und keine Veröffentlichung einer nur teilweise behobenen Version.
