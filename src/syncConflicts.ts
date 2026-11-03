import type { Item } from "./domain";

/** Three-way comparison for a future cloud sync protocol. No remote writes occur here.
 * All participants must use the same ancestor snapshot; never infer an ancestor
 * from a timestamp or from whichever device happens to upload first.
 */
export type SyncConflict = { field:string; base:unknown; local:unknown; remote:unknown };
export type MergeDecision =
 | { status:"merged"; item:Item; conflicts:[] }
 | { status:"conflict"; conflicts:SyncConflict[]; local:Item; remote:Item };

const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const keys=(...items:Item[])=>[...new Set(items.flatMap(i=>Object.keys(i)))].sort();

/** Treat each top-level field as an atomic unit. In particular, arrays and
 * attachment fields must never be merged by index or silently discarded. */
export function reconcileItem(base:Item,local:Item,remote:Item):MergeDecision {
 if(!base.id||base.id!==local.id||base.id!==remote.id)throw new Error("Sync identity mismatch");
 const conflicts:SyncConflict[]=[];
 const merged:Record<string,unknown>={};
 for(const field of keys(base,local,remote)){
  const ancestor=(base as unknown as Record<string,unknown>)[field];
  const left=(local as unknown as Record<string,unknown>)[field];
  const right=(remote as unknown as Record<string,unknown>)[field];
  if(equal(left,right))merged[field]=structuredClone(left);
  else if(equal(left,ancestor))merged[field]=structuredClone(right);
  else if(equal(right,ancestor))merged[field]=structuredClone(left);
  else conflicts.push({field,base:ancestor,local:left,remote:right});
 }
 if(conflicts.length)return {status:"conflict",conflicts,local:structuredClone(local),remote:structuredClone(remote)};
 return {status:"merged",item:merged as Item,conflicts:[]};
}

/** Remote revisions must be checked atomically by the server during commit.
 * This helper is advisory; the server must reject stale revisions itself. */
export function requiresRemoteConflict(expectedRevision:string|null,actualRevision:string|null):boolean {
 return expectedRevision!==actualRevision;
}
