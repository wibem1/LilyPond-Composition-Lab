// SoundFont audio and MIDI timing run in an AudioWorklet, independent of page rendering.
import {WorkletSynthesizer,Sequencer,SoundBankLoader} from '/spessasynth.mjs';
export class SoundFontPlayer {
 constructor(options={}){
  this.ctx=null;this.synth=null;this.seq=null;this.master=null;this.sf=null;this.midi=null;
  this.current=0;this.paused=true;this.soundFontName='';this.masterVolume=.82;this.onprogress=()=>{};
  this._initPromise=null;this._fontQueue=Promise.resolve();this._sequencePromise=null;this._midiBuffer=null;this._midiRevision=0;this._sequenceRevision=-1;this._customId=null;this.timer=null;this._transportRevision=0;
  this._validate=options.validate||((b)=>{const bank=SoundBankLoader.fromArrayBuffer(b);if(!bank.presets.length)throw Error('SoundFont enthält keine Instrumente.');return bank.presets.length;});
  this._create=options.createEngine||null;
 }
 async init(){
  if(!this._initPromise){this._initPromise=this._initialize().catch(e=>{this.synth?.destroy();this.ctx?.close().catch(()=>{});this.ctx=null;this.synth=null;this.seq=null;this._initPromise=null;throw e;});}
  // Resume immediately during the button/file-picker gesture, before network work.
  if(this.ctx&&this.ctx.state!=='running')await this.ctx.resume();
  await this._initPromise;
  if(this.ctx.state!=='running')await this.ctx.resume();
 }
 async _initialize(){
  if(this._create){const x=await this._create();this.ctx=x.ctx;this.synth=x.synth;this.seq=x.seq;this.master=x.master;return;}
  const Context=window.AudioContext||window.webkitAudioContext;
  this.ctx=new Context({latencyHint:'playback'});await this.ctx.resume();
  if(!this.ctx.audioWorklet)throw Error('Dieser Browser unterstützt den Audio-Player nicht. Bitte Safari oder Chrome aktualisieren.');
  await this.ctx.audioWorklet.addModule('/spessasynth-processor.js');
  this.master=this.ctx.createGain();this.master.gain.value=this.masterVolume;this.master.connect(this.ctx.destination);
  this.synth=new WorkletSynthesizer(this.ctx,{oneOutput:true});this.synth.connect(this.master);
  await this.synth.isReady;
  this.synth.setSystemParameter('effectsEnabled',false);
  this.synth.setSystemParameter('voiceCap',256);
  this.seq=new Sequencer(this.synth,{skipToFirstNoteOn:false});this.seq.loopCount=0;
 }
 setMasterVolume(v){this.masterVolume=Math.max(0,Math.min(1.25,Number(v)||0));if(this.master)this.master.gain.setTargetAtTime(this.masterVolume,this.ctx.currentTime,.015);}
 async _addBank(buffer,id){
  // Parser errors are validated beforehand; catch runtime allocation/decode errors as well.
  const eventId='lab-font-'+crypto.randomUUID();
  let timer;
  const guard=new Promise((_,reject)=>{
   this.synth.eventHandler.addEvent('soundBankError',eventId,e=>reject(Error('SoundFont konnte nicht geladen werden: '+(e?.message||e))));
   timer=setTimeout(()=>reject(Error('SoundFont-Laden hat zu lange gedauert.')),30000);
  });
  try{await Promise.race([this.synth.soundBankManager.addSoundBank(buffer,id),guard]);}
  finally{clearTimeout(timer);this.synth.eventHandler.removeEvent('soundBankError',eventId);}
 }
 async _ensureFallback(){
  if(this.synth.soundBankManager.priorityOrder.includes('lab-default'))return;
  const r=await fetch('/TimGM6mb.sf2');if(!r.ok)throw Error('Standard-SoundFont nicht erreichbar.');
  const buffer=await r.arrayBuffer();this._validate(buffer);await this._addBank(buffer,'lab-default');
 }
 async loadSoundFont(url,name=''){
  // Serialize acquisition and loading too, so a slow earlier request cannot overwrite a later one.
  const job=this._fontQueue.catch(()=>{}).then(async()=>{
   const res=await fetch(url);if(!res.ok)throw Error('SoundFont nicht gefunden (HTTP '+res.status+')');
   await this._loadFont(await res.arrayBuffer(),name||url.split('/').pop(),url==='/TimGM6mb.sf2');
  });this._fontQueue=job;return job;
 }
 async loadSoundFontBuffer(buffer,name='Eigener SoundFont'){
  const job=this._fontQueue.catch(()=>{}).then(()=>this._loadFont(buffer,name,false));this._fontQueue=job;return job;
 }
 async _loadFont(buffer,name,standard){
  // A malformed file never replaces or stops the currently usable bank.
  try{this._validate(buffer);}catch(e){throw Error('Ungültiger SoundFont: '+e.message+' Der bisherige Klang bleibt verfügbar.');}
  await this.init();this.pause();this.synth.stopAll(true);
  try{
   await this._ensureFallback();
   const old=this._customId;
   if(standard){if(old)await this.synth.soundBankManager.deleteSoundBank(old);this._customId=null;}
   else{
    const id='lab-user-'+crypto.randomUUID();await this._addBank(buffer,id);
    if(old)await this.synth.soundBankManager.deleteSoundBank(old);
    this.synth.soundBankManager.priorityOrder=[id,'lab-default'];
    // Ordered barrier: priority changes must finish before another bank operation starts.
    await this.synth.getSnapshot();this._customId=id;
   }
   this.sf={name};this.soundFontName=name;
   this._sequenceRevision=-1;
   this.onprogress(this.current,this.midi?.duration||0);
  }catch(e){
   // No unresolved worker reply is allowed to poison future font loads/playback.
   this.synth.destroy();this.synth=null;this.seq=null;this._customId=null;this.sf=null;this._sequenceRevision=-1;this._sequencePromise=null;
   if(this.ctx?.close)await this.ctx.close();this.ctx=null;this._initPromise=null;
   await this.init();await this._ensureFallback();this.sf={name:'TimGM6mb (Standard)'};this.soundFontName=this.sf.name;
   throw Error(e.message+' Standard-SoundFont wiederhergestellt.');
  }
 }
 loadMidi(buffer){
  const parsed=parseMidi(buffer);this.stop();this._midiBuffer=buffer.slice(0);this.midi=parsed;
  this._midiRevision++;this._sequenceRevision=-1;this.current=0;this.onprogress(0,parsed.duration);
 }
 async _loadSequence(){
  if(this._sequenceRevision===this._midiRevision)return;
  if(this._sequencePromise)await this._sequencePromise;
  if(this._sequenceRevision===this._midiRevision)return;
  const revision=this._midiRevision,id='lab-midi-'+crypto.randomUUID();let timer;
  const promise=new Promise((resolve,reject)=>{
   const clean=()=>{clearTimeout(timer);this.seq.eventHandler.removeEvent('songChange',id);this.seq.eventHandler.removeEvent('midiError',id);};
   this.seq.eventHandler.addEvent('songChange',id,()=>{clean();if(revision!==this._midiRevision){reject(Error('Die MIDI-Datei wurde während des Ladens gewechselt.'));return;}this.seq.pause();this._sequenceRevision=revision;resolve();});
   this.seq.eventHandler.addEvent('midiError',id,e=>{clean();reject(Error(e.message||String(e)));});
   timer=setTimeout(()=>{clean();reject(Error('MIDI-Vorbereitung hat zu lange gedauert.'));},30000);
   this.seq.loadNewSongList([{binary:this._midiBuffer.slice(0)}]);
  });this._sequencePromise=promise;
  try{await promise;}finally{if(this._sequencePromise===promise)this._sequencePromise=null;}
 }
 async play(from=this.current){
  await this._fontQueue.catch(()=>{});
  const transport=++this._transportRevision;
  if(!this.sf)throw Error('SoundFont noch nicht geladen');if(!this.midi)throw Error('Zuerst eine MIDI-Datei laden');
  await this.init();await this._loadSequence();
  if(transport!==this._transportRevision)return;
  this.current=Math.max(0,Math.min(this.midi.duration,from));this.seq.currentTime=this.current;this.seq.play();this.paused=false;
  clearInterval(this.timer);this.timer=setInterval(()=>{
   if(this.paused)return;
   this.current=Math.min(this.midi.duration,Math.max(0,this.seq.currentTime));this.onprogress(this.current,this.midi.duration);
   if(this.seq.isFinished||this.current>=this.midi.duration){this.paused=true;clearInterval(this.timer);}
  },120);
 }
 pause(){this._transportRevision++;if(this.seq){if(!this.paused&&this.midi)this.current=Math.min(this.midi.duration,Math.max(0,this.seq.currentTime));this.seq.pause();this.synth.stopAll(true);}this.paused=true;clearInterval(this.timer);this.onprogress(this.current,this.midi?.duration||0);}
 stop(){this.pause();this.current=0;if(this.seq)this.seq.currentTime=0;this.onprogress(0,this.midi?.duration||0);}
 seek(seconds){if(!this.midi)return;const playing=!this.paused;this.current=Math.max(0,Math.min(this.midi.duration,seconds));if(this.seq)this.seq.currentTime=this.current;this.onprogress(this.current,this.midi.duration);if(!playing)this.paused=true;}
}
