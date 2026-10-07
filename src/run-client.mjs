const PENDING='lilypond-pending-run',EVENTS='lilypond-browser-events';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export class RunClient{
 constructor({fetch:request=globalThis.fetch.bind(globalThis),storage=globalThis.localStorage,online=()=>globalThis.navigator?.onLine!==false,delay=sleep,onprogress=()=>{}}={}){Object.assign(this,{request,storage,online,delay,onprogress});this.flushing=null;this.memory=new Map();}
 read(key,fallback){if(this.memory.has(key))return this.memory.get(key);try{return JSON.parse(this.storage.getItem(key))??fallback;}catch{return fallback;}}
 write(key,value){this.memory.set(key,value);try{this.storage.setItem(key,JSON.stringify(value));}catch{}}
 get pendingRunId(){return this.read(PENDING,null)?.runId||'';}
 record(runId,event,message=''){if(!runId)return;const list=this.read(EVENTS,[]);list.push({runId,event,message:String(message).slice(0,500).replace(/sk-[A-Za-z0-9_-]+/g,'[API-Schlüssel]'),date:new Date().toISOString(),online:this.online()});this.write(EVENTS,list.slice(-200));}
 async bounded(url,options={},timeout=20000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{return await this.request(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}
 async flush(){
  if(this.flushing)return this.flushing;
  this.flushing=(async()=>{if(!this.online())return;const snapshot=this.read(EVENTS,[]);for(const runId of [...new Set(snapshot.map(e=>e.runId))]){const events=snapshot.filter(e=>e.runId===runId).slice(0,30);try{const r=await this.bounded('/api/client-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId,events})},8000);if(r.ok){const sent=new Set(events.map(e=>e.date+'|'+e.event));this.write(EVENTS,this.read(EVENTS,[]).filter(e=>e.runId!==runId||!sent.has(e.date+'|'+e.event)));}}catch{}}})();
  try{await this.flushing;}finally{this.flushing=null;}
 }
 finish(status,result){this.write(PENDING,null);if(status>=400||result.error){const e=Error(result.error||'Auftrag fehlgeschlagen.');e.details=result;e.terminal=true;throw e;}return result;}
 async start(payload){
  if(this.pendingRunId)return this.recover(this.pendingRunId);
  this.write(PENDING,{runId:payload.runId,startedAt:new Date().toISOString()});
  const controller=new AbortController();let timer,received=false;
  try{
   timer=setTimeout(()=>controller.abort(),30000);
   const r=await this.request('/api/run-stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});clearTimeout(timer);
   if(!r.ok){const d=await r.json();return this.finish(r.status,d);}
   if(!r.headers.get('Content-Type')?.includes('application/x-ndjson')){const d=await r.json();if(d.resume)return await this.recover(payload.runId);throw Error('Unerwartetes Antwortformat.');}
   const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';
   while(true){timer=setTimeout(()=>controller.abort(),30000);const part=await reader.read();clearTimeout(timer);if(part.done)break;received=true;buffer+=decoder.decode(part.value,{stream:true});let newline;
    while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line.trim())continue;const event=JSON.parse(line);if(event.type==='result')return this.finish(event.status,event.result);if(event.phase)this.onprogress(event.phase);}
   }
   throw Error('Antwortstrom endete ohne Ergebnis.');
  }catch(e){clearTimeout(timer);if(!this.pendingRunId)throw e;this.record(payload.runId,received?'stream_error':'network_error',e.message);this.onprogress('Verbindung unterbrochen. Gespeichertes Ergebnis wird abgeholt …');return this.recover(payload.runId);}
 }
 async recover(runId=this.pendingRunId){
  this.record(runId,'recovery_started');let missing=0,failures=0;
  for(;;){
   try{
    await this.flush();const r=await this.bounded('/api/run-status?runId='+encodeURIComponent(runId));if(!r.ok)throw Error('Statusabfrage HTTP '+r.status);const job=await r.json();failures=0;
    if(job.status==='completed'||job.status==='failed'){this.record(runId,'recovery_completed',job.status);await this.flush();return this.finish(job.httpStatus||200,job.result);}
    if(job.status==='interrupted'){this.record(runId,'recovery_stopped','Serververarbeitung unterbrochen; kein neuer KI-Aufruf.');await this.flush();this.write(PENDING,null);throw Object.assign(Error('Serververarbeitung unterbrochen. Bereits erzeugte Komposition im Verlauf erhalten; siehe Diagnose.'),{terminal:true});}
    if(job.status==='unknown'){if(++missing>=5)throw Object.assign(Error('Auftrag konnte nicht bestätigt werden. Es wurde kein automatischer neuer KI-Aufruf gestartet.'),{terminal:true});this.onprogress('Auftragsstatus wird geprüft …');}
    else {missing=0;this.onprogress(job.phase+' · Verbindung wiederhergestellt');}
   }catch(e){if(e.terminal)throw e;this.record(runId,'network_error',e.message);this.onprogress('Verbindung fehlt. Wiederherstellung wird versucht …');if(++failures>=20){this.record(runId,'recovery_stopped','Wiederherstellung pausiert; beim nächsten Öffnen fortsetzen.');throw Error('Verbindung weiterhin nicht erreichbar. Der Auftrag bleibt zur Wiederherstellung vorgemerkt.');}}
   await this.delay(3000);
  }
 }
}
