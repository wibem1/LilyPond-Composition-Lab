import assert from 'node:assert/strict';
import {claimRun} from '../src/run-claim.mjs';
// Separate module instances model independent isolate-local guard maps.
const a=await import('../src/run-session.mjs?isolate=a');
const b=await import('../src/run-session.mjs?isolate=b');
const objects=new Map();let claims=0;
const bucket={async put(key,value,options){
 assert.equal(options.onlyIf.get('If-None-Match'),'*');claims++;
 if(objects.has(key))return null;
 objects.set(key,value);return {etag:'mock'};
}};
const states=new Map();
const io={claim:id=>claimRun(bucket,id),read:async k=>structuredClone(states.get(k)||null),write:async(k,v)=>states.set(k,structuredClone(v)),log:async()=>{}};
let calls=0,release;const gate=new Promise(r=>release=r),tasks=[];
const start=module=>module.streamRun(new Request('https://test/run'),{},{waitUntil:p=>tasks.push(p)},'same-id',async()=>{calls++;await gate;return Response.json({answer:'once'});},io);
const [one,two]=await Promise.all([start(a),start(b)]);
assert.equal((await two.json()).resume,true);assert.equal(claims,2);
await one.body.cancel();release();await Promise.all(tasks);assert.equal(calls,1);
assert.equal((await a.readRunSession('same-id',io)).result.answer,'once');
// Lost run-state write after reservation: preserve reservation and never repeat.
const broken={...io,write:async()=>{throw Error('storage down');}};
await assert.rejects(a.streamRun(new Request('https://test'),{}, {},'uncertain',()=>{calls++;},broken),/storage down/);
const retry=await b.streamRun(new Request('https://test'),{}, {},'uncertain',()=>{calls++;},io);
assert.equal((await retry.json()).resume,true);assert.equal(calls,1);
await assert.rejects(a.streamRun(new Request('https://test'),{},{},'no-storage',()=>{calls++;},{...io,claim:async()=>{throw Error('unavailable');}}),/unavailable/);
assert.equal(calls,1);
console.log('PASS: persistent conditional reservation deduplicates separate isolates; storage failures fail closed without repeating provider work (simulated R2).');
