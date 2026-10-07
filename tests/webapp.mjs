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
const driftMidi=(await readFile(new URL('./fixtures/luna-octave-drift.mid',import.meta.url))).toString('base64');let rendererMidi=null;
let paid=0,rendererDown=false,compileError=false,requests=[],rejectKey=false,redirectKey=false;
let repairAnswer=null,repairMidi=null,repairFinish='stop',compositionFinish='stop';
let namingAnswers=['Teststück · 2','Nächtlicher Dialog','Dämmerpfade'],namingDown=false;
const answer='\\version "2.24.3"\n\\header { title = "Teststück" }\n\\score { { c\'4 d\' e\' f\' } \\layout {} \\midi {} }';
class Socket extends EventTarget{
 accept(){}
 send(s){const d=JSON.parse(s);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:d.id,result:compileError&&d.params.src.includes('header')?{err:'syntax error',logs:'line 3: invalid code'}:repairMidi&&d.params.src.includes("c''4")?{...tiny,midi:repairMidi}:rendererMidi?{...tiny,midi:rendererMidi}:tiny})})))}
 close(){}
}
globalThis.fetch=async(url,opts={})=>{
 if(opts.redirect!==undefined&&!['follow','manual'].includes(opts.redirect))throw Error('Invalid redirect value in Worker');
 if(String(url).includes('render.hacklily.org'))return rendererDown?new Response('unavailable',{status:503}):{webSocket:new Socket()};
 if(String(url).endsWith('/key')){assert.equal(opts.redirect,'manual');if(redirectKey)return new Response(null,{status:302,headers:{Location:'https://other.test'}});assert.equal(opts.headers.Authorization,'Bearer sk-or-v1-TESTKEY');return rejectKey?Response.json({error:{message:'Missing Authentication header'}},{status:401}):Response.json({data:{label:'test'}});}
 if(String(url).endsWith('/models'))return Response.json({data:[{id:'test/model',name:'Test',architecture:{output_modalities:['text']},pricing:{prompt:'0.000001',completion:'0.000002'}}]});
 if(String(url).endsWith('/chat/completions')){assert.equal(opts.redirect,'manual');paid++;const request=JSON.parse(opts.body);requests.push(request);assert.equal(opts.headers.Authorization,'Bearer sk-or-v1-TESTKEY');const naming=request.max_tokens===1000;if(naming&&namingDown)return Response.json({error:{message:'unavailable'}},{status:503});return Response.json({choices:[{message:{content:(/^(Repariere ausschließlich|Korrigiere ausschließlich)/.test(request.messages[0].content))?repairAnswer:naming?JSON.stringify({title:namingAnswers.shift()}):answer},finish_reason:(/^(Repariere ausschließlich|Korrigiere ausschließlich)/.test(request.messages[0].content))?repairFinish:compositionFinish}],usage:{prompt_tokens:100,completion_tokens:80,cost:0.0001}})}
 throw Error('Unexpected outbound destination: '+url);
};
async function call(path,{method='GET',data,origin}={}){const headers={};if(data)headers['Content-Type']='application/json';if(origin)headers.Origin=origin;return worker.fetch(new Request('https://lab.test'+path,{method,headers,body:data?JSON.stringify(data):undefined}),env,{})}
async function value(path,opts){const r=await call(path,opts);assert.equal(r.status,200,await r.clone().text());return r.json()}
const html=await (await call('/')).text();assert(html.includes('v0.1.16'));assert(html.includes('Neu kompilieren'));assert(!html.includes('Technisch umsetzen'));
await value('/api/key-store',{method:'POST',data:{key:'sk-or-v1-TESTKEY'}});assert.equal((await value('/api/key-status')).stored,true);
assert(!new TextDecoder().decode(env.BUCKET.items.get('settings/key.json').data).includes('sk-or-v1-TESTKEY'));
assert.equal((await call('/api/key-store',{method:'POST',data:{key:'x'},origin:'https://evil.test'})).status,403);
// Copied Bearer prefix, whitespace and zero-width characters are normalized.
await value('/api/key-check',{method:'POST',data:{key:' Bearer sk-or-v1-TEST\u200bKEY\n'}});
const before=paid;const wrong=await call('/api/key-store',{method:'POST',data:{key:'sk-ant-OTHER'}});assert.equal(wrong.status,400);assert.equal(paid,before);assert.equal((await value('/api/key-status')).stored,true);
rejectKey=true;const rejected=await call('/api/run',{method:'POST',data:{model:'test/model',task:'Test',runId:'aaaaffffbbbbcccc'}});assert.equal(rejected.status,401);assert.equal(paid,before);assert((await rejected.json()).error.includes('OpenRouter akzeptiert'));
assert(!JSON.stringify(await (await call('/api/diagnosis?runId=aaaaffffbbbbcccc')).json()).includes('sk-or-v1-TESTKEY'));
rejectKey=false;
redirectKey=true;const redirect=await call('/api/key-check',{method:'POST',data:{}});assert.equal(redirect.status,400);assert((await redirect.json()).error.includes('Weiterleitung'));redirectKey=false;
const runId='0123456789abcdef',data={model:'test/model',task:'Freie Komposition',system:'MY EDITED SYSTEM',runId,title:'Test',maxTokens:24000};
const result=await value('/api/run',{method:'POST',data});assert.equal(paid,1);assert.equal(result.answer,answer);assert(result.compiled.pages.length);assert(result.compiled.url.endsWith('.mid'));assert.equal(requests[0].messages[0].content,'MY EDITED SYSTEM');assert.equal(requests[0].max_tokens,24000);assert(!('reasoning' in requests[0]));
assert.equal((await call(result.compiled.pages[0].url)).headers.get('Content-Type'),'image/svg+xml');assert.equal((await call(result.compiled.url)).status,200);
const history=(await value('/api/history/'+result.historyId)).entry;assert.equal(history.techout,answer);assert.equal(history.system,'MY EDITED SYSTEM');assert.equal(history.pages.length,result.compiled.pages.length);
const ws=(await value('/api/workspace')).workspace;assert.equal(ws.techout,answer);assert.equal(ws.compositionModel,'test/model');
const diag=await (await call('/api/diagnosis?runId='+runId)).text();assert(!diag.includes('sk-or-v1-TESTKEY'));assert.equal(JSON.parse(diag).entries.length,3);assert(diag.includes('durationMs'));assert(diag.includes('MY EDITED SYSTEM'));
const repeated=await value('/api/run',{method:'POST',data:{...data,runId:'1111222233334444',title:result.title}});
assert.equal(repeated.title,'Nächtlicher Dialog');assert.equal(repeated.answer,answer.replace('Teststück','Nächtlicher Dialog'));assert.equal(repeated.rawAnswer,answer);
assert.equal(repeated.titleWarning,'');assert(Math.abs(repeated.usage.cost-.0003)<1e-9);
const namingDiag=await (await call('/api/diagnosis?runId=1111222233334444')).json();assert(Math.abs(namingDiag.costs.total-.0003)<1e-9);assert.equal(namingDiag.entries.filter(e=>e.operation==='title'&&e.event==='antwort').length,2);
assert.equal(requests[1].messages.length,2);assert.equal(requests[0].messages.length,2);assert.equal(requests[1].messages[0].content,data.system);assert.equal(requests[1].messages[1].content,data.task);
assert.equal((await value('/api/history/'+repeated.historyId)).entry.title,repeated.title);
assert.equal((await value('/api/workspace')).workspace.title,repeated.title);
assert.equal(await (await call(repeated.downloads[0].url)).text(),repeated.answer);
assert(repeated.compiled.url.includes(encodeURIComponent(repeated.title)));
compileError=true;const failed=await value('/api/run',{method:'POST',data:{...data,runId:'fedcba9876543210'}});assert(failed.compiled.error);assert.equal(failed.title,'Dämmerpfade');assert.equal((await value('/api/history/'+failed.historyId)).entry.techout,failed.answer);assert.equal(failed.rawAnswer,answer);assert((await value('/api/workspace')).workspace.compiler.includes('line 3'));
const compiled=await call('/api/compile-lilypond',{method:'POST',data:{code:answer,runId:'abcdef0123456789'}});assert.equal(compiled.status,422);assert((await compiled.json()).logs.includes('line 3'));
compileError=false;namingDown=true;
const defaultIndex=requests.length;
const namingFailed=await value('/api/run',{method:'POST',data:{...data,system:'',runId:'4444555566667777'}});assert(namingFailed.titleWarning.includes('ursprünglichen Titel'));assert.equal(namingFailed.answer,answer);assert(namingFailed.compiled.url);assert.equal((await value('/api/history/'+namingFailed.historyId)).entry.techout,answer);namingDown=false;
const originalPrompt=requests[defaultIndex].messages[0].content;
assert(originalPrompt.endsWith('Es gibt keinen vorgeschalteten Entwurf.'));assert(!originalPrompt.includes('Technische Notation'));
// Restore the unchanged technical standard stored by v0.1.7/8, retaining edited prompts.
const technicalPrompt=originalPrompt+' Technische Notation: Verwende absolute Tonhöhen mit ausdrücklich angegebenen Oktaven (ohne \\relative). Prüfe die tatsächlichen Oktavlagen; Verwende für jedes Instrument dessen spielbaren klingenden Tonumfang; für Klavier A0 bis C8. Diese Notationsregel macht keine Vorgaben zur musikalischen Gestaltung.';
const migrationIndex=requests.length;namingDown=true;
await value('/api/run',{method:'POST',data:{...data,system:technicalPrompt,runId:'5555666677778888'}});
assert.equal(requests[migrationIndex].messages[0].content,originalPrompt);assert.equal((await value('/api/workspace')).workspace.system,originalPrompt);namingDown=false;
rendererMidi=driftMidi;
const drift=await value('/api/compile-lilypond',{method:'POST',data:{code:answer,title:'Oktavtest',runId:'88889999aaaabbbb'}});
assert(drift.warning.includes('Tonumfang prüfen'));assert(drift.url);assert.equal((await call(drift.url)).status,200);assert(drift.pages.length);rendererMidi=null;
// Repair runs only after detected range violations; costs are logged separately.
rendererMidi=driftMidi;repairMidi=(await readFile(new URL('./fixtures/luna-octaves-corrected.mid',import.meta.url))).toString('base64');repairAnswer=JSON.stringify({edits:[{id:0,marks:2}]});namingDown=true;
const repairIndex=requests.length;
const repaired=await value('/api/run',{method:'POST',data:{...data,runId:'aaaaccccdddd1111'}});
assert.equal(repaired.answer,answer.replace("c'4","c''4"));assert.equal(repaired.rawAnswer,answer);assert.equal(repaired.compiled.rangeCheck.status,'passed');assert(repaired.compiled.repair);assert.equal(repaired.costs.realisation,.0001);
assert.equal(requests[repairIndex].messages.length,2);assert(requests.some(r=>r.messages[0].content.startsWith('Repariere ausschließlich')));
const rd=await (await call('/api/diagnosis?runId=aaaaccccdddd1111')).json();assert.equal(rd.costs.realisation,.0001);assert(rd.entries.some(e=>e.event==='korrektur'&&e.accepted===true));
assert.equal((await value('/api/history/'+repaired.historyId)).entry.techout,answer.replace("c'4","c''4"));assert.equal((await value('/api/workspace')).workspace.costs.realisation,.0001);
// A candidate changing the music is rejected and cannot overwrite the original.
repairAnswer=JSON.stringify({edits:[{from:"c'4",to:"d''4"}]});const unsafe=await value('/api/run',{method:'POST',data:{...data,runId:'aaaaccccdddd2222'}});assert.equal(unsafe.answer,answer);assert(unsafe.compiled.repairFailed);assert(unsafe.compiled.warning.includes('Original erhalten'));assert.equal(unsafe.costs.realisation,.0002);
repairFinish='length';repairAnswer=JSON.stringify({edits:[{id:0,marks:2}]});const truncated=await value('/api/run',{method:'POST',data:{...data,runId:'aaaaccccdddd5555'}});assert.equal(truncated.answer,answer);assert(truncated.compiled.repairFailed);repairFinish='stop';
assert.equal(requests.find(r=>r.messages[0].content.startsWith('Repariere ausschließlich')).reasoning.effort,'low');assert.equal(requests.find(r=>r.messages[0].content.startsWith('Repariere ausschließlich')).max_tokens,8000);assert(!('reasoning' in requests[0]));
// An octave-only candidate which remains out of range is also rejected.
repairMidi=null;repairAnswer=JSON.stringify({edits:[{id:0,marks:2}]});const stillBad=await value('/api/run',{method:'POST',data:{...data,runId:'aaaaccccdddd3333'}});assert.equal(stillBad.answer,answer);assert(stillBad.compiled.warning.includes('Original erhalten'));
// Register drift triggers repair even when the absolute playable range passes.
const celloFixture=JSON.parse(await readFile(new URL('./fixtures/cello-register-events.json',import.meta.url),'utf8'));
rendererMidi=celloFixture.original.midiBase64;repairMidi=celloFixture.corrected.midiBase64;repairAnswer=JSON.stringify({edits:[{id:0,marks:2}]});
const registerFixed=await value('/api/run',{method:'POST',data:{...data,runId:'aaaaccccdddd4444'}});
assert(registerFixed.compiled.repair);assert.equal(registerFixed.compiled.rangeCheck.status,'passed');assert.equal(registerFixed.compiled.registerCheck.status,'passed');assert.equal(registerFixed.costs.realisation,.0001);
const manual=await value('/api/repair-octaves',{method:'POST',data:{code:answer,model:'test/model',runId:'aaaaccccdddd6666'}});assert(manual.compiled.repair);assert.equal(manual.code,answer.replace("c'4","c''4"));assert.equal(manual.cost,.0001);
repairMidi=null;
rendererMidi=null;repairAnswer=null;namingDown=false;
rendererDown=true;const count=paid;assert.equal((await call('/api/run',{method:'POST',data:{...data,runId:'aaaabbbbccccdddd'}})).status,412);assert.equal(paid,count);assert.equal((await call('/api/diagnosis?runId=aaaabbbbccccdddd')).status,200);
await value('/api/workspace',{method:'POST',data:{workspace:{...ws,key:'DO-NOT-SAVE'}}});assert(!JSON.stringify(await value('/api/workspace')).includes('DO-NOT-SAVE'));
await value('/api/history/'+result.historyId,{method:'DELETE'});assert.equal((await call('/api/history/'+result.historyId)).status,404);
await value('/api/key-store',{method:'DELETE'});assert.equal((await value('/api/key-status')).stored,false);
for(const path of ['/app.mjs','/style.css','/TimGM6mb.sf2','/soundfont-player.mjs','/manifest.webmanifest','/favicon.svg','/LICENSE-SOUNDFONT.txt'])assert.equal((await call(path)).status,200);
console.log('PASS: direct composition, editable system, no reasoning throttle, encrypted key, original answer survives compiler failure, SVG/MIDI, history, workspace, diagnostics, cost stop, deletion, assets.');

