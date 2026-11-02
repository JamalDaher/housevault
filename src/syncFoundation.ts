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

function canonical(item:Item):string {
 // Key order is deterministic for JSON data produced by the same application.
 return JSON.stringify(item);
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
