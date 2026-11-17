import assert from 'node:assert/strict';
import {ensureMidiInstruments} from '../src/notation-layout.mjs';

const serenade=String.raw`\score { <<
 \new Staff \with { instrumentName = "Violine" } { \staffA }
 \new Dynamics { \expressionA }
 \new PianoStaff \with { instrumentName = "Klavier" shortInstrumentName = "Kl." } <<
  \new Staff { \staffB }
  \new Dynamics { \expressionB }
  \new Staff { \staffC }
 >> >> \layout {} \midi {} }`;
const fixed=ensureMidiInstruments(serenade);
assert.equal(fixed.added,3);
assert.match(fixed.code,/instrumentName = "Violine"[^}]*midiInstrument = "violin"/);
assert.equal((fixed.code.match(/midiInstrument = "acoustic grand"/g)||[]).length,2);
assert.equal(ensureMidiInstruments(fixed.code).added,0,'correction must be idempotent');
const explicit=String.raw`\new Staff \with { instrumentName = "Violine" midiInstrument = "flute" } { c'4 }`;
assert.equal(ensureMidiInstruments(explicit).code,explicit,'explicit MIDI instrument must win');
const unknown=String.raw`\new Staff \with { instrumentName = "Spezialinstrument" } { c'4 }`;
assert.equal(ensureMidiInstruments(unknown).code,unknown,'unknown names must remain untouched');
console.log('PASS: MIDI instrument assignments and preservation');
