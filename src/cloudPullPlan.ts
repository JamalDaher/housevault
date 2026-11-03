/** Pure, non-mutating cloud pull classification. Never applies remote data automatically. */
export type CloudSnapshot<T>={itemId:string;revision:string;value:T};
export type LocalSnapshot<T>={itemId:string;value:T;knownRevision:string|null;pending:boolean};
export type PullDecision<T>=
 | {kind:"unchanged";itemId:string}
 | {kind:"remote-only";itemId:string;remote:CloudSnapshot<T>}
 | {kind:"local-only";itemId:string;local:LocalSnapshot<T>}
 | {kind:"remote-newer";itemId:string;remote:CloudSnapshot<T>;local:LocalSnapshot<T>}
 | {kind:"conflict";itemId:string;remote:CloudSnapshot<T>;local:LocalSnapshot<T>};

export function planCloudPull<T>(local:LocalSnapshot<T>[],remote:CloudSnapshot<T>[]):PullDecision<T>[]{
 const localById=new Map<string,LocalSnapshot<T>>();
 const remoteById=new Map<string,CloudSnapshot<T>>();
 for(const item of local){if(!item.itemId.trim()||localById.has(item.itemId))throw new Error("Duplicate or invalid local item");localById.set(item.itemId,item);}
 for(const item of remote){if(!item.itemId.trim()||!item.revision.trim()||remoteById.has(item.itemId))throw new Error("Duplicate or invalid remote revision");remoteById.set(item.itemId,item);}
 const result:PullDecision<T>[]=[];
 for(const [itemId,cloud] of remoteById){
  const device=localById.get(itemId);
  if(!device){result.push({kind:"remote-only",itemId,remote:cloud});continue;}
  if(device.pending){result.push({kind:"conflict",itemId,remote:cloud,local:device});continue;}
  if(device.knownRevision===cloud.revision){result.push({kind:"unchanged",itemId});continue;}
  // Missing baseline is ambiguous: do not overwrite an existing local item.
  if(device.knownRevision===null){result.push({kind:"conflict",itemId,remote:cloud,local:device});continue;}
  result.push({kind:"remote-newer",itemId,remote:cloud,local:device});
 }
 for(const [itemId,device] of localById)if(!remoteById.has(itemId))result.push({kind:"local-only",itemId,local:device});
 return result.sort((a,b)=>a.itemId.localeCompare(b.itemId));
}
