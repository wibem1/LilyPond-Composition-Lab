import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../worker/index.js';
import {APP_VERSION,RELEASE_DATE,MIDI_TIMING_POLICY} from '../src/app-config.mjs';
import {currentSystem,DEFAULT_SYSTEM} from '../src/composition-defaults.mjs';
import {OCTAVE_RULE} from '../src/composition-workflow.mjs';
const get=path=>worker.fetch(new Request('https://test.local'+path),{},{});
const html=await (await get('/')).text();
assert(html.includes('V'+APP_VERSION));assert(html.includes(RELEASE_DATE));assert(!html.includes('{{VERSION}}'));
const old=JSON.parse(await readFile('tests/fixtures/legacy-prompts.json','utf8'));
for(const text of [...Object.values(old),old.expression+OCTAVE_RULE])assert.equal(currentSystem(text),DEFAULT_SYSTEM);
assert.equal(currentSystem('Eigene Vorgaben: mehr Legato.'),'Eigene Vorgaben: mehr Legato.');
assert.equal(currentSystem(DEFAULT_SYSTEM),DEFAULT_SYSTEM);
assert.equal(MIDI_TIMING_POLICY,'independent-voices-v1','working MIDI files must not be invalidated by a cosmetic release');
// Follow the app's actual import graph, including relative imports of the new
// shared defaults, to catch a missing browser asset despite a successful bundle.
const seen=new Set();
async function check(path){
 if(seen.has(path))return;seen.add(path);const r=await get(path);assert.equal(r.status,200,path);assert(r.headers.get('Content-Type').includes('javascript'),path);
 const code=await r.text();for(const m of code.matchAll(/\bfrom\s*['"]([^'"]+\.mjs)['"]/g)){const p=new URL(m[1],'https://test.local'+path);if(p.origin==='https://test.local')await check(p.pathname);}
}
await check('/app.mjs');
const ids=Array.from(html.matchAll(/\bid="([^"]+)"/g),m=>m[1]);assert.equal(new Set(ids).size,ids.length,'no duplicate controls');
for(const m of html.matchAll(/\bfor="([^"]+)"/g))assert(ids.includes(m[1]),'label target '+m[1]);
console.log('PASS: release identity, exact legacy/default compatibility, unchanged MIDI contract, complete browser import graph and labeled controls.');
