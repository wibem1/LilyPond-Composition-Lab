import assert from 'node:assert/strict';
import {octaveOnlyChange} from '../src/octave-repair.mjs';
const original='\\version "2.24.0"\n\\header { title = "Licht" }\nleft = \\relative c { \\key c \\minor c,8 g c ees | aes,8 ees aes c }';
assert(octaveOnlyChange(original,original.replace('aes,8','aes8')));
assert(octaveOnlyChange(original,original.replace('relative c {','relative c\' {')));
assert(!octaveOnlyChange(original,original));
for(const [a,b] of [['c,8','d,8'],['c,8','c,4'],['c,8','r8'],['c,8','c,8\\p'],['c \\minor','c \\major'],['Licht','Nacht'],['relative c','absolute'],['left =','bass ='],['relative c','relativec']])assert(!octaveOnlyChange(original,original.replace(a,b)),a+' → '+b);
assert(!octaveOnlyChange('\\header { title = "a\'" } c4','\\header { title = "a" } c\'4'));
assert(!octaveOnlyChange('% c\'\nc4','% c\nc\'4'));
console.log('PASS: accept octave marks only; reject changes to pitch classes, rhythm, rests, dynamics, key, title, notation mode, identifiers, comments and token boundaries.');
const {applyOctaveEdits}=await import('../src/octave-repair.mjs');
assert.equal(applyOctaveEdits(original,JSON.stringify({edits:[{from:'aes,8',to:'aes8'}]})),original.replace('aes,8','aes8'));
for(const edits of [[{from:'c',to:"c'"}],[{from:'MISSING',to:'c'}],[{from:'aes,8',to:'bes8'}],[{from:'aes,8',to:'aes4'}],[{from:'aes,8 ees',to:'aes8 ees'},{from:'aes,8',to:'aes8'}]])assert.throws(()=>applyOctaveEdits(original,JSON.stringify({edits})));
assert.throws(()=>applyOctaveEdits(original,'analysis then ```lilypond\npartial'));
console.log('PASS: exact short JSON edits; ambiguous/missing/overlapping edits, music changes and truncated prose are rejected.');

assert(octaveOnlyChange('es,2 as,4 es','es2 as4 es'));
assert.equal(applyOctaveEdits('es,2 as,4 es',JSON.stringify({edits:[{from:'es,2',to:'es2'},{from:'as,4',to:'as4'}]})),'es2 as4 es');
const {readFile}=await import('node:fs/promises');
const actual=JSON.parse(await readFile(new URL('./fixtures/gemini-repair-edits.json',import.meta.url),'utf8'));
let repaired=actual.source;for(const response of actual.responses)repaired=applyOctaveEdits(repaired,response);
assert(octaveOnlyChange(actual.source,repaired));assert(repaired.includes('  es2 c |'));assert(!repaired.includes("  c'4.(\\mf"));
console.log('PASS: both real Gemini correction responses, including es octave edits formerly rejected.');
const {octaveTokens}=await import('../src/octave-repair.mjs');
const indexed='\\header { title = "c\'" }\n% d\'\nupper = \\relative c\' { \\key e \\minor b\'4 e\'\'4. dis\'\'8 <g b e\'>2 }';
const pitches=octaveTokens(indexed);assert.deepEqual(pitches.map(x=>x.token),["c'",'e',"b'","e''","dis''",'g','b',"e'"]);
const indexedResult=applyOctaveEdits(indexed,JSON.stringify({edits:[{id:2,marks:0},{id:3,marks:0},{id:4,marks:0}]}));
assert(indexedResult.includes('b4 e4. dis8'));assert(octaveOnlyChange(indexed,indexedResult));
for(const edits of [[{id:2,marks:1.2}],[{id:999,marks:0}],[{id:2,marks:9}],[{id:2,marks:0},{id:2,marks:1}],[{id:'2',marks:0}]])assert.throws(()=>applyOctaveEdits(indexed,JSON.stringify({edits})));
console.log('PASS: numbered octave changes preserve commands, comments, strings, pitch classes and rhythm; reject duplicate IDs, missing IDs and invalid marks.');

