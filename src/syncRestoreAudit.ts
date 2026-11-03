import type { Item } from "./domain";
import { buildAttachmentManifest, verifyAttachment } from "./attachmentSync";

/** A cloud restore must have every required attachment, not merely verify
 * the subset the server happened to return. Does not modify local inventory.
 */
export type RestoreAudit =
 | { ready:true; verified:number }
 | { ready:false; missing:string[]; corrupted:string[]; unexpected:string[] };

export async function auditCloudRestoreAttachments(
 remoteItems:Item[],
 downloaded:{key:string;data:string}[]
):Promise<RestoreAudit>{
 const expected=await buildAttachmentManifest(remoteItems);
 const expectedByKey=new Map(expected.map(blob=>[blob.entry.key,blob.entry]));
 const provided=new Map<string,string>();
 const unexpected:string[]=[];
 for(const blob of downloaded){
  if(provided.has(blob.key)||!expectedByKey.has(blob.key))unexpected.push(blob.key);
  else provided.set(blob.key,blob.data);
 }
 const missing:string[]=[],corrupted:string[]=[];
 for(const [key,entry] of expectedByKey){
  const value=provided.get(key);
  if(value===undefined)missing.push(key);
  else if(!await verifyAttachment(entry,value))corrupted.push(key);
 }
 if(missing.length||corrupted.length||unexpected.length)
  return {ready:false,missing,corrupted,unexpected};
 return {ready:true,verified:expected.length};
}
