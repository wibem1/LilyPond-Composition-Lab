import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../app/app.mjs',import.meta.url),'utf8');
const db={workspace:null,entries:[]},requests=[];
const ideaStage={runId:'aaaa1111bbbb2222',model:'one/idea',actualModel:'actual/idea',quality:'balanced',cost:.01,durationMs:1000};
const compositionStage={runId:'aaaa1111bbbb3333',model:'two/composer',actualModel:'actual/composer',quality:'short',cost:.02,durationMs:2000};
class Element{
 constructor(id,value='',select=false){Object.assign(this,{id,value,select,disabled:false,hidden:false,textContent:'',children:[],files:[]});}
 replaceChildren(...children){this.children=children;if(this.select&&!children.some(x=>x.value===this.value))this.value=children[0]?.value||'';}
 append(...children){this.children.push(...children);}scrollIntoView(){}click(){}
}
async function open(){
 const elements=new Map();for(const match of html.matchAll(/\bid="([^"]+)"/g))elements.set(match[1],new Element(match[1]));
 for(const match of html.matchAll(/<select[^>]*id="([^"]+)"[^>]*>(.*?)<\/select>/gs)){const e=elements.get(match[1]);e.select=true;e.value=match[2].match(/value="([^"]*)"/)?.[1]||'';}
 for(const match of html.matchAll(/<textarea[^>]*id="([^"]+)"[^>]*>(.*?)<\/textarea>/gs))elements.get(match[1]).value=match[2];
 for(const match of html.matchAll(/<input[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g))elements.get(match[1]).value=match[2];
 const fetch=async(path,options={})=>{const data=options.body?JSON.parse(options.body):null;
  if(path==='/api/workspace'){if(data)db.workspace=structuredClone(data.workspace);return Response.json(data?{saved:true}:{workspace:db.workspace});}
  if(path==='/api/history'){if(data){const entry={...data,id:data.id||'aaaa1111cccc2222',updatedAt:new Date().toISOString()};db.entries=db.entries.filter(e=>e.id!==entry.id).concat(entry);return Response.json({entry});}return Response.json({entries:db.entries});}
  if(path.startsWith('/api/history/'))return Response.json({entry:db.entries.find(e=>e.id===path.slice(13))});
  if(path==='/api/models')return Response.json({models:[{id:'one/idea',provider:'one',prompt:0,completion:0},{id:'two/composer',provider:'two',prompt:0,completion:0}]});
  if(path==='/api/key-status')return Response.json({stored:true,canStore:true});
  if(path==='/api/soundfont')return Response.json({standard:true,name:'Standard'});
  throw Error(path);
 };
 class Player{stop(){}setMasterVolume(){} }
 class Cache{version(){return '';} }
 class Client{constructor(){this.pendingRunId='';}record(){}async flush(){}async start(input){requests.push(structuredClone(input));if(input.operation==='concept')return {operation:'concept',workflow:'concept',historyId:'aaaa1111cccc2222',runId:ideaStage.runId,title:input.title,task:input.task,system:input.system,compositionModel:input.model,compositionReasoning:input.compositionReasoning,tokens1:input.maxTokens,draft:'Eine ruhige, kontrastreiche Idee.',ideaStage,compositionStage:null,costs:{composition:.01,realisation:0},pages:[],downloads:[],midiUrl:''};return {workflow:'concept',historyId:input.historyId,runId:compositionStage.runId,title:'Ausgearbeitetes Stück',task:input.task,system:input.system,compositionModel:input.model,compositionReasoning:input.compositionReasoning,tokens1:input.maxTokens,draft:input.draft,ideaStage,compositionStage,costs:{composition:.03,realisation:0},answer:'LilyPond-Quelltext',compiled:{url:'/download/test.mid',pages:[],rangeCheck:{status:'passed'}},downloads:[],usage:{prompt_tokens:100,completion_tokens:200},durationMs:3000};}}
 const document={getElementById:id=>{const element=elements.get(id);assert(element,'Missing HTML element '+id);return element;},createElement:()=>new Element('created'),querySelector:()=>new Element('meta')};
 const window={addEventListener(){}};const context=vm.createContext({document,window,navigator:{onLine:true},fetch,Response,URL,Blob,crypto,console,Option:class{constructor(text,value){Object.assign(this,{text,value});}},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>fn(),setTimeout,clearTimeout});
 const module=new vm.SourceTextModule(app.replace('boot();\n\nconst context','export const initialized=boot();\nexport {persist};\n\nconst context'),{context});
 await module.link(async spec=>{let exports;if(spec==='/soundfont-player.mjs')exports={SoundFontPlayer:Player};else if(spec==='/soundfont-cache.mjs')exports={SoundFontCache:Cache};else if(spec==='/run-client.mjs')exports={RunClient:Client};else if(spec==='/composition-workflow.mjs')exports=await import('../src/composition-workflow.mjs');else if(spec==='/composition-costs.mjs')exports=await import('../src/composition-costs.mjs');else throw Error(spec);return new vm.SyntheticModule(Object.keys(exports),function(){for(const [name,value] of Object.entries(exports))this.setExport(name,value);},{context});});
 await module.evaluate();await module.namespace.initialized;
 return {get:id=>elements.get(id),persist:module.namespace.persist};
}
let ui=await open();assert(ui.get('system').value.includes('Oktavnotation:'));assert(ui.get('system').value.includes('absolute Tonhöhen'));const currentDefault=ui.get('system').value;
// Upgrade a saved untouched v0.1.36 default; never overwrite a deliberate custom prompt.
db.workspace={system:currentDefault.split(' Oktavnotation:')[0],workflow:'direct'};ui=await open();assert.equal(ui.get('system').value,currentDefault);db.workspace={system:'Meine eigene Vorgabe',workflow:'direct'};ui=await open();assert.equal(ui.get('system').value,'Meine eigene Vorgabe');db.workspace=null;ui=await open();
assert.equal(ui.get('workflow').value,'direct');assert(ui.get('conceptPanel').hidden);assert.equal(ui.get('compose').textContent,'Komponieren');
ui.get('workflow').value='concept';ui.get('workflow').onchange();ui.get('compositionReasoning').value='balanced';await ui.get('compose').onclick();
assert.equal(requests.length,1);assert.equal(requests[0].operation,'concept');assert.equal(ui.get('draft').value,'Eine ruhige, kontrastreiche Idee.');assert(!ui.get('conceptPanel').hidden);assert(!ui.get('continueComposition').disabled);assert.equal(ui.get('code').value,'');
ui.get('draft').value='Bearbeitet: mehr Legato und freiere Harmonik.';await ui.persist();assert.equal(db.workspace.draft,ui.get('draft').value);assert.equal(db.entries[0].draft,ui.get('draft').value);
// A new page restores the paid idea and continues with the currently selected model.
ui=await open();assert.equal(ui.get('draft').value,db.workspace.draft);assert(!ui.get('continueComposition').disabled);assert.equal(requests.length,1);
ui.get('provider').value='two';ui.get('provider').onchange();ui.get('compositionReasoning').value='short';await ui.get('continueComposition').onclick();
assert.equal(requests.length,2);assert.equal(requests[1].model,'two/composer');assert.equal(requests[1].compositionReasoning,'short');assert(requests[1].system.includes('Oktavnotation:'));assert.equal(requests[1].draft,'Bearbeitet: mehr Legato und freiere Harmonik.');
assert.equal(ui.get('code').value,'LilyPond-Quelltext');assert.equal(ui.get('model').value,'two/composer');assert(ui.get('continueComposition').hidden);assert(ui.get('stageInfo').textContent.includes('actual/idea'));assert(ui.get('stageInfo').textContent.includes('actual/composer'));assert.equal(db.workspace.costs.composition,.03);
ui=await open();assert.equal(ui.get('model').value,'two/composer');assert.equal(ui.get('compositionReasoning').value,'short');assert.equal(ui.get('draft').value,'Bearbeitet: mehr Legato und freiere Harmonik.');assert(ui.get('continueComposition').hidden);assert.equal(requests.length,2);
ui.get('new').onclick();assert.equal(ui.get('code').value,'');assert.equal(ui.get('draft').value,'');assert(ui.get('conceptPanel').hidden);assert.equal(db.entries.length,1);
console.log('PASS: shipped UI defaults to direct; idea creation, editable persisted draft, reload, model/quality switch, actual second-step submission, final history/workspace reload and new-composition reset.');