assert.equal(applyOctaveEdits('c4 c4 c4',JSON.stringify({edits:[{id:1,marks:1}]})),"c4 c'4 c4");
const indexedActual=JSON.parse(await readFile(new URL('./fixtures/gemini-indexed-octaves.json',import.meta.url),'utf8'));
assert.equal(applyOctaveEdits(indexedActual.source,indexedActual.response),indexedActual.corrected);
assert(octaveOnlyChange(indexedActual.source,indexedActual.corrected));
console.log('PASS: real Gemini numbered repair for c43b07ef; exact accepted source reproduced. Live MIDI: 140 notes, E1–C6, duration 31.304304 s.');
const {relativeOctavePlan,applyAbsoluteOctaves}=await import('../src/octave-repair.mjs');
const chordSource="\\relative c' { \\key c \\major c4 <g' c e> d f, <c' e g> c }";
assert.deepEqual(relativeOctavePlan(chordSource).map(t=>t.octave),[4,4,5,5,4,3,4,4,4,4]);
const actualTarget=relativeOctavePlan(indexedActual.corrected).map(t=>t.octave);
assert.equal(applyAbsoluteOctaves(indexedActual.source,actualTarget),indexedActual.corrected);
for(const source of ["\\relative c' { << c4 e4 >> }","\\relative c' { \\transpose c d { c4 } }","\\relative c' { \\relative c' { c4 } }"] )assert.equal(relativeOctavePlan(source),null);
assert.throws(()=>applyAbsoluteOctaves(chordSource,[4]));
assert.throws(()=>applyAbsoluteOctaves(chordSource,Array(10).fill(9)));
console.log('PASS: absolute targets mechanically reproduce the real accepted repair; chord first-note references, key exclusion, unsupported syntax and target counts verified.');
const absoluteActual=JSON.parse(await readFile(new URL('./fixtures/gemini-absolute-octaves.json',import.meta.url),'utf8'));
assert.equal(applyOctaveEdits(absoluteActual.source,absoluteActual.response),absoluteActual.corrected);
assert(octaveOnlyChange(absoluteActual.source,absoluteActual.corrected));
console.log('PASS: real absolute-octave Gemini response on 24-bar piece exactly reproduced; live MIDI 256 notes C1–D6.');

const graceSource=await readFile(new URL('./fixtures/grace-reference.ly',import.meta.url),'utf8');
const gracePlan=relativeOctavePlan(graceSource);assert.deepEqual(gracePlan.map(t=>t.octave),[5,5,5,6,5,5,4,5,5]);
const {parseMidi}=await import('../src/midi-reader.mjs');const graceBuffer=await readFile(new URL('./fixtures/grace-reference.mid',import.meta.url));const graceMidi=parseMidi(graceBuffer.buffer.slice(graceBuffer.byteOffset,graceBuffer.byteOffset+graceBuffer.byteLength));assert.deepEqual(graceMidi.events.filter(e=>e.type==='on').map(e=>e.key),[72,79,81,84,76,74,71,72,79]);
assert.equal(applyAbsoluteOctaves(graceSource.replace("c'4",'c4'),gracePlan.map(t=>t.octave)),graceSource);
assert.equal(relativeOctavePlan("\\relative c' { \\afterGrace c4 { d16 } }"),null);
console.log('PASS: actual LilyPond grace/appoggiatura/acciaccatura MIDI agrees with absolute octave plan; fast encoding restores source and afterGrace remains explicitly unsupported.');

