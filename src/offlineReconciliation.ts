import type {Item} from "./domain";
import type {SyncBaseline} from "./syncBaselines";
import {hasAttachments,sameItem} from "./syncBaselines";

export type PendingChange=
 | {kind:"create";item:Item}
 | {kind:"update";item:Item;expectedRevision:string}
 | {kind:"delete";itemId:string;expectedRevision:string}
 | {kind:"conflict";itemId:string;reason:"attachments"|"missing-baseline"|"remote-changed"|"invalid-identity"}
 | {kind:"unchanged";itemId:string};

/** Pure, conservative reconciliation for an offline change.
 * Never infer deletion from missing local state without a trusted baseline.
 * The caller must revalidate remote revision with the server before writing.
 */
export function planPendingChange(input:{
 itemId:string;local:Item|null;baseline:SyncBaseline|null;
 remote:{revision:string;value:Item;deleted?:boolean}|null;
}):PendingChange{
 const {itemId,local,baseline,remote}=input;
 if(!itemId.trim()||local&&local.id!==itemId||baseline&&baseline.value.id!==itemId||remote&&remote.value.id!==itemId)
  return {kind:"conflict",itemId,reason:"invalid-identity"};
 if([local,baseline?.value,remote?.value].some(value=>value&&hasAttachments(value)))
  return {kind:"conflict",itemId,reason:"attachments"};
 if(remote?.deleted)return {kind:"conflict",itemId,reason:"remote-changed"};
 if(!baseline){
  if(!local)return {kind:"unchanged",itemId};
  return remote?{kind:"conflict",itemId,reason:"missing-baseline"}:{kind:"create",item:structuredClone(local)};
 }
 if(!remote)return {kind:"conflict",itemId,reason:"remote-changed"};
 if(remote.revision!==baseline.revision||!sameItem(remote.value,baseline.value))
  return {kind:"conflict",itemId,reason:"remote-changed"};
 if(!local)return {kind:"delete",itemId,expectedRevision:baseline.revision};
 if(sameItem(local,baseline.value))return {kind:"unchanged",itemId};
 return {kind:"update",item:structuredClone(local),expectedRevision:baseline.revision};
}
