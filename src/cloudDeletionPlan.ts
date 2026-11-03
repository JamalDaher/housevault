import type {Item} from "./domain";
import {hasAttachments,sameItem,type SyncBaseline} from "./syncBaselines";

/** A deletion candidate is only a proposal; never delete remotely from this result. */
export type DeletionDecision=
 | {kind:"eligible";itemId:string;expectedRevision:string;lastKnown:Item}
 | {kind:"conflict";itemId:string;reason:"remote-changed"|"attachments"|"invalid-identity"}
 | {kind:"not-deleted";itemId:string}
 | {kind:"untracked";itemId:string};

/** Compare a known local baseline with the latest cloud snapshot before requesting
 * an explicit, revision-checked deletion. This function has no side effects. */
export function planCloudDeletion(input:{
 itemId:string;
 local:Item|null;
 baseline:SyncBaseline|null;
 remote:{revision:string;value:Item}|null;
}):DeletionDecision{
 const {itemId,local,baseline,remote}=input;
 if(!itemId.trim()||local?.id!==undefined&&local.id!==itemId||baseline?.value.id!==undefined&&baseline.value.id!==itemId||remote?.value.id!==undefined&&remote.value.id!==itemId)
  return {kind:"conflict",itemId,reason:"invalid-identity"};
 if(local)return {kind:"not-deleted",itemId};
 if(!baseline||!remote)return {kind:"untracked",itemId};
 if(hasAttachments(baseline.value)||hasAttachments(remote.value))
  return {kind:"conflict",itemId,reason:"attachments"};
 if(remote.revision!==baseline.revision||!sameItem(remote.value,baseline.value))
  return {kind:"conflict",itemId,reason:"remote-changed"};
 return {kind:"eligible",itemId,expectedRevision:baseline.revision,lastKnown:structuredClone(baseline.value)};
}