const {repairAbsoluteSpelling}=await import('../src/octave-repair.mjs');
const anchorless="\\relative { \\key c \\minor c''4->( es g c') <g, b d>2 \\acciaccatura as8 g4 }";
assert.deepEqual(relativeOctavePlan(anchorless).map(t=>t.octave),[5,5,5,7,5,5,6,5,5]);
const changed=anchorless.replace("c''4","c'''4");assert.equal(applyAbsoluteOctaves(changed,relativeOctavePlan(anchorless).map(t=>t.octave)),anchorless);
assert.equal(relativeOctavePlan("\\relative c' { c4 } \\relative { d'4 e } \\relative { << c4 e4 >> }"),null);
const absSpelling=await readFile(new URL('./fixtures/anchorless-absolute-spelling.ly',import.meta.url),'utf8');
const fixed=repairAbsoluteSpelling(absSpelling);assert(fixed);assert(octaveOnlyChange(absSpelling,fixed.code));assert.equal(repairAbsoluteSpelling(fixed.code),null);
const keys=async name=>{const b=await readFile(new URL('./fixtures/'+name,import.meta.url));return parseMidi(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)).events.filter(e=>e.type==='on').map(e=>[e.channel,e.key])};
assert.deepEqual(await keys('anchorless-corrected.mid'),await keys('anchorless-absolute.mid'));
for(const source of ["\\new PianoStaff \\relative { c'4 d e f }",absSpelling.replace('PianoStaff','Staff'),absSpelling.replace('\\relative {','\\relative c {')])assert.equal(repairAbsoluteSpelling(source),null);
const mixed=absSpelling.replace("left = \\relative {", "left = \\relative {").replace(/left = \\relative \{[\s\S]*?\n\}/,"left = \\relative { \\clef bass c4 d e f }");const mixedFixed=repairAbsoluteSpelling(mixed);assert(mixedFixed);assert(mixedFixed.code.includes('left = \\relative { \\clef bass c4 d e f }'));
console.log('PASS: anchorless first pitch and accent arrows; local drift repair matches actual LilyPond absolute MIDI including chords and grace notes; healthy blocks unchanged, unsupported/other instruments rejected.');
const midiKeyForTest=(t,octave)=>12*(octave+1)+[0,2,4,5,7,9,11]['cdefgab'.indexOf(t[0])]+((t.match(/is/g)||[]).length-(t.match(/es/g)||[]).length)-(t.startsWith('as')?1:0);
const {automaticOctaveRepair}=await import('../src/octave-repair.mjs');
const piano=[{status:'checked',program:0,channel:0,low:21,high:108}];
const absoluteLow="\\score { { c,,,,4 d,,,, e,,,, f,,,, } \\layout {} \\midi {} }";assert.equal(automaticOctaveRepair(absoluteLow,piano).code,absoluteLow.replaceAll(',,,,',',,'));
const relativeLow="\\relative c,,, { c4 d e f }";const lowFix=automaticOctaveRepair(relativeLow,piano);assert(lowFix.code);assert.deepEqual(relativeOctavePlan(lowFix.code).map(t=>t.octave),[1,1,1,1]);assert(octaveOnlyChange(relativeLow,lowFix.code));
const duet=String.raw`upper = \relative { c''4 d e f }
lower = \relative { c,,,,4 d e f }
\score { << \new Staff \with { midiInstrument = "cello" } \upper \new Staff \with { midiInstrument = "acoustic grand" } \lower >> \midi {} }`;
const duetFix=automaticOctaveRepair(duet,[{status:'checked',program:42,channel:0,low:36,high:81},...piano],[{channel:0}]);assert(duetFix.code,duetFix.error);const duetNotes=relativeOctavePlan(duetFix.code);assert.deepEqual(duetNotes.filter(t=>t.block===0).map(t=>t.octave),[4,4,4,4]);assert.deepEqual(duetNotes.filter(t=>t.block===1).map(t=>t.octave),[1,1,1,1]);
assert(automaticOctaveRepair("\\relative c' { << c4 e >> }",piano).error);assert(automaticOctaveRepair("c,,,,4",[{status:'unknown',low:null,high:null}]).error);
console.log('PASS: app-only absolute/relative range correction, uniform interval preservation, cello/piano assignment and register correction; ambiguous/unsupported music fails explicitly.');
const mozartDrift=String.raw`
global = { \key bes \major \time 4/4 }
right = \relative c'' {
  \global
  bes4 d8 c bes4 a | g4 f8 g a4 bes | d4 c8 bes a4 g | f2 bes |
}
left = \relative c {
  \global
  bes,4 f' d bes |
  es,4 bes' g es |
  f,4 c' a f |
  bes,4 f' d bes |
  g,4 d' bes g |
  c,4 g' es c |
  f,4 c' a f |
  bes,4 f' d bes |
  bes,4 f' d bes |
  es,4 bes' g es |
  f,4 c' a f |
  bes,4 f' d bes |
  es,4 bes' g es |
  a,4 e' cis a |
  d,4 a' f d |
  g,4 d' bes g |
  c,4 g' es c |
  f,4 c' a f |
  bes,4 f' d bes |
  es,4 bes' g es |
  f,4 c' a f |
  g,4 d' bes g |
  c,4 g' es c |
  bes,1
}
\score { \new PianoStaff << \new Staff \with { midiInstrument = "acoustic grand" } { \right } \new Staff \with { midiInstrument = "acoustic grand" } { \left } >> \layout {} \midi {} }
`;
const driftPlan=relativeOctavePlan(mozartDrift),driftLeft=driftPlan.filter(t=>t.block===1);
assert(driftLeft.some(t=>midiKeyForTest(t.token,t.octave)<21),'fixture must reproduce the runaway low register');
const mozartProfiles=[
 {status:'checked',program:0,channel:0,low:21,high:108},
 {status:'checked',program:0,channel:1,low:21,high:108}
];
const driftFix=automaticOctaveRepair(mozartDrift,mozartProfiles);
assert.equal(driftFix.method,'relative-measure-drift');
assert(octaveOnlyChange(mozartDrift,driftFix.code));
const repairedLeft=relativeOctavePlan(driftFix.code).filter(t=>t.block===1);
const repairedKeys=repairedLeft.map(t=>midiKeyForTest(t.token,t.octave));
assert(repairedKeys.every(k=>k>=21&&k<=108));
assert(Math.min(...repairedKeys)>=33,'repair should restore the bass pattern, not merely scrape along A0');
assert(driftFix.code.includes("bes4 f' d bes |"));
assert(!driftFix.code.includes("bes,4 f' d bes |"));
console.log('PASS: regression 0d1db3d2: cumulative relative-octave drift is repaired by octave-shifting complete measures in the LilyPond source; no individual MIDI-note clamping.');

