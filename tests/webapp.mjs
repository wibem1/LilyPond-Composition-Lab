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
let expressionError=false,localRepairSource=null,localRepairMidi=null,ottavaTest='same';
let paid=0,rendererDown=false,compileError=false,requests=[],rejectKey=false,redirectKey=false;
let repairAnswer=null,repairMidi=null,repairFinish='stop',compositionFinish='stop',reportedModel=undefined;
let namingAnswers=['Teststück · 2','Nächtlicher Dialog','Dämmerpfade'],namingDown=false;
const answer='\\version "2.24.3"\n\\header { title = "Teststück" }\n\\score { { c\'4 d\' e\' f\' } \\layout {} \\midi {} }';
const attributedAnswer='% KI-Modell: test/model\n'+answer.replace('title = "Teststück" }','title = "Teststück" \n  composer = "test/model"\n}');
const withoutOttava=s=>s.replace(/\\ottava #-?\d+\s*/g,'').replace(/\s+/g,' ').trim();
class Socket extends EventTarget{
 accept(){}
 send(s){const d=JSON.parse(s);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:d.id,result:d.params.src.includes('\\ottava #')&&ottavaTest==='error'?{err:'ottava rendering failed'}:d.params.src.includes('\\ottava #')&&ottavaTest==='different'?{...tiny,midi:driftMidi}:localRepairSource&&d.params.src.includes(localRepairSource)?{...tiny,midi:localRepairMidi}:expressionError&&d.params.src.includes('labExpressionText')?{err:'expression failed',logs:'synthetic unsupported expression'}:compileError&&d.params.src.includes('header')?{err:'syntax error',logs:'line 3: invalid code'}:repairMidi&&d.params.src.includes("c''4")?{...tiny,midi:repairMidi}:rendererMidi?{...tiny,midi:rendererMidi}:tiny})})))}
 close(){}
}
globalThis.fetch=async(url,opts={})=>{
 if(opts.redirect!==undefined&&!['follow','manual'].includes(opts.redirect))throw Error('Invalid redirect value in Worker');
 if(String(url).includes('render.hacklily.org'))return rendererDown?new Response('unavailable',{status:503}):{webSocket:new Socket()};
 if(String(url).endsWith('/key')){assert.equal(opts.redirect,'manual');if(redirectKey)return new Response(null,{status:302,headers:{Location:'https://other.test'}});assert.equal(opts.headers.Authorization,'Bearer sk-or-v1-TESTKEY');return rejectKey?Response.json({error:{message:'Missing Authentication header'}},{status:401}):Response.json({data:{label:'test'}});}
 if(String(url).endsWith('/models'))return Response.json({data:[{id:'test/model',name:'Test',architecture:{output_modalities:['text']},pricing:{prompt:'0.000001',completion:'0.000002'}}]});
 if(String(url).endsWith('/chat/completions')){assert.equal(opts.redirect,'manual');paid++;const request=JSON.parse(opts.body);requests.push(request);assert.equal(opts.headers.Authorization,'Bearer sk-or-v1-TESTKEY');const naming=request.max_tokens===1000;if(naming&&namingDown)return Response.json({error:{message:'unavailable'}},{status:503});return Response.json({model:reportedModel,choices:[{message:{content:(/^(Repariere ausschließlich|Korrigiere ausschließlich)/.test(request.messages[0].content))?repairAnswer:naming?JSON.stringify({title:namingAnswers.shift()}):answer},finish_reason:(/^(Repariere ausschließlich|Korrigiere ausschließlich)/.test(request.messages[0].content))?repairFinish:compositionFinish}],usage:{prompt_tokens:100,completion_tokens:80,cost:0.0001}})}
 throw Error('Unexpected outbound destination: '+url);
};
async function call(path,{method='GET',data,origin}={}){const headers={};if(data)headers['Content-Type']='application/json';if(origin)headers.Origin=origin;return worker.fetch(new Request('https://lab.test'+path,{method,headers,body:data?JSON.stringify(data):undefined}),env,{})}
async function value(path,opts){const r=await call(path,opts);assert.equal(r.status,200,await r.clone().text());return r.json()}
const html=await (await call('/')).text();assert(html.includes('v0.1.37'));assert(html.includes('Neu kompilieren'));assert(!html.includes('Technisch umsetzen'));
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
const result=await value('/api/run',{method:'POST',data});assert.equal(paid,1);assert.equal(result.answer,attributedAnswer);assert(result.compiled.pages.length);assert(result.compiled.url.endsWith('.mid'));assert.equal(requests[0].messages[0].content,'MY EDITED SYSTEM');assert.equal(requests[0].max_tokens,24000);assert(!('reasoning' in requests[0]));
assert.equal((await call(result.compiled.pages[0].url)).headers.get('Content-Type'),'image/svg+xml');assert.equal((await call(result.compiled.url)).status,200);
const history=(await value('/api/history/'+result.historyId)).entry;assert.equal(history.techout,attributedAnswer);assert.equal(history.system,'MY EDITED SYSTEM');assert.equal(history.pages.length,result.compiled.pages.length);
const ws=(await value('/api/workspace')).workspace;assert.equal(ws.techout,attributedAnswer);assert.equal(ws.compositionModel,'test/model');
const diag=await (await call('/api/diagnosis?runId='+runId)).text();assert(!diag.includes('sk-or-v1-TESTKEY'));assert.equal(JSON.parse(diag).entries.length,3);assert(diag.includes('durationMs'));assert(diag.includes('MY EDITED SYSTEM'));
const repeated=await value('/api/run',{method:'POST',data:{...data,runId:'1111222233334444',title:result.title}});
assert.equal(repeated.title,'Nächtlicher Dialog');assert.equal(repeated.answer,attributedAnswer.replace('Teststück','Nächtlicher Dialog'));assert.equal(repeated.rawAnswer,answer);
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
const namingFailed=await value('/api/run',{method:'POST',data:{...data,system:'',runId:'4444555566667777'}});assert(namingFailed.titleWarning.includes('ursprünglichen Titel'));assert.equal(namingFailed.answer,attributedAnswer);assert(namingFailed.compiled.url);assert.equal((await value('/api/history/'+namingFailed.historyId)).entry.techout,attributedAnswer);namingDown=false;
const originalPrompt=requests[defaultIndex].messages[0].content;
assert(originalPrompt.includes('Es gibt keinen vorgeschalteten Entwurf.'));assert(originalPrompt.includes('Pedalangaben'));assert(originalPrompt.includes('Verzierungen, wenn sie musikalisch passen')); assert(!originalPrompt.includes('Technische Notation'));assert(originalPrompt.includes('Oktavnotation:'));assert(originalPrompt.includes('absolute Tonhöhen'));assert(originalPrompt.includes('c = C3'));assert(originalPrompt.includes("c' = C4"));assert(originalPrompt.includes('kein \\relative'));assert(originalPrompt.includes('jeder Note und jedem Akkordton'));
// Restore the unchanged technical standard stored by v0.1.7/8, retaining edited prompts.
const legacyPrompt=originalPrompt.split(' Notiere die musikalisch')[0];
const technicalPrompt=legacyPrompt+' Technische Notation: Verwende absolute Tonhöhen mit ausdrücklich angegebenen Oktaven (ohne \\relative). Prüfe die tatsächlichen Oktavlagen; Verwende für jedes Instrument dessen spielbaren klingenden Tonumfang; für Klavier A0 bis C8. Diese Notationsregel macht keine Vorgaben zur musikalischen Gestaltung.';
const migrationIndex=requests.length;namingDown=true;
await value('/api/run',{method:'POST',data:{...data,system:technicalPrompt,runId:'5555666677778888'}});
assert.equal(requests[migrationIndex].messages[0].content,originalPrompt);assert.equal((await value('/api/workspace')).workspace.system,originalPrompt);namingDown=false;
rendererMidi=driftMidi;
const drift=await value('/api/compile-lilypond',{method:'POST',data:{code:answer,title:'Oktavtest',runId:'88889999aaaabbbb'}});
assert(drift.warning.includes('Tonumfang prüfen'));assert(drift.url);assert.equal((await call(drift.url)).status,200);assert(drift.pages.length);rendererMidi=null;
// A MIDI violation not explained by source pitches is reported, never sent to AI.
rendererMidi=driftMidi;namingDown=true;
const mechanical=await value('/api/run',{method:'POST',data:{...data,runId:'aaaaccccdddd1111'}});
assert.equal(mechanical.answer,attributedAnswer);assert(mechanical.compiled.repairFailed);assert.equal(mechanical.costs.realisation,0);
const md=await value('/api/diagnosis?runId=aaaaccccdddd1111');assert.equal(md.costs.realisation,0);assert(md.entries.some(e=>e.event==='korrektur'&&e.paidCalls===0&&!e.accepted));
const noKeyPaid=paid;
const keyless=await value('/api/repair-octaves',{method:'POST',data:{code:answer,runId:'aaaaccccdddd6666'}});assert.equal(keyless.cost,0);assert.equal(paid,noKeyPaid);
rendererMidi=null;repairMidi=null;namingDown=false;
rendererDown=true;const count=paid;assert.equal((await call('/api/run',{method:'POST',data:{...data,runId:'aaaabbbbccccdddd'}})).status,412);assert.equal(paid,count);assert.equal((await call('/api/diagnosis?runId=aaaabbbbccccdddd')).status,200);
await value('/api/workspace',{method:'POST',data:{workspace:{...ws,key:'DO-NOT-SAVE'}}});assert(!JSON.stringify(await value('/api/workspace')).includes('DO-NOT-SAVE'));
await value('/api/history/'+result.historyId,{method:'DELETE'});assert.equal((await call('/api/history/'+result.historyId)).status,404);
await value('/api/key-store',{method:'DELETE'});assert.equal((await value('/api/key-status')).stored,false);
for(const path of ['/app.mjs','/style.css','/TimGM6mb.sf2','/soundfont-player.mjs','/manifest.webmanifest','/favicon.svg','/LICENSE-SOUNDFONT.txt'])assert.equal((await call(path)).status,200);
console.log('PASS: direct composition, editable system, no reasoning throttle, encrypted key, original answer survives compiler failure, SVG/MIDI, history, workspace, diagnostics, cost stop, deletion, assets.');

