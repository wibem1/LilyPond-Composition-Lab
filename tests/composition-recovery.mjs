import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../worker/index.js';
import {RunClient} from '../src/run-client.mjs';
class Bucket{
 constructor(){this.items=new Map();}
 async put(k,v,opts={}){if(opts.onlyIf?.get('If-None-Match')==='*'&&this.items.has(k))return null;this.items.set(k,{v,customMetadata:opts.customMetadata||{}});return {etag:'mock'};}
 async get(k){const e=this.items.get(k);return e?{body:e.v,json:async()=>JSON.parse(e.v)}:null;}
 async list({prefix}){return {objects:[...this.items].filter(([k])=>k.startsWith(prefix)).map(([key,e])=>({key,customMetadata:e.customMetadata})),truncated:false};}
}
const env={BUCKET:new Bucket()},tasks=[];
const fixture=JSON.parse(await readFile(new URL('fixtures/synthetic-piano-response.json',import.meta.url))).result;
const prefix="\\version \"2.24.3\"\n\\header {title = \"Fragment\"}\nright = \\absolute { c'1 }\nleft = \\absolute { c4";
let suffix=" d e f }\n\\score { \\new PianoStaff << \\new Staff \\right \\new Staff \\left >> \\layout {} \\midi {} }",finish='stop',providerError=false,rendererError=false,paid=0;
class Socket extends EventTarget{accept(){}close(){}send(s){const q=JSON.parse(s);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:q.id,result:rendererError?{err:'syntax error'}:{...fixture,logs:q.params.src.includes('labMusicXmlCapture')?'LABXML-BEGIN'+JSON.stringify({name:'SimultaneousMusic',len:1,elements:[{name:'ContextSpeccedMusic','context-type':'Staff','create-new':true,len:1}]})+'LABXML-END':''}})})));}}
globalThis.fetch=async(url,options)=>{
 if(url.includes('/api/v1/key'))return Response.json({});
 if(url.includes('hacklily'))return {status:101,webSocket:new Socket()};
 if(url.includes('/chat/completions')){paid++;const b=JSON.parse(options.body);const complete=b.messages[0].content.includes('Vervollständige');const content=complete?suffix:prefix;return Response.json({model:'google/gemini-4-argon',error:providerError?{message:'provider failure'}:undefined,choices:[{message:{content},finish_reason:complete?finish:'error'}],usage:{cost:.01,prompt_tokens:10,completion_tokens:20}});}
 throw Error(url);
};
const call=(path,data)=>worker.fetch(new Request('https://lab.test'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{}),env,{waitUntil:p=>tasks.push(p)});
const value=async(path,data)=>{const r=await call(path,data);const d=await r.json();assert(r.ok,JSON.stringify(d));return d;};
const input={key:'sk-or-v1-TEST',task:'Ein Takt Klavier',model:'google/gemini-4-argon',compositionReasoning:'high',runId:'cc18000020261018aabbccddeeff0001'};
const response=await call('/api/run-stream',input);const events=(await response.text()).trim().split('\n').map(JSON.parse);await Promise.all(tasks);
const partial=events.at(-1).result;assert(partial.compiled.incomplete);assert.equal(partial.answer,prefix);assert.equal(events.at(-1).status,422);assert.equal((await value('/api/run-status?runId='+input.runId)).status,'failed');
const client=new RunClient({storage:{setItem(){},getItem(){return null;}}});assert.equal(client.finish(422,partial).answer,prefix);
const original=structuredClone((await value('/api/history/'+partial.historyId)).entry);
const completion={...input,operation:'complete',historyId:partial.historyId,code:prefix,runId:'cc18000020261018aabbccddeeff0002'};
const recovered=await value('/api/run',completion);assert(!recovered.compiled.incomplete,JSON.stringify(recovered.compiled));assert(recovered.compiled.url);assert.equal(recovered.answer,prefix+suffix);assert.equal(recovered.recovery.prefixLength,prefix.length);assert.equal(recovered.recovery.originalHistoryId,partial.historyId);assert.equal(recovered.recoveryStages[0].actualModel,'google/gemini-4-argon');assert.equal(recovered.costs.composition+recovered.costs.realisation,.02);assert.deepEqual((await value('/api/history/'+partial.historyId)).entry,original);
const reloaded=(await value('/api/history/'+recovered.historyId)).entry;assert.equal(reloaded.techout,prefix+suffix);assert.equal(reloaded.recoveryStages.length,1);assert.equal((await value('/api/workspace')).workspace.recovery.incomplete,false);
const before=paid;const stale=await call('/api/run',{...completion,code:prefix+' edit',runId:'cc18000020261018aabbccddeeff0003'});assert.equal(stale.status,400);assert.equal(paid,before);
suffix='right = { c4 }';const rejected=await value('/api/run',{...completion,runId:'cc18000020261018aabbccddeeff0004'});assert(rejected.compiled.incomplete);assert.equal(rejected.answer,prefix);assert(rejected.compiled.error.includes('neu definiert'));assert.equal(rejected.costs.composition+rejected.costs.realisation,.02);
suffix=' d4';finish='length';const again=await value('/api/run',{...completion,runId:'cc18000020261018aabbccddeeff0005'});assert(again.compiled.incomplete);assert.equal(again.answer,prefix+' d4');assert.equal(again.recoveryStages.length,1);
suffix=" e4 f4 }\n\\score { { c'1 } \\midi {} \\layout {} }";finish='stop';const last=await value('/api/run',{...completion,historyId:again.historyId,code:again.answer,runId:'cc18000020261018aabbccddeeff0006'});assert(!last.compiled.incomplete);assert(last.answer.startsWith(prefix+' d4'));assert.equal(last.recoveryStages.length,2);assert.equal(last.costs.composition+last.costs.realisation,.03);
providerError=true;const bad=await value('/api/run',{...input,runId:'cc18000020261018aabbccddeeff0007'});assert(bad.compiled.incomplete);assert.equal(bad.rawAnswer,prefix);providerError=false;
const dead='cc18000020261018aabbccddeeff0008';await env.BUCKET.put('runs/'+dead+'.json',JSON.stringify({status:'running',updatedAt:new Date(Date.now()-670000).toISOString()}));await env.BUCKET.put('checkpoints/'+dead+'.json',JSON.stringify({input:{model:input.model,task:input.task,title:'Fragment'},response:{choices:[{message:{content:prefix}}],usage:{cost:.01}}}));const paidBeforeRestore=paid;const restored=await value('/api/run-status?runId='+dead);assert.equal(restored.status,'failed');assert.equal(restored.result.answer,prefix);assert.equal(restored.result.historyId,dead);assert.equal(paid,paidBeforeRestore);assert.equal((await value('/api/run-status?runId='+dead)).result.downloads[0].url,restored.result.downloads[0].url);
const diag=await value('/api/diagnosis?runId='+last.runId);assert(diag.relatedRunIds.includes(again.runId));assert(diag.entries.some(x=>x.prefixUnchanged));assert(!JSON.stringify(diag).includes('sk-or-v1-TEST'));
console.log('PASS: shipped generation/stream/status, 422 partial UI payload, exact append, original immutability, history/workspace/stages/costs, stale edits, duplicate definitions, repeated truncation, provider error and stale checkpoint recovery without paid retries.');
