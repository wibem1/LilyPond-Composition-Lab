// Backups carry compositions and their referenced files, never connection secrets.
const FORMAT='LilyPond-Composition-Lab.backup',MAX_BYTES=24*1024*1024;
const encoder=new TextEncoder();
const encode=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const validId=v=>/^[a-f0-9]{16,40}$/.test(String(v||''));
const fileUrl=v=>typeof v==='string'&&/^\/download\/[^/]+$/.test(v);
function refs(entry){return [...(entry.downloads||[]),...(entry.pages||[]),{url:entry.midiUrl}].map(x=>x?.url).filter(fileUrl);}
function runIds(entry){return [entry.runId,entry.ideaStage?.runId,entry.compositionStage?.runId].filter(validId);}
function checkFile(url,value){
 const name=decodeURIComponent(url.slice(10));if(/[\\/\x00-\x1f]/.test(name)||!['ly','mid','svg','txt'].includes(name.split('.').pop())||typeof value!=='string')throw Error('Ungültige Datei in der Sicherung.');
 return {name,ext:name.split('.').pop(),bytes:decode(value)};
}
export async function exportHistory(io){
 const entries=await io.entries(),workspace=await io.workspace(),all=[...entries,...(workspace?[workspace]:[])],artifacts={},diagnostics=[];
 let bytes=encoder.encode(JSON.stringify(all)).length;
 for(const url of new Set(all.flatMap(refs))){const file=await io.file(url);if(!file)throw Error('Eine gespeicherte Ergebnisdatei fehlt. Sicherung wurde nicht erstellt.');const data=new Uint8Array(file);bytes+=data.length*4/3;if(bytes>MAX_BYTES)throw Error('Der Verlauf ist für eine einzelne Sicherungsdatei zu groß (24 MB).');artifacts[url]=encode(data);}
 for(const runId of new Set(all.flatMap(runIds))){const logs=await io.logs(runId);bytes+=encoder.encode(JSON.stringify(logs)).length;if(bytes>MAX_BYTES)throw Error('Der Verlauf ist für eine einzelne Sicherungsdatei zu groß (24 MB).');diagnostics.push({runId,entries:logs});}
 return {format:FORMAT,version:1,createdAt:new Date().toISOString(),entries,workspace,artifacts,diagnostics};
}
export async function importHistory(data,io){
 if(!data||data.format!==FORMAT||data.version!==1||!Array.isArray(data.entries)||data.entries.length>2000||!data.artifacts||typeof data.artifacts!=='object'||Array.isArray(data.artifacts)||!Array.isArray(data.diagnostics))throw Error('Keine gültige LilyPond-Verlaufssicherung.');
 if(encoder.encode(JSON.stringify(data)).length>MAX_BYTES)throw Error('Sicherungsdatei zu groß (24 MB).');
 const entries=data.entries;
 if(entries.some(e=>!e||!validId(e.id)||typeof e.techout!=='string'||typeof e.draft!=='string')||new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('Ungültige Kompositionen in der Sicherung.');
 const all=[...entries,...(data.workspace?[data.workspace]:[])],decoded=new Map();
 for(const [url,value] of Object.entries(data.artifacts)){if(!fileUrl(url))throw Error('Ungültiger Dateipfad in der Sicherung.');decoded.set(url,checkFile(url,value));}
 for(const url of all.flatMap(refs))if(!decoded.has(url))throw Error('Eine Ergebnisdatei fehlt in der Sicherung.');
 for(const log of data.diagnostics)if(!validId(log?.runId)||!Array.isArray(log.entries)||log.entries.some(e=>!e||typeof e!=='object'||Array.isArray(e)))throw Error('Ungültiges Diagnoseprotokoll.');
 // Validate the entire backup before writing. Existing entries are never overwritten.
 const existing=new Set((await io.entries()).map(e=>e.id)),selected=entries.filter(e=>!existing.has(e.id)),urlMap=new Map(),runMap=new Map();
 const workspace=await io.workspace(),restoreWorkspace=!workspace&&data.workspace&&!existing.has(data.workspace.historyId);
 const importing=[...selected,...(restoreWorkspace?[data.workspace]:[])];
 for(const url of new Set(importing.flatMap(refs))){const file=decoded.get(url);urlMap.set(url,await io.saveFile(file.name.replace(/\.[^.]+$/,''),file.ext,file.bytes));}
 for(const id of new Set(importing.flatMap(runIds)))runMap.set(id,crypto.randomUUID().replaceAll('-',''));
 const remap=entry=>{const copy=structuredClone(entry);copy.downloads=(copy.downloads||[]).map(d=>({...d,url:urlMap.get(d.url)||d.url}));copy.pages=(copy.pages||[]).map(d=>({...d,url:urlMap.get(d.url)||d.url}));copy.midiUrl=urlMap.get(copy.midiUrl)||copy.midiUrl;copy.runId=runMap.get(copy.runId)||'';for(const stage of ['ideaStage','compositionStage'])if(copy[stage])copy[stage].runId=runMap.get(copy[stage].runId)||'';return copy;};
 for(const entry of selected)await io.saveEntry(remap(entry));
 for(const log of data.diagnostics)if(runMap.has(log.runId))await io.saveLogs(runMap.get(log.runId),log.entries);
 if(restoreWorkspace)await io.saveWorkspace(remap(data.workspace));
 return {imported:selected.length,skipped:entries.length-selected.length,workspaceRestored:!!restoreWorkspace};
}
export const backupByteLimit=MAX_BYTES;
