import assert from 'node:assert/strict';
import {runStorage} from '../src/run-storage.mjs';
import {MemoryBucket} from './fixtures/memory-bucket.mjs';
import {readRunSession} from '../src/run-session.mjs';
const bucket=new MemoryBucket(),storage=runStorage(bucket);
const first=await import('../src/run-session.mjs?isolate=1');
const second=await import('../src/run-session.mjs?isolate=2');
let calls=0,release;const gate=new Promise(resolve=>release=resolve),tasks=[];
const io={...storage,log:async()=>{}};
const execute=async()=>{calls++;await gate;return Response.json({answer:'one result'});};
const id='1234567890abcdef',start=module=>module.streamRun(new Request('https://test/run-stream'),{},{waitUntil:task=>tasks.push(task)},id,execute,io);
const responses=await Promise.all([start(first),start(second)]);
assert.equal(calls,1,'independent isolates must acquire the same durable claim');
release();await Promise.all(tasks);
const bodies=await Promise.all(responses.map(response=>response.text()));
assert.equal(bodies.filter(body=>body.includes('"resume":true')).length,1);
assert.equal((await readRunSession(id,io)).status,'completed');
// After a process restart, even a missing status file cannot authorize a replay.
await bucket.delete('runs/'+id+'.json');
const restarted=await import('../src/run-session.mjs?isolate=3');
assert((await (await start(restarted)).json()).resume);assert.equal(calls,1);
assert.equal((await restarted.readRunSession(id,io)).status,'running','claim is enough to preserve an uncertain in-flight job');
// Storage errors fail before any paid execution and release the local start lock.
let attempts=0;
const failing={...io,claim:async()=>{if(!attempts++)throw Error('storage unavailable');return false;}};
await assert.rejects(first.streamRun(new Request('https://test/'),{},{},'failure',execute,failing),/storage unavailable/);
assert((await (await first.streamRun(new Request('https://test/'),{},{},'failure',execute,failing)).json()).resume);assert.equal(calls,1);
// A stale observer cannot replace the result saved by the actual worker.
const old={status:'running',updatedAt:new Date(Date.now()-670000).toISOString()},completed={status:'completed',result:{answer:'finished'}};
await storage.write('runs/race.json',old);
let replaced=false;
const race={...io,replace:async(...args)=>{await storage.write('runs/race.json',completed);replaced=true;return storage.replace(...args);}};
assert.deepEqual(await readRunSession('race',race),completed);assert(replaced);
// Immutable claim without an initial status (crash between the two writes).
await storage.claim('orphan',old);
assert.equal((await readRunSession('orphan',io)).status,'interrupted');assert.equal(calls,1);
console.log('PASS: independent isolate claims, restart/missing status, storage failure, stale observer/final-save race, orphan claim; no paid replay.');
// Restoring an error's saved text requires no second provider execution.
const partial={answer:'saved fragment',compiled:{incomplete:true}};const recoveryTasks=[];
const recovery=await first.streamRun(new Request('https://test/'),{},{waitUntil:task=>recoveryTasks.push(task)},'recover-error',async()=>Response.json({error:'compiler unavailable'},{status:502}),{...io,restore:async()=>partial,log:async event=>{if(event==='lauf_abgeschlossen')throw Error('diagnosis storage unavailable');}});
const events=(await recovery.text()).trim().split('\n').map(JSON.parse);await Promise.all(recoveryTasks);
assert.equal(events.at(-1).status,422);assert.equal(events.at(-1).result.answer,partial.answer);
assert.equal((await readRunSession('recover-error',io)).result.answer,partial.answer);
// Failure to commit the result must close the transport without claiming success.
const failedTasks=[];let writes=0;
const failedCommit=await first.streamRun(new Request('https://test/'),{},{waitUntil:task=>failedTasks.push(task)},'failed-commit',async()=>Response.json({answer:'uncommitted'}),{...io,write:async(...args)=>{if(writes++)throw Error('write failed');return io.write(...args);}});
const failedEvents=(await failedCommit.text()).trim().split('\n').map(JSON.parse);await Promise.all(failedTasks);
assert(!failedEvents.some(event=>event.type==='result'));assert.equal((await readRunSession('failed-commit',io)).status,'running');
console.log('PASS: terminal error restores saved fragment, diagnostic failure does not hide committed result, failed final commit never claims success.');
