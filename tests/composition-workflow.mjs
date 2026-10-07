import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../worker/index.js';
class Bucket{
 constructor(){this.items=new Map();}
 async put(key,value,options={}){this.items.set(key,{bytes:typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value),customMetadata:options.customMetadata||{}});}
 async get(key){const item=this.items.get(key);if(!item)return null;return {body:item.bytes,json:async()=>JSON.parse(new TextDecoder().decode(item.bytes)),arrayBuffer:async()=>item.bytes.slice().buffer};}
 async delete(key){this.items.delete(key);}
 async list({prefix}){return {objects:[...this.items].filter(([key])=>key.startsWith(prefix)).map(([key,item])=>({key,customMetadata:item.customMetadata})),truncated:false};}
}
const fixture=JSON.parse(await readFile(new URL('./fixtures/synthetic-piano-response.json',import.meta.url),'utf8')).result;
let rendererDown=false,rendererCalls=0,failComposition=false,truncateConcept=false,paid=[],titles=0;
class Socket extends EventTarget{accept(){}close(){}send(raw){const message=JSON.parse(raw);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:message.id,result:fixture})})));}}
globalThis.fetch=async(url,options={})=>{
 if(String(url).includes('render.hacklily.org')){rendererCalls++;return rendererDown?new Response('down',{status:503}):{webSocket:new Socket()};}
 if(String(url).endsWith('/key'))return Response.json({data:{}});
 if(String(url).endsWith('/chat/completions')){
  const request=JSON.parse(options.body);paid.push(request);const idea=request.messages[0].content.startsWith('Entwickle zum Auftrag eine Klangvorstellung');
  if(!idea&&failComposition)return Response.json({error:{message:'Simulierter Ausfall'}},{status:503});
  return Response.json({model:idea?'actual/idea':'actual/composer',choices:[{message:{content:idea?'Ein ruhiger Beginn, ein scharfer Kontrast im Mittelteil und eine offene Rückkehr.':`\\version "2.24.3"\n\\header { title = "Neues Stück ${String.fromCharCode(65+(++titles))}" }\n\\score { { c'4 d' e' f' } \\layout {} \\midi {} }`},finish_reason:idea&&truncateConcept?'length':'stop'}],usage:{prompt_tokens:120,completion_tokens:80,total_tokens:200,cost:idea?.01:.02}});
 }
 throw Error('Unexpected outbound destination '+url);
};
const env={BUCKET:new Bucket()},tasks=[];
async function call(path,data,method=data?'POST':'GET',target=env){return worker.fetch(new Request('https://lab.test'+path,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),target,{waitUntil:p=>tasks.push(p)});}
async function value(path,data,method,target){const response=await call(path,data,method,target);assert.equal(response.status,200,await response.clone().text());return response.json();}
const input={key:'sk-or-v1-TEST',model:'provider/idea',task:'Ein Klavierstück mit acht Takten.',system:'Eigene musikalische Wünsche. Es gibt keinen vorgeschalteten Entwurf.',compositionReasoning:'balanced',maxTokens:24000,title:'Unbenannte Komposition'};
// The first streamed step is saved before editing, without invoking the renderer.
const firstRun='aaaa1111bbbb2222';
const response=await call('/api/run-stream',{...input,runId:firstRun,operation:'concept'});const events=(await response.text()).trim().split('\n').map(JSON.parse);await Promise.all(tasks);
const idea=events.find(e=>e.type==='result').result;
assert.equal(idea.operation,'concept');assert.equal(paid.length,1);assert.equal(rendererCalls,0);
assert.deepEqual(paid[0].reasoning,{effort:'medium'});assert.equal(paid[0].max_tokens,8000);
assert(paid[0].messages[0].content.includes('Noch keine Notation'));assert(paid[0].messages[1].content.includes(input.system));
assert.equal(idea.ideaStage.actualModel,'actual/idea');assert.equal(idea.ideaStage.quality,'balanced');
assert.equal((await value('/api/workspace')).workspace.historyId,idea.historyId);
assert.equal((await value('/api/history/'+idea.historyId)).entry.techout,'');
assert((await value('/api/history')).entries.find(e=>e.id===idea.historyId).hasDraft);
const duplicate=await value('/api/run-stream',{...input,runId:firstRun,operation:'concept'});assert(duplicate.resume);assert.equal(paid.length,1);
// Reload/edit/save, then change model and effort only for the second step.
const edited='Neue Klangvorstellung: legato, keine durchlaufenden Achtel, deutlicher harmonischer Kontrast.';
const savedIdea=(await value('/api/history/'+idea.historyId)).entry;
await value('/api/workspace',{workspace:{...savedIdea,historyId:idea.historyId,draft:edited}});
const second={...input,workflow:'concept',historyId:idea.historyId,draft:edited,model:'other/composer',compositionReasoning:'short',runId:'aaaa1111bbbb3333'};
rendererDown=true;
const unavailable=await call('/api/run',second);assert.equal(unavailable.status,412);assert.equal(paid.length,1);
assert.equal((await value('/api/history/'+idea.historyId)).entry.draft,edited);
rendererDown=false;failComposition=true;
const failed=await call('/api/run',second);assert.equal(failed.status,502);assert.equal(paid.length,2);
assert.equal((await value('/api/history/'+idea.historyId)).entry.ideaStage.answer,idea.draft);
assert.equal((await value('/api/history/'+idea.historyId)).entry.compositionStage,null);
failComposition=false;
const result=await value('/api/run',{...second,runId:'aaaa1111bbbb4444'});
assert.equal(paid.length,3);assert.equal(paid.filter(p=>p.messages[0].content.startsWith('Entwickle zum Auftrag')).length,1,'resuming never regenerates the paid idea');
assert.equal(result.historyId,idea.historyId);assert.equal(result.draft,edited);assert.equal(result.workflow,'concept');
assert.equal(result.compositionModel,'other/composer');assert.equal(result.compositionStage.actualModel,'actual/composer');assert.equal(result.ideaStage.actualModel,'actual/idea');
assert.deepEqual(paid.at(-1).reasoning,{effort:'low'});assert(paid.at(-1).messages[1].content.includes(edited));assert(!paid.at(-1).messages[0].content.includes('Es gibt keinen vorgeschalteten Entwurf.'));
assert.equal(result.costs.composition,.03);assert(result.answer.includes('composer = "actual/composer"'));assert(result.compiled.url);assert(result.compiled.pages.length);
const stored=(await value('/api/history/'+result.historyId)).entry;
assert.equal(stored.ideaStage.quality,'balanced');assert.equal(stored.compositionStage.quality,'short');assert.equal(stored.compositionReasoning,'short');assert.equal(stored.ideaStage.cost,.01);assert.equal(stored.compositionStage.cost,.02);
const diagnosis=await value('/api/diagnosis?runId='+result.runId);assert.equal(diagnosis.costs.composition,.03);assert(diagnosis.entries.some(e=>e.operation==='concept'&&e.event==='anfrage'));assert(diagnosis.entries.some(e=>e.messages?.[1]?.content.includes(edited)));assert(!JSON.stringify(diagnosis).includes('sk-or-v1-TEST'));
const before=paid.length;assert.equal((await call('/api/run',{...second,runId:'aaaa1111bbbb5555'})).status,502);assert.equal(paid.length,before,'completed composition cannot be silently charged again');
// Direct mode still sends exactly the original pair of prompts, once.
const direct=await value('/api/run',{...input,runId:'aaaa1111bbbb6666'});
assert.equal(paid.length,before+1);assert.equal(direct.workflow,'direct');assert.equal(direct.ideaStage,null);
assert.deepEqual(paid.at(-1).messages,[{role:'system',content:input.system},{role:'user',content:input.task}]);
// A truncated idea stays visible, saved and explicitly marked for editing.
truncateConcept=true;const partial=await value('/api/run',{...input,operation:'concept',runId:'aaaa1111bbbb7777'});assert(partial.warning.includes('abgeschnitten'));assert.equal(partial.ideaStage.finishReason,'length');assert.equal((await value('/api/history/'+partial.historyId)).entry.draft,partial.draft);truncateConcept=false;
console.log('PASS: optional staged composition, edited idea, changed model/quality, saved intermediate result, preflight/provider failures, resume without repeating first step, actual model attribution, combined costs/diagnosis and unchanged direct prompts.');
// Full backup round-trip includes actual binary MIDI, SVG, sources and diagnoses.
await env.BUCKET.put('settings/key.json',JSON.stringify({secret:'DO-NOT-EXPORT'}));
await env.BUCKET.put('soundfonts/private.sf2',new Uint8Array([1,2,3]));
const backup=await value('/api/history-backup');assert.equal(backup.entries.length,3);assert(!JSON.stringify(backup).includes('DO-NOT-EXPORT'));assert(!JSON.stringify(backup).includes('private.sf2'));assert(Object.keys(backup.artifacts).some(k=>k.endsWith('.mid')));assert(Object.keys(backup.artifacts).some(k=>k.endsWith('.svg')));
const restoredEnv={BUCKET:new Bucket()};const imported=await value('/api/history-backup',backup,'POST',restoredEnv);assert.equal(imported.imported,3);assert(imported.workspaceRestored);
const restored=(await value('/api/history/'+result.historyId,undefined,undefined,restoredEnv)).entry;
assert.deepEqual(restored.costs,stored.costs);assert.equal(restored.techout,stored.techout);assert.equal(restored.draft,edited);assert.equal(restored.createdAt,stored.createdAt);assert.equal(restored.updatedAt,stored.updatedAt);
assert.notEqual(restored.midiUrl,stored.midiUrl);assert.notEqual(restored.runId,stored.runId);
const originalMidi=new Uint8Array(await (await call(stored.midiUrl)).arrayBuffer());const restoredMidi=new Uint8Array(await (await call(restored.midiUrl,undefined,undefined,restoredEnv)).arrayBuffer());assert.deepEqual(restoredMidi,originalMidi);
assert.equal((await call(restored.pages[0].url,undefined,undefined,restoredEnv)).status,200);
const restoredDiag=await value('/api/diagnosis?runId='+restored.runId,undefined,undefined,restoredEnv);assert.equal(restoredDiag.costs.composition,.03);assert(restoredDiag.entries.some(e=>e.operation==='concept'));
const repeat=await value('/api/history-backup',backup,'POST',restoredEnv);assert.equal(repeat.imported,0);assert.equal(repeat.skipped,3);
const corrupt=structuredClone(backup);delete corrupt.artifacts[Object.keys(corrupt.artifacts)[0]];const pristine={BUCKET:new Bucket()};assert.equal((await call('/api/history-backup',corrupt,'POST',pristine)).status,400);assert.equal(pristine.BUCKET.items.size,0,'invalid backups are rejected before writes');
const hostile=structuredClone(backup);hostile.artifacts['/download/..%2Fsettings%2Fkey.json']='e30=';assert.equal((await call('/api/history-backup',hostile,'POST',pristine)).status,400);assert.equal(pristine.BUCKET.items.size,0);
const foreign=await worker.fetch(new Request('https://lab.test/api/history-backup',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify(backup)}),pristine,{});assert.equal(foreign.status,403);assert.equal(paid.length,before+2,'backups and restores make no AI requests');
console.log('PASS: backup/restore sources, ideas, costs, per-stage choices, dates, binary MIDI, score pages and combined diagnoses; duplicate imports and existing workspace preserved; malformed/missing/path-traversal/cross-origin data rejected; keys and SoundFonts excluded; no paid calls.');
