// Store received text during SSE, including provider errors after HTTP 200.
export async function readCompositionResponse(response,{checkpoint=async()=>{}}={}){
 if(!response.headers.get('Content-Type')?.includes('text/event-stream')){
  const data=await response.json();await checkpoint(data);return data;
 }
 const reader=response.body.getReader(),decoder=new TextDecoder();
 const timer=setTimeout(()=>{error={message:'Zeitlimit beim Empfangen der KI-Ausgabe.'};reader.cancel().catch(()=>{});},600000);
 let buffer='',answer='',model='',usage=null,finish=null,error=null,lastSaved=0,lastAt=0,done=false,writes=Promise.resolve();
 const snapshot=()=>({model,usage,error,choices:[{message:{content:answer},finish_reason:finish||'interrupted'}]});
 const save=async(force=false)=>{if(force||answer.length-lastSaved>=2048||Date.now()-lastAt>=2000){
  const data=snapshot();lastSaved=answer.length;lastAt=Date.now();
  writes=writes.then(()=>checkpoint(data));await writes;
 }};
 // An idle provider may send no next event. Persist a small received tail
 // independently of provider traffic, with ordered writes through final save.
 const checkpointTimer=setInterval(()=>{if(answer.length!==lastSaved)save(true).catch(()=>{error={message:'Laufende Sicherung der KI-Ausgabe fehlgeschlagen.'};reader.cancel().catch(()=>{});});},2000);
 async function event(raw){
  const payload=raw.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
  if(!payload)return;if(payload==='[DONE]'){done=true;return;}
  const d=JSON.parse(payload);model=d.model||model;usage=d.usage||usage;error=d.error||error;
  const choice=d.choices?.[0],text=choice?.delta?.content;
  if(typeof text==='string')answer+=text;else if(Array.isArray(text))answer+=text.filter(x=>x.type==='text').map(x=>x.text).join('');
  if(answer.length>240000)throw Error('KI-Ausgabe überschreitet die sichere Dokumentgröße.');
  finish=choice?.finish_reason||finish;await save();
 }
 try{
  while(true){const part=await reader.read();if(part.done)break;buffer=(buffer+decoder.decode(part.value,{stream:true})).replace(/\r\n/g,'\n');let at;while((at=buffer.indexOf('\n\n'))>=0){await event(buffer.slice(0,at));buffer=buffer.slice(at+2);}}
  buffer+=decoder.decode();if(buffer.trim())await event(buffer);
  if(!done&&!finish)error={message:'Antwortstrom ohne Abschluss beendet.'};
 }catch(e){error={message:String(e.message||e)};finish='interrupted';}
 finally{clearTimeout(timer);clearInterval(checkpointTimer);await save(true);try{await reader.cancel();}catch{}}
 if(error)finish='error';return snapshot();
}
