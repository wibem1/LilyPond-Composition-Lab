// App register policy, not an instrument's absolute playable limit:
// review a cello phrase staying above G4 for eight seconds or longer.
// Isolated high notes and an explicitly requested high register are allowed.
export function checkInstrumentRegisters(midi,task=''){
 if(/(?:hoh(?:e|en|er|es|em)\s+Cello(?:lage|register)?|Cello.{0,50}(?:hoh(?:e|en|er|es|em)\s+(?:Lage|Register)|hoch|Daumenlage)|(?:high|upper)\s+cello\s+register)/i.test(task))return {status:'passed',warning:'',issues:[]};
 const programs=new Array(16).fill(0),groups=new Map();
 for(const e of midi.events){
  if(e.type==='program'){programs[e.ch]=e.value;continue;}
  if(e.type==='on'&&programs[e.ch]===42){
   if(!groups.has(e.ch))groups.set(e.ch,[]);
   groups.get(e.ch).push(e);
  }
 }
 const issues=[];
 for(const [channel,notes] of groups){
  let start=null,count=0,lastEnd=null;
  const finish=end=>{
   if(start!==null&&count>=4&&end-start>=8)issues.push({channel,instrument:'Cello',startSeconds:Number(start.toFixed(2)),durationSeconds:Number((end-start).toFixed(2)),notes:count,upperCorePitch:'G4'});
   start=null;count=0;
  };
  for(const e of notes){
   const off=midi.events.find(x=>x.type==='off'&&x.ch===channel&&x.key===e.key&&x.sec>e.sec);
   if(lastEnd!==null&&e.sec-lastEnd>0.5)finish(lastEnd);
   if(e.key>67){if(start===null)start=e.sec;count++;}
   else finish(lastEnd??e.sec);
   lastEnd=off?.sec??e.sec;
  }
  if(start!==null){
   // End at the final high note's actual note-off, not the whole score's end.
   const last=notes.at(-1),off=midi.events.find(e=>e.type==='off'&&e.ch===channel&&e.key===last.key&&e.sec>last.sec);
   finish(off?.sec??last.sec);
  }
 }
 const warning=issues.length?'Register prüfen: '+issues.map(x=>`Cello: längere hohe Passage oberhalb G4 ab ${x.startSeconds} s (${x.durationSeconds} s). Prüfe unbeabsichtigte Oktavsprünge in relativer Notation; einzelne hohe Spitzentöne dürfen bleiben.`).join(' '):'';
 return {status:issues.length?'warning':'passed',warning,issues};
}