rendererDown=false;rendererMidi=null;repairMidi=null;compositionFinish='length';const paidBeforeCut=paid;const cut=await value('/api/run',{method:'POST',data:{...data,key:"sk-or-v1-TESTKEY",maxTokens:8000,runId:'aaaaccccdddd7777'}});
assert.equal(paid,paidBeforeCut+1);assert.equal(requests.at(-1).max_tokens,64000);assert(!('reasoning' in requests.at(-1)));assert(cut.compiled.incomplete);assert(cut.compiled.error.includes('abgeschnitten'));assert.equal(cut.rawAnswer,answer);assert(!cut.compiled.url);assert(!cut.compiled.pages);assert.equal((await value('/api/history/'+cut.historyId)).entry.techout,answer);assert((await value('/api/workspace')).workspace.compiler.includes('abgeschnitten'));assert.equal(cut.costs.composition,.0001);assert.equal(cut.costs.realisation,0);assert.equal(cut.downloads.length,1);compositionFinish='stop';
console.log('PASS: legacy 8000 budget raised to 64000; explicit 24000 retained; truncated answer and costs preserved without naming, compiler or repair calls.');

rendererMidi=null;repairMidi=null;compileError=false;
const expressionCompiled=await value('/api/compile-lilypond',{method:'POST',data:{code:answer,title:'Expression test',runId:'abcdef1234567890'}});assert.equal(expressionCompiled.expressionPlayback.mode,'articulate');
expressionError=true;
const expressionFallback=await value('/api/compile-lilypond',{method:'POST',data:{code:answer,title:'Expression fallback',runId:'abcdef1234567891'}});assert.equal(expressionFallback.expressionPlayback.mode,'fallback');assert(expressionFallback.url);assert(expressionFallback.warning.includes('normale MIDI'));assert(expressionFallback.expressionPlayback.error.includes('expression failed'));
expressionError=false;
console.log('PASS: Worker records enhanced playback and safely returns standard MIDI with a visible warning when the expression compiler fails.');

