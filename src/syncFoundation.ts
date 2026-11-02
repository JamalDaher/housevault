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