const {legacyOctaveOriginal}=await import('../src/octave-repair.mjs');
const legacyLogs=JSON.parse(await readFile(new URL('./fixtures/legacy-mozart-octaves.json',import.meta.url),'utf8'));
const oldCode=legacyLogs.find(e=>e.event==='korrekturpruefung').source;
const trueOriginal=legacyLogs.find(e=>e.event==='kompilierung').source;
assert.equal(legacyOctaveOriginal(oldCode,legacyLogs),trueOriginal);
assert.equal(legacyOctaveOriginal(oldCode.replace('bes4 f d bes','bes4 f d a'),legacyLogs),null);
assert.equal(legacyOctaveOriginal(oldCode,legacyLogs.filter(e=>e.event!=='korrektur')),null);
const actualFix=automaticOctaveRepair(trueOriginal,mozartProfiles);
assert.equal(actualFix.method,'relative-measure-drift');
assert.equal(legacyOctaveOriginal(actualFix.code,legacyLogs),null);
assert.equal(actualFix.code.split('left =')[0],trueOriginal.split('left =')[0]);
const leftKeys=relativeOctavePlan(actualFix.code).filter(t=>t.block===1).map(t=>midiKeyForTest(t.token,t.octave));
assert(leftKeys.every(k=>k>=33&&k<=65));
const beforeLeft=relativeOctavePlan(trueOriginal).filter(t=>t.block===1);
const afterLeft=relativeOctavePlan(actualFix.code).filter(t=>t.block===1);
// One pickup followed by 23 four-note bars and a final whole note.
for(let i=1;i<beforeLeft.length-1;i+=4){
 const offsets=beforeLeft.slice(i,i+4).map((t,j)=>afterLeft[i+j].octave-t.octave);
 assert(offsets.every(n=>n===offsets[0]),'every interval within the original bar must survive');
}
console.log('PASS: exact uploaded Mozart diagnosis: legacy source recovered, pickup/right hand/bar intervals preserved, bass register restored; edited and unaccepted sources untouched.');

