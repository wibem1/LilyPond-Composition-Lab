const VERSION="0.1.15";
import {PAGE,ASSETS} from "./generated.js";
import {checkInstrumentRanges} from '../src/instrument-ranges.mjs';
import {checkInstrumentRegisters} from '../src/instrument-registers.mjs';
import {applyOctaveEdits,octaveTokens,relativeOctavePlan} from '../src/octave-repair.mjs';
import {initialInstrumentNames} from '../src/notation-layout.mjs';
const randomUUID=()=>crypto.randomUUID();
const parseMidi=(()=>{
const tag=(v,p)=>String.fromCharCode(...new Uint8Array(v.buffer,v.byteOffset+p,4));
function be16(v,p){return v.getUint16(p)} function be32(v,p){return v.getUint32(p)}
function varint(v,p){let value=0;for(let n=0;n<4;n++){if(p>=v.byteLength)throw Error('MIDI-Datei vorzeitig beendet');const b=v.getUint8(p++);value=(value<<7)|(b&127);if(!(b&128))return [value,p]}throw Error('Defekte MIDI-Zeitangabe')}
function parseMidi(buffer){
  const v=new DataView(buffer);if(tag(v,0)!=='MThd')throw Error('Keine Standard-MIDI-Datei.');
  const fmt=be16(v,8),tracks=be16(v,10),ppq=be16(v,12);if(fmt>1||!ppq||ppq>=32768)throw Error('Dieses MIDI-Zeitformat wird nicht unterstützt.');
  let p=8+be32(v,4),events=[],lastTick=0;
  for(let t=0;t<tracks;t++){if(tag(v,p)!=='MTrk')throw Error('Ungültige MIDI-Spur');const end=p+8+be32(v,p+4);p+=8;let tick=0,running=0;
    while(p<end){let delta;[delta,p]=varint(v,p);tick+=delta;let status=v.getUint8(p);if(status<0x80){if(!running)throw Error('Ungültiger MIDI-Running-Status');status=running}else{p++;if(status<0xf0)running=status}
      if(status===0xff){const meta=v.getUint8(p++);let len;[len,p]=varint(v,p);if(meta===0x51&&len===3){events.push({tick,type:'tempo',value:(v.getUint8(p)<<16)|(v.getUint8(p+1)<<8)|v.getUint8(p+2)})}p+=len;continue}
      if(status===0xf0||status===0xf7){let len;[len,p]=varint(v,p);p+=len;continue}
      const command=status&0xf0,ch=status&15,one=[0xc0,0xd0].includes(command),d1=v.getUint8(p++),d2=one?0:v.getUint8(p++);
      if(command===0x90)events.push({tick,type:d2?'on':'off',ch,key:d1,vel:d2});
      else if(command===0x80)events.push({tick,type:'off',ch,key:d1,vel:d2});
      else if(command===0xc0)events.push({tick,type:'program',ch,value:d1});
      else if(command===0xb0)events.push({tick,type:'control',ch,cc:d1,value:d2});
    }p=end;lastTick=Math.max(lastTick,tick)
  }
  // Sorting off before on at an identical tick prevents overlapping repeated notes.
  const order={tempo:0,program:1,control:2,off:3,on:4};events.sort((a,b)=>a.tick-b.tick||order[a.type]-order[b.type]);
  let secs=0,last=0,micro=500000;for(const e of events){secs+=(e.tick-last)*micro/1e6/ppq;e.sec=secs;last=e.tick;if(e.type==='tempo')micro=e.value}
  const duration=secs+(lastTick-last)*micro/1e6/ppq;
  const channelInfo=Array.from({length:16},(_,ch)=>({ch,program:0,notes:0,volume:100,expression:127,pan:64}));
  for(const e of events){const c=channelInfo[e.ch];if(!c)continue;if(e.type==='program')c.program=e.value;else if(e.type==='on')c.notes++;else if(e.type==='control'){if(e.cc===7)c.volume=e.value;if(e.cc===10)c.pan=e.value;if(e.cc===11)c.expression=e.value}}
  return {events,duration:Math.max(secs,duration),ppq,channels:channelInfo.filter(x=>x.notes>0)};
}

return parseMidi;})();
const originalTask='Komponiere ein ruhiges, chromatisches Klavierstück in d-Moll mit 8 Takten.';
const ORIGINAL_SYSTEM=`Komponiere nach dem Auftrag direkt ein vollständiges LilyPond-Dokument. Entwickle musikalisch eigenständiges Material, passende Stimmenführung, Phrasierung und einen nachvollziehbaren Spannungsbogen. Beachte die gewünschte Besetzung und Länge. Verwende einen Titel im Header, Tempo, layout und midi im score-Block sowie passende midiInstrument-Angaben. Antworte ausschließlich mit LilyPond-Code ohne Markdown und Erläuterungen. Es gibt keinen vorgeschalteten Entwurf.`;
const TECHNICAL_SYSTEM=`Komponiere nach dem Auftrag direkt ein vollständiges LilyPond-Dokument. Entwickle musikalisch eigenständiges Material, passende Stimmenführung, Phrasierung und einen nachvollziehbaren Spannungsbogen. Beachte die gewünschte Besetzung und Länge. Verwende einen Titel im Header, Tempo, layout und midi im score-Block sowie passende midiInstrument-Angaben. Antworte ausschließlich mit LilyPond-Code ohne Markdown und Erläuterungen. Es gibt keinen vorgeschalteten Entwurf. Technische Notation: Verwende absolute Tonhöhen mit ausdrücklich angegebenen Oktaven (ohne \\relative). Prüfe die tatsächlichen Oktavlagen; Verwende für jedes Instrument dessen spielbaren klingenden Tonumfang; für Klavier A0 bis C8. Diese Notationsregel macht keine Vorgaben zur musikalischen Gestaltung.`;
const DEFAULT_SYSTEM=ORIGINAL_SYSTEM;
// Besetzung wird aus dem ORIGINALAUFTRAG abgeleitet, niemals aus der KI-Realisierung.
const ENSEMBLE_PATTERNS=[
  {id:'violin',regex:/\b(?:violine|geige|violin)\b/i,label:'Violine',hint:'Violine: separates Staff mit midiInstrument = "violin"'},
  {id:'cello',regex:/\b(?:violoncello|cello)\b/i,label:'Violoncello',hint:'Violoncello: separates Staff mit midiInstrument = "cello"'},
  {id:'flute',regex:/\b(?:flöte|floete|querflöte|querfloete|flute)\b/i,label:'Flöte',hint:'Flöte: separates Staff mit midiInstrument = "flute"'},
  {id:'piano',regex:/\b(?:klavier|piano|flügel|fluegel)\b/i,label:'Klavier',hint:'Klavier: PianoStaff mit je einem Staff für rechte und linke Hand'}
];
function requestedEnsemble(task,draft=''){
  // The task controls instrumentation; only fall back to a draft for imported pieces.
  const source=String(task||'').trim()||String(draft||'');
  return ENSEMBLE_PATTERNS.filter(x=>x.regex.test(source));
}
const clean=v=>String(v??'').slice(0,250000);
const safe=v=>String(v).replace(/[^A-Za-z0-9_-]/g,'').slice(0,60)||'lauf';
function compositionFilename(v){
  const title=String(v||'').normalize('NFC').trim().replace(/[\/\\\x00-\x1f\x7f<>:\"|?*]+/g,' ').replace(/\s+/g,' ').replace(/^\.+|\.+$/g,'').trim().slice(0,100);
  return title||'Unbenannte_Komposition';
}
const historyId=v=>/^[a-f0-9]{16,40}$/.test(String(v||''))?v:null;
function historyPublic(v){
  return {id:v.id,title:v.title||'Unbenannte Komposition',createdAt:v.createdAt,updatedAt:v.updatedAt,hasMidi:!!v.midiUrl,
    compositionModel:v.compositionModel||'',realisationModel:v.realisationModel||'',format:v.format||'',
    hasDraft:!!v.draft,hasRealisation:!!v.techout};
}
async function upstream(url,init,timeout=185000){const ac=new AbortController();const t=setTimeout(()=>ac.abort(),timeout);try{return await fetch(url,{...init,signal:ac.signal});}finally{clearTimeout(t);}}
function contentType(file){if(file.endsWith('.svg'))return 'image/svg+xml';if(file.endsWith('.mid'))return 'audio/midi';if(file.endsWith('.abc')||file.endsWith('.ly')||file.endsWith('.csv')||file.endsWith('.txt'))return 'text/plain; charset=utf-8';return 'application/octet-stream';}

function ensureMidiDirective(text){
  const source=String(text).trim();if(!/\\score\s*\{/.test(source))throw Error('LilyPond-Ausgabe enthält keinen \\score-Block.');
  let out=source,needle=/\\score\s*\{/g,offset=0,found=false,added=0,m;
  while((m=needle.exec(out))){const open=out.indexOf('{',m.index),stack=['}'];let pos=open+1,quoted=false,comment=false;
    for(;pos<out.length;pos++){
      const c=out[pos];if(comment){if(c==='\n')comment=false;continue}if(c==='%'&&!quoted){comment=true;continue}
      if(c==='"'&&out[pos-1]!=='\\')quoted=!quoted;if(quoted)continue;
      if(c==='{')stack.push('}');else if(c==='}'){stack.pop();if(!stack.length)break}
    }
    if(stack.length)throw Error('LilyPond: unvollständiger \\score-Block');
    found=true;const block=out.slice(open+1,pos);
    if(!/\\midi\s*\{/.test(block)){
      out=out.slice(0,pos)+'\n  \\midi { }\n'+out.slice(pos);needle.lastIndex=pos+15;added++;
    }else needle.lastIndex=pos+1;
  }
  if(!found)throw Error('Kein \score gefunden.');
  return {code:out,added};
}
function checkCompiledMidi(bytes,ensemble){
  try{
    const b=bytes,parsed=parseMidi(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));
    const notes=parsed.events.filter(e=>e.type==='on');
    if(!notes.length)return 'Die erzeugte MIDI-Datei enthält keine Noten.';
    const programs=parsed.events.filter(e=>e.type==='program');
    const voicePrograms=new Map(programs.map(e=>[e.ch,e.value]));
    const instruments=ensemble.filter(x=>x.id!=='piano');
    for(const i of instruments){
      const gm={violin:40,cello:42,flute:73}[i.id];
      const channel=programs.find(e=>e.value===gm)?.ch;
      if(channel===undefined||!notes.some(e=>e.ch===channel))return `${i.label} fehlt in der MIDI-Datei oder enthält keine Töne.`;
    }
    if(ensemble.some(x=>x.id==='piano')){
      const ch=programs.find(e=>e.value===0)?.ch;
      if(ch===undefined||!notes.some(e=>e.ch===ch))return 'Klavier fehlt in der MIDI-Datei oder enthält keine Töne.';
    }
    return '';
  }catch(e){return 'Die erzeugte MIDI-Datei ist nicht lesbar: '+String(e.message||e);}
}

const RENDER_URL='https://render.hacklily.org/rpc';
const utf8=new TextEncoder();
const bytes64=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
const to64=b=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s)};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
const text=(data,type='text/plain; charset=utf-8',extra={})=>new Response(data,{headers:{...headers,'Content-Type':type,...extra}});
async function body(req){const s=await req.text();if(utf8.encode(s).length>1200000)throw Error('Anfrage zu groß.');return JSON.parse(s)}
function asset(path){const a=ASSETS[path];if(!a)throw Error('Referenzdatei nicht gefunden.');return a.text===undefined?bytes64(a.base64):a.text}
async function getJson(env,name){const o=await env.BUCKET.get(name);return o?o.json():null}
async function putJson(env,name,data){await env.BUCKET.put(name,JSON.stringify(data),{httpMetadata:{contentType:'application/json'}})}
async function listAll(env,prefix){let cursor,objects=[];do{const r=await env.BUCKET.list({prefix,cursor,include:['customMetadata']});objects.push(...r.objects);cursor=r.truncated?r.cursor:null;}while(cursor);return objects}
async function log(env,event,runId,data){
 const name=`logs/${safe(runId)}/${Date.now()}-${randomUUID()}.json`;
 await putJson(env,name,{date:new Date().toISOString(),app:'LilyPond Composition Lab',version:VERSION,event,...data});
 return '/api/diagnosis?runId='+encodeURIComponent(runId);
}
async function saveFile(env,title,ext,bytes){
 const name=compositionFilename(title)+'-'+randomUUID().slice(0,8)+'.'+ext;
 await env.BUCKET.put('files/'+name,bytes,{httpMetadata:{contentType:contentType(name)}});
 return '/download/'+encodeURIComponent(name);
}
async function saveHistory(env,b){
 const id=historyId(b.id)||randomUUID().replaceAll('-',''),old=await getJson(env,'history/'+id+'.json')||{};
 const entry={id,createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),title:clean(b.title||'Unbenannte Komposition').slice(0,100),task:clean(b.task),draft:clean(b.draft),techout:clean(b.techout),compositionModel:clean(b.compositionModel).slice(0,200),realisationModel:clean(b.realisationModel).slice(0,200),format:['midicsv','lilypond','abc'].includes(b.format)?b.format:'midicsv',runId:historyId(b.runId)||'',midiUrl:typeof b.midiUrl==='string'&&b.midiUrl.startsWith('/download/')?b.midiUrl.slice(0,500):'',downloads:validDownloads(b.downloads),costs:{composition:Number(b.costs?.composition)||0,realisation:Number(b.costs?.realisation)||0},tokens1:Math.min(64000,Math.max(500,Number(b.tokens1)||64000)),system:clean(b.system),compiler:clean(b.compiler),pages:validDownloads(b.pages),tokens2:Math.min(64000,Math.max(500,Number(b.tokens2)||5000))};
 await env.BUCKET.put('history/'+id+'.json',JSON.stringify(entry),{httpMetadata:{contentType:'application/json'},customMetadata:{summary:JSON.stringify(historyPublic(entry))}});return historyPublic(entry);
}
function validDownloads(d){return Array.isArray(d)?d.filter(x=>typeof x?.url==='string'&&x.url.startsWith('/download/')&&typeof x.label==='string').slice(0,8).map(x=>({label:x.label.slice(0,100),url:x.url.slice(0,500)})):[]}
async function encryptionKey(env){if(!env.LAB_KEY_ENCRYPTION_KEY)throw Error('Schlüsselspeicherung derzeit nicht verfügbar. Key im Eingabefeld verwenden.');return crypto.subtle.importKey('raw',bytes64(env.LAB_KEY_ENCRYPTION_KEY),'AES-GCM',false,['encrypt','decrypt'])}
function keyInputError(message){const e=Error(message);e.status=400;return e;}
function normalizeKey(value){
 let key=String(value??'').trim().replace(/^(?:Authorization\s*:\s*)?Bearer\s+/i,'').trim();
 if((key.startsWith('"')&&key.endsWith('"'))||(key.startsWith("'")&&key.endsWith("'")))key=key.slice(1,-1);
 key=key.replace(/[\s\u200B-\u200D\uFEFF]/g,'');
 if(!key)throw keyInputError('OpenRouter-Schlüssel fehlt. Bitte unter Verbindung eingeben oder speichern.');
 if(!/^sk-or-v1-[A-Za-z0-9_-]+$/.test(key))throw keyInputError('Bitte den vollständigen OpenRouter-API-Schlüssel eingeben (beginnt mit sk-or-v1-). Direkte OpenAI-, Anthropic- oder Gemini-Schlüssel funktionieren hier nicht.');
 return key;
}
function routerHeaders(key){return {Authorization:'Bearer '+normalizeKey(key),'Content-Type':'application/json','X-OpenRouter-Title':'LilyPond Composition Lab'};}
function rejectRedirect(r){if(r.status>=300&&r.status<400)throw Error('OpenRouter meldet eine unerwartete Weiterleitung. Die Anfrage wurde zum Schutz des Schlüssels nicht weitergeleitet.');}
async function checkKey(key){
 const r=await upstream('https://openrouter.ai/api/v1/key',{headers:routerHeaders(key),redirect:'manual'},22000);
 rejectRedirect(r);
 if(r.ok)return {verified:true};
 const d=await r.json().catch(()=>({}));
 if(r.status===401||r.status===403){const e=Error('OpenRouter akzeptiert diesen API-Schlüssel nicht. Bitte unter Verbindung den vollständigen OpenRouter-Schlüssel erneut eingeben und prüfen.');e.status=401;e.providerError=d.error?.message||'Anmeldung abgelehnt';throw e;}
 throw Error('Schlüsselprüfung bei OpenRouter derzeit nicht möglich (HTTP '+r.status+').');
}
async function storedKey(env){const d=await getJson(env,'settings/key.json');if(!d)return '';const k=await encryptionKey(env);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes64(d.iv)},k,bytes64(d.data)))}
async function storeKey(env,key){const k=await encryptionKey(env),iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,utf8.encode(key));await putJson(env,'settings/key.json',{iv:to64(iv),data:to64(new Uint8Array(data))})}
async function rpc(method,params={},timeout=45000){
 const res=await fetch(RENDER_URL,{headers:{Upgrade:'websocket'}});
 const ws=res.webSocket;if(!ws)throw Error('Hacklily-Renderer nicht erreichbar (HTTP '+res.status+').');ws.accept();
 return new Promise((resolve,reject)=>{
  const id=randomUUID(),timer=setTimeout(()=>done(Error('Zeitüberschreitung beim Online-Renderer.')),timeout);
  let finished=false;
  function done(err,value){if(finished)return;finished=true;clearTimeout(timer);try{ws.close(1000,'done')}catch{};err?reject(err):resolve(value)}
  ws.addEventListener('message',e=>{try{const d=JSON.parse(e.data);if(d.id!==id)return;if(d.error)done(Error('LilyPond: '+d.error.message+' '+(d.error.data?.logs||'')));else done(null,d.result)}catch(e){done(e)}});
  ws.addEventListener('error',()=>done(Error('Verbindung zum Online-Renderer fehlgeschlagen.')));
  ws.addEventListener('close',()=>done(Error('Online-Renderer hat die Verbindung geschlossen.')));
  ws.send(JSON.stringify({jsonrpc:'2.0',id,method,params}));
 });
}
async function rendererReady(){
 // Only synthetic notes, never the user's composition, are sent during preflight.
 await rpc('render',{backend:'svg',version:'stable',src:'\\version "2.24.3"\n\\score { { c\'4 d\' e\' f\' } \\layout {} \\midi {} }'},18000);return true;
}
async function compileLilyMidi(env,code,title,runId,task=''){
 const started=Date.now();
 if(code.length>200000)return {error:'LilyPond-Quelle ist zu groß.'};
 try{
  const prepared=ensureMidiDirective(code);
  const result=await rpc('render',{backend:'svg',src:initialInstrumentNames(prepared.code),version:'stable'});
  const logs=String(result.logs||'');
  if(result.err)return {error:'LilyPond-Kompilierung fehlgeschlagen: '+String(result.err),logs,durationMs:Date.now()-started};
  const pages=[];
  for(const [i,svg] of (result.files||[]).entries())if(typeof svg==='string'&&svg.includes('<svg'))pages.push({label:'Notenseite '+(i+1),url:await saveFile(env,title+'-Seite-'+(i+1),'svg',svg)});
  if(!pages.length)return {error:'LilyPond erzeugte kein Notenbild.',logs,durationMs:Date.now()-started};
  let url='',warning='',rangeCheck=null,registerCheck=null;
  if(result.midi){
   const bytes=bytes64(result.midi);warning=checkCompiledMidi(bytes,[]);
   if(!warning){
    url=await saveFile(env,title,'mid',bytes);
    const parsed=parseMidi(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
    rangeCheck=checkInstrumentRanges(parsed);registerCheck=checkInstrumentRegisters(parsed,task);warning=[rangeCheck.warning,registerCheck.warning].filter(Boolean).join('\n');
   }
  }
  else warning='LilyPond erzeugte keine MIDI-Datei.';
  return {url,label:'MIDI-Datei',pages,logs,warning,rangeCheck,registerCheck,instrumentLabels:'first-system-only',addedMidiBlock:prepared.added,durationMs:Date.now()-started};
 }catch(e){return {error:String(e.message||e),durationMs:Date.now()-started}}
}
async function repairOctaves(env,code,title,runId,key,model,maxTokens,compiled,task=''){
 const instructions='Repariere ausschließlich falsche Oktavlagen im vorhandenen LilyPond-Dokument. Keine Neukomposition. Ändere nur Apostrophe/Kommas an nummerierten Tonangaben, auch relative-Anker. Alle anderen Zeichen bleiben erhalten. WICHTIG: In relative bezeichnet eine Note OHNE Oktavzeichen die nächstliegende diatonische Lage zur VORHERIGEN Note (höchstens eine Quarte entfernt). Apostroph bedeutet von DIESER Lage eine Oktave aufwärts, Komma abwärts, NICHT eine feste absolute Oktave! Wiederholte Apostrophe bewirken kumulative Oktavdrift. Rechne die Tonfolge vom Anker Schritt für Schritt durch, einschließlich Taktgrenzen und Akkorden. Ein Sprung e nach h braucht für eine aufsteigende Quinte genau ein Apostroph; ein schrittweiser Aufstieg e fis g a h braucht KEINE Apostrophe. Für normale Klaviermelodik müssen deshalb die meisten marks=0 sein; weitere Zeichen nur für echte größere Sprünge. Auch Bassfiguren müssen vom jeweils vorherigen Ton aus gerechnet werden, nicht pro Takt neu. Jede Stimme muss in sinnvoller spielbarer Instrumentenlage bleiben. Cello: normaler Kernbereich bis G4, einzelne hohe Spitzentöne erlaubt; ausdrücklich gewünschte hohe Lage erhalten. Relative-Anweisungen, Notennamen, Dauern, Tempo, Titel und Ausdruck unverändert lassen. Nummerierte Liste enthält auch Anker und Tonartangaben; Tonartangaben NICHT ändern. Antworte ausschließlich als JSON mit den notwendigen Änderungen: {"edits":[{"id":12,"marks":0},{"id":19,"marks":-1}]}. marks ist die neue ANZAHL der relativen Oktavzeichen: 0=keine, 1=ein Apostroph, -1=ein Komma. Keine from/to-Textausschnitte, kein Notenvolltext, kein Markdown.';
 let cost=0,working=code,report=compiled,feedback='';
 for(let attempt=1;attempt<=2;attempt++){
  const plan=relativeOctavePlan(working);
  const quick=!!plan||attempt===1;
  const repairLimit=quick?8000:24000,reasoning={effort:quick?'low':'medium'},repairStarted=Date.now();
  const targetInstructions='Korrigiere ausschließlich die Oktavlagen der aufgeführten Töne. Wähle für JEDE Tonposition eine sinnvolle absolute Oktave (wissenschaftliche Zählung: mittleres C=C4, Klavier A0–C8). Behalte Melodie, Bassführung, Akkordstruktur und alle Tonklassen; erhalte plausible Oktavverdopplungen in Akkorden. Die aktuelle relative Quelle hat kumulative Oktavdrift. Interpretiere die musikalisch beabsichtigte Lage aus der Stimme, nicht aus den absurd hohen/tiefen aktuellen Oktaven. Für Klavier rechte Hand meist Oktaven 4–6, linke Hand meist 1–4; das sind Orientierungspunkte, keine festen Grenzen. Cello normal bis G4, einzelne höhere Spitzen erlaubt, ausdrücklich gewünschte hohe Lage erhalten. Rechne KEINE relativen Apostrophe oder Kommas aus: Das übernimmt die App exakt. Antworte ausschließlich als JSON {"octaves":[4,5,5,4,...]} mit genau einer absoluten Oktavnummer für jede nummerierte Position, in unveränderter Reihenfolge. Keine Notennamen, keine Quelltextausschnitte, kein Markdown.';
  const messages=[{role:'system',content:plan?targetInstructions:instructions},{role:'user',content:[report.warning,feedback,working,'Nummerierte Tonangaben (id, Ton, Zeile):\n'+JSON.stringify((plan||octaveTokens(working)).map(({id,token,line})=>({id,token,line})))].filter(Boolean).join('\n\n')}];
  await log(env,'anfrage',runId,{stage:'realisation',operation:'octave-repair',attempt,model,messages,max_tokens:repairLimit,reasoning_requested:reasoning,output_format:plan?'absolute-octave-targets':'indexed-octave-marks'});
  try{
   const r=await upstream('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:routerHeaders(key),redirect:'manual',body:JSON.stringify({model,messages,max_tokens:repairLimit,reasoning,stream:false,usage:{include:true}})});
   rejectRedirect(r);const d=await r.json();if(!r.ok)throw Error(d.error?.message||'Oktavkorrektur fehlgeschlagen.');
   cost+=Number(d.usage?.cost)||0;let content=d.choices?.[0]?.message?.content;
   if(Array.isArray(content))content=content.filter(x=>x.type==='text').map(x=>x.text).join('\n');
   await log(env,'antwort',runId,{stage:'realisation',operation:'octave-repair',attempt,model,answer:content,usage:d.usage||null,finish_reason:d.choices?.[0]?.finish_reason,durationMs:Date.now()-repairStarted});
   if(d.choices?.[0]?.finish_reason==='length')throw Error('Korrekturantwort wurde abgeschnitten.');
   const candidate=applyOctaveEdits(working,content),checked=await compileLilyMidi(env,candidate,title,runId,task);
   await log(env,'korrekturpruefung',runId,{operation:'octave-repair',attempt,source:candidate,...checked});
   if(checked.error||!checked.url)throw Error(checked.error||'Keine MIDI-Datei.');
   if(checked.rangeCheck?.status!=='passed'||checked.registerCheck?.status==='warning'){
    working=candidate;report=checked;
    throw Error('Es verbleiben Fehler in der geprüften Zwischenfassung: '+checked.warning);
   }
   checked.repair='Oktavfehler korrigiert; ausschließlich Oktavzeichen geändert und Tonumfang und Celloregister erneut geprüft.';
   await log(env,'korrektur',runId,{operation:'octave-repair',attempt,accepted:true});
   return {code:candidate,compiled:checked,cost};
  }catch(e){
   feedback=String(e.message).replaceAll(key,'[API-Schlüssel]');
   await log(env,'korrektur',runId,{operation:'octave-repair',attempt,accepted:false,error:feedback});
  }
 }
 return {code,compiled:{...compiled,repairFailed:true,warning:compiled.warning+'\nAutomatische Oktavkorrektur nach zwei Prüfungen nicht erfolgreich; Original erhalten.'},cost};
}
async function handle(req,env){
 const url=new URL(req.url),p=url.pathname;
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==url.origin)return json({error:'Unzulässiger Ursprung.'},403);
 if(req.method==='GET'&&p==='/')return text(PAGE,'text/html; charset=utf-8');
 if(req.method==='GET'&&p==='/sw.js')return text("self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));\nself.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));\n// Always use the network: no cache of private API data or old UI versions.\nself.addEventListener('fetch',event=>{\n if(event.request.method!=='GET'||event.request.mode!=='navigate')return;\n event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang=\"de\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>LilyPond Composition Lab</title><body style=\"font:18px system-ui;padding:24px\"><h1>LilyPond Composition Lab</h1><p>Keine Internetverbindung. Bitte die Verbindung wiederherstellen und die App erneut \u00f6ffnen.</p><button onclick=\"location.reload()\">Erneut versuchen</button></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));\n});\n",'text/javascript; charset=utf-8',{'Service-Worker-Allowed':'/'});
 if(req.method==='GET'&&p==='/favicon.svg')return text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#24364b"/><path d="M20 42V20h24v22M20 24h24" fill="none" stroke="#a7ccff" stroke-width="5"/><circle cx="14" cy="44" r="8" fill="#a7ccff"/><circle cx="38" cy="44" r="8" fill="#a7ccff"/></svg>','image/svg+xml');
 if(req.method==='GET'&&p==='/manifest.webmanifest')return text(JSON.stringify({id:'/',name:'LilyPond Composition Lab',short_name:'LilyPond Composition Lab',lang:'de',start_url:'/',scope:'/',display:'standalone',display_override:['standalone'],background_color:'#182231',theme_color:'#182231',prefer_related_applications:false,icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]}),'application/manifest+json');
 if(req.method==='GET'&&ASSETS[p])return text(asset(p),ASSETS[p].type);
 if(!env.BUCKET)return json({error:'Datenspeicher derzeit nicht verfügbar. Bitte später erneut versuchen.'},503);
 if(req.method==='GET'&&p==='/api/key-status')return json({stored:!!await getJson(env,'settings/key.json'),canStore:!!env.LAB_KEY_ENCRYPTION_KEY});
 if(req.method==='POST'&&p==='/api/key-store'){const b=await body(req),key=normalizeKey(b.key);await checkKey(key);await storeKey(env,key);return json({stored:true,verified:true})}
 if(req.method==='POST'&&p==='/api/key-check'){const b=await body(req);try{return json(await checkKey(normalizeKey(b.key||await storedKey(env))))}catch(e){return json({error:e.message},e.status||400)}}
 if(req.method==='DELETE'&&p==='/api/key-store'){await env.BUCKET.delete('settings/key.json');return json({stored:false})}
 if(req.method==='GET'&&p==='/api/models'){
  const r=await upstream('https://openrouter.ai/api/v1/models',{},22000);if(!r.ok)throw Error(`OpenRouter-Modellkatalog: HTTP ${r.status}`);
  const raw=await r.json(),models=(raw.data||[]).filter(m=>m.architecture?.output_modalities?.includes('text')).map(m=>({id:m.id,name:m.name,provider:String(m.id||'').split('/')[0]||'',context_length:Number(m.context_length)||null,prompt:Number(m.pricing?.prompt)||0,completion:Number(m.pricing?.completion)||0,reasoning:m.reasoning||null,supported_parameters:Array.isArray(m.supported_parameters)?m.supported_parameters:[]})).sort((a,b)=>a.id.localeCompare(b.id));return json({models});
 }
 if(req.method==='POST'&&p==='/api/preflight'){
  const b=await body(req),fmt=b.format||'lilypond',ensemble=requestedEnsemble(b.task,b.draft);
  try{if(fmt==='lilypond')await rendererReady();return json({ready:true,lilypondInstalled:true,ensemble:ensemble.map(x=>x.label),error:''})}catch(e){return json({ready:false,lilypondInstalled:false,error:e.message+' Kein kostenpflichtiger KI-Aufruf gestartet.'})}
 }
 if(req.method==='GET'&&p==='/api/midi-status'){try{await rendererReady();return json({lilypondInstalled:true,soundfont:'TimGM6mb.sf2',conversion:'LilyPond über Hacklily; MIDI-CSV in der WebApp'})}catch{return json({lilypondInstalled:false})}}
 if(req.method==='POST'&&p==='/api/compile-lilypond'){
  const b=await body(req),code=clean(b.code),runId=safe(b.runId||randomUUID());if(!code.trim())return json({error:'Kein LilyPond-Code vorhanden.'},400);
  const result=await compileLilyMidi(env,code,compositionFilename(b.title),runId,clean(b.task));await log(env,'kompilierung',runId,{source:code,title:compositionFilename(b.title),...result});return json(result,result.error?422:200);
 }
 if(req.method==='POST'&&p==='/api/repair-octaves'){
  const b=await body(req),code=clean(b.code),task=clean(b.task),title=compositionFilename(b.title),runId=safe(b.runId||randomUUID());
  const key=normalizeKey(b.key||await storedKey(env)),model=clean(b.model);await checkKey(key);
  if(!code.trim()||!model.includes('/'))return json({error:'Code und Modell erforderlich.'},400);
  let compiled=await compileLilyMidi(env,code,title,runId,task);await log(env,'kompilierung',runId,{source:code,...compiled});
  if(compiled.rangeCheck?.instruments.some(x=>x.violations>0)||compiled.registerCheck?.status==='warning'){
   const result=await repairOctaves(env,code,title,runId,key,model,8000,compiled,task);return json({...result,runId});
  }
  return json({code,compiled,cost:0,runId});
 }
 if(req.method==='POST'&&p==='/api/midi-import'){
  const b=await body(req),bytes=bytes64(String(b.base64||''));if(bytes.length<18||bytes.length>900000||String.fromCharCode(...bytes.subarray(0,4))!=='MThd')return json({error:'Bitte eine gültige Standard-MIDI-Datei (max. 900 KB) wählen.'},400);
  parseMidi(bytes.buffer);return json({url:await saveFile(env,b.title,'mid',bytes),label:'MIDI-Datei'});
 }
 if(req.method==='GET'&&p.startsWith('/download/')){
  const name=decodeURIComponent(p.slice(10));if(!name||/[\/\\\x00-\x1f]/.test(name)||name==='.'||name==='..')return json({error:'Ungültiger Dateiname'},400);
  const obj=await env.BUCKET.get('files/'+name);if(!obj)return json({error:'Datei nicht gefunden'},404);
  return text(obj.body,contentType(name),{'Content-Disposition':`attachment; filename="composition.${name.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(name)}`});
 }
 if(req.method==='GET'&&p==='/api/history'){
  const all=await listAll(env,'history/'),entries=all.map(o=>{try{return JSON.parse(o.customMetadata?.summary||'null')}catch{return null}}).filter(Boolean).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));return json({entries});
 }
 if(p.startsWith('/api/history/')){
  const id=historyId(p.slice('/api/history/'.length));if(!id)return json({error:'Ungültige Verlaufskennung.'},400);const key='history/'+id+'.json';
  if(req.method==='GET'){const entry=await getJson(env,key);return entry?json({entry}):json({error:'Komposition nicht gefunden.'},404)}
  if(req.method==='DELETE'){await env.BUCKET.delete(key);return json({deleted:true})}
 }
 if(req.method==='POST'&&p==='/api/history')return json({entry:await saveHistory(env,await body(req))});
 if(req.method==='GET'&&p==='/api/workspace')return json({workspace:await getJson(env,'workspace/current.json')});
 if(req.method==='POST'&&p==='/api/workspace'){
  const b=await body(req),w=b.workspace;if(!w||typeof w!=='object'||Array.isArray(w))return json({error:'Ungültiger Arbeitsstand'},400);
  const entry={title:clean(w.title),task:clean(w.task),draft:clean(w.draft),techout:clean(w.techout),system:clean(w.system),compiler:clean(w.compiler),pages:validDownloads(w.pages),format:['lilypond','midicsv','abc'].includes(w.format)?w.format:'lilypond',tokens1:String(w.tokens1||64000),tokens2:String(w.tokens2||5000),compositionModel:clean(w.compositionModel).slice(0,200),realisationModel:clean(w.realisationModel).slice(0,200),historyId:historyId(w.historyId)||'',runId:historyId(w.runId)||'',costs:{composition:Number(w.costs?.composition)||0,realisation:Number(w.costs?.realisation)||0},downloads:validDownloads(w.downloads),midiUrl:typeof w.midiUrl==='string'&&w.midiUrl.startsWith('/download/')?w.midiUrl:''};await putJson(env,'workspace/current.json',entry);return json({saved:true});
 }
 if(req.method==='GET'&&p==='/api/diagnosis'){
  const runId=safe(url.searchParams.get('runId')||''),objects=await listAll(env,'logs/'+runId+'/');const entries=await Promise.all(objects.map(o=>getJson(env,o.key)));entries.sort((a,b)=>a.date.localeCompare(b.date));if(!entries.length)return json({error:'Kein Protokoll gefunden.'},404);
  const costs={composition:0,realisation:0,total:0};for(const e of entries){const c=Number(e.usage?.cost);if(Number.isFinite(c)){if(e.stage==='composition')costs.composition+=c;if(e.stage==='realisation')costs.realisation+=c;costs.total+=c}}
  return text(JSON.stringify({app:'LilyPond Composition Lab',version:VERSION,createdAt:new Date().toISOString(),runId,costs,entries},null,2),'application/json; charset=utf-8',{'Content-Disposition':`attachment; filename="Diagnose-${runId}.json"`});
 }
 if(req.method==='POST'&&p==='/api/run')return run(req,env);
 return json({error:'Nicht gefunden'},404);
}
async function run(req,env){
 const b=await body(req),runId=safe(b.runId||randomUUID().replaceAll('-','')),started=Date.now();
 let key='';
 try{
  key=normalizeKey(b.key||await storedKey(env));await checkKey(key);const model=clean(b.model).trim();
  if(!key)throw Error('API-Schlüssel fehlt. Bitte unter Verbindung eingeben oder speichern.');
  if(!model.includes('/'))throw Error('Bitte ein Modell auswählen.');
  const task=clean(b.task);if(!task.trim())throw Error('Kompositionsauftrag fehlt.');
  try{await rendererReady()}catch(e){await log(env,'kostenstopp',runId,{error:e.message,durationMs:Date.now()-started});return json({error:e.message+' Keine KI wurde aufgerufen.',runId},412)}
  const suppliedSystem=clean(b.system).trim();
  const system=!suppliedSystem||suppliedSystem===TECHNICAL_SYSTEM?DEFAULT_SYSTEM:suppliedSystem;
  const previousTitles=[...new Set((await listAll(env,'history/')).map(o=>{try{return JSON.parse(o.customMetadata?.summary||'{}').title||''}catch{return ''}}).filter(Boolean))];
  const titleContext=[...new Set([...previousTitles,clean(b.title)].filter(t=>t&&!/^Unbenannte[ _]Komposition$/i.test(t)))];
  const requestedTokens=parseInt(b.maxTokens);
  const max_tokens=Math.min(64000,Math.max(500,!requestedTokens||requestedTokens===8000?64000:requestedTokens));
  const messages=[{role:'system',content:system},{role:'user',content:task}];
  const payload={model,messages,max_tokens,stream:false,usage:{include:true}};
  await log(env,'anfrage',runId,{stage:'composition',model,title:clean(b.title),max_tokens,messages,reasoning_requested:'provider_default'});
  const r=await upstream('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:routerHeaders(key),redirect:'manual',body:JSON.stringify(payload)});
  rejectRedirect(r);
  const response=await r.json().catch(()=>({error:{message:'Ungültige KI-Antwort'}}));
  if(!r.ok){const e=Error([401,403].includes(r.status)?'OpenRouter hat die Anmeldung abgelehnt. Bitte den Schlüssel unter Verbindung prüfen.':response.error?.message||'OpenRouter HTTP '+r.status);e.status=r.status;e.providerError=response.error?.message;throw e;}
  let answer=response.choices?.[0]?.message?.content;
  if(Array.isArray(answer))answer=answer.filter(x=>x.type==='text').map(x=>x.text).join('\n');
  answer=typeof answer==='string'?answer:'';
  let code=answer.trim().replace(/^```(?:lilypond|ly)?\s*\n/i,'').replace(/\n```\s*$/,'').trim();
  const proposedTitle=compositionFilename(code.match(/\btitle\s*=\s*"([^"\n]+)"/)?.[1]||'Komposition');
  const titleKey=t=>compositionFilename(t).toLocaleLowerCase('de').replace(/\s*(?:[·–—-]\s*)?\(?\d+\)?\s*$/,'').trim();
  const usedKeys=new Set(titleContext.map(titleKey));
  let title=proposedTitle,titleWarning='',titleCost=0;
  const usage=response.usage?{...response.usage}:null,finish=response.choices?.[0]?.finish_reason||null;
  await log(env,'antwort',runId,{stage:'composition',model,answer,usage,finish_reason:finish,durationMs:Date.now()-started});
  const downloads=[];
  const base={title:compositionFilename(title),task,system,techout:code,compositionModel:model,format:'lilypond',runId,downloads,costs:{composition:Number(usage?.cost)||0,realisation:0},tokens1:max_tokens};
  // Persist the original composition before naming or compiling it.
  const saved=await saveHistory(env,base);
  if(finish==='length'){
   const compiled={error:'KI-Antwort wegen des Tokenlimits abgeschnitten. Der Notentext ist unvollständig. Bitte das Tokenbudget erhöhen und erneut komponieren.',incomplete:true};
   if(code)downloads.push({label:'Unvollständige LilyPond-Datei',url:await saveFile(env,title,'ly',code)});
   const entry={...base,id:saved.id,compiler:compiled.error,pages:[],midiUrl:''};
   await saveHistory(env,entry);await putJson(env,'workspace/current.json',{...entry,historyId:saved.id});
   await log(env,'ausgabelimit',runId,{max_tokens,warning:compiled.error});
   return json({runId,historyId:saved.id,title:entry.title,answer:code,rawAnswer:answer,downloads,usage,costs:base.costs,finish_reason:finish,compiled,durationMs:Date.now()-started});
  }
  if(usedKeys.has(titleKey(title))){
   const blocked=titleContext.slice(-40);
   for(let attempt=1;attempt<=2;attempt++){
    const namingMessages=[{role:'system',content:'Du vergibst ausschließlich einen neuen musikalischen Titel für eine bereits fertige Komposition. Wähle einen eigenständigen, zur Musik passenden Namen. Keine Nummerierung, keine bloße Variante eines bisherigen Titels. Ändere keine Musik. Antworte nur als JSON: {"title":"Dein neuer Titel"}.'},{role:'user',content:JSON.stringify({auftrag:task,lilypond:code,bisherigeTitel:blocked})}];
    const namingStarted=Date.now();
    await log(env,'anfrage',runId,{stage:'composition',operation:'title',attempt,model,messages:namingMessages,max_tokens:1000});
    try{
     const nr=await upstream('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:routerHeaders(key),redirect:'manual',body:JSON.stringify({model,messages:namingMessages,max_tokens:1000,stream:false,usage:{include:true}})},30000);
     rejectRedirect(nr);
     const nd=await nr.json();
     if(!nr.ok)throw Error('Titelanfrage fehlgeschlagen (HTTP '+nr.status+').');
     let content=nd.choices?.[0]?.message?.content;
     if(Array.isArray(content))content=content.filter(x=>x.type==='text').map(x=>x.text).join('\n');
     titleCost+=Number(nd.usage?.cost)||0;
     await log(env,'antwort',runId,{stage:'composition',operation:'title',attempt,model,answer:content,usage:nd.usage||null,durationMs:Date.now()-namingStarted});
     const candidate=JSON.parse(String(content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')).title;
     if(typeof candidate!=='string'||!candidate.trim()||candidate.length>100)throw Error('Kein gültiger neuer Titel.');
     const next=compositionFilename(candidate);
     if(usedKeys.has(titleKey(next))) {blocked.push(next);throw Error('Die KI hat erneut einen bisherigen Titel vorgeschlagen.');}
     title=next;titleWarning='';break;
    }catch(e){titleWarning='Neuer Titel konnte nicht erzeugt werden. Die Komposition wurde unter ihrem ursprünglichen Titel gespeichert.';await log(env,'titelwarnung',runId,{attempt,error:String(e.message).replaceAll(key,'[API-Schlüssel]')});}
   }
  }
  // Only the title assignment changes; the musical source stays intact.
  if(title!==proposedTitle)code=code.replace(/\btitle\s*=\s*"([^"\n]+)"/,()=>`title = "${title}"`);
  if(usage)usage.cost=(Number(usage.cost)||0)+titleCost;
  base.title=title;base.techout=code;base.costs.composition+=titleCost;
  let compiled=code?await compileLilyMidi(env,code,title,runId,task):{error:'Die KI lieferte keinen LilyPond-Code.'};
  await log(env,'kompilierung',runId,{source:code,...compiled});
  if(compiled.rangeCheck?.instruments.some(x=>x.violations>0)||compiled.registerCheck?.status==='warning'){
   const repaired=await repairOctaves(env,code,title,runId,key,model,max_tokens,compiled,task);
   code=repaired.code;compiled=repaired.compiled;base.techout=code;base.costs.realisation+=repaired.cost;
  }
  if(code)downloads.push({label:'LilyPond-Datei',url:await saveFile(env,title,'ly',code)});
  if(compiled.url)downloads.push({label:'MIDI-Datei',url:compiled.url});
  const entry={...base,id:saved.id,downloads,midiUrl:compiled.url||'',pages:compiled.pages||[],compiler:[compiled.error,compiled.warning,compiled.repair,compiled.logs].filter(Boolean).join('\n')};
  await saveHistory(env,entry);await putJson(env,'workspace/current.json',{...entry,historyId:saved.id});
  return json({runId,historyId:saved.id,title:entry.title,answer:code,rawAnswer:answer,downloads,usage,costs:base.costs,titleWarning,finish_reason:finish,compiled,durationMs:Date.now()-started});
 }catch(e){const error=String(e.message||e).replaceAll(key||'\u0000','[API-Schlüssel]');await log(env,'fehler',runId,{error,status:e.status||null,providerError:e.providerError?.replaceAll(key||'\u0000','[API-Schlüssel]')||null,durationMs:Date.now()-started});return json({error,runId},e.status===401?401:502)}
}
export default {async fetch(request,env,ctx){try{return await handle(request,env)}catch(e){return json({error:e.name==='AbortError'?'Zeitüberschreitung beim Onlinedienst.':String(e.message||e)},e.status||500)}}};