const legacyIndex=requests.length;namingDown=true;
await value('/api/run',{method:'POST',data:{...data,key:'sk-or-v1-TESTKEY',system:legacyPrompt,runId:'abcd1234abcd4321'}});assert.equal(requests[legacyIndex].messages[0].content,originalPrompt);namingDown=false;
const expressionOnlyPrompt=originalPrompt.split(' Oktavnotation:')[0];
const expressionMigrationIndex=requests.length;namingDown=true;
await value('/api/run',{method:'POST',data:{...data,key:'sk-or-v1-TESTKEY',system:expressionOnlyPrompt,runId:'abcd1234abcd4322'}});
assert.equal(requests[expressionMigrationIndex].messages[0].content,originalPrompt);namingDown=false;
console.log('PASS: visible absolute-octave rule in default prompt; original/technical/expression-only defaults upgraded; edited custom prompt retained.');

const streamedRunId='abcd9876abcd9876';namingDown=true;
const streamedResponse=await call('/api/run-stream',{method:'POST',data:{...data,key:'sk-or-v1-TESTKEY',runId:streamedRunId}});assert(streamedResponse.headers.get('Content-Type').includes('application/x-ndjson'));
const events=(await streamedResponse.text()).trim().split('\n').map(s=>JSON.parse(s));assert.equal(events[0].type,'started');assert(events.some(e=>e.type==='progress'));assert(events.some(e=>e.type==='result'&&e.result.answer));
const streamStatus=await value('/api/run-status?runId='+streamedRunId);assert.equal(streamStatus.status,'completed');assert(streamStatus.result.historyId);const paidAfterStream=paid;
assert((await (await call('/api/run-stream',{method:'POST',data:{...data,key:'sk-or-v1-TESTKEY',runId:streamedRunId}})).json()).resume);assert.equal(paid,paidAfterStream);
await value('/api/client-events',{method:'POST',data:{runId:streamedRunId,events:[{event:'network_error',message:'Failed to fetch sk-or-v1-SECRET',date:'2026-10-07T05:00:00Z',online:false},{event:'recovery_completed',message:'completed'}]}});
const streamedDiag=await value('/api/diagnosis?runId='+streamedRunId);assert.equal(streamedDiag.runStatus.status,'completed');assert(streamedDiag.entries.some(e=>e.event==='lauf_abgeschlossen'));assert(streamedDiag.entries.some(e=>e.browserEvent==='network_error'));assert(!JSON.stringify(streamedDiag).includes('SECRET'));
namingDown=false;
console.log('PASS: shipped stream/status/events routes persist result, avoid duplicate AI calls, and include server completion, browser fetch failure and redacted recovery events in diagnosis.');


