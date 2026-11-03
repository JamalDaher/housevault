import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { acknowledgeSync, claimNextSync, enqueueSync, listPendingSync, retrySync, refreshQueuedUpsert, enqueueUniqueHouseholdUpsert } from "./syncQueue";
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

describe("queued edit refresh",()=>{
 it("replaces one unleased snapshot without creating duplicate entries",async()=>{
  await enqueueSync("a","upsert",{name:"Old"},100,"home");
  expect(await refreshQueuedUpsert("home","a",{name:"New"},110)).toBe(true);
  const entries=await listPendingSync();
  expect(entries).toHaveLength(1);
  expect(entries[0].payload).toEqual({name:"New"});
  expect(entries[0].nextAttemptAt).toBe(110);
 });
 it("never changes another household or an actively leased entry",async()=>{
  await enqueueSync("a","upsert",{name:"Other"},100,"other");
  expect(await refreshQueuedUpsert("home","a",{name:"New"},110)).toBe(false);
  await enqueueSync("a","upsert",{name:"Home"},100,"home");
  const claimed=await claimNextSync(100,30000,"home");
  expect(claimed).not.toBeNull();
  expect(await refreshQueuedUpsert("home","a",{name:"New"},110)).toBe(false);
  expect((await listPendingSync()).find(e=>e.householdId==="home")?.payload).toEqual({name:"Home"});
 });
 it("refuses ambiguous duplicates",async()=>{
  await enqueueSync("a","upsert",{name:"One"},100,"home");
  await enqueueSync("a","upsert",{name:"Two"},101,"home");
  expect(await refreshQueuedUpsert("home","a",{name:"New"},110)).toBe(false);
 });
});

describe("atomic household queue deduplication",()=>{
 it("allows only one pending entry for concurrent same-household edits",async()=>{
  const results=await Promise.all(Array.from({length:8},()=>enqueueUniqueHouseholdUpsert("home","a",{name:"Edited"},100)));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await listPendingSync()).toHaveLength(1);
 });
 it("permits separate households and blocks duplicates even when leased",async()=>{
  expect(await enqueueUniqueHouseholdUpsert("home","a",{name:"A"},100)).toBe(true);
  await claimNextSync(100,30000,"home");
  expect(await enqueueUniqueHouseholdUpsert("home","a",{name:"B"},101)).toBe(false);
  expect(await enqueueUniqueHouseholdUpsert("other","a",{name:"B"},101)).toBe(true);
  expect(await listPendingSync()).toHaveLength(2);
 });
});

describe("household outbox lifecycle",()=>{
 it("allows a fresh edit after the previous queued edit was acknowledged",async()=>{
  expect(await enqueueUniqueHouseholdUpsert("home","a",{name:"First"},100)).toBe(true);
  const claimed=await claimNextSync(100,30000,"home");
  expect(claimed).not.toBeNull();
  expect(await acknowledgeSync(claimed!.id,claimed!.leaseToken!)).toBe(true);
  expect(await enqueueUniqueHouseholdUpsert("home","a",{name:"Second"},200)).toBe(true);
  const pending=await listPendingSync();
  expect(pending).toHaveLength(1);
  expect(pending[0].payload).toEqual({name:"Second"});
 });
 it("never merges entries across households",async()=>{
  expect(await enqueueUniqueHouseholdUpsert("home-a","a",{name:"A"},100)).toBe(true);
  expect(await enqueueUniqueHouseholdUpsert("home-b","a",{name:"B"},100)).toBe(true);
  expect(await enqueueUniqueHouseholdUpsert("home-a","a",{name:"Duplicate"},101)).toBe(false);
  expect((await listPendingSync()).map(e=>e.householdId).sort()).toEqual(["home-a","home-b"]);
 });
});

describe("interrupted sync lease recovery",()=>{
 it("reclaims an expired lease and rejects acknowledgement from the old owner",async()=>{
  await enqueueSync("a","upsert",{name:"Hammer"},100,"home");
  const first=await claimNextSync(100,30_000,"home");
  expect(first).not.toBeNull();
  expect(await claimNextSync(30_099,30_000,"home")).toBeNull();
  const second=await claimNextSync(30_100,30_000,"home");
  expect(second).not.toBeNull();
  expect(second!.id).toBe(first!.id);
  expect(second!.leaseToken).not.toBe(first!.leaseToken);
  expect(await acknowledgeSync(first!.id,first!.leaseToken!)).toBe(false);
  expect(await listPendingSync()).toHaveLength(1);
  expect(await acknowledgeSync(second!.id,second!.leaseToken!)).toBe(true);
  expect(await listPendingSync()).toHaveLength(0);
 });
});

describe("leased snapshot refresh safety",()=>{
 it("refuses refresh during an active lease and permits it after a retry releases the lease",async()=>{
  await enqueueSync("a","upsert",{name:"Old"},100,"home");
  const claimed=await claimNextSync(100,30_000,"home");
  expect(claimed).not.toBeNull();
  expect(await refreshQueuedUpsert("home","a",{name:"New"},101)).toBe(false);
  expect((await listPendingSync())[0].payload).toEqual({name:"Old"});
  expect(await retrySync(claimed!.id,claimed!.leaseToken!,102)).toBe(true);
  expect(await refreshQueuedUpsert("home","a",{name:"New"},103)).toBe(true);
  const pending=await listPendingSync();
  expect(pending[0].payload).toEqual({name:"New"});
  expect(pending[0].attempts).toBe(0);
  expect(pending[0].nextAttemptAt).toBe(103);
 });
});
