import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../app/app.mjs',import.meta.url),'utf8');
const legacyPrompts=JSON.parse(await readFile(new URL('./fixtures/legacy-prompts.json',import.meta.url),'utf8'));
const db={workspace:null,entries:[]},requests=[];
let rememberedFont={standard:true,name:'Standard'};const customFontLoads=[];
const midiFetches=[],playCalls=[],compileCalls=[];let compileFailure=false,duringCompile=null;const xmlCalls=[];let xmlFailure=false;let completionReply=null;
const ideaStage={runId:'aaaa1111bbbb2222',model:'one/idea',actualModel:'actual/idea',quality:'balanced',cost:.01,durationMs:1000};
const compositionStage={runId:'aaaa1111bbbb3333',model:'two/composer',actualModel:'actual/composer',quality:'short',cost:.02,durationMs:2000};
class Element{
 constructor(id,value='',select=false){Object.assign(this,{id,value,select,disabled:false,hidden:false,textContent:'',children:[],files:[]});}
 get options(){return this.children;}
 replaceChildren(...children){this.children=children;if(this.select&&!children.some(x=>x.value===this.value))this.value=children[0]?.value||'';}
 append(...children){this.children.push(...children);}scrollIntoView(){}click(){}
}
async function open(){
 const elements=new Map();for(const match of html.matchAll(/\bid="([^"]+)"/g))elements.set(match[1],new Element(match[1]));
 for(const match of html.matchAll(/<select[^>]*id="([^"]+)"[^>]*>(.*?)<\/select>/gs)){const e=elements.get(match[1]);e.select=true;e.children=Array.from(match[2].matchAll(/<option value="([^"]+)">([^<]*)<\/option>/g),m=>({value:m[1],text:m[2]}));e.value=match[2].match(/value="([^"]*)"/)?.[1]||'';}
 for(const match of html.matchAll(/<textarea[^>]*id="([^"]+)"[^>]*>(.*?)<\/textarea>/gs))elements.get(match[1]).value=match[2];
 for(const match of html.matchAll(/<input[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g))elements.get(match[1]).value=match[2];
 const fetch=async(path,options={})=>{const data=options.body?JSON.parse(options.body):null;
  if(path==='/api/workspace'){if(data)db.workspace=structuredClone(data.workspace);return Response.json(data?{saved:true}:{workspace:db.workspace});}
  if(path==='/api/history'){if(data){const entry={...data,id:data.id||'aaaa1111cccc2222',updatedAt:new Date().toISOString()};db.entries=db.entries.filter(e=>e.id!==entry.id).concat(entry);return Response.json({entry});}return Response.json({entries:db.entries});}
  if(path.startsWith('/api/history/'))return Response.json({entry:db.entries.find(e=>e.id===path.slice(13))});
  if(path==='/api/export-musicxml'){xmlCalls.push(data);return Response.json(xmlFailure?{error:'Export unvollständig'}:{url:'/download/piano.musicxml',stats:{measures:32,staves:2},warnings:[],paidCalls:0},{status:xmlFailure?422:200});}
  if(path==='/api/compile-lilypond'){compileCalls.push(data);if(duringCompile)duringCompile();return Response.json(compileFailure?{error:'Renderer offline'}:{url:'/download/refreshed.mid',midiTimingPolicy:'independent-voices-v1',pages:[],expressionPlayback:{mode:'articulate'}},{status:compileFailure?503:200});}
  if(path.startsWith('/download/')){midiFetches.push(path);return new Response(new Uint8Array([77,84,104,100]));}
  if(path==='/api/models')return Response.json({models:[{id:'one/idea',provider:'one',prompt:0,completion:0},{id:'two/composer',provider:'two',prompt:0,completion:0}]});
  if(path==='/api/key-status')return Response.json({stored:true,canStore:true});
  if(path==='/api/soundfont')return Response.json(rememberedFont);
  throw Error(path);
 };
 class Player{stop(){}setMasterVolume(){}async init(){if(rememberedFont.standard){this.sf={name:'Standard'};this.soundFontName='Standard';}}async loadSoundFontBuffer(buffer,name){customFontLoads.push({name,bytes:buffer.byteLength});this.sf={name};this.soundFontName=name;}loadMidi(){playCalls.push('load');}async play(){playCalls.push('play');}}
 class Cache{version(font){return font.savedAt+'|'+font.bytes;}async prepare(){return new Blob([new Uint8Array(8)]);} }
 class Client{constructor(){this.pendingRunId='';}record(){}async flush(){}async start(input){requests.push(structuredClone(input));if((input.operation==='revise'||input.operation==='correct')&&completionReply)return structuredClone(completionReply);if(input.operation==='concept')return {operation:'concept',workflow:'concept',historyId:'aaaa1111cccc2222',runId:ideaStage.runId,title:input.title,task:input.task,system:input.system,compositionModel:input.model,compositionReasoning:input.compositionReasoning,tokens1:input.maxTokens,draft:'Eine ruhige, kontrastreiche Idee.',ideaStage,compositionStage:null,costs:{composition:.01,realisation:0},pages:[],downloads:[],midiUrl:''};return {workflow:'concept',historyId:input.historyId,runId:compositionStage.runId,title:'Ausgearbeitetes Stück',task:input.task,system:input.system,compositionModel:input.model,compositionReasoning:input.compositionReasoning,tokens1:input.maxTokens,draft:input.draft,ideaStage,compositionStage,costs:{composition:.03,realisation:0},answer:'LilyPond-Quelltext',compiled:{url:'/download/test.mid',pages:[],rangeCheck:{status:'passed'}},downloads:[],usage:{prompt_tokens:100,completion_tokens:200},durationMs:3000};}}
 const document={getElementById:id=>{const element=elements.get(id);assert(element,'Missing HTML element '+id);return element;},createElement:()=>new Element('created'),querySelector:()=>new Element('meta')};
 const window={addEventListener(){}};const context=vm.createContext({document,window,navigator:{onLine:true},location:{href:''},fetch,Response,URL,Blob,crypto,console,Option:class{constructor(text,value){Object.assign(this,{text,value});}},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>fn(),setTimeout,clearTimeout});
 const module=new vm.SourceTextModule(app.replace('boot();\n\nconst context','export const initialized=boot();\nexport {persist};\n\nconst context'),{context});
 await module.link(async spec=>{let exports;if(spec==='/composition-recovery.mjs')exports=await import('../src/composition-recovery.mjs');else if(spec==='/soundfont-player.mjs')exports={SoundFontPlayer:Player};else if(spec==='/soundfont-cache.mjs')exports={SoundFontCache:Cache};else if(spec==='/run-client.mjs')exports={RunClient:Client};else if(spec==='/composition-workflow.mjs')exports=await import('../src/composition-workflow.mjs');else if(spec==='/composition-defaults.mjs')exports=await import('../src/composition-defaults.mjs');else if(spec==='/app-config.mjs')exports=await import('../src/app-config.mjs');else if(spec==='/composition-costs.mjs')exports=await import('../src/composition-costs.mjs');else throw Error(spec);return new vm.SyntheticModule(Object.keys(exports),function(){for(const [name,value] of Object.entries(exports))this.setExport(name,value);},{context});});
 await module.evaluate();await module.namespace.initialized;
 return {get:id=>elements.get(id),persist:module.namespace.persist};
}
let ui=await open();assert(ui.get('system').value.includes('Oktavnotation:'));assert(ui.get('system').value.includes('absolute Tonhöhen'));const currentDefault=ui.get('system').value;
// Upgrade a saved untouched v0.1.36 default; never overwrite a deliberate custom prompt.
db.workspace={system:legacyPrompts.expression,workflow:'direct'};ui=await open();assert.equal(ui.get('system').value,currentDefault);db.workspace={system:'Meine eigene Vorgabe',workflow:'direct'};ui=await open();assert.equal(ui.get('system').value,'Meine eigene Vorgabe');db.workspace={system:legacyPrompts.expression+(await import('../src/composition-workflow.mjs')).OCTAVE_RULE,workflow:'direct'};ui=await open();assert.equal(ui.get('system').value,currentDefault);db.workspace=null;ui=await open();
assert.equal(ui.get('workflow').value,'direct');assert(ui.get('conceptPanel').hidden);assert.equal(ui.get('compose').textContent,'Stück komponieren');
ui.get('workflow').value='concept';ui.get('workflow').onchange();ui.get('compositionReasoning').value='balanced';await ui.get('compose').onclick();
assert.equal(requests.length,1);assert.equal(requests[0].operation,'concept');assert.equal(ui.get('draft').value,'Eine ruhige, kontrastreiche Idee.');assert(!ui.get('conceptPanel').hidden);assert(!ui.get('continueComposition').disabled);assert.equal(ui.get('code').value,'');
ui.get('draft').value='Bearbeitet: mehr Legato und freiere Harmonik.';ui.get('draft').oninput();assert(ui.get('continuationRequestPreview').textContent.includes('Bearbeitet: mehr Legato und freiere Harmonik.'));assert(ui.get('requestPreview').textContent.includes('Noch keine Notation'));await ui.persist();assert.equal(db.workspace.draft,ui.get('draft').value);assert.equal(db.entries[0].draft,ui.get('draft').value);
// A new page restores the paid idea and continues with the currently selected model.
ui=await open();assert.equal(ui.get('draft').value,db.workspace.draft);assert(!ui.get('continueComposition').disabled);assert.equal(requests.length,1);
ui.get('provider').value='two';ui.get('provider').onchange();ui.get('compositionReasoning').value='short';await ui.get('continueComposition').onclick();
assert.equal(requests.length,2);assert.equal(requests[1].model,'two/composer');assert.equal(requests[1].compositionReasoning,'short');assert(requests[1].system.includes('Oktavnotation:'));assert.equal(requests[1].draft,'Bearbeitet: mehr Legato und freiere Harmonik.');
assert.equal(ui.get('code').value,'LilyPond-Quelltext');assert.equal(ui.get('model').value,'two/composer');assert(ui.get('continueComposition').hidden);assert(ui.get('stageInfo').textContent.includes('actual/idea'));assert(ui.get('stageInfo').textContent.includes('actual/composer'));assert.equal(db.workspace.costs.composition,.03);
ui=await open();assert.equal(ui.get('model').value,'two/composer');assert.equal(ui.get('compositionReasoning').value,'short');assert.equal(ui.get('draft').value,'Bearbeitet: mehr Legato und freiere Harmonik.');assert(ui.get('continueComposition').hidden);assert.equal(requests.length,2);
ui.get('task').value='Stimmen synchronisieren.';ui.get('compositionReasoning').value='balanced';await ui.get('reviseComposition').onclick();
assert.equal(requests.length,3);assert.equal(requests[2].operation,'revise');assert.equal(requests[2].code,'LilyPond-Quelltext');assert.equal(requests[2].task,'Stimmen synchronisieren.');assert.equal(requests[2].model,'two/composer');assert.equal(requests[2].compositionReasoning,'balanced');assert(!ui.get('reviseComposition').disabled);
ui.get('new').onclick();assert.equal(ui.get('code').value,'');assert.equal(ui.get('draft').value,'');assert(ui.get('conceptPanel').hidden);assert.equal(db.entries.length,1);
console.log('PASS: shipped UI defaults to direct; idea creation, editable persisted draft, reload, model/quality switch, actual second-step submission, final history/workspace reload and new-composition reset.');

