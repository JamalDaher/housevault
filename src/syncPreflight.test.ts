import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type { Item } from "./domain";
import { buildAttachmentManifest } from "./attachmentSync";
import { preflightCloudRestore } from "./syncPreflight";
import { enqueueSync, listPendingSync } from "./syncQueue";
import { runSyncQueue } from "./syncRunner";
const item=(changes:Partial<Item>={}):Item=>({id:"a",name:"Drill",category:"Tools",location:"Garage",quantity:1,value:10,notes:"",...changes});
beforeEach(()=>{Object.defineProperty(globalThis,"indexedDB",{configurable:true,value:new IDBFactory()});});
describe("cloud sync rollout safety integration",()=>{
 it("keeps local outbox data after offline and failed transport, then recovers",async()=>{
  await enqueueSync("a","upsert",{name:"Drill"},100);
  const offline=await runSyncQueue(async()=>{throw Error("Unexpected network request");},{online:()=>false,now:()=>100});
  expect(offline.stopped).toBe("offline");
  const failed=await runSyncQueue(async()=>{throw Error("Temporary outage");},{now:()=>100});
  expect(failed.stopped).toBe("failed");
  expect(await listPendingSync()).toHaveLength(1);
  const delivered:string[]=[];
  const recovered=await runSyncQueue(async entry=>{delivered.push(entry.itemId);},{now:()=>1100});
  expect(recovered.sent).toBe(1);
  expect(delivered).toEqual(["a"]);
  expect(await listPendingSync()).toHaveLength(0);
 });
 it("blocks conflicting edits instead of overwriting local changes",async()=>{
  const result=await preflightCloudRestore({base:item(),local:item({name:"Local"}),remote:item({name:"Remote"})});
  expect(result).toEqual({safe:false,reason:"conflict",details:["name"]});
 });
 it("combines non-overlapping edits without mutating originals",async()=>{
  const base=item(),local=item({name:"New drill"}),remote=item({location:"Shed"});
  const result=await preflightCloudRestore({base,local,remote});
  expect(result).toEqual({safe:true,merged:item({name:"New drill",location:"Shed"}),attachmentCount:0});
  expect(local.location).toBe("Garage");
 });
 it("rejects corrupt cloud attachment downloads before restore",async()=>{
  const remote=item({photo:"data:image/png;base64,YQ=="});
  const [blob]=await buildAttachmentManifest([remote]);
  const result=await preflightCloudRestore({base:remote,local:remote,remote,downloadedAttachments:[{key:blob.entry.key,data:"data:image/png;base64,Yg=="}]});
  expect(result).toEqual({safe:false,reason:"attachment-integrity",details:[blob.entry.key]});
 });
 it("rejects identity mismatches without throwing or changing records",async()=>{
  const result=await preflightCloudRestore({base:item(),local:item(),remote:item({id:"other"})});
  expect(result.safe).toBe(false);
  if(!result.safe)expect(result.reason).toBe("identity");
 });
});
