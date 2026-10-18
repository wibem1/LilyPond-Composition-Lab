const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tag=(n,v,a='')=>`<${n}${a}>${v}</${n}>`;
const num=v=>{if(typeof v==='number')return v;if(typeof v==='string'){const [a,b]=v.split('/').map(Number);return b===undefined?a:a/b;}return 0;};
const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
const lcm=(a,b)=>a/gcd(a,b)*b;
const plain=v=>Array.isArray(v)?v.map(plain).filter(Boolean).join(' ').replace(/\s+/g,' ').trim():typeof v==='string'?v:'';
const children=n=>[...(n.elements||[]),...(n.element?[n.element]:[])];
const props=n=>Object.fromEntries((n['property-operations']||[]).filter(x=>x[0]==='assign').map(x=>[x[1],x[2]]));
const close=(a,b)=>Math.abs(a-b)<1e-8;
const EPS=1e-8;
const TYPES={'-3':'maxima','-2':'long','-1':'breve',0:'whole',1:'half',2:'quarter',3:'eighth',4:'16th',5:'32nd',6:'64th',7:'128th',8:'256th',9:'512th',10:'1024th'};
const ART={staccato:'staccato',staccatissimo:'staccatissimo',tenuto:'tenuto',accent:'accent',marcato:'strong-accent',portato:'detached-legato'};
const ORN={trill:'trill-mark',mordent:'mordent',prall:'inverted-mordent',turn:'turn',reverseturn:'inverted-turn'};
const IGNORE=new Set(['ApplyContext','OverrideProperty','RevertProperty','BarCheckEvent','BeamEvent','BreakEvent','LineBreakEvent','PageBreakEvent','FingeringEvent','StringNumberEvent','VoiceSeparator','UnrelativableMusic']);

