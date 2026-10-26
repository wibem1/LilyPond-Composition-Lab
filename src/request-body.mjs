// Enforce limits while reading, before allocating or parsing the complete body.
export async function limitedBytes(request,limit){
 const tooLarge=()=>Object.assign(Error('Anfrage zu groß.'),{status:413});
 if(Number(request.headers.get('Content-Length'))>limit){await request.body?.cancel().catch(()=>{});throw tooLarge();}
 if(!request.body)return new Uint8Array();
 const reader=request.body.getReader();let size=0,bytes=new Uint8Array(Math.min(limit,65536));
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;const next=size+value.byteLength;
   if(next>limit){await reader.cancel().catch(()=>{});throw tooLarge();}
   if(next>bytes.length){const grown=new Uint8Array(Math.min(limit,Math.max(next,bytes.length*2)));grown.set(bytes);bytes=grown;}
   bytes.set(value,size);size=next;
  }
 }finally{reader.releaseLock();}
 return bytes.slice(0,size);
}
export async function limitedJson(request,limit=1200000){
 const bytes=await limitedBytes(request,limit);let value;
 try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{throw Object.assign(Error('Ungültige JSON-Anfrage.'),{status:400});}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(Error('JSON-Objekt erforderlich.'),{status:400});
 return value;
}
