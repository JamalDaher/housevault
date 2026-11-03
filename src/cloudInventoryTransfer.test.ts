import {describe,expect,it} from "vitest";
import {fetchCloudInventory,planInventoryTransfer,uploadNewCloudItem} from "./cloudInventoryTransfer";
import {CloudRevisionConflict} from "./syncRevision";
import type {Item} from "./domain";
const item=(id:string):Item=>({id,name:id,category:"Tools",location:"Garage",quantity:1,value:10,notes:""});
describe("cloud inventory transfer",()=>{
 it("downloads only valid household records and excludes smoke-test rows",async()=>{
  const client={from:()=>({select:()=>({eq:()=>({limit:async()=>({data:[{item_id:"one",revision:"r1",payload:item("one")},{item_id:"__housevault_test_123",revision:"r2",payload:item("__housevault_test_123")}],error:null})})})})};
  const rows=await fetchCloudInventory(client,"household");
  expect(rows).toHaveLength(1);
  expect(rows[0].value.id).toBe("one");
 });
 it("never imports soft-deleted cloud records",async()=>{
  const client={from:()=>({select:()=>({eq:()=>({limit:async()=>({data:[{item_id:"gone",revision:"r2",payload:item("gone"),deleted_at:"2026-11-03T00:00:00Z"},{item_id:"live",revision:"r1",payload:item("live"),deleted_at:null}],error:null})})})})};
  const rows=await fetchCloudInventory(client,"household");
  expect(rows.map(row=>row.itemId)).toEqual(["live"]);
 });
 it("rejects mismatched identities before any import",async()=>{
  const client={from:()=>({select:()=>({eq:()=>({limit:async()=>({data:[{item_id:"one",revision:"r1",payload:item("other")}],error:null})})})})};
  await expect(fetchCloudInventory(client,"household")).rejects.toThrow("identity");
 });
 it("preserves a local record with no baseline",()=>{
  expect(planInventoryTransfer([{itemId:"one",knownRevision:null,pending:false,value:item("one")}],[{itemId:"one",revision:"r1",value:item("one")}])[0].kind).toBe("conflict");
 });
 it("rejects attachment uploads before calling transport",async()=>{
  let called=false;
  await expect(uploadNewCloudItem({...item("one"),photo:"data:image/png;base64,AAAA"},async()=>{called=true;return {status:"saved",revision:"r1",value:item("one")};})).rejects.toThrow("Attachment");
  expect(called).toBe(false);
 });
 it("uploads a new item with null expected revision",async()=>{
  const revision=await uploadNewCloudItem(item("one"),async write=>{
   expect(write.expectedRevision).toBeNull();
   return {status:"saved",revision:"r1",value:write.value};
  });
  expect(revision).toBe("r1");
 });
 it("does not overwrite existing cloud items",async()=>{
  await expect(uploadNewCloudItem(item("one"),async()=>({status:"conflict",revision:"r1",remote:item("one")}))).rejects.toBeInstanceOf(CloudRevisionConflict);
 });
});