// Local recovery of absolute notation inside anchorless relative piano blocks.
const {repairAbsoluteSpelling}=await import('../src/octave-repair.mjs');
const localOriginal=await readFile(new URL('./fixtures/anchorless-absolute-spelling.ly',import.meta.url),'utf8');const localFixed=repairAbsoluteSpelling(localOriginal);
localRepairSource=localFixed.code.match(/c''4[^\n]+/)[0];localRepairMidi=(await readFile(new URL('./fixtures/anchorless-corrected.mid',import.meta.url))).toString('base64');rendererMidi=driftMidi;repairMidi=null;
const localPaid=paid;const autoLocal=await value('/api/compile-lilypond',{method:'POST',data:{code:localOriginal,runId:'aa0011223344556676'}});assert.equal(withoutOttava(autoLocal.code),withoutOttava(localFixed.code));assert.equal(autoLocal.rangeCheck.status,'passed');assert.equal(paid,localPaid);const localResult=await value('/api/repair-octaves',{method:'POST',data:{key:'sk-or-v1-TESTKEY',model:'test/model',runId:'aa0011223344556677',code:localOriginal}});
assert.equal(paid,localPaid);assert.equal(withoutOttava(localResult.code),withoutOttava(localFixed.code));assert.equal(localResult.cost,0);assert.equal(localResult.compiled.rangeCheck.status,'passed');assert(localResult.compiled.repair.includes('Keine KI-Aufrufe'));
const localDiag=await value('/api/diagnosis?runId=aa0011223344556677');assert(localDiag.entries.some(e=>e.event==='korrektur'&&e.paidCalls===0&&e.accepted===true));
localRepairSource=null;rendererMidi=null;
// Short thinking is explicit, retained in memory/history and logged; default stays unrestricted.
for(const k of [...env.BUCKET.items.keys()])if(k.startsWith('history/'))await env.BUCKET.delete(k);namingDown=false;
const shortRun=await value('/api/run',{method:'POST',data:{...data,key:'sk-or-v1-TESTKEY',runId:'aa0011223344556688',compositionReasoning:'short'}});
const shortRequest=requests.findLast(r=>r.messages[0].content==='MY EDITED SYSTEM');assert.deepEqual(shortRequest.reasoning,{effort:'low'});assert.equal(shortRequest.max_tokens,24000);
assert.equal((await value('/api/workspace')).workspace.compositionReasoning,'short');assert.equal((await value('/api/history/'+shortRun.historyId)).entry.compositionReasoning,'short');
assert((await value('/api/diagnosis?runId=aa0011223344556688')).entries.some(e=>e.event==='anfrage'&&e.stage==='composition'&&e.reasoning_requested.effort==='low'));
console.log('PASS: shipped local repair costs zero AI calls and passes MIDI range; explicit short thinking, unchanged note budget, saved selection and diagnostic trace.');

