import {describe,expect,it,vi} from "vitest";
import {submitConfirmedTombstone} from "./cloudTombstoneApi";
import type {Item} from "./domain";
const item:Item={id:"saw",name:"Saw",category:"Tools",location:"Shop",quantity:1,value:10,notes:""};
const baseline={revision:"r1",value:item};
const remote={revision:"r1",value:item};
const setup=(rpc:ReturnType<typeof vi.fn>,confirmed=true)=>({client:{rpc},confirmed,householdId:"house",itemId:"saw",local:null,baseline,remote});
describe("confirmed cloud tombstone adapter",()=>{
 it("never sends an unconfirmed request",async()=>{
  const rpc=vi.fn();
  await expect(submitConfirmedTombstone(setup(rpc,false))).rejects.toThrow("confirmation");
  expect(rpc).not.toHaveBeenCalled();
 });
 it("sends the expected revision and returns new revision",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:"r2",error:null});
  await expect(submitConfirmedTombstone(setup(rpc))).resolves.toBe("r2");
  expect(rpc).toHaveBeenCalledWith("tombstone_inventory_revision",{p_household:"house",p_item:"saw",p_expected:"r1"});
 });
 it("does not call RPC when cloud changed",async()=>{
  const rpc=vi.fn();
  await expect(submitConfirmedTombstone({...setup(rpc),remote:{revision:"r2",value:item}})).rejects.toThrow("no longer eligible");
  expect(rpc).not.toHaveBeenCalled();
 });
 it("surfaces server revision conflicts and missing revisions",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:null,error:{code:"HV001",message:"conflict"}});
  await expect(submitConfirmedTombstone(setup(rpc))).rejects.toThrow("changed");
  rpc.mockResolvedValue({data:null,error:null});
  await expect(submitConfirmedTombstone(setup(rpc))).rejects.toThrow("missing revision");
 });
});
