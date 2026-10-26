import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';

// Executes the shipped streaming/storage modules in workerd with real local R2.
// No provider endpoint, production data, or API key is used.
const source=`
import {streamRun,synchronousRun,readRunSession} from './src/run-session.mjs';
import {runStorage} from './src/run-storage.mjs';
import {readCompositionResponse} from './src/provider-stream.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export default {async fetch(req,env,ctx){
 const url=new URL(req.url),id=url.searchParams.get('id')||'runtime-test';
 const io={...runStorage(env.BUCKET),log:async()=>{}};
 if(url.pathname==='/status')return Response.json(await readRunSession(id,io));
 if(url.pathname==='/conditional'){
  const state={status:'running',updatedAt:new Date().toISOString()};
  const claims=await Promise.all([io.claim(id,state),io.claim(id,state)]);
  await io.write('runs/cas.json',state);
  const replaced=await io.replace('runs/cas.json',state,{...state,status:'completed'});
  const stale=await io.replace('runs/cas.json',state,{...state,status:'interrupted'});
  return Response.json({claims,replaced,stale,final:await io.read('runs/cas.json')});
 }
 if(url.pathname==='/sync')return synchronousRun(req,env,ctx,id,async()=>{
  const old=await io.read('count/'+id);await io.write('count/'+id,{n:(old?.n||0)+1});
  await sleep(60);return Response.json({answer:'sync once'});
 },io);
 return streamRun(req,env,ctx,id,async()=>{
  const old=await io.read('count/'+id);await io.write('count/'+id,{n:(old?.n||0)+1});
  let providerController;
  const provider=new Response(new ReadableStream({start(c){providerController=c;}}),{headers:{'Content-Type':'text/event-stream'}});
  const reading=readCompositionResponse(provider,{checkpointIntervalMs:10,checkpoint:r=>io.write('checkpoints/'+id,r)});
  const event=text=>'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\\n\\n';
  providerController.enqueue(new TextEncoder().encode(event('Empfangen')));
  await sleep(5);providerController.enqueue(new TextEncoder().encode(event('er Notentext')));
  await sleep(60);
  const idle=await io.read('checkpoints/'+id);
  if(idle?.choices?.[0]?.message?.content!=='Empfangener Notentext')throw Error('Idle checkpoint missing');
  providerController.enqueue(new TextEncoder().encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\\n\\ndata: [DONE]\\n\\n'));
  const result=await reading;
  return Response.json({answer:result.choices[0].message.content,runId:id});
 },io);
}};
`;
const bundled=await build({stdin:{contents:source,resolveDir:fileURLToPath(new URL('..',import.meta.url)),sourcefile:'runtime-fixture.mjs'},write:false,bundle:true,format:'esm',platform:'neutral'});
const runtime=new Miniflare({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-07-01',r2Buckets:['BUCKET']});
try{
 const conditional=await (await runtime.dispatchFetch('https://test/conditional?id=claim-once')).json();
 assert.equal(conditional.claims.filter(Boolean).length,1);
 assert.equal(conditional.replaced,true);assert.equal(conditional.stale,false);assert.equal(conditional.final.status,'completed');
 const id='disconnect',response=await runtime.dispatchFetch('https://test/start?id='+id,{method:'POST'});
 const reader=response.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/started/);await reader.cancel();
 const bucket=await runtime.getR2Bucket('BUCKET');
 let state;const deadline=Date.now()+5000;
 do{const object=await bucket.get('runs/'+id+'.json');state=object?await object.json():null;if(state?.status==='completed')break;await new Promise(r=>setTimeout(r,20));}while(Date.now()<deadline);
 assert.equal(state?.status,'completed');assert.equal(state.result.answer,'Empfangener Notentext');
 const duplicate=await runtime.dispatchFetch('https://test/start?id='+id,{method:'POST'});assert.equal((await duplicate.json()).resume,true);
 assert.equal((await (await bucket.get('count/'+id)).json()).n,1);
 const sync=await Promise.all([runtime.dispatchFetch('https://test/sync?id=sync-once',{method:'POST'}),runtime.dispatchFetch('https://test/sync?id=sync-once',{method:'POST'})]);
 assert.deepEqual(sync.map(r=>r.status).sort(),[200,409]);
 assert.equal((await (await runtime.dispatchFetch('https://test/sync?id=sync-once',{method:'POST'})).json()).answer,'sync once');
 assert.equal((await (await bucket.get('count/sync-once')).json()).n,1);
 console.log('PASS: synchronous duplicate protection and replay in actual workerd/local R2.');
 console.log('PASS: actual workerd/local R2 conditional reservation, stale-write protection, SSE idle checkpoint and short-disconnect recovery without duplicate execution. Long-disconnect continuation remains unsupported.');
}finally{await runtime.dispose();}

// Load the exact deployable bundle too; exercise persisted legacy data without
// making an outbound request or changing its compatibility identifiers.
const appRuntime=new Miniflare({modules:true,scriptPath:fileURLToPath(new URL('../dist/server/index.js',import.meta.url)),compatibilityDate:'2026-07-01',r2Buckets:['BUCKET'],outboundService:()=>new Response('No external requests in this test',{status:503})});
try{
 const html=await (await appRuntime.dispatchFetch('https://test/')).text();
 const {APP_VERSION}=await import('../src/app-config.mjs');assert(html.includes('V'+APP_VERSION));
 const bucket=await appRuntime.getR2Bucket('BUCKET'),id='0123456789abcdef';
 const history={id,title:'Erhaltenes Stück',techout:'Originalnoten',costs:{composition:.02,realisation:0}};
 const workspace={title:'Erhaltener Arbeitsstand',techout:'Eigene Noten'};
 await bucket.put('history/'+id+'.json',JSON.stringify(history));
 await bucket.put('workspace/current.json',JSON.stringify(workspace));
 const result=await (await appRuntime.dispatchFetch('https://test/api/history/'+id)).json();assert.deepEqual(result.entry,history);
 assert.deepEqual((await (await appRuntime.dispatchFetch('https://test/api/workspace')).json()).workspace,workspace);
 assert.deepEqual(await (await bucket.get('history/'+id+'.json')).json(),history);
 console.log('PASS: deployable Worker bundle serves current UI and reads legacy history/workspace unchanged in actual workerd/R2.');
}finally{await appRuntime.dispose();}
