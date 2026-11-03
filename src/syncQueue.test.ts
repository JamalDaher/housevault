import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { acknowledgeSync, claimNextSync, enqueueSync, listPendingSync, retrySync } from "./syncQueue";
beforeEach(()=>{Object.defineProperty(globalThis,"indexedDB",{configurable:true,value:new IDBFactory()});});
describe("durable sync outbox",()=>{
 it("persists queued changes across independent calls and keeps payload snapshots",async()=>{
  const payload={name:"Original"};
  await enqueueSync("item-1","upsert",payload,100);
  payload.name="Changed";
  expect((await listPendingSync())[0].payload).toEqual({name:"Original"});
 });
 it("atomically leases a job to only one concurrent claimant",async()=>{
  await enqueueSync("item-1","upsert",{name:"A"},100);
  const [a,b]=await Promise.all([claimNextSync(100),claimNextSync(100)]);
  expect([a,b].filter(Boolean)).toHaveLength(1);
  const winner=a??b;
  expect(await acknowledgeSync(winner!.id,"incorrect-token")).toBe(false);
  expect(await acknowledgeSync(winner!.id,winner!.leaseToken!)).toBe(true);
  expect(await listPendingSync()).toEqual([]);
 });
 it("claims only selected household and leaves others untouched",async()=>{
  await enqueueSync("a","upsert",{name:"A"},100,"home");
  await enqueueSync("b","upsert",{name:"B"},100,"other");
  await enqueueSync("c","upsert",{name:"C"},100);
  const claimed=await claimNextSync(100,30000,"other");
  expect(claimed?.itemId).toBe("b");
  expect(await claimNextSync(100,30000,"other")).toBeNull();
  expect((await listPendingSync()).length).toBe(3);
  expect((await claimNextSync(100,30000,"home"))?.itemId).toBe("a");
  expect((await claimNextSync(100,30000,"home"))).toBeNull();
 });
 it("retries after exponential backoff without dropping data",async()=>{
  await enqueueSync("item-1","delete",null,100);
  const first=await claimNextSync(100);
  expect(first).not.toBeNull();
  expect(await retrySync(first!.id,first!.leaseToken!,100)).toBe(true);
  expect(await claimNextSync(1099)).toBeNull();
  const second=await claimNextSync(1100);
  expect(second?.attempts).toBe(1);
  expect(await retrySync(second!.id,second!.leaseToken!,1100)).toBe(true);
  expect(await claimNextSync(3099)).toBeNull();
  expect((await claimNextSync(3100))?.attempts).toBe(2);
 });
 it("reclaims an abandoned lease after timeout without losing the job",async()=>{
  await enqueueSync("item-1","upsert",{value:42},100);
  const old=await claimNextSync(100,500);
  expect(await claimNextSync(599)).toBeNull();
  const reclaimed=await claimNextSync(600);
  expect(reclaimed?.id).toBe(old?.id);
  expect(reclaimed?.leaseToken).not.toBe(old?.leaseToken);
  expect(await acknowledgeSync(old!.id,old!.leaseToken!)).toBe(false);
  expect(await acknowledgeSync(reclaimed!.id,reclaimed!.leaseToken!)).toBe(true);
 });
});
