import { parseBackup, exportBackup, type Item } from "./domain";

/**
 * The cloud adapter is deliberately not enabled here. This module defines a
 * defensive, testable reconciliation boundary before any remote writes exist.
 * A first-time cloud connection must never silently replace local inventory.
 */
export type SyncDecision =
 | { kind:"empty"; localCount:0; remoteCount:0 }
 | { kind:"upload-local"; localCount:number; remoteCount:0 }
 | { kind:"download-remote"; localCount:0; remoteCount:number }
 | { kind:"identical"; localCount:number; remoteCount:number }
 | { kind:"review-required"; localCount:number; remoteCount:number; localOnly:number; remoteOnly:number; changed:number };

function stableValue(value:unknown):unknown {
 if(Array.isArray(value))return value.map(stableValue);
 if(value!==null&&typeof value==="object"){
  return Object.fromEntries(Object.entries(value as Record<string,unknown>)
   .filter(([,entry])=>entry!==undefined)
   .sort(([a],[b])=>a<b?-1:a>b?1:0)
   .map(([key,entry])=>[key,stableValue(entry)]));
 }
 return value;
}
function canonical(item:Item):string {
 // PostgreSQL jsonb can reorder object keys at every nesting level.
 // Sort object keys recursively while preserving array order and values.
 return JSON.stringify(stableValue(item));
}
export function decideInitialSync(local:Item[],remote:Item[]):SyncDecision {
 // Validate both sides with the same strict backup validator already used by restore.
 const a=parseBackup(exportBackup(local)),b=parseBackup(exportBackup(remote));
 if(!a.length&&!b.length)return {kind:"empty",localCount:0,remoteCount:0};
 if(a.length&&!b.length)return {kind:"upload-local",localCount:a.length,remoteCount:0};
 if(!a.length&&b.length)return {kind:"download-remote",localCount:0,remoteCount:b.length};
 const byLocal=new Map(a.map(item=>[item.id,canonical(item)]));
 const byRemote=new Map(b.map(item=>[item.id,canonical(item)]));
 const localOnly=a.filter(item=>!byRemote.has(item.id)).length;
 const remoteOnly=b.filter(item=>!byLocal.has(item.id)).length;
 const changed=a.filter(item=>byRemote.has(item.id)&&byRemote.get(item.id)!==canonical(item)).length;
 if(localOnly===0&&remoteOnly===0&&changed===0)return {kind:"identical",localCount:a.length,remoteCount:b.length};
 return {kind:"review-required",localCount:a.length,remoteCount:b.length,localOnly,remoteOnly,changed};
}
export type FamilyRole="owner"|"editor"|"viewer";
export function canEdit(role:FamilyRole):boolean {return role==="owner"||role==="editor";}
export function canManageMembers(role:FamilyRole):boolean {return role==="owner";}
export type SyncManifest={schemaVersion:1;workspaceId:string;revision:string;updatedAt:string;itemCount:number};
export function validSyncManifest(value:unknown):value is SyncManifest {
 if(typeof value!=="object"||value===null)return false;
 const v=value as Record<string,unknown>;
 return v.schemaVersion===1&&typeof v.workspaceId==="string"&&v.workspaceId.length>0&&typeof v.revision==="string"&&v.revision.length>0&&typeof v.updatedAt==="string"&&!Number.isNaN(Date.parse(v.updatedAt))&&Number.isSafeInteger(v.itemCount)&&Number(v.itemCount)>=0;
}

/** Compare equipment fields independently of private attachment encoding.
 * Never use this result as permission to overwrite either inventory. */
export function compareEquipmentMetadata(local:Item[],remote:Item[]):SyncDecision{
 const strip=(items:Item[])=>items.map(({photo: _photo,photos: _photos,documents: _documents,...rest})=>{void _photo;void _photos;void _documents;return rest as Item;});
 return decideInitialSync(strip(local),strip(remote));
}
export function countAttachmentReferences(items:Item[]):number{
 return items.reduce((sum,item)=>sum+Number(Boolean(item.photo))+(item.photos?.length??0)+(item.documents?.length??0),0);
}
export function cloudAttachmentPaths(items:Item[],household:string):{paths:string[];invalid:number}{
 const paths:string[]=[];let invalid=0;
 for(const item of items){
  const values=[...(item.photo?[item.photo]:[]),...(item.photos??[]),...(item.documents??[]).map(doc=>doc.data)];
  for(const value of values){
   if(typeof value==="string"&&value.startsWith("cloud-asset:"+household+"/")&&/^cloud-asset:[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(value))paths.push(value.slice("cloud-asset:".length));
   else invalid++;
  }
 }
 return {paths:[...new Set(paths)],invalid};
}

export type RecordConflict={id:string;name:string;status:"device-only"|"cloud-only"|"different";fields:string[]};
/** Read-only, deterministic record-level diff. No merge or write permissions. */
export function previewRecordConflicts(local:Item[],remote:Item[]):RecordConflict[]{
 const byLocal=new Map(local.map(item=>[item.id,item]));
 const byRemote=new Map(remote.map(item=>[item.id,item]));
 const conflicts:RecordConflict[]=[];
 const strip=(item:Item)=>{const {photo:_photo,photos:_photos,documents:_documents,...rest}=item;void _photo;void _photos;void _documents;return rest as Record<string,unknown>;};
 for(const id of [...new Set([...byLocal.keys(),...byRemote.keys()])].sort()){
  const a=byLocal.get(id),b=byRemote.get(id);
  if(!a){conflicts.push({id,name:b!.name,status:"cloud-only",fields:[]});continue;}
  if(!b){conflicts.push({id,name:a.name,status:"device-only",fields:[]});continue;}
  const left=strip(a),right=strip(b);
  const fields=[...new Set([...Object.keys(left),...Object.keys(right)])].sort().filter(key=>JSON.stringify(stableValue(left[key]))!==JSON.stringify(stableValue(right[key])));
  if(fields.length)conflicts.push({id,name:a.name,status:"different",fields});
 }
 return conflicts;
}

/** Explicit user choices; never infer overwrite permission from a comparison. */
export type ConflictChoice="keep-device"|"keep-cloud"|"skip";
export type ApprovedConflict={id:string;choice:ConflictChoice};
export function validateConflictApprovals(conflicts:RecordConflict[],approvals:ApprovedConflict[]):boolean{
 const expected=new Set(conflicts.map(c=>c.id));
 if(approvals.length!==expected.size||new Set(approvals.map(a=>a.id)).size!==approvals.length)return false;
 return approvals.every(a=>expected.has(a.id)&&["keep-device","keep-cloud","skip"].includes(a.choice));
}
export function summarizeConflictApprovals(conflicts:RecordConflict[],approvals:ApprovedConflict[]){
 if(!validateConflictApprovals(conflicts,approvals))throw new Error("Every conflict requires an explicit decision.");
 return {device:approvals.filter(a=>a.choice==="keep-device").length,cloud:approvals.filter(a=>a.choice==="keep-cloud").length,skipped:approvals.filter(a=>a.choice==="skip").length};
}
