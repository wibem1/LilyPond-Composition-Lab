import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {expressionPlayback} from '../src/expression-playback.mjs';
import {parseMidi} from '../src/midi-reader.mjs';

const load=async path=>{const b=await readFile(path);return parseMidi(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const source=await readFile('tests/fixtures/gaenseliesel.ly','utf8');
const transformed=expressionPlayback(source);
assert(transformed.code.includes('\\labArpeggioPlayback \\labArticulateVoices \\labTrillSetup'));
assert(transformed.code.includes(source.slice(source.indexOf('\\score')).replace('\\midi {}','')),'printed notation unchanged');
const old=await load('tests/fixtures/gaenseliesel-before.mid');
let fixed=await load('tests/fixtures/gaenseliesel-synced.mid');
if(process.env.LILYPOND_BIN){
 const dir=await mkdtemp(join(tmpdir(),'lab-sync-'));
 try{
  const input=join(dir,'score.ly'),output=join(dir,'score');
  await writeFile(input,transformed.code);
  const result=spawnSync(process.env.LILYPOND_BIN,['-dno-print-pages','-o',output,input],{encoding:'utf8',timeout:60000});
  assert.equal(result.status,0,result.stderr);
  assert(!/warning:|error:/i.test(result.stderr),result.stderr);
  fixed=await load(output+'.midi');
  const fixture=await load('tests/fixtures/gaenseliesel-synced.mid');
  assert.deepEqual(fixed.events,fixture.events,'fresh compiler output matches checked fixture');
 }finally{await rm(dir,{recursive:true,force:true});}
}
const notes=(m,ch)=>m.events.filter(e=>e.type==='on'&&e.ch===ch);
assert.equal(fixed.ppq,384);
for(const ch of [0,1])assert.deepEqual(notes(fixed,ch).map(e=>e.key),notes(old,ch).map(e=>e.key),'every pitch and chord tone preserved');
assert.equal(notes(fixed,0).length,213);assert.equal(notes(fixed,1).length,242);
const right=notes(fixed,0),left=notes(fixed,1);
const at=(events,tick)=>events.filter(e=>e.tick===tick);
assert.equal(at(notes(old,0),192).length,1);
assert.equal(at(notes(old,1),192).length,0,'old left hand lags');
assert.equal(at(notes(old,1),235).length,2,'43-tick old offset reproduced');
assert.equal(at(right,43)[0].key,77);assert.equal(at(left,43).length,2,'leading grace and silent placeholder delay both principal attacks together');
for(const n of left)assert(n.tick===43||n.tick%96===0,'all left-hand attacks stay on the sixteenth grid through all 32 bars');
for(let bar=1;bar<32;bar++){
 assert(at(right,bar*768).length>0,'right downbeat '+(bar+1));
 assert(at(left,bar*768).length>0,'left downbeat '+(bar+1));
}
assert.deepEqual(at(right,24192).map(e=>e.key),[65,69,77]);
assert.deepEqual(at(left,24192).map(e=>e.key),[29,41],'final chords aligned');
assert.equal(fixed.events.filter(e=>e.type==='tempo').length,5,'ritardando and a tempo retained');
console.log('PASS: Gänseliesel grace timing: reproduced old 43-tick lag, 32 aligned bars, all 455 pitches retained, leading grace skips and tempo changes.'+(process.env.LILYPOND_BIN?' Fresh LilyPond compilation verified.':''));
