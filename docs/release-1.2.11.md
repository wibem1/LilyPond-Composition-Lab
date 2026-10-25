# V1.2.11 · 25.10.2026

## Umfang

Fehlerkorrektur-Update mit ausdrücklich verbleibender Hosting-Grenze. Die vollständige Entkopplung vom Browser ist nicht Bestandteil dieser Version und nicht als behoben zu behandeln.

- Keine voreilige Einstufung eines gültigen langen Providerstreams nach 90 Sekunden; Stale-Erkennung nach 11 Minuten.
- Kleine empfangene SSE-Reste werden auch während Anbieter-Stille gesichert. Abschlusskennung, Modell, UTF-8 und Kosten bleiben erhalten; DONE beendet den Leser ohne Warten auf ein offenes Transportende.
- Atomare persistente Reservierung derselben Streaming-Laufkennung über Serverinstanzen hinweg. Unsichere Aufträge werden nicht automatisch erneut bezahlt.
- Bedingte Statusänderungen schützen ein inzwischen gespeichertes Ergebnis vor veralteten Statusabfragen.
- Gesicherte Fragmente bleiben auch nach späteren Verarbeitungsfehlern verfügbar. Ein Fehler im Abschlussprotokoll verbirgt kein gespeichertes Ergebnis.
- Ungültige Statusdaten führen zu begrenzten Wiederherstellungsversuchen. Unbestätigte Aufträge behalten ihre Kennung.
- Sichtbarer Bedienhinweis: bei längeren Kompositionen geöffnet und verbunden bleiben.

## Nachgewiesene Prüfung

`npm run build`, `npm test` mit **27 Testprogrammen** und `npm run validate` auch nach Versionsanhebung erfolgreich. Produktionsdeploy erfolgreich; Hosting-Quellcommit `336f402a936b0e83d26567bac0ea5b1d7dfb9f96`, Deployment `appgdep_6ade0cb4de208191a8cb921a3458c08b`. Abschließender Prüfstatus steht in `PROJECT_STATE.md`.

Zusätzlich zu den vorhandenen Node-/DOM-/Fixture-Prüfungen läuft `tests/worker-runtime.mjs` in tatsächlichem workerd mit lokalem R2 (Miniflare 4.20260730.0). Nachgewiesen werden atomare Reservierung, bedingte Statusänderung, SSE-Kontrollstand bei Anbieter-Stille, Ergebnis nach kurzem Browserabbruch und genau eine Ausführung bei Wiederholung derselben Kennung. Der exakte Deployment-Bundle bedient Oberfläche sowie vorhandenen Verlauf und Arbeitsstand ohne Inhaltsänderung. Beim absichtlich abgebrochenen Leser kann workerd eine erwartete Broken-Pipe-Meldung ausgeben; alle Ergebnis- und Speicherassertionen müssen trotzdem bestehen.

Keine kostenpflichtigen KI-Anfragen. Provider und Renderer in den Integrationstests sind simuliert; Musikdateien sind vorhandene Fixtures. Keine neue Sicht-/Hörprüfung auf iPad oder Android. Nach Veröffentlichung bestanden: ausschließlich lesender Smoke-Test von Version, Browsermodulen und vorhandenem Arbeitsstand. Alle sieben geprüften Routen liefern HTTP 200; die Startseite zeigt V1.2.11. Antwort-Prüfsummen für Arbeitsstand, Verlauf, Schlüsselstatus und SoundFont-Einstellung sind vor und nach Veröffentlichung identisch. Der Test startete keine KI und änderte keine Nutzerdaten.

## Verbleibende Einschränkung

Ein HTTP-Worker kann nach Clientabbruch nur bis zu 30 Sekunden weiterlaufen. Bei längerer Unterbrechung kann die Ausführung verloren gehen. Ein gespeicherter Kontrollstand rettet empfangenen Text, aber keine unübertragenen Zeichen und keine vollständige Fortsetzung. Ein eigener dauerhafter Auftragsdienst bleibt erforderlich; die frühere Freigabesperre bezog sich auf die Zusage vollständiger Weiterverarbeitung. Dieses Update veröffentlicht die getesteten Teilkorrekturen mit offener Einschränkung.

Die synchrone Kompatibilitätsroute `/api/run` ist noch nicht über Isolates hinweg idempotent. Die normale Oberfläche benutzt `/api/run-stream` mit persistenter Reservierung.

## Daten und Veröffentlichung

Gleiche Site-Identität, Adresse, private Freigabe, R2-Bindung und Runtime-Secrets. Keine Migration, Löschung oder Neuverschlüsselung von Verlauf, Arbeitsstand, Schlüssel oder SoundFonts; MIDI-Kompatibilitätskennung bleibt gleich. GitHub-Ausgangsstand für dieses Update ist `513d29c2434e872afd46176702b995ab1fabbb59` einschließlich des parallel eingegangenen Korrekturstands.
