import type {Item} from "./domain";
import {hasAttachments,sameItem} from "./syncBaselines";

export type LocalChange={itemId:string;operation:"upsert"|"delete";payload:Item|null};

/** Determine local mutations since the previous durable device snapshot.
 * Callers must explicitly select a household and verify a trusted baseline
 * before enqueueing or sending these changes to the cloud.
 */
export function diffLocalInventory(previous:Item[],current:Item[]):LocalChange[]{
 const old=new Map<string,Item>(),next=new Map<string,Item>();
 for(const item of previous){
  if(!item.id.trim()||old.has(item.id))throw new Error("Duplicate or invalid previous inventory identity");
  old.set(item.id,item);
 }
 for(const item of current){
  if(!item.id.trim()||next.has(item.id))throw new Error("Duplicate or invalid current inventory identity");
  next.set(item.id,item);
 }
 const changes:LocalChange[]=[];
 for(const [id,item] of next){
  const before=old.get(id);
  if(before&&sameItem(before,item))continue;
  // Attachments are never silently queued as JSON without an asset upload.
  if(hasAttachments(item)||before&&hasAttachments(before))continue;
  changes.push({itemId:id,operation:"upsert",payload:structuredClone(item)});
 }
 for(const [id,item] of old){
  if(!next.has(id)&&!hasAttachments(item))changes.push({itemId:id,operation:"delete",payload:null});
 }
 return changes;
}
