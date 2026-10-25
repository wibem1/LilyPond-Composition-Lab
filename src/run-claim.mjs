// Immutable reservation: an uncertain/terminated execution must never be
// restarted automatically under the same ID, including in another isolate.
// This prevents duplicate submission; it does not make execution durable.
export async function claimRun(bucket,runId,state={runId,claimedAt:new Date().toISOString()}){
 const result=await bucket.put('run-claims/'+runId+'.json',JSON.stringify(state),{
  onlyIf:new Headers({'If-None-Match':'*'}),
  httpMetadata:{contentType:'application/json'},
 });
 return result!=null;
}
