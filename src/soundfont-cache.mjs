// Keep just the active font on this device; metadata still comes from the server.
export class SoundFontCache {
 constructor({storage=globalThis.caches,fetcher=globalThis.fetch,onwarning=()=>{}}={}){
  this.storage=storage;this.fetcher=fetcher;this.onwarning=onwarning;this.pending=new Map();
  this.key='/__lab_saved_soundfont__';
  this.activeVersion='';this.writes=Promise.resolve();
 }
 version(font){return String(font.savedAt)+'|'+String(font.bytes);}
 async cache(){try{return await this.storage?.open('lab-soundfont-v1');}catch(e){this.onwarning(e);return null;}}
 async store(font,data){
  const version=this.version(font);this.activeVersion=version;
  const blob=data instanceof Blob?data:new Blob([data],{type:'application/octet-stream'});
  if(font.bytes&&blob.size!==font.bytes)throw Error('Gespeicherter SoundFont ist unvollständig.');
  const cache=await this.cache();
  if(cache){this.writes=this.writes.catch(()=>{}).then(async()=>{if(this.activeVersion===version)await cache.put(this.key,new Response(blob,{headers:{'X-Lab-Font-Version':version,'Content-Type':'application/octet-stream'}}));});try{await this.writes;}catch(e){this.onwarning(e);}}
  return blob;
 }
 async clear(){this.activeVersion='';await this.writes.catch(()=>{});const cache=await this.cache();if(cache)await cache.delete(this.key).catch(e=>this.onwarning(e));}
 prepare(font,onprogress=()=>{}){
  const version=this.version(font);
  this.activeVersion=version;
  if(this.pending.has(version))return this.pending.get(version);
  const job=this.load(font,onprogress).finally(()=>this.pending.delete(version));
  this.pending.set(version,job);return job;
 }
 async load(font,onprogress){
  const cache=await this.cache();
  try{
   const stored=await cache?.match(this.key);
   if(stored?.headers.get('X-Lab-Font-Version')===this.version(font)){
    const blob=await stored.blob();
    if(!font.bytes||blob.size===font.bytes){onprogress({local:true,ready:true,received:blob.size,total:blob.size});return blob;}
   }
  }catch(e){this.onwarning(e);}
  onprogress({local:false,ready:false,received:0,total:font.bytes});
  const r=await this.fetcher(font.url);if(!r.ok)throw Error('SoundFont nicht gefunden (HTTP '+r.status+')');
  let received=0,response=r;
  if(r.body&&globalThis.TransformStream){
   const stream=r.body.pipeThrough(new TransformStream({transform(chunk,controller){received+=chunk.byteLength;onprogress({local:false,ready:false,received,total:font.bytes});controller.enqueue(chunk);}}));
   response=new Response(stream);
  }
  const blob=await response.blob();
  if(this.activeVersion===this.version(font))await this.store(font,blob);
  onprogress({local:false,ready:true,received:blob.size,total:blob.size});return blob;
 }
}
