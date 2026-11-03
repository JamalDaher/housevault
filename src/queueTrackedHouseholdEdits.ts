import type {Item} from "./domain";
import {loadInventory} from "./indexedStorage";
import {readSyncBaseline} from "./syncBaselines";
import {enqueueUniqueHouseholdUpsert,listPendingSync} from "./syncQueue";
import {selectTrackedEdits} from "./selectTrackedEdits";

/** Local-only opt-in queue scan. Never sends network requests or queues deletions. */
const activeScans=new Map<string,Promise<number>>();
async function scanHousehold(householdId:string):Promise<number>{
 if(!householdId.trim())throw new Error("Household required");
 const local=await loadInventory();
 const pending=await listPendingSync();
 const queued=new Set(pending.filter(e=>e.householdId===householdId).map(e=>e.itemId));
 const baselines=new Map<string,Awaited<ReturnType<typeof readSyncBaseline>>>();
 for(const item of local)baselines.set(item.id,await readSyncBaseline(householdId,item.id));
 const eligible:Item[]=selectTrackedEdits({items:local,baselines,queuedIds:queued});
 let count=0;
 for(const item of eligible){
  // The inventory may have changed while baselines were being loaded.
  const latest=(await loadInventory()).find(current=>current.id===item.id);
  if(!latest)continue;
  const baseline=await readSyncBaseline(householdId,item.id);
  const safe=selectTrackedEdits({items:[latest],baselines:new Map([[item.id,baseline]]),queuedIds:new Set()});
  if(safe.length!==1)continue;
  if(await enqueueUniqueHouseholdUpsert(householdId,item.id,latest))count++;
 }
 return count;
}

/** Serialize scans per household within this app instance, including manual scans. */
export function queueTrackedHouseholdEdits(householdId:string):Promise<number>{
 if(!householdId.trim())return Promise.reject(new Error("Household required"));
 const existing=activeScans.get(householdId);
 if(existing)return existing;
 const task=scanHousehold(householdId);
 activeScans.set(householdId,task);
 void task.finally(()=>{if(activeScans.get(householdId)===task)activeScans.delete(householdId);}).catch(()=>{});
 return task;
}
