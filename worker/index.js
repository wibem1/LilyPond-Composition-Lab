import {sourceStatus,lilySource,continuationMessages,appendContinuation} from '../src/composition-recovery.mjs';
import {readCompositionResponse} from '../src/provider-stream.mjs';
import {scoreCompleteness} from '../src/score-completeness.mjs';
import {compilerDiagnostics} from '../src/compiler-diagnostics.mjs';
import {compositionCosts} from '../src/composition-costs.mjs';
import {APP_VERSION as VERSION,MIDI_TIMING_POLICY} from '../src/app-config.mjs';
import {DEFAULT_SYSTEM,currentSystem} from '../src/composition-defaults.mjs';
import {parseMidi} from '../src/midi-reader.mjs';
import {correctionMessages,ideaMessages,compositionMessages,workflowFields,qualityChoice,reasoningFor,stageRecord} from '../src/composition-workflow.mjs';
import {exportHistory,importHistory,backupByteLimit} from '../src/history-backup.mjs';
import {compositionAttribution} from '../src/composition-attribution.mjs';
import {PAGE,ASSETS} from "./generated.js";
import {checkInstrumentRanges} from '../src/instrument-ranges.mjs';
import {checkInstrumentRegisters} from '../src/instrument-registers.mjs';
import {automaticOctaveRepair,legacyOctaveOriginal} from '../src/octave-repair.mjs';
import {soundfontUpload} from '../src/soundfont-upload.mjs';
import {initialInstrumentNames} from '../src/notation-layout.mjs';
import {automaticOttava,sameMidiPerformance,removeGeneratedOttava} from '../src/automatic-ottava.mjs';
import {expressionPlayback} from '../src/expression-playback.mjs';
import {musicXmlCapture,capturedMusic} from '../src/musicxml-capture.mjs';
import {musicXmlScore} from '../src/musicxml-export.mjs';
import {streamRun,readRunSession,noteRunProgress} from '../src/run-session.mjs';
const randomUUID=()=>crypto.randomUUID();
const ENSEMBLE_PATTERNS=[
  {id:'violin',regex:/\b(?:violine|geige|violin)\b/i,label:'Violine'},
  {id:'cello',regex:/\b(?:violoncello|cello)\b/i,label:'Violoncello'},
  {id:'flute',regex:/\b(?:flöte|floete|querflöte|querfloete|flute)\b/i,label:'Flöte'},
  {id:'piano',regex:/\b(?:klavier|piano|flügel|fluegel)\b/i,label:'Klavier'}
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
    compositionModel:v.compositionModel||'',compositionReasoning:v.compositionReasoning||'',realisationModel:v.realisationModel||'',format:v.format||'',
    workflow:v.workflow||'direct',hasDraft:!!v.draft,hasRealisation:!!v.techout,costs:compositionCosts(v.costs)};
}
async function upstream(url,init,timeout=185000){const ac=new AbortController();const t=setTimeout(()=>ac.abort(),timeout);try{return await fetch(url,{...init,signal:ac.signal});}finally{clearTimeout(t);}}
function contentType(file){if(file.endsWith('.musicxml'))return 'application/vnd.recordare.musicxml+xml; charset=utf-8';if(file.endsWith('.svg'))return 'image/svg+xml';if(file.endsWith('.mid'))return 'audio/midi';if(file.endsWith('.abc')||file.endsWith('.ly')||file.endsWith('.csv')||file.endsWith('.txt'))return 'text/plain; charset=utf-8';return 'application/octet-stream';}

