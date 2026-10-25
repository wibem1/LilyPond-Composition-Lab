# Abbruch langer Kompositionen – Untersuchung vom 25.10.2026

Historischer Befund vor dem begrenzten Update V1.2.11. Aktuelle Veröffentlichung, Testergebnisse und weiterhin offene Hosting-Grenze: [V1.2.11](release-1.2.11.md) und [Projektstand](../PROJECT_STATE.md).

## Status
Korrekturkandidat auf `fix/run-stale-timeout-20261025`; **kein Release 1.2.1**. Die vorhandene Version 1.2.0 wurde nicht verändert. Die notwendige browserunabhängige Auftragsausführung ist in der aktuellen Hosting-Konfiguration nicht eingerichtet und über die verfügbaren Verwaltungswerkzeuge nicht provisionierbar.

## Belege

Originaldatei: `Diagnose-80f91019ea8f486b992680af0b48049e.json`, Lauf `80f91019ea8f486b992680af0b48049e`, Gemini mit hohem Denkaufwand. Datum 25.10.2026, Zeiten hier UTC (Berlin: +1 Stunde).

| Zeitpunkt | Beobachtung |
| --- | --- |
| 12:32:21.916 | Lauf gestartet |
| 12:32:23.829 | bezahlte Kompositionsanfrage protokolliert |
| 12:34:38.207 | Server protokolliert getrennten Browser-Stream |
| 12:34:38.278 | Browser meldet `Load failed`, online=true |
| 12:35:08.207 | Produktionslog der Anfrage: `outcome: canceled`, `wallTimeMs: 166358`, Ray `a5013e583b550ed3` |
| 12:36:33.404 | v1.2.0 erklärt den Auftrag nach 90 Sekunden ohne Aktualisierung für unterbrochen |

Der Serverabbruch folgt dem protokollierten Browserabbruch genau 30 Sekunden später. Cloudflare dokumentiert diese Grenze für HTTP-`waitUntil()` nach Verbindungsabbruch. Der vorhandene Code registriert den gesamten Kompositionsablauf als solches Promise. **Damit ist der Verlust der Serververarbeitung durch die Hosting-Lebensdauer stark belegt.** Nicht nachgewiesen ist, warum die erste Browserverbindung abriss (Safari, Netzwerk, Proxy oder anderer Transportfehler). Ein generelles 136-Sekunden-Timeout oder ein Gemini-Fehler wird daraus nicht behauptet.

Offizielle Referenzen, am 25.10.2026 gelesen:
- https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#conditional-operations

Die 11-Minuten-Korrektur verhindert eine verfrühte Statusentscheidung. Sie verleiht der Ausführung keine weitere Lebensdauer. Heartbeats helfen nur, während die ursprüngliche Verbindung besteht. Neue Statusabfragen hängen die bezahlte Ausführung nicht an eine neue HTTP-Anfrage an. Auch eine einzelne, im Arbeitsspeicher gehaltene Map schützt nicht vor parallelen Aufrufen über verschiedene Isolates.

## Geprüfte Korrekturen

`src/run-storage.mjs` implementiert R2-Reservierungen mit `If-None-Match: *` und bedingte Statusupdates mit ETag. Ein Reservierungsfehler stoppt vor Ausführung; eine bereits vorhandene Reservierung wird niemals automatisch gelöscht oder übernommen. Die Sicherung betrifft den von der Oberfläche verwendeten `/api/run-stream`-Endpunkt. Der ältere direkte `/api/run`-Endpunkt ist damit noch nicht gegen doppelte direkte Aufrufe abgesichert und muss vor einer umfassenden Freigabe in dieselbe Auftragssteuerung einbezogen werden.

`src/run-session.mjs` respektiert diese Reservierung, schützt Abschlussdaten vor veralteten Statusschreibvorgängen und stellt bei nachfolgenden Verarbeitungsfehlern vorhandene Teilantworten wieder her. Abschlussprotokoll und Ergebnissicherung sind getrennt: Ein Diagnosefehler versteckt kein erfolgreich gesichertes Resultat; ein fehlgeschlagener Ergebnisschreibvorgang wird nicht als Erfolg gemeldet.

`src/provider-stream.mjs` beendet auf SSE-DONE, serialisiert Kontrollstands-Schreibvorgänge und sichert kleine neue Textteile über einen unabhängigen Timer auch ohne nachfolgendes Anbieterereignis. Transportfehler und Empfangszeitlimit behalten den letzten Text. Anbieter-Generation-ID wird im Kontrollstand mitgeführt. Das ist keine Zusage, dass die Anbieter-API darüber verlorenen Text erneut liefern kann.

`src/run-client.mjs` behält bei unbestätigter Annahme die ursprüngliche Kennung. Ein erneuter Klick versucht dann Wiederherstellung desselben Auftrags und startet keinen neuen bezahlten Auftrag. Bei dauerhaft unbekannter Kennung gibt es derzeit keinen gesonderten sichtbaren Freigabeschritt; diese konservative Sperre muss vor Freigabe mit der endgültigen Auftragsannahme abgestimmt werden.

Kein Datenformat der bestehenden Historie, SoundFonts, Schlüssel oder Workspace-Daten wurde migriert. Produktionsdaten wurden nicht verändert. Die Auftragsreservierungen sind additive neue Objekte.

