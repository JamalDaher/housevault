import type {Item} from "./domain";
import {planCloudPull,type CloudSnapshot,type LocalSnapshot} from "./cloudPullPlan";
import {saveWithRevision,type RevisionTransport} from "./syncRevision";

/** Cloud metadata transfer: no attachments, deletions, or local writes. */
export type RevisionListClient={
 from:(table:string)=>{select:(columns:string)=>{eq:(column:string,value:string)=>{limit:(count:number)=>Promise<{data:{item_id:string;revision:string;payload:Item;deleted_at?:string|null}[]|null;error:{message:string}|null}>}}};
};
export async function fetchCloudInventory(client:RevisionListClient,householdId:string):Promise<CloudSnapshot<Item>[]>{
 if(!householdId.trim())throw new Error("Household required");
 const {data,error}=await client.from("inventory_revisions").select("item_id,revision,payload,deleted_at").eq("household_id",householdId).limit(1001);
 if(error||!data)throw new Error("Cloud inventory could not be downloaded");
 if(data.length>1000)throw new Error("Cloud inventory exceeds the safe transfer limit");
 const result:CloudSnapshot<Item>[]=[];
 for(const row of data){
  if(row.item_id.startsWith("__housevault_test_")||row.deleted_at)continue;
  if(!row.payload||row.payload.id!==row.item_id||!row.revision)throw new Error("Cloud inventory contains invalid record identity");
  result.push({itemId:row.item_id,revision:row.revision,value:row.payload});
 }
 return result;
}
export function planInventoryTransfer(local:LocalSnapshot<Item>[],cloud:CloudSnapshot<Item>[]){
 return planCloudPull(local,cloud);
}
/** Upload only a new, attachment-free record. Caller must confirm the local snapshot
 * is still current; a concurrent remote creation is rejected by the server CAS. */
export async function uploadNewCloudItem(item:Item,transport:RevisionTransport<Item>):Promise<string>{
 if(!item.id.trim()||item.photo||(item.photos?.length??0)>0||(item.documents?.length??0)>0)throw new Error("Attachment transfer requires a separate verified workflow");
 const result=await saveWithRevision({itemId:item.id,expectedRevision:null,value:structuredClone(item)},transport);
 return result.revision;
}
