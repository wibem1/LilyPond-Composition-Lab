import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../worker/index.js';
class MemoryBucket{
 constructor(){this.items=new Map()}
 async put(key,value,opts={}){const data=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);this.items.set(key,{data,customMetadata:opts.customMetadata||{}})}
 async get(key){const o=this.items.get(key);if(!o)return null;return {body:o.data,async json(){return JSON.parse(new TextDecoder().decode(o.data))}}}
 async delete(key){this.items.delete(key)}
 async list({prefix}){return {objects:[...this.items].filter(([k])=>k.startsWith(prefix)).map(([key,o])=>({key,customMetadata:o.customMetadata})),truncated:false}}
}
const env={BUCKET:new MemoryBucket(),LAB_KEY_ENCRYPTION_KEY:btoa('01234567890123456789012345678901')};
const tiny=JSON.parse(await readFile(new URL('./fixtures/synthetic-piano-response.json',import.meta.url),'utf8')).result;
let paid=0,rendererDown=false,compileError=false,requests=[];
const answer='\\version "2.24.3"\n\\header { title = "Teststück" }\n\\score { { c\'4 d\' e\' f\' } \\layout {} \\midi {} }';
class Socket extends EventTarget{
 accept(){}
 send(s){const d=JSON.parse(s);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:d.id,result:compileError&&d.params.src.includes('header')?{err:'syntax error',logs:'line 3: invalid code'}:tiny})})))}
 close(){}
}
globalThis.fetch=async(url,opts={})=>{
 if(String(url).includes('render.hacklily.org'))return rendererDown?new Response('unavailable',{status:503}):{webSocket:new Socket()};
 if(String(url).endsWith('/models'))return Response.json({data:[{id:'test/model',name:'Test',architecture:{output_modalities:['text']},pricing:{prompt:'0.000001',completion:'0.000002'}}]});
 if(String(url).endsWith('/chat/completions')){paid++;requests.push(JSON.parse(opts.body));assert.equal(opts.headers.Authorization,'Bearer TEST-KEY');return Response.json({choices:[{message:{content:answer},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:80,cost:0.0001}})}
 throw Error('Unexpected outbound destination: '+url);
};
async function call(path,{method='GET',data,origin}={}){const headers={};if(data)headers['Content-Type']='application/json';if(origin)headers.Origin=origin;return worker.fetch(new Request('https://lab.test'+path,{method,headers,body:data?JSON.stringify(data):undefined}),env,{})}
async function value(path,opts){const r=await call(path,opts);assert.equal(r.status,200,await r.clone().text());return r.json()}
const html=await (await call('/')).text();assert(html.includes('v0.1.0'));assert(html.includes('Neu kompilieren'));assert(!html.includes('Technisch umsetzen'));
await value('/api/key-store',{method:'POST',data:{key:'TEST-KEY'}});assert.equal((await value('/api/key-status')).stored,true);
assert(!new TextDecoder().decode(env.BUCKET.items.get('settings/key.json').data).includes('TEST-KEY'));
assert.equal((await call('/api/key-store',{method:'POST',data:{key:'x'},origin:'https://evil.test'})).status,403);
const runId='0123456789abcdef',data={model:'test/model',task:'Freie Komposition',system:'MY EDITED SYSTEM',runId,title:'Test',maxTokens:24000};
const result=await value('/api/run',{method:'POST',data});assert.equal(paid,1);assert.equal(result.answer,answer);assert(result.compiled.pages.length);assert(result.compiled.url.endsWith('.mid'));assert.equal(requests[0].messages[0].content,'MY EDITED SYSTEM');assert.equal(requests[0].max_tokens,24000);assert(!('reasoning' in requests[0]));
assert.equal((await call(result.compiled.pages[0].url)).headers.get('Content-Type'),'image/svg+xml');assert.equal((await call(result.compiled.url)).status,200);
const history=(await value('/api/history/'+result.historyId)).entry;assert.equal(history.techout,answer);assert.equal(history.system,'MY EDITED SYSTEM');assert.equal(history.pages.length,result.compiled.pages.length);
const ws=(await value('/api/workspace')).workspace;assert.equal(ws.techout,answer);assert.equal(ws.compositionModel,'test/model');
const diag=await (await call('/api/diagnosis?runId='+runId)).text();assert(!diag.includes('TEST-KEY'));assert.equal(JSON.parse(diag).entries.length,3);assert(diag.includes('durationMs'));assert(diag.includes('MY EDITED SYSTEM'));
compileError=true;const failed=await value('/api/run',{method:'POST',data:{...data,runId:'fedcba9876543210'}});assert(failed.compiled.error);assert.equal((await value('/api/history/'+failed.historyId)).entry.techout,answer);assert((await value('/api/workspace')).workspace.compiler.includes('line 3'));
const compiled=await call('/api/compile-lilypond',{method:'POST',data:{code:answer,runId:'abcdef0123456789'}});assert.equal(compiled.status,422);assert((await compiled.json()).logs.includes('line 3'));
rendererDown=true;const count=paid;assert.equal((await call('/api/run',{method:'POST',data:{...data,runId:'aaaabbbbccccdddd'}})).status,412);assert.equal(paid,count);assert.equal((await call('/api/diagnosis?runId=aaaabbbbccccdddd')).status,200);
await value('/api/workspace',{method:'POST',data:{workspace:{...ws,key:'DO-NOT-SAVE'}}});assert(!JSON.stringify(await value('/api/workspace')).includes('DO-NOT-SAVE'));
await value('/api/history/'+result.historyId,{method:'DELETE'});assert.equal((await call('/api/history/'+result.historyId)).status,404);
await value('/api/key-store',{method:'DELETE'});assert.equal((await value('/api/key-status')).stored,false);
for(const path of ['/app.mjs','/style.css','/TimGM6mb.sf2','/soundfont-player.mjs','/manifest.webmanifest','/favicon.svg','/LICENSE-SOUNDFONT.txt'])assert.equal((await call(path)).status,200);
console.log('PASS: direct composition, editable system, no reasoning throttle, encrypted key, original answer survives compiler failure, SVG/MIDI, history, workspace, diagnostics, cost stop, deletion, assets.');