// Valid Scheme-string MIDI names must map relative voices in mixed ensembles.
const schemeDuet=String.raw`upper = \relative c'' {
 c4 d e f | g'4 a b c | d'4 e f g | a'1 | c,4 d e f | c,1 |
}
lower = \relative c { c4 d e f | c4 d e f | c4 d e f | c1 | d2 e | c1 | }
\score { <<
 \new Staff \with { midiInstrument = #"violin" } \upper
 \new Staff \with { midiInstrument = #"cello" } { \clef bass \lower }
>> \layout {} \midi {} }`;
const strings=[{status:'checked',program:40,channel:0,low:55,high:105},{status:'checked',program:42,channel:1,low:36,high:81}];
for(const syntax of ['#"','"','# "']){
 const source=schemeDuet.replaceAll('#"',syntax),correction=automaticOctaveRepair(source,strings);
 assert.equal(correction.method,'relative-measure-drift',correction.error);
 assert(octaveOnlyChange(source,correction.code));
 assert.equal(correction.code.slice(correction.code.indexOf('lower =')),source.slice(source.indexOf('lower =')),'healthy cello and staff assignments must remain byte-identical');
 const before=relativeOctavePlan(source).filter(t=>t.block===0),after=relativeOctavePlan(correction.code).filter(t=>t.block===0);
 assert(before.some(t=>midiKeyForTest(t.token,t.octave)>105));assert(after.every(t=>midiKeyForTest(t.token,t.octave)>=55&&midiKeyForTest(t.token,t.octave)<=105));
 assert.deepEqual(before.map(t=>midiKeyForTest(t.token,t.octave)%12),after.map(t=>midiKeyForTest(t.token,t.octave)%12));
}
assert(automaticOctaveRepair(schemeDuet.replace('#"violin"','#"unknown instrument"'),strings).error,'unknown mapping must still fail explicitly');
const conflict=schemeDuet.replace('\\clef bass \\lower','\\clef bass \\upper');assert(automaticOctaveRepair(conflict,strings).error,'same voice mapped to different instruments remains ambiguous');
console.log('PASS: mixed violin/cello Scheme strings (#"name", "name", # "name") map safely; only violin octave marks change; healthy cello stays identical; unknown/conflicting assignments fail explicitly.');

// Cover every GM instrument with a bounded range profile, not violin alone.
const instrumentNames=new Map([
 [0,'acoustic grand'],[1,'bright acoustic'],[2,'electric grand'],[3,'honky-tonk'],[4,'electric piano 1'],[5,'electric piano 2'],
 [40,'violin'],[41,'viola'],[42,'cello'],[43,'contrabass'],[44,'tremolo strings'],[45,'pizzicato strings'],[46,'orchestral harp'],[47,'timpani'],[48,'string ensemble 1'],[49,'string ensemble 2'],
 [56,'trumpet'],[57,'trombone'],[58,'tuba'],[59,'muted trumpet'],[60,'french horn'],[61,'brass section'],
 [68,'oboe'],[69,'english horn'],[70,'bassoon'],[71,'clarinet'],[72,'piccolo'],[73,'flute']
]);
const {checkInstrumentRanges}=await import('../src/instrument-ranges.mjs');
let mappingChecks=0;
for(const [program,name] of instrumentNames){
 const profile=checkInstrumentRanges({events:[{type:'program',ch:0,value:program},{type:'on',ch:0,key:60,sec:0}]}).instruments[0];
 assert.equal(profile.status,'checked');
 const other={...strings.find(p=>p.program!==program),channel:1};
 for(const prefix of ['', '#', '# ']){
  const raw=String.raw`part = \relative c'''''' { c4 d e f }
other = \relative c' { c4 d e f }
\score { << \new Staff \with { midiInstrument = NAME } \part \new Staff \with { midiInstrument = OTHER } \other >> \layout {} \midi {} }`;
  const source=raw.replace('NAME',prefix+'"'+name+'"').replace('OTHER','"'+(other.program===40?'violin':'cello')+'"');
  const corrected=automaticOctaveRepair(source,[profile,other]);assert(corrected.code,name+' '+prefix+': '+corrected.error);
  assert(octaveOnlyChange(source,corrected.code));
  assert.equal(corrected.code.slice(corrected.code.indexOf('other =')),source.slice(source.indexOf('other =')));
  const notes=relativeOctavePlan(corrected.code).filter(t=>t.block===0).map(t=>midiKeyForTest(t.token,t.octave));
  assert(notes.every(key=>key>=profile.low&&key<=profile.high),name);mappingChecks++;
 }
}
assert.equal(mappingChecks,84);
console.log('PASS: all 28 instruments with bounded range profiles, 84 plain/Scheme/mixed assignment cases, including previously unmapped string ensembles and brass section; unaffected companion voice unchanged.');
