import { reconcileItem } from "./syncConflicts";
import { buildAttachmentManifest, verifyAttachment } from "./attachmentSync";
import type { Item } from "./domain";

/** Preflight-only validation for a future cloud sync rollout.
 * No network writes or local inventory mutations are performed.
 */
export type SyncPreflight =
 | { safe:true; merged:Item; attachmentCount:number }
 | { safe:false; reason:"identity"|"conflict"|"attachment-integrity"; details:string[] };

export async function preflightCloudRestore(input:{
 base:Item;local:Item;remote:Item;
 downloadedAttachments?:{key:string;data:string}[];
}):Promise<SyncPreflight>{
 const {base,local,remote}=input;
 if(!base.id||base.id!==local.id||base.id!==remote.id)
  return {safe:false,reason:"identity",details:["Inventory record IDs must match"]};
 const reconciliation=reconcileItem(base,local,remote);
 if(reconciliation.status==="conflict")
  return {safe:false,reason:"conflict",details:reconciliation.conflicts.map(c=>c.field)};
 const blobs=await buildAttachmentManifest([remote]);
 const downloads=new Map((input.downloadedAttachments??[]).map(x=>[x.key,x.data]));
 const invalid:string[]=[];
 for(const blob of blobs){
  if(downloads.has(blob.entry.key)&&!await verifyAttachment(blob.entry,downloads.get(blob.entry.key)!))
   invalid.push(blob.entry.key);
 }
 if(invalid.length)return {safe:false,reason:"attachment-integrity",details:invalid};
 return {safe:true,merged:reconciliation.item,attachmentCount:blobs.length};
}
