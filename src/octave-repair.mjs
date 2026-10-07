import {mask as musicMask} from './expression-playback.mjs';
// Permit only octave marks attached to Dutch LilyPond pitch tokens.
// Keep strings, comments, commands, durations, articulations and all other text.
function fingerprint(source){
 const tokens=String(source).match(/"(?:\\.|[^"\\])*"|%\{[\s\S]*?%\}|%[^\n]*|\\[A-Za-z]+|(?:es|as|[a-g](?:isis|eses|is|es)?)[',]*|\s+|./g)||[];
 const result=[];
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i];
  if(/^\s+$/.test(token))continue;
  if(/^(?:es|as|[a-g](?:isis|eses|is|es)?)[',]+$/.test(token)){
   // A pitch must not be part of an identifier or Scheme symbol.
   const before=tokens[i-1]||'',after=tokens[i+1]||'';
   if(!/[A-Za-z_#]$/.test(before)&&! /^[A-Za-z_]/.test(after)){result.push(token.replace(/[',]+$/,''));continue;}
  }
  result.push(token);
 }
 return JSON.stringify(result);
}
export function octaveOnlyChange(original,candidate){
 return typeof candidate==='string'&&candidate.trim()!==String(original).trim()&&fingerprint(original)===fingerprint(candidate);
}
// Stable positions avoid quoting LilyPond commands and multi-line snippets in JSON.
export function octaveTokens(source){
 const result=[];
 const pattern=/"(?:\\.|[^"\\])*"|%\{[\s\S]*?%\}|%[^\n]*|\\[A-Za-z]+|\b(?:es|as|[a-g](?:isis|eses|is|es)?)[',]*(?![A-Za-z_])/g;
 for(const match of String(source).matchAll(pattern)){
  const token=match[0];if(!/^(?:es|as|[a-g](?:isis|eses|is|es)?)[',]*$/.test(token))continue;
  if(/[A-Za-z_#]/.test(source[match.index-1]||''))continue;
  result.push({id:result.length,token,start:match.index,end:match.index+token.length,line:source.slice(0,match.index).split('\n').length});
 }
 return result;
}
export function applyOctaveEdits(original,response){
 const parsed=JSON.parse(String(response).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
 if(parsed.octaves)return applyAbsoluteOctaves(original,parsed.octaves);
 if(!Array.isArray(parsed.edits)||!parsed.edits.length||parsed.edits.length>1024)throw Error('Keine gültigen Oktavänderungen.');
 const tokens=octaveTokens(original);
 const edits=parsed.edits.map(e=>{
  if(Object.hasOwn(e,'id')){
   const token=tokens[e.id];
   if(!Number.isInteger(e.id)||!token||!Number.isInteger(e.marks)||Math.abs(e.marks)>8)throw Error('Ungültige nummerierte Oktavänderung.');
   return {...token,to:token.token.replace(/[',]+$/,'')+(e.marks<0?',':"'").repeat(Math.abs(e.marks))};
  }
  if(typeof e.from!=='string'||typeof e.to!=='string'||!e.from||e.from.length>2048||e.to.length>2048)throw Error('Ungültige Änderung.');
  const start=original.indexOf(e.from);
  if(start<0||original.indexOf(e.from,start+1)!==-1)throw Error('Änderung ist nicht eindeutig im Original auffindbar.');
  return {...e,start,end:start+e.from.length};
 }).sort((a,b)=>b.start-a.start);
 let candidate=original,previous=original.length;
 for(const e of edits){if(e.end>previous)throw Error('Änderungen überlappen.');candidate=candidate.slice(0,e.start)+e.to+candidate.slice(e.end);previous=e.start;}
 if(!octaveOnlyChange(original,candidate))throw Error('Nicht ausschließlich Oktavzeichen geändert.');
 return candidate;
}

const degree=t=>'cdefgab'.indexOf(t[0]);
const marks=t=>(t.match(/'/g)||[]).length-(t.match(/,/g)||[]).length;
const nearest=(reference,d)=>reference+((d-reference%7+10)%7)-3;
function closingBrace(source,start){let depth=0;for(let i=start;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&!--depth)return i;}return -1;}
// Deliberately bounded: complex simultaneous/nested music stays on the
// explicit-failure path. Recognized sequential relative blocks are encoded mechanically.
export function relativeOctavePlan(source){
 if(/\\include\b|\\language\s+"(?!nederlands")/.test(source))return null;
 let masked=musicMask(String(source));
 const blocks=[];let lastEnd=-1;
 for(const match of masked.matchAll(/\\relative\s+(?:((?:es|as|[a-g](?:isis|eses|is|es)?)[',]*)\s*)?\{/g)){
  const start=match.index+match[0].length-1,end=closingBrace(masked,start);if(end<0||start<lastEnd)return null;
  const body=masked.slice(start,end);
  if(/\\(?:relative|absolute|fixed|transpose|repeat|alternative|chordmode|drummode|octaveCheck|language|resetRelativeOctave|afterGrace)\b|<<|>>|\\\\/.test(body))return null;
  blocks.push({start,end,anchor:match[1]?degree(match[1])+(3+marks(match[1]))*7:null});lastEnd=end;
 }
 if(!blocks.length||blocks.length!==[...masked.matchAll(/\\relative\b/g)].length)return null;
 // Text annotations and key signatures are not sounding notes.
 for(const match of [...masked.matchAll(/\\markup\s*\{/g)].reverse()){
  const start=match.index+match[0].length-1,end=closingBrace(masked,start);if(end<0)return null;
  masked=masked.slice(0,match.index)+' '.repeat(end+1-match.index)+masked.slice(end+1);
 }
 masked=masked.replace(/\\key\s+(?:es|as|[a-g](?:isis|eses|is|es)?)[',]*/g,m=>' '.repeat(m.length));
 const plan=[];
 for(let block=0;block<blocks.length;block++){
  const b=blocks[block];let reference=b.anchor,first=null,chord=false,cursor=b.start;
  for(const token of octaveTokens(masked).filter(t=>t.start>b.start&&t.end<b.end)){
   for(const bracket of masked.slice(cursor,token.start).matchAll(/(?<![\\-])[<>]/g)){
    if(bracket[0]==='<'){if(chord)return null;chord=true;first=null;}
    else {if(!chord||first===null)return null;reference=first;chord=false;first=null;}
   }
   const absoluteFirst=reference===null;
   const pitch=absoluteFirst?degree(token.token)+(3+marks(token.token))*7:nearest(reference,degree(token.token))+marks(token.token)*7;
   plan.push({...token,id:plan.length,block,blockStart:b.start,anchor:b.anchor,absoluteFirst,chordFirst:chord&&first===null,chord,octave:Math.floor(pitch/7)});
   if(chord&&first===null)first=pitch;reference=pitch;cursor=token.end;
  }
 }
 return plan.length?plan:null;
}
export function applyAbsoluteOctaves(source,octaves){
 const plan=relativeOctavePlan(source);
 if(plan&&Array.isArray(octaves)&&octaves.length!==plan.length)throw Error(`Genau ${plan.length} Oktavnummern erforderlich, ${octaves.length} erhalten.`);
 if(!plan||!Array.isArray(octaves)||octaves.length!==plan.length||octaves.some(o=>!Number.isInteger(o)||o<0||o>8))throw Error('Keine vollständigen gültigen absoluten Oktavlagen.');
 let block=-1,reference=0,first=null,wasChord=false;const edits=[];
 for(let i=0;i<plan.length;i++){
  const t=plan[i];if(t.block!==block){block=t.block;reference=t.anchor;first=null;wasChord=false;}
  if(wasChord&&(!t.chord||t.chordFirst)){reference=first;first=null;}
  const target=octaves[i]*7+degree(t.token),offset=t.absoluteFirst?octaves[i]-3:(target-nearest(reference,degree(t.token)))/7;
  edits.push({...t,to:t.token.replace(/[',]+$/,'')+(offset<0?',':"'").repeat(Math.abs(offset))});
  if(t.chordFirst)first=target;reference=target;wasChord=t.chord;
 }
 let result=source;for(const e of edits.reverse())result=result.slice(0,e.start)+e.to+result.slice(e.end);
 if(!octaveOnlyChange(source,result))throw Error('Nicht ausschließlich Oktavzeichen geändert.');return result;
}

// Recognize an absolute spelling mistakenly placed inside anchorless relative
// piano blocks. Require gross drift and a completely playable absolute reading.
export function repairAbsoluteSpelling(source){
 if(!/\\new\s+PianoStaff\b/.test(source))return null;
 const plan=relativeOctavePlan(source);if(!plan||plan.some(t=>t.anchor!==null))return null;
 const semitones=[0,2,4,5,7,9,11];
 const key=(t,o)=>12*(o+1)+semitones[degree(t.token)]+((t.token.match(/is/g)||[]).length-(t.token.match(/es/g)||[]).length)-(t.token.startsWith('as')?1:0);
 const targets=plan.map(t=>3+marks(t.token));
 if(targets.some((o,i)=>o<0||o>8||key(plan[i],o)<21||key(plan[i],o)>108))return null;
 const blocks=[...new Set(plan.map(t=>t.block))];let faulty=false;
 for(const block of blocks){
  const notes=plan.filter(t=>t.block===block);
  const bad=notes.filter(t=>key(t,t.octave)<21||key(t,t.octave)>108);
  if(!bad.length){for(const t of notes)targets[t.id]=t.octave;continue;}
  if(bad.length){
   if(notes.filter(t=>marks(t.token)!==0).length<notes.length/2||bad.length<notes.length/4||!bad.some(t=>key(t,t.octave)<-3||key(t,t.octave)>132))return null;
   faulty=true;
  }
 }
 if(!faulty)return null;
 const code=applyAbsoluteOctaves(source,targets);
 return {code,notes:plan.length,method:'absolute-spelling-in-anchorless-relative'};
}

const accidental=t=>(t.match(/is/g)||[]).length-(t.match(/es/g)||[]).length-(t.startsWith('as')?1:0);
const midiKey=(t,octave)=>12*(octave+1)+[0,2,4,5,7,9,11][degree(t)]+accidental(t);
const gmNames=new Map([[0,'acoustic grand'],[1,'bright acoustic'],[2,'electric grand'],[3,'honky-tonk'],[4,'electric piano 1'],[5,'electric piano 2'],[40,'violin'],[41,'viola'],[42,'cello'],[43,'contrabass'],[46,'orchestral harp'],[47,'timpani'],[56,'trumpet'],[57,'trombone'],[58,'tuba'],[59,'muted trumpet'],[60,'french horn'],[68,'oboe'],[69,'english horn'],[70,'bassoon'],[71,'clarinet'],[72,'piccolo'],[73,'flute']]);
export function automaticOctaveRepair(source,instruments,registerIssues=[]){
 if(!instruments?.length||instruments.some(x=>x.status!=='checked'||x.low===null||x.high===null))return {error:'Kein verlässlicher Instrumententonumfang für die automatische Korrektur.'};
 const spelling=instruments.every(x=>x.program<=5)?repairAbsoluteSpelling(source):null;if(spelling)return spelling;
 let plan=relativeOctavePlan(source),relative=!!plan;
 if(!plan){
  let masked=musicMask(source);
  if(/\\(?:relative|fixed|transpose|include|chordmode|drummode|language|resetRelativeOctave)\b/.test(masked))return {error:'Diese Notationskonstruktion kann die App noch nicht sicher rechnerisch korrigieren.'};
  for(const m of [...masked.matchAll(/\\markup\s*\{/g)].reverse()){const at=m.index+m[0].length-1,end=closingBrace(masked,at);if(end<0)return {error:'Unvollständige Textangabe.'};masked=masked.slice(0,m.index)+' '.repeat(end+1-m.index)+masked.slice(end+1);}
  masked=masked.replace(/\\key\s+(?:es|as|[a-g](?:isis|eses|is|es)?)[',]*/g,m=>' '.repeat(m.length));
  plan=octaveTokens(masked).map((t,id)=>({...t,id,block:0,octave:3+marks(t.token)}));
 }
 if(!plan.length)return {error:'Keine sicher auflösbaren Tonpositionen.'};
 const homogeneous=instruments.every(x=>x.low===instruments[0].low&&x.high===instruments[0].high&&x.program===instruments[0].program);
 const targets=plan.map(t=>t.octave);let changes=0;
 for(const block of [...new Set(plan.map(t=>t.block))]){
  const notes=plan.filter(t=>t.block===block);let profile=homogeneous?instruments[0]:null;
  if(!profile&&relative){
   const prefix=source.slice(0,notes[0].blockStart+1),variable=prefix.match(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\\relative(?:\s+[^{}]*)?\s*\{$/)?.[1];
   if(variable){const staves=[...source.matchAll(/\\new\s+Staff\b/g)];const found=[];
    for(let i=0;i<staves.length;i++){const staff=source.slice(staves[i].index,staves[i+1]?.index??source.length),name=staff.match(/midiInstrument\s*=\s*"([^"\n]+)"/)?.[1];if([...staff.matchAll(/\\([A-Za-z_][A-Za-z0-9_]*)/g)].some(m=>m[1]===variable)){const match=instruments.find(p=>gmNames.get(p.program)===name);if(match)found.push(match);}}
    if(found.length&&found.every(p=>p.program===found[0].program))profile=found[0];
   }
  }
  if(!profile)return {error:'Instrument und Tonpositionen lassen sich nicht eindeutig zuordnen. Original erhalten.'};
  const low=profile.low,high=registerIssues.some(x=>x.channel===profile.channel)?Math.min(profile.high,67):profile.high;
  const keys=notes.map(t=>midiKey(t.token,t.octave)),lo=Math.min(...keys),hi=Math.max(...keys);
  const minShift=Math.ceil((low-lo)/12),maxShift=Math.floor((high-hi)/12);
  // Prefer a uniform octave shift, retaining every interval in the phrase.
  const shift=minShift<=maxShift?Math.max(minShift,Math.min(maxShift,0)):null;let previous=Math.max(low,Math.min(high,keys[0])),chordFirst=null,wasChord=false;
  for(let j=0;j<notes.length;j++){
   const t=notes[j],key=keys[j];if(wasChord&&(!t.chord||t.chordFirst))previous=chordFirst;let target=t.octave;
   if(shift!==null)target+=shift;
   else if(key<low||key>high){const octaves=Array.from({length:9},(_,o)=>o).filter(o=>midiKey(t.token,o)>=low&&midiKey(t.token,o)<=high);if(!octaves.length)return {error:'Für diese Tonklasse ist keine spielbare Oktave hinterlegt.'};target=octaves.reduce((best,o)=>Math.abs(midiKey(t.token,o)-previous)<Math.abs(midiKey(t.token,best)-previous)?o:best);}
   targets[t.id]=target;if(target!==t.octave)changes++;previous=midiKey(t.token,target);if(t.chordFirst)chordFirst=previous;wasChord=t.chord;
  }
 }
 if(!changes)return {error:'Die Bereichsverletzung lässt sich den notierten Tönen nicht sicher zuordnen. Original erhalten.'};
 const code=relative?applyAbsoluteOctaves(source,targets):applyOctaveEdits(source,JSON.stringify({edits:plan.map(t=>({id:octaveTokens(source).findIndex(p=>p.start===t.start),marks:targets[t.id]-3})).filter((e,i)=>targets[i]!==plan[i].octave)}));
 return {code,notes:plan.length,changes,method:'mechanical-instrument-range'};
}
