import {limitedJson} from './request-body.mjs';
// Store received text during SSE, including provider errors after HTTP 200.
export async function readCompositionResponse(response,{checkpoint=async()=>{},timeoutMs=600000,checkpointIntervalMs=2000}={}){
 if(!response.headers.get('Content-Type')?.includes('text/event-stream')){
  const data=await limitedJson(response);await checkpoint(data);return data;
 }
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer='',answer='',model='',id='',usage=null,finish=null,error=null,lastSaved=0,lastAt=0,done=false,writes=Promise.resolve();
 const timer=setTimeout(()=>{error={message:'Zeitlimit beim Empfangen der KI-Ausgabe.'};reader.cancel().catch(()=>{});},timeoutMs);
 const snapshot=()=>({id,model,usage,error,choices:[{message:{content:answer},finish_reason:finish||'interrupted'}]});
 const save=async(force=false)=>{
  if(force||answer.length-lastSaved>=2048||Date.now()-lastAt>=checkpointIntervalMs){
   const data=snapshot(),length=answer.length;
   writes=writes.catch(()=>{}).then(()=>checkpoint(data));await writes;lastSaved=length;lastAt=Date.now();
  }
 };
 // A small last delta must also be saved when the provider then goes silent.
 let periodicSave=null;
 const checkpointTimer=setInterval(()=>{if(answer.length!==lastSaved&&!periodicSave)periodicSave=save().catch(()=>{}).finally(()=>{periodicSave=null;});},checkpointIntervalMs);
 async function event(raw){
  const payload=raw.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
  if(!payload)return;if(payload==='[DONE]'){done=true;return;}
  const d=JSON.parse(payload);id=d.id||id;model=d.model||model;usage=d.usage||usage;error=d.error||error;
  const choice=d.choices?.[0],text=choice?.delta?.content;
  if(typeof text==='string')answer+=text;else if(Array.isArray(text))answer+=text.filter(x=>x.type==='text').map(x=>x.text).join('');
  if(answer.length>240000)throw Error('KI-Ausgabe überschreitet die sichere Dokumentgröße.');
  finish=choice?.finish_reason||finish;await save();
 }
 try{
  while(!done){const part=await reader.read();if(part.done)break;buffer=(buffer+decoder.decode(part.value,{stream:true})).replace(/\r\n/g,'\n');if(buffer.length>1200000)throw Error('KI-Antwortstrom überschreitet die sichere Ereignisgröße.');let at;while(!done&&(at=buffer.indexOf('\n\n'))>=0){await event(buffer.slice(0,at));buffer=buffer.slice(at+2);}}
  buffer+=decoder.decode();if(!done&&buffer.trim())await event(buffer);
  if(!done&&!finish&&!error)error={message:'Antwortstrom ohne Abschluss beendet.'};
 }catch(e){error={message:String(e.message||e)};finish='interrupted';}
 finally{clearTimeout(timer);clearInterval(checkpointTimer);try{await save(true);}finally{try{await reader.cancel();}catch{}}}
 if(error)finish='error';return snapshot();
}
