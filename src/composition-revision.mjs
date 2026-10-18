import {cleanGuidelines} from './composition-workflow.mjs';
// One request, one complete revised score. The existing task field is reused.
export function revisionMessages({mode,system='',code,instructions='',diagnostics=''}){
 const automatic=mode==='correct';
 const rule=automatic
  ?'Prüfe die gesamte vorhandene Komposition selbstständig auf technische und musikalische Schwächen und korrigiere sie nach deinem musikalischen Urteil. Prüfe insbesondere musikalischen Zusammenhang, tragende Idee, Stimmführung, Harmonik, Rhythmus, Ausdruck, Spielbarkeit, Taktlängen und Synchronität. Verbessere nur, wo es der Musik dient; ein überzeugender Abschnitt darf unverändert bleiben. Erhalte die tragende Idee, den Charakter, Titel und Besetzung. Ergänze bei einer abgebrochenen Komposition die fehlenden Stimmen und Takte aus dem Zusammenhang des ganzen Stücks.'
  :'Überarbeite die gesamte vorhandene Komposition gemäß dem Änderungswunsch. Verbesserungen, Ergänzungen, Fortsetzungen und gezielte Veränderungen sind möglich. Der Änderungswunsch ist für die Bearbeitung maßgeblich, einschließlich ausdrücklich verlangter unveränderter Stimmen oder Abschnitte. Erhalte die tragende Idee, den Charakter, Titel und Besetzung, soweit der Änderungswunsch nichts anderes verlangt. Ergänze bei einem Fragment die fehlenden Teile sinnvoll.';
 if(!automatic&&!String(instructions).trim())throw Error('Bitte den Änderungswunsch in das Feld „Kompositionsauftrag“ schreiben.');
 return [
  {role:'system',content:rule+' Keine unabhängige Neukomposition. Prüfe die vollständige überarbeitete Fassung intern vor der Ausgabe. Liefere ausschließlich das vollständige endgültige LilyPond-Dokument einschließlich score, layout und midi, ohne Analysebericht, Chat, Markdown oder Erläuterungen. Zusätzliche musikalische und technische Vorgaben:\n'+cleanGuidelines(system)},
  {role:'user',content:(automatic?'Selbstständige Korrektur der folgenden Komposition.':'Änderungswunsch:\n'+instructions)+(diagnostics?'\n\nTechnische Compilerhinweise:\n'+diagnostics:'')+'\n\nAktueller LilyPond-Notentext:\n'+code}
 ];
}
