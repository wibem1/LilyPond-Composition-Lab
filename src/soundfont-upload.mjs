export const FONT_PART_BYTES=8*1024*1024;
const tag=a=>String.fromCharCode(...a);
const uint=a=>new DataView(Uint8Array.from(a).buffer).getUint32(0,true);
const read=async(bucket,key)=>{const o=await bucket.get(key);return o?o.json():null;};
const write=(bucket,key,value)=>bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
function invalid(message){const e=Error(message);e.status=400;throw e;}

// Only RIFF headers are retained between requests, never sample data.
export function validateFontPart(state,bytes,total,final=false){
 const s=structuredClone(state||{position:0,stage:'root',header:[],skip:0,lists:[]});
 let i=0;
 while(i<bytes.length){
  if(s.skip){const n=Math.min(s.skip,bytes.length-i);s.skip-=n;s.position+=n;i+=n;continue;}
  const needed=s.stage==='root'?12:s.stage==='list'?4:8;
  const n=Math.min(needed-s.header.length,bytes.length-i);
  s.header.push(...bytes.subarray(i,i+n));s.position+=n;i+=n;
  if(s.header.length!==needed)continue;
  const h=s.header;s.header=[];
  if(s.stage==='root'){
   if(tag(h.slice(0,4))!=='RIFF'||tag(h.slice(8))!=='sfbk'||uint(h.slice(4,8))+8!==total)invalid('Bitte eine vollständige SF2-Datei wählen.');
   s.stage='chunk';
  }else if(s.stage==='list'){
   s.lists.push(tag(h));s.stage='chunk';
  }else{
   const size=uint(h.slice(4));
   if(s.position+size+(size%2)>total)invalid('Unvollständige SF2-Datei.');
   if(tag(h.slice(0,4))==='LIST'&&size>=4){s.stage='list';s.skip=0;s.listRemaining=size-4+(size%2);}
   else s.skip=size+(size%2);
  }
  if(s.stage==='chunk'&&s.listRemaining!==undefined){s.skip=s.listRemaining;delete s.listRemaining;}
 }
 if(s.position>total)invalid('SoundFont enthält mehr Daten als angekündigt.');
 if(final&&(s.position!==total||s.stage!=='chunk'||s.skip||s.header.length||!['INFO','sdta','pdta'].every(t=>s.lists.includes(t))))invalid('Die Datei enthält keine vollständige SoundFont-Struktur.');
 return s;
}
async function partBytes(req,expected){
 if(Number(req.headers.get('Content-Length'))>expected)invalid('Upload-Teil ist zu groß.');
 if(!req.body)invalid('Upload-Teil fehlt.');
 const reader=req.body.getReader(),chunks=[];let size=0;
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>expected){await reader.cancel();invalid('Upload-Teil ist zu groß.');}chunks.push(r.value);}}
 finally{reader.releaseLock();}
 if(size!==expected)invalid('Upload-Teil ist unvollständig.');
 const data=new Uint8Array(size);let at=0;for(const c of chunks){data.set(c,at);at+=c.length;}return data;
}
export async function soundfontUpload(req,bucket){
 const url=new URL(req.url),id=url.searchParams.get('id');
 if(req.method==='POST'&&!id){
  const b=await req.json();if(!Number.isSafeInteger(b.bytes)||b.bytes<12)invalid('Ungültige SoundFont-Größe.');
  const id=crypto.randomUUID(),key='soundfonts/'+id+'.sf2';
  const upload=await bucket.createMultipartUpload(key,{httpMetadata:{contentType:'application/octet-stream'}});
  const name=String(b.name||'Eigener SoundFont').replace(/[\x00-\x1f\x7f]/g,'').slice(0,200);
  try{await write(bucket,'uploads/soundfont/'+id+'.json',{key,uploadId:upload.uploadId,name,bytes:b.bytes,parts:[],validation:null});}
  catch(e){await upload.abort();throw e;}
  return {id,partBytes:FONT_PART_BYTES};
 }
 if(!/^[a-f0-9-]{36}$/.test(id||''))invalid('Ungültige Upload-Kennung.');
 const sessionKey='uploads/soundfont/'+id+'.json',session=await read(bucket,sessionKey);
 if(!session)invalid('SoundFont-Upload nicht gefunden.');
 const upload=bucket.resumeMultipartUpload(session.key,session.uploadId);
 if(req.method==='DELETE'){await upload.abort();await bucket.delete(sessionKey);return {aborted:true};}
 if(req.method==='PUT'){
  const part=Number(url.searchParams.get('part'));
  if(!Number.isInteger(part)||part!==session.parts.length+1)invalid('Upload-Teile müssen in Reihenfolge übertragen werden.');
  const offset=(part-1)*FONT_PART_BYTES,expected=Math.min(FONT_PART_BYTES,session.bytes-offset);
  if(expected<=0)invalid('Unerwarteter Upload-Teil.');
  const data=await partBytes(req,expected);
  const validation=validateFontPart(session.validation,data,session.bytes,offset+expected===session.bytes);
  const result=await upload.uploadPart(part,data);
  session.parts.push({partNumber:result.partNumber,etag:result.etag});session.validation=validation;
  await write(bucket,sessionKey,session);
  return {received:offset+expected,bytes:session.bytes};
 }
 if(req.method==='POST'){
  validateFontPart(session.validation,new Uint8Array(),session.bytes,true);
  if(session.parts.length!==Math.ceil(session.bytes/FONT_PART_BYTES))invalid('SoundFont-Upload ist unvollständig.');
  await upload.complete(session.parts);
  const old=await read(bucket,'settings/soundfont.json'),savedAt=new Date().toISOString();
  try{await write(bucket,'settings/soundfont.json',{name:session.name,bytes:session.bytes,key:session.key,savedAt});}
  catch(e){await bucket.delete(session.key);throw e;}
  await bucket.delete(sessionKey);
  if(old?.key)try{await bucket.delete(old.key);}catch{}
  return {name:session.name,bytes:session.bytes,savedAt,url:'/api/soundfont/file'};
 }
 invalid('Ungültige Upload-Anfrage.');
}
