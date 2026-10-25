// Simulation of the R2 contracts used by these tests, including atomic conditions.
export class MemoryBucket{
 constructor(){this.items=new Map();this.revision=0;}
 async put(key,value,opts={}){
  const old=this.items.get(key),condition=opts.onlyIf;
  if(condition instanceof Headers&&condition.get('If-None-Match')==='*'&&old)return null;
  if(condition?.etagMatches&&old?.etag!==condition.etagMatches)return null;
  const data=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);
  const entry={data,bytes:data,v:typeof value==='string'?value:undefined,etag:String(++this.revision),customMetadata:opts.customMetadata||{}};
  this.items.set(key,entry);return {etag:entry.etag};
 }
 async get(key){const entry=this.items.get(key);return entry?{etag:entry.etag,body:entry.data,json:async()=>JSON.parse(new TextDecoder().decode(entry.data)),arrayBuffer:async()=>entry.data.slice().buffer}:null;}
 async delete(key){this.items.delete(key);}
 async list({prefix}){return {objects:[...this.items].filter(([key])=>key.startsWith(prefix)).map(([key,entry])=>({key,customMetadata:entry.customMetadata})),truncated:false};}
}