export function musicXmlScore(tree,{title='Komposition',composer=''}={}){
 const parts=[],warnings=new Set();let divisions=480,order=0;
 function inspect(n){if(!n||typeof n!=='object')return;for(const v of [n.len,n.duration?.scale]){if(typeof v==='string'&&v.includes('/'))divisions=lcm(divisions,Number(v.split('/')[1]));}children(n).forEach(inspect);(n.articulations||[]).forEach(inspect);}
 inspect(tree);if(!Number.isSafeInteger(divisions)||divisions>10000000)throw Error('Die rhythmische Auflösung ist für den MusicXML-Export zu groß.');
 const ticks=v=>{const n=v*4*divisions,r=Math.round(n);if(!close(n,r))throw Error('Ein Notenwert kann nicht exakt in MusicXML übertragen werden.');return r;};
 function part(name='Instrument'){const p={id:'P'+(parts.length+1),name,staves:[],events:[],attrs:[],directions:[],end:0,partial:0};parts.push(p);return p;}
 function staff(p,n={}){const s={number:p.staves.length+1,id:n['context-id']||'',voiceCount:1};p.staves.push(s);return s;}
 function target(ctx){if(!ctx.part)ctx.part=part();if(!ctx.staff)ctx.staff=staff(ctx.part);return ctx;}
 function attr(ctx,time,type,value){target(ctx);ctx.part.attrs.push({time,type,value,staff:ctx.staff.number,order:order++});}
 function direction(ctx,time,type,value){target(ctx);ctx.part.directions.push({time,type,value,staff:ctx.staff.number,order:order++});}
 function notation(a,ctx,time,event){
  const name=a.name;
  if(name==='AbsoluteDynamicEvent')direction(ctx,time,'dynamic',plain(a.text));
  else if(name==='TextScriptEvent'||name==='MarkEvent'||name==='RehearsalMarkEvent')direction(ctx,time,'words',plain(a.text));
  else if(name==='CrescendoEvent'||name==='DecrescendoEvent')direction(ctx,time,'wedge',a['span-direction']===1?'stop':name==='CrescendoEvent'?'crescendo':'diminuendo');
  else if(name==='SustainEvent'||name==='SostenutoEvent'||name==='UnaCordaEvent'){
   if(name==='SustainEvent')direction(ctx,time,'pedal',a['span-direction']===-1?'start':'stop');else warnings.add('Spezielle Pedalarten werden als Text übertragen.');
  }
  else if(name==='SlurEvent'||name==='PhrasingSlurEvent'){if(event&&!ctx.grace)event.notations.push({type:'slur',value:a['span-direction']===-1?'start':'stop',number:name==='SlurEvent'?1:2});}
  else if(name==='TieEvent'){if(event)event.tie=true;}
  else if(name==='ArticulationEvent'){
   const value=a['articulation-type'];
   if(event&&ART[value])event.notations.push({type:'articulation',value:ART[value]});
   else if(event&&ORN[value])event.notations.push({type:'ornament',value:ORN[value]});
   else if(event&&value==='fermata')event.notations.push({type:'fermata'});
   else if(value)warnings.add('Artikulation „'+value+'“ wird nicht übertragen.');
  }
  else if(name==='ArpeggioEvent'){if(event)event.notations.push({type:'arpeggiate'});}
  else if(name==='TrillSpanEvent'){if(event)event.notations.push({type:'ornament',value:'trill-mark'});warnings.add('Trillerspannen werden als Trillerzeichen übertragen.');}
  else if(name==='GlissandoEvent'){warnings.add('Glissandolinien werden nicht übertragen.');}
  else if(name==='TremoloEvent'){if(event)event.notations.push({type:'tremolo',value:Math.max(1,Math.log2(a['tremolo-type']||32)-2)});}
  else if(!IGNORE.has(name))warnings.add('Nicht übertragene Angabe: '+name+'.');
 }
 function event(n,ctx,time,notes,kind){
  target(ctx);const e={kind,time,dur:ctx.grace?0:num(n.len),notes,grace:!!ctx.grace,slash:!!ctx.slash,duration:n.duration||notes[0]?.duration,staff:ctx.staff.number,voice:ctx.voice||1,notations:[],order:order++,tuplet:ctx.tuplet};
  ctx.part.events.push(e);ctx.last=e;
  for(const a of n.articulations||[])notation(a,ctx,time,e);
  if(n.name==='EventChord'){
   for(const a of n.elements||[])if(!['NoteEvent','RestEvent','SkipEvent'].includes(a.name))notation(a,ctx,time,e);
  }
  ctx.part.end=Math.max(ctx.part.end,time+e.dur);return e.dur;
 }
 function walk(n,ctx,time=0){
  if(!n)return 0;const name=n.name;
  if(name==='InitialContextMusic')return 0; // grace initialization duplicates pitches
  if(name==='ContextSpeccedMusic'){
   const type=n['context-type'],p=props(n),c={...ctx};
   if(['PianoStaff','GrandStaff'].includes(type)&&n['create-new']){c.part=part(plain(p.instrumentName)||'Klavier');c.piano=true;c.staff=null;}
   if(['Staff','TabStaff','DrumStaff','RhythmicStaff'].includes(type)&&(n['create-new']||!c.staff)){
    if(type!=='Staff')throw Error('MusicXML-Export für '+type+' wird noch nicht unterstützt.');
    if(!c.piano)c.part=part(plain(p.instrumentName)||n['context-id']||'Instrument');
    c.staff=staff(c.part,n);c.voice=1;
    if(p.midiInstrument)c.part.instrument=plain(p.midiInstrument);
   }
   if(type==='Dynamics'){c.dynamics=true;if(!c.part)c.part=parts.at(-1)||part();c.staff=c.part.staves[0]||staff(c.part);}
   if(type==='Voice'&&n['create-new']){target(c);c.voice=++c.staff.voiceCount;}
   const length=walk(n.element,c,time);ctx.last=c.last;
   if(!ctx.part&&c.part&&type!=='Staff'&&!['PianoStaff','GrandStaff'].includes(type)){ctx.part=c.part;ctx.staff=c.staff;}
   return length;
  }
  if(name==='SequentialMusic'){
   let at=time;for(const child of n.elements||[])at+=walk(child,ctx,at);return at-time;
  }
  if(name==='SimultaneousMusic'){
   let length=0;const currentStaff=ctx.staff;
   for(const [i,child]of(n.elements||[]).entries()){
    const c={...ctx,last:null};if(i&&(currentStaff||ctx.staff))c.voice=++(currentStaff||ctx.staff).voiceCount;
    length=Math.max(length,walk(child,c,time));
    if(!ctx.part&&c.part){ctx.part=c.part;ctx.staff=c.staff;}
   }return length;
  }
  if(name==='GraceMusic'){
   // Acciaccatura introduces a Flag stroke override; appoggiatura does not.
   const slash=JSON.stringify(n).includes('stroke-style');walk(n.element,{...ctx,grace:true,slash},time);return 0;
  }
  if(name==='TimeScaledMusic')return walk(n.element,{...ctx,tuplet:{actual:n.denominator,normal:n.numerator}},time);
  if(/RepeatedMusic$/.test(name))throw Error('Wiederholungen bitte vor dem Export mit \\unfoldRepeats ausschreiben.');
  if(name==='ContextChange')throw Error('Stimmen mit einem Wechsel zwischen Notensystemen werden noch nicht exportiert.');
  if(name==='NoteEvent')return event(n,ctx,time,[n],'note');
  if(name==='RestEvent'||name==='MultiMeasureRestMusic')return event(n,ctx,time,[],'rest');
  if(name==='SkipEvent'||name==='SkipMusic'){
   if(ctx.grace)return 0;
   if(ctx.dynamics){for(const a of n.articulations||[])notation(a,ctx,time,null);return num(n.len);}
   return event(n,ctx,time,[],'skip');
  }
  if(name==='EventChord'){
   const notes=(n.elements||[]).filter(e=>e.name==='NoteEvent'),rest=(n.elements||[]).find(e=>e.name==='RestEvent'),skip=(n.elements||[]).find(e=>e.name==='SkipEvent');
   if(notes.length){const len=event({...n,duration:notes[0].duration},ctx,time,notes,'note');for(const note of notes)for(const a of note.articulations||[]){if(a.name==='TieEvent'){ctx.last.noteTies??=new Set();ctx.last.noteTies.add(note);}else notation(a,ctx,time,ctx.last);}return len;}
   if(rest||skip){const len=walk(rest||skip,ctx,time);for(const a of n.elements||[])if(a!==rest&&a!==skip)notation(a,ctx,time,ctx.last);return len;}
   for(const a of n.elements||[])notation(a,ctx,time,ctx.last);return 0;
  }
  if(name==='ReferenceTimeSignatureMusic'||name==='TimeSignatureMusic'){attr(ctx,time,'time',n['time-signature']||[n.numerator,n.denominator]);return 0;}
  if(name==='KeyChangeEvent'){
   const alist=n['pitch-alist']||[],fifths=alist.reduce((sum,p)=>sum+num(p[1])*2,0);
   if(!Number.isInteger(fifths)||Math.abs(fifths)>7)throw Error('Diese Tonart wird noch nicht als MusicXML unterstützt.');
   const tonic=n.tonic,pc=tonic?([0,2,4,5,7,9,11][tonic.step]+num(tonic.alter)+12)%12:null,major=(7*fifths%12+12)%12;
   attr(ctx,time,'key',{fifths,mode:pc===major?'major':pc===(major+9)%12?'minor':''});return 0;
  }
  if(name==='PropertySet'){
   if(['clefGlyph','clefPosition','clefTransposition'].includes(n.symbol))attr(ctx,time,n.symbol,n.value);
   // TempoChangeEvent already carries metronome text and tempo; the generated
   // tempoWholesPerMinute property must not add a second direction.
   return 0;
  }
  if(name==='TempoChangeEvent'){direction(ctx,time,'tempo',{text:plain(n.text),duration:n['tempo-unit'],bpm:n['metronome-count']});return 0;}
  if(name==='OttavaEvent'){direction(ctx,time,'ottava',n['ottava-number']||0);return 0;}
  if(name==='PartialSet'){target(ctx);ctx.part.partial=2**(-n.duration.log)*(2-2**(-n.duration.dots))*num(n.duration.scale);return 0;}
  if(name==='BarEvent'){direction(ctx,time,'bar',n['bar-type']||'|.');return 0;}
  if(n.element){return walk(n.element,ctx,time);}
  if(n.elements?.length){let len=0;for(const child of n.elements)len+=walk(child,ctx,time+len);return len;}
  if(IGNORE.has(name))return 0;
  if(/Event$/.test(name)){notation(n,ctx,time,ctx.last);return 0;}
  if(num(n.len)>0)throw Error('Nicht unterstützte Musikstruktur: '+name+'.');
  warnings.add('Nicht übertragene Struktur: '+name+'.');return 0;
 }
 walk(tree,{},0);
 const active=parts.filter(p=>p.events.some(e=>e.kind==='note'));
 if(!active.length)throw Error('Keine exportierbaren Noten gefunden.');
 if(active.some(p=>p.staves.length>16))throw Error('Zu viele Notensysteme für einen MusicXML-Part.');
 let xml='<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0">'+tag('work',tag('work-title',esc(title)))+tag('movement-title',esc(title))+tag('identification',(composer?tag('creator',esc(composer),' type="composer"'):'')+tag('encoding',tag('software','LilyPond Composition Lab')));
 xml+=tag('part-list',active.map(p=>tag('score-part',tag('part-name',esc(p.name))+tag('score-instrument',tag('instrument-name',esc(p.name)),` id="${p.id}-I1"`),` id="${p.id}"`)).join(''));
 let noteCount=0,measureCount=0;
 for(const p of active){
  const initialTime=p.attrs.find(a=>a.type==='time')?.value||[4,4];
  const meters=p.attrs.filter(a=>a.type==='time').sort((a,b)=>a.time-b.time).filter((a,i,arr)=>!i||a.time!==arr[i-1].time);
  let at=0,bar=0,meter=initialTime;const measures=[];
  while(at<p.end-EPS){
   const change=meters.findLast(a=>a.time<=at+EPS);if(change)meter=change.value;
   let size=bar===0&&p.partial?p.partial:num(meter[0])/num(meter[1]);
   if(!size||!Number.isFinite(size))throw Error('Ungültige Taktart.');
   const next=meters.find(a=>a.time>at+EPS&&a.time<at+size-EPS);if(next)throw Error('Taktartwechsel innerhalb eines Taktes wird noch nicht exportiert.');
   size=Math.min(size,p.end-at);measures.push({start:at,size,number:bar===0&&p.partial?0:bar+(p.partial?0:1)});at+=size;bar++;if(bar>5000)throw Error('Zu viele Takte.');
  }
  // Multi-measure rests and long invisible skips become exact per-bar spans.
  p.events=p.events.flatMap(e=>{
   if(e.kind==='note'||e.grace)return [e];
   const spans=measures.filter(m=>e.time<m.start+m.size-EPS&&e.time+e.dur>m.start+EPS);
   if(spans.length<=1)return [e];
   return spans.map(m=>({...e,time:Math.max(e.time,m.start),dur:Math.min(e.time+e.dur,m.start+m.size)-Math.max(e.time,m.start),duration:null,measureRest:e.kind==='rest'&&e.time<=m.start+EPS&&e.time+e.dur>=m.start+m.size-EPS}));
  });
  measureCount=Math.max(measureCount,measures.length);
  // A tie is a relation between pitches, not merely an articulation on a chord.
  const pendingTies=new Set();const slurOpen=new Map();const octave=new Map();
  xml+=`<part id="${p.id}">`;
  for(const [mi,m]of measures.entries()){
   const end=m.start+m.size,isLast=mi===measures.length-1;
   xml+=`<measure number="${m.number}"${m.number===0?' implicit="yes"':''}>`;
   const relevant=p.attrs.filter(a=>a.time>=m.start-EPS&&a.time<end-EPS);
   const attrTimes=[...new Set([m.start,...relevant.map(a=>a.time)])].sort((a,b)=>a-b);let attrCursor=0;
   for(const time of attrTimes){
    const grouped=relevant.filter(a=>close(a.time,time));let body=mi===0&&close(time,m.start)?tag('divisions',divisions):'';
    const keys=grouped.filter(a=>a.type==='key'),times=grouped.filter(a=>a.type==='time');
    for(const key of keys)body+=tag('key',tag('fifths',key.value.fifths)+(key.value.mode?tag('mode',key.value.mode):''),p.staves.length>1?` number="${key.staff}"`:'');
    if(times.length)body+=tag('time',tag('beats',times[0].value[0])+tag('beat-type',times[0].value[1]));
    else if(mi===0)body+=tag('time',tag('beats',initialTime[0])+tag('beat-type',initialTime[1]));
    if(mi===0&&close(time,m.start)&&p.staves.length>1)body+=tag('staves',p.staves.length);
    for(const s of p.staves){
     const items=grouped.filter(a=>a.staff===s.number),glyph=items.find(a=>a.type==='clefGlyph'),position=items.find(a=>a.type==='clefPosition'),trans=items.find(a=>a.type==='clefTransposition');
     if(glyph||mi===0&&close(time,m.start)){
      const v=glyph?.value||(s.number===2&&p.staves.length===2?'clefs.F':'clefs.G'),sign=v.includes('F')?'F':v.includes('C')?'C':'G';
      const line=position?3+num(position.value)/2:sign==='F'?4:sign==='C'?3:2;
      body+=tag('clef',tag('sign',sign)+tag('line',line)+(trans?.value?tag('clef-octave-change',-num(trans.value)/7):''),` number="${s.number}"`);
     }
    }
    if(body){const advance=ticks(time-m.start)-attrCursor;if(advance>0)xml+=tag('forward',tag('duration',advance));attrCursor+=advance;xml+=tag('attributes',body);}
   }
   if(attrCursor>0)xml+=tag('backup',tag('duration',attrCursor));
   const dirs=p.directions.filter(d=>d.time>=m.start-EPS&&(d.time<end-EPS||isLast&&close(d.time,end))).sort((a,b)=>a.time-b.time||a.order-b.order),seen=new Set();
   for(const d of dirs){
    if(d.type==='bar')continue;const identity=JSON.stringify([d.type,d.time,d.type==='tempo'?null:d.staff,d.value]);if(seen.has(identity))continue;seen.add(identity);
    let content='',sound='',placement=['dynamic','wedge','pedal'].includes(d.type)?'below':'above';
    if(d.type==='words'&&d.value)content=tag('words',esc(d.value),' font-style="italic"');
    if(d.type==='dynamic'&&d.value)content=tag('dynamics',/^(p{1,6}|f{1,6}|mp|mf|sf|sfp|sfpp|sfz|sffz|fp|rf|rfz|fz|n)$/.test(d.value)?`<${d.value}/>`:tag('other-dynamics',esc(d.value)));
    if(d.type==='wedge')content=`<wedge type="${d.value}" number="${d.staff}"/>`;
    if(d.type==='pedal')content=`<pedal type="${d.value}" line="yes" number="1"/>`;
    if(d.type==='ottava'){
     const prev=octave.get(d.staff)||0,n=num(d.value);octave.set(d.staff,n);
     if(prev&&n)warnings.add('Direkter Wechsel der Oktavierung wird als neue Oktavlinie übertragen.');
     content=`<octave-shift type="${n?(n>0?'down':'up'):'stop'}" size="${Math.abs(n||prev)>1?15:8}" number="${d.staff}"/>`;
    }
    if(d.type==='tempo'){
     if(d.value.text)content+=tag('direction-type',tag('words',esc(d.value.text)));
     const unit=TYPES[d.value.duration?.log],bpm=num(d.value.bpm);
     if(unit&&bpm){content+=tag('direction-type',tag('metronome',tag('beat-unit',unit)+'<beat-unit-dot/>'.repeat(d.value.duration?.dots||0)+tag('per-minute',bpm)));sound=`<sound tempo="${bpm*2**(2-d.value.duration.log)*(2-2**(-(d.value.duration.dots||0)))}"/>`;}
    }
    if(content)xml+=tag('direction',(d.type==='tempo'?content:tag('direction-type',content))+tag('offset',ticks(d.time-m.start))+tag('staff',d.staff)+sound,` placement="${placement}"`);
   }
   const lanes=[...new Set(p.events.map(e=>`${e.staff}:${e.voice}`))];let laneIndex=0;
   for(const lane of lanes){
    const [st,localVoice]=lane.split(':').map(Number),voice=(st-1)*16+localVoice,events=p.events.filter(e=>e.staff===st&&e.voice===localVoice&&e.time>=m.start-EPS&&e.time<end-EPS).sort((a,b)=>a.time-b.time||a.order-b.order);
    if(!events.length)continue;
    if(laneIndex++)xml+=tag('backup',tag('duration',ticks(m.size)));
    let cursor=0;
    for(const e of events){
     const offset=ticks(e.time-m.start),gap=offset-cursor;
     if(gap>0){xml+=tag('forward',tag('duration',gap)+tag('voice',voice)+tag('staff',st));cursor+=gap;}
     if(gap<0)throw Error('Überlappende Noten innerhalb einer Stimme können nicht exportiert werden.');
     if(e.time+e.dur>end+EPS)throw Error('Eine Note reicht über den Taktstrich hinaus. Bitte im LilyPond-Code mit Haltebogen aufteilen.');
     const duration=ticks(e.dur);
     if(e.kind==='skip'){if(duration)xml+=tag('forward',tag('duration',duration)+tag('voice',voice)+tag('staff',st));cursor+=duration;continue;}
     for(const [i,n]of(e.notes.length?e.notes:[null]).entries()){
      let note=(e.grace?`<grace${e.slash?' slash="yes"':''}/>`:'')+(i?'<chord/>':'');
      if(n){const pitch=n.pitch;note+=tag('pitch',tag('step','CDEFGAB'[pitch.step])+(num(pitch.alter)?tag('alter',num(pitch.alter)):'')+tag('octave',pitch.octave));noteCount++;}else note+=e.measureRest?'<rest measure="yes"/>':'<rest/>';
      if(!e.grace)note+=tag('duration',duration);
      const key=n?`${st}:${voice}:${n.pitch.step}:${n.pitch.octave}:${num(n.pitch.alter)}`:'',stop=n&&pendingTies.has(key),start=n&&(e.tie||e.noteTies?.has(n));
      if(stop){note+='<tie type="stop"/>';pendingTies.delete(key);}if(start){note+='<tie type="start"/>';pendingTies.add(key);}
      note+=tag('voice',voice);
      const d=n?.duration||e.duration,type=TYPES[d?.log];if(type)note+=tag('type',type)+'<dot/>'.repeat(d?.dots||0);
      if(e.tuplet)note+=tag('time-modification',tag('actual-notes',e.tuplet.actual)+tag('normal-notes',e.tuplet.normal));
      note+=tag('staff',st);
      let notation=(stop?'<tied type="stop"/>':'')+(start?'<tied type="start"/>':'');
      if(i===0){
       const arts=e.notations.filter(a=>a.type==='articulation'),ornaments=e.notations.filter(a=>a.type==='ornament'||a.type==='tremolo');
       for(const a of e.notations){
        if(a.type==='slur'){const sk=st+':'+voice+':'+a.number;if(a.value==='start'){const used=new Set(slurOpen.values());let id=1;while(used.has(id))id++;if(id>16)throw Error('Zu viele gleichzeitige Phrasierungsbögen.');slurOpen.set(sk,id);}if(!slurOpen.has(sk))continue;const id=slurOpen.get(sk);if(a.value==='stop')slurOpen.delete(sk);notation+=`<slur type="${a.value}" number="${id}"/>`;}
        if(a.type==='fermata')notation+='<fermata/>';
        if(a.type==='arpeggiate')notation+='<arpeggiate/>';
       }
       if(arts.length)notation+=tag('articulations',arts.map(a=>`<${a.value}/>`).join(''));
       if(ornaments.length)notation+=tag('ornaments',ornaments.map(a=>a.type==='tremolo'?tag('tremolo',a.value,' type="single"'):`<${a.value}/>`).join(''));
      }
      if(notation)note+=tag('notations',notation);
      xml+=tag('note',note);
     }
     if(!e.grace)cursor+=duration;
    }
    const remaining=ticks(m.size)-cursor;if(remaining>0)xml+=tag('forward',tag('duration',remaining)+tag('voice',voice)+tag('staff',st));
   }
   const barline=dirs.find(d=>d.type==='bar');if(isLast||barline)xml+=tag('barline',tag('bar-style',barline?.value==='||'?'light-light':'light-heavy'),' location="right"');
   xml+='</measure>';
  }
  if(pendingTies.size)throw Error('Ein Haltebogen hat keine passende Folgenote.');
  xml+='</part>';
 }
 xml+='</score-partwise>\n';
 return {xml,warnings:[...warnings],stats:{parts:active.length,staves:active.reduce((s,p)=>s+p.staves.length,0),measures:measureCount,notes:noteCount},parts:active};
}
