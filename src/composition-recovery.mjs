// Recovery appends bytes. Existing music is never regenerated or repaired here.
export function lilySource(answer){return String(answer||'').replace(/^\s*```(?:lilypond|ly)?\s*\n/i,'').replace(/\n```\s*$/,'');}
export function sourceStatus(source,finish='stop'){
 const s=String(source||'');let masked='',quoted=false,line=false,block=0,escape=false;const stack=[];let invalid=false;
 for(let i=0;i<s.length;i++){
  const c=s[i],next=s[i+1];
  if(line){if(c==='\n')line=false;masked+=' ';continue;}
  if(block){if(c==='%'&&next==='{'){block++;i++;}else if(c==='%'&&next==='}'){block--;i++;}masked+=' ';continue;}
  if(quoted){if(c==='"'&&!escape)quoted=false;escape=c==='\\'&&!escape;masked+=' ';continue;}
  if(c==='%'){if(next==='{'){block++;i++;}else line=true;masked+=' ';continue;}
  if(c==='"'){quoted=true;escape=false;masked+=' ';continue;}
  masked+=c;
  if(c==='{')stack.push('}');else if(c==='<'&&next==='<'){stack.push('>>');masked+=next;i++;}
  else if(c==='}'){if(stack.pop()!=='}')invalid=true;}
  else if(c==='>'&&next==='>'){if(stack.pop()!=='>>')invalid=true;masked+=next;i++;}
 }
 const reason=!s.trim()?'Kein Notentext empfangen':finish==='length'?'KI-Ausgabe am Tokenlimit abgeschnitten':finish!=='stop'?'KI-Ausgabe nicht regulär abgeschlossen ('+(finish||'unbekannt')+')':quoted||block||stack.length?'Notentext ist abgeschnitten (offene Struktur)':invalid?'Ungültige Dokumentstruktur':!/\\score\s*\{/.test(masked)?'\\score-Block fehlt':'';
 return {complete:!reason,reason,canContinue:!!s.trim()&&!invalid,openStructures:stack.length};
}
export function continuationMessages(original,task){return [
 {role:'system',content:'Vervollständige die abgebrochene LilyPond-Komposition. Der vorhandene Text ist unveränderlich. Antworte ausschließlich mit den fehlenden Zeichen und Noten, die DIREKT an das Ende des Fragments angehängt werden. Wiederhole keine vorhandenen Noten, Definitionen, Header oder Version. Beginne genau an der Abbruchstelle, gegebenenfalls mitten in einem Token. Ergänze alle fehlenden Stimmen und Takte passend zum vollständigen Verlauf. Schließe offene Bögen und Strukturen sinnvoll. Erhalte Besetzung, Taktzahl, Tempo, Tonart und musikalische Idee. Das Ergebnis muss einen vollständigen score-Block mit layout und midi haben. Keine Markdown-Zäune, keine Erklärungen. Fehlende Musik wird neu rekonstruiert und ist kein wiedergefundenes Original.'},
 {role:'user',content:'Ursprünglicher Auftrag:\n'+String(task||'')+'\n\nUnveränderliches Fragment (Ende exakt an der Abbruchstelle):\n'+original}
 ];}
export function appendContinuation(original,answer){
 const suffix=lilySource(answer);
 if(!suffix.trim())throw Error('Keine Fortsetzung empfangen. Original erhalten.');
 if(original.length+suffix.length>250000)throw Error('Die vollständige Fassung überschreitet die Dokumentgrenze. Ergänzung im Protokoll gesichert; Original erhalten.');
 if(/\\(?:version|header)\b/.test(suffix)||suffix.includes(original.trim())||original.length>150&&suffix.includes(original.slice(-150).trim()))throw Error('Die KI hat vorhandenen Text wiederholt. Fortsetzung verworfen; Original erhalten.');
 for(const m of original.matchAll(/\b([A-Za-z][A-Za-z0-9]*)\s*=\s*(?:\\absolute|\\relative|\\fixed|\{)/g)){
  if(new RegExp('\\b'+m[1]+'\\s*=').test(suffix))throw Error('Die KI hat eine vorhandene Stimme neu definiert. Original erhalten.');
 }
 return original+suffix;
}
