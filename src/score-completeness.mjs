// LilyPond's resolved music tree supplies rational durations, including tuplets.
const number=v=>{if(typeof v==='number')return v;const p=String(v).split('/').map(Number);return p.length===2?p[0]/p[1]:p[0];};
export function scoreCompleteness(tree){
 const staves=[];
 function walk(n){
  if(!n||typeof n!=='object')return;
  if(n.name==='ContextSpeccedMusic'&&['Staff','DrumStaff','TabStaff','RhythmicStaff'].includes(n['context-type'])&&n['create-new']){
   const duration=number(n.len);if(!Number.isFinite(duration)||duration<=0)throw Error('Eine Stimme enthält keine verlässlich prüfbare Musik.');
   staves.push({name:n['context-id']||'Stimme '+(staves.length+1),wholeNotes:duration});return;
  }
  for(const x of n.elements||[])walk(x);walk(n.element);
 }
 walk(tree);
 if(!staves.length){const length=number(tree?.len);if(!Number.isFinite(length)||length<=0)throw Error('Keine vollständige Musikstruktur empfangen.');return {status:'passed',staves:[{name:'Partitur',wholeNotes:length}]};}
 const max=Math.max(...staves.map(s=>s.wholeNotes));
 if(staves.some(s=>Math.abs(s.wholeNotes-max)>1e-7))throw Error('Stimmen sind ungleich lang: '+staves.map(s=>s.name+' = '+s.wholeNotes+' ganze Noten').join(', ')+'. Original und Ergänzung bleiben erhalten.');
 return {status:'passed',staves};
}
