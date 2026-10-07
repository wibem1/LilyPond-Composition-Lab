import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import worker from '../worker/index.js';
import {SoundBankLoader,BasicSoundBank,SpessaSynthProcessor,SPESSA_BUFSIZE} from 'spessasynth_core';
const get=path=>worker.fetch(new Request('https://test.local'+path),{},{});
const font=await (await get('/TimGM6mb.sf2')).arrayBuffer();
const synth=new SpessaSynthProcessor(48000,{effectsEnabled:false});await synth.processorInitialized;
const energy=()=>{synth.noteOn(0,60,90);let sum=0;for(let i=0;i<200;i++){const l=new Float32Array(SPESSA_BUFSIZE),r=new Float32Array(SPESSA_BUFSIZE);synth.process(l,r);for(const v of [...l,...r]){assert(Number.isFinite(v));sum+=v*v;}}synth.stopAllChannels(true);assert(sum>.001);return sum;};
synth.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(font.slice(0)),'default');const a=energy();
synth.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(font.slice(0)),'custom');synth.soundBankManager.priorityOrder=['custom','default'];const b=energy();synth.soundBankManager.deleteSoundBank('custom');const c=energy();
console.log('PASS: real stereo PCM is finite and audible before/after font changes:',[a,b,c].map(x=>x.toFixed(2)).join(', '));
let code=await readFile('src/player-adapter.mjs','utf8');code=code.replace("from '/spessasynth.mjs'",`from '${pathToFileURL(process.cwd()+'/node_modules/spessasynth_lib/dist/index.js')}'`);code=code.replace('WorkletSynthesizer,Sequencer,SoundBankLoader','WorkletSynthesizer,Sequencer');code+='\n'+await readFile('src/midi-reader.mjs','utf8');
const {SoundFontPlayer}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
// Exercise the production initializer and real library, enforcing browser node
// limits rather than bypassing construction with createEngine.
const previousWindow=globalThis.window,previousNode=globalThis.AudioWorkletNode;
const connections=[];let moduleLoaded=false;
class BrowserContext{
 state='suspended';currentTime=0;destination={};
 audioWorklet={addModule:async path=>{assert.equal((await get(path)).status,200);moduleLoaded=true;}};
 async resume(){this.state='running';}async close(){this.state='closed';}
 createGain(){return {gain:{value:0},connect:dest=>assert.equal(dest,this.destination)};}
}
globalThis.window={AudioContext:BrowserContext,addEventListener(){}};
globalThis.AudioWorkletNode=class{
 constructor(context,name,options){
  assert(moduleLoaded,'processor must be registered before construction');
  if(options.outputChannelCount.some(n=>n>32))throw new DOMException('Unsupported output channel count','NotSupportedError');
  this.context=context;this.options=options;
  this.port={postMessage(){},onmessage:null};
  queueMicrotask(()=>this.port.onmessage({data:{type:'isFullyInitialized',data:{type:'sf3Decoder',data:null}}}));
 }
 connect(dest,index){assert(index<this.options.numberOfOutputs,'output index must exist');assert.equal(this.options.outputChannelCount[index],2);connections.push({dest,index});}
 disconnect(){}
};
const {WorkletSynthesizer}=await import('spessasynth_lib');
moduleLoaded=true;
const originalError=console.error;console.error=()=>{};
try{assert.throws(()=>new WorkletSynthesizer(new BrowserContext(),{oneOutput:true}),e=>e.cause?.name==='NotSupportedError');}finally{console.error=originalError;}
moduleLoaded=false;
try{
 const realPlayer=new SoundFontPlayer();await realPlayer.init();
 assert.equal(connections.length,17);assert(connections.every(c=>c.dest===realPlayer.master));assert(realPlayer.seq);
 realPlayer.synth.destroy();await realPlayer.ctx.close();
}finally{globalThis.window=previousWindow;globalThis.AudioWorkletNode=previousNode;}
assert.equal(await (await get('/soundfont-player.mjs')).text(),await readFile('src/player-adapter.mjs','utf8')+'\n'+await readFile('src/midi-reader.mjs','utf8'));
console.log('PASS: old configuration reproduces node error; shipped player initializes real library with valid stereo connections.');
class Events{events=new Map();addEvent(t,id,f){this.events.set(t+id,{t,f});}removeEvent(t,id){this.events.delete(t+id);}emit(t,d={}){for(const e of [...this.events.values()])if(e.t===t)e.f(d);}}
let fail=false,engines=0;
const createEngine=async()=>{engines++;const ids=[];return {ctx:{state:'running',currentTime:0,close:async()=>{},resume:async()=>{}},master:{gain:{setTargetAtTime(){}}},synth:{eventHandler:new Events(),stopAll(){},destroy(){},getSnapshot:async()=>{},soundBankManager:{get priorityOrder(){return ids},set priorityOrder(v){ids.splice(0,ids.length,...v)},async addSoundBank(b,id){if(fail){fail=false;throw Error('decode failed')}ids.push(id)},async deleteSoundBank(id){ids.splice(ids.indexOf(id),1)}}},seq:{eventHandler:new Events(),currentTime:0,isFinished:false,pause(){this.playing=false},play(){this.playing=true},loadNewSongList(){queueMicrotask(()=>this.eventHandler.emit('songChange'))}}};};
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(font.slice(0));
const player=new SoundFontPlayer({createEngine,validate:b=>{if(b.byteLength<4)throw Error('bad file');return 1}});
// Own simple MIDI fixture, one note lasting one second.
const midi=Uint8Array.from([77,84,104,100,0,0,0,6,0,0,0,1,0,96,77,84,114,107,0,0,0,13,0,144,60,90,129,64,128,60,0,0,255,47,0]).buffer;
player.loadMidi(midi);await player.loadSoundFontBuffer(font.slice(0),'A');await player.play();assert(!player.paused);player.pause();assert(player.paused);
await Promise.all([player.loadSoundFontBuffer(font.slice(0),'B'),player.loadSoundFontBuffer(font.slice(0),'C')]);assert.equal(player.soundFontName,'C');assert(player.paused);
await assert.rejects(player.loadSoundFontBuffer(new ArrayBuffer(1),'bad'),/bisherige Klang/);assert.equal(player.soundFontName,'C');await player.play();assert(!player.paused);
player.seek(.4);assert(!player.paused);player.stop();assert.equal(player.current,0);player.seek(.2);assert(player.paused);
fail=true;await assert.rejects(player.loadSoundFontBuffer(font.slice(0),'broken'),/wiederhergestellt/);assert.equal(engines,2);assert.equal(player.soundFontName,'TimGM6mb (Standard)');await player.play();assert(!player.paused);player.stop();
const html=await (await get('/style.css')).text();assert(html.includes('font-size:16px'));assert(html.includes('minmax(0,1fr)'));assert((await (await get('/app.mjs')).text()).includes("window.addEventListener('pageshow',resetEntryViewport)"));assert(!html.includes('user-scalable=no'));
for(const asset of ['/spessasynth.mjs','/spessasynth-processor.js','/LICENSE-SYNTH.txt'])assert.equal((await get(asset)).status,200);
globalThis.fetch=originalFetch;
console.log('PASS: serialized font changes, corrupt font preserves playback, decoder failure recovers, transport pause/stop/seek, self-hosted audio assets and zoomable entry viewport.');

