import {mask} from './expression-playback.mjs';
import {relativeOctavePlan,octaveTokens} from './octave-repair.mjs';

const degree=t=>'cdefgab'.indexOf(t[0]);
function close(s,start){let depth=0;for(let i=start;i<s.length;i++){if(s[i]==='{')depth++;else if(s[i]==='}'&&!--depth)return i;}return -1;}
const ledger=(pitch,clef)=>Math.floor(Math.max(0,(clef==='treble'?30:18)-pitch,pitch-(clef==='treble'?38:26))/2);

// Conservative piano notation only. Add display commands, never edit pitches.
// Whole compatible runs of measures stay under one line, including register dips.
export function automaticOttava(source){
 let s=mask(source);
 const unchanged=reason=>({code:source,passages:[],reason});
 if(/\\ottava\b|\\(?:include|transpose|fixed|language|change)\b/.test(s))return unchanged('author-or-unsupported');
 const piano=[];
 for(const m of s.matchAll(/\\new\s+(?:PianoStaff|GrandStaff)\b/g)){
  const open=s.indexOf('<<',m.index+m[0].length);if(open<0)continue;
  let depth=1,i=open+2;
  for(;i<s.length&&depth;i++){if(s.startsWith('<<',i)){depth++;i++;}else if(s.startsWith('>>',i)){depth--;i++;}}
  if(!depth)piano.push(s.slice(open,i));
 }
 if(!piano.length)return unchanged('not-piano');
 // Markup can contain pitch-like identifiers; key arguments are not notes.
 for(const m of [...s.matchAll(/\\markup\s*\{/g)].reverse()){
  const end=close(s,m.index+m[0].lastIndexOf('{'));if(end<0)return unchanged('incomplete');
  s=s.slice(0,m.index)+' '.repeat(end+1-m.index)+s.slice(end+1);
 }
 s=s.replace(/\\key\s+(?:es|as|[a-g](?:isis|eses|is|es)?)[',]*/g,m=>' '.repeat(m.length));
 const relative=relativeOctavePlan(source);
 const definitions=[...s.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=/g)].map(m=>m[1]);
 const edits=[],passages=[];
 for(const m of s.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:\\relative\s+(?:(?:es|as|[a-g](?:isis|eses|is|es)?)[',]*\s*)?)?\{/g)){
  const name=m[1];if(!piano.some(p=>new RegExp('\\\\'+name+'\\b').test(p)))continue;
  const open=m.index+m[0].lastIndexOf('{'),end=close(s,open);if(end<0)continue;
  const body=s.slice(open+1,end);
  if(/<<|>>|\\\\|\\(?:repeat|alternative|afterGrace|relative|absolute|octaveCheck|resetRelativeOctave|new|context)\b/.test(body))continue;
  if(definitions.some(n=>n!=='global'&&new RegExp('\\\\'+n+'\\b').test(body)))continue;
  const clefs=[...body.matchAll(/\\clef\b/g)];if(clefs.length!==1)continue;
  const clef=source.slice(open+1+clefs[0].index).match(/^\\clef\s+"?(treble|bass)\b(?![_^])/i)?.[1];if(!clef)continue;
  const isRelative=/\\relative\b/.test(m[0]);
  if(isRelative&&!relative)continue;
  let notes=isRelative?relative.filter(t=>t.blockStart===open):octaveTokens(s).filter(t=>t.start>open&&t.end<end).map(t=>({...t,octave:3+(t.token.match(/'/g)||[]).length-(t.token.match(/,/g)||[]).length}));
  if(!notes.length)continue;
  const bars=[...body.matchAll(/(?<!\\)\|/g)].map(b=>open+1+b.index);
  const measures=Array.from({length:bars.length+1},(_,i)=>({start:i?bars[i-1]+1:open+1,end:bars[i]??end,events:[]}));
  const events=[];let cursor=open+1,inChord=false,event=null;
  for(const n of notes){
   for(const bracket of s.slice(cursor,n.start).matchAll(/(?<![\\-])[<>]/g)){
    if(bracket[0]==='<'){inChord=true;event={start:cursor+bracket.index,pitches:[]};events.push(event);}
    else {inChord=false;event=null;}
   }
   if(!inChord){event={start:n.start,pitches:[]};events.push(event);}
   event.pitches.push(n.octave*7+degree(n.token));cursor=n.end;
  }
  for(const e of events){const measure=measures.find(b=>e.start>=b.start&&e.start<b.end);if(measure)measure.events.push(e);}
  const direction=clef==='treble'?1:-1;
  const editStart=edits.length,passageStart=passages.length;
  // One choice per run. Never alternate 8va/15ma inside the same passage.
  const used=new Set();
  for(const amount of [direction,2*direction]){
   const usable=b=>b.events.every(e=>e.pitches.every(p=>ledger(p-amount*7,clef)<=3));
   for(let i=0;i<measures.length;){
    if(used.has(i)||!usable(measures[i])){i++;continue;}
    const first=i;while(i<measures.length&&!used.has(i)&&usable(measures[i]))i++;
    const last=i-1,run=measures.slice(first,i),pitches=run.flatMap(b=>b.events.flatMap(e=>e.pitches));
    const trigger=pitches.some(p=>direction===1?p>=46:p<=10);
    const before=pitches.reduce((n,p)=>n+ledger(p,clef),0),after=pitches.reduce((n,p)=>n+ledger(p-amount*7,clef),0);
    const occupied=run.filter(b=>b.events.length);
    if(!trigger||occupied.length<2||run.reduce((n,b)=>n+b.events.length,0)<3||after>=before)continue;
    const start=occupied[0].events[0].start,stop=occupied.at(-1).end;
    edits.push({at:start,text:`\\ottava #${amount} `},{at:stop,text:' \\ottava #0 '});
    passages.push({voice:name,clef,octaves:amount,firstMeasure:first+1,lastMeasure:last+1});
    for(let j=first;j<=last;j++)used.add(j);
   }
  }
  // If incompatible low/high material would force short gaps or an immediate
  // 8va/15ma switch, leave this voice untouched instead of creating flicker.
  const voicePassages=passages.slice(passageStart).sort((a,b)=>a.firstMeasure-b.firstMeasure);
  if(voicePassages.some((p,i)=>i&&p.firstMeasure-voicePassages[i-1].lastMeasure<=3)){
   edits.splice(editStart);passages.splice(passageStart);
  }
 }
 let code=source;for(const e of edits.sort((a,b)=>b.at-a.at))code=code.slice(0,e.at)+e.text+code.slice(e.at);
 return {code,passages,reason:passages.length?'automatic':'no-useful-passage'};
}

// Compare sounding events, not file bytes (notation changes can change metadata).
export function sameMidiPerformance(a,b){
 const canonical=m=>JSON.stringify({ppq:m.ppq,duration:m.duration,events:m.events});
 return canonical(a)===canonical(b);
}