function ensureMidiDirective(text){
  const source=String(text).trim();if(!/\\score\s*\{/.test(source))throw Error('LilyPond-Ausgabe enthält keinen \\score-Block.');
  let out=source,needle=/\\score\s*\{/g,found=false,added=0,m;
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
 noteRunProgress(runId,event,data);
 const name=`logs/${safe(runId)}/${Date.now()}-${randomUUID()}.json`;
 await putJson(env,name,{date:new Date().toISOString(),app:'LilyPond Composition Lab',version:VERSION,event,...data});
 return '/api/diagnosis?runId='+encodeURIComponent(runId);
}
async function saveFile(env,title,ext,bytes){
 const name=compositionFilename(title)+'-'+randomUUID().slice(0,8)+'.'+ext;
 await env.BUCKET.put('files/'+name,bytes,{httpMetadata:{contentType:contentType(name)}});
 return '/download/'+encodeURIComponent(name);
}
async function saveHistory(env,b,{restoreDates=false}={}){
 const id=historyId(b.id)||randomUUID().replaceAll('-',''),old=await getJson(env,'history/'+id+'.json')||{};
 const entry={...workflowFields(b),id,createdAt:old.createdAt||(restoreDates&&b.createdAt)||new Date().toISOString(),updatedAt:(restoreDates&&b.updatedAt)||new Date().toISOString(),title:clean(b.title||'Unbenannte Komposition').slice(0,100),task:clean(b.task),draft:clean(b.draft),techout:clean(b.techout),compositionModel:clean(b.compositionModel).slice(0,200),actualCompositionModel:clean(b.actualCompositionModel??old.actualCompositionModel).slice(0,200),realisationModel:clean(b.realisationModel).slice(0,200),format:['midicsv','lilypond','abc'].includes(b.format)?b.format:'midicsv',runId:historyId(b.runId)||'',midiTimingPolicy:b.midiTimingPolicy===MIDI_TIMING_POLICY?MIDI_TIMING_POLICY:'',midiUrl:typeof b.midiUrl==='string'&&b.midiUrl.startsWith('/download/')?b.midiUrl.slice(0,500):'',downloads:validDownloads(b.downloads),costs:compositionCosts(b.costs===undefined?old.costs:b.costs),tokens1:Math.min(64000,Math.max(500,Number(b.tokens1)||64000)),system:clean(b.system),compositionReasoning:qualityChoice(b.compositionReasoning),compiler:clean(b.compiler),pages:validDownloads(b.pages),tokens2:Math.min(64000,Math.max(500,Number(b.tokens2)||5000))};
 await env.BUCKET.put('history/'+id+'.json',JSON.stringify(entry),{httpMetadata:{contentType:'application/json'},customMetadata:{summary:JSON.stringify(historyPublic(entry))}});return historyPublic(entry);
}
function validDownloads(d){return Array.isArray(d)?d.filter(x=>typeof x?.url==='string'&&x.url.startsWith('/download/')&&typeof x.label==='string').slice(0,8).map(x=>({label:x.label.slice(0,100),url:x.url.slice(0,500)})):[]}
function workspaceEntry(w){return {...workflowFields(w),title:clean(w.title),task:clean(w.task),draft:clean(w.draft),techout:clean(w.techout),system:clean(w.system),compositionReasoning:['short','balanced','high','xhigh','default'].includes(w.compositionReasoning)?w.compositionReasoning:'short',compiler:clean(w.compiler),pages:validDownloads(w.pages),format:['lilypond','midicsv','abc'].includes(w.format)?w.format:'lilypond',tokens1:String(w.tokens1||64000),tokens2:String(w.tokens2||5000),compositionModel:clean(w.compositionModel).slice(0,200),realisationModel:clean(w.realisationModel).slice(0,200),historyId:historyId(w.historyId)||'',runId:historyId(w.runId)||'',costs:compositionCosts(w.costs),downloads:validDownloads(w.downloads),midiTimingPolicy:w.midiTimingPolicy===MIDI_TIMING_POLICY?MIDI_TIMING_POLICY:'',midiUrl:typeof w.midiUrl==='string'&&w.midiUrl.startsWith('/download/')?w.midiUrl:''};}
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
  let performance;
  try{performance=expressionPlayback(prepared.code);}catch(e){performance={code:prepared.code,mode:'fallback',warning:e.message};}
  let result=await rpc('render',{backend:'svg',src:initialInstrumentNames(performance.code),version:'stable'});
  if((result.err||compilerDiagnostics(result.logs).status==='error')&&performance.mode==='articulate'){
   const expressionError=String(result.err)+' '+String(result.logs||'');
   result=await rpc('render',{backend:'svg',src:initialInstrumentNames(prepared.code),version:'stable'});
   performance={mode:'fallback',warning:expressionError};
  }
  let ottava={status:'unchanged',passages:[]},displayCode='';
  if(!result.err&&compilerDiagnostics(result.logs).status==='passed'&&result.midi){
   try{
    const originalBytes=bytes64(result.midi),originalMidi=parseMidi(originalBytes.buffer.slice(originalBytes.byteOffset,originalBytes.byteOffset+originalBytes.byteLength));
    // First repair genuine pitch errors. Display optimization never hides them.
    if(checkInstrumentRanges(originalMidi).status==='passed'&&checkInstrumentRegisters(originalMidi,task).status!=='warning'){
     const planned=automaticOttava(code);
     if(planned.passages.length){
      const visualPrepared=ensureMidiDirective(planned.code).code;
      const visual=performance.mode==='articulate'?expressionPlayback(visualPrepared).code:visualPrepared;
      const candidate=await rpc('render',{backend:'svg',src:initialInstrumentNames(visual),version:'stable'});
      if(candidate.err||compilerDiagnostics(candidate.logs).status!=='passed'||!candidate.midi||!(candidate.files||[]).some(f=>typeof f==='string'&&f.includes('<svg')))throw Error('Oktavzeichen konnten nicht fehlerfrei kompiliert werden.');
      const bytes=bytes64(candidate.midi),midi=parseMidi(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
      if(!sameMidiPerformance(originalMidi,midi))throw Error('MIDI unterscheidet sich nach der Notationsänderung.');
      result=candidate;displayCode=planned.code;ottava={status:'applied',passages:planned.passages,midiUnchanged:true};
     }
    }
   }catch(e){ottava={status:'rejected',passages:[],error:String(e.message||e)};}
  }
  const logs=String(result.logs||''),diagnostics=compilerDiagnostics(logs);
  if(diagnostics.status==='error')return {error:'LilyPond meldet Compilerfehler. Der erzeugte Notensatz ist nicht verlässlich.',logs,diagnostics,durationMs:Date.now()-started};
  if(result.err)return {error:'LilyPond-Kompilierung fehlgeschlagen: '+String(result.err),logs,durationMs:Date.now()-started};
  const pages=[];
  for(const [i,svg] of (result.files||[]).entries())if(typeof svg==='string'&&svg.includes('<svg'))pages.push({label:'Notenseite '+(i+1),url:await saveFile(env,title+'-Seite-'+(i+1),'svg',svg)});
  if(!pages.length)return {error:'LilyPond erzeugte kein Notenbild.',logs,durationMs:Date.now()-started};
  let url='',warning='',rangeCheck=null,registerCheck=null;
  if(result.midi){
   const bytes=bytes64(result.midi);let parsed;
   try{
    parsed=parseMidi(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    if(!parsed.events.some(e=>e.type==='on'))warning='Die erzeugte MIDI-Datei enthält keine Noten.';
   }catch(e){warning='Die erzeugte MIDI-Datei ist nicht lesbar: '+String(e.message||e);}
   if(!warning){
    url=await saveFile(env,title,'mid',bytes);
    rangeCheck=checkInstrumentRanges(parsed);registerCheck=checkInstrumentRegisters(parsed,task);warning=[rangeCheck.warning,registerCheck.warning].filter(Boolean).join('\n');
   }
  }
  else warning='LilyPond erzeugte keine MIDI-Datei.';
  if(performance.mode==='fallback')warning=[warning,'Erweiterte Ausdruckswiedergabe fehlgeschlagen; normale MIDI-Wiedergabe verwendet.'].filter(Boolean).join('\n');
  if(ottava.status==='rejected')warning=[warning,'Automatische Oktavzeichen nicht übernommen; ursprüngliche Notation erhalten.'].filter(Boolean).join('\n');
  warning=[diagnostics.warnings.length?'Compilerwarnungen:\n'+diagnostics.warnings.join('\n'):'',warning].filter(Boolean).join('\n');
  return {diagnostics,...(displayCode?{code:displayCode}:{}),ottava,url,midiTimingPolicy:url?MIDI_TIMING_POLICY:'',label:'MIDI-Datei',pages,logs,warning,rangeCheck,registerCheck,expressionPlayback:{mode:performance.mode,scores:performance.scores||0,trillPolicy:performance.mode==='articulate'?'musical-v2':null,arpeggioPolicy:performance.mode==='articulate'?'rolled-chord-v1':null,voiceTimingPolicy:performance.mode==='articulate'?'independent-voices-v1':null,error:performance.warning||''},instrumentLabels:'first-system-only',addedMidiBlock:prepared.added,durationMs:Date.now()-started};
 }catch(e){return {error:String(e.message||e),durationMs:Date.now()-started}}
}
async function repairOctaves(env,code,title,runId,compiled,task=''){
 const started=Date.now();let local,checked,error;
 try{
  local=automaticOctaveRepair(code,compiled.rangeCheck?.instruments,compiled.registerCheck?.issues||[]);
  if(local.error)throw Error(local.error);
  checked=await compileLilyMidi(env,local.code,title,runId,task);
  await log(env,'korrekturpruefung',runId,{operation:'octave-repair',method:local.method,paidCalls:0,notes:local.notes,changes:local.changes??null,source:local.code,...checked});
  if(checked.error||!checked.url||checked.rangeCheck?.status!=='passed'||checked.registerCheck?.status==='warning')throw Error(checked.error||checked.warning||'MIDI-Prüfung nicht bestanden.');
  checked.repair='Oktavlagen quellenbezogen korrigiert und MIDI erneut geprüft. Keine KI-Aufrufe, keine KI-Kosten.';
  await log(env,'korrektur',runId,{operation:'octave-repair',method:local.method,accepted:true,paidCalls:0,durationMs:Date.now()-started});
  return {code:checked.code||local.code,compiled:checked,cost:0};
 }catch(e){error=e.message;}
 await log(env,'korrektur',runId,{operation:'octave-repair',method:local?.method||'source-octave-repair',accepted:false,paidCalls:0,error,durationMs:Date.now()-started});
 return {code,compiled:{...compiled,repairFailed:true,warning:[compiled.warning,error,'Original erhalten. Kein KI-Korrekturaufruf gestartet.'].filter(Boolean).join('\n')},cost:0};
}

async function handle(req,env,ctx){
 const url=new URL(req.url),p=url.pathname;
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==url.origin)return json({error:'Unzulässiger Ursprung.'},403);
 if(req.method==='GET'&&p==='/')return text(PAGE,'text/html; charset=utf-8');
 if(req.method==='GET'&&p==='/sw.js')return text("self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));\nself.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));\n// Always use the network: no cache of private API data or old UI versions.\nself.addEventListener('fetch',event=>{\n if(event.request.method!=='GET'||event.request.mode!=='navigate')return;\n event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang=\"de\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>LilyPond Composition Lab</title><body style=\"font:18px system-ui;padding:24px\"><h1>LilyPond Composition Lab</h1><p>Keine Internetverbindung. Bitte die Verbindung wiederherstellen und die App erneut \u00f6ffnen.</p><button onclick=\"location.reload()\">Erneut versuchen</button></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));\n});\n",'text/javascript; charset=utf-8',{'Service-Worker-Allowed':'/'});
 if(req.method==='GET'&&p==='/favicon.svg')return text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#24364b"/><path d="M20 42V20h24v22M20 24h24" fill="none" stroke="#a7ccff" stroke-width="5"/><circle cx="14" cy="44" r="8" fill="#a7ccff"/><circle cx="38" cy="44" r="8" fill="#a7ccff"/></svg>','image/svg+xml');
 if(req.method==='GET'&&p==='/manifest.webmanifest')return text(JSON.stringify({id:'/',name:'LilyPond Composition Lab',short_name:'LilyPond Composition Lab',lang:'de',start_url:'/',scope:'/',display:'standalone',display_override:['standalone'],background_color:'#182231',theme_color:'#182231',prefer_related_applications:false,icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]}),'application/manifest+json');
 if(req.method==='GET'&&ASSETS[p])return text(asset(p),ASSETS[p].type);
 if(!env.BUCKET)return json({error:'Datenspeicher derzeit nicht verfügbar. Bitte später erneut versuchen.'},503);

 if(req.method==='GET'&&p==='/api/soundfont'){
  const stored=await getJson(env,'settings/soundfont.json');return json(stored?{name:stored.name,bytes:stored.bytes,savedAt:stored.savedAt,url:'/api/soundfont/file'}:{name:'TimGM6mb',url:'/TimGM6mb.sf2',standard:true});
 }
 if(req.method==='GET'&&p==='/api/soundfont/file'){
  const stored=await getJson(env,'settings/soundfont.json'),file=stored?await env.BUCKET.get(stored.key):null;
  if(!file)return json({error:'Gespeicherter SoundFont nicht gefunden.'},404);
  return text(file.body,'application/octet-stream');
 }
 if(req.method==='POST'&&p==='/api/soundfont'){
  const buffer=await req.arrayBuffer();
  const data=new Uint8Array(buffer),tag=at=>String.fromCharCode(...data.subarray(at,at+4));
  if(data.length<12||tag(0)!=='RIFF'||tag(8)!=='sfbk'||new DataView(buffer).getUint32(4,true)+8!==data.length)return json({error:'Bitte eine vollständige SF2-Datei wählen.'},400);
  const view=new DataView(buffer),lists=new Set();let at=12;
  while(at+8<=data.length){const size=view.getUint32(at+4,true),end=at+8+size;if(end>data.length)return json({error:'Unvollständige SF2-Datei.'},400);if(tag(at)==='LIST'&&size>=4)lists.add(tag(at+8));at=end+(size%2);}
  if(at!==data.length||!['INFO','sdta','pdta'].every(t=>lists.has(t)))return json({error:'Die Datei enthält keine vollständige SoundFont-Struktur.'},400);

  const name=decodeURIComponent(req.headers.get('X-SoundFont-Name')||'Eigener SoundFont').replace(/[\x00-\x1f\x7f]/g,'').slice(0,200)||'Eigener SoundFont';
  const old=await getJson(env,'settings/soundfont.json'),key='soundfonts/'+randomUUID()+'.sf2',savedAt=new Date().toISOString();
  await env.BUCKET.put(key,data,{httpMetadata:{contentType:'application/octet-stream'}});
  try{await putJson(env,'settings/soundfont.json',{name,bytes:data.length,key,savedAt});}catch(e){await env.BUCKET.delete(key);throw e;}
  if(old?.key)try{await env.BUCKET.delete(old.key);}catch{}
  return json({name,bytes:data.length,savedAt,url:'/api/soundfont/file'});
 }
 if(p==='/api/soundfont/upload'){
  try{return json(await soundfontUpload(req,env.BUCKET));}catch(e){return json({error:e.message||'SoundFont-Upload fehlgeschlagen.'},e.status||500);}
 }
 if(req.method==='DELETE'&&p==='/api/soundfont'){
  const old=await getJson(env,'settings/soundfont.json');await env.BUCKET.delete('settings/soundfont.json');if(old?.key)try{await env.BUCKET.delete(old.key);}catch{}
  return json({name:'TimGM6mb',url:'/TimGM6mb.sf2',standard:true});
 }
 const runIO={read:name=>getJson(env,name),write:(name,data)=>putJson(env,name,data),log:(event,id,data)=>log(env,event,id,data),restore:id=>restorePartial(env,id)};
 if(req.method==='POST'&&p==='/api/run-stream'){
  const b=await body(req),id=historyId(b.runId);if(!id)return json({error:'Ungültige Auftragskennung.'},400);
  const copy=new Request(req.url,{method:'POST',headers:req.headers,body:JSON.stringify(b)});
  return streamRun(copy,env,ctx,id,run,runIO);
 }
 if(req.method==='GET'&&p==='/api/run-status'){
  const id=historyId(url.searchParams.get('runId'));if(!id)return json({error:'Ungültige Auftragskennung.'},400);
  const session=await readRunSession(id,runIO);return session?json(session):json({status:'unknown',runId:id});
 }
 if(req.method==='POST'&&p==='/api/client-events'){
  const b=await body(req),id=historyId(b.runId);if(!id)return json({error:'Ungültige Auftragskennung.'},400);
  const allowed=new Set(['network_error','api_error','stream_error','offline','online','recovery_started','recovery_completed','recovery_stopped','page_restored','browser_error']);
  for(const e of (Array.isArray(b.events)?b.events:[]).slice(0,30))if(allowed.has(e.event)){
   const message=String(e.message||'').slice(0,500).replace(/sk-[A-Za-z0-9_-]+/g,'[API-Schlüssel]');
   await log(env,'browser_ereignis',id,{browserEvent:e.event,message,clientDate:String(e.date||'').slice(0,40),online:typeof e.online==='boolean'?e.online:null});
  }
  return json({saved:true});
 }

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
 if(req.method==='GET'&&p==='/api/midi-status'){try{await rendererReady();return json({lilypondInstalled:true,soundfont:'TimGM6mb.sf2',conversion:'LilyPond über Hacklily'})}catch{return json({lilypondInstalled:false})}}
 if(req.method==='POST'&&p==='/api/export-musicxml'){
  const b=await body(req),code=clean(b.code),runId=historyId(b.runId)||randomUUID().replaceAll('-',''),started=Date.now();
  let logs='';
  try{
   const capture=musicXmlCapture(code);
   const rendered=await rpc('render',{backend:'svg',src:capture,version:'stable'});
   logs=String(rendered.logs||'');
   const compilerLog=logs.replace(/LABXML-BEGIN.*?LABXML-END/gs,'');
   const diagnostics=compilerDiagnostics(compilerLog);
   if(rendered.err||diagnostics.status==='error')throw Error('MusicXML-Export: LilyPond konnte den Notentext nicht fehlerfrei lesen. '+String(rendered.err||''));
   const title=compositionFilename(b.title||code.match(/\btitle\s*=\s*"([^"\n]+)"/)?.[1]||'Komposition');
   const composer=code.match(/\bcomposer\s*=\s*"([^"\n]*)"/)?.[1]||'';
   const result=musicXmlScore(capturedMusic(logs),{title,composer});
   const warnings=[...result.warnings,...diagnostics.warnings];
   if(/\\repeat\b/.test(code))warnings.push('Wiederholungen sind im MusicXML ausgeschrieben.');
   const url=await saveFile(env,title,'musicxml',result.xml);
   await log(env,'musicxml-export',runId,{source:code,url,stats:result.stats,warnings,paidCalls:0,durationMs:Date.now()-started});
   return json({url,label:'MusicXML',stats:result.stats,warnings,paidCalls:0});
  }catch(e){
   const error=String(e.message||e);await log(env,'musicxml-export-fehler',runId,{error,paidCalls:0,durationMs:Date.now()-started});
   return json({error,warnings:compilerDiagnostics(logs.replace(/LABXML-BEGIN.*?LABXML-END/gs,'')).warnings},422);
  }
 }
 if(req.method==='POST'&&p==='/api/compile-lilypond'){
  const b=await body(req),submittedCode=clean(b.code),runId=safe(b.runId||randomUUID());let code=submittedCode;if(!code.trim())return json({error:'Kein LilyPond-Code vorhanden.'},400);
  const objects=await listAll(env,'logs/'+runId+'/');
  const entries=await Promise.all(objects.map(o=>getJson(env,o.key)));
  code=removeGeneratedOttava(code,entries);
  const original=legacyOctaveOriginal(code,entries);
  if(original){
   const initial=await compileLilyMidi(env,original,compositionFilename(b.title),runId,clean(b.task));
   const recovered=await repairOctaves(env,original,compositionFilename(b.title),runId,initial,clean(b.task));
   if(!recovered.compiled.repairFailed){
    await log(env,'alte_oktavkorrektur_wiederhergestellt',runId,{paidCalls:0,originalSource:original,previousSource:code,source:recovered.code});
    return json({...recovered.compiled,code:recovered.code,repair:'Alte Einzeltonkorrektur aus dem protokollierten Original ersetzt. '+recovered.compiled.repair});
   }
  }
  let result=await compileLilyMidi(env,code,compositionFilename(b.title),runId,clean(b.task));await log(env,'kompilierung',runId,{source:code,title:compositionFilename(b.title),...result});if(result.rangeCheck?.instruments.some(x=>x.violations>0)||result.registerCheck?.status==='warning'){const fixed=await repairOctaves(env,code,compositionFilename(b.title),runId,result,clean(b.task));result={...fixed.compiled,code:fixed.code};}if(code!==submittedCode&&!result.error&&!result.code)result.code=code;return json(result,result.error?422:200);
 }
 if(req.method==='POST'&&p==='/api/repair-octaves'){
  const b=await body(req),code=clean(b.code),task=clean(b.task),title=compositionFilename(b.title),runId=safe(b.runId||randomUUID());
  if(!code.trim())return json({error:'Code erforderlich.'},400);
  let compiled=await compileLilyMidi(env,code,title,runId,task);await log(env,'kompilierung',runId,{source:code,...compiled});
  if(compiled.rangeCheck?.instruments.some(x=>x.violations>0)||compiled.registerCheck?.status==='warning'){
   const result=await repairOctaves(env,code,title,runId,compiled,task);return json({...result,runId});
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

 if(p==='/api/history-backup'&&['GET','POST'].includes(req.method)){
  const io={
   entries:async()=>Promise.all((await listAll(env,'history/')).map(o=>getJson(env,o.key))),
   workspace:()=>getJson(env,'workspace/current.json'),
   file:async url=>{const name=decodeURIComponent(url.slice(10));if(/[\\/\x00-\x1f]/.test(name))return null;const file=await env.BUCKET.get('files/'+name);return file?file.arrayBuffer():null;},
   logs:async id=>{const entries=await Promise.all((await listAll(env,'logs/'+id+'/')).map(o=>getJson(env,o.key)));return entries.filter(Boolean).sort((a,b)=>String(a.date).localeCompare(String(b.date)));},
   saveFile:(name,ext,bytes)=>saveFile(env,name,ext,bytes),
   saveEntry:entry=>saveHistory(env,entry,{restoreDates:true}),
   saveWorkspace:w=>putJson(env,'workspace/current.json',workspaceEntry(w)),
   saveLogs:async(id,entries)=>{for(const [i,entry] of entries.entries())await putJson(env,'logs/'+id+'/restored-'+i+'.json',entry);}
  };
  try{
   if(req.method==='GET')return text(JSON.stringify(await exportHistory(io)),'application/json; charset=utf-8',{'Content-Disposition':'attachment; filename="LilyPond-Verlauf-'+new Date().toISOString().slice(0,10)+'.json"'});
   const raw=await req.text();if(utf8.encode(raw).length>backupByteLimit)return json({error:'Sicherungsdatei zu groß (24 MB).'},400);
   return json(await importHistory(JSON.parse(raw),io));
  }catch(e){return json({error:e.message||'Verlaufssicherung fehlgeschlagen.'},400);}
 }

 if(req.method==='GET'&&p==='/api/history'){
  const all=await listAll(env,'history/');
  const entries=(await Promise.all(all.map(async o=>{let summary;try{summary=JSON.parse(o.customMetadata?.summary||'null')}catch{}if(!summary)return null;
   if(!Object.hasOwn(summary,'costs')){const entry=await getJson(env,o.key);return entry?historyPublic(entry):{...summary,costs:null};}
   return summary;
  }))).filter(Boolean).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));return json({entries});
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
  const entry=workspaceEntry(w);await putJson(env,'workspace/current.json',entry);return json({saved:true});
 }
 if(req.method==='GET'&&p==='/api/diagnosis'){
  const runId=safe(url.searchParams.get('runId')||''),session=await readRunSession(runId,runIO);
  const histories=await Promise.all((await listAll(env,'history/')).map(o=>getJson(env,o.key)));
  const related=histories.find(e=>e&&(e.runId===runId||e.ideaStage?.runId===runId||e.compositionStage?.runId===runId||e.correctionStages?.some(s=>s.runId===runId)||e.recoveryStages?.some(s=>s.runId===runId)));
  const relatedRunIds=[...new Set([runId,related?.ideaStage?.runId,related?.compositionStage?.runId,...(related?.correctionStages||[]).map(s=>s.runId),...(related?.recoveryStages||[]).map(s=>s.runId)].filter(Boolean))];
  const objects=(await Promise.all(relatedRunIds.map(id=>listAll(env,'logs/'+id+'/')))).flat();const entries=await Promise.all(objects.map(o=>getJson(env,o.key)));entries.sort((a,b)=>a.date.localeCompare(b.date));if(!entries.length)return json({error:'Kein Protokoll gefunden.'},404);
  const costs={composition:0,realisation:0,total:0};for(const e of entries){const c=Number(e.usage?.cost);if(Number.isFinite(c)){if(e.stage==='composition')costs.composition+=c;if(e.stage==='realisation')costs.realisation+=c;costs.total+=c}}
  return text(JSON.stringify({app:'LilyPond Composition Lab',version:VERSION,createdAt:new Date().toISOString(),runId,relatedRunIds,workflow:related?.workflow||'direct',costs,playback:{soundfont:(await getJson(env,'settings/soundfont.json'))?.name||'TimGM6mb',trillPolicy:'musical-v2',arpeggioPolicy:'rolled-chord-v1',arpeggioStart:'on-beat',trillTargetNotesPerSecond:{min:4,max:10},trillStart:'principal; explicit upper-start override',voiceTimingPolicy:'independent-voices-v1',existingMidiRequiresRecompile:true},runStatus:session?{status:session.status,phase:session.phase,startedAt:session.startedAt,updatedAt:session.updatedAt}:null,entries},null,2),'application/json; charset=utf-8',{'Content-Disposition':`attachment; filename="Diagnose-${runId}.json"`});
 }
 if(req.method==='POST'&&p==='/api/run')return run(req,env);
 return json({error:'Nicht gefunden'},404);
}

