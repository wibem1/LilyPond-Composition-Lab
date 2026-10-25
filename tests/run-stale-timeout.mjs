import assert from 'node:assert/strict';
import {readRunSession} from '../src/run-session.mjs';

async function inspect(ageMs) {
  const logs = [];
  const saved = [];
  const state = {status:'running',phase:'KI komponiert',updatedAt:new Date(Date.now()-ageMs).toISOString()};
  const io = {
    read:async()=>state,
    write:async(_path,value)=>saved.push({...value}),
    log:async(...args)=>logs.push(args),
  };
  const result = await readRunSession('sample-run',io);
  return {result,logs,saved};
}

const pending=await inspect(95_000);
assert.equal(pending.result.status,'running','A 95-second idle period must not interrupt a valid 10-minute stream');
assert.equal(pending.saved.length,0);
assert.equal(pending.logs.length,0);

const stale=await inspect(670_000);
assert.equal(stale.result.status,'interrupted','A run without updates for over 11 minutes must be flagged');
assert.equal(stale.saved.length,1);
assert.equal(stale.logs[0][0],'lauf_unterbrochen');
console.log('PASS: long-running jobs are not interrupted prematurely.');
