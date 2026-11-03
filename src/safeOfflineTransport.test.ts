import {describe,it,expect,vi} from "vitest";
import {createSafeOfflineTransport} from "./safeOfflineTransport";
import type {Item} from "./domain";
import type {SyncEntry} from "./syncQueue";
const item:Item={id:"a",name:"Hammer",category:"Tools",location:"Shop",quantity:1,value:10,notes:""};
const entry:SyncEntry={id:"q",itemId:"a",householdId:"home",operation:"upsert",payload:item,createdAt:1,attempts:0,nextAttemptAt:1,leaseUntil:0,leaseToken:null};
function setup(overrides:Record<string,unknown>={}){
 const deps={
  householdId:"home",
  readLocal:vi.fn(async()=>item),
  readBaseline:vi.fn(async()=>null),
  readRemote:vi.fn(async()=>null),
  write:vi.fn(async()=>({status:"saved" as const,revision:"r2",value:item})),
  saveBaseline:vi.fn(async()=>undefined),
  ...overrides
 };
 return {deps,transport:createSafeOfflineTransport(deps)};
}
describe("safe offline queue transport",()=>{
 it("writes new items with null revision and persists baseline",async()=>{
  const {deps,transport}=setup();
  await transport(entry);
  expect(deps.write).toHaveBeenCalledWith({itemId:"a",expectedRevision:null,value:item});
  expect(deps.saveBaseline).toHaveBeenCalledWith("a",{revision:"r2",value:item});
 });
 it("does not upload stale queued snapshots",async()=>{
  const {deps,transport}=setup({readLocal:async()=>({...item,name:"Changed"})});
  await expect(transport(entry)).rejects.toThrow("changed");
  expect(deps.write).not.toHaveBeenCalled();
 });
 it("does not upload over a remote record without baseline",async()=>{
  const {deps,transport}=setup({readRemote:async()=>({revision:"r1",value:item})});
  await expect(transport(entry)).rejects.toThrow();
  expect(deps.write).not.toHaveBeenCalled();
 });
 it("uses baseline revision for safe edits",async()=>{
  const updated={...item,name:"Updated"};
  const {deps,transport}=setup({
   readLocal:async()=>updated,
   readBaseline:async()=>({revision:"r1",value:item}),
   readRemote:async()=>({revision:"r1",value:item})
  });
  await transport({...entry,payload:updated});
  expect(deps.write).toHaveBeenCalledWith({itemId:"a",expectedRevision:"r1",value:updated});
 });
 it("refuses cloud edits when the remote revision has changed",async()=>{
  const updated={...item,name:"Updated"};
  const {deps,transport}=setup({
   readLocal:async()=>updated,
   readBaseline:async()=>({revision:"r1",value:item}),
   readRemote:async()=>({revision:"r2",value:item})
  });
  await expect(transport({...entry,payload:updated})).rejects.toThrow();
  expect(deps.write).not.toHaveBeenCalled();
  expect(deps.saveBaseline).not.toHaveBeenCalled();
 });
 it("rejects queued attachments",async()=>{
  const withPhoto={...item,photo:"data:image/png;base64,YQ=="};
  const {deps,transport}=setup({readLocal:async()=>withPhoto});
  await expect(transport({...entry,payload:withPhoto})).rejects.toThrow();
  expect(deps.write).not.toHaveBeenCalled();
 });
 it("acknowledges already-synced queued snapshots without a duplicate write",async()=>{
  const {deps,transport}=setup({
   readBaseline:async()=>({revision:"r1",value:item}),
   readRemote:async()=>({revision:"r1",value:item})
  });
  await transport(entry);
  expect(deps.write).not.toHaveBeenCalled();
  expect(deps.saveBaseline).not.toHaveBeenCalled();
 });
 it("refuses tombstoned records even if the payload matches",async()=>{
  const {deps,transport}=setup({
   readBaseline:async()=>({revision:"r1",value:item}),
   readRemote:async()=>({revision:"r1",value:item,deleted:true})
  });
  await expect(transport(entry)).rejects.toThrow();
  expect(deps.write).not.toHaveBeenCalled();
 });
 it("refuses entries for another household or legacy unscoped entries",async()=>{
  const {deps,transport}=setup();
  await expect(transport({...entry,householdId:"other"})).rejects.toThrow("household");
  await expect(transport({...entry,householdId:undefined})).rejects.toThrow("household");
  expect(deps.write).not.toHaveBeenCalled();
 });
 it("does not automatically delete",async()=>{
  const {deps,transport}=setup();
  await expect(transport({...entry,operation:"delete"})).rejects.toThrow("explicit review");
  expect(deps.write).not.toHaveBeenCalled();
 });
});
