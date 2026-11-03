import type {Item} from "./domain";
import {planCloudDeletion} from "./cloudDeletionPlan";
import type {SyncBaseline} from "./syncBaselines";

export function buildDeletionReview(local:Item[],cloud:{itemId:string;revision:string;value:Item}[],baselines:Map<string,SyncBaseline>){
 const byId=new Map(local.map(item=>[item.id,item]));
 const seen=new Set<string>();
 return cloud.filter(row=>{
  if(seen.has(row.itemId))throw new Error("Duplicate cloud item identity");
  seen.add(row.itemId);
  return !row.itemId.startsWith("__housevault_test_");
 }).map(row=>({
  itemId:row.itemId,
  name:baselines.get(row.itemId)?.value.name??row.value.name,
  decision:planCloudDeletion({itemId:row.itemId,local:byId.get(row.itemId)??null,baseline:baselines.get(row.itemId)??null,remote:{revision:row.revision,value:row.value}})
 })).filter(row=>row.decision.kind!=="not-deleted");
}
