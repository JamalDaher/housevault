import { CloudRevisionConflict } from "./syncRevision";
import { acknowledgeSync, claimNextSync, retrySync, type SyncEntry } from "./syncQueue";

/** Transport is supplied by a future authenticated cloud integration.
 * The runner never starts itself or makes network requests without a caller.
 */
export type SyncTransport = (entry:SyncEntry)=>Promise<void>;
export type SyncRunResult = { sent:number; failed:number; remaining:boolean; stopped:"empty"|"offline"|"failed"|"conflict"|"limit" };
export type SyncRunnerOptions = { online?:()=>boolean; now?:()=>number; maxEntries?:number };
export async function runSyncQueue(transport:SyncTransport,options:SyncRunnerOptions={}):Promise<SyncRunResult>{
 const online=options.online??(()=>typeof navigator==="undefined"||navigator.onLine!==false);
 const now=options.now??Date.now;
 const limit=options.maxEntries??20;
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error("Invalid sync batch limit");
 let sent=0,failed=0;
 for(let i=0;i<limit;i++){
  if(!online())return {sent,failed,remaining:true,stopped:"offline"};
  const entry=await claimNextSync(now());
  if(!entry)return {sent,failed,remaining:false,stopped:"empty"};
  try{
   await transport(entry);
   if(!await acknowledgeSync(entry.id,entry.leaseToken!))throw new Error("Sync lease expired before acknowledgement");
   sent++;
  }catch(error){
   // Never discard an entry after a failed upload or acknowledgement.
   await retrySync(entry.id,entry.leaseToken!,now());
   failed++;
   return {sent,failed,remaining:true,stopped:error instanceof CloudRevisionConflict?"conflict":"failed"};
  }
 }
 return {sent,failed,remaining:true,stopped:"limit"};
}
export type SyncStatus = "offline"|"idle"|"pending"|"syncing"|"error";
export function syncStatus(input:{online:boolean;pending:number;running:boolean;error:boolean}):SyncStatus{
 if(!input.online)return "offline";
 if(input.running)return "syncing";
 if(input.error)return "error";
 return input.pending>0?"pending":"idle";
}
