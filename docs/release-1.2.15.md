# V1.2.15 · 26.10.2026

Übernimmt die im [Codeprüfbericht](code-review-2026-10-26.md) dokumentierten Korrekturen auf ausdrücklichen Veröffentlichungsauftrag. Ausgangsstand: GitHub `df6d6f3d5fa449325525543bc259671f07209b78`, PR #3.

- Gemeinsame dauerhafte Auftragsreservierung für JSON- und Streaming-API; Doppelklicks werden vor asynchronem Speichern gesperrt.
- Eingaben und KI-Ereignispuffer während des Empfangs begrenzt; Sicherungen vor dem ersten Schreiben auf fehlerhafte Verweise, Schritte und Daten geprüft.
- Strengere MIDI-Prüfung; alte fehlerhafte LilyPond-Tonbytes bleiben ausschließlich für Oktavdiagnosen lesbar und werden nicht ungeprüft abgespielt.
- Alle Notenseiten bleiben im Verlauf und Arbeitsstand gespeichert, auch oberhalb von acht Seiten.
- SVG-Download-Sandbox, Stückwechselprüfung beim MIDI-Laden und konsistente semantische Compilerprüfung.

Der alte SoundFont-Ganzdatei-Endpunkt ist auf 8 MiB begrenzt. Große SoundFonts werden von der aktuellen Oberfläche weiterhin über den bestehenden Multipart-Weg übertragen; der 160-MiB-Test bleibt erhalten. MIDI-Kompatibilitätskennung, Datenformate und Speicherbindungen bleiben gleich. Keine Datenmigration, Schlüsseländerung oder Rücksetzung von Benutzerdaten.

Prüfung vor Veröffentlichung unter Versionskennung V1.2.15 tatsächlich bestanden: Build, alle 28 Testprogramme einschließlich echter lokaler workerd-/R2-Integration, Artefaktvalidierung und Diff-Prüfung. Die automatisierten Anbieter-/Compilerfehlerfälle verwenden Simulationen und vorhandene echte LilyPond-Fixtures. Keine kostenpflichtigen KI-Aufrufe und kein neuer Upload einer Komposition an externe Renderer.

Offen bleiben insbesondere lange Browserunterbrechungen, weitere Netzwerkzeitlimits, Entwicklungsabhängigkeitsmeldungen, Ressourcenbereinigung und die im Prüfbericht benannten Funktionsgrenzen. Eine neue interaktive Sicht-/Hörprüfung ist nicht automatisch durch diese Tests abgedeckt. Die lokale Browser-Vorschau ist in dieser Worker-Anwendung nicht verfügbar, weil kein dev-Skript und kein statisches Vorschauverzeichnis konfiguriert ist; dafür wird der echte lokale Worker durch die vorhandenen Integrationstests ausgeführt.


## Veröffentlichung und produktiver Lesetest

- Bestehende private Site am 26.10.2026 erfolgreich aktualisiert: https://lilypond-composition-lab.wibem1.chatgpt.site
- Hosting-Quellcommit `b063438e14f8e345d0b132863e76776861308e2c`; Deploy `appgdep_6adf036618d4819193511ebb1684a9f8`, Status `succeeded`, Runtime-Environment-Revision weiterhin 1.
- Startseite und Versionsmodul nach Deploy: HTTP 200, V1.2.15.
- Arbeitsstand, Verlauf, Schlüsselstatus und SoundFont-Einstellung: vor und nach Deploy HTTP 200 und identische SHA-256-Antwortprüfsummen. Dieser Test las ausschließlich Daten und löste keinen Compiler-/KI-Auftrag aus.
- Kein neuer angemeldeter Browser-Endtest und keine neue Hörprüfung; die dokumentierten offenen Punkte bleiben bestehen.
