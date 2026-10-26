import assert from 'node:assert/strict';
import {SoundFontCache} from '../src/soundfont-cache.mjs';
const items=new Map();
const cache={match:async k=>items.get(k)?.clone(),put:async(k,r)=>{items.set(k,r.clone());},delete:async k=>items.delete(k)};
const storage={open:async()=>cache};
const bytes=Uint8Array.from([82,73,70,70,1,2,3,4]);
const font={name:'FluidGM.sf2',savedAt:'version1',bytes:bytes.length,url:'/api/soundfont/file'};
let requests=0;const fetcher=async()=>{requests++;return new Response(bytes);};
const first=new SoundFontCache({storage,fetcher}),progress=[];
await first.prepare(font,p=>progress.push(p));assert.equal(requests,1);assert(progress.some(p=>!p.ready&&p.received===bytes.length));
// A new app instance on the same device uses the stored bytes, without fetch.
const reopened=new SoundFontCache({storage,fetcher});
const restored=await reopened.prepare(font,p=>progress.push(p));assert.equal(requests,1);assert.deepEqual(new Uint8Array(await restored.arrayBuffer()),bytes);assert(progress.at(-1).local);
// Selecting a local file seeds the cache directly, before the next app start.
await reopened.store({...font,savedAt:'version2'},bytes.buffer);
await new SoundFontCache({storage,fetcher}).prepare({...font,savedAt:'version2'});assert.equal(requests,1);
await reopened.prepare({...font,savedAt:'version3'});assert.equal(requests,2,'a different server version must reload');
await reopened.clear();assert.equal(items.size,0);
let complete;
const delayed=new SoundFontCache({storage,fetcher:()=>new Promise(r=>{requests++;complete=r;})});
const a=delayed.prepare(font),b=delayed.prepare(font);assert.equal(a,b,'preload/play share one download');
await new Promise(r=>setTimeout(r,0));
await delayed.store({...font,savedAt:'new-selection'},bytes.buffer);
complete(new Response(bytes));await a;
assert.equal(items.get(delayed.key).headers.get('X-Lab-Font-Version'),'new-selection|8','old preload cannot replace new selection');
const warnings=[];
const unavailable=new SoundFontCache({storage:{open:async()=>{throw Error('quota');}},fetcher,onwarning:e=>warnings.push(e.message)});
assert.equal((await unavailable.prepare(font)).size,8);assert(warnings.includes('quota'));
await assert.rejects(new SoundFontCache({storage,fetcher:async()=>new Response(bytes.slice(0,4))}).prepare({...font,savedAt:'short'}),/unvollständig/);
assert.notEqual(items.get(delayed.key).headers.get('X-Lab-Font-Version'),'short|8');
console.log('PASS: fresh app uses exact locally cached font without network; local selection seeds cache; version changes, progress, shared download, stale preload, quota failure and truncated response handled.');

// WebKit requires Window as the receiver; injected arrow mocks missed this bug.
const nativeFetch=globalThis.fetch;let nativeCalls=0;
try{
 globalThis.fetch=async function(url){
  if(this!==globalThis)throw new TypeError('Can only call Window.fetch on instances of Window');
  nativeCalls++;assert.equal(url,font.url);return new Response(bytes);
 };
 items.clear();
 await new SoundFontCache({storage}).prepare(font);
 assert.equal(nativeCalls,1);
 // Closing/reopening restores the same saved selection from the device cache.
 await new SoundFontCache({storage}).prepare(font);assert.equal(nativeCalls,1);
 // If device storage was cleared, the saved server selection is downloaded again.
 items.clear();await new SoundFontCache({storage}).prepare(font);assert.equal(nativeCalls,2);
}finally{globalThis.fetch=nativeFetch;}
console.log('PASS: default fetch uses the browser global receiver; saved font restores after reopen with and without device cache.');
