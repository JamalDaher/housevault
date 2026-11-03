import type {Item} from "./domain";
import type {SyncBaseline} from "./syncBaselines";
import {planHouseholdOutbox} from "./householdOutboxPlan";
import {enqueueSync,type SyncEntry} from "./syncQueue";

/** Persist an explicit household's eligible local changes for later delivery.
 * Deletions stay excluded until the confirmed cloud deletion transport is wired.
 * The outbox currently has no household partition, so do not enqueue a second
 * household into the same queue; callers must enforce this before invoking.
 */
export async function queueHouseholdChanges(input:{
 householdId:string;previous:Item[];current:Item[];
 baselines:Map<string,SyncBaseline>;allowCreates:boolean;
}):Promise<SyncEntry[]>{
 const candidates=planHouseholdOutbox({...input,allowDeletes:false});
 const saved:SyncEntry[]=[];
 for(const change of candidates){
  if(change.operation!=="upsert"||!change.payload)continue;
  saved.push(await enqueueSync(change.itemId,"upsert",change.payload));
 }
 return saved;
}
