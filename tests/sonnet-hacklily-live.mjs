import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {expressionPlayback} from '../src/expression-playback.mjs';
import {compilerDiagnostics,recoverableLayoutError} from '../src/compiler-diagnostics.mjs';
const original=await readFile(new URL('./fixtures/sonnet-standuhr-original.ly',import.meta.url),'utf8');
const pedalFree=original.replace(/\\sustain(?:On|Off)\b/g,'');
assert(!pedalFree.includes('\\sustainOn'));
const cases=[['sonnet-original',original],['sonnet-no-pedal',pedalFree]];
async function render(src){
 const ws=new WebSocket('wss://render.hacklily.org/rpc');
 return await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.close();reject(Error('Hacklily timed out'));},60000);
  ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Hacklily WebSocket unavailable'));});
  ws.addEventListener('open',()=>ws.send(JSON.stringify({jsonrpc:'2.0',id:'sonnet-regression',method:'render',params:{backend:'svg',src,version:'stable'}})));
  ws.addEventListener('message',ev=>{try{const data=JSON.parse(ev.data);if(data.id!=='sonnet-regression')return;clearTimeout(timer);ws.close();resolve(data.result??{err:data.error,logs:JSON.stringify(data.error)})}catch(e){clearTimeout(timer);reject(e)}});
 });
}
for(const [name,source] of cases){
 const performance=expressionPlayback(source);
 const result=await render(performance.code);
 const diagnostics=compilerDiagnostics(result.logs||'');
 const recoverable=recoverableLayoutError(result.logs||'',result);
 const svg=Array.isArray(result.files)&&result.files.some(s=>typeof s==='string'&&s.includes('<svg'));
 const midi=typeof result.midi==='string'&&result.midi.length>0;
 console.log(JSON.stringify({name,sourceLength:source.length,mode:performance.mode,diagnostics:diagnostics.status,errors:diagnostics.errors,rendererError:result.err||null,svg,midi,recoverable}));
 assert(!result.err,'renderer rejected '+name);
 assert(svg&&midi,'missing SVG or MIDI for '+name);
 assert(diagnostics.status!=='error'||recoverable,'unhandled compiler error in '+name);
}
console.log('PASS: Sonnet original and pedal-free versions rendered by live Hacklily.');
