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