// Exercise the real play handler: restored legacy MIDI must be rebuilt before
// loading any bytes, and a persisted marker must survive opening the app again.
db.workspace={...db.entries[0],historyId:db.entries[0].id,midiUrl:'/download/legacy.mid',midiTimingPolicy:''};
ui=await open();const originalSource=ui.get('code').value,paidCalls=requests.length;
await ui.get('play').onclick();
assert.equal(compileCalls.length,1);assert.equal(compileCalls[0].code,originalSource);
assert.deepEqual(midiFetches,['/download/refreshed.mid']);assert.deepEqual(playCalls,['load','play']);
assert.equal(db.workspace.midiTimingPolicy,'independent-voices-v1');
assert.equal(db.entries[0].midiTimingPolicy,'independent-voices-v1');
assert.equal(db.workspace.techout,originalSource);assert.equal(requests.length,paidCalls,'no AI call');
ui=await open();await ui.get('play').onclick();assert.equal(compileCalls.length,1,'no recompile after reload');
// An older entry cannot inherit the previous entry's up-to-date marker.
db.workspace={...db.workspace,midiUrl:'/download/legacy-other.mid',midiTimingPolicy:undefined};
compileFailure=true;ui=await open();const loadsBefore=midiFetches.length;
await ui.get('play').onclick();assert.equal(compileCalls.length,2);
assert.equal(midiFetches.length,loadsBefore,'failed migration never plays legacy bytes');
assert.equal(db.workspace.midiUrl,'/download/legacy-other.mid','old saved result survives failure');
assert(ui.get('playerStatus').textContent.includes('Renderer offline'));
compileFailure=false;duringCompile=()=>{ui.get('code').value='edited during migration';};
await ui.get('play').onclick();assert.equal(midiFetches.length,loadsBefore);
assert(ui.get('playerStatus').textContent.includes('geändert'));
assert.equal(db.workspace.techout,originalSource,'no stale result saved over new edits');
duringCompile=null;
console.log('PASS: real UI play path upgrades saved legacy MIDI before fetching, persists timing marker in history/workspace across reload, costs no AI call, rejects failed compilation and concurrent source edits without stale playback.');

