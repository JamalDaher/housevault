import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { enqueueSync, listPendingSync } from "./syncQueue";
import { CloudRevisionConflict } from "./syncRevision";
import { runSyncQueue, syncStatus } from "./syncRunner";
beforeEach(()=>{Object.defineProperty(globalThis,"indexedDB",{configurable:true,value:new IDBFactory()});});
describe("opt-in sync runner",()=>{
 it("sends and acknowledges pending changes only when invoked",async()=>{
  await enqueueSync("a","upsert",{name:"A"},100);
  expect(await listPendingSync()).toHaveLength(1);
  const sent:string[]=[];
  const result=await runSyncQueue(async entry=>{sent.push(entry.itemId);},{now:()=>100});
  expect(result).toEqual({sent:1,failed:0,remaining:false,stopped:"empty"});
  expect(sent).toEqual(["a"]);
  expect(await listPendingSync()).toEqual([]);
 });
 it("keeps queued changes untouched while offline",async()=>{
  await enqueueSync("a","delete",null,100);
  const result=await runSyncQueue(async()=>{throw new Error("Should not send");},{online:()=>false,now:()=>100});
  expect(result.stopped).toBe("offline");
  expect(await listPendingSync()).toHaveLength(1);
 });
 it("preserves failed entries for later retry",async()=>{
  await enqueueSync("a","upsert",{name:"A"},100);
  const result=await runSyncQueue(async()=>{throw new Error("Temporary outage");},{now:()=>100});
  expect(result).toEqual({sent:0,failed:1,remaining:true,stopped:"failed"});
  const pending=await listPendingSync();
  expect(pending).toHaveLength(1);
  expect(pending[0].attempts).toBe(1);
  expect(pending[0].nextAttemptAt).toBe(1100);
 });
 it("reports a revision conflict without discarding the queued change",async()=>{
  await enqueueSync("a","upsert",{name:"Local"},100);
  const result=await runSyncQueue(async()=>{throw new CloudRevisionConflict("remote-v2",{name:"Remote"});},{now:()=>100});
  expect(result.stopped).toBe("conflict");
  const pending=await listPendingSync();
  expect(pending).toHaveLength(1);
  expect(pending[0].payload).toEqual({name:"Local"});
 });
 it("bounds each run to avoid monopolizing the event loop",async()=>{
  await enqueueSync("a","delete",null,100);
  await enqueueSync("b","delete",null,101);
  const result=await runSyncQueue(async()=>{},{now:()=>102,maxEntries:1});
  expect(result.stopped).toBe("limit");
  expect(await listPendingSync()).toHaveLength(1);
 });
 it("derives clear UI status without triggering network requests",()=>{
  expect(syncStatus({online:false,pending:2,running:false,error:true})).toBe("offline");
  expect(syncStatus({online:true,pending:2,running:true,error:false})).toBe("syncing");
  expect(syncStatus({online:true,pending:2,running:false,error:true})).toBe("error");
  expect(syncStatus({online:true,pending:2,running:false,error:false})).toBe("pending");
  expect(syncStatus({online:true,pending:0,running:false,error:false})).toBe("idle");
 });
});