// Actual SF2 bytes survive a fresh read; malformed replacement leaves the bank intact.
const sf=await (await call('/TimGM6mb.sf2')).arrayBuffer();
const fontPost=async(buffer,name='Saved piano.sf2',origin)=>worker.fetch(new Request('https://lab.test/api/soundfont',{method:'POST',headers:{'X-SoundFont-Name':encodeURIComponent(name),...(origin?{Origin:origin}:{})},body:buffer}),env,{});
const fsaved=await fontPost(sf);assert.equal(fsaved.status,200);assert.equal((await fsaved.json()).name,'Saved piano.sf2');
assert.equal((await value('/api/soundfont')).name,'Saved piano.sf2');assert.deepEqual(new Uint8Array(await (await call('/api/soundfont/file')).arrayBuffer()),new Uint8Array(sf));
assert.equal((await fontPost(sf.slice(0,20),'Bad font.sf2')).status,400);assert.equal((await value('/api/soundfont')).name,'Saved piano.sf2');
assert.equal((await fontPost(sf,'Other.sf2','https://other.test')).status,403);
const savedFontKey=JSON.parse(new TextDecoder().decode(env.BUCKET.items.get('settings/soundfont.json').data)).key;
// Valid RIFF padding takes the existing playable SF2 past the former limit.
const largeFont=new Uint8Array(65*1024*1024);
largeFont.set(new Uint8Array(sf));
largeFont.set(new TextEncoder().encode('JUNK'),sf.byteLength);
new DataView(largeFont.buffer).setUint32(sf.byteLength+4,largeFont.length-sf.byteLength-8,true);
new DataView(largeFont.buffer).setUint32(4,largeFont.length-8,true);
const largeResponse=await worker.fetch(new Request('https://lab.test/api/soundfont',{method:'POST',headers:{'Content-Length':String(largeFont.length),'X-SoundFont-Name':'Large.sf2'},body:largeFont}),env,{});
assert.equal(largeResponse.status,200);assert.equal((await largeResponse.json()).bytes,largeFont.length);
assert.deepEqual(new Uint8Array(await (await call('/api/soundfont/file')).arrayBuffer()),largeFont);
assert(!(await (await call('/app.mjs')).text()).includes('f.size>64*1024*1024'));
console.log('PASS: valid SF2 over 64 MiB with Content-Length saves and round-trips unchanged; browser size guard removed.');
await fontPost(sf,'Second piano.sf2');assert(!env.BUCKET.items.has(savedFontKey));assert.equal((await value('/api/soundfont')).name,'Second piano.sf2');
assert.equal((await value('/api/diagnosis?runId=aa0011223344556688')).playback.soundfont,'Second piano.sf2');
await value('/api/soundfont',{method:'DELETE'});assert((await value('/api/soundfont')).standard);assert.equal((await call('/api/soundfont/file')).status,404);
console.log('PASS: real SoundFont bytes saved and restored, replacement cleanup, malformed upload preserves previous choice, origin guard, diagnosis and saved default reset.');

