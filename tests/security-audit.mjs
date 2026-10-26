import assert from 'node:assert/strict';
import {parseMidi} from '../src/midi-reader.mjs';
import {limitedBytes,limitedJson} from '../src/request-body.mjs';
import {importHistory} from '../src/history-backup.mjs';
import {readCompositionResponse} from '../src/provider-stream.mjs';
import {runStorage} from '../src/run-storage.mjs';
import {MemoryBucket} from './fixtures/memory-bucket.mjs';
import worker from '../worker/index.js';

const midi=track=>Uint8Array.from([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,0,0,0,track.length,...track]).buffer;
for(const track of [[0,255,1,127],[0,240,127],[0,144,200,64],[0,144,60],[0,255,81,3,0,0,0],[0,241,0],[128],[0,144,60,64,0,60]])assert.throws(()=>parseMidi(midi(track)),String(track));
const valid=midi([0,144,60,64,0,60,0,0,255,47,0]);assert.equal(parseMidi(valid).events.length,2);
assert.throws(()=>parseMidi(valid.slice(0,-1)));
const diagnostic=parseMidi(midi([0,144,200,64]),{allowOutOfRangeNotes:true});assert.equal(diagnostic.events[0].key,200);
assert.throws(()=>parseMidi(midi([0,144,200,200]),{allowOutOfRangeNotes:true}),'tolerance is for pitch diagnostics only');
console.log('PASS: MIDI track/event boundaries, truncated meta/system data, invalid pitch/velocity/status/tempo rejected; explicitly diagnostic pitch parsing retained.');

let cancelled=false;
const streamed=()=>new Request('https://lab.test/api/workspace',{method:'POST',duplex:'half',body:new ReadableStream({pull(c){c.enqueue(new Uint8Array(9));},cancel(){cancelled=true;}})});
await assert.rejects(limitedBytes(streamed(),16),e=>e.status===413);assert(cancelled);
for(const source of ['null','[]','0','{"bad":'])await assert.rejects(limitedJson(new Request('https://test',{method:'POST',body:source})),e=>e.status===400);
await assert.rejects(limitedBytes(new Request('https://test',{method:'POST',headers:{'Content-Length':'100'},body:'x'}),4),e=>e.status===413);
const brokenProvider=await readCompositionResponse(new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: '+ 'x'.repeat(1200001)));}}),{headers:{'Content-Type':'text/event-stream'}}));
assert.match(brokenProvider.error.message,/Ereignisgröße/);
console.log('PASS: chunked and declared request limits, JSON shape validation, oversized SSE frame rejected before unbounded accumulation.');

const env={BUCKET:new MemoryBucket()},request=(path,body)=>new Request('https://lab.test'+path,{method:'POST',body:JSON.stringify(body)});
for(const invalid of [null,[],1])assert.equal((await worker.fetch(request('/api/workspace',invalid),env,{})).status,400);
assert.equal((await worker.fetch(streamed(),env,{})).status,413);
const invalidImport=await worker.fetch(request('/api/midi-import',{base64:Buffer.from(midi([0,144,200,64])).toString('base64')}),env,{});assert.equal(invalidImport.status,400);
const pages=Array.from({length:12},(_,i)=>({label:'Notenseite '+(i+1),url:'/download/page-'+i+'.svg'}));
const saved=await (await worker.fetch(request('/api/history',{title:'12 Seiten',techout:'test',pages}),env,{})).json();
const read=await (await worker.fetch(new Request('https://lab.test/api/history/'+saved.entry.id),env,{})).json();assert.equal(read.entry.pages.length,12);
await worker.fetch(request('/api/workspace',{workspace:{pages}}),env,{});
const workspace=await (await worker.fetch(new Request('https://lab.test/api/workspace'),env,{})).json();assert.equal(workspace.workspace.pages.length,12);
await env.BUCKET.put('files/untrusted.svg','<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const svg=await worker.fetch(new Request('https://lab.test/download/untrusted.svg'),env,{});
assert.match(svg.headers.get('Content-Security-Policy'),/^sandbox;/);assert.equal(svg.headers.get('Referrer-Policy'),'no-referrer');
assert.match(svg.headers.get('Content-Disposition'),/^attachment;/);
console.log('PASS: bad API objects and MIDI imports return client errors; all 12 score pages survive history/workspace; SVG attachment has sandbox policy.');

const entry={id:'aaaabbbbccccdddd',draft:'',techout:'score',downloads:[{url:'/download/score.ly',label:'LilyPond'}],runId:'aaaabbbbccccdddd'};
const backup={format:'LilyPond-Composition-Lab.backup',version:1,entries:[entry],artifacts:{'/download/score.ly':btoa('score')},diagnostics:[]};
for(const changes of [{correctionStages:[null]},{recoveryStages:{}},{downloads:[{url:'javascript:alert(1)',label:'bad'}]},{ideaStage:'wrong'},{updatedAt:{}},{createdAt:'kein Datum'}]){
 let writes=0;
 await assert.rejects(importHistory({...backup,entries:[{...entry,...changes}]},{entries:async()=>[],workspace:async()=>null,saveFile:async()=>{writes++;},saveEntry:async()=>{writes++;}}));assert.equal(writes,0);
}
console.log('PASS: malformed backup stages and references fail before any write.');

// Separate module instances and shared conditional storage model separate workers.
const first=await import('../src/run-session.mjs?audit-first'),second=await import('../src/run-session.mjs?audit-second');
const io={...runStorage(new MemoryBucket()),log:async()=>{}};let executions=0,release,started;
const gate=new Promise(r=>release=r),entered=new Promise(r=>started=r);
const execute=async()=>{executions++;started();await gate;return Response.json({answer:'exactly once'});};
const req=()=>new Request('https://test/api/run',{method:'POST',body:'{}'});
const one=first.synchronousRun(req(),{},{},'audit-once',execute,io);await entered;
const duplicate=await second.synchronousRun(req(),{},{},'audit-once',execute,io);assert.equal(duplicate.status,409);
const streamDuplicate=await second.streamRun(req(),{},{},'audit-once',execute,io);assert((await streamDuplicate.json()).resume);
release();assert.equal((await (await one).json()).answer,'exactly once');
assert.equal((await (await second.synchronousRun(req(),{},{},'audit-once',execute,io)).json()).answer,'exactly once');assert.equal(executions,1);
console.log('PASS: synchronous/synchronous and synchronous/streaming duplicates share one durable claim; completed result replayed without a new execution.');