// The editor must send each imported/revised source exactly once per explicit
// compile and must not show a previous run's diagnostics.
db.workspace=null;ui=await open();
ui.get('code').value='\\\\score { { c4\\\\sustainOn d4\\\\sustainOff } \\\\midi {} }';
await ui.get('compile').onclick();
const firstCompile=compileCalls.at(-1);
assert(firstCompile.code.includes('sustainOn'));
ui.get('code').value='\\\\score { { c4 d4 } \\\\midi {} }';
await ui.get('compile').onclick();
const secondCompile=compileCalls.at(-1);
assert(!secondCompile.code.includes('sustain'));
assert.notEqual(firstCompile.runId,secondCompile.runId,'every click must have a fresh run ID');
assert(!ui.get('compiler').textContent.includes('sustainOn'),'previous compile diagnostics must be cleared');
console.log('PASS: compile sends current editor text with fresh run IDs and clears old diagnostics.');

// Export is a separate operation on the edited source and retains MIDI/code.
ui=await open();const xmlSource=ui.get('code').value,xmlMidi=db.workspace.midiUrl,paidBeforeXml=requests.length;
await ui.get('saveMusicXml').onclick();assert.equal(xmlCalls.length,1);assert.equal(xmlCalls[0].code,xmlSource);
assert.equal(requests.length,paidBeforeXml);assert.equal(ui.get('code').value,xmlSource);
assert.equal(db.workspace.midiUrl,xmlMidi);assert(db.workspace.downloads.some(d=>d.url.endsWith('.musicxml')));
assert(ui.get('status').textContent.includes('32 Takte'));assert(!ui.get('saveMusicXml').disabled);
ui=await open();assert(db.workspace.downloads.some(d=>d.url.endsWith('.musicxml')));
xmlFailure=true;await ui.get('saveMusicXml').onclick();assert(ui.get('status').textContent.includes('Export unvollständig'));assert.equal(requests.length,paidBeforeXml);assert(!ui.get('saveMusicXml').disabled);
console.log('PASS: MusicXML export button sends edited source, persists download across reload, keeps score/MIDI and costs, and displays compiler failure.');

