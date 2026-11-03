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
 it("runs only the selected household's queued entries",async()=>{
  await enqueueSync("home-item","upsert",{name:"Home"},100,"home");
  await enqueueSync("other-item","upsert",{name:"Other"},100,"other");
  await enqueueSync("legacy-item","upsert",{name:"Legacy"},100);
  const sent:string[]=[];
  const result=await runSyncQueue(async entry=>{sent.push(entry.itemId);},{now:()=>100,householdId:"home"});
  expect(sent).toEqual(["home-item"]);
  expect(result).toEqual({sent:1,failed:0,remaining:false,stopped:"empty"});
  expect((await listPendingSync()).map(entry=>entry.itemId).sort()).toEqual(["legacy-item","other-item"]);
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
 it("reports delayed retries as remaining work, not an empty queue",async()=>{
  await enqueueSync("a","upsert",{name:"A"},100);
  const claimed=await import("./syncQueue").then(q=>q.claimNextSync(100));
  await import("./syncQueue").then(q=>q.retrySync(claimed!.id,claimed!.leaseToken!,100));
  const result=await runSyncQueue(async()=>{throw new Error("Should not send before retry");},{now:()=>101});
  expect(result).toEqual({sent:0,failed:0,remaining:true,stopped:"deferred"});
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

describe("sync batch completion status",()=>{
 it("reports empty when the final entry exactly matches the batch limit",async()=>{
  await enqueueSync("a","upsert",{name:"A"},100,"home");
  const result=await runSyncQueue(async()=>undefined,{now:()=>100,householdId:"home",maxEntries:1});
  expect(result).toEqual({sent:1,failed:0,remaining:false,stopped:"empty"});
 });
 it("reports remaining only for the selected household",async()=>{
  await enqueueSync("a","upsert",{name:"A"},100,"home");
  await enqueueSync("b","upsert",{name:"B"},100,"other");
  const result=await runSyncQueue(async()=>undefined,{now:()=>100,householdId:"home",maxEntries:1});
  expect(result.remaining).toBe(false);
  expect(await listPendingSync()).toHaveLength(1);
 });
});

describe("offline queue status",()=>{
 it("does not claim pending household work when only another household has entries",async()=>{
  await enqueueSync("other","upsert",{name:"Other"},100,"other");
  const result=await runSyncQueue(async()=>{throw new Error("Must not send");},{online:()=>false,now:()=>100,householdId:"home"});
  expect(result).toEqual({sent:0,failed:0,remaining:false,stopped:"offline"});
 });
 it("retains pending status when selected household is offline",async()=>{
  await enqueueSync("home-item","upsert",{name:"Home"},100,"home");
  const result=await runSyncQueue(async()=>{throw new Error("Must not send");},{online:()=>false,now:()=>100,householdId:"home"});
  expect(result.remaining).toBe(true);
  expect(await listPendingSync()).toHaveLength(1);
 });
});

describe("deferred retry reporting",()=>{
 it("distinguishes a pending backoff entry from an empty queue",async()=>{
  await enqueueSync("a","upsert",{name:"A"},100,"home");
  const first=await runSyncQueue(async()=>{throw new Error("Temporary outage");},{now:()=>100,householdId:"home"});
  expect(first.stopped).toBe("failed");
  const second=await runSyncQueue(async()=>undefined,{now:()=>101,householdId:"home"});
  expect(second).toEqual({sent:0,failed:0,remaining:true,stopped:"deferred"});
 });
});
