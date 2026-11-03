import { describe, expect, it } from "vitest";
import type { Item } from "./domain";
import { reconcileItem, requiresRemoteConflict } from "./syncConflicts";
const item=(overrides:Partial<Item>={}):Item=>({id:"a",name:"Drill",category:"Tools",location:"Garage",quantity:1,value:50,notes:"",...overrides});
describe("conservative cloud sync reconciliation",()=>{
 it("combines edits to independent fields without overwriting either device",()=>{
  const base=item(),local=item({name:"Cordless Drill"}),remote=item({location:"Workshop"});
  expect(reconcileItem(base,local,remote)).toEqual({status:"merged",item:item({name:"Cordless Drill",location:"Workshop"}),conflicts:[]});
 });
 it("flags divergent edits to the same field and preserves both versions",()=>{
  const base=item(),local=item({name:"Local"}),remote=item({name:"Remote"});
  const result=reconcileItem(base,local,remote);
  expect(result.status).toBe("conflict");
  if(result.status==="conflict"){
   expect(result.conflicts.map(c=>c.field)).toEqual(["name"]);
   expect(result.local.name).toBe("Local");
   expect(result.remote.name).toBe("Remote");
  }
 });
 it("treats photos and document arrays atomically rather than silently merging indices",()=>{
  const base=item({photos:["data:image/png;base64,YQ=="]});
  const local=item({photos:["data:image/png;base64,Yg=="]});
  const remote=item({photos:["data:image/png;base64,Yw=="]});
  const result=reconcileItem(base,local,remote);
  expect(result.status).toBe("conflict");
  if(result.status==="conflict")expect(result.conflicts.map(c=>c.field)).toContain("photos");
 });
 it("accepts matching edits made independently",()=>{
  const base=item(),local=item({value:75});
  expect(reconcileItem(base,local,item({value:75}))).toEqual({status:"merged",item:local,conflicts:[]});
 });
 it("rejects mismatched record identities and stale remote revisions",()=>{
  expect(()=>reconcileItem(item(),item({id:"b"}),item())).toThrow("identity");
  expect(requiresRemoteConflict("v1","v2")).toBe(true);
  expect(requiresRemoteConflict("v2","v2")).toBe(false);
  expect(requiresRemoteConflict(null,"v1")).toBe(true);
 });
 it("does not mutate any input records",()=>{
  const base=item(),local=item({name:"Local"}),remote=item({location:"Shed"});
  const result=reconcileItem(base,local,remote);
  if(result.status==="merged")result.item.name="Mutated";
  expect(local.name).toBe("Local");
  expect(remote.location).toBe("Shed");
 });
});