// Both revision actions use the existing task field, including imported fragments.
const protectedFragment="left = \\absolute { c4";
db.workspace={title:'Fragment',task:'Ergänze das Fragment.',techout:protectedFragment,compositionModel:'two/composer',historyId:'aaaa1111cccc8888',costs:{composition:.01,realisation:0},downloads:[],pages:[]};
db.entries.push({...db.workspace,id:db.workspace.historyId,updatedAt:new Date().toISOString()});
ui=await open();assert(!ui.get('reviseComposition').disabled);assert(!ui.get('correctComposition').disabled);
completionReply={...db.workspace,historyId:'aaaa1111cccc9999',runId:'aaaa1111dddd9999',operation:'revise',answer:protectedFragment+' d e f }',compiled:{incomplete:true,error:'Unterbrochen, Fragment erhalten.'},recovery:{incomplete:true,originalHistoryId:db.workspace.historyId},correctionStages:[compositionStage],costs:{composition:.01,realisation:.02}};
await ui.get('reviseComposition').onclick();assert.equal(requests.at(-1).operation,'revise');assert.equal(requests.at(-1).code,protectedFragment);assert.equal(requests.at(-1).task,'Ergänze das Fragment.');assert.equal(requests.at(-1).model,'two/composer');assert.equal(ui.get('code').value,completionReply.answer);assert(ui.get('status').textContent.includes('Unterbrochen'));assert.equal(db.workspace.recovery.incomplete,true);
ui=await open();ui.get('task').value='';const beforeEmpty=requests.length;await ui.get('reviseComposition').onclick();assert.equal(requests.length,beforeEmpty);assert(ui.get('status').textContent.includes('Kompositionsauftrag'));
completionReply={...completionReply,operation:'correct',answer:'\\score { { c1 } \\midi {} }',compiled:{url:'/download/revised.mid',pages:[]},recovery:null};
await ui.get('correctComposition').onclick();assert.equal(requests.at(-1).operation,'correct');assert.equal(requests.at(-1).task,'');assert.equal(ui.get('code').value,completionReply.answer);assert(ui.get('status').textContent.includes('Original bleibt'));assert(!db.workspace.recovery);
ui=await open();assert(!ui.get('correctComposition').disabled);ui.get('new').onclick();assert(ui.get('reviseComposition').disabled);assert(ui.get('correctComposition').disabled);
assert(!html.includes('correctionNotes'));assert(!html.includes('completeComposition'));assert(!html.includes('correctErrors'));
console.log('PASS: existing task field drives targeted revision, automatic correction works with empty task, both submit current/imported score and selected model, show partials, persist reload and disable on empty score; no extra correction field or special completion button.');

