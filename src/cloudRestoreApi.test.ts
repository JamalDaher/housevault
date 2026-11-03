import {describe,expect,it,vi} from "vitest";
import {eligibleRestore,requestCloudRestore} from "./cloudRestoreApi";
import type {Item} from "./domain";
const item:Item={id:"saw",name:"Saw",category:"Tools",location:"Shop",quantity:1,value:10,notes:""};
const row={item_id:"saw",revision:"r2",deleted_at:"2026-11-03T00:00:00Z",payload:item};
describe("cloud restoration",()=>{
 it("rejects active and mismatched rows",()=>{
  expect(eligibleRestore({...row,deleted_at:null})).toBe(false);
  expect(eligibleRestore({...row,payload:{...item,id:"other"}})).toBe(false);
 });
 it("requires explicit confirmation",async()=>{
  const rpc=vi.fn();
  await expect(requestCloudRestore({rpc},"house",row,false)).rejects.toThrow("confirmation");
  expect(rpc).not.toHaveBeenCalled();
 });
 it("restores using the tombstone revision",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:"r3",error:null});
  await expect(requestCloudRestore({rpc},"house",row,true)).resolves.toBe("r3");
  expect(rpc).toHaveBeenCalledWith("restore_inventory_revision",{p_household:"house",p_item:"saw",p_expected:"r2"});
 });
 it("rejects stale tombstone revisions",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:null,error:{code:"HV001",message:"conflict"}});
  await expect(requestCloudRestore({rpc},"house",row,true)).rejects.toThrow("changed");
 });
});
