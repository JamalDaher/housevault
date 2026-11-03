import type { SyncEntry } from "./syncQueue";
import { saveWithRevision, type RevisionTransport } from "./syncRevision";

export function revisionQueueTransport<T>(send:RevisionTransport<T>, getRevision:(id:string)=>Promise<string|null>, storeRevision:(id:string,revision:string)=>Promise<void>){
 return async (entry:SyncEntry):Promise<void>=>{
  if(entry.operation!=="upsert")throw new Error("Revision-safe deletion is not implemented");
  const expectedRevision=await getRevision(entry.itemId);
  const saved=await saveWithRevision({itemId:entry.itemId,expectedRevision,value:entry.payload as T},send);
  await storeRevision(entry.itemId,saved.revision);
 };
}
