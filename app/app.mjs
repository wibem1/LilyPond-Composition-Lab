import {workflowChoice,OCTAVE_RULE} from '/composition-workflow.mjs';
import {compositionCosts,costLabel} from '/composition-costs.mjs';
import {SoundFontPlayer} from '/soundfont-player.mjs';
import {RunClient} from '/run-client.mjs';
import {SoundFontCache} from '/soundfont-cache.mjs';
const $=id=>document.getElementById(id);
const ORIGINAL_SYSTEM='Komponiere nach dem Auftrag direkt ein vollständiges LilyPond-Dokument. Entwickle musikalisch eigenständiges Material, passende Stimmenführung, Phrasierung und einen nachvollziehbaren Spannungsbogen. Beachte die gewünschte Besetzung und Länge. Verwende einen Titel im Header, Tempo, layout und midi im score-Block sowie passende midiInstrument-Angaben. Antworte ausschließlich mit LilyPond-Code ohne Markdown und Erläuterungen. Es gibt keinen vorgeschalteten Entwurf.';
const TECHNICAL_SYSTEM='Komponiere nach dem Auftrag direkt ein vollständiges LilyPond-Dokument. Entwickle musikalisch eigenständiges Material, passende Stimmenführung, Phrasierung und einen nachvollziehbaren Spannungsbogen. Beachte die gewünschte Besetzung und Länge. Verwende einen Titel im Header, Tempo, layout und midi im score-Block sowie passende midiInstrument-Angaben. Antworte ausschließlich mit LilyPond-Code ohne Markdown und Erläuterungen. Es gibt keinen vorgeschalteten Entwurf. Technische Notation: Verwende absolute Tonhöhen mit ausdrücklich angegebenen Oktaven (ohne \\relative). Prüfe die tatsächlichen Oktavlagen; Verwende für jedes Instrument dessen spielbaren klingenden Tonumfang; für Klavier A0 bis C8. Diese Notationsregel macht keine Vorgaben zur musikalischen Gestaltung.';
const LEGACY_SYSTEM=ORIGINAL_SYSTEM+' Notiere die musikalisch sinnvollen Ausdruckszeichen direkt in der Partitur: Dynamik und ihre Verläufe, Artikulation und Phrasierungsbögen, zum Instrument passende Pedalangaben sowie Tempoveränderungen. Verwende Verzierungen, wenn sie musikalisch passen.';
const SYSTEM=LEGACY_SYSTEM+OCTAVE_RULE;
$('system').value=SYSTEM;
const player=new SoundFontPlayer();let catalog=[],busy=false,ready=false,loading=false,timer,saveChain=Promise.resolve(),restoring=true,modelChoice='',selectedFont=null,fontRevision=0,fontRestore=null;
let state={workflow:'direct',ideaStage:null,compositionStage:null,historyId:'',runId:'',costs:{composition:0,realisation:0},downloads:[],midiUrl:'',pages:[],compiler:''};
async function api(path,data,method){try{const r=await fetch(path,{method:method||(data?'POST':'GET'),headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const d=await r.json();if(!r.ok){const e=Error(d.error||'HTTP '+r.status);e.details=d;throw e;}return d;}catch(e){runClient.record(runClient.pendingRunId||state.runId,e instanceof TypeError||e.name==='AbortError'?'network_error':'api_error',path+': '+e.message);throw e;}}
function payload(){return {...state,id:state.historyId,title:$('title').value,task:$('task').value,system:$('system').value,techout:$('code').value,draft:$('draft').value,workflow:$('workflow').value,format:'lilypond',tokens1:$('tokens').value,compositionReasoning:$('compositionReasoning').value,compositionModel:$('model').value||modelChoice,realisationModel:'',compiler:$('compiler').textContent};}
function queueSave(){if(restoring)return;clearTimeout(timer);timer=setTimeout(()=>persist(),550);}
function persist(){if(restoring||runClient.pendingRunId)return Promise.resolve();const workspace=payload();saveChain=saveChain.catch(()=>{}).then(()=>api('/api/workspace',{workspace})).then(async()=>{if(workspace.workflow==='concept'&&workspace.draft&&workspace.historyId)await api('/api/history',workspace);$('memoryStatus').textContent='Letzter Arbeitsstand gespeichert.'}).catch(e=>{$('memoryStatus').textContent='Arbeitsstand konnte nicht gespeichert werden: '+e.message;throw e});return saveChain;}
function setBusy(v){busy=v;for(const id of ['compose','continueComposition','compile','new','import','openHistory','deleteHistory','saveHistory','backupHistory','restoreHistory','workflow','provider','model','compositionReasoning','task','system','tokens','draft'])$(id).disabled=v;renderWorkflow();}
function message(s){$('status').textContent=s;}
const runClient=new RunClient({onprogress:message});
const fontCache=new SoundFontCache({onwarning:e=>runClient.record(state.runId,'soundfont_cache_error',e.message)});
let preparedFont=null,preparedFontVersion='',fontPreparing=null;
function prepareSoundFont(font){
 const revision=fontRevision,version=fontCache.version(font);
 const job=fontCache.prepare(font,p=>{
  if(revision!==fontRevision||player.sf)return;
  const percent=p.total?Math.min(100,Math.round(p.received/p.total*100)):null;
  $('playerStatus').textContent=p.ready?'Klang bereit: '+font.name+(p.local?' · lokal gespeichert':''):'SoundFont wird geladen: '+font.name+(percent===null?'':' · '+percent+' %');
 }).then(blob=>{if(revision===fontRevision){preparedFont=blob;preparedFontVersion=version;}return blob;});
 fontPreparing=job;job.catch(e=>{if(revision===fontRevision&&!player.sf)$('playerStatus').textContent='SoundFont konnte nicht vorgeladen werden: '+e.message;});return job;
}
async function restoreSoundFont(){const revision=fontRevision;try{const font=await api('/api/soundfont');if(revision===fontRevision){selectedFont=font;$('playerStatus').textContent='Klang gespeichert: '+font.name;if(!font.standard)prepareSoundFont(font);}return font;}catch(e){$('playerStatus').textContent='Gespeicherter Klang konnte nicht abgerufen werden: '+e.message;return null;}}
async function saveSoundFont(buffer,name){
 const upload=await api('/api/soundfont/upload',{name,bytes:buffer.byteLength});
 const path='/api/soundfont/upload?id='+encodeURIComponent(upload.id);
 try{
  for(let at=0,part=1;at<buffer.byteLength;at+=upload.partBytes,part++){
   const r=await fetch(path+'&part='+part,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:buffer.slice(at,at+upload.partBytes)});
   const d=await r.json();if(!r.ok)throw Error(d.error||'SoundFont-Teil konnte nicht gespeichert werden.');
   $('playerStatus').textContent='SoundFont speichern: '+Math.round(d.received/d.bytes*100)+' % · '+name;
  }
  const d=await api(path,{});selectedFont=d;preparedFont=await fontCache.store(d,buffer);preparedFontVersion=fontCache.version(d);return d;
 }catch(e){await fetch(path,{method:'DELETE'}).catch(()=>{});throw e;}
}

function invalidate(){player.stop();ready=false;state.midiUrl='';state.pages=[];state.downloads=[];renderResults();$('scoreStatus').textContent='Code geändert. Bitte neu kompilieren.';queueSave();}
const qualityLabel=v=>({short:'Kurz',balanced:'Ausgewogen',default:'Modellvorgabe'}[v]||'Modellvorgabe');
function renderWorkflow(){
 const concept=$('workflow').value==='concept';
 $('compose').textContent=concept?'Klangvorstellung entwickeln':'Komponieren';
 $('conceptPanel').hidden=!concept||!$('draft').value.trim();
 $('continueComposition').hidden=!!state.compositionStage;
 $('continueComposition').disabled=busy||!$('draft').value.trim()||!state.ideaStage||!!state.compositionStage;
 const describe=(name,stage)=>name+': '+(stage.actualModel||stage.model)+' · '+qualityLabel(stage.quality)+' · $'+Number(stage.cost||0).toFixed(6)+' · '+(Number(stage.durationMs||0)/1000).toFixed(1)+' Sekunden';
 $('ideaInfo').textContent=state.ideaStage?describe('Klangvorstellung',state.ideaStage):'';
 const stages=[state.ideaStage&&describe('Klangvorstellung',state.ideaStage),state.compositionStage&&describe('Komposition',state.compositionStage)].filter(Boolean);
 $('stageDetails').hidden=!stages.length;$('stageInfo').textContent=stages.join('\n');
}
function renderResults(){
 renderWorkflow();
 $('score').replaceChildren();for(const p of state.pages||[]){const img=document.createElement('img');img.src=p.url;img.alt=p.label;img.loading='lazy';$('score').append(img)}
 $('scoreStatus').textContent=state.pages?.length?state.pages.length+' Notenseite(n).':'Noch kein aktuelles Notenbild.';
 $('downloads').replaceChildren();for(const d of state.downloads||[]){const a=document.createElement('a');a.href=d.url;a.textContent=d.label+' speichern';$('downloads').append(a)}
 for(const id of ['play','pause','stop','saveMidi','position'])$(id).disabled=!state.midiUrl||(id==='play'&&loading);
 $('diagnosis').disabled=!state.runId;$('compiler').textContent=state.compiler||'Noch nicht kompiliert.';
 $('playerTitle').textContent=state.midiUrl?$('title').value:'Noch keine aktuelle MIDI-Datei geladen.';
 $('costs').textContent='Erfasste KI-Kosten dieser Komposition: '+costLabel(state.costs)+(state.ideaStage?' · Klangvorstellung $'+Number(state.ideaStage.cost||0).toFixed(6):'');
}
function apply(e){if(Number(e.tokens1)===8000)e={...e,tokens1:64000};if(e.system===TECHNICAL_SYSTEM||e.system===ORIGINAL_SYSTEM||e.system===LEGACY_SYSTEM)e={...e,system:SYSTEM};player.stop();ready=false;state={...state,...e,...{workflow:workflowChoice(e.workflow),ideaStage:e.ideaStage||null,compositionStage:e.compositionStage||null},costs:compositionCosts(e.costs),historyId:e.historyId||e.id||'',midiUrl:e.midiUrl||'',pages:e.pages||[],downloads:e.downloads||[]};$('draft').value=e.draft||'';$('workflow').value=workflowChoice(e.workflow);for(const [id,key] of [['task','task'],['title','title'],['code','techout'],['system','system'],['tokens','tokens1'],['compositionReasoning','compositionReasoning']])if(e[key]!==undefined)$(id).value=e[key];modelChoice=e.compositionModel||modelChoice;selectModel(modelChoice);renderResults();}
function selectModel(id){const m=catalog.find(x=>x.id===id);if(!m)return;$('provider').value=m.provider;populateModels(id);}
function populateModels(preferred=''){const list=catalog.filter(x=>x.provider===$('provider').value);$('model').replaceChildren(...list.map(m=>new Option(m.name||m.id,m.id)));if(list.some(m=>m.id===preferred))$('model').value=preferred;modelChoice=$('model').value;prices();}
function prices(){const m=catalog.find(x=>x.id===$('model').value);$('price').textContent=m?`Je 1 Mio. Tokens: Eingabe $${(m.prompt*1e6).toFixed(2)} · Ausgabe $${(m.completion*1e6).toFixed(2)}. Tatsächliche Kosten stehen in der Diagnose.`:'';}
async function models(){try{const d=await api('/api/models');catalog=d.models;const providers=[...new Set(catalog.map(m=>m.provider))].sort();$('provider').replaceChildren(...providers.map(x=>new Option(x,x)));selectModel(modelChoice||catalog.find(x=>x.id.startsWith('anthropic/claude-sonnet-'))?.id||catalog[0]?.id);if(!$('model').value)populateModels();$('catalogStatus').textContent=catalog.length+' Textmodelle verfügbar.'}catch(e){$('catalogStatus').textContent='Modellkatalog: '+e.message;}}
async function refreshHistory(){const d=await api('/api/history');$('history').replaceChildren(...d.entries.map(e=>new Option(e.title+(e.workflow==='concept'?(e.hasRealisation?' · Mit Klangvorstellung':' · Klangvorstellung – fortsetzbar'):'')+(e.compositionReasoning?' · '+({short:'Kurz',balanced:'Ausgewogen',default:'Modellvorgabe'}[e.compositionReasoning]||e.compositionReasoning):'')+' · '+new Date(e.updatedAt).toLocaleString('de-DE')+' · '+costLabel(e.costs),e.id)));if(state.historyId)$('history').value=state.historyId;}
async function saveHistory(){if(!$('code').value.trim()&&!$('draft').value.trim())return;const d=await api('/api/history',payload());state.historyId=d.entry.id;await refreshHistory();await persist();}
async function compiledResult(d){ready=false;player.stop();state.midiUrl=d.url||'';state.pages=d.pages||[];state.compiler=[d.error,d.warning,d.repair,d.expressionPlayback?.mode==='articulate'?'Erweiterte Ausdruckswiedergabe aktiv (Bögen, Artikulation, erkannte Tempoangaben).':'',d.rangeCheck?.status==='passed'?'Tonumfangprüfung bestanden (klingende MIDI-Töne).':'',d.logs].filter(Boolean).join('\n')||'Kompilierung erfolgreich.';state.downloads=state.downloads.filter(x=>x.url.endsWith('.ly'));if(d.url)state.downloads.push({label:'MIDI-Datei',url:d.url});renderResults();}
function requestInputs(){return {key:$('key').value,model:$('model').value,task:$('task').value,system:$('system').value,maxTokens:Number($('tokens').value),compositionReasoning:$('compositionReasoning').value,title:$('title').value};}
async function acceptRunResult(d){
 if(d.operation==='concept'){
  apply({...d,id:d.historyId,techout:''});await persist();await refreshHistory();
  message(d.warning||'Klangvorstellung gespeichert. Bearbeite die Idee und wähle anschließend „Weiter komponieren“.');return;
 }
 apply({...d,techout:d.answer,id:d.historyId});
 await compiledResult(d.compiled);await persist();await refreshHistory();
}
async function generateIdea(){
 if(busy)return;if(!$('model').value)return message('Bitte zuerst ein Modell auswählen.');if(!$('task').value.trim())return message('Bitte einen Auftrag eingeben.');
 await persist();setBusy(true);player.stop();ready=false;
 state={workflow:'concept',ideaStage:null,compositionStage:null,historyId:'',runId:crypto.randomUUID().replaceAll('-',''),costs:{composition:0,realisation:0},downloads:[],midiUrl:'',pages:[],compiler:''};
 $('draft').value='';$('code').value='';renderResults();message('Klangvorstellung wird entwickelt …');
 try{await acceptRunResult(await runClient.start({...requestInputs(),runId:state.runId,operation:'concept'}));}
 catch(e){message('Fehler: '+e.message);if(!runClient.pendingRunId)queueSave();}
 finally{setBusy(false);renderResults();}
}
$('continueComposition').onclick=()=>compose(true).catch(e=>message('Speichern: '+e.message));
$('compose').onclick=()=>($('workflow').value==='concept'?generateIdea():compose(false)).catch(e=>message('Speichern: '+e.message));
async function compose(continuing=false){
 if(busy)return;if(!$('model').value)return message('Bitte zuerst ein Modell auswählen.');
 const task=$('task').value;if(!task.trim())return message('Bitte einen Auftrag eingeben.');
 if(continuing&&(!state.ideaStage||!state.historyId||state.compositionStage))return message('Bitte eine gespeicherte Klangvorstellung öffnen.');
 await persist();setBusy(true);state.runId=crypto.randomUUID().replaceAll('-','');if(!continuing){state.workflow='direct';state.ideaStage=null;state.compositionStage=null;state.historyId='';state.costs={composition:0,realisation:0};$('draft').value='';}renderResults();message('Compiler wird vor dem KI-Aufruf geprüft …');
 try{
  await persist();
  const d=await runClient.start({...requestInputs(),runId:state.runId,workflow:continuing?'concept':'direct',historyId:state.historyId,draft:continuing?$('draft').value:''});
  await acceptRunResult(d);
  message(d.compiled.incomplete?d.compiled.error:d.compiled.repairFailed?'Oktavkorrektur fehlgeschlagen. Das Stück ist weiterhin fehlerhaft.':d.compiled.error?'Code gespeichert. Compilerfehler: '+d.compiled.error:`Fertig · ${d.usage?.prompt_tokens??'?'} Eingabe- und ${d.usage?.completion_tokens??'?'} Ausgabetokens · ${(d.durationMs/1000).toFixed(1)} Sekunden.`);
  if(d.finish_reason==='length'&&!d.compiled.incomplete)message($('status').textContent+'\nAusgabelimit erreicht; Code möglicherweise unvollständig.');
  if(d.compiled.repair)message($('status').textContent+'\n'+d.compiled.repair);
  if(d.titleWarning)message($('status').textContent+'\n'+d.titleWarning);
 if(d.compiled.warning)message($('status').textContent+'\n'+d.compiled.warning);
  else if(d.compiled.rangeCheck?.status==='passed')message($('status').textContent+'\nTonumfangprüfung bestanden.');
 }catch(e){message('Fehler: '+e.message);if(e.details&&/Schlüssel|Anmeldung/.test(e.message)){$('connectionDetails').open=true;$('connection').scrollIntoView({behavior:'smooth'});$('keyStatus').textContent=e.message;}if(!runClient.pendingRunId)queueSave()}finally{setBusy(false);renderResults()}
};
$('compile').onclick=async()=>{if(busy)return;const code=$('code').value;if(!code.trim())return message('Bitte LilyPond-Code eingeben oder öffnen.');setBusy(true);state.runId||=crypto.randomUUID().replaceAll('-','');message('LilyPond wird kompiliert …');try{const d=await api('/api/compile-lilypond',{code,title:$('title').value,task:$('task').value,runId:state.runId});if(d.code&&d.code!==$('code').value){$('code').value=d.code;state.downloads=[];}await compiledResult(d);await saveHistory();message('Kompiliert · '+d.pages.length+' Seite(n).'+(d.repair?'\n'+d.repair:d.warning?'\n'+d.warning:d.rangeCheck?.status==='passed'?'\nTonumfangprüfung bestanden.':''))}catch(e){state.compiler=[e.message,e.details?.logs].filter(Boolean).join('\n');invalidate();$('compiler').textContent=state.compiler;message('Compilerfehler: '+e.message);await saveHistory().catch(x=>{$('memoryStatus').textContent=x.message})}finally{setBusy(false);renderResults()}};
$('sendHacklily').onclick=()=>{const code=$('code').value;if(!code.trim())return message('Bitte LilyPond-Code eingeben oder öffnen.');const a=document.createElement('a');a.href='https://www.hacklily.org/?src='+encodeURIComponent(code);a.target='_blank';a.rel='noopener noreferrer';a.click();};
$('saveLy').onclick=()=>{const url=URL.createObjectURL(new Blob([$('code').value],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=($('title').value.replace(/[\\/:*?"<>|]/g,'_')||'Komposition')+'.ly';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
$('import').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>200000)return message('Datei zu groß (max. 200 KB).');state.historyId='';state.runId='';state.workflow='direct';state.ideaStage=null;state.compositionStage=null;$('draft').value='';$('workflow').value='direct';state.costs={composition:0,realisation:0};$('code').value=await f.text();$('title').value=$('code').value.match(/\btitle\s*=\s*"([^"\n]+)"/)?.[1]||f.name.replace(/\.ly$/i,'');invalidate();await saveHistory().catch(x=>message(x.message));e.target.value='';};
$('new').onclick=()=>{player.stop();ready=false;state={workflow:$('workflow').value,ideaStage:null,compositionStage:null,historyId:'',runId:'',costs:{composition:0,realisation:0},downloads:[],midiUrl:'',pages:[],compiler:''};$('code').value='';$('draft').value='';$('title').value='Unbenannte Komposition';renderResults();queueSave();message('Neue Komposition bereit.');};
$('saveHistory').onclick=()=>saveHistory().catch(e=>{$('memoryStatus').textContent=e.message});
$('openHistory').onclick=async()=>{try{if(!$('history').value)return;apply((await api('/api/history/'+$('history').value)).entry);await persist()}catch(e){$('memoryStatus').textContent=e.message}};
$('deleteHistory').onclick=async()=>{const id=$('history').value;if(!id)return;if(!confirm('Die ausgewählte Komposition aus dem Verlauf löschen?'))return;try{await api('/api/history/'+id,null,'DELETE');if(state.historyId===id)state.historyId='';await refreshHistory();await persist()}catch(e){$('memoryStatus').textContent=e.message}};
$('backupHistory').onclick=async()=>{
 if(busy)return;setBusy(true);message('Verlaufssicherung wird erstellt …');
 try{await persist();const r=await fetch('/api/history-backup');if(!r.ok)throw Error((await r.json()).error);const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='LilyPond-Verlauf-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);message('Verlaufssicherung erstellt.');}
 catch(e){message('Sicherung: '+e.message);}finally{setBusy(false);}
};
$('restoreHistory').onchange=async e=>{
 const f=e.target.files[0];if(!f||busy)return;setBusy(true);message('Verlaufssicherung wird eingelesen …');
 try{if(f.size>24*1024*1024)throw Error('Sicherungsdatei zu groß (24 MB).');const r=await fetch('/api/history-backup',{method:'POST',headers:{'Content-Type':'application/json'},body:await f.text()}),d=await r.json();if(!r.ok)throw Error(d.error);await refreshHistory();if(d.workspaceRestored){const saved=await api('/api/workspace');if(saved.workspace)apply(saved.workspace);}message(d.imported+' Einträge wiederhergestellt · '+d.skipped+' bereits vorhandene Einträge beibehalten.');}
 catch(x){message('Wiederherstellung: '+x.message);}finally{e.target.value='';setBusy(false);}
};
$('diagnosis').onclick=async()=>{await runClient.flush();if(state.runId)location.href='/api/diagnosis?runId='+encodeURIComponent(state.runId);};
async function keyStatus(){const d=await api('/api/key-status');$('keyStatus').textContent=d.stored?'Schlüssel für diese App verschlüsselt gespeichert. Mit „Verbindung prüfen“ testen.':'Noch kein Schlüssel gespeichert.';$('saveKey').disabled=!d.canStore;}
$('saveKey').onclick=async()=>{try{await api('/api/key-store',{key:$('key').value});$('key').value='';await keyStatus()}catch(e){$('keyStatus').textContent=e.message}};
$('checkKey').onclick=async()=>{try{await api('/api/key-check',{key:$('key').value});$('keyStatus').textContent='OpenRouter-Verbindung geprüft. Der Schlüssel wird akzeptiert. Keine Komposition gestartet.'}catch(e){$('keyStatus').textContent=e.message}};
$('deleteKey').onclick=async()=>{try{await api('/api/key-store',null,'DELETE');$('key').value='';await keyStatus()}catch(e){$('keyStatus').textContent=e.message}};
$('reloadModels').onclick=models;$('provider').onchange=()=>{populateModels();queueSave()};$('model').onchange=()=>{modelChoice=$('model').value;prices();queueSave()};
$('workflow').onchange=()=>{state.workflow=$('workflow').value;renderWorkflow();queueSave();};
$('draft').oninput=()=>{renderWorkflow();queueSave();};
for(const id of ['task','title','system','tokens','compositionReasoning'])$(id).oninput=queueSave;$('code').oninput=invalidate;
const fmt=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
player.onprogress=(t,d)=>{$('position').max=d||1;$('position').value=t;$('time').textContent=fmt(t)+' / '+fmt(d)};
$('play').onclick=async()=>{if(loading)return;loading=true;$('font').disabled=true;$('defaultFont').disabled=true;$('play').disabled=true;try{await player.init();if(!player.sf){await fontRestore;if(!selectedFont)await restoreSoundFont();if(!selectedFont)throw Error('Gespeicherter Klang ist nicht erreichbar. Bitte erneut versuchen.');if(selectedFont.standard){await player.loadSoundFont(selectedFont.url,selectedFont.name);}else{const version=fontCache.version(selectedFont);let blob=preparedFontVersion===version?preparedFont:null;if(!blob){try{blob=await (fontPreparing||prepareSoundFont(selectedFont));}catch{blob=await prepareSoundFont(selectedFont);}}$('playerStatus').textContent='Klang wird vorbereitet: '+selectedFont.name;await player.loadSoundFontBuffer(await blob.arrayBuffer(),selectedFont.name);}}if(!ready){const r=await fetch(state.midiUrl);if(!r.ok)throw Error('MIDI konnte nicht geladen werden.');player.loadMidi(await r.arrayBuffer());ready=true}await player.play();$('playerStatus').textContent='Wiedergabe · '+player.soundFontName}catch(e){runClient.record(state.runId,'player_error',e.message);$('playerStatus').textContent='Player: '+e.message}finally{loading=false;$('font').disabled=false;$('defaultFont').disabled=false;$('play').disabled=!state.midiUrl;}};
$('pause').onclick=()=>player.pause();$('stop').onclick=()=>player.stop();$('position').oninput=()=>player.seek(Number($('position').value));$('volume').oninput=()=>player.setMasterVolume($('volume').value);$('saveMidi').onclick=()=>{if(state.midiUrl)location.href=state.midiUrl};
$('font').onchange=async e=>{const f=e.target.files[0];if(!f||loading)return;loading=true;$('font').disabled=true;$('defaultFont').disabled=true;$('play').disabled=true;$('playerStatus').textContent='SoundFont wird geladen: '+f.name;try{fontRevision++;await player.init();const buffer=await f.arrayBuffer();await player.loadSoundFontBuffer(buffer.slice(0),f.name);try{await saveSoundFont(buffer,f.name);$('playerStatus').textContent='Klang gespeichert: '+f.name;}catch(e){runClient.record(state.runId,'api_error','SoundFont speichern: '+e.message);$('playerStatus').textContent='Klang geladen, aber nicht gespeichert: '+e.message;}}catch(e){$('playerStatus').textContent=e.message}finally{e.target.value='';loading=false;$('font').disabled=false;$('defaultFont').disabled=false;$('play').disabled=!state.midiUrl;}};
$('defaultFont').onclick=async()=>{if(loading)return;loading=true;$('font').disabled=true;$('defaultFont').disabled=true;$('play').disabled=true;try{fontRevision++;await player.init();await player.loadSoundFont('/TimGM6mb.sf2','TimGM6mb');selectedFont=await api('/api/soundfont',null,'DELETE');preparedFont=null;preparedFontVersion='';fontPreparing=null;await fontCache.clear();$('playerStatus').textContent='Klang gespeichert: TimGM6mb'}catch(e){$('playerStatus').textContent=e.message}finally{loading=false;$('font').disabled=false;$('defaultFont').disabled=false;$('play').disabled=!state.midiUrl;}};
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});$('installApp').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null}else{$('installHelp').hidden=false;$('installHelp').textContent='Android: Browser-Menü → App installieren. iPad: Safari → Teilen → Zum Home-Bildschirm. Danach über das Icon starten.'}};
if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)$('installApp').hidden=true;
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{});
window.addEventListener('pagehide',()=>{if(!restoring&&!runClient.pendingRunId)navigator.sendBeacon('/api/workspace',new Blob([JSON.stringify({workspace:payload()})],{type:'application/json'}))});
async function boot(){fontRestore=restoreSoundFont();renderResults();try{const d=await api('/api/workspace');if(d.workspace)apply(d.workspace)}catch(e){$('memoryStatus').textContent='Letzter Arbeitsstand: '+e.message}restoring=false;await Promise.allSettled([models(),refreshHistory(),keyStatus()]);if(runClient.pendingRunId)await recoverPending();}
async function recoverPending(){
 if(busy||!runClient.pendingRunId)return;setBusy(true);state.runId=runClient.pendingRunId;runClient.record(state.runId,'page_restored');message('Vorheriger Auftrag wird wiederhergestellt …');
 try{await acceptRunResult(await runClient.recover());message('Ergebnis wiederhergestellt.');}catch(e){message(e.message);}finally{setBusy(false);renderResults();}
}
window.addEventListener('offline',()=>runClient.record(runClient.pendingRunId||state.runId,'offline','Browser meldet keine Internetverbindung.'));
window.addEventListener('online',()=>{runClient.record(runClient.pendingRunId||state.runId,'online');runClient.flush();if(!busy)recoverPending();});
window.addEventListener('error',e=>runClient.record(runClient.pendingRunId||state.runId,'browser_error',e.message));
window.addEventListener('unhandledrejection',e=>runClient.record(runClient.pendingRunId||state.runId,'browser_error',String(e.reason?.message||e.reason||'Unbehandelte Ausnahme')));
boot();

const context=document.modelContext;
if(context?.registerTool){const lifecycle=new AbortController();
 for(const tool of [{name:'read_composition_workspace',description:'Read the visible LilyPond source, task and compiler status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({title:$('title').value,task:$('task').value,code:$('code').value,compiler:state.compiler,busy})},{name:'stage_lilypond_code',description:'Set editable LilyPond source in the visible workspace and save the last state. Does not compile or call a paid AI.',inputSchema:{type:'object',properties:{code:{type:'string',maxLength:200000}},required:['code'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input){if(busy||!input||typeof input.code!=='string'||input.code.length>200000)throw Error('Invalid code or busy workspace');$('code').value=input.code;invalidate();await persist();return {staged:true,length:input.code.length}}}])try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}

function resetEntryViewport(){const v=document.querySelector('meta[name="viewport"]');const normal='width=device-width,initial-scale=1,viewport-fit=cover';v.content=normal+',minimum-scale=1,maximum-scale=1';requestAnimationFrame(()=>requestAnimationFrame(()=>{v.content=normal}));}window.addEventListener('pageshow',resetEntryViewport);
