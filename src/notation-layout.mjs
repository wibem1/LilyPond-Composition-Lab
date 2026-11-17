// InstrumentName is a spanner split into one piece per system. Keep the
// first piece's standard LilyPond stencil and suppress only its continuations.
// This also handles markup names, groups, and systems on later pages.
export function initialInstrumentNames(source){
 const stencil=`#(lambda (grob)
   (let ((parts (ly:spanner-broken-into (ly:grob-original grob))))
     (if (or (null? parts) (eq? grob (car parts)))
       (system-start-text::print grob)
       #f)))`;
 const contexts=['Staff','PianoStaff','GrandStaff','StaffGroup','ChoirStaff','TabStaff','DrumStaff','RhythmicStaff'];
 const layout='\n% App layout: instrument names only on the first system\n\\layout {\n'+contexts.map(c=>`  \\context { \\${c} \\override InstrumentName.stencil = ${stencil} }`).join('\n')+'\n}\n';
 const version=source.match(/^\s*\\version\s+"[^"\n]+"[^\n]*(?:\n|$)/);
 const at=version?.[0].length||0;
 return source.slice(0,at)+layout+source.slice(at);
}


const MIDI_INSTRUMENT_NAMES = new Map([
 ['violine','violin'],['geige','violin'],['violin','violin'],
 ['viola','viola'],['bratsche','viola'],['cello','cello'],['violoncello','cello'],
 ['kontrabass','contrabass'],['flöte','flute'],['floete','flute'],['querflöte','flute'],['querfloete','flute'],['flute','flute'],
 ['oboe','oboe'],['klarinette','clarinet'],['clarinet','clarinet'],['fagott','bassoon'],['bassoon','bassoon'],
 ['horn','french horn'],['waldhorn','french horn'],['trompete','trumpet'],['trumpet','trumpet'],
 ['posaune','trombone'],['trombone','trombone'],['harfe','harp'],['harp','harp'],
 ['klavier','acoustic grand'],['piano','acoustic grand'],['flügel','acoustic grand'],['fluegel','acoustic grand'],
 ['cembalo','harpsichord'],['orgel','church organ']
]);
function midiName(name){
 return MIDI_INSTRUMENT_NAMES.get(String(name).trim().toLowerCase().replace(/\s+(?:[ivx]+|\d+)$/,''));
}
function matchingSimultaneousEnd(source,start){
 let depth=0,quoted=false,comment=false;
 for(let i=start;i<source.length-1;i++){
  if(comment){if(source[i]==='\n')comment=false;continue}
  if(source[i]==='%'&&!quoted){comment=true;continue}
  if(source[i]==='"'&&source[i-1]!=='\\')quoted=!quoted;
  if(quoted)continue;
  const pair=source.slice(i,i+2);
  if(pair==='<<'){depth++;i++}
  else if(pair==='>>'){if(!--depth)return i+2;i++}
 }
 return -1;
}
// Add instrument sounds only when notation supplies an unambiguous name.
// Explicit midiInstrument declarations take precedence over this fallback.
export function ensureMidiInstruments(source){
 let code=String(source),added=0;
 code=code.replace(/\\new\s+Staff\s+\\with\s*\{([^{}]*)\}/g,(whole,properties)=>{
  if(/\bmidiInstrument\s*=/.test(properties))return whole;
  const name=properties.match(/\binstrumentName\s*=\s*"([^"]+)"/);
  const midi=name&&midiName(name[1]);
  if(!midi)return whole;
  added++;
  return whole.slice(0,-1)+' midiInstrument = "'+midi+'" }';
 });
 const parent=/\\new\s+(?:PianoStaff|GrandStaff)\s+\\with\s*\{([^{}]*)\}\s*<</g,groups=[];
 let match;
 while((match=parent.exec(code))){
  const name=match[1].match(/\binstrumentName\s*=\s*"([^"]+)"/);
  if(!name||midiName(name[1])!=='acoustic grand')continue;
  const start=code.indexOf('<<',match.index),end=matchingSimultaneousEnd(code,start);
  if(end>start)groups.push([start,end]);
 }
 for(const [start,end] of groups.reverse()){
  const inner=code.slice(start,end).replace(/\\new\s+Staff\s*(?:\\with\s*\{([^{}]*)\})?(?=\s*(?:\{|<<))/g,(whole,props)=>{
   if(props&&/\b(?:midiInstrument|instrumentName)\s*=/.test(props))return whole;
   added++;
   return props===undefined ? whole.replace(/\\new\s+Staff/,'\\new Staff \\with { midiInstrument = "acoustic grand" }') :
    whole.replace(/\}$/, ' midiInstrument = "acoustic grand" }');
  });
  code=code.slice(0,start)+inner+code.slice(end);
 }
 return {code,added};
}