rendererDown=false;rendererMidi=null;repairMidi=null;compositionFinish='length';const paidBeforeCut=paid;const cut=await value('/api/run',{method:'POST',data:{...data,key:"sk-or-v1-TESTKEY",maxTokens:8000,runId:'aaaaccccdddd7777'}});
assert.equal(paid,paidBeforeCut+1);assert.equal(requests.at(-1).max_tokens,64000);assert(!('reasoning' in requests.at(-1)));assert(cut.compiled.incomplete);assert(cut.compiled.error.includes('abgeschnitten'));assert.equal(cut.rawAnswer,answer);assert(!cut.compiled.url);assert(!cut.compiled.pages);assert.equal((await value('/api/history/'+cut.historyId)).entry.techout,answer);assert((await value('/api/workspace')).workspace.compiler.includes('abgeschnitten'));assert.equal(cut.costs.composition,.0001);assert.equal(cut.costs.realisation,0);assert.equal(cut.downloads.length,1);compositionFinish='stop';
console.log('PASS: legacy 8000 budget raised to 64000; explicit 24000 retained; truncated answer and costs preserved without naming, compiler or repair calls.');

const repairCalls=requests.filter(r=>r.messages[0].content.startsWith('Repariere ausschließlich'));assert(repairCalls.some(r=>r.reasoning.effort==='medium'&&r.max_tokens===24000));assert(repairCalls.some(r=>r.reasoning.effort==='low'&&r.max_tokens===8000));console.log('PASS: fast initial correction, deeper fallback only after failed validation.');

rendererMidi=driftMidi;repairMidi=(await readFile(new URL('./fixtures/luna-octaves-corrected.mid',import.meta.url))).toString('base64');repairAnswer=JSON.stringify({octaves:[6]});
const relativeManual=await value('/api/repair-octaves',{method:'POST',data:{key:'sk-or-v1-TESTKEY',code:"\\score { \\relative c' { c'4 } \\layout {} \\midi {} }",model:'test/model',runId:'aaaaccccdddd8888'}});assert(relativeManual.compiled.repair);assert(relativeManual.code.includes("c''4"));assert(requests.at(-1).messages[0].content.startsWith('Korrigiere ausschließlich'));assert.equal(requests.at(-1).reasoning.effort,'low');
console.log('PASS: Worker uses absolute target protocol and mechanical relative encoding before MIDI validation.');
