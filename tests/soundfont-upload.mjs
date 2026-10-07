import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../worker/index.js';
import {FONT_PART_BYTES,validateFontPart} from '../src/soundfont-upload.mjs';
const total=160*1024*1024;
function samplePart(at,size,totalBytes=total){
 const bytes=new Uint8Array(size);
 if(at===0){
  const view=new DataView(bytes.buffer),text=(at,s)=>bytes.set(new TextEncoder().encode(s),at);
  text(0,'RIFF');view.setUint32(4,totalBytes-8,true);text(8,'sfbk');
  for(const [i,t] of ['INFO','sdta','pdta'].entries()){text(12+12*i,'LIST');view.setUint32(16+12*i,4,true);text(20+12*i,t);}
  text(48,'JUNK');view.setUint32(52,totalBytes-56,true);
 }
 return bytes;
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
class Bucket{
 items=new Map([['settings/soundfont.json',{name:'Previous.sf2',key:'previous'}]]);
 uploads=new Map();maxPart=0;failPart=false;
 async get(key){const v=this.items.get(key);return v?{async json(){return structuredClone(v);}}:null;}
 async put(key,value){assert(typeof value==='string','sample data must use multipart, not bucket.put');this.items.set(key,JSON.parse(value));}
 async delete(key){this.items.delete(key);}
 async createMultipartUpload(key){const uploadId=crypto.randomUUID();this.uploads.set(uploadId,{key,parts:[]});return this.resumeMultipartUpload(key,uploadId);}
 resumeMultipartUpload(key,id){
  const bucket=this;
  return {uploadId:id,async uploadPart(n,bytes){
   if(bucket.failPart)throw Error('temporary upload failure');
   assert(bytes.length<=FONT_PART_BYTES);bucket.maxPart=Math.max(bucket.maxPart,bytes.length);
   assert.equal(hash(bytes),hash(samplePart((n-1)*FONT_PART_BYTES,bytes.length)),'part data unchanged');
   const part={partNumber:n,etag:hash(bytes),size:bytes.length};bucket.uploads.get(id).parts[n-1]=part;return part;
  },async complete(parts){
   const u=bucket.uploads.get(id);assert.equal(parts.length,u.parts.length);
   assert.deepEqual(parts,u.parts.map(({partNumber,etag})=>({partNumber,etag})));
   bucket.items.set(key,{bytes:u.parts.reduce((n,p)=>n+p.size,0)});bucket.uploads.delete(id);
  },async abort(){bucket.uploads.delete(id);}};
 }
}
const bucket=new Bucket(),env={BUCKET:bucket};
const request=(method,path,body,headers={})=>new Request('https://lab.test'+path,{method,headers,body});
const call=req=>worker.fetch(req,env,{});
const create=async()=>{const r=await call(request('POST','/api/soundfont/upload',JSON.stringify({name:'Large.sf2',bytes:total}),{'Content-Type':'application/json'}));assert.equal(r.status,200);return r.json();};
const upload=await create(),path='/api/soundfont/upload?id='+upload.id;
assert.equal(upload.partBytes,FONT_PART_BYTES);
assert.equal((await call(request('POST',path,'{}'))).status,400,'cannot publish incomplete file');
assert.equal((await call(request('PUT',path+'&part=2',samplePart(FONT_PART_BYTES,FONT_PART_BYTES)))).status,400,'out of order rejected');
for(let at=0,n=1;at<total;at+=FONT_PART_BYTES,n++){
 const req=request('PUT',path+'&part='+n,samplePart(at,Math.min(FONT_PART_BYTES,total-at)));
 req.arrayBuffer=()=>{throw Error('whole request buffering is forbidden');};
 const r=await call(req);assert.equal(r.status,200,await r.clone().text());
 assert.equal((await r.json()).received,Math.min(at+FONT_PART_BYTES,total));
 assert.equal(bucket.items.get('settings/soundfont.json').name,'Previous.sf2','active bank unchanged before complete');
}
const completed=await call(request('POST',path,'{}'));assert.equal(completed.status,200);
assert.equal((await completed.json()).bytes,total);assert.equal(bucket.maxPart,8*1024*1024);
assert.equal(bucket.items.get('settings/soundfont.json').name,'Large.sf2');assert.equal(bucket.uploads.size,0);
const current=structuredClone(bucket.items.get('settings/soundfont.json'));
const bad=await create(),badPath='/api/soundfont/upload?id='+bad.id;
const invalid=samplePart(0,FONT_PART_BYTES);invalid[0]=0;
assert.equal((await call(request('PUT',badPath+'&part=1',invalid))).status,400);
bucket.failPart=true;assert.equal((await call(request('PUT',badPath+'&part=1',samplePart(0,FONT_PART_BYTES)))).status,500);bucket.failPart=false;
assert.deepEqual(bucket.items.get('settings/soundfont.json'),current);
assert.equal((await call(request('DELETE',badPath))).status,200);assert.equal(bucket.uploads.size,0);
assert.equal((await call(request('POST','/api/soundfont/upload','{}',{Origin:'https://other.test'}))).status,403);
// Headers and odd-size padding may span any network part boundary.
const tiny=samplePart(0,56,56);let state;
for(const b of tiny)state=validateFontPart(state,Uint8Array.of(b),56);
validateFontPart(state,new Uint8Array(),56,true);
assert.throws(()=>validateFontPart(state,new Uint8Array(),57,true));
console.log('PASS: 160 MiB SF2 multipart route under 8 MiB per-request memory bound, exact part bytes, completion, failed/malformed/incomplete upload protection, abort and origin checks.');

// Run the shipped browser upload function with a server that rejects big requests.
const app=await readFile('app/app.mjs','utf8'),start=app.indexOf('async function saveSoundFont('),end=app.indexOf('\nfunction invalidate',start);
const sizes=[],progress={textContent:''};let aborted=false;
const context={selectedFont:null,preparedFont:null,preparedFontVersion:'',fontCache:{store:async(f,b)=>new Blob([b]),version:f=>f.name},$:()=>progress,api:async(path,data)=>path.includes('?')?{name:'Browser.sf2',bytes:25*1024*1024}:{id:'test',partBytes:FONT_PART_BYTES},fetch:async(path,opts)=>{
 if(opts.method==='DELETE'){aborted=true;return {ok:true};}
 sizes.push(opts.body.byteLength);assert(opts.body.byteLength<=FONT_PART_BYTES);
 return {ok:true,json:async()=>({received:Math.min(sizes.length*FONT_PART_BYTES,25*1024*1024),bytes:25*1024*1024})};
}};
vm.createContext(context);vm.runInContext(app.slice(start,end),context);
await context.saveSoundFont(new ArrayBuffer(25*1024*1024),'Browser.sf2');
assert.deepEqual(sizes,[FONT_PART_BYTES,FONT_PART_BYTES,FONT_PART_BYTES,1024*1024]);assert(!aborted);assert(progress.textContent.includes('100 %'));
context.fetch=async(path,opts)=>opts.method==='DELETE'?(aborted=true,{ok:true}):{ok:false,json:async()=>({error:'test failure'})};
await assert.rejects(context.saveSoundFont(new ArrayBuffer(12),'Bad.sf2'),/test failure/);assert(aborted);
console.log('PASS: shipped browser uses bounded sequential parts, progress and explicit completion; failure aborts without replacing saved selection.');
