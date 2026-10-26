# Projektstand – LilyPond Composition Lab
Stand: 26.10.2026 · V1.2.15 veröffentlicht

## Verbindliche Quellen

- Zentrale Regeln: https://github.com/wibem1/AI-Development-Standards/blob/main/DEVELOPMENT_STANDARDS.md
- Projektregeln: `AGENTS.md`; Bedienung und Architektur: `README.md`.
- Aktueller V1.2.13-Ausgangsstand: `eaa9c1daad37382a4bd88aa3ae066c8910fbfa79`, Branch `fix/compile-source-diagnostics-20261025`, PR #2. `main` enthält noch V1.2.11.
- Bestehende private Site: https://lilypond-composition-lab.wibem1.chatgpt.site

## Nachgewiesener veröffentlichter Stand

- V1.2.13: MusicXML-Export akzeptiert den isolierten internen LilyPond-Seitenaufteilungsfehler nur bei vollständiger exportierbarer Notenstruktur; andere Compilerfehler bleiben blockiert.
- Nutzer bestätigt Laden und Wiedergabe der alten Standuhr unter V1.2.12. Für V1.2.13 ist der produktive API-Export nachgewiesen: HTTP 200, zwei Systeme, 32 Takte, 293 klingende Noten; XML unabhängig geparst. Kein erneuter manueller Browser-Download oder MuseScore-Import nachgewiesen.
- Zuletzt veröffentlichter Hosting-Quellcommit: `b063438e14f8e345d0b132863e76776861308e2c`; Deploy `appgdep_6adf036618d4819193511ebb1684a9f8` erfolgreich; Runtime-Environment-Revision 1.
- Arbeitsstand, Verlauf, Schlüsselstatus und SoundFont-Einstellung vor/nach Deployment mit identischen Antwortprüfsummen. Keine Datenmigration oder kostenpflichtige KI-Anfrage.

## Codebereinigung vom 26.10.2026

Separater Branch `refactor/cleanup-1.2.13`, Versionskennung auf ausdrücklichen Nutzerauftrag auf 1.2.14 angehoben; Build, alle 27 Testprogramme und Artefaktprüfung unter V1.2.14 bestanden.

- Doppelte Erkennung des internen Layoutfehlers in einer gemeinsamen Funktion zusammengeführt. Wiedergabe verlangt weiterhin SVG und MIDI; MusicXML verlangt weiterhin eine vollständige semantische Struktur.
- Wiederholte Umwandlung von MIDI-Bytebereichen für den gemeinsamen Parser vereinheitlicht. Keine Änderung des MIDI-Parsers oder der Kompatibilitätskennung.
- Erneute Analyse desselben Compilerprotokolls beim abschließenden Layoutcheck vermieden.
- Diese Projektstanddatei auf den aktuellen Stand gekürzt; die vollständige bisherige Dokumentation einschließlich aller historischen Nachweise bleibt in `docs/project-state-through-1.2.13.md` erhalten.
- Lokal erfolgreich: Build, alle 27 Testprogramme einschließlich Worker-/workerd-, UI-/Player- und MusicXML-Regressionen sowie Artefaktvalidierung. Renderer und Anbieter in den automatisierten Tests simuliert; kein abgeschlossener neuer Live-Hacklily-Test (automatische Sicherheitsprüfung blockierte die Übertragung der Testkomposition an den externen Renderer), keine kostenpflichtigen KI-Aufrufe, keine produktiven Datenänderungen.
- Abhängigkeiten aus der vorhandenen V1.2.13-Arbeitskopie übernommen, nachdem der Offline-Installationscache unvollständig war; Lockdatei unverändert.

## Offene Grenzen und nächster Schritt

- Lange Browserunterbrechungen: HTTP-Worker kann nach 30 Sekunden Nachlauf beendet werden. R2 speichert Kontrollstände, führt Aufträge aber nicht weiter aus. Vollständige Entkopplung benötigt einen dauerhaften Auftragsdienst; die synchrone Route `/api/run` verwendet ab V1.2.15 nun dieselbe dauerhafte Reservierung wie der Streamingweg.
- Interaktive Endabnahme mit angemeldetem Browser sowie Hörprüfung bleiben offen. Automatisierte Prüfungen ersetzen sie nicht.
- V1.2.14 veröffentlicht: Hosting-Quellcommit `722f727a6bcc3dec58682bff10456d19d5d20d00`, Deploy `appgdep_6adefc0c3f848191a7bbfb520bca9483`, Status `succeeded`, Runtime-Revision 1. Bestehender privater Zugriff und Speicherbindung unverändert. Kein neuer Browser-Endtest.
- Gesamtdurchsicht des eigenen Anwendungscodes am 26.10.2026 auf Ausgangscommit `711cffa812bfe34b9c0b94eed13a7d2bea0341c8` abgeschlossen; separater Zweig `audit/code-review-20261026`, mit V1.2.15 veröffentlicht.
- Implementiert: gemeinsamer Wiederholungsschutz beider Auftragswege, Doppelklicksperre vor asynchronem Speichern, begrenztes Einlesen, strengere MIDI-Prüfung mit erhaltener Oktavdiagnose, vollständige Seitenlisten, Sicherungsvalidierung, SVG-Sandbox und konsistente Strukturprüfung.
- Build, alle **28 Testprogramme**, Artefaktvalidierung und Diff-Prüfung erfolgreich. Einschließlich echter lokaler workerd-/R2-Tests, ohne kostenpflichtige KI oder neue externe Compileranfrage. Kein neuer Browser-Endtest.
- npm-Produktionsscan: null bekannte Meldungen; vollständiger Scan: vier betroffene Entwicklungs-Paketknoten (drei hoch/einer niedrig), noch offen. Weitere offene Befunde: dauerhafter Auftragsdienst, vollständige Body-/Verbindungszeitlimits, Titel-Zusatzkosten, Ressourcenbereinigung und Wartbarkeit.
- Einzelbefunde, Quellen und Prüfgrenzen: [vollständiger Codeprüfbericht](docs/code-review-2026-10-26.md).
- Ausdrücklicher Veröffentlichungsauftrag V1.2.15 am 26.10.2026. Ausgangscommit `df6d6f3d5fa449325525543bc259671f07209b78`, PR #3. Nur Versions-/Freigabedokumentation zusätzlich geändert; keine neuen Funktionsänderungen.
- Erneute Prüfung auf V1.2.15 bestanden: Build, alle 28 Testprogramme, Artefaktvalidierung und Diff-Prüfung.
- V1.2.15 erfolgreich bereitgestellt: Hosting-Quellcommit `b063438e14f8e345d0b132863e76776861308e2c`, Deploy `appgdep_6adf036618d4819193511ebb1684a9f8`, Runtime-Revision 1; gleicher privater Zugriff und gleiche Speicherbindung.
- Produktions-Smoke-Test nach Deploy bestanden: Startseite und `app-config.mjs` zeigen V1.2.15. Arbeitsstand, Verlauf, Schlüsselstatus und SoundFont-Einstellung liefern HTTP 200 mit identischen SHA-256-Prüfsummen vor/nach Deploy. Keine produktiven Daten geschrieben.
- Nächster einzelner Schritt: interaktive Nutzerabnahme; danach kontrolliertes Update der Entwicklungsabhängigkeiten. Entwicklungsabhängigkeitsmeldungen und die übrigen offenen Befunde bleiben bestehen.

Historie und Einzelbelege: [bisheriger Projektstand](docs/project-state-through-1.2.13.md), [Streaming-Untersuchung](docs/investigation-2026-10-25.md), [V1.2.11](docs/release-1.2.11.md).
