// R2 conditional writes arbitrate between isolates; a process-local Map cannot.
import {claimRun} from './run-claim.mjs';
export function runStorage(bucket){
 const read=async name=>{const object=await bucket.get(name);return object?object.json():null;};
 const options={httpMetadata:{contentType:'application/json'}};
 const create=async(name,state)=>Boolean(await bucket.put(name,JSON.stringify(state),{...options,onlyIf:new Headers({'If-None-Match':'*'})}));
 return {
  read,
  write:(name,value)=>bucket.put(name,JSON.stringify(value),options),
  create,
  claim:(id,state)=>claimRun(bucket,id,state),
  readClaim:async id=>{
   const state=await read('run-claims/'+id+'.json');
   return state&&!state.status?{...state,status:'running',phase:'Auftragsannahme wird geprüft',startedAt:state.claimedAt,updatedAt:state.claimedAt}:state;
  },
  replace:async(name,expected,value)=>{
   const object=await bucket.get(name);if(!object||JSON.stringify(await object.json())!==JSON.stringify(expected))return false;
   return Boolean(await bucket.put(name,JSON.stringify(value),{...options,onlyIf:{etagMatches:object.etag}}));
  }
 };
}