assert(!requests.some(r=>/^(Repariere ausschließlich|Korrigiere ausschließlich)/.test(r.messages[0].content)));assert(!html.includes('id="repair"'));console.log('PASS: no octave repair AI requests anywhere, automatic compile correction and no repair button.');

const persistedCosts={composition:.7,realisation:.0123};
const paidEntry=await value('/api/history',{method:'POST',data:{title:'Cost persistence regression',techout:answer,costs:persistedCosts}});
assert.deepEqual(paidEntry.entry.costs,persistedCosts);
assert.deepEqual((await value('/api/history/'+paidEntry.entry.id)).entry.costs,persistedCosts);
assert.deepEqual((await value('/api/history')).entries.find(e=>e.id===paidEntry.entry.id).costs,persistedCosts);
await value('/api/history',{method:'POST',data:{id:paidEntry.entry.id,title:'Edited cost entry',techout:answer}});
assert.deepEqual((await value('/api/history/'+paidEntry.entry.id)).entry.costs,persistedCosts,'editing without costs cannot erase stored costs');
const legacyKey='history/'+paidEntry.entry.id+'.json',legacy=env.BUCKET.items.get(legacyKey);
const oldSummary=JSON.parse(legacy.customMetadata.summary);delete oldSummary.costs;legacy.customMetadata.summary=JSON.stringify(oldSummary);
assert.deepEqual((await value('/api/history')).entries.find(e=>e.id===paidEntry.entry.id).costs,persistedCosts,'old list metadata reads stored entry costs');
const unknownEntry=await value('/api/history',{method:'POST',data:{title:'Unknown historical costs',techout:answer}});
assert.equal((await value('/api/history/'+unknownEntry.entry.id)).entry.costs,null);
assert((await (await call('/composition-costs.mjs')).text()).includes('costLabel'));
console.log('PASS: history/list/reload preserve individual costs; metadata compatibility and unknown history costs verified.');

const legacyLogs=JSON.parse(await readFile(new URL('./fixtures/legacy-mozart-octaves.json',import.meta.url),'utf8'));
const legacyRun='bb0011223344556677';
for(const [i,e] of legacyLogs.entries())await env.BUCKET.put('logs/'+legacyRun+'/'+i+'.json',JSON.stringify(e));
const legacyCode=legacyLogs.find(e=>e.event==='korrekturpruefung').source;
const originalCode=legacyLogs.find(e=>e.event==='kompilierung').source;
const {automaticOctaveRepair}=await import('../src/octave-repair.mjs');
const expectedFix=automaticOctaveRepair(originalCode,legacyLogs[0].rangeCheck.instruments);
localRepairSource=expectedFix.code.split('left =')[1].split('dynamics =')[0];
localRepairMidi=(await readFile(new URL('./fixtures/anchorless-corrected.mid',import.meta.url))).toString('base64');rendererMidi=driftMidi;
const paidBeforeLegacy=paid;
const restored=await value('/api/compile-lilypond',{method:'POST',data:{code:legacyCode,runId:legacyRun}});
assert.equal(withoutOttava(restored.code),withoutOttava(expectedFix.code));assert.equal(restored.rangeCheck.status,'passed');assert(restored.repair.includes('protokollierten Original'));assert.equal(paid,paidBeforeLegacy);
localRepairSource=null;rendererMidi=null;
const editedLegacy=legacyCode.replace('bes4 f d bes','bes4 f d a');
const editedResult=await value('/api/compile-lilypond',{method:'POST',data:{code:editedLegacy,runId:legacyRun}});
assert.equal(editedResult.code,undefined);assert.equal(paid,paidBeforeLegacy);
console.log('PASS: recompile route restores the exact legacy Mozart source, returns matching updated score/MIDI/code, costs no AI calls and preserves user edits.');

