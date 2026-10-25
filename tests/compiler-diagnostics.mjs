import assert from 'node:assert/strict';
import {compilerDiagnostics,recoverableLayoutError} from '../src/compiler-diagnostics.mjs';
assert.equal(compilerDiagnostics('Parsing...\nMIDI output...').status,'passed');
const d=compilerDiagnostics("x.ly:379:12: error: unknown command: dolce\nx.ly:379:12: error: unknown command: dolce\nx.ly:401:36: warning: bar check failed at: 1/4\nNote: compilation failed");
assert.equal(d.status,'error');assert.equal(d.errors.length,2);assert.equal(d.warnings.length,1);assert(d.summary.includes('bar check failed'));
assert.equal(compilerDiagnostics('fatal error: cannot open file').status,'error');
console.log('PASS: fatal errors and rhythmic warnings recognized independently of returned files, with duplicate messages removed.');

const internal="hacklily.ly:198:16: programming error: bounds of this piece aren't breakable.\ncontinuing, cross fingers";
const assets={files:['<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>'],midi:'TUlEaQ=='};
assert.equal(compilerDiagnostics(internal).status,'error');
assert.equal(recoverableLayoutError(internal,assets),true);
assert.equal(recoverableLayoutError(internal,{...assets,midi:''}),false);
assert.equal(recoverableLayoutError(internal,{...assets,files:[]}),false);
assert.equal(recoverableLayoutError(internal+'\nx:1: error: unknown command',assets),false);
assert.equal(recoverableLayoutError('x:1: fatal error: bad source',assets),false);
console.log('PASS: internal unbreakable layout failure accepted only with both MIDI and SVG and no other errors.');
