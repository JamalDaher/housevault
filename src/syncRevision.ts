/** Revision-guarded cloud writes.
 * The transport must enforce compare-and-swap atomically on the server.
 * Never treat a client-side revision comparison as sufficient protection.
 */
export type RevisionWrite<T> = {itemId:string;expectedRevision:string|null;value:T};
export type RevisionWriteResult<T> =
 | {status:"saved";revision:string;value:T}
 | {status:"conflict";revision:string|null;remote:T|null};
export type RevisionTransport<T> = (write:RevisionWrite<T>)=>Promise<RevisionWriteResult<T>>;

export class CloudRevisionConflict<T> extends Error {
 readonly revision:string|null;
 readonly remote:T|null;
 constructor(revision:string|null,remote:T|null){
  super("Cloud record changed on another device; manual reconciliation required");
  this.name="CloudRevisionConflict";
  this.revision=revision;
  this.remote=remote;
 }
}
/** Caller must persist the new revision after a successful response.
 * Conflicts are surfaced without retrying a stale write or overwriting remote.
 */
export async function saveWithRevision<T>(
 write:RevisionWrite<T>,
 transport:RevisionTransport<T>
):Promise<{revision:string;value:T}>{
 if(!write.itemId.trim())throw new Error("Item ID required");
 if(write.expectedRevision!==null&&!write.expectedRevision.trim())throw new Error("Invalid expected revision");
 const result=await transport(structuredClone(write));
 if(result.status==="conflict")throw new CloudRevisionConflict(result.revision,result.remote);
 if(!result.revision.trim())throw new Error("Server returned an empty revision");
 return {revision:result.revision,value:result.value};
}
