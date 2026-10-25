import assert from 'node:assert/strict';
import {streamRun,readRunSession} from '../src/run-session.mjs';
import {RunClient} from '../src/run-client.mjs';
const items=new Map(),logs=[];const io={read:async k=>structuredClone(items.get(k)||null),write:async(k,v)=>items.set(k,structuredClone(v)),log:async(event,id,data)=>logs.push({event,id,...data})};
const id='abcdef1234567890';let calls=0,release;const gate=new Promise(r=>release=r),tasks=[];
const response=await streamRun(new Request('https://test/api/run-stream'),{}, {waitUntil:p=>tasks.push(p)},id,async()=>{calls++;await gate;return Response.json({answer:'Saved result',runId:id});},io);
const reader=response.body.getReader();assert((new TextDecoder().decode((await reader.read()).value)).includes('started'));await reader.cancel();release();await Promise.all(tasks);
assert.equal(calls,1);assert.equal((await readRunSession(id,io)).result.answer,'Saved result');assert(logs.some(e=>e.event==='verbindung_getrennt'));assert(logs.some(e=>e.event==='lauf_abgeschlossen'));
const duplicate=await streamRun(new Request('https://test/api/run-stream'),{}, {},id,()=>{calls++;},io);assert((await duplicate.json()).resume);assert.equal(calls,1,'reconnection never calls AI again');
items.set('runs/dead1234.json',{runId:'dead1234',status:'running',phase:'KI komponiert',updatedAt:new Date(Date.now()-670000).toISOString()});assert.equal((await readRunSession('dead1234',io)).status,'interrupted');assert(logs.some(e=>e.event==='lauf_unterbrochen'&&e.lastPhase==='KI komponiert'));
console.log('PASS: disconnected response still saves result; duplicate run ID returns saved status without executing; stale server session explicitly diagnosed.');
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const saved={runId:id,answer:'Saved result'};let starts=0,polls=0;const reported=[];
const request=async(url,options)=>{if(url==='/api/run-stream'){starts++;throw TypeError('Failed to fetch');}if(url==='/api/client-events'){reported.push(...JSON.parse(options.body).events);return Response.json({saved:true});}if(url.startsWith('/api/run-status')){polls++;return Response.json({status:polls===1?'running':'completed',phase:'Noten werden geprüft',httpStatus:200,result:saved});}throw Error(url);};
const memory=storage(),client=new RunClient({fetch:request,storage:memory,delay:async()=>{},online:()=>true});const result=await client.start({runId:id,key:'sk-or-v1-SECRET'});assert.deepEqual(result,saved);assert.equal(starts,1);assert.equal(polls,2);assert.equal(client.pendingRunId,'');assert(reported.some(e=>e.event==='network_error'));assert(reported.some(e=>e.event==='recovery_completed'));assert(!JSON.stringify([...reported,memory.getItem('lilypond-pending-run')]).includes('SECRET'));
// Reload with a persisted pending ID: only read the existing result.
const restoreStorage=storage();restoreStorage.setItem('lilypond-pending-run',JSON.stringify({runId:id}));const restored=new RunClient({fetch:request,storage:restoreStorage,delay:async()=>{},online:()=>true});assert.deepEqual(await restored.recover(),saved);assert.equal(starts,1);
// End-of-stream without result is an error; saved server result is recovered.
const broken=new RunClient({fetch:async(url,options)=>url==='/api/run-stream'?new Response('{"type":"started","phase":"KI komponiert"}\n',{headers:{'Content-Type':'application/x-ndjson'}}):request(url,options),storage:storage(),delay:async()=>{},online:()=>true});assert.deepEqual(await broken.start({runId:id}),saved);assert(reported.some(e=>e.event==='stream_error'));
const failed=new RunClient({fetch:async(url,options)=>url==='/api/client-events'?Response.json({saved:true}):Response.json({status:'failed',httpStatus:502,result:{error:'Provider failed'}}),storage:storage(),delay:async()=>{},online:()=>true});await assert.rejects(failed.recover(id),/Provider failed/);assert.equal(failed.pendingRunId,'');
console.log('PASS: browser fetch failure, truncated stream and reload recover existing result without resubmitting; client events flushed, secrets excluded, terminal server error not retried.');
// Concurrent requests in one runtime cannot both start a paid execution.
let concurrentCalls=0,unlock;const block=new Promise(r=>unlock=r),raceTasks=[];
const concurrentId='dd18000020261018aabbccddeeff0001';
const start=()=>streamRun(new Request('https://test/run'),{},{waitUntil:p=>raceTasks.push(p)},concurrentId,async()=>{concurrentCalls++;await block;return Response.json({answer:'Once'});},io);
const [one,two]=await Promise.all([start(),start()]);assert((await two.json()).resume);unlock();await one.text();await Promise.all(raceTasks);assert.equal(concurrentCalls,1);
const absent=new RunClient({fetch:async url=>Response.json(url.startsWith('/api/run-status')?{status:'unknown'}:{saved:true}),storage:storage(),delay:async()=>{}});absent.write('lilypond-pending-run',{runId:concurrentId});await assert.rejects(absent.recover(),/nicht bestätigt/);assert.equal(absent.pendingRunId,concurrentId);
console.log('PASS: concurrent same-runtime requests execute once; unconfirmed run retains its pending marker and cannot start a new paid request.');
for(const badStatus of [{status:'unexpected'},{status:'completed'}]){
let invalidPolls=0;
const invalid=new RunClient({fetch:async url=>{
 if(url==='/api/client-events')return Response.json({saved:true});
 invalidPolls++;return Response.json(badStatus);
},storage:storage(),delay:async()=>{}});
invalid.write('lilypond-pending-run',{runId:id});
await assert.rejects(invalid.recover(),/weiterhin nicht erreichbar/);
assert.equal(invalidPolls,20);assert.equal(invalid.pendingRunId,id);
}
console.log('PASS: malformed status responses pause recovery after 20 attempts and retain the pending run for reload.');
