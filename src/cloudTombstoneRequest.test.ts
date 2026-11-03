import {describe,expect,it} from "vitest";
import {prepareTombstoneRequest} from "./cloudTombstoneRequest";
import type {Item} from "./domain";
const item=(name="Saw"):Item=>({id:"saw",name,category:"Tools",location:"Shop",quantity:1,value:10,notes:""});
describe("tombstone request preparation",()=>{
 it("requires a trusted unchanged revision",()=>{
  expect(prepareTombstoneRequest("house","saw",null,{revision:"r1",value:item()},{revision:"r1",value:item()})).toEqual({p_household:"house",p_item:"saw",p_expected:"r1"});
 });
 it("refuses local records, stale revisions and unknown history",()=>{
  const baseline={revision:"r1",value:item()};
  expect(prepareTombstoneRequest("house","saw",item(),baseline,{revision:"r1",value:item()})).toBeNull();
  expect(prepareTombstoneRequest("house","saw",null,baseline,{revision:"r2",value:item()})).toBeNull();
  expect(prepareTombstoneRequest("house","saw",null,null,{revision:"r1",value:item()})).toBeNull();
 });
 it("refuses attachment-bearing records",()=>{
  expect(prepareTombstoneRequest("house","saw",null,{revision:"r1",value:item()},{revision:"r1",value:{...item(),photo:"photo"}})).toBeNull();
 });
});
