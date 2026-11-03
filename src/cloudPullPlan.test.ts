import {describe,expect,it} from "vitest";
import {planCloudPull} from "./cloudPullPlan";
const local=(itemId:string,knownRevision:string|null,pending=false)=>({itemId,knownRevision,pending,value:{name:"Local"}});
const remote=(itemId:string,revision:string)=>({itemId,revision,value:{name:"Remote"}});
describe("cloud pull planning",()=>{
 it("never mutates input snapshots",()=>{
  const a=[local("one","r1")],b=[remote("one","r2")];
  const result=planCloudPull(a,b);
  expect(result[0].kind).toBe("remote-newer");
  expect(a[0].value.name).toBe("Local");
 });
 it("keeps unsynced local edits in conflict even with matching revision",()=>{
  expect(planCloudPull([local("one","r1",true)],[remote("one","r1")])[0].kind).toBe("conflict");
 });
 it("refuses to replace local item with no revision baseline",()=>{
  expect(planCloudPull([local("one",null)],[remote("one","r1")])[0].kind).toBe("conflict");
 });
 it("classifies remote-only, local-only and unchanged",()=>{
  const plan=planCloudPull([local("a","r1"),local("b",null)],[remote("a","r1"),remote("c","r2")]);
  expect(plan.map(x=>[x.itemId,x.kind])).toEqual([["a","unchanged"],["b","local-only"],["c","remote-only"]]);
 });
 it("rejects duplicate records instead of selecting a winner",()=>{
  expect(()=>planCloudPull([local("x",null),local("x",null)],[])).toThrow("Duplicate");
  expect(()=>planCloudPull([],[remote("x","r1"),remote("x","r2")])).toThrow("Duplicate");
 });
});
