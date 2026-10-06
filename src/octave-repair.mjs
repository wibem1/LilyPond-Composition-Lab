// Permit only octave marks attached to Dutch LilyPond pitch tokens.
// Keep strings, comments, commands, durations, articulations and all other text.
function fingerprint(source){
 const tokens=String(source).match(/"(?:\\.|[^"\\])*"|%\{[\s\S]*?%\}|%[^\n]*|\\[A-Za-z]+|[a-g](?:isis|eses|is|es)?[',]*|\s+|./g)||[];
 const result=[];
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i];
  if(/^\s+$/.test(token))continue;
  if(/^[a-g](?:isis|eses|is|es)?[',]+$/.test(token)){
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
