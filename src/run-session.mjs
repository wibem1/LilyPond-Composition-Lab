// Keep the HTTP body active, persist results, and never repeat a paid request
// merely because a browser reconnects. Runtime termination remains detectable.
const active=new Map();
export function noteRunProgress(runId,event,data){
 const session=active.get(runId);if(!session)return;
 const phase=event==='anfrage'?(data.operation==='octave-repair'?'Oktavlagen werden korrigiert':data.operation==='title'?'Titel wird vergeben':'KI komponiert'):event==='antwort'?'KI-Antwort gespeichert':event==='kompilierung'||event==='korrekturpruefung'?'Noten und MIDI werden geprüft':null;
 if(phase){session.state.phase=phase;session.send({type:'progress',phase});}
}
export async function readRunSession(runId,io){
 const state=await io.read('runs/'+runId+'.json');
 if(state?.status==='running'&&Date.now()-Date.parse(state.updatedAt)>90000){
  const lastPhase=state.phase;state.status='interrupted';state.phase='Verarbeitung unterbrochen';state.updatedAt=new Date().toISOString();
  await io.write('runs/'+runId+'.json',state);
  await io.log('lauf_unterbrochen',runId,{reason:'Keine Server-Aktualisierung seit mehr als 90 Sekunden. Ursache nicht nachgewiesen.',lastPhase});
 }
 return state;
}
export async function streamRun(request,env,ctx,runId,execute,io){
 const existing=await readRunSession(runId,io);
 if(existing)return Response.json({runId,resume:true},{headers:{'Cache-Control':'no-store'}});
 let controller,cancelled=false;
 const state={runId,status:'running',phase:'Verbindung und Compiler werden geprüft',startedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 let writes=Promise.resolve();
 const persist=()=>{state.updatedAt=new Date().toISOString();const snapshot=structuredClone(state);writes=writes.catch(()=>{}).then(()=>io.write('runs/'+runId+'.json',snapshot));return writes;};
 const send=value=>{if(cancelled||!controller)return;try{controller.enqueue(new TextEncoder().encode(JSON.stringify(value)+'\n'));}catch{cancelled=true;}};
 await persist();
 const stream=new ReadableStream({start(c){controller=c;send({type:'started',runId,phase:state.phase});},cancel(){cancelled=true;io.log('verbindung_getrennt',runId,{source:'server-stream',message:'Browser liest die Antwort nicht mehr; Ergebnis wird nach Möglichkeit weiter gespeichert.'}).catch(()=>{});}});
 const session={state,send};active.set(runId,session);
 const timer=setInterval(()=>{send({type:'heartbeat',phase:state.phase});persist().catch(()=>{});},10000);
 const work=(async()=>{
  try{
   await io.log('lauf_gestartet',runId,{transport:'ndjson-heartbeat',heartbeatSeconds:10});
   const response=await execute(request,env);const result=await response.json();
   state.status=response.ok?'completed':'failed';state.httpStatus=response.status;state.result=result;state.phase=response.ok?'Abgeschlossen':'Fehlgeschlagen';
  }catch(e){state.status='failed';state.httpStatus=500;state.result={runId,error:'Serververarbeitung fehlgeschlagen.'};state.phase='Fehlgeschlagen';await io.log('lauf_fehler',runId,{name:e.name,message:'Fehler außerhalb der Kompositionsverarbeitung.'});}
  finally{
   clearInterval(timer);active.delete(runId);await persist();
   await io.log('lauf_abgeschlossen',runId,{status:state.status,httpStatus:state.httpStatus,durationMs:Date.now()-Date.parse(state.startedAt)});
   send({type:'result',status:state.httpStatus,result:state.result});if(!cancelled)try{controller.close();}catch{}
  }
 })();
 ctx?.waitUntil?.(work);
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
