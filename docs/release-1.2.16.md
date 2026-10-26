# V1.2.16 · SoundFont-Wiederherstellung · 26.10.2026

Korrigiert die Fehlermeldung `Can only call Window.fetch on instances of Window` beim Vorladen auf Safari/iPad. Der Standard-Fetcher des SoundFont-Caches ruft die Browserfunktion jetzt mit ihrem richtigen globalen Empfänger auf.

Der zuletzt erfolgreich gespeicherte SoundFont bleibt mit Name und Datei im vorhandenen Serverspeicher erhalten. Nach erneutem Öffnen verwendet die App diese Auswahl und lädt beim Abspielen denselben Klang. Ein lokaler Cache beschleunigt das Laden; nach Leerung wird derselbe gespeicherte Font erneut vom Server geladen. Nur eine ausdrückliche Auswahl eines anderen Fonts oder des Standard-SoundFonts ersetzt ihn. Scheitert das Speichern eines neu geladenen Fonts, bleibt die vorhandene Fehlermeldung „geladen, aber nicht gespeichert“ maßgeblich; eine gescheiterte Speicherung wird nicht als dauerhaft zugesagt.

Nachweis: Neuer Empfänger-Test scheiterte mit derselben TypeError-Meldung vor der Korrektur und besteht danach. Cache-Wiederherstellung mit und ohne gespeicherte lokale Bytes geprüft; die tatsächlichen App-Handler werden zweimal mit derselben gespeicherten Fontauswahl gestartet und laden genau diese Bank für die Wiedergabe. Bestehende Upload-/Persistenz- und Player-Tests bleiben erhalten.

Vor Veröffentlichung auf V1.2.16 tatsächlich bestanden: Build, alle 28 Testprogramme, Artefaktvalidierung und Diff-Prüfung. Anbieter-/Rendererfälle simuliert bzw. vorhandene Fixtures; keine kostenpflichtige Komposition, keine neuen externen Compileraufrufe. Kein echter iPad-/Safari-Hörtest. Die bekannten Grenzen des Codeprüfberichts bleiben bestehen.


Veröffentlicht in der bestehenden privaten Site: https://lilypond-composition-lab.wibem1.chatgpt.site. Hosting-Quellcommit `2a62345c13251cb08a0635c17e6e4334046e8680`; Deploy `appgdep_6adf0595337881918fe427d50e3adfcf`, Status `succeeded`, Runtime-Revision 1. Produktive Startseite und Versionsmodul auf V1.2.16 geprüft. Gespeicherter Arbeitsstand, Verlauf, Schlüsselstatus und SoundFont-Auswahl liefern vor/nach Deployment HTTP 200 und identische SHA-256-Antwortprüfsummen. Kein neuer iPad-Hörtest.
