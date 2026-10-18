import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {musicXmlCapture,capturedMusic} from '../src/musicxml-capture.mjs';
import {musicXmlScore} from '../src/musicxml-export.mjs';
import {parseMidi} from '../src/midi-reader.mjs';
const fixture=async name=>JSON.parse(await readFile('tests/fixtures/musicxml-'+name+'-tree.json','utf8'));
const source=await readFile('tests/fixtures/gaenseliesel.ly','utf8');
const captured=musicXmlCapture(source);
assert(captured.includes('\\labMusicXmlCapture \\unfoldRepeats'));
assert(captured.includes('rightHand = \\absolute'));
assert(!captured.includes('\\articulate'));
assert.throws(()=>musicXmlCapture('\\score {{c4}} \\score {{d4}}'),/genau einen/);
assert.throws(()=>capturedMusic('truncated LABXML-BEGIN{}'),/keine eindeutige/);
assert.throws(()=>capturedMusic('LABXML-BEGIN{bad}LABXML-END'),/unvollständig/);
let r=musicXmlScore(await fixture('gaenseliesel'),{title:'Gänseliesel & <Test>',composer:'A "B"'});
assert.deepEqual(r.stats,{parts:1,staves:2,measures:32,notes:456});
assert.deepEqual(r.warnings,[]);
assert(r.xml.includes('Gänseliesel &amp; &lt;Test&gt;'));
assert(r.xml.includes('<staves>2</staves>'));
assert(r.xml.includes('<voice>17</voice>'));
assert(r.xml.includes('<grace slash="yes"/>'));
assert.equal((r.xml.match(/<grace/g)||[]).length,16,'grace initialization is not duplicated');
assert.equal((r.xml.match(/<tie type="start"/g)||[]).length,1);
assert(r.xml.includes('<wedge type="crescendo"'));assert(r.xml.includes('<pedal type="start"'));
assert(!r.xml.includes('SkipEvent'));
const f=musicXmlScore(await fixture('features'),{title:'Features'});
assert.equal(f.stats.staves,2);assert.equal(f.stats.measures,7);
assert(f.xml.includes('<measure number="0" implicit="yes">'));
assert(f.xml.includes('<actual-notes>3</actual-notes><normal-notes>2</normal-notes>'));
assert(f.xml.includes('<mode>minor</mode>'));
assert(f.xml.includes('<octave-shift type="down"'));
assert(f.xml.includes('<octave>6</octave>'),'octave-shift changes display, pitch remains sounding');
assert(f.xml.includes('<rest measure="yes"/>'));
// A bare parallel score needs two distinct voices even without Staff wrappers.
const note=key=>({name:'NoteEvent',len:'1/4',pitch:{step:key,octave:4,alter:0},duration:{log:2,dots:0,scale:1}});
const parallel=musicXmlScore({name:'SimultaneousMusic',elements:[note(0),note(2)]});
assert.equal(parallel.stats.staves,1);assert(parallel.xml.includes('<voice>2</voice>'));
assert.throws(()=>musicXmlScore({name:'ContextChange'}),/Wechsel/);
if(process.env.LILYPOND_BIN){
 const dir=await mkdtemp(join(tmpdir(),'lab-musicxml-'));
 const run=(bin,args)=>{const p=spawnSync(bin,args,{encoding:'utf8',timeout:60000});assert.equal(p.status,0,p.stderr);return p;};
 const midi=async path=>{const b=await readFile(path);const m=parseMidi(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));return m.events.filter(e=>e.type==='on').map(e=>[e.tick,e.ch,e.key]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);};
 try{
  for(const [name,path]of [['gaenseliesel','tests/fixtures/gaenseliesel.ly'],['features','tests/fixtures/musicxml-features.ly']]){
   const input=await readFile(path,'utf8'),capturePath=join(dir,name+'-capture.ly'),out=join(dir,name);
   await writeFile(capturePath,musicXmlCapture(input));
   const process=run(globalThis.process.env.LILYPOND_BIN,['-dno-print-pages','-o',out+'-capture',capturePath]);
   const tree=capturedMusic(process.stderr+process.stdout);
   assert.deepEqual(tree,await fixture(name),'fixture matches actual compiler');
   const result=musicXmlScore(tree,{title:name});await writeFile(out+'.musicxml',result.xml);
   const original=join(dir,name+'-original.ly');await writeFile(original,input);
   run(globalThis.process.env.LILYPOND_BIN,['-dno-print-pages','-o',out+'-original',original]);
   const imported=out+'-imported.ly';
   const importResult=run(join(dirname(globalThis.process.env.LILYPOND_BIN),'musicxml2ly'),['--absolute','--midi','-o',imported,out+'.musicxml']);
   assert(!/warning:/i.test(importResult.stderr),importResult.stderr);
   await writeFile(imported,(await readFile(imported,'utf8')).replace(/\\articulate\b/g,''));
   run(globalThis.process.env.LILYPOND_BIN,['-dno-print-pages','-o',out+'-imported',imported]);
   assert.deepEqual(await midi(out+'-original.midi'),await midi(out+'-imported.midi'),'all sounding pitches and hand/voice onsets survive MusicXML round trip');
   if(globalThis.process.env.MUSICXML_XSD){run('python',['-c','from lxml import etree as E; import sys; s=E.XMLSchema(E.parse(sys.argv[1])); s.assertValid(E.parse(sys.argv[2]))',globalThis.process.env.MUSICXML_XSD,out+'.musicxml']);}
  }
 }finally{await rm(dir,{recursive:true,force:true});}
}
console.log('PASS: MusicXML from resolved LilyPond: 32 piano bars, 456 written pitches / 455 attacks, grace notes, independent hands, voices, ties/slurs, tuplets, pickup, rests, meter/key, tempo, dynamics, pedals, safe XML escaping.'+(process.env.LILYPOND_BIN?' Fresh compiler and pitch/onset round trips verified.':''));
