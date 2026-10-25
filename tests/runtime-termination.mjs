import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readRunSession,streamRun} from '../src/run-session.mjs';

// Kill an actual JS runtime rather than letting a canceled response finish in
// Node. This models the missing execution lifetime, not Cloudflare itself.
const moduleUrl=new URL('../src/run-session.mjs',import.meta.url).href;
const source=`
 import {parentPort} from 'node:worker_threads';
 import {streamRun} from ${JSON.stringify(moduleUrl)};
 const io={read:async()=>null,write:async(key,value)=>parentPort.postMessage({key,value}),log:async()=>{},claim:async()=>true};
 await streamRun(new Request('https://test/run'),{},{waitUntil(){}},'terminated-run',async()=>{
  parentPort.postMessage({checkpoint:'received fragment'});
  await new Promise(()=>{});
 },io);
`;
const runtime=new Worker(new URL('data:text/javascript,'+encodeURIComponent(source)));
const objects=new Map();let checkpoint;
try{
 await new Promise((resolve,reject)=>{
  const deadline=setTimeout(()=>reject(Error('Test runtime did not start')),5000);
  runtime.on('error',e=>{clearTimeout(deadline);reject(e);});
  runtime.on('message',m=>{if(m.key)objects.set(m.key,m.value);if(m.checkpoint){checkpoint=m.checkpoint;clearTimeout(deadline);resolve();}});
 });
}finally{await runtime.terminate();}
const key='runs/terminated-run.json';assert.equal(objects.get(key).status,'running');
assert.equal(objects.get(key).result,undefined,'terminated runtime cannot produce a final result');
objects.get(key).updatedAt=new Date(Date.now()-670000).toISOString();
let restored=0,executions=0;
const io={read:async k=>structuredClone(objects.get(k)),write:async(k,v)=>objects.set(k,structuredClone(v)),log:async()=>{},claim:async()=>false,
 restore:async()=>{restored++;return {answer:checkpoint,compiled:{incomplete:true}};}};
const result=await readRunSession('terminated-run',io);
assert.equal(result.status,'failed');assert.equal(result.result.answer,checkpoint);assert.equal(restored,1);
assert.equal((await (await streamRun(new Request('https://test/run'),{},{},'terminated-run',()=>{executions++;},io)).json()).resume,true);
assert.equal(executions,0);
console.log('PASS: forced runtime termination recovers only the stored fragment and never resubmits; full completion after termination remains a release blocker.');