async function restorePartial(env,runId){
 const saved=await getJson(env,'checkpoints/'+runId+'.json');if(!saved)return null;
 const {input,response}=saved;let answer=response.choices?.[0]?.message?.content||'';
 if(Array.isArray(answer))answer=answer.filter(x=>x.type==='text').map(x=>x.text).join('');
 if(!answer)return null;
 const original=input.originalHistoryId?await getJson(env,'history/'+input.originalHistoryId+'.json'):null;
 let code=input.code||'';
 try{code=input.operation==='complete'?appendContinuation(code,answer):lilySource(answer);}catch{}
 if(!code)return null;
 const compiled={incomplete:true,error:'Serververarbeitung unterbrochen. Empfangener Notentext gesichert; Vervollständigung ist möglich.'};
 const costs={composition:Number(original?.costs?.composition)||Number(input.ideaStage?.cost)||0,realisation:Number(original?.costs?.realisation)||0};
 costs[input.operation==='complete'?'realisation':'composition']+=Number(response.usage?.cost)||0;
 const entry={...original,...input,compositionStage:input.operation==='complete'?original?.compositionStage:stageRecord({runId,model:input.model,actualModel:response.model,answer,usage:response.usage,finishReason:'interrupted',cost:response.usage?.cost}),id:runId,runId,techout:code,compositionModel:input.model,compositionReasoning:input.compositionReasoning,format:'lilypond',costs,downloads:[],pages:[],midiUrl:'',compiler:compiled.error,recovery:{incomplete:true,originalHistoryId:input.originalHistoryId||runId,prefixLength:input.code?.length||0}};
 entry.downloads=[{label:'Unvollständige LilyPond-Datei',url:await saveFile(env,entry.title,'ly',code)}];
 await saveHistory(env,entry);
 return {...entry,historyId:runId,answer:code,rawAnswer:answer,compiled};
}
async function runCompletion(b,env,runId,started){
 let key='',entry=null,answer='',usage=null,finish='interrupted',actualModel='',cost=0;
 try{
  const id=historyId(b.historyId),original=id?await getJson(env,'history/'+id+'.json'):null;
  if(!original)throw Error('Bitte das Fragment zuerst im Verlauf speichern.');
  const code=clean(b.code);if(code!==original.techout)throw Error('Der Notentext wurde geändert. Bitte zuerst speichern und erneut fortsetzen.');
  if(!sourceStatus(code).canContinue)throw Error('Kein sicher fortsetzbares Fragment vorhanden.');
  if(sourceStatus(code).complete&&!original.recovery?.incomplete)throw Error('Das Dokument ist bereits vollständig. Für Änderungen bitte die gezielte Korrektur verwenden.');
  const model=clean(b.model).trim();if(!model.includes('/'))throw Error('Bitte ein Modell auswählen.');
  key=normalizeKey(b.key||await storedKey(env));await checkKey(key);
  try{await rendererReady()}catch(e){return json({error:e.message+' Keine KI wurde aufgerufen.',runId},412);}
  const quality=qualityChoice(b.compositionReasoning),messages=continuationMessages(code,original.task),reasoning=reasoningFor(quality,model),max_tokens=Math.min(64000,Math.max(500,Number(b.maxTokens)||64000));
  entry={...original,id:runId,runId,downloads:[],pages:[],midiUrl:'',midiTimingPolicy:'',recovery:{incomplete:true,originalHistoryId:id,prefixLength:code.length}};
  await saveHistory(env,entry);
  await log(env,'anfrage',runId,{stage:'realisation',operation:'complete',model,messages,max_tokens,originalHistoryId:id,reasoning_requested:reasoning||'provider_default'});
  const input={operation:'complete',model,compositionReasoning:quality,task:original.task,title:original.title,code,originalHistoryId:id};
  const r=await upstream('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:routerHeaders(key),redirect:'manual',body:JSON.stringify({model,messages,max_tokens,stream:true,usage:{include:true},...(reasoning?{reasoning}:{})})});rejectRedirect(r);
  const response=await readCompositionResponse(r,{checkpoint:response=>putJson(env,'checkpoints/'+runId+'.json',{input,response,updatedAt:new Date().toISOString()})});
  if(!r.ok)throw Error(response.error?.message||'OpenRouter HTTP '+r.status);
  answer=response.choices?.[0]?.message?.content||'';if(Array.isArray(answer))answer=answer.filter(x=>x.type==='text').map(x=>x.text).join('');
  usage=response.usage||null;finish=response.error?'error':response.choices?.[0]?.finish_reason||'interrupted';actualModel=response.model||model;cost=Number(usage?.cost)||0;
  entry.costs=compositionCosts({composition:Number(original.costs?.composition)||0,realisation:(Number(original.costs?.realisation)||0)+cost});
  const stage=stageRecord({runId,model,actualModel,quality,task:original.task,system:messages[0].content,answer,usage,finishReason:finish,cost,durationMs:Date.now()-started});
  entry.recoveryStages=[...(original.recoveryStages||[]),stage];
  await log(env,'antwort',runId,{stage:'realisation',operation:'complete',model,actualModel,answer,usage,finish_reason:finish});
  entry.techout=appendContinuation(code,answer);
  await saveHistory(env,entry);
  const status=sourceStatus(entry.techout,finish);
  const compiled=status.complete?await compileLilyMidi(env,entry.techout,entry.title,runId,entry.task):{incomplete:true,error:status.reason+'. Fortsetzung gesichert; erneut vervollständigen.'};
  if(status.complete&&!compiled.error){
   try{
    const captured=await rpc('render',{backend:'svg',src:musicXmlCapture(entry.techout),version:'stable'});
    if(captured.err||compilerDiagnostics(captured.logs).status==='error')throw Error('Musikstruktur konnte nicht fehlerfrei geprüft werden.');
    compiled.completeness=scoreCompleteness(capturedMusic(captured.logs));
   }catch(e){compiled.incomplete=true;compiled.error='Vervollständigung nicht bestätigt: '+e.message;}
  }
  // Render ottavas without rewriting the protected source.
  delete compiled.code;
  if(compiled.error||!compiled.url||compiled.diagnostics?.status==='warning'){
   compiled.incomplete=true;compiled.error||='Vervollständigung noch nicht vollständig geprüft. Compilerhinweise beachten.';
  }
  entry.recovery.incomplete=!!compiled.incomplete;
  entry.compiler=[compiled.error,compiled.warning,compiled.logs].filter(Boolean).join('\n');entry.pages=compiled.pages||[];entry.midiUrl=compiled.url||'';entry.midiTimingPolicy=compiled.midiTimingPolicy||'';
  entry.downloads=[{label:compiled.incomplete?'Unvollständige LilyPond-Datei':'LilyPond-Datei',url:await saveFile(env,entry.title,'ly',entry.techout)},...(compiled.url?[{label:'MIDI-Datei',url:compiled.url}]:[])];
  await saveHistory(env,entry);await putJson(env,'workspace/current.json',workspaceEntry({...entry,historyId:entry.id}));
  await log(env,'kompilierung',runId,{operation:'complete',source:entry.techout,prefixUnchanged:entry.techout.startsWith(code),prefixLength:code.length,...compiled});
  return json({...entry,operation:'complete',historyId:entry.id,answer:entry.techout,rawAnswer:answer,compiled,usage,finish_reason:finish,durationMs:Date.now()-started});
 }catch(e){
  const error=String(e.message||e).replaceAll(key||'\u0000','[API-Schlüssel]');
  await log(env,'fehler',runId,{operation:'complete',error,answer,usage,finish_reason:finish});
  if(entry){
   entry.compiler=error;entry.downloads=[{label:'Gesichertes Fragment',url:await saveFile(env,entry.title,'ly',entry.techout)}];await saveHistory(env,entry);
   return json({...entry,operation:'complete',historyId:entry.id,answer:entry.techout,rawAnswer:answer,compiled:{incomplete:true,error},usage,durationMs:Date.now()-started});
  }
  return json({error,runId},400);
 }
}

async function runConcept(b,env,runId,started){
 let key='';
 try{
  const task=clean(b.task).trim(),model=clean(b.model).trim(),quality=qualityChoice(b.compositionReasoning);
  if(!task)throw Error('Kompositionsauftrag fehlt.');if(!model.includes('/'))throw Error('Bitte ein Modell auswählen.');
  key=normalizeKey(b.key||await storedKey(env));await checkKey(key);
  const messages=ideaMessages(task,clean(b.system)),reasoning=reasoningFor(quality,model),max_tokens=Math.min(8000,Math.max(500,Number(b.maxTokens)||8000));
  await log(env,'anfrage',runId,{stage:'composition',operation:'concept',model,messages,max_tokens,reasoning_requested:reasoning||'provider_default'});
  const r=await upstream('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:routerHeaders(key),redirect:'manual',body:JSON.stringify({model,messages,max_tokens,stream:false,usage:{include:true},...(reasoning?{reasoning}:{})})});
  rejectRedirect(r);const response=await r.json();if(!r.ok){const e=Error(response.error?.message||'OpenRouter HTTP '+r.status);e.status=r.status;throw e;}
  let answer=response.choices?.[0]?.message?.content;if(Array.isArray(answer))answer=answer.filter(x=>x.type==='text').map(x=>x.text).join('\n');answer=typeof answer==='string'?answer.trim():'';
  const usage=response.usage||null,finishReason=response.choices?.[0]?.finish_reason||'',durationMs=Date.now()-started;
  await log(env,'antwort',runId,{stage:'composition',operation:'concept',model,actualModel:response.model||model,answer,usage,finish_reason:finishReason,durationMs});
  if(!answer)throw Error('Die KI lieferte keine Klangvorstellung.');
  const ideaStage=stageRecord({runId,model,actualModel:response.model||model,quality,task,system:messages[0].content,answer,usage,finishReason,cost:Number(usage?.cost)||0,durationMs});
  const entry={workflow:'concept',draft:answer,ideaStage,compositionStage:null,title:clean(b.title)||'Unbenannte Komposition',task,system:clean(b.system),techout:'',compositionModel:model,actualCompositionModel:ideaStage.actualModel,compositionReasoning:quality,format:'lilypond',runId,costs:{composition:ideaStage.cost,realisation:0},tokens1:Number(b.maxTokens)||64000,downloads:[],pages:[],midiUrl:''};
  const saved=await saveHistory(env,entry);await putJson(env,'workspace/current.json',{...entry,id:saved.id,historyId:saved.id});
  return json({operation:'concept',...entry,historyId:saved.id,durationMs,warning:finishReason==='length'?'Die Klangvorstellung wurde am Ausgabelimit abgeschnitten. Bitte vor dem Fortsetzen bearbeiten.':''});
 }catch(e){const error=String(e.message||e).replaceAll(key||'\u0000','[API-Schlüssel]');await log(env,'fehler',runId,{operation:'concept',error,durationMs:Date.now()-started});return json({error,runId},e.status===401?401:502);}
}

async function runCorrection(b,env,runId,started){
 let key='';
 try{
  const code=clean(b.code),model=clean(b.model).trim(),id=historyId(b.historyId);
  if(!code.trim()||code.length>200000)throw Error('Bitte einen gültigen LilyPond-Code öffnen.');
  if(!model.includes('/'))throw Error('Bitte ein Modell auswählen.');
  const original=id?await getJson(env,'history/'+id+'.json'):null;
  if(!original)throw Error('Bitte das Stück zuerst im Verlauf speichern.');
  key=normalizeKey(b.key||await storedKey(env));await checkKey(key);
  try{await rendererReady()}catch(e){return json({error:e.message+' Keine KI wurde aufgerufen.',runId},412)}
  const system=clean(b.system)||DEFAULT_SYSTEM,task=clean(b.task),quality=qualityChoice(b.compositionReasoning);
  const notes=clean(b.diagnostics).trim();if(!notes)throw Error('Bitte Compilerfehler oder einen konkreten Korrekturhinweis angeben.');
  const messages=correctionMessages(task,system,code,notes),max_tokens=Math.min(64000,Math.max(500,Number(b.maxTokens)||64000)),reasoning=reasoningFor(quality,model);
  await log(env,'anfrage',runId,{stage:'realisation',operation:'repair',model,messages,max_tokens,originalHistoryId:id,source:code,reasoning_requested:reasoning||'provider_default'});
  const r=await upstream('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:routerHeaders(key),redirect:'manual',body:JSON.stringify({model,messages,max_tokens,stream:true,usage:{include:true},...(reasoning?{reasoning}:{})})});rejectRedirect(r);
  const response=await readCompositionResponse(r,{checkpoint:response=>putJson(env,'checkpoints/'+runId+'.json',{input:{operation:'repair',model,task,title:original.title,compositionReasoning:quality,originalHistoryId:id},response,updatedAt:new Date().toISOString()})});if(!r.ok)throw Error(response.error?.message||'OpenRouter HTTP '+r.status);
  let answer=response.choices?.[0]?.message?.content;if(Array.isArray(answer))answer=answer.filter(x=>x.type==='text').map(x=>x.text).join('\n');answer=typeof answer==='string'?answer:'';
  const usage=response.usage||null,finish=response.error?'error':response.choices?.[0]?.finish_reason||null,actualModel=clean(response.model)||model,cost=Number(usage?.cost)||0;
  await log(env,'antwort',runId,{stage:'realisation',operation:'repair',model,actualModel,answer,usage,finish_reason:finish,durationMs:Date.now()-started});
  const correctionStage=stageRecord({runId,model,actualModel,quality,task,system:messages[0].content,answer,usage,finishReason:finish,cost,durationMs:Date.now()-started});
  let corrected=answer.trim().replace(/^```(?:lilypond|ly)?\s*\n/i,'').replace(/\n```\s*$/,'').trim();
  if(sourceStatus(corrected,finish).complete)corrected=compositionAttribution(corrected,actualModel);
  const base={...original,id:undefined,createdAt:undefined,updatedAt:undefined,task,system,runId,techout:corrected,compositionModel:model,actualCompositionModel:actualModel,compositionReasoning:quality,correctionStages:[...(original.correctionStages||[]),correctionStage],costs:{composition:Number(original.costs?.composition)||0,realisation:(Number(original.costs?.realisation)||0)+cost},downloads:[],pages:[],midiUrl:''};
  const saved=await saveHistory(env,base);
  const downloads=corrected?[{label:'LilyPond',url:await saveFile(env,base.title,'ly',corrected)}]:[];
  const compiled=!sourceStatus(corrected,finish).complete?{error:'Unvollständige KI-Korrektur: '+sourceStatus(corrected,finish).reason+'. Original im Verlauf erhalten.',incomplete:true}:corrected?await compileLilyMidi(env,corrected,compositionFilename(base.title),runId,task):{error:'Die KI lieferte keinen LilyPond-Code.'};
  if(compiled.incomplete)base.recovery={incomplete:true,originalHistoryId:id};
  await log(env,'kompilierung',runId,{operation:'repair',source:corrected,...compiled});
  if(compiled.code)corrected=compiled.code;
  if(compiled.code)downloads[0]={label:'LilyPond',url:await saveFile(env,base.title,'ly',corrected)};
  if(compiled.url)downloads.push({label:'MIDI-Datei',url:compiled.url});
  const entry={...base,id:saved.id,techout:corrected,downloads,pages:compiled.pages||[],midiUrl:compiled.url||'',midiTimingPolicy:compiled.midiTimingPolicy||'',compiler:[compiled.error,compiled.warning,compiled.logs].filter(Boolean).join('\n')};
  await saveHistory(env,entry);await putJson(env,'workspace/current.json',workspaceEntry({...entry,historyId:saved.id}));
  return json({...entry,operation:'repair',historyId:saved.id,answer:corrected,rawAnswer:answer,compiled,usage,finish_reason:finish,durationMs:Date.now()-started});
 }catch(e){const error=String(e.message||e).replaceAll(key||'\u0000','[API-Schlüssel]');await log(env,'fehler',runId,{operation:'repair',error});return json({error,runId},e.status===401?401:502)}
}

async function run(req,env){
 const b=await body(req),runId=safe(b.runId||randomUUID().replaceAll('-','')),started=Date.now();
 if(b.operation==='complete')return runCompletion(b,env,runId,started);
 if(b.operation==='repair')return runCorrection(b,env,runId,started);
 if(b.operation==='concept')return runConcept(b,env,runId,started);
 let key='',conceptEntry=null;
 try{
  if(b.workflow==='concept'){
   const id=historyId(b.historyId);conceptEntry=id?await getJson(env,'history/'+id+'.json'):null;
   if(!conceptEntry?.ideaStage||conceptEntry.compositionStage||!clean(b.draft).trim())throw Error('Bitte eine gespeicherte Klangvorstellung öffnen oder neu entwickeln.');
   // Keep the edited intermediate result even if the next provider call fails.
   conceptEntry={...conceptEntry,draft:clean(b.draft),task:clean(b.task),system:clean(b.system)};await saveHistory(env,conceptEntry);
  }
  key=normalizeKey(b.key||await storedKey(env));await checkKey(key);const model=clean(b.model).trim();
  if(!model.includes('/'))throw Error('Bitte ein Modell auswählen.');
  const task=clean(b.task);if(!task.trim())throw Error('Kompositionsauftrag fehlt.');
  try{await rendererReady()}catch(e){await log(env,'kostenstopp',runId,{error:e.message,durationMs:Date.now()-started});return json({error:e.message+' Keine KI wurde aufgerufen.',runId},412)}
  const suppliedSystem=clean(b.system).trim();
  const system=currentSystem(suppliedSystem);
  const previousTitles=[...new Set((await listAll(env,'history/')).map(o=>{try{return JSON.parse(o.customMetadata?.summary||'{}').title||''}catch{return ''}}).filter(Boolean))];
  const titleContext=[...new Set([...previousTitles,clean(b.title)].filter(t=>t&&!/^Unbenannte[ _]Komposition$/i.test(t)))];
  const requestedTokens=parseInt(b.maxTokens);
  const max_tokens=Math.min(64000,Math.max(500,!requestedTokens||requestedTokens===8000?64000:requestedTokens));
  const messages=compositionMessages(task,system,conceptEntry?clean(b.draft):'');
  const compositionReasoning=qualityChoice(b.compositionReasoning);
  const reasoning=reasoningFor(compositionReasoning,model);
  const payload={model,messages,max_tokens,stream:true,usage:{include:true},...(reasoning?{reasoning}:{})};
  await log(env,'anfrage',runId,{stage:'composition',model,title:clean(b.title),max_tokens,messages,reasoning_requested:reasoning||'provider_default'});
  const r=await upstream('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:routerHeaders(key),redirect:'manual',body:JSON.stringify(payload)});
  rejectRedirect(r);
  const checkpointInput={task,system,model,compositionReasoning,maxTokens:max_tokens,title:clean(b.title),historyId:conceptEntry?.id||'',workflow:conceptEntry?'concept':'direct',draft:conceptEntry?.draft||'',ideaStage:conceptEntry?.ideaStage||null};
  const response=await readCompositionResponse(r,{checkpoint:response=>putJson(env,'checkpoints/'+runId+'.json',{input:checkpointInput,response,updatedAt:new Date().toISOString()})});
  if(!r.ok){const e=Error([401,403].includes(r.status)?'OpenRouter hat die Anmeldung abgelehnt. Bitte den Schlüssel unter Verbindung prüfen.':response.error?.message||'OpenRouter HTTP '+r.status);e.status=r.status;e.providerError=response.error?.message;throw e;}
  let answer=response.choices?.[0]?.message?.content;
  if(Array.isArray(answer))answer=answer.filter(x=>x.type==='text').map(x=>x.text).join('\n');
  answer=typeof answer==='string'?answer:'';
  let code=lilySource(answer);
  const proposedTitle=compositionFilename(code.match(/\btitle\s*=\s*"([^"\n]+)"/)?.[1]||'Komposition');
  const titleKey=t=>compositionFilename(t).toLocaleLowerCase('de').replace(/\s*(?:[·–—-]\s*)?\(?\d+\)?\s*$/,'').trim();
  const usedKeys=new Set(titleContext.map(titleKey));
  let title=proposedTitle,titleWarning='',titleCost=0;
  const actualCompositionModel=clean(response.model).trim()||model;
  const usage=response.usage?{...response.usage}:null,finish=response.error?'error':response.choices?.[0]?.finish_reason||null;
  await log(env,'antwort',runId,{stage:'composition',model,answer,usage,finish_reason:finish,durationMs:Date.now()-started});
  if(sourceStatus(code,finish).complete)code=compositionAttribution(code,actualCompositionModel);
  const downloads=[];
  const compositionStage=stageRecord({runId,model,actualModel:actualCompositionModel,quality:compositionReasoning,task,system:messages[0].content,answer,finishReason:finish,usage,cost:Number(usage?.cost)||0,durationMs:Date.now()-started});
  const base={...workflowFields(conceptEntry),compositionStage,id:conceptEntry?.id,draft:conceptEntry?.draft||'',title:compositionFilename(title),task,system,techout:code,compositionModel:model,actualCompositionModel,format:'lilypond',runId,downloads,costs:{composition:(Number(conceptEntry?.costs?.composition)||0)+(Number(usage?.cost)||0),realisation:Number(conceptEntry?.costs?.realisation)||0},tokens1:max_tokens,compositionReasoning};
  // Persist the composition before naming or compiling; raw answer stays in diagnosis.
  const saved=await saveHistory(env,base);
  if(!sourceStatus(code,finish).complete){
   const compiled={error:'Unvollständige KI-Antwort: '+sourceStatus(code,finish).reason+'. Notentext gesichert. Mit „Komposition vervollständigen“ fortsetzen.',incomplete:true};
   base.recovery={incomplete:true,originalHistoryId:saved.id};
   if(code)downloads.push({label:'Unvollständige LilyPond-Datei',url:await saveFile(env,title,'ly',code)});
   const entry={...base,id:saved.id,compiler:compiled.error,pages:[],midiUrl:''};
   await saveHistory(env,entry);await putJson(env,'workspace/current.json',{...entry,historyId:saved.id});
   await log(env,'ausgabelimit',runId,{max_tokens,warning:compiled.error});
   return json({...entry,...workflowFields(base),draft:base.draft,runId,historyId:saved.id,title:entry.title,answer:code,rawAnswer:answer,downloads,usage,costs:base.costs,finish_reason:finish,compiled,durationMs:Date.now()-started});
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
  base.title=title;base.techout=code;base.costs.composition+=titleCost;compositionStage.cost+=titleCost;compositionStage.durationMs=Date.now()-started;if(compositionStage.usage)compositionStage.usage.cost=compositionStage.cost;
  let compiled=code?await compileLilyMidi(env,code,title,runId,task):{error:'Die KI lieferte keinen LilyPond-Code.'};
  if(compiled.code){code=compiled.code;base.techout=code;}
  await log(env,'kompilierung',runId,{source:code,...compiled});
  if(compiled.rangeCheck?.instruments.some(x=>x.violations>0)||compiled.registerCheck?.status==='warning'){
   const repaired=await repairOctaves(env,code,title,runId,compiled,task);
   code=repaired.code;compiled=repaired.compiled;base.techout=code;base.costs.realisation+=repaired.cost;
  }
  if(code)downloads.push({label:'LilyPond-Datei',url:await saveFile(env,title,'ly',code)});
  if(compiled.url)downloads.push({label:'MIDI-Datei',url:compiled.url});
  const entry={...base,id:saved.id,downloads,midiUrl:compiled.url||'',midiTimingPolicy:compiled.midiTimingPolicy||'',pages:compiled.pages||[],compiler:[compiled.error,compiled.warning,compiled.repair,compiled.logs].filter(Boolean).join('\n')};
  await saveHistory(env,entry);await putJson(env,'workspace/current.json',{...entry,historyId:saved.id});
  return json({...entry,...workflowFields(base),draft:base.draft,runId,historyId:saved.id,title:entry.title,answer:code,rawAnswer:answer,downloads,usage,costs:base.costs,titleWarning,finish_reason:finish,compiled,durationMs:Date.now()-started});
 }catch(e){const error=String(e.message||e).replaceAll(key||'\u0000','[API-Schlüssel]');await log(env,'fehler',runId,{error,status:e.status||null,providerError:e.providerError?.replaceAll(key||'\u0000','[API-Schlüssel]')||null,durationMs:Date.now()-started});return json({error,runId},e.status===401?401:502)}
}
export default {async fetch(request,env,ctx){try{return await handle(request,env,ctx)}catch(e){return json({error:e.name==='AbortError'?'Zeitüberschreitung beim Onlinedienst.':String(e.message||e)},e.status||500)}}};
