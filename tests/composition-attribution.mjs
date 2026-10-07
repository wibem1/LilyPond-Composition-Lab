import assert from 'node:assert/strict';
import {compositionAttribution} from '../src/composition-attribution.mjs';
const music=String.raw`\score { { c'4 d' e' f' } \layout {} \midi {} }`;
const original=String.raw`\version "2.24.3"
% \header { composer = "fake comment" }
\header { title = "composer = fake" composer = "ChatGPT" subtitle = "Unchanged" }
${music}`;
const code=compositionAttribution(original,'perplexity/sonar');
assert(code.startsWith('% KI-Modell: perplexity/sonar\n'));
assert(code.includes('composer = "perplexity/sonar" subtitle = "Unchanged"'));
assert(code.includes('% \\header { composer = "fake comment" }'));
assert(code.includes('title = "composer = fake"'));
assert(code.endsWith(music));assert(!code.includes('"ChatGPT"'));
const complex=String.raw`\header { composer = \markup { \bold "ChatGPT" } title = "Kept" }
\score { { c'4 } \header { composer = "Another AI" } }`;
const replaced=compositionAttribution(complex,'anthropic/claude');
assert.equal([...replaced.matchAll(/composer = "anthropic\/claude"/g)].length,2);
assert(replaced.includes('title = "Kept"'));assert(replaced.includes("{ c'4 }"));assert(!replaced.includes('ChatGPT'));
const withoutHeader=compositionAttribution('\\version "2.24.3"\n'+music,'test/model');
assert(withoutHeader.indexOf('\\version')<withoutHeader.indexOf('\\header'));
assert(withoutHeader.indexOf('\\header')<withoutHeader.indexOf('\\score'));
assert(withoutHeader.endsWith(music));
assert(compositionAttribution('\\header { title = "Kept" }','a/"b\\c\nd').includes('composer = "a/\\"b\\\\c d"'));
assert.equal(compositionAttribution('','test/model'),'');
console.log('PASS: API model attribution replaces invented composers, covers markup and scoped headers, preserves music/title/comments, adds missing headers, and escapes model strings.');
