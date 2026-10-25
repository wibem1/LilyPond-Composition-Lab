// Streaming keeps an attached HTTP invocation active. waitUntil only grants a
// short disconnect grace period, NOT durable background execution.
const active=new Map();
const starting=new Set();
export function noteRunProgress(runId,event,data){
 const session=active.get(runId);if(!session)return;
 const phase=event==='anfrage'?(data.operation==='octave-repair'?'Oktavlagen werden korrigiert':data.operation==='title'?'Titel wird vergeben':data.operation==='concept'?'Klangvorstellung wird entwickelt':'KI komponiert'):event==='antwort'?'KI-Antwort gespeichert':event==='kompilierung'||event==='korrekturpruefung'?'Noten und MIDI werden geprüft':null;
 if(phase){session.state.phase=phase;session.send({type:'progress',phase});}
}
export async function readRunSession(runId,io){
 let state=await io.read('runs/'+runId+'.json')||await io.readClaim?.(runId);
 // The provider stream may legally take ten minutes; do not falsely declare a paid run dead after 90 seconds.
 if(state?.status==='running'&&Date.now()-Date.parse(state.updatedAt)>660000){
  const previous=structuredClone(state),lastPhase=state.phase;
  state={...state,status:'interrupted',phase:'Verarbeitung unterbrochen',updatedAt:new Date().toISOString()};
  if(io.replace){
   // A concurrent final save must never be overwritten by a stale status read.
   if(!await io.replace('runs/'+runId+'.json',previous,state)){
    const current=await io.read('runs/'+runId+'.json');if(current)return current;
    // A durable claim can outlive a failed initial status save.
    if(io.create){if(!await io.create('runs/'+runId+'.json',state))return io.read('runs/'+runId+'.json');}
    else await io.write('runs/'+runId+'.json',state);
   }
  }else await io.write('runs/'+runId+'.json',state);
  await io.log('lauf_unterbrochen',runId,{reason:'Keine Server-Aktualisierung seit mehr als 11 Minuten. Ursache nicht nachgewiesen.',lastPhase});
 }
 if(state?.status==='interrupted'&&io.restore){
  const result=await io.restore(runId);
  if(result){
   const previous=structuredClone(state);
   state={...state,result,status:'failed',httpStatus:422,phase:'Unvollständige Komposition gesichert'};
   if(io.replace){if(!await io.replace('runs/'+runId+'.json',previous,state))return await io.read('runs/'+runId+'.json');}
   else await io.write('runs/'+runId+'.json',state);
  }
 }
 return state;
}
export async function streamRun(request,env,ctx,runId,execute,io){
 if(starting.has(runId)||active.has(runId))return Response.json({runId,resume:true},{headers:{'Cache-Control':'no-store'}});
 starting.add(runId);
 let existing;try{existing=await readRunSession(runId,io);}catch(e){starting.delete(runId);throw e;}
 if(existing){starting.delete(runId);return Response.json({runId,resume:true},{headers:{'Cache-Control':'no-store'}});}
 let controller,cancelled=false;
 const state={runId,status:'running',phase:'Verbindung und Compiler werden geprüft',startedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(io.claim){
  try{if(!await io.claim(runId,state)){starting.delete(runId);return Response.json({runId,resume:true},{headers:{'Cache-Control':'no-store'}});}}
  catch(e){starting.delete(runId);throw e;}
 }
 let writes=Promise.resolve();
 const persist=()=>{state.updatedAt=new Date().toISOString();const snapshot=structuredClone(state);writes=writes.catch(()=>{}).then(()=>io.write('runs/'+runId+'.json',snapshot));return writes;};
 const send=value=>{if(cancelled||!controller)return;try{controller.enqueue(new TextEncoder().encode(JSON.stringify(value)+'\n'));}catch{cancelled=true;}};
 try{await persist();}catch(e){starting.delete(runId);throw e;}
 const stream=new ReadableStream({start(c){controller=c;send({type:'started',runId,phase:state.phase});},cancel(){cancelled=true;io.log('verbindung_getrennt',runId,{source:'server-stream',message:'Browser liest die Antwort nicht mehr; Ergebnis wird nach Möglichkeit weiter gespeichert.'}).catch(()=>{});}});
 const session={state,send};active.set(runId,session);starting.delete(runId);
 const timer=setInterval(()=>{send({type:'heartbeat',phase:state.phase});persist().catch(()=>{});},10000);
 const work=(async()=>{
  try{
   await io.log('lauf_gestartet',runId,{transport:'ndjson-heartbeat',heartbeatSeconds:10});
   const response=await execute(request,env);const result=await response.json();
   const incomplete=Boolean(result?.compiled?.incomplete||result?.compiled?.error);
   state.status=response.ok&&!incomplete?'completed':'failed';state.httpStatus=incomplete?422:response.status;state.result=result;state.phase=incomplete?'Unvollständige Komposition gesichert':response.ok?'Abgeschlossen':'Fehlgeschlagen';
  }catch(e){state.status='failed';state.httpStatus=500;state.result={runId,error:'Serververarbeitung fehlgeschlagen.'};state.phase='Fehlgeschlagen';await io.log('lauf_fehler',runId,{name:e.name,message:'Fehler außerhalb der Kompositionsverarbeitung.'}).catch(()=>{});}
  finally{
   clearInterval(timer);
   try{
    // A failed parser/compiler/storage step must not hide an earlier checkpoint.
    if(state.result?.error&&io.restore){
     const partial=await io.restore(runId).catch(()=>null);
     if(partial){state.result=partial;state.httpStatus=422;state.phase='Unvollständige Komposition gesichert';}
    }
    await persist();
    // Diagnosis logging is not part of the result commit.
    await io.log('lauf_abgeschlossen',runId,{status:state.status,httpStatus:state.httpStatus,durationMs:Date.now()-Date.parse(state.startedAt)}).catch(()=>{});
    send({type:'result',status:state.httpStatus,result:state.result});
   }catch{
    send({type:'progress',phase:'Ergebnis konnte nicht bestätigt werden. Gespeicherter Auftrag wird erneut abgefragt.'});
   }finally{active.delete(runId);if(!cancelled)try{controller.close();}catch{}}
  }
 })();
 ctx?.waitUntil?.(work);
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