// Rapid repeated clicks must lock before the first asynchronous persistence step.
db.workspace=null;ui=await open();ui.get('workflow').value='direct';
const beforeDouble=requests.length;await Promise.all([ui.get('compose').onclick(),ui.get('compose').onclick()]);
assert.equal(requests.length,beforeDouble+1,'double click starts one paid composition');
ui.get('new').onclick();ui.get('workflow').value='concept';ui.get('workflow').onchange();
const beforeIdeas=requests.length;await Promise.all([ui.get('compose').onclick(),ui.get('compose').onclick()]);
assert.equal(requests.length,beforeIdeas+1,'double click starts one paid idea');
console.log('PASS: rapid double clicks lock before awaiting storage and start exactly one composition or idea request.');


// The saved server selection is restored and passed to the player on every reopen.
rememberedFont={name:'Mein zuletzt geladener Flügel.sf2',savedAt:'saved-font-version',bytes:8,url:'/api/soundfont/file'};
db.workspace={title:'Gespeichertes Stück',techout:'source',midiUrl:'/download/saved.mid',midiTimingPolicy:'independent-voices-v1'};
for(let reopening=0;reopening<2;reopening++){
 ui=await open();assert(ui.get('playerStatus').textContent.includes(rememberedFont.name));
 await ui.get('play').onclick();assert(ui.get('playerStatus').textContent.includes(rememberedFont.name));
}
assert.equal(customFontLoads.length,2);assert(customFontLoads.every(f=>f.name===rememberedFont.name&&f.bytes===8));
console.log('PASS: app reopens twice with saved custom SoundFont metadata and loads exactly that bank for playback without selecting a file again.');
