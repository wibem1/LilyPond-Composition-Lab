# Projektstand – LilyPond Composition Lab
Stand: 26.10.2026 · V1.2.13 veröffentlicht; Codebereinigung separat geprüft

## Verbindliche Quellen

- Zentrale Regeln: https://github.com/wibem1/AI-Development-Standards/blob/main/DEVELOPMENT_STANDARDS.md
- Projektregeln: `AGENTS.md`; Bedienung und Architektur: `README.md`.
- Aktueller V1.2.13-Ausgangsstand: `eaa9c1daad37382a4bd88aa3ae066c8910fbfa79`, Branch `fix/compile-source-diagnostics-20261025`, PR #2. `main` enthält noch V1.2.11.
- Bestehende private Site: https://lilypond-composition-lab.wibem1.chatgpt.site

## Nachgewiesener veröffentlichter Stand

- V1.2.13: MusicXML-Export akzeptiert den isolierten internen LilyPond-Seitenaufteilungsfehler nur bei vollständiger exportierbarer Notenstruktur; andere Compilerfehler bleiben blockiert.
- Nutzer bestätigt Laden und Wiedergabe der alten Standuhr unter V1.2.12. Für V1.2.13 ist der produktive API-Export nachgewiesen: HTTP 200, zwei Systeme, 32 Takte, 293 klingende Noten; XML unabhängig geparst. Kein erneuter manueller Browser-Download oder MuseScore-Import nachgewiesen.
- Zuletzt veröffentlichter Hosting-Quellcommit: `5d217520ea132c4b38e21f4d738631e6ed4618a7`; Deploy `appgdep_6ade6b3bea008191832028d6eeb9ce4c` erfolgreich; Runtime-Environment-Revision 1.
- Arbeitsstand, Verlauf, Schlüsselstatus und SoundFont-Einstellung vor/nach Deployment mit identischen Antwortprüfsummen. Keine Datenmigration oder kostenpflichtige KI-Anfrage.

## Codebereinigung vom 26.10.2026

Separater Branch `refactor/cleanup-1.2.13`, weiterhin Versionskennung 1.2.13; keine neue Veröffentlichung.

- Doppelte Erkennung des internen Layoutfehlers in einer gemeinsamen Funktion zusammengeführt. Wiedergabe verlangt weiterhin SVG und MIDI; MusicXML verlangt weiterhin eine vollständige semantische Struktur.
- Wiederholte Umwandlung von MIDI-Bytebereichen für den gemeinsamen Parser vereinheitlicht. Keine Änderung des MIDI-Parsers oder der Kompatibilitätskennung.
- Erneute Analyse desselben Compilerprotokolls beim abschließenden Layoutcheck vermieden.
- Diese Projektstanddatei auf den aktuellen Stand gekürzt; die vollständige bisherige Dokumentation einschließlich aller historischen Nachweise bleibt in `docs/project-state-through-1.2.13.md` erhalten.
- Lokal erfolgreich: Build, alle 27 Testprogramme einschließlich Worker-/workerd-, UI-/Player- und MusicXML-Regressionen sowie Artefaktvalidierung. Renderer und Anbieter in den automatisierten Tests simuliert; kein neuer Live-Hacklily-Test, keine kostenpflichtigen KI-Aufrufe, keine produktiven Datenänderungen.
- Abhängigkeiten aus der vorhandenen V1.2.13-Arbeitskopie übernommen, nachdem der Offline-Installationscache unvollständig war; Lockdatei unverändert.

## Offene Grenzen und nächster Schritt

- Lange Browserunterbrechungen: HTTP-Worker kann nach 30 Sekunden Nachlauf beendet werden. R2 speichert Kontrollstände, führt Aufträge aber nicht weiter aus. Vollständige Entkopplung benötigt einen dauerhaften Auftragsdienst; auch die synchrone Route `/api/run` ist noch nicht über Isolates hinweg idempotent.
- Interaktive Endabnahme mit angemeldetem Browser sowie Hörprüfung bleiben offen. Automatisierte Prüfungen ersetzen sie nicht.
- Nächster einzelner Schritt: geprüfte Codebereinigung zur Übernahme bereitstellen; eine Veröffentlichung wurde in diesem Auftrag nicht vorgenommen.

Historie und Einzelbelege: [bisheriger Projektstand](docs/project-state-through-1.2.13.md), [Streaming-Untersuchung](docs/investigation-2026-10-25.md), [V1.2.11](docs/release-1.2.11.md).
