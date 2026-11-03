import type {Item} from "./domain";
import type {SyncEntry} from "./syncQueue";
import type {SyncBaseline} from "./syncBaselines";
import {planPendingChange} from "./offlineReconciliation";
import {CloudRevisionConflict,saveWithRevision,type RevisionTransport} from "./syncRevision";
import {sameItem} from "./syncBaselines";

type Dependencies={
 householdId:string;
 readLocal:(itemId:string)=>Promise<Item|null>;
 readBaseline:(itemId:string)=>Promise<SyncBaseline|null>;
 readRemote:(itemId:string)=>Promise<{revision:string;value:Item;deleted?:boolean}|null>;
 write:RevisionTransport<Item>;
 saveBaseline:(itemId:string,baseline:SyncBaseline)=>Promise<void>;
};

/** Opt-in queue transport for attachment-free creates and edits.
 * Deletions require a separate explicit-confirmation flow.
 * The queue payload is a snapshot; never upload it if local state has since changed.
 */
export function createSafeOfflineTransport(deps:Dependencies){
 return async (entry:SyncEntry):Promise<void>=>{
  if(!deps.householdId.trim()||entry.householdId!==deps.householdId)throw new Error("Queued change belongs to another or unknown household");
  if(entry.operation!=="upsert")throw new Error("Queued deletion requires explicit review");
  const queued=entry.payload as Item;
  if(!queued||queued.id!==entry.itemId)throw new Error("Queued inventory identity mismatch");
  const [local,baseline,remote]=await Promise.all([
   deps.readLocal(entry.itemId),deps.readBaseline(entry.itemId),deps.readRemote(entry.itemId)
  ]);
  if(!local||!sameItem(local,queued))throw new Error("Local inventory changed since queued edit");
  const decision=planPendingChange({itemId:entry.itemId,local,baseline,remote});
  if(decision.kind==="unchanged"){
   // A successful no-op is safe only if the queued snapshot still matches the trusted baseline.
   if(!baseline||!remote||remote.deleted||remote.revision!==baseline.revision)throw new CloudRevisionConflict(remote?.revision??null,remote?.value??null);
   return;
  }
  if(decision.kind==="conflict"||decision.kind==="delete")throw new CloudRevisionConflict(remote?.revision??null,remote?.value??null);
  // Recheck after remote reconciliation: the user may have edited or deleted the item meanwhile.
  const latest=await deps.readLocal(entry.itemId);
  if(!latest||!sameItem(latest,queued))throw new Error("Local inventory changed during cloud reconciliation");
  const saved=await saveWithRevision({
   itemId:entry.itemId,
   expectedRevision:decision.kind==="create"?null:decision.expectedRevision,
   value:decision.item
  },deps.write);
  await deps.saveBaseline(entry.itemId,{revision:saved.revision,value:structuredClone(decision.item)});
 };
}