## Tatsächlich ausgeführte Prüfungen

| Befehl | Ergebnis |
| --- | --- |
| `npm ci` | erfolgreich, 5 Pakete installiert |
| `npm run build` | erfolgreich |
| `npm test` | alle 26 Programme erfolgreich |
| `npm run validate` | gültiges ESM, `default.fetch` vorhanden |
| `git diff --check` | erfolgreich |

Erste Bestandsprüfung: fehlgeschlagen, weil der bisherige Branch zwar den neuen 11-Minuten-Test ergänzt hatte, aber drei bestehende Tests nach 100 Sekunden weiterhin `interrupted`/wiederhergestelltes Fragment erwarteten. Diese drei Fälle prüfen jetzt einen wirklich veralteten Stand (>11 Minuten); der 95-Sekunden-Fall bleibt separat als `running` geprüft.

Neue und erweiterte Tests:
- `tests/run-storage.mjs`: zwei getrennt importierte Servermodule mit getrennter Map und gemeinsamem simuliertem Speicher; genau eine Ausführung bei konkurrierenden Starts. Prozessneustart ohne Statusdatei, Speicherfehler vor Start, veraltete Statusabfrage gegen finales Ergebnis und verwaiste Reservierung. Teilantwort nach Verarbeitungsausfall, Diagnoseausfall nach Ergebnissicherung und fehlgeschlagene finale Sicherung.
- `tests/provider-stream.mjs`: byteweise UTF-8/CRLF, Anbieterfehler, abgeschnittener Stream, Kosten und Syntaxprüfungen; zusätzlich DONE bei offenem Transport, Generation-ID, kleines Fragment vor anschließender Anbieter-Stille, Empfangszeitlimit und finale Sicherung.
- `tests/run-recovery.mjs`: Browser-Fetchfehler, abgeschnittener Antwortstrom, Neuladen, gleiche Kennung, bestätigter Terminalfehler und unbestätigte Auftragsannahme ohne automatisches neues Bezahlen.
- Bestehende Worker-Integration: Fragment-/Fortsetzungsablauf, unverändertes Original, Status/History/Workspace, Modelle, Kosten, zweistufige Komposition, Überarbeiten/Korrigieren, Backup, Player, SoundFonts und Export weiterhin erfolgreich.

Wichtige Prüfgrenze: Alle Provider-/Renderer-Netzwerkantworten und R2 im Test werden simuliert. Tests mit der Formulierung „real LilyPond/Gemini“ lesen früher erzeugte Fixtures. Hier wurde kein lokaler LilyPond-Compiler und kein kostenpflichtiges Modell aufgerufen. Der Player berechnet Audio mit der installierten Bibliothek; die Oberfläche läuft im vorhandenen DOM-Testmodell. Es gab keinen echten Safari-/Android-Sichttest, keinen Lauf in Cloudflares Worker-Runtime und keinen erfolgreichen Hosting-Test mit mehr als 30 Sekunden Netzunterbrechung. Ein normal weiterlaufendes Node-Promise nach `reader.cancel()` prüft diese Cloudflare-Grenze ausdrücklich nicht.

## Freigabekriterium

1. Browserunabhängigen, bereitgestellten Auftragsdienst anbinden, mit dauerhaftem Stufenstatus und keiner automatischen Wiederholung eines möglicherweise schon bezahlten Aufrufs.
2. Direkte und gestreamte Komposition über dieselbe idempotente Auftragssteuerung führen.
3. Echte Hosting-Laufzeit mit simuliertem Anbieter prüfen: kurze und >30 Sekunden dauernde Trennung, geschlossenes Browserfenster, Neuladen, doppelte Starts, Fehler während der Speicherung; vollständiges Ergebnis und genau ein bezahlbarer Anbieteraufruf nachweisen.
4. Dann Versionsnummer 1.2.1 setzen, komplette Prüfungen wiederholen, GitHub sichern und dieselbe private Site mit unveränderten Datenbindungen aktualisieren.

Die vorhandenen Sites-Rechte erlauben grundsätzlich eine Veröffentlichung. **Der Blocker ist die fehlende Hintergrund-Auftragsinfrastruktur und ihr ausstehender Integrationstest, nicht eine fehlende Freigabe des Benutzers.** Es wurde kein ungeprüftes Artefakt veröffentlicht und kein alternativer Hosting-Anbieter eingerichtet.

## Zusammenführung des parallel eingetroffenen Standes

Commit `144d4c938f4c90f4eacf3cae988e67d1e0fc671b` war während dieser Bearbeitung auf demselben Branch eingetroffen. Seine atomare Reservierung wird als gemeinsame Hilfsfunktion weiterverwendet. Die zusätzlichen Tests für hartes Ende eines Node-Worker-Threads und ungültige Wiederherstellungsantworten wurden übernommen, ebenso die ursprüngliche Incident-Dokumentation. Statusvalidierung und konservative Beibehaltung unbestätigter Kennungen sind kombiniert; ETag-Schutz, DONE-Behandlung und Fehlersicherung bleiben erhalten. Der abschließende gemeinsame Lauf umfasst **26 Testprogramme** und ersetzt die vor der Zusammenführung getrennt ermittelten Zählungen von 24 bzw. 25.
