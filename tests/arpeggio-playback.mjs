import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseMidi} from '../src/midi-reader.mjs';
import {expressionPlayback} from '../src/expression-playback.mjs';
const b=await readFile('tests/fixtures/arpeggio.mid');const m=parseMidi(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
const on=m.events.filter(e=>e.type==='on'),off=m.events.filter(e=>e.type==='off');
const window=(t,len=.3)=>on.filter(e=>e.sec>=t-.001&&e.sec<t+len);
const keys=a=>a.map(e=>e.key);
assert.deepEqual(keys(window(0)),[60,64,67]);assert.deepEqual(keys(window(4)),[67,64,60]);
assert.deepEqual(keys(window(6)),[60,64,67]);assert.deepEqual(keys(window(12)),[67,64,60]);assert.deepEqual(keys(window(14)),[60,64,67]);
for(const t of [8,25+1/3])assert(window(t).every(e=>e.tick===window(t)[0].tick),'non-arpeggiated bracket attacks together');
for(const t of [16,29+1/3]){assert.deepEqual(keys(window(t)),[48,52,55,60,64,67]);assert(window(t).every((e,i,a)=>!i||e.tick>a[i-1].tick));}
for(const t of [20,31+1/3]){const a=window(t);assert.equal(a[0].tick,a[1].tick,'independent staves begin together');}
assert.deepEqual(keys(window(33+1/3)),[67,64,60,55,52,48],'connected downward roll');
assert(window(24).at(-1).sec-window(24)[0].sec<.021,'short notes cap total roll');
assert.equal(window(2)[0].sec,2,'following chord stays on beat');
const first=window(0);for(const n of first){const end=off.find(e=>e.ch===n.ch&&e.key===n.key&&e.tick>n.tick);assert(end.sec>first.at(-1).sec,'notes remain held during roll');assert(Math.abs(end.sec-1.875)<.003,'common original release');}
assert.deepEqual(keys(window(37+1/3,3.9)),[60,64,67],'tied continuation has no new attack');
for(const n of window(37+1/3)){assert(off.find(e=>e.key===n.key&&e.ch===0&&e.tick>n.tick).sec>41.2,'all tied tones sustain');}
assert.deepEqual(m.events.filter(e=>e.type==='control'&&e.cc===64).map(e=>e.value),[127,0],'pedal survives rolled voices');
assert(window(43+1/3).every(e=>e.vel>window(41+1/3)[0].vel),'p/f applies to every rolled tone');
const source=await readFile('tests/fixtures/arpeggio.ly','utf8');const transformed=expressionPlayback(source);assert(transformed.code.includes('\\labArpeggioPlayback \\articulate'));assert(transformed.code.includes(source.slice(source.indexOf('\\score')).replace('\\midi {}','')));
console.log('PASS: real LilyPond 2.26 MIDI: up/down, one-shot direction, bracket, connected/independent staves, short-note spread, held notes, ties, dynamics and sustain pedal; original score retained.');