// The API-reported model must win over the requested routing alias.
reportedModel='perplexity/sonar';namingDown=true;
const attributionPaid=paid;
const attributed=await value('/api/run',{method:'POST',data:{...data,key:'sk-or-v1-TESTKEY',title:'Fresh title',runId:'abcd1111abcd2222'}});
assert(attributed.answer.startsWith('% KI-Modell: perplexity/sonar\n'));
assert(attributed.answer.includes('composer = "perplexity/sonar"'));
assert.equal(attributed.rawAnswer,answer);
const attributedHistory=(await value('/api/history/'+attributed.historyId)).entry;
assert.equal(attributedHistory.actualCompositionModel,'perplexity/sonar');
assert.equal(attributedHistory.compositionModel,'test/model');
assert.equal(attributedHistory.techout,attributed.answer);
assert.equal((await value('/api/workspace')).workspace.techout,attributed.answer);
assert.equal(await (await call(attributed.downloads[0].url)).text(),attributed.answer);
assert.equal(paid,attributionPaid+3); // composition and the existing two title attempts only
reportedModel=undefined;namingDown=false;
console.log('PASS: API-reported model is stored in source, composer, history, workspace and download; requested selector and raw answer remain available without extra attribution calls.');

// Sonnet 5.5 must receive adaptive effort, not the ineffective legacy budget.
namingDown=true;
for(const [selection,runId] of [['short','abcd1111abcd3333'],['balanced','abcd1111abcd5555'],['default','abcd1111abcd4444']]){
 const at=requests.length;
 const sonnet=await value('/api/run',{method:'POST',data:{...data,key:'sk-or-v1-TESTKEY',model:'anthropic/claude-sonnet-5.5',compositionReasoning:selection,runId}});
 const request=requests[at];
 if(selection!=='default')assert.deepEqual(request.reasoning,{effort:selection==='short'?'low':'medium'});
 else assert(!('reasoning' in request));
 assert.equal(request.max_tokens,24000);
 assert.deepEqual(request.messages,[{role:'system',content:data.system},{role:'user',content:data.task}]);
 assert.equal((await value('/api/history/'+sonnet.historyId)).entry.compositionReasoning,selection);
 assert.equal((await value('/api/workspace')).workspace.compositionReasoning,selection);
 const diag=await value('/api/diagnosis?runId='+runId);
 const logged=diag.entries.find(e=>e.event==='anfrage'&&!e.operation);
 assert.deepEqual(logged.reasoning_requested,selection==='default'?'provider_default':{effort:selection==='short'?'low':'medium'});
}
namingDown=false;
console.log('PASS: Sonnet 5.5 short uses low effort; default omits reasoning control; prompts, total budget, saved choices and diagnostic request match.');

