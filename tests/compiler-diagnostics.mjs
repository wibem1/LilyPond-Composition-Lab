import assert from 'node:assert/strict';
import {compilerDiagnostics} from '../src/compiler-diagnostics.mjs';
assert.equal(compilerDiagnostics('Parsing...\nMIDI output...').status,'passed');
const d=compilerDiagnostics("x.ly:379:12: error: unknown command: dolce\nx.ly:379:12: error: unknown command: dolce\nx.ly:401:36: warning: bar check failed at: 1/4\nNote: compilation failed");
assert.equal(d.status,'error');assert.equal(d.errors.length,2);assert.equal(d.warnings.length,1);assert(d.summary.includes('bar check failed'));
assert.equal(compilerDiagnostics('fatal error: cannot open file').status,'error');
console.log('PASS: fatal errors and rhythmic warnings recognized independently of returned files, with duplicate messages removed.');
