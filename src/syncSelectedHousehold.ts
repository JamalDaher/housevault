import type {Item} from "./domain";
import type {CloudRevisionClient} from "./cloudRevisionApi";
import {createCloudRevisionApi} from "./cloudRevisionApi";
import {createSafeOfflineTransport} from "./safeOfflineTransport";
import {loadInventory} from "./indexedStorage";
import {readSyncBaseline,saveSyncBaseline} from "./syncBaselines";
import {runSyncQueue,type SyncRunnerOptions} from "./syncRunner";

/** Explicitly invoked authenticated household sync. Never runs automatically.
 * Call only after validating session, household membership and edit permission.
 */
export async function syncSelectedHousehold(
 client:CloudRevisionClient<Item>,
 householdId:string,
 options:Omit<SyncRunnerOptions,"householdId">={}
){
 if(!householdId.trim())throw new Error("Select a household to synchronize");
 const api=createCloudRevisionApi<Item>(client,householdId);
 const transport=createSafeOfflineTransport({
  householdId,
  readLocal:async id=>(await loadInventory()).find(item=>item.id===id)??null,
  readBaseline:id=>readSyncBaseline(householdId,id),
  readRemote:api.read,
  write:api.write,
  saveBaseline:(id,baseline)=>saveSyncBaseline(householdId,id,baseline)
 });
 return runSyncQueue(transport,{...options,householdId});
}
