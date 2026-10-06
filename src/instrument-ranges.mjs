// Sounding pitches, MIDI C4=60. Conventional ranges, not a claim about every
// instrument variant, harmonic or advanced technique. See docs/instrument-ranges.md.
const profiles=new Map();
const add=(programs,name,low,high)=>programs.forEach(p=>profiles.set(p,{name,low,high}));
add([0,1,2,3,4,5],'Klavier',21,108);
add([40],'Violine',55,105);add([41],'Viola',48,93);
add([42],'Cello',36,81);add([43],'Kontrabass (mit tiefer H-Saite)',23,67);
add([44,45,48,49],'Streichergruppe',23,105);
add([46],'Harfe',23,104);add([47],'Pauken',36,61);
add([56,59],'Trompete',54,89);add([57],'Posaune',40,77);
add([58],'Tuba',26,67);add([60],'Horn',35,77);
add([61],'Blechbläsergruppe',26,89);
add([68],'Oboe',58,93);add([69],'Englischhorn',52,83);
add([70],'Fagott',34,77);add([71],'B-Klarinette',50,94);
add([72],'Piccolo',74,108);add([73],'Querflöte (mit H-Fuß)',59,101);
const pitch=k=>Number.isInteger(k)&&k>=0&&k<=127?['C','Cis','D','Es','E','F','Fis','G','As','A','B','H'][k%12]+(Math.floor(k/12)-1):'ungültiger MIDI-Ton '+k;
export function checkInstrumentRanges(midi){
 const programs=new Array(16).fill(0),groups=new Map();
 for(const e of midi.events){
  if(e.type==='program'){programs[e.ch]=e.value;continue;}
  if(e.type!=='on')continue;
  const program=programs[e.ch],drum=e.ch===9,id=e.ch+':'+program;
  if(!groups.has(id)){
   const profile=drum?{name:'Schlagzeug',low:0,high:127}:profiles.get(program)||(program>=80&&program<=103?{name:'Synthesizer (GM '+(program+1)+')',low:0,high:127}:null);
   groups.set(id,{channel:e.ch,program,name:profile?.name||'GM-Instrument '+(program+1),low:profile?.low??null,high:profile?.high??null,status:profile?'checked':'unknown',notes:0,violations:0,examples:[]});
  }
  const group=groups.get(id);group.notes++;
  if(!Number.isInteger(e.key)||e.key<0||e.key>127||group.status!=='unknown'&&(e.key<group.low||e.key>group.high)){
   group.violations++;if(group.examples.length<3)group.examples.push({pitch:pitch(e.key),key:e.key,seconds:Number((e.sec||0).toFixed(2))});
  }
 }
 const instruments=[...groups.values()],warnings=[];
 for(const g of instruments){
  if(g.violations)warnings.push(`${g.name}: ${g.violations} Töne außerhalb des ${g.low===null?'gültigen MIDI-Bereichs':'hinterlegten Bereichs '+pitch(g.low)+'–'+pitch(g.high)}; z. B. ${g.examples.map(e=>e.pitch+' bei '+e.seconds+' s').join(', ')}.`);
  if(g.status==='unknown')warnings.push(`${g.name}: Kein verlässlicher Instrumententonumfang hinterlegt; nur MIDI-Gültigkeit geprüft.`);
 }
 return {status:instruments.some(g=>g.violations)?'warning':instruments.some(g=>g.status==='unknown')?'incomplete':'passed',instruments,warning:warnings.length?'Tonumfang prüfen: '+warnings.join(' ') :''};
}
