# Projektstand – LilyPond-Composition-Lab
Stand: 23.10.2026 · Dokumentationsmigration, **kein neuer Funktionstest**

## Zweck und Quellen
LilyPond-WebApp für Komposition, Partitur und Wiedergabe; README nennt v1.2.0 (18.10.2026). Aktuelle praktische Funktionsfähigkeit nicht neu geprüft.

Grundlage: `README.md` auf dem Standardbranch und vorherige Entwicklungsangaben. Aussagen zu Builds, Versionen und Funktionen sind **dokumentiert**, nicht durch diese Migration unabhängig geprüft.

## Verbindlicher globaler Standard
https://github.com/wibem1/AI-Development-Standards/blob/main/DEVELOPMENT_STANDARDS.md

## Prüfstatus und nächste Aufgabe
- Letzten Quellcommit, relevante Branches, Issues und Testartefakte vor jeder neuen Entwicklung ermitteln.
- Implementiert ≠ getestet ≠ in der Zielanwendung nachgewiesen; nie stillschweigend einen Freigabestatus annehmen.
- **Nächster Schritt:** zunächst nur Bestandsaufnahme der neuesten nachprüfbaren technischen Ergebnisse und Auswahl **eines** kleinen Tests. Keine automatische neue Version oder GitHub-Actions-Schleife.
- Nach einem abgeschlossenen Entwicklungsschritt diese Datei mit **konkreten Testnachweisen**, Blockern und der nächsten Einzelaufgabe aktualisieren.

## 25.10.2026 – Diagnose zu abgebrochenem Gemini-Auftrag
- Nutzerdiagnose v1.2.0, Lauf 80f91019ea8f486b992680af0b48049e: Browser-Stream brach ab (Load failed), die Statusabfrage stufte den Auftrag bereits nach 90 Sekunden ohne Aktualisierung als unterbrochen ein. Server-Ursache nicht nachgewiesen.
- Isolierter **Korrekturkandidat** auf Branch `fix/run-stale-timeout-20261025`: Kennzeichnung als verwaist erst nach 11 Minuten ohne Server-Aktualisierung, also nach dem 10-Minuten-Limit des Provider-Streams. Damit wird ein möglicherweise noch laufender bezahlter Aufruf nicht voreilig als endgültig unterbrochen eingestuft.
- Neuer Regressionstest `tests/run-stale-timeout.mjs` prüft 95 Sekunden und >11 Minuten mit simuliertem Speicher. **Ausgeführt**: direkte Ausführung der exportierten Zustandsfunktion aus dem GitHub-Quelltext in einer isolierten JavaScript-Laufzeit mit simuliertem Speicher (95 Sekunden bleibt running, 670 Sekunden wird interrupted); kein vollständiger Node-Testlauf, kein echter Hosting-/Browser-/Provider-Test. Weiterhin offene Frage: Warum brach die Browser- oder Server-Verbindung ab? Durch das Zeitlimit allein nicht behoben.
- **Nächster Einzelschritt:** Regressionstest lokal ausführen und anschließend gezielt Server-Streaming/Hosting-Laufzeit prüfen; erst bei nachgewiesener Fehlerbehebung Integration und Release.
