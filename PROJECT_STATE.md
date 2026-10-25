# Projektstand – LilyPond-Composition-Lab

Stand: 25.10.2026 · **v1.2.1 nicht veröffentlicht – technischer Blocker belegt**

## Ziel, Regeln und Quellstand

Private LilyPond-WebApp für Komposition, Partitur, Player, Verlauf und Export. Verbindlich: [zentrale Entwicklungsstandards](https://github.com/wibem1/AI-Development-Standards/blob/main/DEVELOPMENT_STANDARDS.md) und `AGENTS.md`.

- Produktion: V1.2.0, bisherige Adresse https://lilypond-composition-lab.wibem1.chatgpt.site
- GitHub `main` bei Übernahme: `6090f87e82011d6a0b0946445c9d920f2bf82132`.
- Übernommener Korrekturstand: `18635f60021979681a2cb1fa1b4741fefe559285` auf `fix/run-stale-timeout-20261025`, [PR #1](https://github.com/wibem1/LilyPond-Composition-Lab/pull/1).
- Die nachstehenden Korrekturen und Prüfnachweise werden gemeinsam auf diesem Branch gesichert. PR bleibt Entwurf; keine Freigabe aus lokalen Simulationen ableiten.

## Nachgewiesener Fehler und verbleibender Blocker

Die Nutzerdiagnose zum Lauf `80f91019ea8f486b992680af0b48049e` und das tatsächliche Hosting-Protokoll wurden gelesen. Der Browserstream endete mit `Load failed`; der HTTP-Worker wurde mit Outcome `canceled` nach 166358 ms protokolliert, genau 30 Sekunden nach dem serverseitigen Browserabbruch. `ctx.waitUntil()` schützt auf diesem Hosting nur bis zu 30 Sekunden nach Clientabbruch. Die Ursache des ersten Transportabbruchs bleibt ungeklärt; der fehlende dauerhafte Ausführungsweg ist im Code belegt.

Die 11-Minuten-Frist verhindert einen voreiligen Statuswechsel, hält aber keinen Serverauftrag am Leben. R2 speichert Daten, führt keine Komposition weiter aus. Die verfügbaren Sites-Werkzeuge provisionieren keine Queue-/Workflow-/Durable-Object-Ressource. Ohne solchen verbundenen Auftragsdienst ist die geforderte vollständige Ausführung nach Browserabbruch nicht gewährleistet.

## Implementiert und mit Simulation geprüft

- Vorherige Timeoutkorrektur übernommen; veraltete Stale-Fixtures angepasst.
- Geordnete periodische Sicherung kleiner SSE-Textreste auch während Anbieter-Stille.
- Persistente bedingte Reservierung einer Laufkennung vor `/api/run-stream`; Schutz gegen Doppelstart in getrennten Isolates und bei Speicherfehlern. Noch keine dauerhafte Ausführung; synchrone Kompatibilitätsroute `/api/run` benötigt bei der nächsten Integration denselben Auftragsdienst.
- Ungültige Wiederherstellungsantworten pausieren nach 20 Versuchen und behalten die Laufkennung.
- Erzwungenes Ende eines echten Node-Worker-Threads geprüft: gespeichertes Fragment wiederherstellbar, kein automatischer Provider-Neustart; vollständige Fertigstellung bleibt **nicht nachgewiesen**.

## Testergebnisse

- `npm ci`, `npm run build`: erfolgreich.
- Abschließender Gesamtlauf `npm test`: **25 Testprogramme erfolgreich**.
- `npm run validate`: erfolgreich; Build-Artefakt ist gültiges ESM mit `default.fetch`.
- Keine kostenpflichtigen KI-Anfragen. Die Tests nutzen gespeicherte Fixtures, simulierte Anbieter/Renderer, simuliertes R2 und ein DOM-Modell. Historische Fixture-Bezeichnungen in PASS-Ausgaben sind keine neuen Live-Provider-Tests.
- Neue Korrekturen nicht auf dem produktiven Hosting getestet; keine neue reale Browser-/Audioabnahme.
- Anfangsläufe fanden drei veraltete Timeout-Fixtures sowie R2-Mocks ohne Rückgabeobjekt. Diese wurden angepasst; der abschließende Lauf ist maßgeblich.

## Freigabe und nächster einzelner Schritt

**Keine Veröffentlichung, kein Merge, keine Versionsanhebung:** Die Freigabevoraussetzung „laufender Auftrag überlebt Browserabbruch“ ist nicht erfüllt. Produktive Daten und Site-Konfiguration bleiben unverändert.

Nächster Schritt: einen browserunabhängigen Auftragsdienst im Hosting provisionieren bzw. einen geeigneten Verwaltungszugang bereitstellen, dann als serverseitige Ausführung hinter dieselbe Site anbinden. Danach echte Hosting-Integration mit simuliertem Provider, Browserabbruch über 30 Sekunden, Wiederherstellung über neue Runtime, Doppelanfragen und unklarem Providerstart testen. Erst bei bestandenen Prüfungen V1.2.1 setzen und auf derselben Adresse veröffentlichen.

Ausführlicher Befund, Zeitpunkte, Quellen, Prüfumfang und Integrationsanforderungen: [incident-2026-10-25.md](docs/incident-2026-10-25.md).