// Manual edits/saves must retain the new choice, as must workspace restoration.
const balancedSaved=(await value('/api/history',{method:'POST',data:{title:'Balanced save',techout:answer,format:'lilypond',compositionModel:'anthropic/claude-sonnet-5.5',compositionReasoning:'balanced'}})).entry;
assert.equal(balancedSaved.compositionReasoning,'balanced');
assert.equal((await value('/api/history/'+balancedSaved.id)).entry.compositionReasoning,'balanced');
assert.equal((await value('/api/history')).entries.find(e=>e.id===balancedSaved.id).compositionReasoning,'balanced');
await value('/api/workspace',{method:'POST',data:{workspace:{...ws,compositionReasoning:'balanced'}}});
assert.equal((await value('/api/workspace')).workspace.compositionReasoning,'balanced');
assert(html.includes('<option value="balanced">Ausgewogen'));
console.log('PASS: balanced sends medium effort and survives composition history, manual history save/reload and workspace save/reload.');

// Same control is used for every provider; no Claude-only branch remains.
namingDown=true;let qualityIndex=0;
for(const model of ['openai/test-model','google/test-model','other/test-model']){
 for(const selection of ['short','balanced','default']){
  const at=requests.length,runId='abcd2222'+String(++qualityIndex).padStart(8,'0');
  const composed=await value('/api/run',{method:'POST',data:{...data,key:'sk-or-v1-TESTKEY',model,compositionReasoning:selection,runId}});
  assert.deepEqual(requests[at].reasoning,selection==='default'?undefined:{effort:selection==='short'?'low':'medium'});
  assert.equal((await value('/api/history/'+composed.historyId)).entry.compositionReasoning,selection);
 }
}
namingDown=false;
console.log('PASS: all three quality choices apply across provider IDs and survive history reload.');

// The notation optimization must fall back if the renderer changes playback.
const highPiano=String.raw`\version "2.24.3"
part = { \clef treble g'''4 a''' b''' c'''' | g'''4 a''' b''' c'''' | }
\score { \new PianoStaff << \new Staff \part >> \layout {} \midi {} }`;
const notationPaid=paid;
for(const mode of ['same','different','error']){
 ottavaTest=mode;
 const result=await value('/api/compile-lilypond',{method:'POST',data:{code:highPiano,runId:'abcd3333abcd'+(mode==='same'?'1111':mode==='different'?'2222':'3333')}});
 if(mode==='same'){
  assert.equal(result.ottava.status,'applied');assert(result.ottava.midiUnchanged);
  assert(result.code.includes('\\ottava #1'));assert(result.code.includes('\\ottava #0'));
  assert.equal(withoutOttava(result.code),withoutOttava(highPiano));
 }else{
  assert.equal(result.ottava.status,'rejected');assert.equal(result.code,undefined);
  assert(result.warning.includes('ursprüngliche Notation'));assert(result.url);assert(result.pages.length);
 }
}
assert.equal(paid,notationPaid);ottavaTest='same';
console.log('PASS: ottava render accepted only for identical MIDI; changed playback and compiler failure preserve original score/MIDI; no AI calls.');
const mixedPiano=highPiano.replace("g'''4", "c''4 d'' e'' f'' | g'''4");
const oldAutomatic=mixedPiano.replace("c''4", "\\ottava #1 c''4").replace('| }', '| \\ottava #0 }');
const migrationRun='abcd3333abcd4444';
await env.BUCKET.put('logs/'+migrationRun+'/old.json',JSON.stringify({version:'0.1.33',event:'kompilierung',source:mixedPiano,code:oldAutomatic,ottava:{status:'applied',midiUnchanged:true}}));
const migrated=await value('/api/compile-lilypond',{method:'POST',data:{code:oldAutomatic,runId:migrationRun}});
assert(migrated.code.includes("c''4 d'' e'' f'' | \\ottava #1 g'''4"));
assert.equal(withoutOttava(migrated.code),withoutOttava(mixedPiano));
const authorSource=oldAutomatic+' % handwritten change';
const authorResult=await value('/api/compile-lilypond',{method:'POST',data:{code:authorSource,runId:migrationRun}});
assert.equal(authorResult.code,undefined);assert.equal(authorResult.ottava.status,'unchanged');
assert.equal(paid,notationPaid);
console.log('PASS: recompile replaces a logged v0.1.33 line across ordinary register and preserves edited/handwritten octave lines, without AI calls.');