// A non-GM custom bank must win over the exact GM piano in the standard bank.
const customBank=SoundBankLoader.fromArrayBuffer(BasicSoundBank.getSampleSoundBankFile());
customBank.presets[0].name='Selected custom saw';customBank.presets[0].bankMSB=4;customBank.presets[0].program=12;const distinct=customBank.writeSF2();
const oldCore=new SpessaSynthProcessor(48000,{effectsEnabled:false});await oldCore.processorInitialized;
oldCore.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(font.slice(0)),'default');oldCore.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(distinct.slice(0)),'custom');oldCore.soundBankManager.priorityOrder=['custom','default'];oldCore.programChange(0,0);assert.notEqual(oldCore.midiChannels[0].preset.name,'Selected custom saw');
const realCore=new SpessaSynthProcessor(48000,{effectsEnabled:false});await realCore.processorInitialized;
const realManager=realCore.soundBankManager;const audioPlayer=new SoundFontPlayer({validate:b=>SoundBankLoader.fromArrayBuffer(b).presets.length,createEngine:async()=>({ctx:{state:'running',resume:async()=>{}},master:{},synth:{eventHandler:new Events(),stopAll:()=>realCore.stopAllChannels(true),getSnapshot:async()=>{},soundBankManager:{get priorityOrder(){return realManager.priorityOrder},set priorityOrder(v){realManager.priorityOrder=v},async addSoundBank(b,id){realManager.addSoundBank(SoundBankLoader.fromArrayBuffer(b),id)},async deleteSoundBank(id){realManager.deleteSoundBank(id)}}},seq:{eventHandler:new Events(),currentTime:0,pause(){},play(){realCore.programChange(0,0)},loadNewSongList(){queueMicrotask(()=>this.eventHandler.emit('songChange'))}}})});
globalThis.fetch=async()=>new Response(font.slice(0));audioPlayer.loadMidi(midi);await audioPlayer.loadSoundFontBuffer(distinct.slice(0),'Own font');await audioPlayer.play();assert.equal(realCore.midiChannels[0].preset.name,'Selected custom saw');assert.equal(realManager.priorityOrder.length,1);
const pcm=core=>{core.noteOn(0,60,90);const data=[];for(let i=0;i<40;i++){const l=new Float32Array(SPESSA_BUFSIZE),r=new Float32Array(SPESSA_BUFSIZE);core.process(l,r);for(const v of l){assert(Number.isFinite(v));data.push(v)}}core.stopAllChannels(true);return data};
const standardPCM=pcm(oldCore),customPCM=pcm(realCore);assert(customPCM.some(x=>Math.abs(x)>.0001));assert(standardPCM.some((v,i)=>Math.abs(v-customPCM[i])>.001));
await audioPlayer.loadSoundFont('/TimGM6mb.sf2','TimGM6mb');await audioPlayer.play();assert.notEqual(realCore.midiChannels[0].preset.name,'Selected custom saw');assert.deepEqual(realManager.priorityOrder,['lab-default']);audioPlayer.stop();globalThis.fetch=originalFetch;
console.log('PASS: old stack reproduces standard piano despite custom priority; shipped adapter selects the non-GM custom preset, produces different real PCM and switches back to standard.');
